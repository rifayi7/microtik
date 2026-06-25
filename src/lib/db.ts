import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

let dbInstance: DatabaseSync | null = null;

export function getDB(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(process.cwd(), "vouchers.db");
  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrency and set a busy timeout
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA busy_timeout = 5000;");

  // Create table matching the existing schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      voucher_code TEXT PRIMARY KEY,
      validity_days INTEGER NOT NULL,
      is_used INTEGER DEFAULT 0,
      used_by TEXT,
      used_at TEXT,
      reserved_at TEXT,
      status TEXT DEFAULT 'available',
      router_id TEXT NOT NULL
    );
  `);

  // Check if seeding is required for default router ID '1'
  const checkStmt = dbInstance.prepare("SELECT COUNT(*) as count FROM vouchers WHERE router_id = '1'");
  const countRow = checkStmt.get() as { count: number };
  if (countRow.count === 0) {
    seedVouchersForRouter(dbInstance, '1');
  }

  return dbInstance;
}

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function seedVouchersForRouter(db: DatabaseSync, routerId: string) {
  const plans = [
    { days: 30, count: 100 },
    { days: 15, count: 50 },
    { days: 10, count: 50 },
    { days: 7, count: 10 },
  ];

  const stmt = db.prepare(`
    INSERT INTO vouchers (voucher_code, validity_days, is_used, status, router_id)
    VALUES (?, ?, 0, 'available', ?)
  `);

  for (const plan of plans) {
    for (let i = 0; i < plan.count; i++) {
      let code = generateRandomCode();
      let inserted = false;
      while (!inserted) {
        try {
          stmt.run(code, plan.days, routerId);
          inserted = true;
        } catch {
          code = generateRandomCode();
        }
      }
    }
  }
  console.log(`Database seeded successfully with vouchers for router_id '${routerId}'.`);
}
