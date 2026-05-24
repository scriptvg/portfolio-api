import dotenvFlow from "dotenv-flow";

dotenvFlow.config();
import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  v === "" || v === undefined ? undefined : v;

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.string().regex(/^\d+$/, "PORT must be a number").transform(Number),

    DATABASE_URL: z.url(),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    CORS_ORIGIN: z.string(),

    /** Secret for Bearer token on protected admin routes (e.g. POST/PUT/DELETE technologies). */
    API_ADMIN_SECRET: z
      .string()
      .min(16, "API_ADMIN_SECRET must be at least 16 characters"),

    /**
     * Comma-separated emails allowed to perform mutating operations with a user JWT
     * (dashboard). If empty in production, only API_ADMIN_SECRET works for those
     * writes. In development, empty means any JWT.
     */
    DASHBOARD_WRITE_EMAILS: z.preprocess(
      emptyToUndefined,
      z.string().optional()
    ),

    SESSION_SECRET: z
      .string()
      .min(16, "SESSION_SECRET must be at least 16 characters"),

    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),

    /**
     * Key material used to derive the AES-256-GCM key for at-rest secrets
     * (currently GitHub PATs). Falls back to SESSION_SECRET in development if
     * unset. Rotating this value invalidates existing ciphertexts.
     */
    APP_ENCRYPTION_KEY: z.preprocess(
      emptyToUndefined,
      z.string().min(32).optional()
    ),

    /** Frontend base URL (OAuth success redirect). */
    CLIENT_URL: z.url(),

    /**
     * Origen público de esta API (ej. http://localhost:9000), sin barra final.
     * Si lo defines, las URLs de redirect del flujo "link OAuth" usan este host en lugar del Host de la petición (evita desajuste con GitHub/Google registrados en localhost).
     */
    API_PUBLIC_URL: z.preprocess(emptyToUndefined, z.url().optional()),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

    /** Tras un proxy inverso, permite usar X-Forwarded-Proto / Host al inferir URLs. */
    TRUST_PROXY: z.preprocess(v => {
      if (v === undefined || v === "" || v === null) return false;
      const s = String(v).toLowerCase();
      return s === "1" || s === "true" || s === "yes";
    }, z.boolean()),

    GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    GOOGLE_CALLBACK_URL: z.preprocess(emptyToUndefined, z.url().optional()),

    GITHUB_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    GITHUB_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    GITHUB_CALLBACK_URL: z.preprocess(emptyToUndefined, z.url().optional()),

    /** Optional; defaults from sign-in callback URL pattern (register this URI in the provider). */
    GOOGLE_LINK_CALLBACK_URL: z.preprocess(
      emptyToUndefined,
      z.url().optional()
    ),

    /** Proveedor de IA activo. Hoy solo "ollama"; ampliar el enum al añadir adapters. */
    AI_PROVIDER: z.enum(["ollama"]).default("ollama"),

    /** Base URL del servidor Ollama local, sin barra final (ej. http://localhost:11434). */
    OLLAMA_BASE_URL: z.url().default("http://localhost:11434"),

    /** Modelo de chat por defecto cuando la petición no especifica uno. */
    OLLAMA_DEFAULT_MODEL: z.string().default("gemma4:31b-cloud"),

    /** Modelo de embeddings por defecto cuando la petición no especifica uno. */
    OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),

    /** Timeout (ms) de cada petición al proveedor de IA, vía AbortController. */
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
  })
  .superRefine((data, ctx) => {
    const googleCount = [
      data.GOOGLE_CLIENT_ID,
      data.GOOGLE_CLIENT_SECRET,
      data.GOOGLE_CALLBACK_URL
    ].filter(Boolean).length;
    if (googleCount !== 0 && googleCount !== 3) {
      ctx.addIssue({
        code: "custom",
        message:
          "Google OAuth: set all of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL (or omit all).",
        path: ["GOOGLE_CLIENT_ID"]
      });
    }

    const githubCount = [
      data.GITHUB_CLIENT_ID,
      data.GITHUB_CLIENT_SECRET,
      data.GITHUB_CALLBACK_URL
    ].filter(Boolean).length;
    if (githubCount !== 0 && githubCount !== 3) {
      ctx.addIssue({
        code: "custom",
        message:
          "GitHub OAuth: set all of GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL (or omit all).",
        path: ["GITHUB_CLIENT_ID"]
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment configuration");
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const env: Readonly<Env> = Object.freeze(result.data);

export default env;

export function isGoogleOAuthEnabled(): boolean {
  return !!(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_CALLBACK_URL
  );
}

export function isGitHubOAuthEnabled(): boolean {
  return !!(
    env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET &&
    env.GITHUB_CALLBACK_URL
  );
}

export function isAnyOAuthEnabled(): boolean {
  return isGoogleOAuthEnabled() || isGitHubOAuthEnabled();
}

/** Register in Google Cloud (Authorized redirect URIs) alongside the sign-in callback. */
export function getGoogleLinkCallbackUrl(): string {
  if (env.GOOGLE_LINK_CALLBACK_URL) return env.GOOGLE_LINK_CALLBACK_URL;
  const base = env.GOOGLE_CALLBACK_URL;
  if (!base) {
    throw new Error("Google OAuth is not configured");
  }
  return base.replace(/\/google\/callback\/?$/i, "/link/google/callback");
}
