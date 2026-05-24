import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL ?? process.argv[2];
if (!url) {
  console.error("Provide DATABASE_URL");
  process.exit(1);
}
const conn = await mysql.createConnection(url);

// Find UUID-style duplicates (legacy rows with the same name as a slug-id row).
const [rows] = await conn.execute(`
  SELECT t1.id AS legacy_id, t1.name, t1.icon, t1.color,
         t2.id AS keep_id, t2.icon AS keep_icon, t2.color AS keep_color
  FROM technologies t1
  JOIN technologies t2
    ON t1.name = t2.name AND t1.id <> t2.id
  WHERE LENGTH(t1.id) = 36 AND t1.id LIKE '%-%-%-%-%'
    AND NOT (LENGTH(t2.id) = 36 AND t2.id LIKE '%-%-%-%-%')
`);

const [projectFk] = await conn.execute(
  "SELECT technologyId, COUNT(*) AS n FROM project_technologies GROUP BY technologyId"
);
const [experienceFk] = await conn.execute(
  "SELECT technologyId, COUNT(*) AS n FROM experience_technologies GROUP BY technologyId"
);

const projectMap = Object.fromEntries(projectFk.map(r => [r.technologyId, r.n]));
const experienceMap = Object.fromEntries(experienceFk.map(r => [r.technologyId, r.n]));

console.log(JSON.stringify(
  rows.map(r => ({
    ...r,
    projectRefs: projectMap[r.legacy_id] ?? 0,
    experienceRefs: experienceMap[r.legacy_id] ?? 0,
    projectRefsKeep: projectMap[r.keep_id] ?? 0,
    experienceRefsKeep: experienceMap[r.keep_id] ?? 0,
  })),
  null,
  2
));
await conn.end();
