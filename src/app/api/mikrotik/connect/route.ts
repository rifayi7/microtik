import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getRouterConfigById, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { testRouterConnection } from "@/lib/mikrotik/queries";
import { getDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const database = await getDB();
    const authResult = await requireAuth(request, database);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const router = body.router || {};
    const routerId = (body.routerId ?? router.id) as string | undefined;

    // Check host/username from body or nested router object
    const host = body.host ?? router.host;
    const username = body.username ?? router.username;

    let config = routerId ? getRouterConfigById(routerId) : undefined;

    // 1. Build config from request body or nested router object if provided
    if (!config && host && username) {
      config = {
        id: routerId ?? router.id ?? "custom",
        sessionName: body.sessionName ?? router.sessionName ?? host,
        host: String(host),
        port: Number(body.port ?? router.port ?? 8728),
        username: String(username),
        password: String(body.password ?? router.password ?? ""),
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

    // 2. Fall back to DB-stored config if routerId was provided
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

    // 3. If still no router config and environment has no default router configured:
    if (!config && !isMikrotikConfigured()) {
      return ensureMikrotikConfigured();
    }

    if (!config) {
      return NextResponse.json(
        { error: "Router configuration not found" },
        { status: 404 }
      );
    }

    const result = await testRouterConnection(config);

    if (result.success && config.id) {
      // Run lightweight status update in the background so the HTTP response is instant
      void (async () => {
        try {
          const database = await getDB();

          // 1. Update router online/verified status
          await database.execute({
            sql: `
              UPDATE routers SET
                verified_status = 1,
                is_active       = 1,
                host            = ?,
                port            = ?,
                username        = ?,
                password        = ?,
                useTls          = ?,
                serialNumber    = COALESCE(NULLIF(?, ''), serialNumber)
              WHERE id = ?
            `,
            args: [
              config!.host,
              config!.port,
              config!.username,
              config!.password,
              config!.useTls ? 1 : 0,
              result.serialNumber ?? "",
              config!.id,
            ],
          });
        } catch (dbErr) {
          console.warn("[connect] Background status update failed:", dbErr);
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
