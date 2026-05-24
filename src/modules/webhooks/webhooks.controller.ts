import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";

import db from "@/db";
import { webhookDeliveriesTable } from "@/drizzle/schemas/webhook-deliveries.schema";
import { webhooksTable } from "@/drizzle/schemas/webhooks.schema";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";

import { WEBHOOK_EVENTS } from "./webhook-events";
import { generateWebhookSecret } from "./webhook-signing";
import { kickWorker } from "./webhook-worker";
import {
  deliveryIdParamSchema,
  idParamSchema,
  webhookBodySchema,
  webhookPatchSchema
} from "./webhooks.validators";
import {
  getDeliveryById,
  getUserWebhookById,
  listDeliveriesForWebhook,
  listUserWebhooks,
  toPublicWebhook
} from "./webhooks.service";

function getUserId(req: Request): string {
  if (!req.user?.id) {
    throw ApiError.unauthorized("Authentication required");
  }
  return req.user.id;
}

export const listAvailableEvents = (_req: Request, res: Response) =>
  ApiResponse.Success(res, "Webhook events", { events: WEBHOOK_EVENTS });

export const listWebhooks = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const rows = await listUserWebhooks(userId);
  return ApiResponse.Success(
    res,
    "Webhooks fetched",
    rows.map(toPublicWebhook)
  );
};

export const createWebhook = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const parsed = webhookBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const id = randomUUID();
  const secret = generateWebhookSecret();

  await db.insert(webhooksTable).values({
    id,
    userId,
    label: parsed.data.label,
    url: parsed.data.url,
    secret,
    events: parsed.data.events,
    active: parsed.data.active ?? true
  });

  const created = await getUserWebhookById(userId, id);
  if (!created) {
    throw ApiError.server("Failed to load created webhook");
  }

  // Return the raw secret ONLY on creation. Subsequent reads return the preview.
  return ApiResponse.created(res, "Webhook created", {
    ...toPublicWebhook(created),
    secret
  });
};

export const patchWebhook = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = webhookPatchSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }
  if (Object.keys(bodyParsed.data).length === 0) {
    throw ApiError.badRequest("No fields to update");
  }

  const existing = await getUserWebhookById(userId, idParsed.data.id);
  if (!existing) {
    throw ApiError.notFound("Webhook not found");
  }

  await db
    .update(webhooksTable)
    .set({
      ...bodyParsed.data,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(
      and(eq(webhooksTable.id, existing.id), eq(webhooksTable.userId, userId))
    );

  const updated = await getUserWebhookById(userId, existing.id);
  if (!updated) {
    throw ApiError.server("Failed to load updated webhook");
  }
  return ApiResponse.Success(res, "Webhook updated", toPublicWebhook(updated));
};

export const rotateWebhookSecret = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }
  const existing = await getUserWebhookById(userId, idParsed.data.id);
  if (!existing) {
    throw ApiError.notFound("Webhook not found");
  }
  const secret = generateWebhookSecret();
  await db
    .update(webhooksTable)
    .set({ secret, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(
      and(eq(webhooksTable.id, existing.id), eq(webhooksTable.userId, userId))
    );
  return ApiResponse.Success(res, "Secret rotated", { secret });
};

export const deleteWebhook = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }
  const existing = await getUserWebhookById(userId, idParsed.data.id);
  if (!existing) {
    throw ApiError.notFound("Webhook not found");
  }
  await db
    .delete(webhooksTable)
    .where(
      and(eq(webhooksTable.id, existing.id), eq(webhooksTable.userId, userId))
    );
  return ApiResponse.Success(res, "Webhook deleted", { id: existing.id });
};

export const listDeliveries = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }
  const webhook = await getUserWebhookById(userId, idParsed.data.id);
  if (!webhook) {
    throw ApiError.notFound("Webhook not found");
  }
  const deliveries = await listDeliveriesForWebhook(webhook.id);
  return ApiResponse.Success(res, "Deliveries fetched", deliveries);
};

export const retryDelivery = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const parsed = deliveryIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid params", z.flattenError(parsed.error));
  }
  const webhook = await getUserWebhookById(userId, parsed.data.id);
  if (!webhook) {
    throw ApiError.notFound("Webhook not found");
  }
  const delivery = await getDeliveryById(parsed.data.deliveryId);
  if (!delivery || delivery.webhookId !== webhook.id) {
    throw ApiError.notFound("Delivery not found");
  }
  if (delivery.status === "delivering" || delivery.status === "pending") {
    throw ApiError.badRequest("Delivery is already in flight");
  }
  await db
    .update(webhookDeliveriesTable)
    .set({
      status: "pending",
      nextAttemptAt: sql`CURRENT_TIMESTAMP`,
      errorMessage: null,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(webhookDeliveriesTable.id, delivery.id));
  kickWorker();
  return ApiResponse.Success(res, "Delivery requeued", { id: delivery.id });
};
