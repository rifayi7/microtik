import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";
import { updateOrCreateHotspotUser } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = await getDB();
  let selectedVoucherCode: string | null = null;
  let validityDaysNum = 0;
  let mobileNumber = "";

  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const { validity_days, voucherId, voucherCode, mobileNumber: rawMobile, salesperson } = body;
    mobileNumber = String(rawMobile || "").trim();

    if (!mobileNumber) {
      return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });
    }

    if (validity_days !== undefined && validity_days !== null) {
      validityDaysNum = Number(validity_days);
      if (isNaN(validityDaysNum) || validityDaysNum <= 0) {
        return NextResponse.json({ error: "Invalid validity period" }, { status: 400 });
      }

      // Step 1: Transaction to select and mark the voucher as reserved
      const tx = await db.transaction("write");
      try {
        const selectResult = await tx.execute({
          sql: `
            SELECT voucher_code 
            FROM vouchers 
            WHERE validity_days = ? AND status = 'available' AND router_id = ?
            LIMIT 1
          `,
          args: [validityDaysNum, config.id]
        });
        const row = selectResult.rows[0];

        if (!row) {
          throw new Error("No vouchers available");
        }

        selectedVoucherCode = String(row.voucher_code);

        await tx.execute({
          sql: `
            UPDATE vouchers 
            SET status = 'reserved', reserved_until = datetime('now', '+10 minutes'), activation_status = 'pending'
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

      // Fetch dynamic price from database or fallback to defaults
      const priceResult = await db.execute({
        sql: "SELECT price FROM sales_pricing WHERE validity_days = ?",
        args: [validityDaysNum]
      });
      const priceCharged = priceResult.rows[0] 
        ? Number(priceResult.rows[0].price) 
        : (validityDaysNum === 30 ? 50 : validityDaysNum === 15 ? 30 : validityDaysNum === 10 ? 20 : validityDaysNum === 7 ? 15 : validityDaysNum * 2);

      // Step 2: Connect to MikroTik and create the hotspot user
      const username = selectedVoucherCode;
      const password = selectedVoucherCode;
      const profile = `${validityDaysNum}-Days`;
      const comment = `Mobile: ${mobileNumber}${salesperson ? ` | Sold by: ${salesperson}` : ""}`;

      try {
        await updateOrCreateHotspotUser(config, username, password, profile, comment);

        // Update to redeemed on success
        await db.execute({
          sql: `
            UPDATE vouchers 
            SET status = 'redeemed', used_by = ?, used_at = datetime('now'), sold_by = ?, price_charged = ?, activation_status = 'success', activation_error = NULL
            WHERE voucher_code = ?
          `,
          args: [mobileNumber, salesperson || null, priceCharged, selectedVoucherCode]
        });
      } catch (mikrotikError) {
        const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router connection failed";
        // Revert the voucher status in database if MikroTik creation fails
        try {
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'available', reserved_until = NULL, activation_status = 'failed', activation_error = ?
              WHERE voucher_code = ?
            `,
            args: [errMsg, selectedVoucherCode]
          });
        } catch (revertError) {
          console.error("Critical: Failed to revert voucher allocation", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${errMsg}` },
          { status: 502 }
        );
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

      // Fetch dynamic price from database or fallback to defaults
      const priceResult = await db.execute({
        sql: "SELECT price FROM sales_pricing WHERE validity_days = ?",
        args: [validityDaysNum]
      });
      const priceCharged = priceResult.rows[0] 
        ? Number(priceResult.rows[0].price) 
        : (validityDaysNum === 30 ? 50 : validityDaysNum === 15 ? 30 : validityDaysNum === 10 ? 20 : validityDaysNum === 7 ? 15 : validityDaysNum * 2);

      // Check status in database
      const checkResult = await db.execute({
        sql: "SELECT status FROM vouchers WHERE voucher_code = ?",
        args: [selectedVoucherCode],
      });
      const row = checkResult.rows[0];
      
      if (row) {
        if (row.status === 'redeemed') {
          return NextResponse.json({ error: "Voucher already redeemed" }, { status: 400 });
        }
        
        // Update database
        await db.execute({
          sql: `
            UPDATE vouchers 
            SET status = 'redeemed', used_by = ?, used_at = datetime('now'), sold_by = ?, price_charged = ?, router_id = ?, activation_status = 'success', activation_error = NULL
            WHERE voucher_code = ?
          `,
          args: [mobileNumber, salesperson || null, priceCharged, config.id, selectedVoucherCode],
        });
      } else {
        // Insert as new used voucher since it existed on router but not in local DB
        await db.execute({
          sql: `
            INSERT INTO vouchers (voucher_code, validity_days, status, used_by, used_at, router_id, sold_by, price_charged, activation_status)
            VALUES (?, ?, 'redeemed', ?, datetime('now'), ?, ?, ?, 'success')
          `,
          args: [selectedVoucherCode, validityDaysNum, mobileNumber, config.id, salesperson || null, priceCharged],
        });
      }

      // Update the user comment on MikroTik
      const comment = `Mobile: ${mobileNumber}${salesperson ? ` | Sold by: ${salesperson}` : ""}`;
      try {
        await withMikrotikClient(toConnectionParams(config), async (client) => {
          await client.write("/ip/hotspot/user/set", [
            `=.id=${voucherId}`,
            `=comment=${comment}`,
          ]);
        });
      } catch (mikrotikError) {
        const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router comment update failed";
        // Revert database status if MikroTik update fails
        try {
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'available', reserved_until = NULL, activation_status = 'failed', activation_error = ?
              WHERE voucher_code = ?
            `,
            args: [errMsg, selectedVoucherCode]
          });
        } catch (revertError) {
          console.error("Critical: Failed to revert voucher allocation", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${errMsg}` },
          { status: 502 }
        );
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

      // Fetch dynamic price from database or fallback to defaults
      const priceResult = await db.execute({
        sql: "SELECT price FROM sales_pricing WHERE validity_days = ?",
        args: [validityDaysNum]
      });
      const priceCharged = priceResult.rows[0] 
        ? Number(priceResult.rows[0].price) 
        : (validityDaysNum === 30 ? 50 : validityDaysNum === 15 ? 30 : validityDaysNum === 10 ? 20 : validityDaysNum === 7 ? 15 : validityDaysNum * 2);

      // Mark as used in database
      if (!isNewVoucher) {
        await db.execute({
          sql: `
            UPDATE vouchers 
            SET status = 'redeemed', used_by = ?, used_at = datetime('now'), sold_by = ?, price_charged = ?, router_id = ?, activation_status = 'success', activation_error = NULL
            WHERE voucher_code = ?
          `,
          args: [mobileNumber, salesperson || null, priceCharged, config.id, code],
        });
      } else {
        await db.execute({
          sql: `
            INSERT INTO vouchers (voucher_code, validity_days, status, used_by, used_at, router_id, sold_by, price_charged, activation_status)
            VALUES (?, ?, 'redeemed', ?, datetime('now'), ?, ?, ?, 'success')
          `,
          args: [code, validityDaysNum, mobileNumber, config.id, salesperson || null, priceCharged],
        });
      }

      // Update/Create on RouterOS
      const profile = `${validityDaysNum}-Days`;
      const comment = `Mobile: ${mobileNumber}${salesperson ? ` | Sold by: ${salesperson}` : ""}`;
      
      try {
        await updateOrCreateHotspotUser(config, code, code, profile, comment);
      } catch (mikrotikError) {
        const errMsg = mikrotikError instanceof Error ? mikrotikError.message : "Router connection failed";
        // Revert database status on failure
        try {
          await db.execute({
            sql: `
              UPDATE vouchers 
              SET status = 'available', reserved_until = NULL, activation_status = 'failed', activation_error = ?
              WHERE voucher_code = ?
            `,
            args: [errMsg, code]
          });
        } catch (revertError) {
          console.error("Critical: Failed to revert voucher allocation", revertError);
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
      code: selectedVoucherCode,
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
