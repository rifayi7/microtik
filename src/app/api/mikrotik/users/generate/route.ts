import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { generateHotspotUsers } from "@/lib/mikrotik/queries";

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

    const { qty, server, userMode, nameLength, prefix, characters, profile, comment } = body;

    const count = Number(qty || 1);
    const len = Number(nameLength || 8);

    if (count <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
    }

    if (len <= 0) {
      return NextResponse.json({ error: "Name length must be greater than 0" }, { status: 400 });
    }

    const generatedCodes = await generateHotspotUsers(config, {
      qty: count,
      server: server ? String(server) : "all",
      userMode: userMode === "username_only" ? "username_only" : "username_equals_password",
      nameLength: len,
      prefix: prefix ? String(prefix) : "",
      characters: characters ? String(characters) : "abcd2345",
      profile: profile ? String(profile) : "default",
      comment: comment ? String(comment) : "",
    });

    return NextResponse.json({ success: true, count: generatedCodes.length, codes: generatedCodes });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to generate hotspot users");
  }
}
