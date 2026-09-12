import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/pricing
export async function GET() {
  try {
    const database = await getDB();
    
    // 1. Get Camp Validity Pricing entries with router & company details
    const cvpResult = await database.execute(`
      SELECT 
        cvp.id, 
        cvp.company_id, 
        cvp.router_id, 
        cvp.validity, 
        cvp.price, 
        COALESCE(cvp.unit, 1.0) as unit, 
        cvp.status,
        COALESCE(r.sessionName, r.camp, cvp.router_id) as camp_name,
        c.name as company_name
      FROM camp_validity_pricing cvp
      LEFT JOIN routers r ON cvp.router_id = r.id
      LEFT JOIN companies c ON cvp.company_id = c.id
      ORDER BY camp_name ASC, cvp.validity ASC
    `);

    const campPricing = cvpResult.rows.map((row) => {
      const vDays = Number(row.validity);
      let calculatedUnit = Number(row.unit);
      if (row.unit === null || row.unit === undefined || isNaN(calculatedUnit)) {
        calculatedUnit = vDays === 15 ? 0.5 : (vDays === 7 ? 0.25 : 1.0);
      }
      return {
        id: Number(row.id),
        routerId: String(row.router_id),
        campName: String(row.camp_name || row.router_id),
        validity: vDays,
        companyId: row.company_id ? Number(row.company_id) : null,
        companyName: row.company_name ? String(row.company_name) : "",
        price: Number(row.price),
        unit: calculatedUnit,
        status: Number(row.status ?? 1),
      };
    });

    // 2. Get all distinct registered locations/routers with their company IDs and names directly from routers & companies
    const campsResult = await database.execute(`
      SELECT 
        r.id as router_id,
        COALESCE(r.sessionName, r.camp, r.id) as name, 
        r.company_id,
        c.name as company_name,
        r.is_active
      FROM routers r 
      LEFT JOIN companies c ON r.company_id = c.id
    `);
    const registeredCamps = Array.from(new Set(
      campsResult.rows
        .filter((r) => r.is_active === 1 || r.is_active === null)
        .map((r) => String(r.name))
    ));
    const campsWithCompany = campsResult.rows.map((r) => ({
      campId: r.router_id ? String(r.router_id) : null,
      name: String(r.name),
      companyId: r.company_id ? Number(r.company_id) : null,
      companyName: r.company_name ? String(r.company_name) : null,
      isActive: r.is_active === 1 || r.is_active === null,
    }));

    // 3. Get distinct companies directly from companies table
    const compResult = await database.execute(`
      SELECT id, name FROM companies WHERE name IS NOT NULL AND name != '' ORDER BY name ASC
    `);
    const companies = compResult.rows.map((r) => String(r.name));
    const companyObjects = compResult.rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));

    return NextResponse.json({
      success: true,
      campPricing,
      registeredCamps,
      campsWithCompany,
      companies,
      companyObjects,
      validityProfiles: [7, 15, 30],
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load pricing configurations");
  }
}

// POST /api/mikrotik/admin/pricing (Create or Update camp validity pricing)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { routerId, campName, validity, price, unit, status } = body;

    const database = await getDB();
    let targetRouterId = routerId ? String(routerId).trim() : "";
    let targetCompanyId: number | null = null;

    if (!targetRouterId && campName) {
      const rRes = await database.execute({
        sql: "SELECT id, company_id FROM routers WHERE LOWER(sessionName) = LOWER(?) OR LOWER(camp) = LOWER(?) OR LOWER(id) = LOWER(?) LIMIT 1",
        args: [campName.trim(), campName.trim(), campName.trim()],
      });
      if (rRes.rows.length > 0) {
        targetRouterId = String(rRes.rows[0].id);
        targetCompanyId = rRes.rows[0].company_id ? Number(rRes.rows[0].company_id) : null;
      }
    } else if (targetRouterId) {
      const rRes = await database.execute({
        sql: "SELECT company_id FROM routers WHERE id = ? LIMIT 1",
        args: [targetRouterId],
      });
      if (rRes.rows.length > 0 && rRes.rows[0].company_id) {
        targetCompanyId = Number(rRes.rows[0].company_id);
      }
    }

    if (!targetRouterId || validity === undefined || price === undefined) {
      return NextResponse.json({ success: false, error: "Router and validity (in days) and price are required" }, { status: 400 });
    }

    const validityDays = Number(String(validity).replace(/\D/g, "")) || Number(validity) || 30;
    const defaultUnit = validityDays === 15 ? 0.5 : (validityDays === 7 ? 0.25 : 1.0);
    const finalUnit = unit !== undefined && unit !== null && !isNaN(Number(unit)) ? Number(unit) : defaultUnit;

    await database.execute({
      sql: `
        INSERT INTO camp_validity_pricing (company_id, router_id, validity, price, unit, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(router_id, validity) DO UPDATE SET
          price = excluded.price,
          unit = excluded.unit,
          company_id = excluded.company_id,
          status = excluded.status
      `,
      args: [targetCompanyId, targetRouterId, validityDays, Number(price), finalUnit, status !== undefined ? Number(status) : 1],
    });

    return NextResponse.json({ success: true, message: "Pricing configured successfully" });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to save pricing configuration");
  }
}

// DELETE /api/mikrotik/admin/pricing?id=123
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Pricing ID is required" }, { status: 400 });
    }

    const database = await getDB();
    await database.execute({
      sql: "DELETE FROM camp_validity_pricing WHERE id = ?",
      args: [Number(id)],
    });

    return NextResponse.json({ success: true, message: "Pricing removed successfully" });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to delete pricing");
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
