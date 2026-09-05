import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { removeHotspotUsersFromRouter } from "@/lib/mikrotik/queries";

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

    const { ids, names } = body as {
      ids?: string[];
      names?: string[];
      id?: string;
      name?: string;
      username?: string;
    };

    const targets: string[] = [];
    if (ids && Array.isArray(ids)) targets.push(...ids);
    if (names && Array.isArray(names)) targets.push(...names);
    if (body.id && typeof body.id === "string") targets.push(body.id);
    if (body.name && typeof body.name === "string") targets.push(body.name);
    if (body.username && typeof body.username === "string") targets.push(body.username);

    const uniqueTargets = Array.from(new Set(targets.filter(Boolean)));

    if (uniqueTargets.length === 0) {
      return NextResponse.json(
        { error: "No user IDs or names specified for deletion" },
        { status: 400 }
      );
    }

    const result = await removeHotspotUsersFromRouter(config, uniqueTargets);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} user(s)`,
    });
  } catch (error) {
    console.error("Hotspot user delete error:", error);
    return mikrotikErrorResponse(error, "Failed to delete user(s)");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
