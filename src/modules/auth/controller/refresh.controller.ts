import type { Request, Response } from "express";

import { findUserById } from "@/modules/oauth/oauth.service";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import { signAccessToken } from "@/shared/utils/jwt";
import { logger } from "@/shared/utils/logger";
import env from "@/shared/configs/env";
import {
  findRefreshTokenByHash,
  hashToken,
  revokeAllUserRefreshTokens,
  revokeRefreshTokenById,
  rotateRefreshToken
} from "@/modules/auth/services/refresh-token.service";
import {
  clearRefreshCookie,
  REFRESH_TOKEN_COOKIE,
  setRefreshCookie
} from "@/modules/auth/utils/refresh-cookie";

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

/**
 * Rota el refresh token y emite un nuevo access token.
 *
 * Flujo:
 * 1. Lee el refresh token opaco de la cookie httpOnly.
 * 2. Hashea el token y busca la fila en DB.
 * 3. Valida que la fila exista, no esté expirada y no esté revocada.
 *    - Si ya está revocada → detección de robo: revoca TODA la sesión del usuario
 *      y responde 401.
 * 4. Verifica que el usuario al que pertenece el token sigue existiendo en DB.
 * 5. Rota el token (revoca el viejo, crea el nuevo).
 * 6. Emite cookie nueva + nuevo access token en el body.
 *
 * @throws {ApiError} 401 si la cookie falta, el hash no se encuentra, el token
 *   está expirado, está revocado o el usuario no existe.
 */
export async function refreshTokens(req: Request, res: Response) {
  const rawToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!rawToken || typeof rawToken !== "string") {
    throw ApiError.unauthorized("Missing refresh token");
  }

  const tokenHash = hashToken(rawToken);
  const existing = await findRefreshTokenByHash(tokenHash);

  if (!existing) {
    // El hash no existe en DB — token inválido o ya eliminado.
    logger.warn({ ip: req.ip }, "Refresh attempt with unknown token hash");
    throw ApiError.unauthorized("Invalid refresh token");
  }

  const now = new Date();

  // ── Detección de robo con ventana de gracia ──────────────────────────────
  //
  // Un token revocado presentado de nuevo puede significar dos cosas distintas:
  //
  // A) Carrera legítima entre pestañas/dispositivos: dos clientes del mismo
  //    usuario hacen refresh casi a la vez. El 2º llega cuando el token ya fue
  //    rotado por el 1º. El token tiene `replacedBy !== null` (fue rotado, no
  //    fue cerrado por logout) y `revokedAt` es muy reciente.
  //    → Respuesta: 401 SIN revocar cadena. El cliente reintentará con el token
  //      nuevo que ya obtuvo el 1º, o hará login si no tiene ninguno válido.
  //
  // B) Robo real: un atacante tiene una copia de un token antiguo y lo presenta
  //    después de que el usuario ya rotó. Se detecta si:
  //    - `replacedBy === null` (el token fue revocado por logout explícito, no
  //      rotación, por lo que nunca debería aparecer de nuevo), o
  //    - `revokedAt` está fuera de la ventana de gracia (demasiado tiempo
  //      transcurrido para ser una carrera de red).
  //    → Respuesta: 401 + revokeAllUserRefreshTokens (nukear toda la sesión).
  if (existing.revokedAt !== null) {
    const gracePeriodMs = env.REFRESH_TOKEN_REUSE_GRACE_SECONDS * 1000;
    const msSinceRevocation = now.getTime() - existing.revokedAt.getTime();
    const isWithinGrace = msSinceRevocation <= gracePeriodMs;
    const wasRotated = existing.replacedBy !== null;

    if (wasRotated && isWithinGrace) {
      // Carrera legítima: no revocar la cadena, solo rechazar este intento.
      logger.warn(
        {
          userId: existing.userId,
          tokenId: existing.id,
          revokedAt: existing.revokedAt,
          msSinceRevocation,
          gracePeriodMs,
          ip: req.ip
        },
        "Refresh reuse within grace window — likely tab race, not theft; returning 401 without chain revocation"
      );
      clearRefreshCookie(res);
      throw ApiError.unauthorized(
        "Token already rotated. Please sign in again."
      );
    }

    // Robo real (o logout previo presentado fuera de gracia): revocar cadena.
    logger.warn(
      {
        userId: existing.userId,
        tokenId: existing.id,
        revokedAt: existing.revokedAt,
        msSinceRevocation,
        wasRotated,
        ip: req.ip
      },
      "Refresh reuse detected outside grace window — revoking all user tokens (possible theft)"
    );
    await revokeAllUserRefreshTokens(existing.userId);
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Session invalidated. Please sign in again.");
  }

  // ── Expiración ────────────────────────────────────────────────────────────
  if (existing.expiresAt < now) {
    logger.info(
      { userId: existing.userId, tokenId: existing.id },
      "Refresh token expired"
    );
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Refresh token expired. Please sign in again.");
  }

  // ── El usuario sigue existiendo ───────────────────────────────────────────
  const user = await findUserById(existing.userId);
  if (!user) {
    logger.warn(
      { userId: existing.userId },
      "Refresh token owner no longer exists"
    );
    await revokeRefreshTokenById(existing.id);
    clearRefreshCookie(res);
    throw ApiError.unauthorized("User not found");
  }

  // ── Rotación ─────────────────────────────────────────────────────────────
  const { plainToken: newPlainToken } = await rotateRefreshToken(existing);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email
  });

  setRefreshCookie(res, newPlainToken);

  return ApiResponse.Success(res, "Token refreshed", { token: accessToken });
}

// ─── POST /auth/logout ────────────────────────────────────────────────────────

/**
 * Revoca el refresh token actual y limpia la cookie del cliente.
 *
 * Es un best-effort: si la cookie no existe o ya está revocada, responde
 * igualmente con 200 (idempotente desde el punto de vista del cliente).
 */
export async function logout(req: Request, res: Response) {
  const rawToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (rawToken && typeof rawToken === "string") {
    const tokenHash = hashToken(rawToken);
    const existing = await findRefreshTokenByHash(tokenHash);

    if (existing && existing.revokedAt === null) {
      await revokeRefreshTokenById(existing.id);
      logger.info(
        { userId: existing.userId, tokenId: existing.id },
        "Refresh token revoked on logout"
      );
    }
  }

  clearRefreshCookie(res);

  return ApiResponse.Success(res, "Logged out", null);
}
