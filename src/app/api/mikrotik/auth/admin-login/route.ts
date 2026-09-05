import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { verifyPassword, hashPassword, needsRehash, signJwt } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// POST /api/mikrotik/auth/admin-login
// Authenticates Super Admin (admin / admin123) and Company Admins (company_admins table)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    // 1. Super Admin Authentication Check
    if (trimmedUser.toLowerCase() === "admin" && trimmedPass === "admin123") {
      const user = {
        id: 0,
        username: "admin",
        displayName: "Super Administrator",
        role: "superadmin" as const,
        companyName: null,
        allowedCamps: [],
      };

      const token = signJwt({
        sub: user.username,
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        companyName: user.companyName,
        allowedCamps: user.allowedCamps,
      });

      return NextResponse.json({
        success: true,
        user,
        token,
      });
    }

    // 2. Company Admin Authentication Check against company_admins table
    const database = await getDB();
    const result = await database.execute({
      sql: `
        SELECT 
          ca.id, ca.username, ca.password, ca.company_name, ca.company_id, ca.role,
          c.id as resolved_company_id, c.name as resolved_company_name
        FROM company_admins ca
        LEFT JOIN companies c ON (ca.company_id IS NOT NULL AND c.id = ca.company_id) OR (ca.company_name IS NOT NULL AND LOWER(c.name) = LOWER(ca.company_name))
        WHERE ca.username = ?
        LIMIT 1
      `,
      args: [trimmedUser],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const row = result.rows[0];
    const storedPassword = String(row.password || "");

    const isPasswordValid = verifyPassword(trimmedPass, storedPassword);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Auto-upgrade password hash if needed
    if (needsRehash(storedPassword)) {
      try {
        const secureHash = hashPassword(trimmedPass);
        await database.execute({
          sql: "UPDATE company_admins SET password = ? WHERE id = ?",
          args: [secureHash, Number(row.id)],
        });
      } catch (err) {
        console.warn("Failed to auto-upgrade company admin password hash:", err);
      }
    }

    const resolvedCompanyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
    const compName = String(row.resolved_company_name || row.company_name || "");

    // Fetch camps assigned to this company (by ID or name)
    const campsResult = await database.execute({
      sql: "SELECT name FROM camps WHERE (company_id IS NOT NULL AND company_id = ?) OR (company_name IS NOT NULL AND LOWER(company_name) = LOWER(?))",
      args: [resolvedCompanyId ?? -1, compName],
    });
    const companyCamps = campsResult.rows.map((r) => String(r.name));

    const user = {
      id: Number(row.id),
      username: String(row.username),
      displayName: compName ? `${compName} Admin` : "Company Admin",
      role: "company_admin" as const,
      companyId: resolvedCompanyId,
      companyName: compName,
      allowedCamps: companyCamps,
    };

    const token = signJwt({
      sub: user.username,
      userId: user.id,
      displayName: user.displayName,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      allowedCamps: user.allowedCamps,
    });

    return NextResponse.json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    return mikrotikErrorResponse(error, "Admin login authentication failed");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
