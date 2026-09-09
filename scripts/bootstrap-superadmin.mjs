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
  console.log(" 🛡️  LinkFi Super Admin CLI Management Tool");
  console.log("==================================================");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Ensure table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Ask for Username first
    let username = "";
    while (!username) {
      username = await askQuestion(rl, "\nEnter Super Admin Username: ");
      if (!username) {
        console.log("❌ Error: Username is mandatory and cannot be empty.");
      }
    }

    // 2. Cross-table check against company admins
    const inCompany = await db.execute({
      sql: "SELECT id, company_name FROM company_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
      args: [username],
    });

    if (inCompany.rows.length > 0) {
      console.log(`\n❌ Conflict Error: The username "${username}" is already assigned to a Company Admin for "${inCompany.rows[0].company_name}".`);
      console.log("   Please choose a different username.\n");
      return;
    }

    // 3. Check if Super Admin already exists in DB
    const existing = await db.execute({
      sql: "SELECT id, username, display_name FROM super_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
      args: [username],
    });

    const isUpdating = existing.rows.length > 0;
    let existingRecord = isUpdating ? existing.rows[0] : null;

    if (isUpdating) {
      console.log(`\n🔍 Found existing Super Admin account!`);
      console.log(`   ID:           #${existingRecord.id}`);
      console.log(`   Username:     ${existingRecord.username}`);
      console.log(`   Display Name: ${existingRecord.display_name}`);
      console.log(`\n⚠️  You are about to UPDATE the credentials for this existing Super Admin.`);

      const confirmUpdate = await askQuestion(rl, "Do you want to proceed with updating this account? (y/n): ");
      if (confirmUpdate.toLowerCase() !== "y" && confirmUpdate.toLowerCase() !== "yes") {
        console.log("❌ Operation cancelled by user.\n");
        return;
      }
    } else {
      console.log(`\n✨ Username "${username}" is available!`);
      console.log(`🆕 Creating a NEW Super Administrator account.`);
    }

    // 4. Prompt for Display Name
    let displayName = "";
    if (isUpdating) {
      const defaultName = String(existingRecord.display_name || existingRecord.username);
      const inputName = await askQuestion(rl, `\nEnter Display Name [Press Enter to keep "${defaultName}"]: `);
      displayName = inputName ? inputName : defaultName;
    } else {
      while (!displayName) {
        displayName = await askQuestion(rl, "\nEnter Display Name: ");
        if (!displayName) {
          console.log("❌ Error: Display Name is mandatory and cannot be empty.");
        }
      }
    }

    // 5. Prompt for Password & Confirmation
    let password = "";
    while (true) {
      password = await askQuestion(rl, isUpdating ? "Enter New Password: " : "Enter Password: ", true);
      if (!password) {
        console.log("❌ Error: Password is mandatory and cannot be empty.\n");
        continue;
      }

      const confirmPassword = await askQuestion(rl, isUpdating ? "Confirm New Password: " : "Confirm Password: ", true);
      if (password !== confirmPassword) {
        console.log("❌ Error: Passwords do not match! Please try again.\n");
        continue;
      }

      break;
    }

    console.log("\n⏳ Hashing password with scrypt and saving to database...");
    const hashed = hashPassword(password);

    if (isUpdating) {
      await db.execute({
        sql: "UPDATE super_admins SET password = ?, display_name = ? WHERE id = ?",
        args: [hashed, displayName, existingRecord.id],
      });
      console.log(`\n✅ Success: Super Admin "${existingRecord.username}" (ID: ${existingRecord.id}) has been UPDATED successfully!\n`);
    } else {
      const res = await db.execute({
        sql: "INSERT INTO super_admins (username, display_name, password, created_at) VALUES (?, ?, ?, datetime('now'))",
        args: [username, displayName, hashed],
      });
      console.log(`\n✅ Success: New Super Admin "${username}" (ID: ${res.lastInsertRowid}) has been CREATED successfully!\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Operation failed:", err);
  process.exit(1);
});
