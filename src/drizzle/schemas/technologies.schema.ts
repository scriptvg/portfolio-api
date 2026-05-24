import { sql } from "drizzle-orm";
import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const technologiesTable = mysqlTable("technologies", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  name: varchar({ length: 255 }).notNull(),
  icon: varchar({ length: 255 }).notNull(),
  color: varchar({ length: 255 }).notNull(),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});
