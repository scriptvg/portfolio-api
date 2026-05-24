/**
 * Aplica 0007_projects.sql si las tablas aún no existen.
 * Uso: pnpm exec tsx scripts/apply-0007-projects.ts
 */
import "dotenv-flow/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL missing");
}

const migrationPath = "src/drizzle/migrations/0007_projects.sql";
const sqlFile = readFileSync(migrationPath, "utf8");
const hash = createHash("sha256").update(sqlFile).digest("hex");

const conn = await mysql.createConnection(url);

try {
  const [existing] = await conn.query<{ hash: string }[]>(
    "SELECT hash FROM __drizzle_migrations WHERE hash = ? LIMIT 1",
    [hash]
  );

  if (existing.length > 0) {
    console.log("Migration 0007_projects already recorded.");
    process.exit(0);
  }

  const [tables] = await conn.query("SHOW TABLES LIKE 'projects'");
  if (Array.isArray(tables) && tables.length > 0) {
    console.log("Table projects already exists; recording migration only.");
    await conn.query(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [hash, Date.now()]
    );
    process.exit(0);
  }

  const statements = sqlFile
    .split("--> statement-breakpoint")
    .map(part => part.trim())
    .filter(Boolean);

  await conn.beginTransaction();
  for (const statement of statements) {
    await conn.query(statement);
  }
  await conn.query(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    [hash, Date.now()]
  );
  await conn.commit();

  console.log("Applied 0007_projects successfully.");
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  await conn.end();
}
