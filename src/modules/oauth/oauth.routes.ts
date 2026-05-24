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
  isGitHubOAuthEnabled,
  isGoogleOAuthEnabled
} from "@/shared/configs/env";
import { requireJwt } from "@/shared/middlewares/require-jwt";

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

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/link/password", requireJwt, linkPassword);

router.get("/me", requireJwt, getMe);
router.patch("/me", requireJwt, patchMe);
router.post("/change-password", requireJwt, changePassword);

export default router;
