import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { addHotspotUser } from "@/lib/mikrotik/queries";
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

    // Save to SQL database as well
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

      await database.execute({
        sql: `
          INSERT OR REPLACE INTO vouchers (
            voucher_code, validity_days, status, router_id, used_by, used_at, sold_by, price_charged
          ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
        `,
        args: [
          String(username).trim(),
          validityDaysNum,
          "available",
          config.id,
        ],
      });
    } catch (dbErr) {
      console.error("Failed to save manually added user to database:", dbErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to add hotspot user");
  }
}
