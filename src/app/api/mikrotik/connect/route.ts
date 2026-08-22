import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getRouterConfigById, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { testRouterConnection } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const router = body.router || {};
    const routerId = (body.routerId ?? router.id) as string | undefined;

    // Check if we have manual/custom connection info in the request body
    const host = body.host ?? router.host;
    const username = body.username ?? router.username;

    // If .env.local has no routers AND the request does not provide a manual config:
    if (!isMikrotikConfigured() && (!host || !username)) {
      return ensureMikrotikConfigured();
    }

    let config = routerId ? getRouterConfigById(routerId) : undefined;

    if (!config) {

      if (host && username) {
        config = {
          id: routerId ?? router.id ?? "custom",
          sessionName: body.sessionName ?? router.sessionName ?? host,
          host: host,
          port: Number(body.port ?? router.port ?? 8728),
          username: username,
          password: body.password ?? router.password ?? "",
          useTls: Boolean(body.useTls ?? router.useTls),
          hotspotName: body.hotspotName ?? router.hotspotName,
          dnsName: body.dnsName ?? router.dnsName,
          currency: body.currency ?? router.currency,
          camp: body.camp ?? router.camp,
          sessionTimeout: body.sessionTimeout ?? router.sessionTimeout,
          phone: body.phone ?? router.phone,
          liveReport: body.liveReport !== undefined ? Boolean(body.liveReport) : (router.liveReport !== undefined ? Boolean(router.liveReport) : undefined),
        };
      }
    }

    if (!config) {
      return NextResponse.json(
        { error: "Router configuration not found" },
        { status: 404 }
      );
    }

    const result = await testRouterConnection(config);

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
