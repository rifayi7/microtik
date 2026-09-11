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
  const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_libsql_%'");
  console.log('=== ALL TABLES IN TURSO ===');
  for (const r of tablesRes.rows) {
    const t = String(r.name);
    try {
      const countRes = await client.execute(`SELECT COUNT(*) as cnt FROM "${t}"`);
      const cnt = Number(countRes.rows[0].cnt);
      console.log(`\nTable: [${t}] (${cnt} rows)`);
      if (cnt > 0) {
        const sample = await client.execute(`SELECT * FROM "${t}" LIMIT 5`);
        console.log(JSON.stringify(sample.rows, null, 2));
      }
    } catch(e) {
      console.log(`Table [${t}] Error:`, e.message);
    }
  }
}

main();
