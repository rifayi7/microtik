import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { isMikrotikConfigured } from "@/lib/mikrotik/config";
import { fetchUserProfiles } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get("routerId") ?? undefined;
    const profiles = await fetchUserProfiles(routerId);
    return NextResponse.json({ profiles, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load user profiles");
  }
}
