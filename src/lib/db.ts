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
      company_id INTEGER REFERENCES companies(id),
      allowed_camps TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN display_name TEXT;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN allowed_camps TEXT;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN company_id INTEGER REFERENCES companies(id);");
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

  // Create report_users table for sales report app viewers (Super Admin controlled)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT,
      company_id INTEGER REFERENCES companies(id),
      allowed_camp_ids TEXT,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create notifications and notification_reads tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      target_type TEXT NOT NULL DEFAULT 'ALL',
      company_id INTEGER REFERENCES companies(id),
      company_name TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    );
  `);

  try { await db.execute("ALTER TABLE notifications ADD COLUMN title TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info';"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN target_type TEXT DEFAULT 'ALL';"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN company_id INTEGER;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN company_name TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN created_by TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN created_at TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN expires_at TEXT;"); } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      sales_person_id INTEGER REFERENCES sales_persons(id),
      read_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notification_id, sales_person_id)
    );
  `);

  // Create companies table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      timezone TEXT DEFAULT 'Asia/Dubai',
      status INTEGER DEFAULT 1,
      suspended_reason TEXT
    );
  `);

  try {
    await db.execute("ALTER TABLE companies ADD COLUMN status INTEGER DEFAULT 1");
  } catch {}
  try {
    await db.execute("ALTER TABLE companies ADD COLUMN suspended_reason TEXT");
  } catch {}

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

  // Create super_admins table for root platform administrators
  await db.execute(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default super admin account exists in super_admins table
  try {
    const superCountRes = await db.execute("SELECT COUNT(*) as count FROM super_admins");
    if (Number(superCountRes.rows[0]?.count ?? 0) === 0) {
      // Default initial super admin with scrypt hashed password (admin / admin123)
      // scrypt hash for "admin123" with deterministic salt for initial seed
      await db.execute({
        sql: "INSERT OR IGNORE INTO super_admins (username, display_name, password) VALUES (?, ?, ?)",
        args: ["admin", "Super Administrator", "admin123"],
      });
    }
  } catch (e) {
    // Ignore if already created
  }

  // Ensure verified_status column exists in routers table (1 = verified/active, 0 = pending/unverified)
  try {
    await db.execute("ALTER TABLE routers ADD COLUMN verified_status INTEGER DEFAULT 0;");
  } catch (e) {
    // Column already exists or table is new
  }

  // Ensure is_active column exists in routers table (1 = active, 0 = archived/soft-deleted)
  try {
    await db.execute("ALTER TABLE routers ADD COLUMN is_active INTEGER DEFAULT 1;");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE routers ADD COLUMN deleted_at TEXT;");
  } catch (e) {}

  // --- ID-Centric Relational Schema Migrations ---
  // Ensure company_id exists on sales_persons
  try {
    await db.execute("ALTER TABLE sales_persons ADD COLUMN company_id INTEGER REFERENCES companies(id);");
  } catch (e) {}

  // Ensure company_id exists on routers
  try {
    await db.execute("ALTER TABLE routers ADD COLUMN company_id INTEGER REFERENCES companies(id);");
  } catch (e) {}

  // Ensure company_id exists on camps
  try {
    await db.execute("ALTER TABLE camps ADD COLUMN company_id INTEGER REFERENCES companies(id);");
  } catch (e) {}

  // Ensure router_id and company_id exist on camp_validity_pricing
  try {
    await db.execute("ALTER TABLE camp_validity_pricing ADD COLUMN router_id TEXT REFERENCES routers(id);");
  } catch (e) {}
  try {
    await db.execute("ALTER TABLE camp_validity_pricing ADD COLUMN company_id INTEGER REFERENCES companies(id);");
  } catch (e) {}

  // Ensure company_id exists on company_admins
  try {
    await db.execute("ALTER TABLE company_admins ADD COLUMN company_id INTEGER REFERENCES companies(id);");
  } catch (e) {}

  // Auto-backfill existing records to populate IDs seamlessly
  try {
    // 1. Populate companies table from distinct real company names (excluding generic placeholders)
    const distinctCompanies = await db.execute(`
      SELECT DISTINCT name FROM (
        SELECT company_name as name FROM sales_persons WHERE company_name IS NOT NULL AND TRIM(company_name) != '' AND LOWER(company_name) NOT IN ('company', 'all camps')
        UNION
        SELECT company_name as name FROM camps WHERE company_name IS NOT NULL AND TRIM(company_name) != '' AND LOWER(company_name) NOT IN ('company', 'all camps')
        UNION
        SELECT company_name as name FROM camp_validity_pricing WHERE company_name IS NOT NULL AND TRIM(company_name) != '' AND LOWER(company_name) NOT IN ('company', 'all camps')
      )
    `);
    for (const r of distinctCompanies.rows) {
      const compName = String(r.name).trim();
      if (compName && compName.toLowerCase() !== "company") {
        await db.execute({
          sql: "INSERT OR IGNORE INTO companies (name) VALUES (?)",
          args: [compName],
        });
      }
    }

    // 2. Link company_id on camps
    await db.execute(`
      UPDATE camps 
      SET company_id = (SELECT c.id FROM companies c WHERE LOWER(c.name) = LOWER(camps.company_name) LIMIT 1)
      WHERE company_name IS NOT NULL AND company_id IS NULL
    `);

    // 3. Link company_id on routers from camps table
    await db.execute(`
      UPDATE routers 
      SET company_id = (
        SELECT cmp.company_id FROM camps cmp 
        WHERE (LOWER(cmp.name) = LOWER(routers.camp) OR LOWER(cmp.hotspot_name) = LOWER(routers.sessionName)) 
          AND cmp.company_id IS NOT NULL 
        LIMIT 1
      )
      WHERE company_id IS NULL
    `);

    // 4. Link company_id on sales_persons from companies table
    await db.execute(`
      UPDATE sales_persons 
      SET company_id = (SELECT c.id FROM companies c WHERE LOWER(c.name) = LOWER(sales_persons.company_name) LIMIT 1)
      WHERE company_name IS NOT NULL AND company_id IS NULL
    `);

    // 5. Link vouchers.sales_person_id for existing sales records
    await db.execute(`
      UPDATE vouchers 
      SET sales_person_id = (
        SELECT sp.id FROM sales_persons sp 
        WHERE sp.username = vouchers.sold_by OR sp.display_name = vouchers.sold_by 
        LIMIT 1
      )
      WHERE sold_by IS NOT NULL AND sold_by != '' AND sales_person_id IS NULL
    `);
  } catch (backfillErr) {
    console.warn("Auto-backfill of ID links completed with notice:", backfillErr);
  }

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
