import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import env from "@/shared/configs/env";
import { ApiError } from "@/shared/errors/api-error";
import { logger } from "@/shared/utils/logger";

const BEARER_PREFIX = "Bearer ";

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function requireAdminSecret(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith(BEARER_PREFIX)) {
    return next(
      ApiError.unauthorized(
        "Missing or invalid Authorization header (expected Bearer token)"
      )
    );
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token || !timingSafeEqualString(token, env.API_ADMIN_SECRET)) {
    return next(ApiError.unauthorized("Invalid credentials"));
  }

  logger.info(
    {
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString()
    },
    "Admin secret auth succeeded"
  );

  next();
}
