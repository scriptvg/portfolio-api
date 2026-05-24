import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL ?? process.argv[2];
if (!url) {
  console.error("Provide DATABASE_URL");
  process.exit(1);
}
const LEGACY = "20416285-c56d-41f1-8333-49f31e0c842c";
const SLUG = "nextjs";

const conn = await mysql.createConnection(url);
await conn.beginTransaction();
try {
  const [existing] = await conn.execute(
    "SELECT id FROM technologies WHERE id = ?",
    [SLUG]
  );
  if (existing.length > 0) {
    console.log(`${SLUG} already exists, aborting`);
    await conn.rollback();
    process.exit(0);
  }

  await conn.execute(
    `INSERT INTO technologies (id, name, icon, color)
     SELECT ?, name, icon, color FROM technologies WHERE id = ?`,
    [SLUG, LEGACY]
  );

  await conn.execute(
    `INSERT IGNORE INTO experience_technologies (experienceId, technologyId)
     SELECT experienceId, ? FROM experience_technologies WHERE technologyId = ?`,
    [SLUG, LEGACY]
  );
  await conn.execute(
    "DELETE FROM experience_technologies WHERE technologyId = ?",
    [LEGACY]
  );

  await conn.execute(
    `INSERT IGNORE INTO project_technologies (projectId, technologyId)
     SELECT projectId, ? FROM project_technologies WHERE technologyId = ?`,
    [SLUG, LEGACY]
  );
  await conn.execute(
    "DELETE FROM project_technologies WHERE technologyId = ?",
    [LEGACY]
  );

  await conn.execute("DELETE FROM technologies WHERE id = ?", [LEGACY]);
  await conn.commit();
  console.log(`Renamed ${LEGACY} -> ${SLUG}`);
} catch (error) {
  await conn.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await conn.end();
}
