import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { addHotspotUser } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      await resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const { username, password, profile, limitUptime, comment } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    await addHotspotUser(config, {
      username: String(username).trim(),
      password: password ? String(password) : undefined,
      profile: profile ? String(profile) : undefined,
      limitUptime: limitUptime ? String(limitUptime) : undefined,
      comment: comment ? String(comment) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to add hotspot user");
  }
}
