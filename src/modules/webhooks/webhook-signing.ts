import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generates a hex-encoded secret for HMAC SHA-256 signing.
 * Stored as-is in the DB; shown to the user only on creation/rotation.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computes the signature header value for a webhook delivery.
 *
 * Format: `sha256=<hex>` over `<timestamp>.<rawBody>` using the webhook secret.
 * Pair with the `X-Webhook-Timestamp` header so the receiver can reject stale
 * requests (replay protection).
 */
export function signWebhookPayload(
  secret: string,
  timestamp: number,
  rawBody: string
): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

/** Constant-time signature comparison (kept here for symmetry / receiver tests). */
export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  rawBody: string,
  receivedSignature: string
): boolean {
  const expected = signWebhookPayload(secret, timestamp, rawBody);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(receivedSignature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
