import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getRouterConfigById, isMikrotikConfigured } from "@/lib/mikrotik/config";
import {
  disconnectHotspotSession,
  fetchActiveSessions,
} from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function GET() {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const sessions = await fetchActiveSessions();
    return NextResponse.json({ sessions, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load active sessions");
  }
}

export async function DELETE(request: Request) {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const body = await request.json();
    const routerId = String(body.routerId ?? "");
    const sessionId = String(body.sessionId ?? "");

    if (!routerId || !sessionId) {
      return NextResponse.json(
        { error: "routerId and sessionId are required" },
        { status: 400 }
      );
    }

    if (!getRouterConfigById(routerId)) {
      return NextResponse.json({ error: "Router not found" }, { status: 404 });
    }

    await disconnectHotspotSession(routerId, sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to disconnect session");
  }
}
