import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { hashPassword, extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/companies
export async function GET(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (authUser && authUser.role !== "superadmin") {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const database = await getDB();

    // 1. Get all companies with status
    const compResult = await database.execute("SELECT id, name, COALESCE(timezone, 'Asia/Dubai') as timezone, COALESCE(status, 1) as status, suspended_reason FROM companies ORDER BY name ASC");
    const companies = compResult.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      timezone: String(row.timezone || "Asia/Dubai"),
      status: Number(row.status ?? 1),
      suspendedReason: row.suspended_reason ? String(row.suspended_reason) : null,
    }));

    // 2. Get all company admins
    const adminResult = await database.execute(`
      SELECT ca.id, ca.username, ca.company_name, ca.company_id, ca.role, ca.created_at, 
             COALESCE(c.id, ca.company_id) as resolved_company_id,
             COALESCE(c.timezone, 'Asia/Dubai') as timezone,
             COALESCE(c.status, 1) as company_status
      FROM company_admins ca
      LEFT JOIN companies c ON (ca.company_id IS NOT NULL AND c.id = ca.company_id) OR (ca.company_name IS NOT NULL AND LOWER(c.name) = LOWER(ca.company_name))
      ORDER BY ca.id ASC
    `);

    const companyAdmins = adminResult.rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      companyName: String(row.company_name),
      companyId: row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null),
      role: String(row.role || "company_admin"),
      createdAt: String(row.created_at || ""),
      timezone: String(row.timezone || "Asia/Dubai"),
      companyStatus: Number(row.company_status ?? 1),
    }));

    return NextResponse.json({
      success: true,
      companies,
      companyAdmins,
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load companies");
  }
}

// POST /api/mikrotik/admin/companies
export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (authUser && authUser.role !== "superadmin") {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const body = await request.json();
    const { action, companyName, username, password, id, timezone, status, suspendedReason } = body;
    const database = await getDB();
    const targetTimezone = timezone && timezone.trim() ? timezone.trim() : "Asia/Dubai";

    // Action: Toggle Company Status (Active <-> Suspended / Paused)
    if (action === "toggle_company_status") {
      const { id: compId, status: newStatus, suspendedReason: reason } = body;
      if (!compId) {
        return NextResponse.json({ success: false, error: "Company ID is required" }, { status: 400 });
      }

      const targetStatus = Number(newStatus) === 0 ? 0 : 1;
      const targetReason = targetStatus === 0 ? (reason || "Account suspended due to outstanding dues. Please contact administrator.") : null;

      await database.execute({
        sql: "UPDATE companies SET status = ?, suspended_reason = ? WHERE id = ?",
        args: [targetStatus, targetReason, Number(compId)],
      });

      return NextResponse.json({
        success: true,
        message: targetStatus === 1 ? "Company activated successfully" : "Company paused/suspended due to dues",
        status: targetStatus,
      });
    }

    // Action: Create Company
    if (action === "create_company") {
      if (!companyName || !companyName.trim()) {
        return NextResponse.json({ success: false, error: "Company name is required" }, { status: 400 });
      }

      await database.execute({
        sql: "INSERT OR IGNORE INTO companies (name, timezone) VALUES (?, ?)",
        args: [companyName.trim(), targetTimezone],
      });

      return NextResponse.json({ success: true, message: "Company created successfully" });
    }

    // Action: Update / Rename Company
    if (action === "update_company") {
      const { id: compId, companyName: newName } = body;
      if (!compId || !newName || !newName.trim()) {
        return NextResponse.json({ success: false, error: "Company ID and new name are required" }, { status: 400 });
      }

      await database.execute({
        sql: "UPDATE companies SET name = ?, timezone = ? WHERE id = ?",
        args: [newName.trim(), targetTimezone, Number(compId)],
      });

      return NextResponse.json({ success: true, message: "Company updated successfully" });
    }

    // Action: Create or Update Company Admin
    if (action === "create_admin") {
      if (!username || (!id && !password) || !companyName) {
        return NextResponse.json({ success: false, error: "Username and company are required" }, { status: 400 });
      }

      const trimmedCompany = companyName.trim();

      // Ensure company exists in companies table
      let resolvedCompanyId: number | null = null;
      const compRes = await database.execute({
        sql: "SELECT id, name FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1",
        args: [trimmedCompany],
      });
      if (compRes.rows.length > 0) {
        resolvedCompanyId = Number(compRes.rows[0].id);
      }

      let hashedPassword = "";
      if (password && password.trim()) {
        hashedPassword = hashPassword(password.trim());
      }

      if (id) {
        // Fetch existing admin
        const existingAdmin = await database.execute({
          sql: "SELECT id, company_id, company_name FROM company_admins WHERE id = ?",
          args: [Number(id)],
        });

        if (existingAdmin.rows.length > 0) {
          const currentCompId = existingAdmin.rows[0].company_id ? Number(existingAdmin.rows[0].company_id) : null;
          
          if (!resolvedCompanyId) {
            if (currentCompId) {
              // Rename the existing company in companies table
              await database.execute({
                sql: "UPDATE companies SET name = ?, timezone = ? WHERE id = ?",
                args: [trimmedCompany, targetTimezone, currentCompId],
              });
              resolvedCompanyId = currentCompId;
            } else {
              // Insert new company
              const insertComp = await database.execute({
                sql: "INSERT INTO companies (name, timezone) VALUES (?, ?)",
                args: [trimmedCompany, targetTimezone],
              });
              resolvedCompanyId = Number(insertComp.lastInsertRowid);
            }
          } else {
            // Update company timezone and name
            await database.execute({
              sql: "UPDATE companies SET name = ?, timezone = ? WHERE id = ?",
              args: [trimmedCompany, targetTimezone, resolvedCompanyId],
            });
          }
        }

        const updatePasswordSql = hashedPassword ? "password = ?," : "";
        const updateArgs = hashedPassword
          ? [username.trim(), hashedPassword, trimmedCompany, resolvedCompanyId, Number(id)]
          : [username.trim(), trimmedCompany, resolvedCompanyId, Number(id)];

        await database.execute({
          sql: `
            UPDATE company_admins 
            SET username = ?, ${updatePasswordSql} company_name = ?, company_id = ?
            WHERE id = ?
          `,
          args: updateArgs,
        });
        return NextResponse.json({ success: true, message: "Company admin updated successfully" });
      } else {
        // Neutral cross-table uniqueness check (super_admins + company_admins)
        const inCompany = await database.execute({
          sql: "SELECT id FROM company_admins WHERE LOWER(username) = LOWER(?)",
          args: [username.trim()],
        });
        const inSuper = await database.execute({
          sql: "SELECT id FROM super_admins WHERE LOWER(username) = LOWER(?)",
          args: [username.trim()],
        });

        if (inCompany.rows.length > 0 || inSuper.rows.length > 0) {
          return NextResponse.json({ success: false, error: "This username is already taken. Please choose another one." }, { status: 400 });
        }

        if (!resolvedCompanyId) {
          const insertComp = await database.execute({
            sql: "INSERT INTO companies (name, timezone) VALUES (?, ?)",
            args: [trimmedCompany, targetTimezone],
          });
          resolvedCompanyId = Number(insertComp.lastInsertRowid);
        } else {
          // Update company timezone if changed
          await database.execute({
            sql: "UPDATE companies SET timezone = ? WHERE id = ?",
            args: [targetTimezone, resolvedCompanyId],
          });
        }

        await database.execute({
          sql: `
            INSERT INTO company_admins (username, password, company_name, company_id, role) 
            VALUES (?, ?, ?, ?, 'company_admin')
          `,
          args: [username.trim(), hashedPassword, trimmedCompany, resolvedCompanyId],
        });

        return NextResponse.json({ success: true, message: "Company admin account created" });
      }
    }

    // Action: Delete Company Admin
    if (action === "delete_admin") {
      if (!id) {
        return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
      }

      await database.execute({
        sql: "DELETE FROM company_admins WHERE id = ?",
        args: [Number(id)],
      });

      return NextResponse.json({ success: true, message: "Company admin removed successfully" });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return mikrotikErrorResponse(error, "Operation failed");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
