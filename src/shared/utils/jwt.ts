import jwt, { type SignOptions } from "jsonwebtoken";

import env from "@/shared/configs/env";

export type AccessTokenPayload = { sub: string; email: string };

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof decoded === "string" ||
    decoded === null ||
    typeof decoded !== "object"
  ) {
    throw new Error("Invalid token");
  }

  const sub =
    "sub" in decoded && typeof decoded.sub === "string" ? decoded.sub : null;
  const email =
    "email" in decoded && typeof decoded.email === "string"
      ? decoded.email
      : null;

  if (!sub || !email) {
    throw new Error("Invalid token payload");
  }

  return { sub, email };
}
