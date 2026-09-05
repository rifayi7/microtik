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

    // 1. Get all companies
    const compResult = await database.execute("SELECT id, name FROM companies ORDER BY name ASC");
    const companies = compResult.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
    }));

    // 2. Get all company admins
    const adminResult = await database.execute(`
      SELECT id, username, company_name, role, created_at
      FROM company_admins
      ORDER BY id ASC
    `);

    const companyAdmins = adminResult.rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      companyName: String(row.company_name),
      role: String(row.role || "company_admin"),
      createdAt: String(row.created_at || ""),
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
    const { action, companyName, username, password, id } = body;
    const database = await getDB();

    // Action: Create Company
    if (action === "create_company") {
      if (!companyName || !companyName.trim()) {
        return NextResponse.json({ success: false, error: "Company name is required" }, { status: 400 });
      }

      await database.execute({
        sql: "INSERT OR IGNORE INTO companies (name) VALUES (?)",
        args: [companyName.trim()],
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
        sql: "UPDATE companies SET name = ? WHERE id = ?",
        args: [newName.trim(), Number(compId)],
      });

      return NextResponse.json({ success: true, message: "Company updated successfully" });
    }

    // Action: Create or Update Company Admin
    if (action === "create_admin") {
      if (!username || !password || !companyName) {
        return NextResponse.json({ success: false, error: "Username, password, and company are required" }, { status: 400 });
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

      const hashedPassword = hashPassword(password.trim());

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
                sql: "UPDATE companies SET name = ? WHERE id = ?",
                args: [trimmedCompany, currentCompId],
              });
              resolvedCompanyId = currentCompId;
            } else {
              // Insert new company
              const insertComp = await database.execute({
                sql: "INSERT INTO companies (name) VALUES (?)",
                args: [trimmedCompany],
              });
              resolvedCompanyId = Number(insertComp.lastInsertRowid);
            }
          }
        }

        await database.execute({
          sql: `
            UPDATE company_admins 
            SET username = ?, password = ?, company_name = ?, company_id = ?
            WHERE id = ?
          `,
          args: [username.trim(), hashedPassword, trimmedCompany, resolvedCompanyId, Number(id)],
        });
        return NextResponse.json({ success: true, message: "Company admin updated successfully" });
      } else {
        const existing = await database.execute({
          sql: "SELECT id FROM company_admins WHERE username = ?",
          args: [username.trim()],
        });

        if (existing.rows.length > 0) {
          return NextResponse.json({ success: false, error: "This admin username already exists" }, { status: 400 });
        }

        if (!resolvedCompanyId) {
          const insertComp = await database.execute({
            sql: "INSERT INTO companies (name) VALUES (?)",
            args: [trimmedCompany],
          });
          resolvedCompanyId = Number(insertComp.lastInsertRowid);
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
