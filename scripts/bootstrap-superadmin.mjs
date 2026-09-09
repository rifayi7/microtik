import { createClient } from "@libsql/client";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.TURSO_DATABASE_URL || "file:vouchers.db";
const dbToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: dbUrl,
  authToken: dbToken,
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
  const args = process.argv.slice(2);
  let username = "admin";
  let password = "admin123";
  let displayName = "Super Administrator";

  for (const arg of args) {
    if (arg.startsWith("--user=")) username = arg.split("=")[1].trim();
    if (arg.startsWith("--pass=")) password = arg.split("=")[1].trim();
    if (arg.startsWith("--name=")) displayName = arg.split("=")[1].trim();
  }

  console.log(`\n?? Initializing Super Admin Bootstrap Script...`);
  console.log(`Database URL: ${dbUrl}`);

  // 1. Ensure table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Check if username already exists
  const existing = await db.execute({
    sql: "SELECT id, username FROM super_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
    args: [username],
  });

  const hashed = hashPassword(password);

  if (existing.rows.length > 0) {
    console.log(`?? Super Admin "${username}" already exists (ID: ${existing.rows[0].id}). Updating password hash...`);
    await db.execute({
      sql: "UPDATE super_admins SET password = ?, display_name = ? WHERE id = ?",
      args: [hashed, displayName, existing.rows[0].id],
    });
    console.log(`? Super Admin "${username}" credentials updated successfully!\n`);
  } else {
    const res = await db.execute({
      sql: "INSERT INTO super_admins (username, display_name, password, created_at) VALUES (?, ?, ?, datetime('now'))",
      args: [username, displayName, hashed],
    });
    console.log(`? Super Admin "${username}" (ID: ${res.lastInsertRowid}) created successfully with secure scrypt password hash!\n`);
  }
}

main().catch((err) => {
  console.error("? Bootstrap failed:", err);
  process.exit(1);
});
