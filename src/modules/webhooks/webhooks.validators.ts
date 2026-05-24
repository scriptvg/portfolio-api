import { z } from "zod";

import { WEBHOOK_EVENTS } from "@/drizzle/schemas/webhooks.schema";

export const webhookEventSchema = z.enum(WEBHOOK_EVENTS);

export const webhookBodySchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(120),
  url: z.url("URL must be a valid HTTPS or HTTP URL").max(1024),
  events: z
    .array(webhookEventSchema)
    .min(1, "Subscribe to at least one event")
    .max(WEBHOOK_EVENTS.length),
  active: z.boolean().optional()
});

export const webhookPatchSchema = webhookBodySchema.partial();

export const idParamSchema = z.object({
  id: z.uuid("Invalid id")
});

export const deliveryIdParamSchema = z.object({
  id: z.uuid("Invalid webhook id"),
  deliveryId: z.uuid("Invalid delivery id")
});

export type WebhookBody = z.infer<typeof webhookBodySchema>;
export type WebhookPatchBody = z.infer<typeof webhookPatchSchema>;
