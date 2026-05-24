import type { Request } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import type { Profile as GitHubProfile } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type {
  Profile as GoogleProfile,
  VerifyCallback
} from "passport-google-oauth20";

import {
  findOrCreateOAuthUser,
  findUserById,
  linkGitHubToUser,
  linkGoogleToUser
} from "@/modules/oauth/oauth.service";
import {
  fetchGitHubVerifiedEmailDetails,
  fetchVerifiedGitHubEmails,
  pickGitHubLoginEmail
} from "@/shared/utils/github-user-emails";
import env, {
  getGoogleLinkCallbackUrl,
  isGitHubOAuthEnabled,
  isGoogleOAuthEnabled
} from "@/shared/configs/env";
import { toPublicUser } from "@/shared/utils/user-public";

/** passport-github2 a veces expone `emails` como no-array; evita spread sobre undefined. */
function githubProfileEmailValues(profile: GitHubProfile): string[] {
  const raw = profile.emails;
  if (!raw) {
    return [];
  }
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map(e => (e && typeof e === "object" && "value" in e ? e.value : ""))
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await findUserById(id);
    done(null, user ? toPublicUser(user) : false);
  } catch (err) {
    done(err);
  }
});

if (isGoogleOAuthEnabled()) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: env.GOOGLE_CALLBACK_URL!
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile,
        done: VerifyCallback
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("Google account has no email"));
          }
          const user = await findOrCreateOAuthUser({
            provider: "google",
            providerId: profile.id,
            email,
            name: profile.displayName || email.split("@")[0] || "User",
            image: profile.photos?.[0]?.value
          });
          return done(null, toPublicUser(user));
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

if (isGoogleOAuthEnabled()) {
  passport.use(
    "google-link",
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: getGoogleLinkCallbackUrl(),
        passReqToCallback: true
      },
      async (
        req: Request,
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile,
        done: VerifyCallback
      ) => {
        try {
          const linkUserId = req.session?.linkAccountUserId;
          if (!linkUserId) {
            return done(new Error("Link session expired"));
          }
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();
          if (!email) {
            return done(new Error("Google account has no email"));
          }
          const row = await linkGoogleToUser(linkUserId, {
            googleId: profile.id,
            email,
            displayName: profile.displayName,
            photoUrl: profile.photos?.[0]?.value
          });
          return done(null, toPublicUser(row));
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

if (isGitHubOAuthEnabled()) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
        callbackURL: env.GITHUB_CALLBACK_URL!,
        passReqToCallback: true
      },
      async (
        req: Request,
        accessToken: string,
        _refreshToken: string,
        profile: GitHubProfile,
        done: VerifyCallback
      ) => {
        try {
          const linkUserId = req.session?.linkAccountUserId;

          if (linkUserId) {
            const profileEmails = [...githubProfileEmailValues(profile)];
            if (
              !profileEmails.length &&
              typeof profile.username === "string" &&
              profile.username
            ) {
              profileEmails.push(
                `${profile.id}+${profile.username}@users.noreply.github.com`
              );
            }

            const apiEmails = await fetchVerifiedGitHubEmails(accessToken);
            const merged = [
              ...new Set(
                [...profileEmails, ...apiEmails]
                  .map(e => e.trim().toLowerCase())
                  .filter(e => e.length > 0)
              )
            ];

            const row = await linkGitHubToUser(linkUserId, {
              githubId: String(profile.id),
              profileEmails: merged,
              displayName:
                profile.displayName ??
                (typeof profile.username === "string" ? profile.username : ""),
              photoUrl: profile.photos?.[0]?.value
            });
            return done(null, toPublicUser(row));
          }

          const profileEmailStrings = [...githubProfileEmailValues(profile)];
          const apiEmailDetails =
            await fetchGitHubVerifiedEmailDetails(accessToken);
          let email = pickGitHubLoginEmail(
            apiEmailDetails,
            profileEmailStrings
          );
          if (!email && profile.username) {
            email = `${profile.id}+${profile.username}@users.noreply.github.com`;
          }
          if (!email) {
            return done(new Error("GitHub account has no email"));
          }
          const user = await findOrCreateOAuthUser({
            provider: "github",
            providerId: String(profile.id),
            email,
            name: profile.displayName || profile.username || email,
            image: profile.photos?.[0]?.value
          });
          return done(null, toPublicUser(user));
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export default passport;
