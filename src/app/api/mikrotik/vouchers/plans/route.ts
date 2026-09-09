import { NextResponse } from "next/server";
import { getDB, seedVouchersForRouter } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";
import { requireAuth } from "@/lib/auth-crypto";

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

    // Permission enforcement for salesperson
    if (authResult.user?.role === "salesperson" && authResult.user.userId) {
      const spRes = await db.execute({
        sql: "SELECT allowed_camps FROM sales_persons WHERE id = ? LIMIT 1",
        args: [authResult.user.userId],
      });
      if (spRes.rows.length > 0 && spRes.rows[0].allowed_camps) {
        try {
          const allowed: string[] = JSON.parse(String(spRes.rows[0].allowed_camps));
          if (Array.isArray(allowed) && allowed.length > 0) {
            const allowedLower = allowed.map((c) => c.toLowerCase());
            const reqRouterId = (config.id || "").toLowerCase();
            const reqSession = (config.sessionName || "").toLowerCase();
            const reqCamp = (config.camp || "").toLowerCase();

            const isAllowed =
              allowedLower.includes(reqRouterId) ||
              (reqSession && allowedLower.includes(reqSession)) ||
              (reqCamp && allowedLower.includes(reqCamp));

            if (!isAllowed) {
              return NextResponse.json(
                { error: "Access Denied: You do not have permission to view plans for this camp." },
                { status: 403 }
              );
            }
          }
        } catch {}
      }
    }

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
