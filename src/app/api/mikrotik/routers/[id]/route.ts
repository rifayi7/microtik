import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import {
  getRouterConfigById,
  isMikrotikConfigured,
  toRouterModel,
} from "@/lib/mikrotik/config";
import { fetchRouterWithStatus } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const database = await getDB();
    
    // 1. Try to find in the database
    const dbResult = await database.execute({
      sql: "SELECT * FROM routers WHERE id = ?",
      args: [id],
    });

    let config = null;

    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      config = {
        id: String(row.id),
        sessionName: String(row.sessionName),
        host: String(row.host),
        port: Number(row.port),
        username: String(row.username),
        password: String(row.password ?? ""),
        useTls: Boolean(row.useTls),
        hotspotName: String(row.hotspotName ?? row.sessionName),
        dnsName: String(row.dnsName ?? ""),
        currency: String(row.currency ?? "AED"),
        sessionTimeout: String(row.sessionTimeout ?? "30 minutes"),
        liveReport: Boolean(row.liveReport ?? true),
        phone: String(row.phone ?? ""),
        camp: row.camp ? String(row.camp) : undefined,
      };
    } else if (isMikrotikConfigured()) {
      // 2. Fallback to env config
      config = getRouterConfigById(id);
    }

    if (!config) {
      return NextResponse.json({ error: "Router not found" }, { status: 404 });
    }

    const router = await fetchRouterWithStatus(config);
    return NextResponse.json({
      router: {
        ...router,
        password: config.password,
      },
      configured: true,
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load router");
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const database = await getDB();
    const body = await request.json();

    // 1. Check if router is in database
    const dbResult = await database.execute({
      sql: "SELECT * FROM routers WHERE id = ?",
      args: [id],
    });

    if (dbResult.rows.length > 0) {
      const existing = dbResult.rows[0];
      
      const sessionName = body.sessionName ?? String(existing.sessionName);
      const host = body.ipAddress ?? body.host ?? String(existing.host);
      const port = Number(body.port ?? existing.port);
      const username = body.username ?? String(existing.username);
      const password = body.password ?? String(existing.password ?? "");
      const useTls = body.useTls !== undefined ? (body.useTls ? 1 : 0) : Number(existing.useTls);
      const hotspotName = body.hotspotName ?? String(existing.hotspotName ?? existing.sessionName);
      const dnsName = body.dnsName ?? String(existing.dnsName ?? "");
      const currency = body.currency ?? String(existing.currency ?? "AED");
      const camp = body.camp ?? String(existing.camp ?? "");
      const sessionTimeout = body.sessionTimeout ?? String(existing.sessionTimeout ?? "30 minutes");
      const phone = body.phone ?? String(existing.phone ?? "");
      const liveReport = body.liveReport !== undefined ? (body.liveReport ? 1 : 0) : Number(existing.liveReport);

      await database.execute({
        sql: `
          UPDATE routers SET
            sessionName = ?, host = ?, port = ?, username = ?, password = ?, useTls = ?,
            hotspotName = ?, dnsName = ?, currency = ?, camp = ?, sessionTimeout = ?, phone = ?, liveReport = ?
          WHERE id = ?
        `,
        args: [
          sessionName, host, port, username, password, useTls,
          hotspotName, dnsName, currency, camp, sessionTimeout, phone, liveReport,
          id
        ]
      });

      const updated = {
        id,
        sessionName,
        host,
        ipAddress: host,
        port,
        username,
        password,
        useTls: Boolean(useTls),
        hotspotName,
        dnsName,
        currency,
        camp,
        sessionTimeout,
        phone,
        liveReport: Boolean(liveReport),
        status: "unknown"
      };

      return NextResponse.json({ router: updated, success: true, message: "Router updated successfully." });
    }

    // 2. Check if env config router is being modified
    if (isMikrotikConfigured() && getRouterConfigById(id)) {
      return NextResponse.json(
        { error: "Environment configuration routers are read-only. Please create a new router in settings." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Router not found" }, { status: 404 });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to update router");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const database = await getDB();
    
    // Check if router exists in db first
    const dbResult = await database.execute({
      sql: "SELECT * FROM routers WHERE id = ?",
      args: [id],
    });

    if (dbResult.rows.length === 0) {
      return NextResponse.json({ error: "Router not found or cannot be deleted (e.g. read-only env config)." }, { status: 404 });
    }

    await database.execute({
      sql: "DELETE FROM routers WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true, message: "Router deleted successfully." });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to delete router");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
