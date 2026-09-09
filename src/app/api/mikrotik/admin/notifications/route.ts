import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/notifications - List broadcast notifications
export async function GET(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized. Superadmin access required." }, { status: 403 });
    }

    const database = await getDB();
    const result = await database.execute(`
      SELECT n.*, 
             c.name as resolved_company_name,
             (SELECT COUNT(*) FROM notification_reads nr WHERE nr.notification_id = n.id) as read_count
      FROM notifications n
      LEFT JOIN companies c ON n.company_id = c.id
      ORDER BY n.created_at DESC
    `);

    const notifications = result.rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      message: String(row.message),
      type: String(row.type || "info"),
      targetType: String(row.target_type || "ALL"),
      companyId: row.company_id ? Number(row.company_id) : null,
      companyName: row.resolved_company_name ? String(row.resolved_company_name) : (row.company_name ? String(row.company_name) : null),
      createdBy: String(row.created_by || "Super Admin"),
      createdAt: String(row.created_at),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      readCount: Number(row.read_count || 0),
    }));

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Admin notifications GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load notifications" },
      { status: 500 }
    );
  }
}

// POST /api/mikrotik/admin/notifications - Create / Broadcast notification
export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized. Superadmin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, type = "info", targetType = "ALL", companyId, companyName, expiresAt } = body;

    if (!title || !title.trim() || !message || !message.trim()) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    const database = await getDB();

    let resolvedCompanyId: number | null = null;
    let resolvedCompanyName: string | null = null;

    if (targetType === "COMPANY") {
      if (companyId) {
        resolvedCompanyId = Number(companyId);
        const compRes = await database.execute({
          sql: "SELECT name FROM companies WHERE id = ? LIMIT 1",
          args: [resolvedCompanyId],
        });
        if (compRes.rows.length > 0) {
          resolvedCompanyName = String(compRes.rows[0].name);
        }
      } else if (companyName && companyName.trim()) {
        const compRes = await database.execute({
          sql: "SELECT id, name FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1",
          args: [String(companyName).trim()],
        });
        if (compRes.rows.length > 0) {
          resolvedCompanyId = Number(compRes.rows[0].id);
          resolvedCompanyName = String(compRes.rows[0].name);
        }
      }

      if (!resolvedCompanyId) {
        return NextResponse.json({ error: "Target company is required when target is set to COMPANY" }, { status: 400 });
      }
    }

    const insertRes = await database.execute({
      sql: `
        INSERT INTO notifications (
          title, message, type, target_type, company_id, company_name, created_by, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        title.trim(),
        message.trim(),
        type,
        targetType,
        resolvedCompanyId,
        resolvedCompanyName,
        authUser.sub || "Super Admin",
        expiresAt || null,
      ],
    });

    const newId = Number(insertRes.lastInsertRowid);

    return NextResponse.json({
      success: true,
      message: `Notification broadcasted to ${targetType === "ALL" ? "All Companies" : resolvedCompanyName} successfully!`,
      notification: {
        id: newId,
        title: title.trim(),
        message: message.trim(),
        type,
        targetType,
        companyId: resolvedCompanyId,
        companyName: resolvedCompanyName,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Admin notifications POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to broadcast notification" },
      { status: 500 }
    );
  }
}

// DELETE /api/mikrotik/admin/notifications - Delete notification
export async function DELETE(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized. Superadmin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const database = await getDB();
    await database.batch([
      {
        sql: "DELETE FROM notification_reads WHERE notification_id = ?",
        args: [Number(id)],
      },
      {
        sql: "DELETE FROM notifications WHERE id = ?",
        args: [Number(id)],
      },
    ], "write");

    return NextResponse.json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Admin notifications DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete notification" },
      { status: 500 }
    );
  }
}
