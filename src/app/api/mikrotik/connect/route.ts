import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getRouterConfigById, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { testRouterConnection, fetchHotspotUsersForRouter } from "@/lib/mikrotik/queries";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const router = body.router || {};
    const routerId = (body.routerId ?? router.id) as string | undefined;

    // Check if we have manual/custom connection info in the request body
    const host = body.host ?? router.host;
    const username = body.username ?? router.username;

    // If .env.local has no routers AND the request does not provide a manual config:
    if (!isMikrotikConfigured() && (!host || !username)) {
      return ensureMikrotikConfigured();
    }

    let config = routerId ? getRouterConfigById(routerId) : undefined;

    if (!config) {

      if (host && username) {
        config = {
          id: routerId ?? router.id ?? "custom",
          sessionName: body.sessionName ?? router.sessionName ?? host,
          host: host,
          port: Number(body.port ?? router.port ?? 8728),
          username: username,
          password: body.password ?? router.password ?? "",
          useTls: Boolean(body.useTls ?? router.useTls),
          hotspotName: body.hotspotName ?? router.hotspotName,
          dnsName: body.dnsName ?? router.dnsName,
          currency: body.currency ?? router.currency,
          camp: body.camp ?? router.camp,
          sessionTimeout: body.sessionTimeout ?? router.sessionTimeout,
          phone: body.phone ?? router.phone,
          liveReport: body.liveReport !== undefined ? Boolean(body.liveReport) : (router.liveReport !== undefined ? Boolean(router.liveReport) : undefined),
        };
      }
    }

    if (!config) {
      return NextResponse.json(
        { error: "Router configuration not found" },
        { status: 404 }
      );
    }

    const result = await testRouterConnection(config);

    // If connection succeeds, run self-healing database check
    if (result.success && config.id) {
      try {
        const database = await getDB();
        const campName = config.camp ?? config.sessionName;

        // 0. Re-insert router connection credentials if missing
        await database.execute({
          sql: `
            INSERT OR IGNORE INTO routers (
              id, sessionName, host, port, username, password, useTls, 
              hotspotName, dnsName, currency, camp, sessionTimeout, phone, liveReport
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            config.id,
            config.sessionName,
            config.host,
            config.port,
            config.username,
            config.password,
            config.useTls ? 1 : 0,
            config.hotspotName ?? config.sessionName,
            config.dnsName ?? "",
            config.currency ?? "AED",
            campName,
            config.sessionTimeout ?? "30 minutes",
            config.phone ?? "",
            config.liveReport !== false ? 1 : 0,
          ],
        });

        // 1. Re-insert camp metadata if missing
        await database.execute({
          sql: "INSERT OR IGNORE INTO camps (name, hotspot_name) VALUES (?, ?)",
          args: [campName, config.sessionName],
        });

        // 2. Re-insert camp validity pricing if missing
        await database.batch([
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, price, status) VALUES (?, ?, ?, ?)",
            args: [campName, "15-Days", 16, 1],
          },
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, price, status) VALUES (?, ?, ?, ?)",
            args: [campName, "30-Days", 32, 1],
          },
        ], "write");

        // 3. Scan & sync vouchers from this router if count of active vouchers is 0
        const checkCount = await database.execute({
          sql: "SELECT COUNT(*) as count FROM vouchers WHERE router_id = ?",
          args: [config.id],
        });
        const currentCount = Number(checkCount.rows[0]?.count ?? 0);

        if (currentCount === 0) {
          const users = await fetchHotspotUsersForRouter(config);
          if (users && users.length > 0) {
            const statements = users.map((user) => {
              const profile = user.profile;
              const match = profile.match(/(\d+)\D*days?/i);
              let validityDaysNum = 0;
              if (match) {
                validityDaysNum = Number(match[1]);
              } else {
                const numeric = Number(profile.replace(/[^0-9]/g, ""));
                validityDaysNum = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
              }

              if (validityDaysNum <= 0) return null;

              const isRedeemed = user.comment && user.comment.includes("Mobile:");
              const status = isRedeemed ? "redeemed" : user.status === "disabled" ? "disabled" : "available";

              let mobile = "";
              let salesperson = "";
              if (isRedeemed) {
                const commentStr = user.comment || "";
                const mobileMatch = commentStr.match(/Mobile:\s*([+a-zA-Z0-9\s-]+)/i);
                if (mobileMatch) {
                  mobile = mobileMatch[1].trim();
                }
                const sellerMatch = commentStr.match(/Sold by:\s*([a-zA-Z0-9_-]+)/i);
                if (sellerMatch) {
                  salesperson = sellerMatch[1].trim();
                }
              }

              return {
                sql: `
                  INSERT OR REPLACE INTO vouchers (
                    voucher_code, validity_days, status, router_id, used_by, used_at, sold_by, price_charged
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                  user.username,
                  validityDaysNum,
                  status,
                  config.id,
                  status === "redeemed" ? mobile : null,
                  status === "redeemed" ? new Date().toISOString() : null,
                  status === "redeemed" ? salesperson : null,
                  status === "redeemed" ? (validityDaysNum === 30 ? 32 : 16) : null,
                ],
              };
            }).filter((stmt) => stmt !== null);

            if (statements.length > 0) {
              await database.batch(statements as any, "write");
              console.log(`Successfully self-healed and imported ${statements.length} vouchers from the physical router.`);
            }
          }
        }
      } catch (dbErr) {
        console.warn("Self-healing check failed:", dbErr);
      }
    }

    return NextResponse.json({
      ...result,
      routerId: config.id,
      sessionName: config.sessionName,
      host: config.host,
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Connection test failed");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
