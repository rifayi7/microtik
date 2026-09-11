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
  try {
    await client.execute('ALTER TABLE camp_validity_pricing ADD COLUMN unit REAL DEFAULT 1.0');
    console.log('✅ Added unit column to camp_validity_pricing');
  } catch(e) {
    console.log('Column note:', e.message);
  }

  const tableInfo = await client.execute("PRAGMA table_info('camp_validity_pricing')");
  console.log('camp_validity_pricing columns:', tableInfo.rows.map(r => r.name));
}

main();
