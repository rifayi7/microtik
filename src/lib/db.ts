import { createClient } from "@libsql/client";
import path from "path";

// Initialize the Turso client
// Falls back to a local file "vouchers.db" if env variables are not provided
const dbUrl = process.env.TURSO_DATABASE_URL || "file:vouchers.db";
const dbToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url: dbUrl,
  authToken: dbToken,
});

let isInitialized = false;

export async function initializeDB() {
  if (isInitialized) return db;

  // Create table matching the existing schema
  await db.execute(`
    CREATE TABLE IF NOT EXISTS vouchers (
      voucher_code TEXT PRIMARY KEY,
      validity_days INTEGER NOT NULL,
      status TEXT DEFAULT 'available',
      reserved_until TEXT,
      used_by TEXT,
      used_at TEXT,
      reserved_at TEXT,
      router_id TEXT NOT NULL,
      sold_by TEXT,
      price_charged REAL,
      activation_status TEXT DEFAULT 'pending',
      activation_error TEXT
    );
  `);

  // Create routers table to store configurations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS routers (
      id TEXT PRIMARY KEY,
      sessionName TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT,
      useTls INTEGER NOT NULL DEFAULT 0,
      hotspotName TEXT,
      dnsName TEXT,
      currency TEXT DEFAULT 'AED',
      camp TEXT,
      sessionTimeout TEXT DEFAULT '30 minutes',
      phone TEXT,
      liveReport INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Ensure sold_by column exists for existing databases
  try {
    await db.execute("ALTER TABLE vouchers ADD COLUMN sold_by TEXT;");
  } catch (e) {
    // Column already exists or table is new
  }

  // Check if seeding is required for default router ID '1' (Disabled for clean database)
  /*
  const checkResult = await db.execute({
    sql: "SELECT COUNT(*) as count FROM vouchers WHERE router_id = ?",
    args: ['1'],
  });
  
  const count = Number(checkResult.rows[0]?.count ?? 0);
  if (count === 0) {
    await seedVouchersForRouter('1');
  }
  */

  // Automatically clean up expired voucher reservations
  try {
    await db.execute(`
      UPDATE vouchers 
      SET status = 'available', reserved_until = NULL 
      WHERE status = 'reserved' 
        AND reserved_until < datetime('now');
    `);
  } catch (err) {
    console.error("Failed to clean up expired reservations:", err);
  }

  isInitialized = true;
  return db;
}

export async function getDB() {
  await initializeDB();
  return db;
}

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function seedVouchersForRouter(routerId: string) {
  const plans = [
    { days: 30, count: 100 },
    { days: 15, count: 50 },
    { days: 10, count: 50 },
    { days: 7, count: 10 },
  ];

  const statements: { sql: string; args: any[] }[] = [];

  for (const plan of plans) {
    for (let i = 0; i < plan.count; i++) {
      const code = generateRandomCode();
      statements.push({
        sql: "INSERT OR IGNORE INTO vouchers (voucher_code, validity_days, status, router_id) VALUES (?, ?, 'available', ?)",
        args: [code, plan.days, routerId],
      });
    }
  }

  try {
    await db.batch(statements, "write");
    console.log(`Database seeded successfully with vouchers for router_id '${routerId}'.`);
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}
