import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getRouterConfigById, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { testRouterConnection, syncRouterUsersToDb } from "@/lib/mikrotik/queries";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const router = body.router || {};
    const routerId = (body.routerId ?? router.id) as string | undefined;

    const host = body.host ?? router.host;
    const username = body.username ?? router.username;

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
          liveReport:
            body.liveReport !== undefined
              ? Boolean(body.liveReport)
              : router.liveReport !== undefined
              ? Boolean(router.liveReport)
              : undefined,
        };
      }
    }

    // Also try DB if routerId was provided but not found in env
    if (!config && routerId) {
      try {
        const database = await getDB();
        const row = await database.execute({
          sql: "SELECT * FROM routers WHERE id = ?",
          args: [routerId],
        });
        if (row.rows.length > 0) {
          const r = row.rows[0];
          config = {
            id: String(r.id),
            sessionName: String(r.sessionName),
            host: String(r.host),
            port: Number(r.port),
            username: String(r.username),
            password: String(r.password ?? ""),
            useTls: Boolean(r.useTls),
            hotspotName: r.hotspotName ? String(r.hotspotName) : undefined,
            dnsName: r.dnsName ? String(r.dnsName) : undefined,
            currency: r.currency ? String(r.currency) : undefined,
            camp: r.camp ? String(r.camp) : undefined,
            sessionTimeout: r.sessionTimeout ? String(r.sessionTimeout) : undefined,
            phone: r.phone ? String(r.phone) : undefined,
            liveReport: r.liveReport !== undefined ? Boolean(r.liveReport) : true,
          };
        }
      } catch {
        // DB not reachable — continue
      }
    }

    if (!config) {
      return NextResponse.json(
        { error: "Router configuration not found" },
        { status: 404 }
      );
    }

    const result = await testRouterConnection(config);

    if (result.success && config.id) {
      // ── Run all DB housekeeping in the background (non-blocking) ──
      void (async () => {
        try {
          const database = await getDB();
          const campName = config!.camp ?? config!.sessionName;

          // 1. Upsert router record
          await database.execute({
            sql: `
              INSERT INTO routers (
                id, sessionName, host, port, username, password, useTls,
                hotspotName, dnsName, currency, camp, sessionTimeout, phone, liveReport, serialNumber
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                sessionName   = excluded.sessionName,
                host          = excluded.host,
                port          = excluded.port,
                username      = excluded.username,
                password      = excluded.password,
                useTls        = excluded.useTls,
                hotspotName   = excluded.hotspotName,
                dnsName       = excluded.dnsName,
                currency      = excluded.currency,
                camp          = excluded.camp,
                sessionTimeout= excluded.sessionTimeout,
                phone         = excluded.phone,
                liveReport    = excluded.liveReport,
                serialNumber  = excluded.serialNumber
            `,
            args: [
              config!.id,
              config!.sessionName,
              config!.host,
              config!.port,
              config!.username,
              config!.password,
              config!.useTls ? 1 : 0,
              config!.hotspotName ?? config!.sessionName,
              config!.dnsName ?? "",
              config!.currency ?? "AED",
              campName,
              config!.sessionTimeout ?? "30 minutes",
              config!.phone ?? "",
              config!.liveReport !== false ? 1 : 0,
              result.serialNumber ?? "",
            ],
          });

          // 2. Ensure camp & pricing rows exist
          await database.execute({
            sql: "INSERT OR IGNORE INTO camps (name, hotspot_name) VALUES (?, ?)",
            args: [campName, config!.sessionName],
          });
          await database.batch(
            [
              {
                sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, price, status) VALUES (?, ?, ?, ?)",
                args: [campName, "15-Days", 16, 1],
              },
              {
                sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, price, status) VALUES (?, ?, ?, ?)",
                args: [campName, "30-Days", 32, 1],
              },
            ],
            "write"
          );

          // 3. Always sync live RouterOS users → DB (upsert + remove orphans)
          const { synced, removed } = await syncRouterUsersToDb(config!);
          console.log(
            `[connect] DB sync complete for "${config!.sessionName}": ${synced} upserted, ${removed} removed.`
          );
        } catch (dbErr) {
          console.warn("[connect] Background DB sync failed:", dbErr);
        }
      })();
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

