import { sql } from "drizzle-orm";
import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const educationTable = mysqlTable("education", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  institution: varchar({ length: 255 }).notNull(),
  degree: varchar({ length: 255 }).notNull(),
  fieldOfStudy: varchar("field_of_study", { length: 255 }),
  period: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 2000 }),
  sortOrder: int().notNull().default(0),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});
