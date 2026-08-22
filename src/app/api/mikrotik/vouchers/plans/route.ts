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
    
    // Dynamically seed vouchers for this router ID if none exist
    const checkResult = await db.execute({
      sql: "SELECT COUNT(*) as count FROM vouchers WHERE router_id = ?",
      args: [config.id],
    });
    const count = Number(checkResult.rows[0]?.count ?? 0);
    if (count === 0) {
      await seedVouchersForRouter(config.id);
    }

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
    
    const rows = result.rows.map(row => ({
      days: Number(row.days),
      available_count: Number(row.available_count)
    }));
    return NextResponse.json(rows);
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
