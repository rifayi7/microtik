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

async function clearValidityProfiles() {
  await client.execute("DELETE FROM validity_profiles");
  console.log("Cleared all rows from validity_profiles table.");

  const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_libsql_%'");
  console.log('\n=== CURRENT ROW COUNTS IN TURSO ===');
  for (const r of tablesRes.rows) {
    const t = String(r.name);
    try {
      const countRes = await client.execute(`SELECT COUNT(*) as cnt FROM "${t}"`);
      console.log(`${t}: ${countRes.rows[0].cnt} rows`);
    } catch(e) {
      console.log(`${t}: ${e.message}`);
    }
  }
}

clearValidityProfiles();
