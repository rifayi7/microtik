import fs from 'fs';
import { createClient } from '@libsql/client';

const envPath = 'C:/Users/User/Documents/microtik/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  await client.execute("DROP TABLE IF EXISTS camp_validity_pricing");
  await client.execute(`
    CREATE TABLE camp_validity_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id),
      router_id TEXT REFERENCES routers(id),
      validity INTEGER NOT NULL,
      price REAL NOT NULL,
      unit REAL NOT NULL DEFAULT 1.0,
      status INTEGER DEFAULT 1,
      UNIQUE(router_id, validity)
    )
  `);
  console.log("✅ Recreated camp_validity_pricing table with clean schema:");
  const info = await client.execute("PRAGMA table_info('camp_validity_pricing')");
  console.log(info.rows);
}

main();
