import { createClient } from "@libsql/client";
import crypto from "crypto";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.TURSO_DATABASE_URL || "file:vouchers.db";
const dbToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: dbUrl,
  authToken: dbToken,
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

// Helper to ask question in terminal with hidden password typing
function askQuestion(rl, query, isPassword = false) {
  return new Promise((resolve) => {
    if (!isPassword) {
      rl.question(query, (ans) => resolve(ans.trim()));
    } else {
      process.stdout.write(query);
      const stdin = process.stdin;
      const oldRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      stdin.resume();

      let password = "";
      const onData = (char) => {
        char = char.toString("utf8");
        switch (char) {
          case "\n":
          case "\r":
          case "\u0004":
            if (stdin.setRawMode) stdin.setRawMode(oldRaw);
            stdin.removeListener("data", onData);
            process.stdout.write("\n");
            resolve(password.trim());
            break;
          case "\u0003": // Ctrl+C
            if (stdin.setRawMode) stdin.setRawMode(oldRaw);
            stdin.removeListener("data", onData);
            process.exit(1);
            break;
          case "\u007f": // Backspace
          case "\b":
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write("\b \b");
            }
            break;
          default:
            password += char;
            process.stdout.write("*");
            break;
        }
      };

      stdin.on("data", onData);
    }
  });
}

async function main() {
  console.log("\n==================================================");
  console.log(" 🛡️  LinkFi Super Admin Interactive Creator");
  console.log("==================================================");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 1. Username (Mandatory)
    let username = "";
    while (!username) {
      username = await askQuestion(rl, "Enter Username: ");
      if (!username) {
        console.log("❌ Error: Username is mandatory and cannot be empty.\n");
      }
    }

    // 2. Display Name (Mandatory)
    let displayName = "";
    while (!displayName) {
      displayName = await askQuestion(rl, "Enter Display Name: ");
      if (!displayName) {
        console.log("❌ Error: Display Name is mandatory and cannot be empty.\n");
      }
    }

    // 3. Password & Confirm Password (Mandatory & Matching)
    let password = "";
    let confirmPassword = "";
    while (true) {
      password = await askQuestion(rl, "Enter Password: ", true);
      if (!password) {
        console.log("❌ Error: Password is mandatory.\n");
        continue;
      }

      confirmPassword = await askQuestion(rl, "Confirm Password: ", true);
      if (password !== confirmPassword) {
        console.log("❌ Error: Passwords do not match! Please try again.\n");
        continue;
      }

      break;
    }

    console.log("\n⏳ Connecting to database and securing credentials...");

    // 4. Ensure table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Cross-table check for company admins conflict
    const inCompany = await db.execute({
      sql: "SELECT id FROM company_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
      args: [username],
    });

    if (inCompany.rows.length > 0) {
      console.log(`\n❌ Error: The username "${username}" is already in use by a Company Admin. Please choose another username.\n`);
      return;
    }

    // 6. Check if super admin already exists
    const existing = await db.execute({
      sql: "SELECT id, username FROM super_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
      args: [username],
    });

    const hashed = hashPassword(password);

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE super_admins SET password = ?, display_name = ? WHERE id = ?",
        args: [hashed, displayName, existing.rows[0].id],
      });
      console.log(`\n✅ Success: Existing Super Admin "${username}" (ID: ${existing.rows[0].id}) credentials updated successfully!\n`);
    } else {
      const res = await db.execute({
        sql: "INSERT INTO super_admins (username, display_name, password, created_at) VALUES (?, ?, ?, datetime('now'))",
        args: [username, displayName, hashed],
      });
      console.log(`\n✅ Success: New Super Admin "${username}" (ID: ${res.lastInsertRowid}) created successfully with secure scrypt password hashing!\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Operation failed:", err);
  process.exit(1);
});
