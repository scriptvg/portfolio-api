import type { NextFunction, Request, Response } from "express";

import { findUserById } from "@/modules/oauth/oauth.service";
import { ApiError } from "@/shared/errors/api-error";
import { verifyAccessToken } from "@/shared/utils/jwt";
import { logger } from "@/shared/utils/logger";
import { toPublicUser } from "@/shared/utils/user-public";

const BEARER_PREFIX = "Bearer ";

export async function requireJwt(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith(BEARER_PREFIX)) {
    return next(
      ApiError.unauthorized(
        "Missing or invalid Authorization header (expected Bearer JWT)"
      )
    );
  }

  const raw = header.slice(BEARER_PREFIX.length).trim();

  try {
    const payload = verifyAccessToken(raw);
    const user = await findUserById(payload.sub);

    if (!user || user.email !== payload.email) {
      return next(ApiError.unauthorized("Invalid or expired token"));
    }

    req.user = toPublicUser(user);

    logger.info(
      {
        userId: user.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString()
      },
      "JWT auth succeeded"
    );

    next();
  } catch {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }
}
