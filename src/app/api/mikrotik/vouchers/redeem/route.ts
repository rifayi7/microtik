import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";
import { updateOrCreateHotspotUser } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = getDB();
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

      // Step 1: Transaction to select and mark the voucher as used
      db.exec("BEGIN IMMEDIATE");
      try {
        const selectStmt = db.prepare(`
          SELECT voucher_code 
          FROM vouchers 
          WHERE validity_days = ? AND is_used = 0 AND router_id = ?
          LIMIT 1
        `);
        const row = selectStmt.get(validityDaysNum, config.id) as { voucher_code: string } | undefined;

        if (!row) {
          throw new Error("No vouchers available");
        }

        selectedVoucherCode = row.voucher_code;

        const updateStmt = db.prepare(`
          UPDATE vouchers 
          SET is_used = 1, used_by = ?, used_at = datetime('now'), status = 'used', sold_by = ?
          WHERE voucher_code = ?
        `);
        updateStmt.run(mobileNumber, salesperson || null, selectedVoucherCode);

        db.exec("COMMIT");
      } catch (txError) {
        db.exec("ROLLBACK");
        return NextResponse.json(
          { error: txError instanceof Error ? txError.message : "Failed to allocate voucher" },
          { status: 400 }
        );
      }

      // Step 2: Connect to MikroTik and create the hotspot user
      const username = selectedVoucherCode;
      const password = selectedVoucherCode;
      const profile = `${validityDaysNum}-Days`;
      const comment = `Mobile: ${mobileNumber}${salesperson ? ` | Sold by: ${salesperson}` : ""}`;

      try {
        await updateOrCreateHotspotUser(config, username, password, profile, comment);
      } catch (mikrotikError) {
        // Revert the voucher status in database if MikroTik creation fails
        try {
          db.exec("BEGIN IMMEDIATE");
          const revertStmt = db.prepare(`
            UPDATE vouchers 
            SET is_used = 0, used_by = NULL, used_at = NULL, status = 'available'
            WHERE voucher_code = ?
          `);
          revertStmt.run(selectedVoucherCode);
          db.exec("COMMIT");
        } catch (revertError) {
          db.exec("ROLLBACK");
          console.error("Critical: Failed to revert voucher allocation", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${mikrotikError instanceof Error ? mikrotikError.message : "Unknown error"}` },
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

      // Mark as used in database
      const checkStmt = db.prepare("SELECT is_used FROM vouchers WHERE voucher_code = ?");
      const row = checkStmt.get(selectedVoucherCode) as { is_used: number } | undefined;
      
      if (row) {
        if (row.is_used === 1) {
          return NextResponse.json({ error: "Voucher already redeemed" }, { status: 400 });
        }
        
        // Update database
        const updateStmt = db.prepare(`
          UPDATE vouchers 
          SET is_used = 1, used_by = ?, used_at = datetime('now'), status = 'used', router_id = ?, sold_by = ?
          WHERE voucher_code = ?
        `);
        updateStmt.run(mobileNumber, config.id, salesperson || null, selectedVoucherCode);
      } else {
        // Insert as new used voucher since it existed on router but not in local DB
        const insertStmt = db.prepare(`
          INSERT INTO vouchers (voucher_code, validity_days, is_used, used_by, used_at, status, router_id, sold_by)
          VALUES (?, ?, 1, ?, datetime('now'), 'used', ?, ?)
        `);
        insertStmt.run(selectedVoucherCode, validityDaysNum, mobileNumber, config.id, salesperson || null);
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
        // Revert database status if MikroTik update fails
        try {
          db.exec("BEGIN IMMEDIATE");
          const revertStmt = db.prepare(`
            UPDATE vouchers 
            SET is_used = 0, used_by = NULL, used_at = NULL, status = 'available'
            WHERE voucher_code = ?
          `);
          revertStmt.run(selectedVoucherCode);
          db.exec("COMMIT");
        } catch (revertError) {
          db.exec("ROLLBACK");
          console.error("Critical: Failed to revert voucher allocation", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${mikrotikError instanceof Error ? mikrotikError.message : "Unknown error"}` },
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
      const checkStmt = db.prepare("SELECT is_used, validity_days FROM vouchers WHERE voucher_code = ?");
      const row = checkStmt.get(code) as { is_used: number; validity_days: number } | undefined;

      let isNewVoucher = false;

      if (row) {
        if (row.is_used === 1) {
          return NextResponse.json({ error: "Voucher already redeemed" }, { status: 400 });
        }
        validityDaysNum = row.validity_days;
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

      // Mark as used in database
      if (!isNewVoucher) {
        const updateStmt = db.prepare(`
          UPDATE vouchers 
          SET is_used = 1, used_by = ?, used_at = datetime('now'), status = 'used', router_id = ?, sold_by = ?
          WHERE voucher_code = ?
        `);
        updateStmt.run(mobileNumber, config.id, salesperson || null, code);
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO vouchers (voucher_code, validity_days, is_used, used_by, used_at, status, router_id, sold_by)
          VALUES (?, ?, 1, ?, datetime('now'), 'used', ?, ?)
        `);
        insertStmt.run(code, validityDaysNum, mobileNumber, config.id, salesperson || null);
      }

      // Update/Create on RouterOS
      const profile = `${validityDaysNum}-Days`;
      const comment = `Mobile: ${mobileNumber}${salesperson ? ` | Sold by: ${salesperson}` : ""}`;
      
      try {
        await updateOrCreateHotspotUser(config, code, code, profile, comment);
      } catch (mikrotikError) {
        // Revert database status on failure
        try {
          db.exec("BEGIN IMMEDIATE");
          const revertStmt = db.prepare(`
            UPDATE vouchers 
            SET is_used = 0, used_by = NULL, used_at = NULL, status = 'available'
            WHERE voucher_code = ?
          `);
          revertStmt.run(code);
          db.exec("COMMIT");
        } catch (revertError) {
          db.exec("ROLLBACK");
          console.error("Critical: Failed to revert voucher allocation", revertError);
        }

        return NextResponse.json(
          { error: `Router connection failed: ${mikrotikError instanceof Error ? mikrotikError.message : "Unknown error"}` },
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
