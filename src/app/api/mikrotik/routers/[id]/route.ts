import { NextResponse } from "next/server";
import {
  ensureMikrotikConfigured,
  mikrotikErrorResponse,
} from "@/lib/mikrotik/api-utils";
import {
  getRouterConfigById,
  isMikrotikConfigured,
  toRouterModel,
} from "@/lib/mikrotik/config";
import { fetchRouterWithStatus } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const { id } = await params;
    const config = getRouterConfigById(id);

    if (!config) {
      return NextResponse.json({ error: "Router not found" }, { status: 404 });
    }

    const router = await fetchRouterWithStatus(config);
    return NextResponse.json({
      router: {
        ...router,
        password: config.password,
      },
      configured: true,
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load router");
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  if (!isMikrotikConfigured()) {
    return ensureMikrotikConfigured();
  }

  try {
    const { id } = await params;
    const config = getRouterConfigById(id);

    if (!config) {
      return NextResponse.json({ error: "Router not found" }, { status: 404 });
    }

    const body = await request.json();

    const router = toRouterModel(
      {
        ...config,
        sessionName: body.sessionName ?? config.sessionName,
        hotspotName: body.hotspotName ?? config.hotspotName,
        dnsName: body.dnsName ?? config.dnsName,
        currency: body.currency ?? config.currency,
        sessionTimeout: body.sessionTimeout ?? config.sessionTimeout,
        phone: body.phone ?? config.phone,
        liveReport:
          body.liveReport === undefined ? config.liveReport : Boolean(body.liveReport),
        host: body.ipAddress ?? config.host,
        username: body.username ?? config.username,
        password: body.password ?? config.password,
      },
      { status: "unknown" }
    );

    return NextResponse.json({
      router,
      configured: true,
      message:
        "UI settings updated locally. Persist router credentials in .env.local or a database.",
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to update router");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
