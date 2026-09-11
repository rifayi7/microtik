import fs from 'fs';
import path from 'path';
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
  const tables = [
    'vouchers',
    'recharge_history',
    'payments',
    'expenses',
    'notifications',
    'camp_validity_pricing',
    'routers',
    'camps',
    'sales_persons',
    'company_admins',
    'report_users',
    'super_admins',
    'companies',
    'validity_profiles'
  ];

  console.log('--- Current Table Counts ---');
  for (const t of tables) {
    try {
      const res = await client.execute(`SELECT COUNT(*) as cnt FROM ${t}`);
      console.log(`${t}: ${res.rows[0].cnt}`);
    } catch(e) {
      console.log(`${t}: ${e.message}`);
    }
  }

  console.log('\n--- Clearing Operational & Transaction Tables ---');
  const tablesToClear = [
    'vouchers',
    'recharge_history',
    'payments',
    'expenses',
    'notifications',
    'camp_validity_pricing',
    'routers',
    'camps',
    'sales_persons',
    'company_admins',
    'report_users'
  ];

  for (const t of tablesToClear) {
    try {
      await client.execute(`DELETE FROM ${t}`);
      console.log(`Cleared: ${t}`);
    } catch(e) {
      console.log(`Failed to clear ${t}: ${e.message}`);
    }
  }

  // Ensure default validity profiles exist
  const defaultVps = [
    { name: '30-Days', weight: 1.0 },
    { name: '15-Days', weight: 0.5 },
    { name: '7-Days', weight: 0.25 },
    { name: '10-Days', weight: 0.33 },
    { name: '1-Day', weight: 0.033 }
  ];
  for (const vp of defaultVps) {
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO validity_profiles (name, unit_weight) VALUES (?, ?)',
        args: [vp.name, vp.weight]
      });
    } catch(e) {}
  }

  console.log('\n--- Preserved Companies ---');
  const compRes = await client.execute('SELECT id, name, timezone FROM companies ORDER BY id ASC');
  compRes.rows.forEach(r => console.log(`ID: ${r.id} | Name: ${r.name} | Timezone: ${r.timezone}`));

  console.log('\n--- Preserved Super Admins ---');
  const adminRes = await client.execute('SELECT id, username, display_name FROM super_admins ORDER BY id ASC');
  adminRes.rows.forEach(r => console.log(`ID: ${r.id} | Username: ${r.username}`));

  console.log('\n✅ Turso database operational data cleared successfully!');
}

main();
