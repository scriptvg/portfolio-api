import { sql } from "drizzle-orm";
import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const usersTable = mysqlTable("users", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  /** Kept for legacy rows; OAuth users default to 0 */
  age: int().notNull().default(0),
  image: varchar({ length: 512 }),
  googleId: varchar({ length: 255 }).unique(),
  githubId: varchar({ length: 255 }).unique(),
  /** Set for email/password users; null for OAuth-only */
  passwordHash: varchar({ length: 255 })
});
