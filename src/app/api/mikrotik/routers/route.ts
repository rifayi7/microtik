import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { fetchAllRouters } from "@/lib/mikrotik/queries";
import { isMikrotikConfigured } from "@/lib/mikrotik/config";

export const runtime = "nodejs";

export async function GET() {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const routers = await fetchAllRouters();
    return NextResponse.json({ routers, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load routers");
  }
}
