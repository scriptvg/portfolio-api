import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

import { runWithRequestContext } from "@/shared/utils/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- module augmentation of Express types requires `namespace`
  namespace Express {
    interface Locals {
      correlationId: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  res.locals.correlationId = id;
  res.setHeader("X-Request-ID", id);
  runWithRequestContext({ correlationId: id }, next);
}
