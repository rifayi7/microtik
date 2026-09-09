import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const authUser = extractAuthToken(request);

    const salespersonParam = url.searchParams.get("salesperson");
    const salesPersonIdParam = url.searchParams.get("salesPersonId");
    let companyParam = url.searchParams.get("company");

    // Strictly enforce company if JWT token represents a company user
    if (authUser && authUser.role !== "superadmin" && authUser.companyName) {
      companyParam = authUser.companyName;
    }
    const database = await getDB();
    
    // Resolve user ID and company details if provided
    let targetUserId: number | null = salesPersonIdParam ? Number(salesPersonIdParam) : null;
    let targetUsername = salespersonParam && salespersonParam.trim() !== "" && salespersonParam.trim() !== "Unknown" ? salespersonParam.trim() : null;
    let targetTimezone = "Asia/Dubai";

    // Lookup user details from database to resolve company and company timezone
    if (targetUserId || targetUsername || authUser?.userId || authUser?.sub) {
      const lookupId = targetUserId || authUser?.userId || -1;
      const lookupName = targetUsername || authUser?.sub || "";
      const spRes = await database.execute({
        sql: `
          SELECT sp.id, sp.username, sp.display_name, sp.camp_name, sp.company_name, sp.allowed_camps,
                 COALESCE(c.timezone, 'Asia/Dubai') as company_timezone
          FROM sales_persons sp
          LEFT JOIN companies c ON (sp.company_id IS NOT NULL AND c.id = sp.company_id) OR (sp.company_name IS NOT NULL AND LOWER(c.name) = LOWER(sp.company_name))
          WHERE sp.id = ? OR sp.username = ? OR sp.display_name = ?
          LIMIT 1
        `,
        args: [lookupId, lookupName, lookupName],
      });
      if (spRes.rows.length > 0) {
        const row = spRes.rows[0];
        targetUserId = Number(row.id);
        if (!targetUsername) targetUsername = String(row.username);
        if (row.company_name && !companyParam) companyParam = String(row.company_name);
        if (row.company_timezone) targetTimezone = String(row.company_timezone);
      }
    }

    if (companyParam && companyParam.trim() && targetTimezone === "Asia/Dubai") {
      const compRes = await database.execute({
        sql: "SELECT timezone FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1",
        args: [companyParam.trim()],
      });
      if (compRes.rows.length > 0 && compRes.rows[0].timezone) {
        targetTimezone = String(compRes.rows[0].timezone);
      }
    }

    // Determine timezone SQL modifier for SQLite (e.g. Riyadh = +3 hours, Dubai/Muscat = +4 hours, Kolkata = +5.5 hours)
    let tzModifier = "+4 hours";
    if (targetTimezone === "Asia/Riyadh" || targetTimezone === "Asia/Qatar" || targetTimezone === "Asia/Kuwait" || targetTimezone === "Asia/Bahrain" || targetTimezone === "Asia/Amman") {
      tzModifier = "+3 hours";
    } else if (targetTimezone === "Africa/Cairo") {
      tzModifier = "+3 hours";
    } else if (targetTimezone === "Asia/Kolkata") {
      tzModifier = "+330 minutes";
    } else if (targetTimezone === "UTC") {
      tzModifier = "+0 hours";
    }

    const isFilteredBySalesperson = Boolean(targetUserId || targetUsername);

    // Get company router names if company filter is active
    let companyCampNames: string[] = [];
    if (companyParam && companyParam.trim()) {
      const campRes = await database.execute({
        sql: `
          SELECT r.sessionName as name
          FROM routers r
          LEFT JOIN companies c ON r.company_id = c.id
          WHERE LOWER(c.name) = LOWER(?) OR (r.camp IS NOT NULL AND LOWER(r.camp) = LOWER(?))
        `,
        args: [companyParam.trim(), companyParam.trim()],
      });
      companyCampNames = campRes.rows.map((r) => String(r.name).toLowerCase());
    }

    // 1. Get total revenue, today sales, and monthly sales for this specific salesperson
    let userStats = {
      totalRevenue: 0,
      todayRevenue: 0,
      monthlyRevenue: 0,
      todaySalesCount: 0,
      monthlySalesCount: 0,
      totalSalesCount: 0,
    };

    // We compute dates using the tenant's dynamic company timezone:
    const todayExpr = `date('now', '${tzModifier}')`;
    const monthExpr = `strftime('%Y-%m', 'now', '${tzModifier}')`;
    const usedAtDateExpr = `date(used_at, '${tzModifier}')`;
    const usedAtMonthExpr = `strftime('%Y-%m', used_at, '${tzModifier}')`;

    if (isFilteredBySalesperson) {
      const targetIdVal = targetUserId ? Number(targetUserId) : -1;
      const targetUserVal = targetUsername ? targetUsername.trim() : "UNKNOWN_USER";

      const userResult = await database.execute({
        sql: `
          SELECT 
            COUNT(*) as totalSalesCount,
            SUM(COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END)) as totalRevenue,
            SUM(CASE 
              WHEN (${usedAtDateExpr} = ${todayExpr} OR date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime')) THEN
                COALESCE(vp.unit_weight, CASE WHEN v.validity_days = 30 THEN 1.0 WHEN v.validity_days = 15 THEN 0.5 WHEN v.validity_days = 7 THEN 0.25 ELSE CAST(v.validity_days AS REAL) / 30.0 END)
              ELSE 0 
            END) as todaySalesCount,
            SUM(CASE 
              WHEN (${usedAtDateExpr} = ${todayExpr} OR date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime')) THEN 
                COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END)
              ELSE 0 
            END) as todayRevenue,
            SUM(CASE WHEN (${usedAtMonthExpr} = ${monthExpr} OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now')) THEN 1 ELSE 0 END) as monthlySalesCount,
            SUM(CASE 
              WHEN (${usedAtMonthExpr} = ${monthExpr} OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now')) THEN 
                COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END)
              ELSE 0 
            END) as monthlyRevenue
          FROM vouchers v
          LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR vp.name = CAST(v.validity_days AS TEXT))
          WHERE v.status = 'redeemed' AND (
            (v.sales_person_id IS NOT NULL AND v.sales_person_id = ?)
            OR (v.sold_by IS NOT NULL AND (v.sold_by = ? OR v.sold_by IN (SELECT username FROM sales_persons WHERE id = ? OR username = ?)))
          )
        `,
        args: [targetIdVal, targetUserVal, targetIdVal, targetUserVal],
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

    // Fetch latest live allowed camps and company for this user from database
    let userAllowedCamps: string[] = [];
    if (targetUserId || targetUsername || authUser?.userId || authUser?.sub) {
      const lookupId = targetUserId || authUser?.userId || -1;
      const lookupName = targetUsername || authUser?.sub || "";
      const spRes = await database.execute({
        sql: "SELECT camp_name, company_name, allowed_camps FROM sales_persons WHERE id = ? OR username = ? OR display_name = ?",
        args: [lookupId, lookupName, lookupName],
      });
      if (spRes.rows.length > 0) {
        const spRow = spRes.rows[0];
        if (spRow.company_name && !companyParam) {
          companyParam = String(spRow.company_name);
        }
        if (spRow.allowed_camps) {
          try {
            const parsed = JSON.parse(String(spRow.allowed_camps));
            if (Array.isArray(parsed)) userAllowedCamps = parsed.map((c) => String(c).toLowerCase());
          } catch {}
        } else if (spRow.camp_name && spRow.camp_name !== "All Camps") {
          userAllowedCamps = [String(spRow.camp_name).toLowerCase()];
        }
      }
    }

    if (userAllowedCamps.length === 0 && authUser?.allowedCamps && authUser.allowedCamps.length > 0) {
      userAllowedCamps = authUser.allowedCamps.map((c) => c.toLowerCase());
    }

    const targetIdVal = targetUserId ? Number(targetUserId) : -1;
    const targetUserVal = targetUsername ? targetUsername.trim() : "UNKNOWN_USER";

    // 2. Get sales counts and revenue amounts per router/camp
    let effectiveCampFilters = companyCampNames;
    if (userAllowedCamps.length > 0) {
      effectiveCampFilters = companyCampNames.length > 0
        ? companyCampNames.filter((c) => userAllowedCamps.includes(c))
        : userAllowedCamps;
    }

    let routerFilterClause = "";
    let routerFilterArgs: any[] = [];

    if (isFilteredBySalesperson) {
      const campCondition = effectiveCampFilters.length > 0
        ? `(LOWER(COALESCE(r.camp, r.sessionName, '')) IN (${effectiveCampFilters.map(() => '?').join(',')}) OR LOWER(r.id) IN (${effectiveCampFilters.map(() => '?').join(',')}))`
        : "1=0";
      
      // Allow currently assigned camps OR any router where the salesperson had redeemed vouchers
      routerFilterClause = `WHERE (${campCondition} OR r.id IN (
        SELECT router_id FROM vouchers 
        WHERE status = 'redeemed' AND (
          (sales_person_id IS NOT NULL AND sales_person_id = ?)
          OR (sold_by IS NOT NULL AND (sold_by = ? OR sold_by IN (SELECT username FROM sales_persons WHERE id = ? OR username = ?)))
        )
      ))`;
      routerFilterArgs = [
        ...effectiveCampFilters,
        ...effectiveCampFilters,
        targetIdVal,
        targetUserVal,
        targetIdVal,
        targetUserVal,
      ];
    } else {
      routerFilterClause = effectiveCampFilters.length > 0
        ? `WHERE (LOWER(COALESCE(r.camp, r.sessionName, '')) IN (${effectiveCampFilters.map(() => '?').join(',')}) OR LOWER(r.id) IN (${effectiveCampFilters.map(() => '?').join(',')}))`
        : ((companyParam && companyParam.trim()) || userAllowedCamps.length > 0 ? "WHERE 1=0" : "");
      routerFilterArgs = effectiveCampFilters.length > 0 ? [...effectiveCampFilters, ...effectiveCampFilters] : [];
    }

    const salesSql = isFilteredBySalesperson
      ? `
        SELECT 
          COALESCE(NULLIF(r.sessionName, ''), NULLIF(r.camp, ''), 'Camp') as campName,
          r.sessionName as hotspotName,
          r.id as routerId,
          SUM(CASE 
            WHEN (${usedAtDateExpr} = ${todayExpr} OR date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime')) THEN
              CASE 
                WHEN v.validity_days = 30 THEN 1.0
                WHEN v.validity_days = 15 THEN 0.5
                WHEN v.validity_days = 7 THEN 0.25
                ELSE CAST(v.validity_days AS REAL) / 30.0
              END
            ELSE 0 
          END) as todaySaleCount,
          SUM(CASE WHEN (${usedAtDateExpr} = ${todayExpr} OR date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime')) THEN COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END) ELSE 0 END) as todaySaleAmount,
          SUM(CASE WHEN (${usedAtMonthExpr} = ${monthExpr} OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now')) THEN 1 ELSE 0 END) as monthlySaleCount,
          SUM(CASE WHEN (${usedAtMonthExpr} = ${monthExpr} OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now')) THEN COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END) ELSE 0 END) as monthlySaleAmount,
          SUM(CASE WHEN v.voucher_code IS NOT NULL THEN COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END) ELSE 0 END) as totalRevenue
        FROM routers r
        LEFT JOIN vouchers v ON (v.router_id = r.id OR v.router_id = r.sessionName) AND v.status = 'redeemed' AND (
          (v.sales_person_id IS NOT NULL AND v.sales_person_id = ?)
          OR (v.sold_by IS NOT NULL AND (v.sold_by = ? OR v.sold_by IN (SELECT username FROM sales_persons WHERE id = ? OR username = ?)))
        )
        ${routerFilterClause}
        GROUP BY r.id
      `
      : `
        SELECT 
          COALESCE(r.camp, r.sessionName, 'Camp') as campName,
          r.sessionName as hotspotName,
          r.id as routerId,
          SUM(CASE 
            WHEN (${usedAtDateExpr} = ${todayExpr} OR date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime')) THEN
              CASE 
                WHEN v.validity_days = 30 THEN 1.0
                WHEN v.validity_days = 15 THEN 0.5
                WHEN v.validity_days = 7 THEN 0.25
                ELSE CAST(v.validity_days AS REAL) / 30.0
              END
            ELSE 0 
          END) as todaySaleCount,
          SUM(CASE WHEN (${usedAtDateExpr} = ${todayExpr} OR date(v.used_at) = date('now') OR date(v.used_at) = date('now', 'localtime')) THEN COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END) ELSE 0 END) as todaySaleAmount,
          SUM(CASE WHEN (${usedAtMonthExpr} = ${monthExpr} OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now')) THEN 1 ELSE 0 END) as monthlySaleCount,
          SUM(CASE WHEN (${usedAtMonthExpr} = ${monthExpr} OR strftime('%Y-%m', v.used_at) = strftime('%Y-%m', 'now')) THEN COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END) ELSE 0 END) as monthlySaleAmount,
          SUM(CASE WHEN v.voucher_code IS NOT NULL THEN COALESCE(v.price_charged, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END) ELSE 0 END) as totalRevenue
        FROM routers r
        LEFT JOIN vouchers v ON (v.router_id = r.id OR v.router_id = r.sessionName) AND v.status = 'redeemed'
        ${routerFilterClause}
        GROUP BY r.id
      `;

    const queryArgs = isFilteredBySalesperson
      ? [targetIdVal, targetUserVal, targetIdVal, targetUserVal, ...routerFilterArgs]
      : routerFilterArgs;

    const salesResult = await database.execute({
      sql: salesSql,
      args: queryArgs,
    });

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

    // 4. Merge camp data & calculate totals
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
        outstanding: isFilteredBySalesperson ? totalRevenue : outstanding,
      };
    });

    const overallStats = {
      totalOutstanding: isFilteredBySalesperson ? userStats.totalRevenue : Math.max(0, grandTotalRevenue - grandTotalPaid),
      totalSalesRevenue: grandTotalRevenue,
      todayTotalSaleCount: isFilteredBySalesperson ? userStats.todaySalesCount : grandTodaySalesCount,
      todayTotalSaleRevenue: isFilteredBySalesperson ? userStats.todayRevenue : grandTodayRevenue,
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
