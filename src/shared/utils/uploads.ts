import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";

import type { Request } from "express";
import multer, { MulterError } from "multer";

import env from "@/shared/configs/env";
import { ApiError } from "@/shared/errors/api-error";

export const UPLOADS_PUBLIC_PREFIX = "/uploads";

export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
export const AVATARS_DIR_NAME = "avatars";
export const AVATARS_DIR = path.join(UPLOADS_ROOT, AVATARS_DIR_NAME);
export const PROJECT_IMAGES_DIR_NAME = "projects";
export const PROJECT_IMAGES_DIR = path.join(
  UPLOADS_ROOT,
  PROJECT_IMAGES_DIR_NAME
);

/** Crea las carpetas de uploads si no existen (idempotente). */
export function ensureUploadDirs(): void {
  if (!existsSync(UPLOADS_ROOT)) {
    mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
  if (!existsSync(AVATARS_DIR)) {
    mkdirSync(AVATARS_DIR, { recursive: true });
  }
  if (!existsSync(PROJECT_IMAGES_DIR)) {
    mkdirSync(PROJECT_IMAGES_DIR, { recursive: true });
  }
}

ensureUploadDirs();

const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, AVATARS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    const safeExt = /^\.(jpe?g|png|webp|gif)$/i.test(ext) ? ext : ".bin";
    cb(null, `${randomUUID()}${safeExt}`);
  }
});

export const avatarUploader = multer({
  storage: avatarStorage,
  limits: {
    fileSize: AVATAR_MAX_BYTES,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_ALLOWED_MIMES.has(file.mimetype)) {
      cb(
        new ApiError(
          400,
          "Formato no permitido. Usa JPG, PNG, WebP o GIF."
        ) as unknown as Error
      );
      return;
    }
    cb(null, true);
  }
});

/** Convierte el error de multer en un `ApiError` legible. */
export function normalizeMulterError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return ApiError.badRequest("La imagen supera el tamaño máximo (4 MB).");
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return ApiError.badRequest("Campo de archivo inesperado.");
    }
    return ApiError.badRequest(`Error al subir el archivo: ${err.message}`);
  }
  if (err instanceof Error) return ApiError.badRequest(err.message);
  return ApiError.badRequest("No se pudo procesar el archivo subido");
}

/** Origen público desde el que sirve los uploads (preferir `API_PUBLIC_URL`). */
export function publicApiOrigin(req: Request): string {
  const configured = env.API_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* invalid URL, fall through */
    }
  }
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}`;
}

/** Convierte un nombre de archivo de avatar en URL absoluta servida por la API. */
export function avatarPublicUrl(req: Request, filename: string): string {
  return `${publicApiOrigin(req)}${UPLOADS_PUBLIC_PREFIX}/${AVATARS_DIR_NAME}/${filename}`;
}

const PROJECT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PROJECT_IMAGE_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const projectImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, PROJECT_IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    const safeExt = /^\.(jpe?g|png|webp|gif)$/i.test(ext) ? ext : ".bin";
    cb(null, `${randomUUID()}${safeExt}`);
  }
});

export const projectImageUploader = multer({
  storage: projectImageStorage,
  limits: {
    fileSize: PROJECT_IMAGE_MAX_BYTES,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!PROJECT_IMAGE_ALLOWED_MIMES.has(file.mimetype)) {
      cb(
        new ApiError(
          400,
          "Formato no permitido. Usa JPG, PNG, WebP o GIF."
        ) as unknown as Error
      );
      return;
    }
    cb(null, true);
  }
});

/** Convierte un nombre de archivo de imagen de proyecto en URL absoluta. */
export function projectImagePublicUrl(req: Request, filename: string): string {
  return `${publicApiOrigin(req)}${UPLOADS_PUBLIC_PREFIX}/${PROJECT_IMAGES_DIR_NAME}/${filename}`;
}

/** Elimina (best-effort) un avatar previo si vive en nuestro filesystem. */
export async function tryDeletePreviousAvatar(
  previousUrl: string | null | undefined
): Promise<void> {
  if (!previousUrl) return;
  const marker = `${UPLOADS_PUBLIC_PREFIX}/${AVATARS_DIR_NAME}/`;
  const idx = previousUrl.indexOf(marker);
  if (idx === -1) return;

  const filename = previousUrl.slice(idx + marker.length).split(/[?#]/)[0];
  if (!filename || filename.includes("/") || filename.includes("\\")) return;

  const fullPath = path.join(AVATARS_DIR, filename);
  if (!fullPath.startsWith(AVATARS_DIR)) return;

  try {
    await unlink(fullPath);
  } catch {
    /* archivo ya no existe o no es accesible — ignorar */
  }
}
