import { relations, sql } from "drizzle-orm";
import {
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

import { webhooksTable, type WebhookEvent } from "./webhooks.schema";

export type WebhookDeliveryStatus =
  | "pending"
  | "delivering"
  | "success"
  | "failed"
  | "dead";

export const webhookDeliveriesTable = mysqlTable("webhook_deliveries", {
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),
  webhookId: varchar("webhook_id", { length: 36 })
    .notNull()
    .references(() => webhooksTable.id, { onDelete: "cascade" }),
  event: varchar({ length: 64 }).$type<WebhookEvent>().notNull(),
  /** Body sent to the destination, as JSON. */
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  status: varchar({ length: 16 })
    .$type<WebhookDeliveryStatus>()
    .notNull()
    .default("pending"),
  attemptCount: int("attempt_count").notNull().default(0),
  /** UTC timestamp when this delivery is eligible to be picked up. */
  nextAttemptAt: timestamp("next_attempt_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { mode: "string" }),
  responseStatus: int("response_status"),
  responseBody: text("response_body"),
  errorMessage: varchar("error_message", { length: 1024 }),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});

export const webhookDeliveriesRelations = relations(
  webhookDeliveriesTable,
  ({ one }) => ({
    webhook: one(webhooksTable, {
      fields: [webhookDeliveriesTable.webhookId],
      references: [webhooksTable.id]
    })
  })
);
