import { NextResponse } from "next/server";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";
import { fetchUserProfilesForRouter } from "@/lib/mikrotik/queries";
import { requireAuth } from "@/lib/auth-crypto";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const authResult = await requireAuth(request, db);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      await resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const campName = config.camp ?? config.sessionName;
    const [hardwareProfiles, pricingRes] = await Promise.all([
      fetchUserProfilesForRouter(config).catch(() => []),
      db.execute({
        sql: `
          SELECT validity, price, unit 
          FROM camp_validity_pricing 
          WHERE (router_id = ? OR router_id = ? OR router_id = ?) AND status = 1
          ORDER BY validity ASC
        `,
        args: [config.id, config.sessionName, campName],
      }).catch(() => ({ rows: [] }))
    ]);

    const campPlans = pricingRes.rows.map((r) => ({
      validity: Number(r.validity),
      name: `${r.validity}-Days`,
      price: Number(r.price),
      unit: Number(r.unit ?? (Number(r.validity) === 15 ? 0.5 : 1.0)),
    }));

    return NextResponse.json({ 
      profiles: hardwareProfiles, 
      campPlans, 
      configured: true 
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load user profiles");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
