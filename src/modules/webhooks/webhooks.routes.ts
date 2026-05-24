import { Router } from "express";

import { requireJwt } from "@/shared/middlewares/require-jwt";

import {
  createWebhook,
  deleteWebhook,
  listAvailableEvents,
  listDeliveries,
  listWebhooks,
  patchWebhook,
  retryDelivery,
  rotateWebhookSecret
} from "./webhooks.controller";

const router = Router();

router.get("/events", listAvailableEvents);

router.use(requireJwt);

router.get("/", listWebhooks);
router.post("/", createWebhook);
router.patch("/:id", patchWebhook);
router.delete("/:id", deleteWebhook);
router.post("/:id/rotate-secret", rotateWebhookSecret);
router.get("/:id/deliveries", listDeliveries);
router.post("/:id/deliveries/:deliveryId/retry", retryDelivery);

export default router;
