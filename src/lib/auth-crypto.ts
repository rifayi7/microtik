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
  userId?: number;
  displayName?: string;
  role: "superadmin" | "company_admin" | "salesperson" | string;
  companyName?: string | null;
  allowedCamps?: string[];
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
