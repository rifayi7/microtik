import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { verifyPassword, hashPassword, needsRehash, signJwt } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// POST /api/mikrotik/auth/login (Mobile App & Web Operator login against DB)
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

    const database = await getDB();
    const result = await database.execute({
      sql: `
        SELECT 
          sp.id, sp.username, sp.password, sp.display_name, sp.role,
          sp.company_id, sp.allowed_camps,
          c.id as resolved_company_id, c.name as resolved_company_name,
          COALESCE(c.timezone, 'Asia/Dubai') as company_timezone,
          COALESCE(c.status, 1) as company_status,
          c.suspended_reason
        FROM sales_persons sp
        LEFT JOIN companies c ON sp.company_id IS NOT NULL AND c.id = sp.company_id
        WHERE LOWER(sp.username) = LOWER(?) OR LOWER(sp.display_name) = LOWER(?) 
        LIMIT 1
      `,
      args: [username.trim(), username.trim()],
    });

    if (result.rows.length === 0) {
      // Fallback for default hardcoded operators if DB is fresh
      if (
        (username.trim() === "Fasil@2020" && password.trim() === "1234") ||
        (username.trim() === "Rifai" && password.trim() === "3421")
      ) {
        const user = {
          id: 0,
          username: username.trim(),
          displayName: username.trim() === "Fasil@2020" ? "Fasil" : "Rifai",
          role: "salesperson" as const,
          campName: "All Camps",
          companyId: null,
          companyName: "",
          companyTimezone: "Asia/Dubai",
          allowedCamps: [] as string[],
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
      }

      return NextResponse.json(
        { success: false, error: "Invalid operator credentials" },
        { status: 401 }
      );
    }

    const row = result.rows[0];
    const storedPassword = String(row.password || "");

    // Securely verify password (supports modern scrypt hash and legacy fallback)
    const isPasswordValid = verifyPassword(password.trim(), storedPassword);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid operator credentials" },
        { status: 401 }
      );
    }

    // Check if company account is paused/suspended due to dues
    if (row.company_status !== undefined && Number(row.company_status) === 0) {
      const reason = row.suspended_reason ? String(row.suspended_reason) : "Account temporarily suspended due to outstanding dues. Please contact your administrator.";
      return NextResponse.json(
        { success: false, error: reason, isSuspended: true },
        { status: 403 }
      );
    }

    // Auto-upgrade legacy plain-text password to scrypt hash on first successful login
    if (needsRehash(storedPassword)) {
      try {
        const secureHash = hashPassword(password.trim());
        await database.execute({
          sql: "UPDATE sales_persons SET password = ? WHERE id = ?",
          args: [secureHash, Number(row.id)],
        });
      } catch (rehashErr) {
        console.warn("Failed to auto-upgrade password hash:", rehashErr);
      }
    }

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

    const finalCompanyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
    const finalCompanyName = String(row.resolved_company_name || row.company_name || "");
    const finalCompanyTimezone = String(row.company_timezone || "Asia/Dubai");

    const user = {
      id: Number(row.id),
      username: String(row.username),
      displayName: String(row.display_name || row.username),
      role: String(row.role || "salesperson"),
      campName: String(row.camp_name || (allowedCamps.length > 0 ? allowedCamps[0] : "All Camps")),
      companyId: finalCompanyId,
      companyName: finalCompanyName,
      companyTimezone: finalCompanyTimezone,
      allowedCamps,
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
    return mikrotikErrorResponse(error, "Authentication check failed");
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
