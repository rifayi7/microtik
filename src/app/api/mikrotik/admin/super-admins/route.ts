import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { hashPassword, extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/super-admins
export async function GET(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ success: false, error: "Superadmin access required" }, { status: 403 });
    }

    const database = await getDB();
    const result = await database.execute({
      sql: "SELECT id, username, display_name, created_at FROM super_admins ORDER BY id ASC",
      args: [],
    });

    const superAdmins = result.rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      displayName: String(row.display_name || row.username),
      password: "••••••••",
      role: "superadmin",
      createdAt: String(row.created_at || ""),
    }));

    return NextResponse.json({ success: true, superAdmins });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load super administrators");
  }
}

// POST /api/mikrotik/admin/super-admins (Create Super Admin)
export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ success: false, error: "Superadmin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { username, displayName, password } = body;

    if (!username || !username.trim() || !password || !password.trim()) {
      return NextResponse.json({ success: false, error: "Username and password are required" }, { status: 400 });
    }

    const cleanUser = username.trim();
    const cleanPass = password.trim();
    const cleanName = displayName && displayName.trim() ? displayName.trim() : cleanUser;

    const database = await getDB();

    // Cross-table uniqueness check (super_admins & company_admins)
    const inSuper = await database.execute({
      sql: "SELECT id FROM super_admins WHERE LOWER(username) = LOWER(?)",
      args: [cleanUser],
    });
    const inCompany = await database.execute({
      sql: "SELECT id FROM company_admins WHERE LOWER(username) = LOWER(?)",
      args: [cleanUser],
    });

    if (inSuper.rows.length > 0 || inCompany.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: "This username is already taken. Please choose another one.",
      }, { status: 400 });
    }

    const hashedPassword = hashPassword(cleanPass);

    const insertRes = await database.execute({
      sql: "INSERT INTO super_admins (username, display_name, password, created_at) VALUES (?, ?, ?, datetime('now'))",
      args: [cleanUser, cleanName, hashedPassword],
    });

    return NextResponse.json({
      success: true,
      message: "Super Administrator created successfully",
      id: Number(insertRes.lastInsertRowid),
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to create super administrator");
  }
}

// PUT /api/mikrotik/admin/super-admins (Update Super Admin)
export async function PUT(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ success: false, error: "Superadmin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, username, displayName, password } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Super Admin ID is required" }, { status: 400 });
    }

    const database = await getDB();
    const cleanUser = username ? username.trim() : null;
    const cleanName = displayName && displayName.trim() ? displayName.trim() : null;
    const cleanPass = password && password.trim() ? password.trim() : null;

    if (cleanUser) {
      // Check duplicate against other super_admins and company_admins
      const inSuper = await database.execute({
        sql: "SELECT id FROM super_admins WHERE LOWER(username) = LOWER(?) AND id != ?",
        args: [cleanUser, Number(id)],
      });
      const inCompany = await database.execute({
        sql: "SELECT id FROM company_admins WHERE LOWER(username) = LOWER(?)",
        args: [cleanUser],
      });

      if (inSuper.rows.length > 0 || inCompany.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: "This username is already taken. Please choose another one.",
        }, { status: 400 });
      }
    }

    const hashedPassword = cleanPass ? hashPassword(cleanPass) : null;

    await database.execute({
      sql: `
        UPDATE super_admins 
        SET username = COALESCE(?, username),
            display_name = COALESCE(?, display_name),
            password = COALESCE(?, password)
        WHERE id = ?
      `,
      args: [cleanUser, cleanName, hashedPassword, Number(id)],
    });

    return NextResponse.json({ success: true, message: "Super Administrator updated successfully" });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to update super administrator");
  }
}

// DELETE /api/mikrotik/admin/super-admins?id=123
export async function DELETE(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    if (!authUser || authUser.role !== "superadmin") {
      return NextResponse.json({ success: false, error: "Superadmin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Super Admin ID is required" }, { status: 400 });
    }

    const database = await getDB();

    // Prevent deleting the last super admin
    const countRes = await database.execute("SELECT COUNT(*) as count FROM super_admins");
    if (Number(countRes.rows[0]?.count ?? 0) <= 1) {
      return NextResponse.json({
        success: false,
        error: "Cannot delete the only remaining Super Administrator account.",
      }, { status: 400 });
    }

    await database.execute({
      sql: "DELETE FROM super_admins WHERE id = ?",
      args: [Number(id)],
    });

    return NextResponse.json({ success: true, message: "Super Administrator deleted successfully" });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to delete super administrator");
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