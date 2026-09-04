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
      sales_person_id INTEGER,
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
      liveReport INTEGER NOT NULL DEFAULT 1,
      serialNumber TEXT
    );
  `);

  // Ensure sold_by and sales_person_id columns exist for existing databases
  try {
    await db.execute("ALTER TABLE vouchers ADD COLUMN sold_by TEXT;");
  } catch (e) {
    // Column already exists
  }
  try {
    await db.execute("ALTER TABLE vouchers ADD COLUMN sales_person_id INTEGER REFERENCES sales_persons(id);");
  } catch (e) {
    // Column already exists
  }

  // Ensure serialNumber column exists in routers table
  try {
    await db.execute("ALTER TABLE routers ADD COLUMN serialNumber TEXT;");
  } catch (e) {
    // Column already exists or table is new
  }

  // Create sales_persons table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'salesperson',
      camp_name TEXT DEFAULT 'All Camps',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN display_name TEXT;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN company_name TEXT;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN allowed_camps TEXT;");
  } catch (e) {
    // Column already exists
  }

  // Create company_admins table for company tenant accounts
  await db.execute(`
    CREATE TABLE IF NOT EXISTS company_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      company_name TEXT NOT NULL,
      role TEXT DEFAULT 'company_admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create companies table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Create camps table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS camps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      company_name TEXT,
      hotspot_name TEXT,
      strength INTEGER DEFAULT 500
    );
  `);

  // Create validity_profiles table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS validity_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Create camp_validity_pricing table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS camp_validity_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camp_name TEXT NOT NULL,
      validity_name TEXT NOT NULL,
      company_name TEXT,
      price REAL NOT NULL,
      status INTEGER DEFAULT 1,
      UNIQUE(camp_name, validity_name)
    );
  `);

  // Ensure default admin & salesperson accounts exist if users table is empty
  try {
    const userCountRes = await db.execute("SELECT COUNT(*) as count FROM users");
    if (Number(userCountRes.rows[0]?.count ?? 0) === 0) {
      await db.batch([
        { sql: "INSERT OR IGNORE INTO users (username, password, role, camp_name) VALUES (?, ?, ?, ?)", args: ["admin", "admin123", "admin", "All Camps"] },
        { sql: "INSERT OR IGNORE INTO users (username, password, role, camp_name) VALUES (?, ?, ?, ?)", args: ["Fasil@2020", "1234", "salesperson", "camp2"] },
        { sql: "INSERT OR IGNORE INTO users (username, password, role, camp_name) VALUES (?, ?, ?, ?)", args: ["Rifai", "3421", "salesperson", "camp3"] },
      ], "write");
    }
  } catch (e) {
    // Ignore if already seeded
  }

  // Ensure verified_status column exists in routers table (1 = verified/active, 0 = pending/unverified)
  try {
    await db.execute("ALTER TABLE routers ADD COLUMN verified_status INTEGER DEFAULT 0;");
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
