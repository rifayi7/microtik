import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { fetchHotspotHostsForRouter } from "@/lib/mikrotik/queries";
import { requireAuth } from "@/lib/auth-crypto";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const authResult = await requireAuth(request, db);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      await resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const hosts = await fetchHotspotHostsForRouter(config);
    return NextResponse.json({ hosts, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load hotspot hosts");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
