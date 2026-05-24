import { and, desc, eq, lte } from "drizzle-orm";

import db from "@/db";
import {
  webhookDeliveriesTable,
  type WebhookDeliveryStatus
} from "@/drizzle/schemas/webhook-deliveries.schema";
import {
  webhooksTable,
  type WebhookEvent
} from "@/drizzle/schemas/webhooks.schema";

export type WebhookRow = typeof webhooksTable.$inferSelect;
export type WebhookDeliveryRow = typeof webhookDeliveriesTable.$inferSelect;

/** Public webhook payload — never expose the raw secret in list responses. */
export type WebhookPublic = Omit<WebhookRow, "secret"> & {
  secretPreview: string;
};

export function toPublicWebhook(row: WebhookRow): WebhookPublic {
  const { secret, ...rest } = row;
  return {
    ...rest,
    secretPreview: `${secret.slice(0, 6)}…${secret.slice(-4)}`
  };
}

export async function listUserWebhooks(userId: string): Promise<WebhookRow[]> {
  return db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, userId))
    .orderBy(desc(webhooksTable.createdAt));
}

export async function getUserWebhookById(
  userId: string,
  id: string
): Promise<WebhookRow | undefined> {
  const [row] = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)))
    .limit(1);
  return row;
}

export async function getWebhookById(
  id: string
): Promise<WebhookRow | undefined> {
  const [row] = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.id, id))
    .limit(1);
  return row;
}

export async function listActiveWebhooksForEvent(
  event: WebhookEvent
): Promise<WebhookRow[]> {
  const rows = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.active, true));
  return rows.filter(row => row.events.includes(event));
}

export async function listDeliveriesForWebhook(
  webhookId: string,
  limit = 50
): Promise<WebhookDeliveryRow[]> {
  return db
    .select()
    .from(webhookDeliveriesTable)
    .where(eq(webhookDeliveriesTable.webhookId, webhookId))
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(limit);
}

export async function getDeliveryById(
  id: string
): Promise<WebhookDeliveryRow | undefined> {
  const [row] = await db
    .select()
    .from(webhookDeliveriesTable)
    .where(eq(webhookDeliveriesTable.id, id))
    .limit(1);
  return row;
}

export async function claimReadyDeliveries(
  limit: number,
  now: Date = new Date()
): Promise<WebhookDeliveryRow[]> {
  // Two-step claim (no SKIP LOCKED in MySQL driver path). Worker is single instance.
  const candidates = await db
    .select()
    .from(webhookDeliveriesTable)
    .where(
      and(
        eq(webhookDeliveriesTable.status, "pending" as WebhookDeliveryStatus),
        lte(webhookDeliveriesTable.nextAttemptAt, now.toISOString())
      )
    )
    .orderBy(webhookDeliveriesTable.nextAttemptAt)
    .limit(limit);

  if (candidates.length === 0) return [];

  const claimed: WebhookDeliveryRow[] = [];
  for (const row of candidates) {
    const [result] = await db
      .update(webhookDeliveriesTable)
      .set({ status: "delivering", lastAttemptAt: now.toISOString() })
      .where(
        and(
          eq(webhookDeliveriesTable.id, row.id),
          eq(webhookDeliveriesTable.status, "pending")
        )
      );
    if (result.affectedRows === 1) {
      claimed.push({
        ...row,
        status: "delivering",
        lastAttemptAt: now.toISOString()
      });
    }
  }
  return claimed;
}
