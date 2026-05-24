import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL ?? process.argv[2];
const conn = await mysql.createConnection(url);
const [tables] = await conn.query(
  "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE '%migration%' OR TABLE_NAME LIKE '%drizzle%'"
);
console.log("meta tables:", tables);
for (const t of tables) {
  const [rows] = await conn.query(`SELECT * FROM \`${t.TABLE_NAME}\``);
  console.log(`\n${t.TABLE_NAME}:`);
  console.log(rows);
}
await conn.end();
