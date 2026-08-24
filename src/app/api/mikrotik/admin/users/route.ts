import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/users
export async function GET() {
  try {
    const database = await getDB();
    const result = await database.execute(`
      SELECT id, username, display_name, password, role, camp_name, created_at
      FROM sales_persons
      ORDER BY id ASC
    `);

    const users = result.rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      displayName: String(row.display_name || row.username),
      password: String(row.password),
      role: String(row.role || "salesperson"),
      campName: String(row.camp_name || "All Camps"),
      createdAt: String(row.created_at || ""),
    }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load users");
  }
}

// POST /api/mikrotik/admin/users (Create new user)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, displayName, password, role, campName } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password are required" }, { status: 400 });
    }

    const database = await getDB();

    const existing = await database.execute({
      sql: "SELECT id FROM sales_persons WHERE username = ?",
      args: [username.trim()],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: "Username already exists" }, { status: 400 });
    }

    const insertResult = await database.execute({
      sql: "INSERT INTO sales_persons (username, display_name, password, role, camp_name) VALUES (?, ?, ?, ?, ?)",
      args: [username.trim(), (displayName && displayName.trim()) || username.trim(), password.trim(), role || "salesperson", campName || "All Camps"],
    });

    return NextResponse.json({
      success: true,
      message: "Salesperson created successfully",
      id: Number(insertResult.lastInsertRowid),
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to create salesperson");
  }
}

// DELETE /api/mikrotik/admin/users?id=123
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    const database = await getDB();
    await database.execute({
      sql: "DELETE FROM sales_persons WHERE id = ?",
      args: [Number(id)],
    });

    return NextResponse.json({ success: true, message: "Salesperson deleted successfully" });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to delete salesperson");
  }
}

// PUT /api/mikrotik/admin/users (Update username / displayName / password / camp / role)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, username, displayName, password, role, campName } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    const database = await getDB();

    // Find existing username before update
    const existingUser = await database.execute({
      sql: "SELECT username, display_name FROM sales_persons WHERE id = ?",
      args: [Number(id)],
    });
    const oldUsername = existingUser.rows[0]?.username ? String(existingUser.rows[0].username) : null;
    const newUsername = username && username.trim() ? username.trim() : null;

    if (newUsername && newUsername !== oldUsername) {
      const checkDup = await database.execute({
        sql: "SELECT id FROM sales_persons WHERE username = ? AND id != ?",
        args: [newUsername, Number(id)],
      });
      if (checkDup.rows.length > 0) {
        return NextResponse.json({ success: false, error: "This username is already taken by another account" }, { status: 400 });
      }
    }

    await database.execute({
      sql: `
        UPDATE sales_persons 
        SET username = COALESCE(?, username),
            display_name = COALESCE(?, display_name),
            password = COALESCE(?, password),
            role = COALESCE(?, role),
            camp_name = COALESCE(?, camp_name)
        WHERE id = ?
      `,
      args: [
        newUsername,
        displayName && displayName.trim() ? displayName.trim() : null,
        password && password.trim() ? password.trim() : null,
        role ?? null,
        campName ?? null,
        Number(id),
      ],
    });

    // Cascade update to vouchers table so all past sold vouchers stay linked to the new username
    if (newUsername && oldUsername && newUsername !== oldUsername) {
      await database.execute({
        sql: "UPDATE vouchers SET sold_by = ? WHERE sold_by = ?",
        args: [newUsername, oldUsername],
      });
    }

    return NextResponse.json({ success: true, message: "Salesperson updated successfully" });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to update user");
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
