import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { isMikrotikConfigured } from "@/lib/mikrotik/config";
import { fetchConnectedDashboard } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function GET() {
  if (!isMikrotikConfigured()) {
    return NextResponse.json(
      { error: "MikroTik is not configured", configured: false },
      { status: 503 }
    );
  }

  return NextResponse.json({
    error: "POST with router credentials required",
    configured: true,
  }, { status: 405 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      await resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json(
        { error: "Router credentials required in request body", configured: false },
        { status: 400 }
      );
    }

    const dashboard = await fetchConnectedDashboard(config);
    return NextResponse.json({ dashboard, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load dashboard");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
