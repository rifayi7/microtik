import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getConfiguredRouters, isMikrotikConfigured } from "@/lib/mikrotik/config";

export const runtime = "nodejs";

export async function GET() {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const configs = getConfiguredRouters();
    const routers = configs.map((config) => ({
      id: config.id,
      sessionName: config.sessionName,
      host: config.host,
      ipAddress: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      useTls: config.useTls,
      hotspotName: config.hotspotName ?? config.sessionName,
      dnsName: config.dnsName ?? "",
      currency: config.currency ?? "AED",
      sessionTimeout: config.sessionTimeout ?? "30 minutes",
      liveReport: config.liveReport ?? true,
      phone: config.phone ?? "",
      camp: config.camp,
      status: "unknown",
    }));

    return NextResponse.json({ routers, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load routers");
  }
}
