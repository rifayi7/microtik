import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/auth/profile?userId=...
export async function GET(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get("userId");
    const usernameParam = url.searchParams.get("username");

    const targetUserId = userIdParam ? Number(userIdParam) : (authUser?.userId ? Number(authUser.userId) : null);
    const targetUsername = usernameParam?.trim() || authUser?.sub || null;

    if (!targetUserId && !targetUsername) {
      return NextResponse.json({ success: false, error: "User ID or username required" }, { status: 400 });
    }

    const database = await getDB();
    const result = await database.execute({
      sql: `
        SELECT 
          sp.id, sp.username, sp.display_name, sp.role, sp.camp_name, 
          sp.company_id, sp.allowed_camps, sp.allowed_router_ids,
          c.id as resolved_company_id, c.name as resolved_company_name
        FROM sales_persons sp
        LEFT JOIN companies c ON (sp.company_id IS NOT NULL AND c.id = sp.company_id)
        WHERE (sp.id = ? OR LOWER(sp.username) = LOWER(?))
        LIMIT 1
      `,
      args: [targetUserId || -1, targetUsername || "UNKNOWN"],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const row = result.rows[0];

    let allowedCamps: string[] = [];
    if (row.allowed_camps) {
      try {
        allowedCamps = JSON.parse(String(row.allowed_camps));
      } catch {
        allowedCamps = [String(row.allowed_camps)];
      }
    } else if (row.camp_name && row.camp_name !== "All Camps") {
      allowedCamps = [String(row.camp_name)];
    }

    let allowedRouterIds: string[] = [];
    if (row.allowed_router_ids) {
      try {
        allowedRouterIds = JSON.parse(String(row.allowed_router_ids));
      } catch {
        allowedRouterIds = [String(row.allowed_router_ids)];
      }
    }

    const companyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
    const companyName = row.resolved_company_name ? String(row.resolved_company_name) : null;

    return NextResponse.json({
      success: true,
      user: {
        id: Number(row.id),
        username: String(row.username),
        displayName: String(row.display_name || row.username),
        role: String(row.role || "salesperson"),
        campName: String(row.camp_name || (allowedCamps.length > 0 ? allowedCamps[0] : "All Camps")),
        companyId,
        companyName,
        allowedCamps,
        allowedRouterIds,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
