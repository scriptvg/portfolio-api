import type { Response } from "express";

import env from "@/shared/configs/env";

/**
 * Nombre de la cookie httpOnly que transporta el refresh token opaco.
 * Este nombre debe ser idéntico en todos los puntos donde se lee/escribe.
 */
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/**
 * Path acotado de la cookie para minimizar la superficie de envío automático.
 * Solo se adjunta a peticiones bajo `/api/v1/auth`, donde viven /refresh y /logout.
 */
const COOKIE_PATH = "/api/v1/auth";

/**
 * Escribe el refresh token en la respuesta como cookie httpOnly.
 *
 * Atributos:
 * - httpOnly: true — inaccesible desde JavaScript del cliente.
 * - Secure: true en producción (HTTPS requerido).
 * - SameSite:
 *   - "none" + Secure en producción (cross-origin saas ↔ api, necesita Secure).
 *   - "lax" en desarrollo (http://localhost no requiere Secure; "none" sin Secure
 *     es ignorado por browsers modernos per spec RFC 6265bis).
 * - Path: acotado a /api/v1/auth para no adjuntar la cookie en otras rutas.
 * - maxAge: TTL del refresh token en segundos.
 */
export function setRefreshCookie(res: Response, token: string): void {
  const isProd = env.NODE_ENV === "production";

  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000 // express espera ms
  });
}

/**
 * Limpia la cookie del refresh token del cliente seteando un valor vacío
 * y maxAge 0 (expiración inmediata).
 */
export function clearRefreshCookie(res: Response): void {
  const isProd = env.NODE_ENV === "production";

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: COOKIE_PATH
  });
}
