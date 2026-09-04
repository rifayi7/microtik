import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { hashPassword, extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/admin/users
export async function GET(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    const database = await getDB();
    
    let query = `
      SELECT id, username, display_name, password, role, camp_name, company_name, allowed_camps, created_at
      FROM sales_persons
    `;
    const args: any[] = [];

    if (authUser && authUser.role !== "superadmin" && authUser.companyName) {
      query += " WHERE LOWER(company_name) = LOWER(?) ";
      args.push(authUser.companyName.trim());
    }

    query += " ORDER BY id ASC";
    const result = await database.execute({ sql: query, args });

    const users = result.rows.map((row) => {
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

      return {
        id: Number(row.id),
        username: String(row.username),
        displayName: String(row.display_name || row.username),
        password: "••••••••",
        role: String(row.role || "salesperson"),
        campName: String(row.camp_name || (allowedCamps.length > 0 ? allowedCamps.join(", ") : "All Camps")),
        companyName: String(row.company_name || ""),
        allowedCamps,
        createdAt: String(row.created_at || ""),
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load users");
  }
}

// POST /api/mikrotik/admin/users (Create new user)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, displayName, password, role, campName, companyName, allowedCamps } = body;

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

    const hashedPassword = hashPassword(password.trim());
    const campsArray = Array.isArray(allowedCamps) ? allowedCamps : (campName && campName !== "All Camps" ? [campName] : []);
    const allowedCampsStr = JSON.stringify(campsArray);
    const primaryCamp = campsArray.length > 0 ? campsArray[0] : (campName || "All Camps");

    const insertResult = await database.execute({
      sql: `
        INSERT INTO sales_persons (username, display_name, password, role, camp_name, company_name, allowed_camps) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        username.trim(), 
        (displayName && displayName.trim()) || username.trim(), 
        hashedPassword, 
        role || "salesperson", 
        primaryCamp,
        companyName || null,
        allowedCampsStr
      ],
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

// PUT /api/mikrotik/admin/users (Update username / displayName / password / camp / company / allowedCamps / role)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, username, displayName, password, role, campName, companyName, allowedCamps } = body;

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

    const hashedPassword = password && password.trim() ? hashPassword(password.trim()) : null;
    const campsArray = Array.isArray(allowedCamps) ? allowedCamps : (campName && campName !== "All Camps" ? [campName] : undefined);
    const allowedCampsStr = campsArray !== undefined ? JSON.stringify(campsArray) : undefined;
    const primaryCamp = campsArray && campsArray.length > 0 ? campsArray[0] : campName;

    await database.execute({
      sql: `
        UPDATE sales_persons 
        SET username = COALESCE(?, username),
            display_name = COALESCE(?, display_name),
            password = COALESCE(?, password),
            role = COALESCE(?, role),
            camp_name = COALESCE(?, camp_name),
            company_name = COALESCE(?, company_name),
            allowed_camps = COALESCE(?, allowed_camps)
        WHERE id = ?
      `,
      args: [
        newUsername,
        displayName && displayName.trim() ? displayName.trim() : null,
        hashedPassword,
        role ?? null,
        primaryCamp ?? null,
        companyName ?? null,
        allowedCampsStr ?? null,
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
