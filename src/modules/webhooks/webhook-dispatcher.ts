import { randomUUID } from "node:crypto";

import db from "@/db";
import { webhookDeliveriesTable } from "@/drizzle/schemas/webhook-deliveries.schema";
import { logger } from "@/shared/utils/logger";

import type { WebhookEvent } from "./webhook-events";
import { listActiveWebhooksForEvent } from "./webhooks.service";
import { kickWorker } from "./webhook-worker";

/**
 * Enqueues a delivery for every active webhook subscribed to `event`.
 * Fire-and-forget: never throws to the caller (controllers must not fail because
 * a webhook listing query failed).
 */
export function emit(event: WebhookEvent, payload: Record<string, unknown>) {
  void enqueueDeliveries(event, payload).catch(error => {
    logger.error({ event, err: error }, "[webhooks] failed to enqueue");
  });
}

async function enqueueDeliveries(
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const subscribers = await listActiveWebhooksForEvent(event);
  if (subscribers.length === 0) return;

  const rows = subscribers.map(webhook => ({
    id: randomUUID(),
    webhookId: webhook.id,
    event,
    payload
  }));

  await db.insert(webhookDeliveriesTable).values(rows);

  logger.debug({ event, count: rows.length }, "[webhooks] queued deliveries");

  kickWorker();
}
