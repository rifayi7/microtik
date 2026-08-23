import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const salesperson = url.searchParams.get("salesperson");
    const database = await getDB();
    
    // 1. Get total revenue, today sales, and monthly sales for this specific salesperson
    let userStats = {
      totalRevenue: 0,
      todayRevenue: 0,
      monthlyRevenue: 0,
      todaySalesCount: 0,
      monthlySalesCount: 0,
      totalSalesCount: 0,
    };

    if (salesperson && salesperson.trim() !== "") {
      const userResult = await database.execute({
        sql: `
          SELECT 
            COUNT(*) as totalSalesCount,
            SUM(COALESCE(price_charged, 0)) as totalRevenue,
            SUM(CASE WHEN date(used_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as todaySalesCount,
            SUM(CASE WHEN date(used_at) = date('now', 'localtime') THEN COALESCE(price_charged, 0) ELSE 0 END) as todayRevenue,
            SUM(CASE WHEN strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) as monthlySalesCount,
            SUM(CASE WHEN strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now', 'localtime') THEN COALESCE(price_charged, 0) ELSE 0 END) as monthlyRevenue
          FROM vouchers
          WHERE status = 'redeemed' AND sold_by = ?
        `,
        args: [salesperson.trim()]
      });

      if (userResult.rows.length > 0) {
        const row = userResult.rows[0];
        userStats = {
          totalRevenue: Number(row.totalRevenue || 0),
          todayRevenue: Number(row.todayRevenue || 0),
          monthlyRevenue: Number(row.monthlyRevenue || 0),
          todaySalesCount: Number(row.todaySalesCount || 0),
          monthlySalesCount: Number(row.monthlySalesCount || 0),
          totalSalesCount: Number(row.totalSalesCount || 0),
        };
      }
    }

    // 2. Get sales counts and total revenue per verified router/camp
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
      WHERE r.verified_status = 1 OR r.verified_status IS NULL
      GROUP BY r.id
    `);

    // 3. Get total payments per camp
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

    // 4. Merge camp data
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
      userStats,
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
