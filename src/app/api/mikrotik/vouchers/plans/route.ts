import { NextResponse } from "next/server";
import { getDB, seedVouchersForRouter } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";

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

    const db = await getDB();
    const campName = config.camp ?? config.sessionName;

    // 1. Fetch all configured validity plans for this camp from camp_validity_pricing
    const pricingRes = await db.execute({
      sql: `
        SELECT validity_name, price 
        FROM camp_validity_pricing 
        WHERE (camp_name = ? OR camp_name = ?) AND status = 1
      `,
      args: [campName, config.sessionName],
    });

    // Extract day numbers from validity_name (e.g. '15-Days' -> 15, '30-Days' -> 30)
    const configuredPlans = pricingRes.rows.map((row) => {
      const vName = String(row.validity_name);
      const match = vName.match(/\d+/);
      return {
        days: match ? Number(match[0]) : 30,
        price: Number(row.price),
      };
    });

    // 2. Count actual available voucher stock in vouchers table
    const result = await db.execute({
      sql: `
        SELECT validity_days AS days, COUNT(*) AS available_count
        FROM vouchers
        WHERE status = 'available' AND router_id = ?
        GROUP BY validity_days
        ORDER BY validity_days ASC
      `,
      args: [config.id],
    });

    const stockMap = new Map<number, number>();
    result.rows.forEach((row) => {
      stockMap.set(Number(row.days), Number(row.available_count));
    });

    // 3. If camp has specific plans defined in pricing table, return only those configured plans
    let finalPlans: { days: number; available_count: number }[] = [];
    if (configuredPlans.length > 0) {
      finalPlans = configuredPlans.map((p) => ({
        days: p.days,
        available_count: stockMap.get(p.days) ?? 0,
      }));
    } else {
      // Otherwise return actual available groups from vouchers
      result.rows.forEach((row) => {
        finalPlans.push({
          days: Number(row.days),
          available_count: Number(row.available_count),
        });
      });
    }

    return NextResponse.json(finalPlans);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
