/**
 * One-off cleanup:
 * 1. Repoint experience_technologies / project_technologies from legacy
 *    UUID rows to the slug row that shares the same name.
 * 2. Delete the now-orphan legacy UUID rows.
 * 3. Fix icon values that don't match any TECHNOLOGY_ICON_IDS in the SaaS.
 *
 * Run with: node scripts/fix-tech-data.mjs "<DATABASE_URL>"
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? process.argv[2];
if (!url) {
  console.error("Provide DATABASE_URL as env or first arg");
  process.exit(1);
}

const MIGRATIONS = [
  // legacy UUID -> slug to keep
  ["8df6fe0a-a993-4937-a980-e4b6656b99e1", "docker"],
  ["cb9efe73-5d22-45a2-886c-2370896dadbe", "fastapi"],
  ["b831dada-9fec-464c-a6a2-f60ad237b240", "html5"],
  ["27e50b90-4380-429d-aea8-eed80f8aee58", "javascript"],
  ["20416285-c56d-41f1-8333-49f31e0c842c", "nextjs"],
  ["ad7cbefc-77be-411c-87be-cf90395d2d7d", "odoo"],
  ["c4064292-2ec3-48bd-8ad0-90e1a6d8224d", "openai"],
  ["2d9e4bed-8e3a-4807-b5b6-bef572db1a46", "postgresql"],
  ["ced127aa-9168-46b2-a934-49418611b65c", "react"],
  ["2bef19bc-cd0e-4732-af92-0239f9b9d881", "redis"],
  ["ea1ad072-bbc2-4910-870f-491e163e1938", "sage"],
  ["2d53a877-a72e-48ec-b38f-6b3a71a294c7", "shadcn-ui"],
  ["aa75d111-6b3f-43f7-9560-b3db8d0b6be7", "supabase"],
  ["b805d7af-ccfc-4b1c-a84c-13804b56fb26", "tailwindcss"],
  ["b4b2cff0-1c33-4e4d-82d6-2aaed0b56d7f", "typescript"],
];

const ICON_FIXES = [
  // id -> correct icon
  ["jwt", "jwt"], // was jsonwebtokens
  ["material-ui", "mui"], // was materialdesign
  ["radix-ui", "radix-ui"], // was radixui
  ["shadcn-ui", "shadcn/ui"], // was shadcnui
  ["sql", "sql"], // was database
  ["base-ui", "base-ui"], // was baseui
  ["bootstrap", "bootstrap"],
  ["css3", "css"],
  ["django", "django"],
  ["jquery", "jquery"],
  ["moodle", "moodle"],
  ["nodejs", "nodejs"], // was nodedotjs
  ["react-router", "react-router"], // was reactrouter
  ["replit", "replit"],
  ["tailwindcss", "tailwind"], // align with canonical icon id
  ["tanstack-query", "tanstack-query"], // was reactquery
];

// Also rename the keep_id "shadcn-ui" row's icon to canonical "shadcn/ui" so it
// stops using the non-existent "shadcnui" id, and drop "tailwindcss" icon for "tailwind".

const conn = await mysql.createConnection(url);
await conn.beginTransaction();

try {
  let migrated = 0;
  for (const [legacy, keep] of MIGRATIONS) {
    // Verify both rows exist
    const [check] = await conn.execute(
      "SELECT id FROM technologies WHERE id IN (?, ?)",
      [legacy, keep]
    );
    const ids = check.map((r) => r.id);
    if (!ids.includes(legacy)) {
      console.log(`skip ${legacy}: legacy not found`);
      continue;
    }
    if (!ids.includes(keep)) {
      console.log(`skip ${legacy}: keep "${keep}" not found`);
      continue;
    }

    // Repoint experience_technologies. INSERT IGNORE to avoid unique violations
    // if both rows are already linked to the same experience.
    await conn.execute(
      `INSERT IGNORE INTO experience_technologies (experienceId, technologyId)
       SELECT experienceId, ? FROM experience_technologies WHERE technologyId = ?`,
      [keep, legacy]
    );
    await conn.execute(
      "DELETE FROM experience_technologies WHERE technologyId = ?",
      [legacy]
    );

    // Same for project_technologies
    await conn.execute(
      `INSERT IGNORE INTO project_technologies (projectId, technologyId)
       SELECT projectId, ? FROM project_technologies WHERE technologyId = ?`,
      [keep, legacy]
    );
    await conn.execute(
      "DELETE FROM project_technologies WHERE technologyId = ?",
      [legacy]
    );

    // Drop legacy row
    await conn.execute("DELETE FROM technologies WHERE id = ?", [legacy]);
    migrated += 1;
    console.log(`merged ${legacy} -> ${keep}`);
  }

  let fixed = 0;
  for (const [id, icon] of ICON_FIXES) {
    const [result] = await conn.execute(
      "UPDATE technologies SET icon = ? WHERE id = ? AND icon <> ?",
      [icon, id, icon]
    );
    if (result.affectedRows > 0) {
      fixed += 1;
      console.log(`fixed icon for ${id} -> ${icon}`);
    }
  }

  await conn.commit();
  console.log(`\nDone. Merged ${migrated} duplicates, fixed ${fixed} icons.`);
} catch (error) {
  await conn.rollback();
  console.error("Rolled back:", error);
  process.exitCode = 1;
} finally {
  await conn.end();
}
