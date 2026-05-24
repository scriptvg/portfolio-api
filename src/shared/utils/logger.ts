import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import env from "@/shared/configs/env";

const isProduction = env.NODE_ENV === "production";

type RequestContext = { correlationId: string };

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export const logger = pino({
  level: env.LOG_LEVEL || "info",

  base: {
    pid: process.pid
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  formatters: {
    level(label) {
      return { level: label };
    }
  },

  mixin() {
    const ctx = requestContextStorage.getStore();
    return ctx ? { correlationId: ctx.correlationId } : {};
  },

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "refreshToken"
    ],
    censor: "[REDACTED]"
  },

  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname"
          }
        }
      })
});

export function getRequestLogger(locals: { correlationId?: string }) {
  if (locals.correlationId) {
    return logger.child({ correlationId: locals.correlationId });
  }
  return logger;
}
