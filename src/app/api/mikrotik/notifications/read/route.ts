import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// POST /api/mikrotik/notifications/read - Mark notification as read
export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    const body = await request.json();
    const { notificationId, salesPersonId, salesperson } = body;

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }

    const database = await getDB();
    let targetSpId: number | null = salesPersonId ? Number(salesPersonId) : (authUser?.userId ? Number(authUser.userId) : null);

    if (!targetSpId && (salesperson || authUser?.sub)) {
      const spRes = await database.execute({
        sql: "SELECT id FROM sales_persons WHERE username = ? OR display_name = ? LIMIT 1",
        args: [salesperson || authUser?.sub || "", salesperson || authUser?.sub || ""],
      });
      if (spRes.rows.length > 0) {
        targetSpId = Number(spRes.rows[0].id);
      }
    }

    if (!targetSpId) {
      return NextResponse.json({ error: "salesPersonId or auth token required to mark read" }, { status: 400 });
    }

    await database.execute({
      sql: `
        INSERT OR IGNORE INTO notification_reads (notification_id, sales_person_id, read_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `,
      args: [Number(notificationId), targetSpId],
    });

    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Notification read POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}
