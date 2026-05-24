import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";

import { findUserById } from "@/modules/oauth/oauth.service";
import { patchUserProfile } from "@/modules/settings/settings.service";
import {
  changePasswordSchema,
  patchMeSchema
} from "@/modules/settings/settings.validators";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import { toPublicUser } from "@/shared/utils/user-public";
import db from "@/db";
import { usersTable } from "@/drizzle/schemas/user.schema";
import { eq } from "drizzle-orm";

/**
 * Número de rondas usadas por bcrypt para generar hashes de contraseñas.
 *
 * A mayor número de rondas, mayor costo computacional y mayor resistencia
 * frente a ataques de fuerza bruta. Este valor debe mantenerse balanceado
 * para no afectar demasiado el rendimiento del servidor.
 */
const SALT_ROUNDS = 10;

/**
 * Construye un resumen de los métodos de autenticación activos para un usuario.
 *
 * Esta función permite informar al frontend si la cuenta tiene contraseña local
 * y/o proveedores OAuth vinculados como Google o GitHub.
 *
 * @param row - Fila de usuario con los campos necesarios para determinar métodos de autenticación.
 *
 * @returns Objeto con banderas booleanas para cada método de autenticación disponible.
 *
 * @example
 * authMethodsFromRow({
 *   passwordHash: "hashed-password",
 *   googleId: null,
 *   githubId: "github-user-id"
 * });
 *
 * // {
 * //   password: true,
 * //   google: false,
 * //   github: true
 * // }
 */
function authMethodsFromRow(row: {
  passwordHash: string | null;
  googleId: string | null;
  githubId: string | null;
}) {
  return {
    password: !!row.passwordHash,
    google: !!row.googleId,
    github: !!row.githubId
  };
}

/**
 * Actualiza parcialmente el perfil del usuario autenticado.
 *
 * Permite modificar únicamente los campos permitidos por `patchMeSchema`,
 * actualmente `name` e `image`.
 *
 * Flujo principal:
 * 1. Valida el body usando Zod.
 * 2. Verifica que al menos un campo actualizable haya sido enviado.
 * 3. Actualiza el perfil del usuario autenticado.
 * 4. Devuelve el usuario público junto con sus métodos de autenticación activos.
 *
 * Requiere que un middleware de autenticación haya agregado previamente
 * `req.user` al objeto `Request`.
 *
 * @param req - Request de Express. Debe contener `req.user.id` y opcionalmente `name` o `image` en `body`.
 * @param res - Response de Express usado para enviar la respuesta HTTP.
 *
 * @returns Respuesta HTTP exitosa con el perfil público actualizado y los métodos de autenticación.
 *
 * @throws {ApiError} Cuando el body no cumple con el esquema esperado.
 * @throws {ApiError} Cuando no se envía ningún campo para actualizar.
 */
export async function patchMe(req: Request, res: Response) {
  const parsed = patchMeSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  if (parsed.data.name === undefined && parsed.data.image === undefined) {
    throw ApiError.badRequest("No fields to update");
  }

  const row = await patchUserProfile(req.user!.id, {
    name: parsed.data.name,
    image: parsed.data.image
  });

  return ApiResponse.Success(res, "Profile updated", {
    ...toPublicUser(row),
    authMethods: authMethodsFromRow(row)
  });
}

/**
 * Cambia la contraseña del usuario autenticado.
 *
 * Este endpoint se usa cuando el usuario ya tiene una contraseña local
 * configurada y desea reemplazarla por una nueva.
 *
 * Flujo principal:
 * 1. Valida el body usando `changePasswordSchema`.
 * 2. Busca el usuario autenticado en base de datos.
 * 3. Verifica que el usuario exista.
 * 4. Verifica que la cuenta tenga una contraseña local configurada.
 * 5. Compara la contraseña actual contra el hash almacenado.
 * 6. Genera un nuevo hash para la nueva contraseña.
 * 7. Actualiza la contraseña en base de datos.
 * 8. Devuelve una respuesta exitosa sin exponer datos sensibles.
 *
 * Reglas importantes:
 * - Si la cuenta no tiene contraseña local, debe usarse el flujo de
 *   `linkPassword` en lugar de `changePassword`.
 * - La contraseña actual nunca se compara directamente como texto plano;
 *   se compara usando `bcrypt.compare`.
 * - La nueva contraseña se almacena siempre como hash, nunca como texto plano.
 *
 * Requiere que un middleware de autenticación haya agregado previamente
 * `req.user` al objeto `Request`.
 *
 * @param req - Request de Express. Debe contener `req.user.id`, `currentPassword` y `newPassword`.
 * @param res - Response de Express usado para enviar la respuesta HTTP.
 *
 * @returns Respuesta HTTP exitosa indicando que la contraseña fue actualizada.
 *
 * @throws {ApiError} Cuando el body no cumple con el esquema esperado.
 * @throws {ApiError} Cuando el token es inválido o el usuario no existe.
 * @throws {ApiError} Cuando la cuenta no tiene contraseña local configurada.
 * @throws {ApiError} Cuando la contraseña actual es incorrecta.
 */
export async function changePassword(req: Request, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const row = await findUserById(req.user!.id);

  if (!row) {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  if (!row.passwordHash) {
    throw ApiError.badRequest(
      "No password is set. Use link password instead of change password."
    );
  }

  const matches = await bcrypt.compare(
    parsed.data.currentPassword,
    row.passwordHash
  );

  if (!matches) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);

  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, row.id));

  return ApiResponse.Success(res, "Password updated", null);
}
