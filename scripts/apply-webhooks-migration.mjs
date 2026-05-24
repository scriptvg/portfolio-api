import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? process.argv[2];
if (!url) {
  console.error("Provide DATABASE_URL");
  process.exit(1);
}
const sqlPath =
  "src/drizzle/migrations/0008_remarkable_bucky.sql";
const sql = readFileSync(sqlPath, "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const conn = await mysql.createConnection({
  uri: url,
  multipleStatements: false,
});

let applied = 0;
try {
  for (const stmt of statements) {
    console.log("→", stmt.slice(0, 80).replace(/\s+/g, " "));
    await conn.query(stmt);
    applied += 1;
  }
  console.log(`\nApplied ${applied}/${statements.length} statements.`);
} catch (e) {
  console.error(`\nFailed at statement ${applied + 1}:`, e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
