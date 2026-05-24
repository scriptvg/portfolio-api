import type { Request, Response } from "express";
import { z } from "zod";

import { getPublishedPublicWorkspaceBySlug } from "@/modules/settings/settings.service";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";

const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
});

export async function getPublicWorkspace(req: Request, res: Response) {
  const parsed = slugParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid slug", z.flattenError(parsed.error));
  }

  const workspace = await getPublishedPublicWorkspaceBySlug(parsed.data.slug);
  if (!workspace) {
    throw ApiError.notFound("Workspace no encontrado o no publicado");
  }

  return ApiResponse.Success(res, "Workspace público", workspace);
}
