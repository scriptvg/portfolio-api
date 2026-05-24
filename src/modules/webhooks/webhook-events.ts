import {
  WEBHOOK_EVENTS,
  type WebhookEvent
} from "@/drizzle/schemas/webhooks.schema";

export { WEBHOOK_EVENTS };
export type { WebhookEvent };

const EVENT_SET = new Set<string>(WEBHOOK_EVENTS);

export function isWebhookEvent(value: string): value is WebhookEvent {
  return EVENT_SET.has(value);
}
