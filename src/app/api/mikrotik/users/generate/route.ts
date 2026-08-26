import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { generateHotspotUsers } from "@/lib/mikrotik/queries";
import { getDB } from "@/lib/db";

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
      userMode:
        userMode === "username_and_password"
          ? "username_and_password"
          : userMode === "username_only"
          ? "username_only"
          : "username_equals_password",
      nameLength: len,
      prefix: prefix ? String(prefix) : "",
      characters: characters ? String(characters) : "5ab2c34d",
      profile: profile ? String(profile) : "default",
      comment: comment ? String(comment) : "",
    });

    // Save generated codes to database in batch
    try {
      const database = await getDB();
      const match = String(profile || "").match(/(\d+)\D*days?/i);
      let validityDaysNum = 0;
      if (match) {
        validityDaysNum = Number(match[1]);
      } else {
        const numeric = Number(String(profile || "").replace(/[^0-9]/g, ""));
        validityDaysNum = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
      }

      const statements = generatedCodes.map((code) => ({
        sql: `
          INSERT OR REPLACE INTO vouchers (
            voucher_code, validity_days, status, router_id, used_by, used_at, sold_by, price_charged
          ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
        `,
        args: [
          code,
          validityDaysNum,
          "available",
          config.id,
        ],
      }));

      if (statements.length > 0) {
        await database.batch(statements, "write");
      }
    } catch (dbErr) {
      console.error("Failed to save batch generated users to database:", dbErr);
    }

    return NextResponse.json({ success: true, count: generatedCodes.length, codes: generatedCodes });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to generate hotspot users");
  }
}
