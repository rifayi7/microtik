import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const authUser = extractAuthToken(request);

    let routerId = url.searchParams.get("routerId");
    let search = url.searchParams.get("search");
    let startDate = url.searchParams.get("startDate");
    let endDate = url.searchParams.get("endDate");
    let salesperson = url.searchParams.get("salesperson");
    let salesPersonId = url.searchParams.get("salesPersonId");
    let company = url.searchParams.get("company");

    // If company admin / salesperson is authenticated via JWT, strictly enforce their company scope
    if (authUser && authUser.role !== "superadmin" && authUser.companyName) {
      company = authUser.companyName;
    }

    if (request.method === "POST") {
      try {
        const body = await request.json();
        if (body.routerId) routerId = body.routerId;
        if (body.search) search = body.search;
        if (body.startDate) startDate = body.startDate;
        if (body.endDate) endDate = body.endDate;
        if (body.salesperson) salesperson = body.salesperson;
        if (body.salesPersonId) salesPersonId = body.salesPersonId;
        if (body.company) company = body.company;
      } catch {
        // Body parsing optional
      }
    }

    // Build dynamic WHERE clause
    const conditions: string[] = ["v.status = 'redeemed'"];
    const args: any[] = [];

    if (company && company.trim()) {
      conditions.push(`v.router_id IN (
        SELECT r.id FROM routers r 
        WHERE LOWER(COALESCE(r.camp, r.sessionName, '')) IN (
          SELECT LOWER(name) FROM camps WHERE LOWER(company_name) = LOWER(?)
        )
      )`);
      args.push(company.trim());
    }

    let allowedCamps: string[] = authUser?.allowedCamps || [];

    // If allowedCamps not in JWT, check from database for the salesperson
    if (allowedCamps.length === 0 && (salesPersonId || salesperson)) {
      const spRes = await db.execute({
        sql: "SELECT allowed_camps, camp_name FROM sales_persons WHERE id = ? OR username = ? OR display_name = ? LIMIT 1",
        args: [salesPersonId || -1, salesperson || "", salesperson || ""],
      });
      if (spRes.rows.length > 0) {
        const spRow = spRes.rows[0];
        if (spRow.allowed_camps) {
          try {
            allowedCamps = JSON.parse(String(spRow.allowed_camps));
          } catch {
            allowedCamps = [String(spRow.allowed_camps)];
          }
        } else if (spRow.camp_name && spRow.camp_name !== "All Camps") {
          allowedCamps = [String(spRow.camp_name)];
        }
      }
    }

    // If querying general reports without a specific salesperson, filter by allowedCamps
    const isSpecificSalesperson = Boolean(salesPersonId || (salesperson && salesperson.trim() !== ""));
    if (!isSpecificSalesperson && allowedCamps.length > 0) {
      conditions.push(`v.router_id IN (
        SELECT r.id FROM routers r 
        WHERE LOWER(COALESCE(r.camp, r.sessionName, '')) IN (${allowedCamps.map(() => '?').join(',')})
           OR LOWER(r.id) IN (${allowedCamps.map(() => '?').join(',')})
      )`);
      args.push(...allowedCamps.map((c) => c.toLowerCase()), ...allowedCamps.map((c) => c.toLowerCase()));
    }

    if (routerId && routerId.trim() !== "") {
      conditions.push("v.router_id = ?");
      args.push(routerId.trim());
    }

    if (salesPersonId && !isNaN(Number(salesPersonId))) {
      conditions.push(`(
        v.sales_person_id = ? 
        OR v.sold_by = ? 
        OR v.sold_by IN (SELECT username FROM sales_persons WHERE id = ?)
        OR v.sold_by IN (SELECT display_name FROM sales_persons WHERE id = ?)
      )`);
      const sId = Number(salesPersonId);
      const sName = salesperson ? salesperson.trim() : "UNKNOWN";
      args.push(sId, sName, sId, sId);
    } else if (salesperson && salesperson.trim() !== "") {
      conditions.push(`(
        v.sold_by = ? 
        OR v.sales_person_id IN (SELECT id FROM sales_persons WHERE username = ? OR display_name = ?)
        OR v.sold_by IN (SELECT username FROM sales_persons WHERE display_name = ?)
        OR v.sold_by IN (SELECT display_name FROM sales_persons WHERE username = ?)
      )`);
      const sName = salesperson.trim();
      args.push(sName, sName, sName, sName, sName);
    }

    if (startDate && startDate.trim() !== "") {
      conditions.push("date(v.used_at) >= date(?)");
      args.push(startDate.trim());
    }

    if (endDate && endDate.trim() !== "") {
      conditions.push("date(v.used_at) <= date(?)");
      args.push(endDate.trim());
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      conditions.push("(v.voucher_code LIKE ? OR v.used_by LIKE ? OR v.sold_by LIKE ?)");
      args.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Total sold vouchers count
    const totalSoldResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM vouchers v ${whereClause}`,
      args,
    });
    const totalSoldRow = totalSoldResult.rows[0];
    const totalSold = totalSoldRow ? Number(totalSoldRow.count) : 0;

    // 2. Sales count grouped by salesperson
    const salespersonResult = await db.execute({
      sql: `
        SELECT v.sold_by as name, COUNT(*) as count 
        FROM vouchers v
        ${whereClause} AND v.sold_by IS NOT NULL AND v.sold_by != ''
        GROUP BY v.sold_by
        ORDER BY count DESC
      `,
      args,
    });
    const salespersonRows = salespersonResult.rows.map((row) => ({
      name: String(row.name),
      count: Number(row.count),
    }));

    // 3. Detailed sales log
    const salesLogResult = await db.execute({
      sql: `
        SELECT 
          v.voucher_code as code, 
          v.validity_days as validity, 
          v.used_by as mobile, 
          v.used_at as timestamp, 
          v.sold_by as seller, 
          v.price_charged as price,
          v.router_id as routerId,
          COALESCE(NULLIF(r.sessionName, ''), NULLIF(r.camp, ''), 'Camp') as campName
        FROM vouchers v
        LEFT JOIN routers r ON CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id
        ${whereClause}
        ORDER BY v.used_at DESC
        LIMIT 200
      `,
      args,
    });

    const formatDubaiTime = (dateStr?: string) => {
      if (!dateStr || dateStr.trim() === "" || dateStr === "null") return "";
      try {
        const parts = dateStr.split(" ");
        if (parts.length >= 2) {
          const [dPart, tPart] = parts;
          const [hh, mm] = tPart.split(":");
          let h = parseInt(hh, 10);
          const ampm = h >= 12 ? "PM" : "AM";
          h = h % 12 || 12;
          return `${dPart} ${h}:${mm} ${ampm}`;
        }
        return dateStr;
      } catch {
        return dateStr || "";
      }
    };

    const salesLogs = salesLogResult.rows.map((row) => {
      const rawTimestamp = String(row.timestamp ?? "");
      return {
        code: String(row.code),
        validity: Number(row.validity || 0),
        mobile: String(row.mobile ?? ""),
        timestamp: rawTimestamp,
        formattedTime: formatDubaiTime(rawTimestamp),
        seller: String(row.seller ?? ""),
        price: Number(row.price || 0),
        routerId: String(row.routerId ?? ""),
        campName: String(row.campName ?? ""),
      };
    });

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
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
    },
  });
}
