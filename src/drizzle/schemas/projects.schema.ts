import { sql } from "drizzle-orm";
import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const projectsTable = mysqlTable("projects", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  slug: varchar({ length: 64 }).notNull().unique(),
  title: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 2000 }).notNull(),
  imageUrl: varchar({ length: 512 }).notNull(),
  liveUrl: varchar({ length: 512 }),
  githubUrl: varchar({ length: 512 }),
  sortOrder: int().notNull().default(0),
  /** GitHub numeric repo id when imported/linked from GitHub. */
  githubRepoId: int("github_repo_id"),
  /** GitHub `owner/name` for the linked repo, denormalized for display. */
  githubFullName: varchar("github_full_name", { length: 255 }),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});
