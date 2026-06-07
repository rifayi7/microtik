import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { fetchActiveSessionsForRouter } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const sessions = await fetchActiveSessionsForRouter(config);
    return NextResponse.json({ sessions, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load active sessions");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const config = parseRouterFromBody(body);
    const sessionId = String(body.sessionId ?? "");

    if (!config || !sessionId) {
      return NextResponse.json(
        { error: "router and sessionId are required" },
        { status: 400 }
      );
    }

    const { disconnectHotspotSession } = await import("@/lib/mikrotik/queries");
    await disconnectHotspotSession(config, sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to disconnect session");
  }
}
