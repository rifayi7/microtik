import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

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

    let routerId = url.searchParams.get("routerId");
    let search = url.searchParams.get("search");
    let startDate = url.searchParams.get("startDate");
    let endDate = url.searchParams.get("endDate");
    let salesperson = url.searchParams.get("salesperson");
    let salesPersonId = url.searchParams.get("salesPersonId");

    if (request.method === "POST") {
      try {
        const body = await request.json();
        if (body.routerId) routerId = body.routerId;
        if (body.search) search = body.search;
        if (body.startDate) startDate = body.startDate;
        if (body.endDate) endDate = body.endDate;
        if (body.salesperson) salesperson = body.salesperson;
        if (body.salesPersonId) salesPersonId = body.salesPersonId;
      } catch {
        // Body parsing optional
      }
    }

    // Build dynamic WHERE clause
    const conditions: string[] = ["v.status = 'redeemed'"];
    const args: any[] = [];

    if (routerId && routerId.trim() !== "") {
      conditions.push("v.router_id = ?");
      args.push(routerId.trim());
    }

    if (salesPersonId && !isNaN(Number(salesPersonId))) {
      conditions.push("(v.sales_person_id = ? OR v.sold_by = ?)");
      args.push(Number(salesPersonId), salesperson ? salesperson.trim() : "UNKNOWN");
    } else if (salesperson && salesperson.trim() !== "") {
      conditions.push("(v.sold_by = ? OR v.sales_person_id IN (SELECT id FROM sales_persons WHERE username = ? OR display_name = ?))");
      args.push(salesperson.trim(), salesperson.trim(), salesperson.trim());
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
          COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), 'Camp') as campName
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
