import { eq } from "drizzle-orm";

import db from "@/db";
import { webhookDeliveriesTable } from "@/drizzle/schemas/webhook-deliveries.schema";
import { logger } from "@/shared/utils/logger";

import { signWebhookPayload } from "./webhook-signing";
import {
  claimReadyDeliveries,
  getWebhookById,
  type WebhookDeliveryRow
} from "./webhooks.service";

const POLL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 10;

/** Backoff in seconds: 30s, 2m, 10m, 30m, 2h, 6h. */
function backoffSeconds(attempt: number): number {
  const ladder = [30, 120, 600, 1800, 7200, 21600];
  return ladder[Math.min(attempt - 1, ladder.length - 1)];
}

let started = false;
let pollTimer: NodeJS.Timeout | null = null;
let running = false;
let pendingKick = false;

export function startWebhookWorker(): void {
  if (started) return;
  started = true;
  logger.info("[webhooks] worker started");
  schedule(0);
}

export function stopWebhookWorker(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  started = false;
}

/** Called by the dispatcher after enqueueing. Wakes the loop early. */
export function kickWorker(): void {
  if (!started) return;
  if (running) {
    pendingKick = true;
    return;
  }
  schedule(0);
}

function schedule(delayMs: number): void {
  if (!started) return;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => void tick(), delayMs);
}

async function tick(): Promise<void> {
  if (!started) return;
  running = true;
  try {
    const claimed = await claimReadyDeliveries(BATCH_SIZE);
    if (claimed.length > 0) {
      await Promise.all(claimed.map(delivery => deliver(delivery)));
    }
  } catch (error) {
    logger.error({ err: error }, "[webhooks] worker tick failed");
  } finally {
    running = false;
    const next = pendingKick ? 0 : POLL_INTERVAL_MS;
    pendingKick = false;
    schedule(next);
  }
}

async function deliver(delivery: WebhookDeliveryRow): Promise<void> {
  const attempt = delivery.attemptCount + 1;
  const now = new Date();

  const webhook = await getWebhookById(delivery.webhookId);
  if (!webhook || !webhook.active) {
    await db
      .update(webhookDeliveriesTable)
      .set({
        status: "dead",
        attemptCount: attempt,
        errorMessage: !webhook ? "Webhook deleted" : "Webhook disabled",
        updatedAt: now.toISOString()
      })
      .where(eq(webhookDeliveriesTable.id, delivery.id));
    return;
  }

  const timestamp = Math.floor(now.getTime() / 1000);
  const envelope = {
    id: delivery.id,
    event: delivery.event,
    timestamp,
    data: delivery.payload
  };
  const rawBody = JSON.stringify(envelope);
  const signature = signWebhookPayload(webhook.secret, timestamp, rawBody);

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "portfolio-saas-webhook/1",
        "X-Webhook-Event": delivery.event,
        "X-Webhook-Id": delivery.id,
        "X-Webhook-Timestamp": String(timestamp),
        "X-Webhook-Signature": signature
      },
      body: rawBody,
      signal: controller.signal
    });
    responseStatus = response.status;
    try {
      responseBody = (await response.text()).slice(0, 4000);
    } catch {
      responseBody = null;
    }
    if (response.status < 200 || response.status >= 300) {
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Timeout"
          : error.message
        : "Unknown error";
  } finally {
    clearTimeout(abortTimer);
  }

  const succeeded =
    errorMessage === null &&
    responseStatus !== null &&
    responseStatus >= 200 &&
    responseStatus < 300;

  if (succeeded) {
    await db
      .update(webhookDeliveriesTable)
      .set({
        status: "success",
        attemptCount: attempt,
        responseStatus,
        responseBody,
        errorMessage: null,
        updatedAt: now.toISOString()
      })
      .where(eq(webhookDeliveriesTable.id, delivery.id));
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    await db
      .update(webhookDeliveriesTable)
      .set({
        status: "dead",
        attemptCount: attempt,
        responseStatus,
        responseBody,
        errorMessage,
        updatedAt: now.toISOString()
      })
      .where(eq(webhookDeliveriesTable.id, delivery.id));
    logger.warn(
      { deliveryId: delivery.id, event: delivery.event, errorMessage },
      "[webhooks] delivery dead-lettered"
    );
    return;
  }

  const nextAttemptAt = new Date(
    now.getTime() + backoffSeconds(attempt) * 1000
  );
  await db
    .update(webhookDeliveriesTable)
    .set({
      status: "pending",
      attemptCount: attempt,
      responseStatus,
      responseBody,
      errorMessage,
      nextAttemptAt: nextAttemptAt.toISOString(),
      updatedAt: now.toISOString()
    })
    .where(eq(webhookDeliveriesTable.id, delivery.id));
}
