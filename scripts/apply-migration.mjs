import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? process.argv[2];
const sqlPath = process.argv[3];
if (!url || !sqlPath) {
  console.error("Usage: node apply-migration.mjs <DATABASE_URL> <SQL_PATH>");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const conn = await mysql.createConnection({ uri: url });
try {
  for (const stmt of statements) {
    console.log("→", stmt.slice(0, 80).replace(/\s+/g, " "));
    await conn.query(stmt);
  }
  const hash = createHash("sha256").update(sql).digest("hex");
  const [existing] = await conn.query(
    "SELECT id FROM __drizzle_migrations WHERE hash = ?",
    [hash]
  );
  if (existing.length === 0) {
    await conn.execute(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [hash, Date.now()]
    );
    console.log("Registered hash:", hash);
  }
  console.log("Done.");
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
