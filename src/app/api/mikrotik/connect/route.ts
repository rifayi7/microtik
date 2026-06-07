import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import { getRouterConfigById, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { testRouterConnection } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const body = await request.json();
    const routerId = body.routerId as string | undefined;

    let config = routerId ? getRouterConfigById(routerId) : undefined;

    if (!config && body.host && body.username) {
      config = {
        id: routerId ?? "custom",
        sessionName: body.sessionName ?? body.host,
        host: body.host,
        port: Number(body.port ?? 8728),
        username: body.username,
        password: body.password ?? "",
        useTls: Boolean(body.useTls),
      };
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
