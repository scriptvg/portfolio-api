import { Router, type Response } from "express";

import {
  getMe,
  githubCallback,
  googleCallback,
  startGitHub,
  startGoogle,
  unlinkGitHub,
  unlinkGoogle
} from "./oauth.controller";
import {
  signin,
  signup,
  linkPassword
} from "@/modules/auth/controller/credentials.controller";
import {
  changePassword,
  patchMe
} from "@/modules/auth/controller/profile.controller";
import {
  googleLinkCallback,
  prepareGitHubLink,
  prepareGoogleLink,
  redirectGitHubLink,
  redirectGoogleLink
} from "@/modules/auth/controller/link-oauth.controller";
import {
  refreshTokens,
  logout
} from "@/modules/auth/controller/refresh.controller";
import {
  isGitHubOAuthEnabled,
  isGoogleOAuthEnabled
} from "@/shared/configs/env";
import { requireJwt } from "@/shared/middlewares/require-jwt";
import { requireKnownOrigin } from "@/shared/middlewares/require-known-origin";
import { authLimiter, refreshLimiter } from "@/shared/middlewares/rate-limiter";

const router = Router();

function oauthDisabled(_: unknown, res: Response) {
  return res.status(503).json({
    success: false,
    message: "This OAuth provider is not configured on the server"
  });
}

if (isGoogleOAuthEnabled()) {
  router.get("/google", startGoogle);
  router.get("/google/callback", ...googleCallback);
} else {
  router.get("/google", oauthDisabled);
  router.get("/google/callback", oauthDisabled);
}

if (isGitHubOAuthEnabled()) {
  router.get("/github", startGitHub);
  router.get("/github/callback", ...githubCallback);
} else {
  router.get("/github", oauthDisabled);
  router.get("/github/callback", oauthDisabled);
}

if (isGoogleOAuthEnabled()) {
  router.post("/link/google", requireJwt, prepareGoogleLink);
  router.get("/link/google/redirect", ...redirectGoogleLink);
  router.get("/link/google/callback", ...googleLinkCallback);
} else {
  router.post("/link/google", oauthDisabled);
  router.get("/link/google/redirect", oauthDisabled);
  router.get("/link/google/callback", oauthDisabled);
}

// GitHub OAuth Apps solo admiten una callback URL, así que el link reentra por
// `/github/callback` (controllers/oauth.controller.ts) y discrimina por
// `req.session.linkAccountUserId`. Por eso no existe `/link/github/callback`,
// a diferencia de Google que sí lo tiene.
if (isGitHubOAuthEnabled()) {
  router.post("/link/github", requireJwt, prepareGitHubLink);
  router.get("/link/github/redirect", ...redirectGitHubLink);
} else {
  router.post("/link/github", oauthDisabled);
  router.get("/link/github/redirect", oauthDisabled);
}

router.delete("/unlink/github", requireJwt, unlinkGitHub);
router.delete("/unlink/google", requireJwt, unlinkGoogle);

// authLimiter (5 req/min) solo en los endpoints de credenciales sensibles:
// signup y signin son superficies de fuerza bruta; change-password es de alto
// valor si un JWT queda expuesto. El resto del router cae bajo el apiLimiter
// global (100/min), suficiente para GET /me, callbacks OAuth y links de proveedor.
router.post("/signup", authLimiter, signup);
router.post("/signin", authLimiter, signin);
router.post("/link/password", requireJwt, linkPassword);

router.get("/me", requireJwt, getMe);
router.patch("/me", requireJwt, patchMe);
router.post("/change-password", requireJwt, authLimiter, changePassword);

// Refresh y logout usan refreshLimiter (30/min), NO authLimiter (5/min),
// porque el cliente llama a /refresh legítimamente cada ~15 min.
// requireKnownOrigin va antes del rate-limiter para rechazar orígenes
// desconocidos sin consumir cuota — pero el orden funcional es correcto en
// cualquier caso. El middleware valida Origin/Referer para mitigar CSRF simple
// requests (POST sin body no dispara preflight con SameSite=None en prod).
router.post("/refresh", requireKnownOrigin, refreshLimiter, refreshTokens);
router.post("/logout", requireKnownOrigin, refreshLimiter, logout);

export default router;
