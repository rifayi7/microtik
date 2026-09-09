import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { extractAuthToken, hashPassword } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/report-users
export async function GET(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    // Strictly superadmin only
    if (authUser && authUser.role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized: Super Admin access required" }, { status: 403 });
    }

    const database = await getDB();

    const query = `
      SELECT 
        ru.id, 
        ru.username, 
        ru.display_name, 
        ru.password, 
        ru.company_id, 
        ru.allowed_camp_ids, 
        ru.status, 
        ru.created_at,
        c.id as resolved_company_id,
        c.name as resolved_company_name
      FROM report_users ru
      LEFT JOIN companies c ON ru.company_id IS NOT NULL AND c.id = ru.company_id
      ORDER BY ru.id ASC
    `;

    const result = await database.execute(query);

    const reportUsers = result.rows.map((row) => {
      let allowedCampIds: string[] = [];
      if (row.allowed_camp_ids) {
        try {
          allowedCampIds = JSON.parse(String(row.allowed_camp_ids));
        } catch {
          allowedCampIds = [String(row.allowed_camp_ids)];
        }
      }

      const finalCompanyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
      const finalCompanyName = String(row.resolved_company_name || "");

      return {
        id: Number(row.id),
        username: String(row.username),
        displayName: String(row.display_name || row.username),
        password: "••••••••",
        companyId: finalCompanyId,
        companyName: finalCompanyName,
        allowedCampIds,
        status: Number(row.status ?? 1),
        createdAt: String(row.created_at || ""),
      };
    });

    return NextResponse.json({ reportUsers });
  } catch (err) {
    return mikrotikErrorResponse(err, "Failed to fetch report users");
  }
}

// POST /api/mikrotik/admin/report-users
export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (authUser && authUser.role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized: Super Admin access required" }, { status: 403 });
    }

    const database = await getDB();
    const body = await request.json();
    const { action } = body;

    if (action === "create" || action === "update") {
      const {
        id,
        username,
        password,
        displayName,
        companyId,
        allowedCampIds,
        status,
      } = body;

      if (!username || typeof username !== "string" || !username.trim()) {
        return NextResponse.json({ error: "Valid username is required" }, { status: 400 });
      }

      if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
        return NextResponse.json({ error: "Display name is mandatory" }, { status: 400 });
      }

      const cleanUsername = username.trim();
      const cleanDisplayName = displayName.trim();
      const cleanCampIdsJson = JSON.stringify(Array.isArray(allowedCampIds) ? allowedCampIds : []);
      const userStatus = status !== undefined ? (Number(status) ? 1 : 0) : 1;

      // Resolve Company ID
      let targetCompanyId: number | null = companyId ? Number(companyId) : null;

      if (!targetCompanyId) {
        return NextResponse.json(
          { error: "A valid assigned Company is mandatory for creating a sales report user." },
          { status: 400 }
        );
      }

      if (action === "create") {
        if (!password || typeof password !== "string" || !password.trim()) {
          return NextResponse.json({ error: "Password is required for new report viewer" }, { status: 400 });
        }

        const existing = await database.execute({
          sql: "SELECT id FROM report_users WHERE LOWER(username) = LOWER(?) LIMIT 1",
          args: [cleanUsername],
        });
        if (existing.rows.length > 0) {
          return NextResponse.json({ error: `Username "${cleanUsername}" already exists` }, { status: 400 });
        }

        const hashedPassword = hashPassword(password.trim());

        const insertRes = await database.execute({
          sql: `
            INSERT INTO report_users 
              (username, password, display_name, company_id, allowed_camp_ids, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `,
          args: [
            cleanUsername,
            hashedPassword,
            cleanDisplayName,
            targetCompanyId,
            cleanCampIdsJson,
            userStatus,
          ],
        });

        return NextResponse.json({
          success: true,
          id: Number(insertRes.lastInsertRowid),
          message: "Report user created successfully",
        });
      }

      if (action === "update") {
        if (!id) {
          return NextResponse.json({ error: "User ID is required for update" }, { status: 400 });
        }

        if (password && typeof password === "string" && password.trim() !== "") {
          const hashedPassword = hashPassword(password.trim());
          await database.execute({
            sql: `
              UPDATE report_users 
              SET username = ?, password = ?, display_name = ?, company_id = ?, 
                  allowed_camp_ids = ?, status = ?
              WHERE id = ?
            `,
            args: [
              cleanUsername,
              hashedPassword,
              cleanDisplayName,
              targetCompanyId,
              cleanCampIdsJson,
              userStatus,
              Number(id),
            ],
          });
        } else {
          await database.execute({
            sql: `
              UPDATE report_users 
              SET username = ?, display_name = ?, company_id = ?, 
                  allowed_camp_ids = ?, status = ?
              WHERE id = ?
            `,
            args: [
              cleanUsername,
              cleanDisplayName,
              targetCompanyId,
              cleanCampIdsJson,
              userStatus,
              Number(id),
            ],
          });
        }

        return NextResponse.json({
          success: true,
          message: "Report user updated successfully",
        });
      }
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "User ID is required for deletion" }, { status: 400 });
      }

      await database.execute({
        sql: "DELETE FROM report_users WHERE id = ?",
        args: [Number(id)],
      });

      return NextResponse.json({ success: true, message: "Report user deleted successfully" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return mikrotikErrorResponse(err, "Failed to save report user");
  }
}
