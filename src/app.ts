import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import session from "express-session";

import Routes from "@/routes";

import { correlationId } from "@/shared/middlewares/correlation-id";
import { errorHandler } from "@/shared/middlewares/error-handler";
import { notFoundHandler } from "@/shared/middlewares/not-found-handler";
import {
  apiLimiter,
  docsLimiter,
  writeLimiter
} from "@/shared/middlewares/rate-limiter";
import { setupSwagger } from "@/shared/configs/swagger";
import env from "@/shared/configs/env";
import passport from "@/shared/configs/passport";
import { parseCorsOrigins } from "@/shared/utils/cors-origins";
import { logger } from "@/shared/utils/logger";
import {
  UPLOADS_PUBLIC_PREFIX,
  UPLOADS_ROOT,
  ensureUploadDirs
} from "@/shared/utils/uploads";

import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

const allowedCorsOrigins = parseCorsOrigins(env.CORS_ORIGIN);

const app: Express = express();

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/+$/, "");
      if (allowedCorsOrigins.includes(normalized)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://*.githubusercontent.com"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"]
      }
    }
  })
);
app.use(cookieParser());

app.use(correlationId);

app.use(
  pinoHttp({
    logger,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password"
    ],
    autoLogging: {
      ignore: req => (req.url || "").includes("/health")
    }
  })
);

app.use(apiLimiter);
app.use(writeLimiter);

ensureUploadDirs();
app.use(
  UPLOADS_PUBLIC_PREFIX,
  express.static(UPLOADS_ROOT, {
    fallthrough: false,
    maxAge: "7d",
    immutable: false,
    setHeaders: res => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);

//? Swagger Setup (rate-limited)
app.use("/api/docs", docsLimiter);
setupSwagger(app);

//? Routes
app.get("/", (req: Request, res: Response) => {
  res.redirect("/api/v1/health");
});

app.use("/api/v1", Routes);

// Not found handler (should be after routes)
app.use(notFoundHandler);

// Global error handler (should be last)
app.use(errorHandler);

export default app;
