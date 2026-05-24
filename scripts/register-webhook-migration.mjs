import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? process.argv[2];
const sqlPath = "src/drizzle/migrations/0008_remarkable_bucky.sql";
const sql = readFileSync(sqlPath, "utf8");
const hash = createHash("sha256").update(sql).digest("hex");

const conn = await mysql.createConnection(url);
const [existing] = await conn.query(
  "SELECT id FROM __drizzle_migrations WHERE hash = ?",
  [hash]
);
if (existing.length > 0) {
  console.log("Already registered:", hash);
} else {
  await conn.execute(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    [hash, Date.now()]
  );
  console.log("Registered hash:", hash);
}
await conn.end();
