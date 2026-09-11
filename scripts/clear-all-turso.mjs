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

async function clearAll() {
  console.log('Connecting to Turso to fetch all tables...');
  const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_libsql_%'");
  const tableNames = tablesRes.rows.map(r => String(r.name));
  console.log('Found tables:', tableNames);

  for (const t of tableNames) {
    try {
      await client.execute(`DELETE FROM "${t}"`);
      console.log(`Cleared 100% data from: ${t}`);
    } catch(e) {
      console.log(`Error clearing ${t}:`, e.message);
    }
  }

  // Ensure default superadmin exists so user can log into web portal
  try {
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hashed = crypto.scryptSync('admin123', salt, 64).toString('hex');
    const passwordHash = `scrypt:${salt}:${hashed}`;

    await client.execute({
      sql: 'INSERT INTO super_admins (id, username, display_name, password) VALUES (1, ?, ?, ?)',
      args: ['admin', 'Super Administrator', passwordHash]
    });
    console.log('Recreated default super admin: admin / admin123');
  } catch(e) {
    console.log('Note on super admin setup:', e.message);
  }

  // Seed standard default validity profiles
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

  console.log('\n✨ ALL Turso tables and data have been completely wiped clean!');
}

clearAll();
