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
            SUM(CASE 
              WHEN date(used_at) = date('now') OR date(used_at) = date('now', 'localtime') THEN
                CASE 
                  WHEN validity_days = 30 THEN 1.0
                  WHEN validity_days = 15 THEN 0.5
                  WHEN validity_days = 7 THEN 0.25
                  ELSE CAST(validity_days AS REAL) / 30.0
                END
              ELSE 0 
            END) as todaySalesCount,
            SUM(CASE WHEN date(used_at) = date('now') OR date(used_at) = date('now', 'localtime') THEN COALESCE(price_charged, 0) ELSE 0 END) as todayRevenue,
            SUM(CASE WHEN strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now') OR strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) as monthlySalesCount,
            SUM(CASE WHEN strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now') OR strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now', 'localtime') THEN COALESCE(price_charged, 0) ELSE 0 END) as monthlyRevenue
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

    // 2. Get sales counts and revenue amounts per router/camp
    const salesResult = await database.execute(`
      SELECT 
        COALESCE(r.camp, r.sessionName, 'Camp') as campName,
        r.sessionName as hotspotName,
        r.id as routerId,
        SUM(CASE 
          WHEN date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime') THEN
            CASE 
              WHEN v.validity_days = 30 THEN 1.0
              WHEN v.validity_days = 15 THEN 0.5
              WHEN v.validity_days = 7 THEN 0.25
              ELSE CAST(v.validity_days AS REAL) / 30.0
            END
          ELSE 0 
        END) as todaySaleCount,
        SUM(CASE WHEN date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime') THEN COALESCE(v.price_charged, 0) ELSE 0 END) as todaySaleAmount,
        SUM(CASE WHEN strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now') OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) as monthlySaleCount,
        SUM(CASE WHEN strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now') OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now', 'localtime') THEN COALESCE(v.price_charged, 0) ELSE 0 END) as monthlySaleAmount,
        SUM(COALESCE(v.price_charged, 0)) as totalRevenue
      FROM routers r
      LEFT JOIN vouchers v ON v.router_id = r.id AND v.status = 'redeemed'
      GROUP BY r.id
    `);

    // 3. Get total payments per camp and overall payments
    const paymentsResult = await database.execute(`
      SELECT camp_name as campName, SUM(COALESCE(amount, 0)) as totalPaid
      FROM payments
      GROUP BY camp_name
    `);

    // Map payments for quick lookup (case-insensitive keys)
    const paymentsMap: Record<string, number> = {};
    let grandTotalPaid = 0;
    paymentsResult.rows.forEach((row) => {
      const name = String(row.campName || "").trim().toLowerCase();
      const amt = Number(row.totalPaid || 0);
      paymentsMap[name] = amt;
      grandTotalPaid += amt;
    });

    // 4. Merge camp data & calculate overall totals
    let grandTotalRevenue = 0;
    let grandTodaySalesCount = 0;
    let grandTodayRevenue = 0;

    const summary = salesResult.rows.map((row) => {
      const campName = String(row.campName || row.hotspotName || "Unnamed Camp");
      const key = campName.trim().toLowerCase();
      
      const todaySaleCount = Number(row.todaySaleCount || 0);
      const todaySaleAmount = Number(row.todaySaleAmount || 0);
      const monthlySaleCount = Number(row.monthlySaleCount || 0);
      const monthlySaleAmount = Number(row.monthlySaleAmount || 0);
      const totalRevenue = Number(row.totalRevenue || 0);
      
      grandTotalRevenue += totalRevenue;
      grandTodaySalesCount += todaySaleCount;
      grandTodayRevenue += todaySaleAmount;

      const totalPaid = paymentsMap[key] || 0;
      const outstanding = Math.max(0, totalRevenue - totalPaid);

      return {
        campName,
        todaySale: todaySaleAmount,
        monthlySale: monthlySaleAmount,
        todaySaleCount,
        monthlySaleCount,
        outstanding,
      };
    });

    const overallStats = {
      totalOutstanding: Math.max(0, grandTotalRevenue - grandTotalPaid),
      totalSalesRevenue: grandTotalRevenue,
      todayTotalSaleCount: grandTodaySalesCount,
      todayTotalSaleRevenue: grandTodayRevenue,
    };

    return NextResponse.json({
      success: true,
      userStats,
      overallStats,
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
