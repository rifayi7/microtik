import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/pricing
export async function GET() {
  try {
    const database = await getDB();
    
    // 1. Get Camp Validity Pricing entries
    const cvpResult = await database.execute(`
      SELECT id, camp_name, validity_name, company_name, price, status
      FROM camp_validity_pricing
      ORDER BY camp_name ASC, validity_name ASC
    `);

    const campPricing = cvpResult.rows.map((row) => ({
      id: Number(row.id),
      campName: String(row.camp_name),
      validityName: String(row.validity_name),
      companyName: String(row.company_name || "Apricom"),
      price: Number(row.price),
      status: Number(row.status ?? 1),
    }));

    // 2. Get all distinct registered camps
    const campsResult = await database.execute(`
      SELECT DISTINCT COALESCE(camp, sessionName) as campName FROM routers
    `);
    const registeredCamps = campsResult.rows.map((r) => String(r.campName));

    // 3. Get distinct validity profile names
    const vpResult = await database.execute("SELECT name FROM validity_profiles");
    const validityProfiles = vpResult.rows.map((r) => String(r.name));

    return NextResponse.json({
      success: true,
      campPricing,
      registeredCamps,
      validityProfiles: validityProfiles.length > 0 ? validityProfiles : ["7-Days", "15-Days", "30-Days"],
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load pricing configurations");
  }
}

// POST /api/mikrotik/admin/pricing (Create or Update camp validity pricing)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campName, validityName, companyName, price, status } = body;

    if (!campName || !validityName || price === undefined) {
      return NextResponse.json({ success: false, error: "Camp name, validity profile, and price are required" }, { status: 400 });
    }

    const database = await getDB();

    await database.execute({
      sql: `
        INSERT INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(camp_name, validity_name) DO UPDATE SET
          price = excluded.price,
          company_name = excluded.company_name,
          status = excluded.status
      `,
      args: [campName.trim(), validityName.trim(), companyName || "Apricom", Number(price), status !== undefined ? Number(status) : 1],
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
