import rateLimit, {
  type RateLimitRequestHandler,
  type Options
} from "express-rate-limit";
import { STATUS_CODES } from "@/shared/constants/status-codes";
import env from "@/shared/configs/env";

const windowMs = env.RATE_LIMIT_WINDOW_MS;
const max = env.RATE_LIMIT_MAX;

const standardHandler: Options["handler"] = (_req, res, _next) => {
  res.status(STATUS_CODES.TOO_MANY_REQUESTS).json({
    success: false,
    message: "Too many requests, please try again later",
    statusCode: STATUS_CODES.TOO_MANY_REQUESTS
  });
};

export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export const writeLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => !MUTATION_METHODS.includes(req.method),
  handler: standardHandler
});

export const docsLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Limiter propio para el proxy de IA: las inferencias son caras (CPU/GPU y
 * tiempo), así que es más restrictivo que el límite global de la API.
 */
export const aiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Limiter holgado para /auth/refresh y /auth/logout.
 *
 * Estos endpoints NO deben caer bajo authLimiter (5/min): el cliente los llama
 * legítimamente cada ~15 minutos cuando el access token expira, y el logout
 * puede llamarse en cualquier momento. Se usa un límite de 30/min para
 * prevenir abuso sin estrangular el flujo normal de la SPA.
 */
export const refreshLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});
