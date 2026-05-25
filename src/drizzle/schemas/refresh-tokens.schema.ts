import { relations, sql } from "drizzle-orm";
import { char, datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core";

import { usersTable } from "./user.schema";

/**
 * Tabla de refresh tokens para la rotación segura de sesiones.
 *
 * Principios de diseño:
 * - El token en claro NUNCA se almacena. Solo se guarda un SHA-256 hex (64 chars)
 *   del token opaco emitido al cliente vía cookie httpOnly.
 * - `revokedAt` se establece en la rotación (el token viejo se revoca al emitir
 *   el nuevo), en logout explícito, y en detección de robo.
 * - `replacedBy` guarda el hash del token sucesor, formando una cadena de
 *   rotación auditable. Si un token ya rotado vuelve a usarse (reuse detection),
 *   se puede revocar toda la familia del usuario.
 */
export const refreshTokensTable = mysqlTable("refresh_tokens", {
  /**
   * UUID v4 generado por la aplicación antes del INSERT.
   */
  id: varchar({ length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  /** FK a la tabla de usuarios. ON DELETE CASCADE: si el usuario se borra, sus tokens también. */
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  /**
   * SHA-256 hex (64 chars) del token opaco emitido al cliente.
   * UNIQUE para que la búsqueda por hash sea O(1) vía índice.
   */
  tokenHash: char("token_hash", { length: 64 }).notNull().unique(),

  /** Momento absoluto en que este token expira. */
  expiresAt: datetime("expires_at", { fsp: 0 }).notNull(),

  createdAt: datetime("created_at", { fsp: 0 })
    .notNull()
    .default(sql`(now())`),

  /**
   * Cuando se rota, el token anterior se marca con la fecha de revocación.
   * En logout se marca el token activo. En detección de robo, toda la cadena.
   */
  revokedAt: datetime("revoked_at", { fsp: 0 }),

  /**
   * Hash del token que reemplazó a este en la rotación.
   * Permite reconstruir la cadena de rotación si se detecta reuse.
   * NULL en tokens aún no rotados.
   */
  replacedBy: char("replaced_by", { length: 64 })
});

export const refreshTokensRelations = relations(
  refreshTokensTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [refreshTokensTable.userId],
      references: [usersTable.id]
    })
  })
);
