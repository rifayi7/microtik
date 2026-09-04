import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";
import { resetHotspotActiveSessionByUsername } from "@/lib/mikrotik/queries";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import type { MikrotikRouterConfig } from "@/lib/mikrotik/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawVoucher = body.voucherCode || body.username || body.code;
    const voucherCode = String(rawVoucher || "").trim();

    if (!voucherCode) {
      return NextResponse.json(
        { success: false, error: "Voucher code or username is required" },
        { status: 400 }
      );
    }

    const db = await getDB();
    let targetConfig: MikrotikRouterConfig | null =
      parseRouterFromBody(body) ??
      (await resolveRouterFromRequestSync(body, body.routerId as string | undefined));

    // If router was not explicitly provided in the request body, look up the voucher in DB to find its assigned router
    if (!targetConfig) {
      try {
        const voucherRes = await db.execute({
          sql: "SELECT router_id FROM vouchers WHERE LOWER(voucher_code) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1",
          args: [voucherCode, voucherCode],
        });

        if (voucherRes.rows.length > 0 && voucherRes.rows[0].router_id) {
          const matchedRouterId = String(voucherRes.rows[0].router_id);
          targetConfig = await resolveRouterFromRequestSync(body, matchedRouterId);
        }
      } catch (err) {
        console.warn("Could not lookup voucher in DB:", err);
      }
    }

    // If still no single router resolved, search across all active registered routers in database
    if (!targetConfig) {
      const routersRes = await db.execute("SELECT * FROM routers WHERE is_active = 1 OR is_active IS NULL");
      if (routersRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "No configured MikroTik routers found to execute reset" },
          { status: 404 }
        );
      }

      let totalDisconnected = 0;
      let totalMacCleared = 0;

      for (const row of routersRes.rows) {
        const routerConfig: MikrotikRouterConfig = {
          id: String(row.id),
          host: String(row.host),
          port: Number(row.port) || 8728,
          username: String(row.username || row.user),
          password: String(row.password || ""),
          sessionName: String(row.sessionName || row.name || "Router"),
          camp: row.camp ? String(row.camp) : undefined,
          useTls: Boolean(row.use_tls || row.useTls),
        };

        try {
          const res = await resetHotspotActiveSessionByUsername(routerConfig, voucherCode);
          if (res.disconnectedCount > 0) totalDisconnected += res.disconnectedCount;
          if (res.macCleared) totalMacCleared++;
        } catch (e) {
          // Continue searching other routers
        }
      }

      if (totalDisconnected > 0 || totalMacCleared > 0) {
        return NextResponse.json({
          success: true,
          disconnectedCount: totalDisconnected,
          macCleared: totalMacCleared > 0,
          message: `Active session terminated and bound MAC address cleared for voucher "${voucherCode}". The voucher is ready for new login.`,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: `No active session or bound MAC found for voucher "${voucherCode}" on any connected router.`,
        },
        { status: 404 }
      );
    }

    // Execute session termination on the resolved router
    const result = await resetHotspotActiveSessionByUsername(targetConfig, voucherCode);

    if (result.disconnectedCount > 0 || result.macCleared) {
      let actionDesc = "";
      if (result.disconnectedCount > 0 && result.macCleared) {
        actionDesc = "Active session terminated and bound MAC address cleared";
      } else if (result.disconnectedCount > 0) {
        actionDesc = "Active session terminated";
      } else {
        actionDesc = "Bound MAC address cleared";
      }

      return NextResponse.json({
        success: true,
        disconnectedCount: result.disconnectedCount,
        macCleared: result.macCleared,
        routerName: targetConfig.camp || targetConfig.sessionName,
        message: `${actionDesc} for voucher "${voucherCode}" on ${targetConfig.camp || targetConfig.sessionName}. The voucher remains valid for re-login.`,
      });
    }

    if (result.userExists) {
      return NextResponse.json(
        {
          success: false,
          error: `Voucher "${voucherCode}" is valid on ${targetConfig.camp || targetConfig.sessionName}, but has no active session or bound MAC address to clear.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: `Voucher "${voucherCode}" was not found on ${targetConfig.camp || targetConfig.sessionName}.`,
      },
      { status: 404 }
    );
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to reset voucher session");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
