import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";

import db from "@/db";
import { refreshTokensTable } from "@/drizzle/schemas/refresh-tokens.schema";
import env from "@/shared/configs/env";
import { logger } from "@/shared/utils/logger";

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Genera un token opaco seguro de 32 bytes (256 bits) codificado en hex.
 * No es un JWT; es un secreto de sesión que se enviará al cliente en cookie
 * httpOnly. Solo su SHA-256 se almacena en DB.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Calcula el SHA-256 hex de un token opaco.
 * Función pura — el mismo input siempre produce el mismo hash.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Calcula la fecha absoluta de expiración a partir del TTL en segundos.
 */
function expiresAtFromTtl(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}

// ─── tipos públicos ───────────────────────────────────────────────────────────

export type RefreshTokenRow = typeof refreshTokensTable.$inferSelect;

// ─── operaciones de base de datos ────────────────────────────────────────────

/**
 * Crea un nuevo refresh token para el usuario dado y lo persiste en DB.
 * Devuelve el token en claro (solo esta llamada lo ve; nunca más).
 *
 * @param userId - ID del usuario al que pertenece el token.
 * @returns El token opaco en claro y la fila persistida.
 */
export async function createRefreshToken(
  userId: string
): Promise<{ plainToken: string; row: RefreshTokenRow }> {
  const plainToken = generateOpaqueToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = expiresAtFromTtl(env.REFRESH_TOKEN_TTL_SECONDS);

  const id = randomUUID();

  await db.insert(refreshTokensTable).values({
    id,
    userId,
    tokenHash,
    expiresAt,
    revokedAt: null,
    replacedBy: null
  });

  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.id, id))
    .limit(1);

  if (!row) {
    throw new Error("Could not read refresh token after insert");
  }

  logger.info({ userId, tokenId: id }, "Refresh token created");

  return { plainToken, row };
}

/**
 * Busca un refresh token por su hash.
 * Incluye tokens revocados (para detección de robo).
 */
export async function findRefreshTokenByHash(
  tokenHash: string
): Promise<RefreshTokenRow | undefined> {
  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, tokenHash))
    .limit(1);
  return row;
}

/**
 * Rota un refresh token existente:
 * 1. Marca el token viejo como revocado (revokedAt = ahora, replacedBy = hash del nuevo).
 * 2. Inserta el token nuevo.
 * 3. Devuelve el nuevo token en claro.
 *
 * @param oldRow - Fila del token antiguo (ya validado como activo y no expirado).
 * @returns El nuevo token opaco en claro y su fila.
 */
export async function rotateRefreshToken(
  oldRow: RefreshTokenRow
): Promise<{ plainToken: string; row: RefreshTokenRow }> {
  const newPlainToken = generateOpaqueToken();
  const newHash = hashToken(newPlainToken);
  const expiresAt = expiresAtFromTtl(env.REFRESH_TOKEN_TTL_SECONDS);

  const newId = randomUUID();

  // Revocar el antiguo y apuntar a su sucesor en la misma operación.
  await db
    .update(refreshTokensTable)
    .set({
      revokedAt: new Date(),
      replacedBy: newHash
    })
    .where(eq(refreshTokensTable.id, oldRow.id));

  // Insertar el nuevo.
  await db.insert(refreshTokensTable).values({
    id: newId,
    userId: oldRow.userId,
    tokenHash: newHash,
    expiresAt,
    revokedAt: null,
    replacedBy: null
  });

  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.id, newId))
    .limit(1);

  if (!row) {
    throw new Error("Could not read new refresh token after rotation");
  }

  logger.info(
    { userId: oldRow.userId, oldTokenId: oldRow.id, newTokenId: newId },
    "Refresh token rotated"
  );

  return { plainToken: newPlainToken, row };
}

/**
 * Revoca un token específico por su ID de fila (logout o detección de robo puntual).
 */
export async function revokeRefreshTokenById(tokenId: string): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokensTable.id, tokenId),
        isNull(refreshTokensTable.revokedAt)
      )
    );
}

/**
 * Revoca TODOS los tokens activos de un usuario.
 * Se llama cuando se detecta uso de un token ya rotado/revocado (indicador de robo).
 *
 * @param userId - ID del usuario cuya sesión completa se invalida.
 */
export async function revokeAllUserRefreshTokens(
  userId: string
): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokensTable.userId, userId),
        isNull(refreshTokensTable.revokedAt)
      )
    );

  logger.warn(
    { userId },
    "All refresh tokens revoked for user (theft detection or forced logout)"
  );
}

/**
 * Elimina tokens expirados para un usuario. Función auxiliar de limpieza;
 * no es necesaria para el flujo de seguridad pero reduce el tamaño de la tabla.
 * Puede llamarse desde un job periódico si se añade más adelante.
 */
export async function pruneExpiredTokensForUser(userId: string): Promise<void> {
  await db
    .delete(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.userId, userId),
        lt(refreshTokensTable.expiresAt, new Date())
      )
    );
}
