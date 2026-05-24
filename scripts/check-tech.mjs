import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL ?? process.argv[2];
if (!url) {
  console.error("Provide DATABASE_URL as env or first arg");
  process.exit(1);
}
const conn = await mysql.createConnection(url);
const [rows] = await conn.execute(
  "SELECT id, name, icon, color, createdAt FROM technologies ORDER BY name, createdAt"
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
