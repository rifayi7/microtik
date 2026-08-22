import { NextResponse } from "next/server";
import { fetchHotspotUsersForRouter } from "@/lib/mikrotik/queries";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      (await resolveRouterFromRequestSync(
        body,
        (body as Record<string, unknown>).routerId as string | undefined
      ));

    if (!config) {
      return NextResponse.json(
        { error: "Router credentials required" },
        { status: 400 }
      );
    }

    const users = await fetchHotspotUsersForRouter(config);
    return NextResponse.json({ users, configured: true });
  } catch (error) {
    console.error("Hotspot users live API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load users from router",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
