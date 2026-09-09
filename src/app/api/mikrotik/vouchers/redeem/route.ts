import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";
import { updateOrCreateHotspotUser } from "@/lib/mikrotik/queries";
import { getUtcTimestamp, getDubaiSoldDate } from "@/lib/utils";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = await getDB();
  const nowUtc = getUtcTimestamp();
  const authUser = extractAuthToken(request);
  let selectedVoucherCode: string | null = null;
  let finalVoucherCode: string | null = null;
  let validityDaysNum = 0;
  let mobileNumber = "";

  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      await resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const { validity_days, voucherId, voucherCode, mobileNumber: rawMobile, salesperson, salesPersonId } = body;
    mobileNumber = String(rawMobile || "").trim();

    if (!mobileNumber) {
      return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });
    }

    // Resolve salesperson ID and display name from trusted JWT if available, else from body
    let resolvedSalesPersonId: number | null = authUser?.userId ? Number(authUser.userId) : (salesPersonId ? Number(salesPersonId) : null);
    let resolvedSoldBy: string | null = authUser?.displayName ? String(authUser.displayName) : (authUser?.sub ? String(authUser.sub) : (salesperson ? String(salesperson).trim() : null));

    if (!resolvedSalesPersonId && resolvedSoldBy) {
      try {
        const spRes = await db.execute({
          sql: "SELECT id, username, display_name FROM sales_persons WHERE username = ? OR display_name = ? LIMIT 1",
          args: [resolvedSoldBy, resolvedSoldBy],
        });
        if (spRes.rows.length > 0) {
          resolvedSalesPersonId = Number(spRes.rows[0].id);
          resolvedSoldBy = String(spRes.rows[0].display_name || spRes.rows[0].username);
        }
      } catch {
        // Fallback
      }
    }

    // Check salesperson allowed camps and company status from database
    if (resolvedSalesPersonId) {
      try {
        const spCompRes = await db.execute({
          sql: `
            SELECT sp.company_id, sp.allowed_camps, c.status as company_status, c.suspended_reason
            FROM sales_persons sp
            LEFT JOIN companies c ON sp.company_id IS NOT NULL AND c.id = sp.company_id
            WHERE sp.id = ?
            LIMIT 1
          `,
          args: [resolvedSalesPersonId],
        });
        if (spCompRes.rows.length > 0) {
          const compRow = spCompRes.rows[0];
          if (compRow.company_status !== undefined && Number(compRow.company_status) === 0) {
            const reason = compRow.suspended_reason ? String(compRow.suspended_reason) : "Sales paused: Company account is temporarily suspended due to outstanding dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          // Strict router permission check: ensure this router is permitted for the salesperson
          let allowedCamps: string[] = [];
          if (compRow.allowed_camps) {
            try {
              allowedCamps = JSON.parse(String(compRow.allowed_camps));
            } catch {
              allowedCamps = [String(compRow.allowed_camps)];
            }
          }

          if (allowedCamps.length > 0) {
            const allowedLower = allowedCamps.map((c) => c.toLowerCase());
            const reqRouterId = (config.id || "").toLowerCase();
            const reqSession = (config.sessionName || "").toLowerCase();
            const reqCamp = (config.camp || "").toLowerCase();

            const isAllowed =
              allowedLower.includes(reqRouterId) ||
              (reqSession && allowedLower.includes(reqSession)) ||
              (reqCamp && allowedLower.includes(reqCamp));

            if (!isAllowed) {
              return NextResponse.json(
                { error: "Access Denied: You do not have permission to sell vouchers for this camp router." },
                { status: 403 }
              );
            }
          }
        }
      } catch (err) {
        console.warn("Could not check company status / allowed camps in redeem:", err);
      }
    }

    if (validity_days !== undefined && validity_days !== null) {
      validityDaysNum = Number(validity_days);
      if (isNaN(validityDaysNum) || validityDaysNum <= 0) {
        return NextResponse.json({ error: "Invalid validity period" }, { status: 400 });
      }

      // Fetch dynamic price from camp_validity_pricing by camp name
      const campName = config.camp ?? config.sessionName;
      const validityLabel = `${validityDaysNum}-Days`;
      
      let priceCharged = validityDaysNum === 30 ? 32 : validityDaysNum === 15 ? 16 : validityDaysNum === 10 ? 20 : validityDaysNum === 7 ? 15 : validityDaysNum * 2;

      try {
        const campPriceRes = await db.execute({
          sql: "SELECT price FROM camp_validity_pricing WHERE (camp_name = ? OR camp_name = ?) AND validity_name = ?",
          args: [campName, config.sessionName, validityLabel],
        });
        if (campPriceRes.rows.length > 0 && campPriceRes.rows[0].price !== null) {
          priceCharged = Number(campPriceRes.rows[0].price);
        }
      } catch {
        // Use default fallback price
      }

      // Step 1: Transaction to select and mark the voucher as reserved
      const tx = await db.transaction("write");
      try {
        // Run cleanup of expired reservations inside transaction to free up slot
        await tx.execute(`
          UPDATE vouchers 
          SET status = 'available', reserved_at = NULL, reserved_until = NULL 
          WHERE status = 'reserved' AND reserved_until < datetime('now')
        `);

        // Check if there is an available voucher matching the validity
        const checkResult = await tx.execute({
          sql: `
            SELECT voucher_code 
            FROM vouchers 
            WHERE validity_days = ? AND status = 'available' AND router_id = ?
            ORDER BY voucher_code ASC 
            LIMIT 1
          `,
          args: [validityDaysNum, config.id]
        });

        if (checkResult.rows.length === 0) {
          await tx.rollback();
          return NextResponse.json(
            { error: `No vouchers available for ${validityDaysNum}-Days plan` },
            { status: 400 }
          );
        }

        selectedVoucherCode = String(checkResult.rows[0].voucher_code);
        finalVoucherCode = selectedVoucherCode;

        // Reserve the voucher for 5 minutes
        await tx.execute({
          sql: `
            UPDATE vouchers 
            SET status = 'reserved', reserved_at = datetime('now'), reserved_until = datetime('now', '+5 minutes')
            WHERE voucher_code = ?
          `,
          args: [selectedVoucherCode]
        });

        await tx.commit();
      } catch (txError) {
        await tx.rollback();
        return NextResponse.json(
          { error: txError instanceof Error ? txError.message : "Failed to reserve voucher" },
          { status: 400 }
        );
      }

      // Step 2: Connect to MikroTik and create/update the hotspot user
      const username = selectedVoucherCode;
      const password = selectedVoucherCode;
      const profile = `${validityDaysNum}-Days`;
      const soldDateStr = getDubaiSoldDate();
      const comment = `Sold on ${soldDateStr}`;

      let mikrotikSuccess = false;
      try {
        await updateOrCreateHotspotUser(config, username, password, profile, comment);
        mikrotikSuccess = true;
      } catch (mikrotikError) {
        const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router connection failed";
        // Keep as redeemed but mark activation as failed. Payment was collected, so it cannot be put back in inventory.
        try {
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, sales_person_id = ?, price_charged = ?, router_id = ?, activation_status = 'failed', activation_error = ?
              WHERE voucher_code = ?
            `,
            args: [
              mobileNumber,
              nowUtc,
              resolvedSoldBy || null,
              resolvedSalesPersonId ? Number(resolvedSalesPersonId) : null,
              Number(priceCharged) || 0,
              config.id ? String(config.id) : null,
              errMsg,
              selectedVoucherCode
            ]
          });
        } catch (revertError) {
          console.error("Critical: Failed to log voucher activation failure", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${errMsg}` },
          { status: 502 }
        );
      }

      if (mikrotikSuccess) {
        // Update to redeemed on success with Dubai Local Time (Asia/Dubai)
        try {
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, sales_person_id = ?, price_charged = ?, router_id = ?, activation_status = 'success', activation_error = NULL
              WHERE voucher_code = ?
            `,
            args: [
              mobileNumber,
              nowUtc,
              resolvedSoldBy || null,
              resolvedSalesPersonId ? Number(resolvedSalesPersonId) : null,
              Number(priceCharged) || 0,
              config.id ? String(config.id) : null,
              selectedVoucherCode
            ]
          });
        } catch (dbErr) {
          console.error("DB update error after successful router provision:", dbErr);
        }
      }
    } else if (voucherId) {
      // Flow for redeeming by specific voucher ID (MikroTik user ID)
      const { toConnectionParams } = await import("@/lib/mikrotik/config");
      const { withMikrotikClient } = await import("@/lib/mikrotik/client");
      
      let routerUserRecord: { name: string; profile: string } | null = null;
      try {
        const records = await withMikrotikClient(toConnectionParams(config), async (client) => {
          return await client.write("/ip/hotspot/user/print", [`?.id=${voucherId}`]);
        }) as Record<string, string>[];
        
        if (records && records.length > 0) {
          routerUserRecord = {
            name: records[0].name || "",
            profile: records[0].profile || "",
          };
        }
      } catch (err) {
        return NextResponse.json(
          { error: `Failed to fetch voucher from router: ${err instanceof Error ? err.message : "Unknown error"}` },
          { status: 502 }
        );
      }
      
      if (!routerUserRecord || !routerUserRecord.name) {
        return NextResponse.json({ error: "Voucher not found on router" }, { status: 404 });
      }

      selectedVoucherCode = routerUserRecord.name;
      finalVoucherCode = selectedVoucherCode;
      const profileName = routerUserRecord.profile;
      
      // Parse validity days from profile name
      const match = profileName.match(/(\d+)\D*days?/i);
      if (match) {
        validityDaysNum = Number(match[1]);
      } else {
        const numeric = Number(profileName.replace(/[^0-9]/g, ""));
        validityDaysNum = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
      }
      
      if (validityDaysNum <= 0) {
        return NextResponse.json({ error: `Could not parse validity days from profile: ${profileName}` }, { status: 400 });
      }

      // Fetch dynamic price from camp_validity_pricing by camp name
      const campName = config.camp ?? config.sessionName;
      const validityLabel = `${validityDaysNum}-Days`;
      let priceCharged = validityDaysNum === 30 ? 32 : validityDaysNum === 15 ? 16 : validityDaysNum === 10 ? 20 : validityDaysNum === 7 ? 15 : validityDaysNum * 2;

      try {
        const campPriceRes = await db.execute({
          sql: "SELECT price FROM camp_validity_pricing WHERE (camp_name = ? OR camp_name = ?) AND validity_name = ?",
          args: [campName, config.sessionName, validityLabel],
        });
        if (campPriceRes.rows.length > 0 && campPriceRes.rows[0].price !== null) {
          priceCharged = Number(campPriceRes.rows[0].price);
        }
      } catch {
        // Use default fallback price
      }

      // Check status in database
      const checkResult = await db.execute({
        sql: "SELECT status FROM vouchers WHERE voucher_code = ?",
        args: [selectedVoucherCode],
      });
      const row = checkResult.rows[0];
      
      let isFallbackVoucher = false;

      if (row && row.status === 'redeemed') {
        console.log(`Voucher ${selectedVoucherCode} is already redeemed in database. Allocating a fallback available voucher for ${validityDaysNum} days...`);
        // Allocate a new available code instead of failing with 400
        const tx = await db.transaction("write");
        try {
          await tx.execute(`
            UPDATE vouchers 
            SET status = 'available', reserved_until = NULL 
            WHERE status = 'reserved' 
              AND reserved_until < datetime('now')
          `);

          const selectResult = await tx.execute({
            sql: `
              SELECT voucher_code 
              FROM vouchers 
              WHERE validity_days = ? AND status = 'available' AND router_id = ?
              LIMIT 1
            `,
            args: [validityDaysNum, config.id]
          });
          const newRow = selectResult.rows[0];

          if (!newRow) {
            throw new Error(`No other available vouchers of this duration (${validityDaysNum} days) in database`);
          }

          finalVoucherCode = String(newRow.voucher_code);
          isFallbackVoucher = true;

          // Reserve it
          await tx.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'reserved', reserved_until = datetime('now', '+10 minutes'), activation_status = 'pending'
              WHERE voucher_code = ?
            `,
            args: [finalVoucherCode]
          });

          await tx.commit();
        } catch (txError) {
          await tx.rollback();
          return NextResponse.json(
            { error: `Voucher already redeemed. Fallback allocation failed: ${txError instanceof Error ? txError.message : "Unknown error"}` },
            { status: 400 }
          );
        }
      }

      if (!isFallbackVoucher) {
        if (row) {
          // Update database for the existing voucher
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, sales_person_id = ?, price_charged = ?, router_id = ?, activation_status = 'success', activation_error = NULL
              WHERE voucher_code = ?
            `,
            args: [mobileNumber, nowUtc, resolvedSoldBy, resolvedSalesPersonId, priceCharged, config.id, selectedVoucherCode],
          });
        } else {
          // Insert as new used voucher since it existed on router but not in local DB
          await db.execute({
            sql: `
              INSERT INTO vouchers (voucher_code, validity_days, status, used_by, used_at, router_id, sold_by, sales_person_id, price_charged, activation_status)
              VALUES (?, ?, 'redeemed', ?, ?, ?, ?, ?, ?, 'success')
            `,
            args: [selectedVoucherCode, validityDaysNum, mobileNumber, nowUtc, config.id, resolvedSoldBy, resolvedSalesPersonId, priceCharged],
          });
        }

        // Update the user comment on MikroTik
        const soldDateStr = getDubaiSoldDate();
        const comment = `Sold on ${soldDateStr}`;
        try {
          await withMikrotikClient(toConnectionParams(config), async (client) => {
            await client.write("/ip/hotspot/user/set", [
              `=.id=${voucherId}`,
              `=comment=${comment}`,
            ]);
          });
        } catch (mikrotikError) {
          const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router comment update failed";
          // Keep as redeemed but mark activation as failed
          try {
            await db.execute({
              sql: `
                UPDATE vouchers 
                SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, sales_person_id = ?, price_charged = ?, router_id = ?, activation_status = 'failed', activation_error = ?
                WHERE voucher_code = ?
              `,
              args: [mobileNumber, nowUtc, resolvedSoldBy, resolvedSalesPersonId, priceCharged, config.id, errMsg, selectedVoucherCode]
            });
          } catch (revertError) {
            console.error("Critical: Failed to log voucher activation failure", revertError);
          }

          return NextResponse.json(
            { error: `Router connection failed: ${errMsg}` },
            { status: 502 }
          );
        }
      } else {
        // Create the newly allocated fallback voucher user on the router
        const username = finalVoucherCode;
        const password = finalVoucherCode;
        const profile = `${validityDaysNum}-Days`;
        const soldDateStr = getDubaiSoldDate();
        const comment = `Sold on ${soldDateStr}`;

        try {
          await updateOrCreateHotspotUser(config, username, password, profile, comment);

          // Update fallback to redeemed in database on success
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, sales_person_id = ?, price_charged = ?, router_id = ?, activation_status = 'success', activation_error = NULL
              WHERE voucher_code = ?
            `,
            args: [mobileNumber, nowUtc, resolvedSoldBy, resolvedSalesPersonId, priceCharged, config.id, finalVoucherCode]
          });
        } catch (mikrotikError) {
          const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router connection failed";
          // Keep as redeemed but mark activation as failed
          try {
            await db.execute({
              sql: `
                UPDATE vouchers 
                SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, price_charged = ?, activation_status = 'failed', activation_error = ?
                WHERE voucher_code = ?
              `,
              args: [mobileNumber, nowUtc, salesperson || null, priceCharged, errMsg, finalVoucherCode]
            });
          } catch (revertError) {
            console.error("Critical: Failed to log voucher activation failure", revertError);
          }

          return NextResponse.json(
            { error: `Router connection failed: ${errMsg}` },
            { status: 502 }
          );
        }
      }
    } else if (voucherCode) {
      // Flow for redeeming by manual voucher code (username typed by user)
      const code = String(voucherCode).trim();
      if (!code) {
        return NextResponse.json({ error: "Voucher code cannot be empty" }, { status: 400 });
      }

      // Check if it exists in local database
      const checkResult = await db.execute({
        sql: "SELECT status, validity_days FROM vouchers WHERE voucher_code = ?",
        args: [code],
      });
      const row = checkResult.rows[0];

      let isNewVoucher = false;

      if (row) {
        if (row.status === 'redeemed') {
          return NextResponse.json({ error: "Voucher already redeemed" }, { status: 400 });
        }
        validityDaysNum = Number(row.validity_days);
      } else {
        // If not in database, check if it exists on MikroTik router as a user
        const { toConnectionParams } = await import("@/lib/mikrotik/config");
        const { withMikrotikClient } = await import("@/lib/mikrotik/client");
        
        let routerUserRecord: { name: string; profile: string } | null = null;
        try {
          const records = await withMikrotikClient(toConnectionParams(config), async (client) => {
            return await client.write("/ip/hotspot/user/print", [`?name=${code}`]);
          }) as Record<string, string>[];
          
          if (records && records.length > 0) {
            routerUserRecord = {
              name: records[0].name || "",
              profile: records[0].profile || "",
            };
          }
        } catch (err) {
          return NextResponse.json(
            { error: `Failed to verify voucher on router: ${err instanceof Error ? err.message : "Unknown error"}` },
            { status: 502 }
          );
        }

        if (!routerUserRecord || !routerUserRecord.name) {
          return NextResponse.json({ error: "Invalid voucher code" }, { status: 400 });
        }

        const profileName = routerUserRecord.profile;
        const match = profileName.match(/(\d+)\D*days?/i);
        if (match) {
          validityDaysNum = Number(match[1]);
        } else {
          const numeric = Number(profileName.replace(/[^0-9]/g, ""));
          validityDaysNum = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
        }

        if (validityDaysNum <= 0) {
          return NextResponse.json({ error: "Invalid voucher profile or duration" }, { status: 400 });
        }
        
        isNewVoucher = true;
      }

      selectedVoucherCode = code;
      finalVoucherCode = code;

      // Fetch dynamic price from camp_validity_pricing by camp name
      const campName = config.camp ?? config.sessionName;
      const validityLabel = `${validityDaysNum}-Days`;
      let priceCharged = validityDaysNum === 30 ? 32 : validityDaysNum === 15 ? 16 : validityDaysNum === 10 ? 20 : validityDaysNum === 7 ? 15 : validityDaysNum * 2;

      try {
        const campPriceRes = await db.execute({
          sql: "SELECT price FROM camp_validity_pricing WHERE (camp_name = ? OR camp_name = ?) AND validity_name = ?",
          args: [campName, config.sessionName, validityLabel],
        });
        if (campPriceRes.rows.length > 0 && campPriceRes.rows[0].price !== null) {
          priceCharged = Number(campPriceRes.rows[0].price);
        }
      } catch {
        // Use default fallback price
      }

      // Mark as used in database
      if (!isNewVoucher) {
        await db.execute({
          sql: `
            UPDATE vouchers 
            SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, price_charged = ?, router_id = ?, activation_status = 'success', activation_error = NULL
            WHERE voucher_code = ?
          `,
          args: [mobileNumber, nowUtc, salesperson || null, priceCharged, config.id, code],
        });
      } else {
        await db.execute({
          sql: `
            INSERT INTO vouchers (voucher_code, validity_days, status, used_by, used_at, router_id, sold_by, price_charged, activation_status)
            VALUES (?, ?, 'redeemed', ?, ?, ?, ?, ?, 'success')
          `,
          args: [code, validityDaysNum, mobileNumber, nowUtc, config.id, salesperson || null, priceCharged],
        });
      }

      // Update/Create on RouterOS
      const profile = `${validityDaysNum}-Days`;
      const soldDateStr = getDubaiSoldDate();
      const comment = `Sold on ${soldDateStr}`;
      
      try {
        await updateOrCreateHotspotUser(config, code, code, profile, comment);
      } catch (mikrotikError) {
        const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router connection failed";
        // Keep as redeemed but mark activation as failed
        try {
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'redeemed', used_by = ?, used_at = ?, sold_by = ?, price_charged = ?, activation_status = 'failed', activation_error = ?
              WHERE voucher_code = ?
            `,
            args: [mobileNumber, nowUtc, salesperson || null, priceCharged, errMsg, code]
          });
        } catch (revertError) {
          console.error("Critical: Failed to log voucher activation failure", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${errMsg}` },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json({ error: "Either validity_days, voucherId, or voucherCode is required" }, { status: 400 });
    }

    // Return success response
    return NextResponse.json({
      success: true,
      code: finalVoucherCode,
      validity: validityDaysNum,
      message: "Recharge completed successfully",
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
