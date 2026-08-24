import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";

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
      sql: "SELECT id, username, role, camp_name FROM sales_persons WHERE username = ? AND password = ?",
      args: [username.trim(), password.trim()],
    });

    if (result.rows.length === 0) {
      // Fallback for default hardcoded operators if DB is fresh
      if (
        (username.trim() === "Fasil@2020" && password.trim() === "1234") ||
        (username.trim() === "Rifai" && password.trim() === "3421")
      ) {
        return NextResponse.json({
          success: true,
          user: {
            username: username.trim(),
            role: "salesperson",
            campName: "All Camps",
          },
        });
      }

      return NextResponse.json(
        { success: false, error: "Invalid operator credentials" },
        { status: 401 }
      );
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      user: {
        id: Number(row.id),
        username: String(row.username),
        role: String(row.role || "salesperson"),
        campName: String(row.camp_name || "All Camps"),
      },
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
