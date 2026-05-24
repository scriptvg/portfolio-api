import { relations, sql } from "drizzle-orm";
import {
  boolean,
  json,
  mysqlTable,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

import { usersTable } from "@/drizzle/schemas/user.schema";

export const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "experience.created",
  "experience.updated",
  "experience.deleted",
  "technology.created",
  "technology.updated",
  "technology.deleted",
  "workspace.published"
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const webhooksTable = mysqlTable("webhooks", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  label: varchar({ length: 120 }).notNull(),
  url: varchar({ length: 1024 }).notNull(),
  /** HMAC SHA-256 secret. Sent only on creation/rotation. */
  secret: varchar({ length: 128 }).notNull(),
  /** Array of subscribed WebhookEvent values. */
  events: json("events").$type<WebhookEvent[]>().notNull(),
  active: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});

export const webhooksRelations = relations(webhooksTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [webhooksTable.userId],
    references: [usersTable.id]
  })
}));
