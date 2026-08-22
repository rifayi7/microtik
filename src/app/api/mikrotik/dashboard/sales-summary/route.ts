import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await getDB();
    
    // 1. Get sales counts and total revenue per router/camp
    const salesResult = await database.execute(`
      SELECT 
        r.camp as campName,
        r.sessionName as hotspotName,
        r.id as routerId,
        SUM(CASE WHEN date(v.used_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as todaySale,
        SUM(CASE WHEN strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) as monthlySale,
        SUM(COALESCE(v.price_charged, 0)) as totalRevenue
      FROM routers r
      LEFT JOIN vouchers v ON v.router_id = r.id AND v.status = 'redeemed'
      GROUP BY r.id
    `);

    // 2. Get total payments per camp
    const paymentsResult = await database.execute(`
      SELECT camp_name as campName, SUM(COALESCE(amount, 0)) as totalPaid
      FROM payments
      GROUP BY camp_name
    `);

    // Map payments for quick lookup (case-insensitive keys)
    const paymentsMap: Record<string, number> = {};
    paymentsResult.rows.forEach((row) => {
      const name = String(row.campName || "").trim().toLowerCase();
      paymentsMap[name] = Number(row.totalPaid || 0);
    });

    // 3. Merge data
    const summary = salesResult.rows.map((row) => {
      const campName = String(row.campName || row.hotspotName || "Unnamed Camp");
      const key = campName.trim().toLowerCase();
      
      const todaySale = Number(row.todaySale || 0);
      const monthlySale = Number(row.monthlySale || 0);
      const totalRevenue = Number(row.totalRevenue || 0);
      
      const totalPaid = paymentsMap[key] || 0;
      const outstanding = Math.max(0, totalRevenue - totalPaid);

      return {
        campName,
        todaySale,
        monthlySale,
        outstanding,
      };
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Sales summary API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load sales summary" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
