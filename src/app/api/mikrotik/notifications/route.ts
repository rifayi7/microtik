import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/notifications - Fetch active notifications for mobile operator / user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let authUser = extractAuthToken(request);

    const salespersonParam = searchParams.get("salesperson");
    const salesPersonIdParam = searchParams.get("salesPersonId");
    let companyIdParam = searchParams.get("companyId");

    const database = await getDB();

    let targetSpId: number | null = salesPersonIdParam ? Number(salesPersonIdParam) : (authUser?.userId ? Number(authUser.userId) : null);
    let targetCompanyId: number | null = companyIdParam ? Number(companyIdParam) : (authUser?.companyId ? Number(authUser.companyId) : null);

    // If operator details not fully populated, lookup from sales_persons
    if (!targetCompanyId && (targetSpId || salespersonParam || authUser?.sub)) {
      const spRes = await database.execute({
        sql: "SELECT id, company_id FROM sales_persons WHERE id = ? OR username = ? OR display_name = ? LIMIT 1",
        args: [targetSpId || -1, salespersonParam || authUser?.sub || "", salespersonParam || authUser?.sub || ""],
      });
      if (spRes.rows.length > 0) {
        targetSpId = Number(spRes.rows[0].id);
        if (spRes.rows[0].company_id) {
          targetCompanyId = Number(spRes.rows[0].company_id);
        }
      }
    }

    // Query active notifications (broadcasted to ALL or this specific company)
    const sql = `
      SELECT n.*,
             c.name as resolved_company_name,
             CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as is_read,
             nr.read_at
      FROM notifications n
      LEFT JOIN companies c ON n.company_id = c.id
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.sales_person_id = ?
      WHERE (n.target_type = 'ALL' OR n.company_id = ?)
        AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))
      ORDER BY n.created_at DESC
      LIMIT 50
    `;

    const result = await database.execute({
      sql,
      args: [targetSpId || -1, targetCompanyId || -1],
    });

    const notifications = result.rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      message: String(row.message),
      type: String(row.type || "info"),
      targetType: String(row.target_type || "ALL"),
      companyId: row.company_id ? Number(row.company_id) : null,
      companyName: row.resolved_company_name ? String(row.resolved_company_name) : (row.company_name ? String(row.company_name) : null),
      createdAt: String(row.created_at),
      isRead: Number(row.is_read) === 1,
      readAt: row.read_at ? String(row.read_at) : null,
    }));

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load notifications" },
      { status: 500 }
    );
  }
}
