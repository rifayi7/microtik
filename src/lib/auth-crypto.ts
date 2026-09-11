import crypto from "crypto";

/**
 * Securely hashes a plain-text password using Node.js native scrypt with a unique cryptographic salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plain-text password against a stored password.
 * Supports both modern scrypt hashes and legacy plain-text (with automatic fallback).
 */
export function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain || !password) return false;

  // 1. Verify modern scrypt hash
  if (storedHashOrPlain.startsWith("scrypt:")) {
    try {
      const parts = storedHashOrPlain.split(":");
      if (parts.length !== 3) return false;
      const [, salt, key] = parts;
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const keyBuffer = Buffer.from(key, "hex");
      return crypto.timingSafeEqual(derivedKey, keyBuffer);
    } catch {
      return false;
    }
  }

  // 2. Backwards-compatible legacy check for old plain-text entries
  return password === storedHashOrPlain;
}

/**
 * Returns true if the stored password is still in legacy plain-text format and needs an upgrade.
 */
export function needsRehash(storedPassword: string): boolean {
  return !storedPassword.startsWith("scrypt:");
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT (JSON Web Token) Token-based Authentication & Verification
// ─────────────────────────────────────────────────────────────────────────────

export interface JwtAuthPayload {
  sub: string; // username or user id
  userId?: string | number;
  displayName?: string;
  role: "superadmin" | "company_admin" | "salesperson" | string;
  companyId?: string | number | null;
  companyName?: string | null;
  allowedCamps?: string[];
  allowedRouterIds?: string[];
  sessionId?: string; // unique session ID for single-device concurrency control
  iat?: number;
  exp?: number;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.TURSO_AUTH_TOKEN || "smartwifi-super-secure-token-secret-2026";
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Signs a payload into an HMAC-SHA256 JWT Token with 30-day default expiration.
 */
export function signJwt(payload: Omit<JwtAuthPayload, "iat" | "exp">, expiresInSeconds = 30 * 24 * 60 * 60): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtAuthPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 JWT Token.
 * Returns the decoded payload if valid and not expired, or null if invalid/tampered.
 */
export function verifyJwt(token: string): JwtAuthPayload | null {
  if (!token || typeof token !== "string") return null;

  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac("sha256", getJwtSecret())
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const sigBuffer = Buffer.from(signature);
    const expSigBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expSigBuffer)) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson) as JwtAuthPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies JWT from an incoming Next.js Request Authorization header.
 */
export function extractAuthToken(request: Request): JwtAuthPayload | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return verifyJwt(token);
}

/**
 * Validates that the request contains a valid JWT token and is not paused/suspended.
 * Returns { user: JwtAuthPayload } or a ready-to-return 401/403 NextResponse.
 */
export async function requireAuth(
  request: Request,
  db?: any
): Promise<{ user: JwtAuthPayload; errorResponse?: never } | { user?: never; errorResponse: Response }> {
  const user = extractAuthToken(request);
  if (!user) {
    const { NextResponse } = await import("next/server");
    return {
      errorResponse: NextResponse.json(
        { error: "Authentication required. Please log in.", requiresAuth: true },
        { status: 401 }
      ),
    };
  }

  // If user is a salesperson, verify single-device concurrency (kick out previous device)
  if (user.role === "salesperson" && user.userId && db) {
    try {
      const spRes = await db.execute({
        sql: "SELECT active_session_token FROM sales_persons WHERE id = ? LIMIT 1",
        args: [user.userId],
      });
      if (spRes.rows.length > 0) {
        const currentActiveToken = spRes.rows[0].active_session_token ? String(spRes.rows[0].active_session_token) : null;
        if (currentActiveToken && user.sessionId && currentActiveToken !== user.sessionId) {
          const { NextResponse } = await import("next/server");
          return {
            errorResponse: NextResponse.json(
              {
                error: "You have been logged out because this account logged in on another device.",
                errorCode: "SESSION_EXPIRED_OTHER_DEVICE",
                isSessionReplaced: true,
              },
              { status: 401 }
            ),
          };
        }
      }
    } catch {
      // Allow proceeding if check fails transiently
    }
  }

  // If user is company-bound or salesperson, check company suspension status
  if (user.role !== "superadmin" && user.companyId && db) {
    try {
      const compRes = await db.execute({
        sql: "SELECT status, suspended_reason FROM companies WHERE id = ? LIMIT 1",
        args: [user.companyId],
      });
      if (compRes.rows.length > 0 && Number(compRes.rows[0].status) === 0) {
        const { NextResponse } = await import("next/server");
        return {
          errorResponse: NextResponse.json(
            {
              error: `Company account is suspended: ${compRes.rows[0].suspended_reason || "Paused by administrator"}`,
              isSuspended: true,
            },
            { status: 403 }
          ),
        };
      }
    } catch {
      // Allow proceeding if company check fails transiently
    }
  }

  return { user };
}

