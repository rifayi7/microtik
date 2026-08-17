import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDB();

    // 1. Get total sold vouchers count
    const totalSoldResult = await db.execute("SELECT COUNT(*) as count FROM vouchers WHERE is_used = 1");
    const totalSoldRow = totalSoldResult.rows[0];
    const totalSold = totalSoldRow ? Number(totalSoldRow.count) : 0;

    // 2. Get sales count grouped by salesperson
    const salespersonResult = await db.execute(`
      SELECT sold_by as name, COUNT(*) as count 
      FROM vouchers 
      WHERE is_used = 1 AND sold_by IS NOT NULL 
      GROUP BY sold_by
      ORDER BY count DESC
    `);
    const salespersonRows = salespersonResult.rows.map(row => ({
      name: String(row.name),
      count: Number(row.count)
    }));

    // 3. Get detailed sales log
    const salesLogResult = await db.execute(`
      SELECT voucher_code as code, validity_days as validity, used_by as mobile, used_at as timestamp, sold_by as seller, router_id as routerId
      FROM vouchers
      WHERE is_used = 1
      ORDER BY used_at DESC
    `);
    const salesLogs = salesLogResult.rows.map(row => ({
      code: String(row.code),
      validity: Number(row.validity),
      mobile: String(row.mobile ?? ""),
      timestamp: String(row.timestamp ?? ""),
      seller: String(row.seller ?? ""),
      routerId: String(row.routerId ?? "")
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalSold,
        salesByUser: salespersonRows,
      },
      sales: salesLogs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sales report" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
