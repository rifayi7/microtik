import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { isMikrotikConfigured } from "@/lib/mikrotik/config";
import { fetchDashboardStats } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function GET() {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const stats = await fetchDashboardStats();
    return NextResponse.json({ stats, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load dashboard stats");
  }
}
