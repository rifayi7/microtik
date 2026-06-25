import { NextResponse } from "next/server";
import { getDB, seedVouchersForRouter } from "@/lib/db";
import { parseRouterFromBody, resolveRouterFromRequestSync } from "@/lib/mikrotik/resolve-router";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      resolveRouterFromRequestSync(body, body.routerId as string | undefined);

    if (!config) {
      return NextResponse.json({ error: "Router credentials required" }, { status: 400 });
    }

    const db = getDB();
    
    // Dynamically seed vouchers for this router ID if none exist
    const checkStmt = db.prepare("SELECT COUNT(*) as count FROM vouchers WHERE router_id = ?");
    const countRow = checkStmt.get(config.id) as { count: number };
    if (countRow.count === 0) {
      seedVouchersForRouter(db, config.id);
    }

    const stmt = db.prepare(`
      SELECT validity_days AS days, COUNT(*) AS available_count
      FROM vouchers
      WHERE is_used = 0 AND router_id = ?
      GROUP BY validity_days
      ORDER BY validity_days ASC
    `);
    
    const rows = stmt.all(config.id) as { days: number; available_count: number }[];
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
