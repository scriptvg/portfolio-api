import type { NextFunction, Request, Response } from "express";

import { parseCorsOrigins } from "@/shared/utils/cors-origins";
import { ApiError } from "@/shared/errors/api-error";
import env from "@/shared/configs/env";
import { logger } from "@/shared/utils/logger";

/**
 * Allowlist derivada de CORS_ORIGIN — misma fuente de verdad que el middleware
 * CORS de app.ts, por lo que no requiere configuración adicional.
 */
const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

/**
 * Extrae el origen de la petición desde el header `Origin` (presente en todas
 * las peticiones cross-origin, incluidas las "simple requests" sin preflight).
 * Si `Origin` falta, intenta derivarlo del header `Referer` recortando el path.
 *
 * Devuelve `null` si ninguno de los dos headers está presente.
 */
function extractOrigin(req: Request): string | null {
  const origin = req.headers["origin"];
  if (typeof origin === "string" && origin.length > 0) {
    return origin.replace(/\/+$/, "");
  }

  const referer = req.headers["referer"];
  if (typeof referer === "string" && referer.length > 0) {
    try {
      const url = new URL(referer);
      return url.origin; // scheme + host + port, sin path
    } catch {
      // Referer malformado — ignorar
      return null;
    }
  }

  return null;
}

/**
 * Middleware que rechaza peticiones cuyo `Origin` (o `Referer` como fallback)
 * no figure en la allowlist derivada de `CORS_ORIGIN`.
 *
 * Propósito: mitigar CSRF "simple request" en endpoints sensibles que no tienen
 * body (como `POST /auth/refresh`) y por tanto no disparan un preflight. Sin
 * este control, un sitio atacante puede forzar la rotación del refresh token
 * de la víctima, convirtiendo la theft-detection en un vector de DoS de sesión.
 *
 * Casos permitidos:
 * - El `Origin` está en `allowedOrigins`.
 * - La petición no lleva `Origin` ni `Referer` (petición server-side o
 *   herramienta CLI como curl/Postman en dev — se permite con log de advertencia
 *   solo si no estamos en producción; en producción también se bloquea para no
 *   exponer el endpoint a scripts que omitan el header a propósito).
 *
 * @throws {ApiError} 403 si el origen no está en la allowlist.
 */
export function requireKnownOrigin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const origin = extractOrigin(req);

  // Sin Origin ni Referer: en dev dejamos pasar (curl / Postman / tests).
  // En prod, bloqueamos: un browser siempre manda Origin en cross-origin y un
  // same-origin POST tampoco omite Origin en la práctica.
  if (origin === null) {
    if (env.NODE_ENV !== "production") {
      logger.warn(
        { method: req.method, path: req.path, ip: req.ip },
        "requireKnownOrigin: no Origin/Referer header — allowed in non-prod"
      );
      return next();
    }

    logger.warn(
      { method: req.method, path: req.path, ip: req.ip },
      "requireKnownOrigin: no Origin/Referer header in production — blocked"
    );
    return next(ApiError.forbidden("Missing Origin header"));
  }

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  logger.warn(
    { method: req.method, path: req.path, origin, ip: req.ip },
    "requireKnownOrigin: origin not in allowlist — blocked"
  );
  return next(ApiError.forbidden("Origin not allowed"));
}
