import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";

import db from "@/db";
import { usersTable } from "@/drizzle/schemas/user.schema";
import { findUserByEmail, findUserById } from "@/modules/oauth/oauth.service";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import { signAccessToken } from "@/shared/utils/jwt";
import { toPublicUser } from "@/shared/utils/user-public";
import { eq } from "drizzle-orm";

/**
 * @name - SALT_ROUNDS
 * @description - Número de rondas usadas por bcrypt para generar el hash de contraseñas.
 *
 * @warn - Un valor más alto aumenta la seguridad, pero también incrementa el tiempo de procesamiento.
 */
const SALT_ROUNDS = 10;

/**
 * Esquema de validación para el registro de usuarios.
 *
 * Valida que:
 * - El email tenga formato válido.
 * - La contraseña tenga entre 8 y 128 caracteres.
 * - El nombre sea opcional, pero si existe debe tener entre 1 y 255 caracteres.
 */
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255).optional()
});

/**
 * Esquema de validación para el inicio de sesión.
 *
 * Valida que:
 * - El email tenga formato válido.
 * - La contraseña no esté vacía y no supere los 128 caracteres.
 */
const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});

/**
 * Esquema de validación para vincular una contraseña a una cuenta existente.
 *
 * Este flujo se usa normalmente cuando un usuario fue creado mediante OAuth
 * —por ejemplo Google o GitHub— y luego desea agregar autenticación por contraseña.
 */
const linkPasswordSchema = z.object({
  password: z.string().min(8).max(128)
});

/**
 * @name - signup
 * @description - Registra un nuevo usuario usando email y contraseña.
 *
 * Flujo principal:
 * 1. Valida el cuerpo de la petición.
 * 2. Normaliza el email a minúsculas.
 * 3. Verifica si ya existe una cuenta con ese email.
 * 4. Genera un hash seguro de la contraseña.
 * 5. Crea el usuario en base de datos.
 * 6. Genera un access token.
 * 7. Devuelve el usuario en formato público junto con el token.
 *
 * Reglas importantes:
 * - Si el email ya existe con contraseña, se indica que debe iniciar sesión.
 * - Si el email ya existe por login social, se indica que debe iniciar sesión
 *   con el proveedor correspondiente y luego vincular una contraseña.
 *
 * @param req - Request de Express. Debe contener `email`, `password` y opcionalmente `name` en `body`.
 * @param res - Response de Express usado para enviar la respuesta HTTP.
 *
 * @returns Respuesta HTTP 201 con el token JWT y los datos públicos del usuario creado.
 *
 * @throws {ApiError} Cuando el body es inválido.
 * @throws {ApiError} Cuando ya existe una cuenta con el mismo email.
 * @throws {ApiError} Cuando no se puede crear o cargar el usuario después de insertarlo.
 */
export async function signup(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const { email, password, name } = parsed.data;

  /**
   * @name - normalizedEmail
   * @description - Se normaliza el email para evitar duplicados causados por diferencias
   * de mayúsculas, espacios iniciales o espacios finales.
   */
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    if (existing.passwordHash) {
      throw ApiError.conflict(
        "An account with this email already exists. Sign in instead."
      );
    }

    throw ApiError.conflict(
      "This email already has an account via social login. Sign in with Google or GitHub, then you can add a password or link the other provider in settings."
    );
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = randomUUID();

  /**
   * @name - displayName
   * @description - Si el usuario no envía un nombre, se usa la parte previa al @ del email.
   * Si por alguna razón no existe, se usa "User" como valor por defecto.
   */
  const displayName = name?.trim() || normalizedEmail.split("@")[0] || "User";

  await db.insert(usersTable).values({
    id,
    name: displayName,
    email: normalizedEmail,
    age: 0,
    passwordHash,
    image: null,
    googleId: null,
    githubId: null
  });

  /**
   * @name - created
   * @description - Se vuelve a consultar el usuario recién creado para obtener la fila
   * completa desde la base de datos antes de generar la respuesta.
   */
  const [created] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!created) {
    throw ApiError.server("Could not create user");
  }

  const token = signAccessToken({
    sub: created.id,
    email: created.email
  });

  return ApiResponse.created(res, "Account created", {
    token,
    user: toPublicUser(created)
  });
}

/**
 * @name - login
 * @description - Inicia sesión usando email y contraseña.
 *
 * Flujo principal:
 * 1. Valida el cuerpo de la petición.
 * 2. Normaliza el email.
 * 3. Busca el usuario por email.
 * 4. Verifica que el usuario tenga contraseña configurada.
 * 5. Compara la contraseña recibida contra el hash almacenado.
 * 6. Genera un access token.
 * 7. Devuelve el usuario en formato público junto con el token.
 *
 * Por seguridad, cuando el usuario no existe, no tiene contraseña o la contraseña
 * es incorrecta, se devuelve el mismo mensaje genérico:
 * `"Invalid email or password"`.
 *
 * @param req - Request de Express. Debe contener `email` y `password` en `body`.
 * @param res - Response de Express usado para enviar la respuesta HTTP.
 *
 * @returns Respuesta HTTP exitosa con el token JWT y los datos públicos del usuario.
 *
 * @throws {ApiError} Cuando el body es inválido.
 * @throws {ApiError} Cuando el email o la contraseña son inválidos.
 */
export async function signin(req: Request, res: Response) {
  const parsed = signinSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user?.passwordHash) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!ok) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = signAccessToken({
    sub: user.id,
    email: user.email
  });

  return ApiResponse.Success(res, "Signed in", {
    token,
    user: toPublicUser(user)
  });
}

/**
 * @name - linkPassword
 * @description - Vincula una contraseña a una cuenta existente.
 *
 * Este controlador está pensado para usuarios autenticados que ya tienen una
 * cuenta creada mediante OAuth, pero todavía no tienen contraseña local.
 *
 * Flujo principal:
 * 1. Valida la nueva contraseña.
 * 2. Obtiene el usuario autenticado usando `req.user.id`.
 * 3. Verifica que el usuario exista.
 * 4. Verifica que todavía no tenga contraseña configurada.
 * 5. Genera el hash de la nueva contraseña.
 * 6. Actualiza el usuario en base de datos.
 * 7. Devuelve el usuario actualizado y sus métodos de autenticación activos.
 *
 * Requiere que un middleware de autenticación haya agregado previamente
 * `req.user` al objeto Request.
 *
 * @param req - Request de Express. Debe contener `password` en `body` y `req.user.id`.
 * @param res - Response de Express usado para enviar la respuesta HTTP.
 *
 * @returns Respuesta HTTP exitosa con el usuario público y los métodos de autenticación disponibles.
 *
 * @throws {ApiError} Cuando el body es inválido.
 * @throws {ApiError} Cuando el token es inválido o el usuario no existe.
 * @throws {ApiError} Cuando la cuenta ya tiene una contraseña configurada.
 * @throws {ApiError} Cuando no se puede cargar el usuario actualizado.
 */
export async function linkPassword(req: Request, res: Response) {
  const parsed = linkPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const row = await findUserById(req.user!.id);

  if (!row) {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  if (row.passwordHash) {
    throw ApiError.conflict("A password is already set for this account");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, SALT_ROUNDS);

  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, row.id));

  const fresh = await findUserById(row.id);

  if (!fresh) {
    throw ApiError.server("Could not load user");
  }

  return ApiResponse.Success(res, "Password linked", {
    user: toPublicUser(fresh),
    authMethods: {
      password: true,
      google: !!fresh.googleId,
      github: !!fresh.githubId
    }
  });
}
