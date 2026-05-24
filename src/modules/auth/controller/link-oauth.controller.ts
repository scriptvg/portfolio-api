import type { NextFunction, Request, Response } from "express";

import passport from "@/shared/configs/passport";
import env from "@/shared/configs/env";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";

/**
 * URL base del cliente frontend sin slash final.
 *
 * Se usa para construir URLs de redirección hacia páginas del cliente,
 * como errores de autenticación o confirmaciones de vinculación.
 */
const clientBase = env.CLIENT_URL.replace(/\/$/, "");

/**
 * URL de la página de error de autenticación en el frontend.
 *
 * Esta página recibe información por query params para mostrar un mensaje
 * adecuado al usuario cuando falla un flujo OAuth.
 */
const authErrorPage = `${clientBase}/auth/error`;

/**
 * Construye la URL de error para un fallo durante el flujo de vinculación OAuth.
 *
 * Esta URL apunta al frontend e incluye el proveedor que falló para que la UI
 * pueda mostrar un mensaje contextual.
 *
 * @param provider - Proveedor OAuth usado en el intento de vinculación.
 * @returns URL absoluta hacia la página de error del cliente.
 */
function authErrorLink(provider: "google" | "github"): string {
  return `${authErrorPage}?flow=link&provider=${provider}`;
}

/**
 * Obtiene el origen público de la API tal como debe verlo el navegador.
 *
 * Prioriza `API_PUBLIC_URL` cuando está configurado correctamente. Esto es útil
 * en producción, especialmente cuando la API está detrás de proxies, gateways,
 * balanceadores de carga o túneles.
 *
 * Si `API_PUBLIC_URL` no existe o es inválida, intenta reconstruir el origen
 * usando headers de proxy como:
 *
 * - `x-forwarded-proto`
 * - `x-forwarded-host`
 *
 * Si esos headers no existen, usa `req.protocol` y `host`.
 *
 * @param req - Request de Express usado para inferir protocolo y host.
 * @returns Origen público de la API, por ejemplo: `https://api.example.com`.
 */
function browserFacingApiOrigin(req: Request): string {
  const configured = env.API_PUBLIC_URL?.trim().replace(/\/+$/, "");

  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* ignore invalid URL */
    }
  }

  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";

  return `${proto}://${host}`;
}

/**
 * Construye una URL absoluta para rutas del módulo de autenticación.
 *
 * Todas las rutas generadas quedan bajo `/api/v1/auth`.
 * Se usa principalmente para devolver al frontend una URL que el navegador
 * debe abrir para continuar el flujo OAuth.
 *
 * @param req - Request de Express usado para obtener el origen público de la API.
 * @param pathFromAuth - Path relativo dentro del módulo auth. Debe iniciar con `/`.
 * @returns URL absoluta hacia una ruta de autenticación.
 *
 * @example
 * absoluteApiUrl(req, "/link/google/redirect");
 * // https://api.example.com/api/v1/auth/link/google/redirect
 */
function absoluteApiUrl(req: Request, pathFromAuth: string) {
  return `${browserFacingApiOrigin(req)}/api/v1/auth${pathFromAuth}`;
}

/**
 * Prepara la sesión para vincular una cuenta de Google al usuario autenticado.
 *
 * Guarda temporalmente el ID del usuario actual en la sesión bajo
 * `linkAccountUserId`. Luego responde con una URL absoluta que el frontend
 * debe abrir en el navegador para iniciar el flujo OAuth de Google.
 *
 * Este endpoint requiere que el usuario ya esté autenticado, porque depende de
 * `req.user!.id`.
 *
 * @param req - Request de Express. Debe contener `req.user.id` y una sesión activa.
 * @param res - Response de Express usado para devolver la URL de redirección.
 * @param next - Middleware de Express para delegar errores.
 *
 * @returns Respuesta HTTP exitosa con `redirectUrl`.
 */
export function prepareGoogleLink(
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.session.linkAccountUserId = req.user!.id;

  req.session.save(err => {
    if (err) {
      return next(err);
    }

    return ApiResponse.Success(
      res,
      "Continue in the browser (include credentials)",
      {
        redirectUrl: absoluteApiUrl(req, "/link/google/redirect")
      }
    );
  });
}

/**
 * Prepara la sesión para vincular una cuenta de GitHub al usuario autenticado.
 *
 * Guarda temporalmente el ID del usuario actual en la sesión bajo
 * `linkAccountUserId`. Luego responde con una URL absoluta que el frontend
 * debe abrir en el navegador para iniciar el flujo OAuth de GitHub.
 *
 * Este endpoint requiere que el usuario ya esté autenticado, porque depende de
 * `req.user!.id`.
 *
 * @param req - Request de Express. Debe contener `req.user.id` y una sesión activa.
 * @param res - Response de Express usado para devolver la URL de redirección.
 * @param next - Middleware de Express para delegar errores.
 *
 * @returns Respuesta HTTP exitosa con `redirectUrl`.
 */
export function prepareGitHubLink(
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.session.linkAccountUserId = req.user!.id;

  req.session.save(err => {
    if (err) {
      return next(err);
    }

    return ApiResponse.Success(
      res,
      "Continue in the browser (include credentials)",
      {
        redirectUrl: absoluteApiUrl(req, "/link/github/redirect")
      }
    );
  });
}

/**
 * Middleware que valida que exista una sesión activa de vinculación de cuenta.
 *
 * Este middleware protege las rutas que continúan el flujo OAuth de linkeo.
 * Si `linkAccountUserId` no existe en la sesión, significa que el usuario no
 * inició el proceso correctamente o que la sesión expiró.
 *
 * @param req - Request de Express. Debe contener la sesión del usuario.
 * @param _res - Response de Express. No se usa directamente.
 * @param next - Middleware de Express para continuar el flujo o delegar errores.
 *
 * @throws {ApiError} Cuando la sesión de vinculación no existe o expiró.
 */
export function requireLinkSession(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.session.linkAccountUserId) {
    return next(
      ApiError.unauthorized(
        "Link session expired. Start again from POST /auth/link/google or /auth/link/github with credentials: include."
      )
    );
  }

  next();
}

/**
 * Middlewares para iniciar la redirección hacia Google OAuth en modo link.
 *
 * Primero valida que exista una sesión de vinculación y luego delega el flujo
 * a Passport usando la estrategia `google-link`.
 *
 * Scopes solicitados:
 * - `profile`
 * - `email`
 */
export const redirectGoogleLink = [
  requireLinkSession,
  passport.authenticate("google-link", { scope: ["profile", "email"] })
];

/**
 * Middlewares para iniciar la redirección hacia GitHub OAuth en modo link.
 *
 * Primero valida que exista una sesión de vinculación y luego delega el flujo
 * a Passport usando la estrategia `github`.
 *
 * Scopes solicitados:
 * - `user:email`
 */
export const redirectGitHubLink = [
  requireLinkSession,
  passport.authenticate("github", { scope: ["user:email"] })
];

/**
 * Crea un handler para finalizar el flujo de vinculación OAuth.
 *
 * Después de que Passport autentica correctamente el proveedor, este handler:
 *
 * 1. Cierra la sesión temporal de Passport con `req.logout`.
 * 2. Elimina `linkAccountUserId` de la sesión.
 * 3. Guarda la sesión actualizada.
 * 4. Redirige al frontend a la pantalla de cuenta vinculada.
 *
 * @param provider - Proveedor OAuth que fue vinculado correctamente.
 * @returns Handler de Express que finaliza el flujo y redirige al cliente.
 */
export function finalizeLinkRedirect(provider: "google" | "github") {
  return (req: Request, res: Response, next: NextFunction) => {
    req.logout(logoutErr => {
      if (logoutErr) {
        return next(logoutErr);
      }

      delete req.session.linkAccountUserId;

      req.session.save(saveErr => {
        if (saveErr) {
          return next(saveErr);
        }

        res.redirect(`${clientBase}/auth/linked?provider=${provider}`);
      });
    });
  };
}

/**
 * Middlewares del callback de Google para vinculación de cuenta.
 *
 * Passport procesa la respuesta de Google usando la estrategia `google-link`.
 * Si falla, el usuario es redirigido al frontend con información del error.
 * Si funciona, se finaliza el flujo limpiando la sesión temporal y redirigiendo
 * al frontend.
 */
export const googleLinkCallback = [
  passport.authenticate("google-link", {
    failureRedirect: authErrorLink("google")
  }),
  finalizeLinkRedirect("google")
];
