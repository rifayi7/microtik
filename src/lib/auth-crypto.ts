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
