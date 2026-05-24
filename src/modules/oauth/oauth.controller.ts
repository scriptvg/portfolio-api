import type { NextFunction, Request, Response } from "express";

import passport from "@/shared/configs/passport";
import env from "@/shared/configs/env";
import { finalizeLinkRedirect } from "@/modules/auth/controller/link-oauth.controller";
import {
  findUserById,
  unlinkGitHubFromUser,
  unlinkGoogleFromUser
} from "@/modules/oauth/oauth.service";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import { signAccessToken } from "@/shared/utils/jwt";
import { toPublicUser } from "@/shared/utils/user-public";

const authErrorLogin = `${env.CLIENT_URL.replace(/\/$/, "")}/auth/error?flow=login`;
const authErrorGitHubOAuth = `${env.CLIENT_URL.replace(/\/$/, "")}/auth/error?flow=github`;

function clientCallbackUrl(token: string): string {
  const base = env.CLIENT_URL.replace(/\/$/, "");
  return `${base}/auth/callback?token=${encodeURIComponent(token)}`;
}

/** Login Google: limpia sesión de "link" para no mezclar flujos. */
export function startGoogle(req: Request, res: Response, next: NextFunction) {
  delete req.session.linkAccountUserId;
  req.session.save(err => {
    if (err) {
      return next(err);
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(
      req,
      res,
      next
    );
  });
}

/** Login GitHub: una sola URL de callback en GitHub OAuth App — coincide con vincular vía sesión. */
export function startGitHub(req: Request, res: Response, next: NextFunction) {
  delete req.session.linkAccountUserId;
  req.session.save(err => {
    if (err) {
      return next(err);
    }
    passport.authenticate("github", { scope: ["user:email"] })(req, res, next);
  });
}

export const googleCallback = [
  passport.authenticate("google", {
    failureRedirect: authErrorLogin,
    session: true
  }),
  oauthSuccessRedirect
];

export const githubCallback = [
  passport.authenticate("github", {
    failureRedirect: authErrorGitHubOAuth,
    session: true
  }),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.session.linkAccountUserId) {
      return finalizeLinkRedirect("github")(req, res, next);
    }
    return oauthSuccessRedirect(req, res, next);
  }
];

function oauthSuccessRedirect(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.redirect(authErrorLogin);
  }

  const token = signAccessToken({ sub: user.id, email: user.email });

  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect(clientCallbackUrl(token));
  });
}

export async function getMe(req: Request, res: Response) {
  const row = await findUserById(req.user!.id);
  if (!row) {
    throw ApiError.unauthorized("Invalid or expired token");
  }
  return ApiResponse.Success(res, "Profile", {
    ...toPublicUser(row),
    authMethods: {
      password: !!row.passwordHash,
      google: !!row.googleId,
      github: !!row.githubId
    }
  });
}

export async function unlinkGitHub(req: Request, res: Response) {
  await unlinkGitHubFromUser(req.user!.id);
  return ApiResponse.Success(res, "GitHub desvinculado", null);
}

export async function unlinkGoogle(req: Request, res: Response) {
  await unlinkGoogleFromUser(req.user!.id);
  return ApiResponse.Success(res, "Google desvinculado", null);
}
