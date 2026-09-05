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
      SELECT 
        sp.id, sp.username, sp.display_name, sp.password, sp.role, sp.camp_name, 
        sp.company_name, sp.company_id, sp.allowed_camps, sp.allowed_router_ids, sp.created_at,
        c.id as resolved_company_id, c.name as resolved_company_name
      FROM sales_persons sp
      LEFT JOIN companies c ON (sp.company_id IS NOT NULL AND c.id = sp.company_id) OR (sp.company_name IS NOT NULL AND LOWER(c.name) = LOWER(sp.company_name))
    `;
    const args: any[] = [];

    if (authUser && authUser.role !== "superadmin") {
      if (authUser.companyId) {
        query += " WHERE (sp.company_id = ? OR LOWER(sp.company_name) = LOWER(?)) ";
        args.push(authUser.companyId, authUser.companyName || "");
      } else if (authUser.companyName) {
        query += " WHERE LOWER(sp.company_name) = LOWER(?) ";
        args.push(authUser.companyName.trim());
      }
    }

    query += " ORDER BY sp.id ASC";
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

      let allowedRouterIds: string[] = [];
      if (row.allowed_router_ids) {
        try {
          allowedRouterIds = JSON.parse(String(row.allowed_router_ids));
        } catch {
          allowedRouterIds = [String(row.allowed_router_ids)];
        }
      }

      const finalCompanyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
      const finalCompanyName = String(row.resolved_company_name || row.company_name || "");

      return {
        id: Number(row.id),
        username: String(row.username),
        displayName: String(row.display_name || row.username),
        password: "••••••••",
        role: String(row.role || "salesperson"),
        campName: String(row.camp_name || (allowedCamps.length > 0 ? allowedCamps.join(", ") : "All Camps")),
        companyId: finalCompanyId,
        companyName: finalCompanyName,
        allowedCamps,
        allowedRouterIds,
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
    const { username, displayName, password, role, campName, companyName, companyId, allowedCamps, allowedRouterIds } = body;

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

    // Resolve company_id if not explicitly provided
    let resolvedCompanyId: number | null = companyId ? Number(companyId) : null;
    let resolvedCompanyName: string | null = companyName ? String(companyName).trim() : null;

    if (!resolvedCompanyId && resolvedCompanyName) {
      const compRes = await database.execute({
        sql: "SELECT id, name FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1",
        args: [resolvedCompanyName],
      });
      if (compRes.rows.length > 0) {
        resolvedCompanyId = Number(compRes.rows[0].id);
        resolvedCompanyName = String(compRes.rows[0].name);
      }
    } else if (resolvedCompanyId && !resolvedCompanyName) {
      const compRes = await database.execute({
        sql: "SELECT name FROM companies WHERE id = ? LIMIT 1",
        args: [resolvedCompanyId],
      });
      if (compRes.rows.length > 0) {
        resolvedCompanyName = String(compRes.rows[0].name);
      }
    }

    const hashedPassword = hashPassword(password.trim());
    const campsArray = Array.isArray(allowedCamps) ? allowedCamps : (campName && campName !== "All Camps" ? [campName] : []);
    const allowedCampsStr = JSON.stringify(campsArray);
    const routerIdsArray = Array.isArray(allowedRouterIds) ? allowedRouterIds : [];
    const allowedRouterIdsStr = JSON.stringify(routerIdsArray);
    const primaryCamp = campsArray.length > 0 ? campsArray[0] : (campName || "All Camps");

    const insertResult = await database.execute({
      sql: `
        INSERT INTO sales_persons (username, display_name, password, role, camp_name, company_name, company_id, allowed_camps, allowed_router_ids) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        username.trim(), 
        (displayName && displayName.trim()) || username.trim(), 
        hashedPassword, 
        role || "salesperson", 
        primaryCamp,
        resolvedCompanyName,
        resolvedCompanyId,
        allowedCampsStr,
        allowedRouterIdsStr,
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

// PUT /api/mikrotik/admin/users (Update username / displayName / password / camp / company / companyId / allowedCamps / allowedRouterIds / role)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, username, displayName, password, role, campName, companyName, companyId, allowedCamps, allowedRouterIds } = body;

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

    let resolvedCompanyId: number | null = companyId !== undefined ? (companyId ? Number(companyId) : null) : null;
    let resolvedCompanyName: string | null = companyName !== undefined ? (companyName ? String(companyName).trim() : null) : null;

    if (companyName && !resolvedCompanyId) {
      const compRes = await database.execute({
        sql: "SELECT id, name FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1",
        args: [companyName.trim()],
      });
      if (compRes.rows.length > 0) {
        resolvedCompanyId = Number(compRes.rows[0].id);
        resolvedCompanyName = String(compRes.rows[0].name);
      }
    } else if (resolvedCompanyId && !resolvedCompanyName) {
      const compRes = await database.execute({
        sql: "SELECT name FROM companies WHERE id = ? LIMIT 1",
        args: [resolvedCompanyId],
      });
      if (compRes.rows.length > 0) {
        resolvedCompanyName = String(compRes.rows[0].name);
      }
    }

    const hashedPassword = password && password.trim() ? hashPassword(password.trim()) : null;
    const campsArray = Array.isArray(allowedCamps) ? allowedCamps : (campName && campName !== "All Camps" ? [campName] : undefined);
    const allowedCampsStr = campsArray !== undefined ? JSON.stringify(campsArray) : undefined;
    const routerIdsArray = Array.isArray(allowedRouterIds) ? allowedRouterIds : undefined;
    const allowedRouterIdsStr = routerIdsArray !== undefined ? JSON.stringify(routerIdsArray) : undefined;
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
            company_id = COALESCE(?, company_id),
            allowed_camps = COALESCE(?, allowed_camps),
            allowed_router_ids = COALESCE(?, allowed_router_ids)
        WHERE id = ?
      `,
      args: [
        newUsername,
        displayName && displayName.trim() ? displayName.trim() : null,
        hashedPassword,
        role ?? null,
        primaryCamp ?? null,
        resolvedCompanyName ?? null,
        resolvedCompanyId ?? null,
        allowedCampsStr ?? null,
        allowedRouterIdsStr ?? null,
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
