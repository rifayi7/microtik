import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/auth-crypto";

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
      return NextResponse.json({
        success: true,
        user: {
          id: 0,
          username: "admin",
          displayName: "Super Administrator",
          role: "superadmin",
          companyName: null,
          allowedCamps: [],
        },
      });
    }

    // 2. Company Admin Authentication Check against company_admins table
    const database = await getDB();
    const result = await database.execute({
      sql: "SELECT id, username, password, company_name, role FROM company_admins WHERE username = ?",
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

    // Fetch camps assigned to this company
    const compName = String(row.company_name || "");
    const campsResult = await database.execute({
      sql: "SELECT name FROM camps WHERE company_name = ?",
      args: [compName],
    });
    const companyCamps = campsResult.rows.map((r) => String(r.name));

    return NextResponse.json({
      success: true,
      user: {
        id: Number(row.id),
        username: String(row.username),
        displayName: compName + " Admin",
        role: "company_admin",
        companyName: compName,
        allowedCamps: companyCamps,
      },
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
