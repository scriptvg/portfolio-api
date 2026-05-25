import { sql } from "drizzle-orm";
import {
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "internship",
  "contract",
  "freelance",
  "volunteer",
  "bootcamp"
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const experiencesTable = mysqlTable("experiences", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  title: varchar({ length: 255 }).notNull(),
  position: varchar({ length: 255 }).notNull().default(""),
  employmentType: mysqlEnum("employment_type", EMPLOYMENT_TYPES)
    .notNull()
    .default("full_time"),
  company: varchar({ length: 255 }).notNull(),
  period: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 2000 }).notNull(),
  sortOrder: int().notNull().default(0),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});
