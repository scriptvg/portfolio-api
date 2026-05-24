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
