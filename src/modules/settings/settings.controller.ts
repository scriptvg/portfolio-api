import type { Request, Response } from "express";
import { z } from "zod";

import {
  clearWorkspaceAvatarUrl,
  getOrCreateUserSettings,
  patchNotificationPreferences,
  patchPanelPreferences,
  patchWorkspaceSettings,
  replaceWorkspaceAvatarUrl
} from "@/modules/settings/settings.service";
import { emit } from "@/modules/webhooks/webhook-dispatcher";
import {
  patchNotificationsSchema,
  patchPanelSchema,
  patchWorkspaceSchema
} from "@/modules/settings/settings.validators";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import {
  avatarPublicUrl,
  tryDeletePreviousAvatar
} from "@/shared/utils/uploads";

export async function getSettings(req: Request, res: Response) {
  const settings = await getOrCreateUserSettings(req.user!.id);
  return ApiResponse.Success(res, "Settings", settings);
}

export async function patchPanel(req: Request, res: Response) {
  const parsed = patchPanelSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const panel = await patchPanelPreferences(req.user!.id, parsed.data);
  return ApiResponse.Success(res, "Panel preferences updated", panel);
}

export async function patchNotifications(req: Request, res: Response) {
  const parsed = patchNotificationsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const notifications = await patchNotificationPreferences(
    req.user!.id,
    parsed.data
  );
  return ApiResponse.Success(
    res,
    "Notification preferences updated",
    notifications
  );
}

export async function patchWorkspace(req: Request, res: Response) {
  const parsed = patchWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const previous = await getOrCreateUserSettings(req.user!.id);
  const workspace = await patchWorkspaceSettings(req.user!.id, parsed.data);

  if (
    previous.workspace.status !== "published" &&
    workspace.status === "published"
  ) {
    emit("workspace.published", { workspace });
  }

  return ApiResponse.Success(res, "Workspace updated", workspace);
}

export async function uploadWorkspaceAvatar(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    throw ApiError.badRequest(
      "Adjunta una imagen en el campo `avatar` (multipart/form-data)."
    );
  }

  const publicUrl = avatarPublicUrl(req, file.filename);
  const { workspace, previousAvatarUrl } = await replaceWorkspaceAvatarUrl(
    req.user!.id,
    publicUrl
  );

  if (previousAvatarUrl && previousAvatarUrl !== publicUrl) {
    await tryDeletePreviousAvatar(previousAvatarUrl);
  }

  return ApiResponse.Success(res, "Avatar actualizado", workspace);
}

export async function deleteWorkspaceAvatar(req: Request, res: Response) {
  const { workspace, previousAvatarUrl } = await clearWorkspaceAvatarUrl(
    req.user!.id
  );

  if (previousAvatarUrl) {
    await tryDeletePreviousAvatar(previousAvatarUrl);
  }

  return ApiResponse.Success(res, "Avatar eliminado", workspace);
}
