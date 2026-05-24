import "dotenv-flow/config";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const conn = await mysql.createConnection({ uri: url, multipleStatements: true });

const sql = readFileSync(
  new URL("../src/drizzle/migrations/0011_experience_position_employment_type.sql", import.meta.url),
  "utf8"
);

const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  console.log("Running:", stmt.slice(0, 80));
  try {
    await conn.query(stmt);
    console.log("  OK");
  } catch (err) {
    if (err && err.code === "ER_DUP_FIELDNAME") {
      console.log("  Skipped (column already exists)");
    } else {
      throw err;
    }
  }
}

await conn.end();
console.log("Done.");
