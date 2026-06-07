import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { isMikrotikConfigured } from "@/lib/mikrotik/config";
import { fetchHotspotUsers } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get("routerId") ?? undefined;
    const users = await fetchHotspotUsers(routerId);
    return NextResponse.json({ users, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load hotspot users");
  }
}
