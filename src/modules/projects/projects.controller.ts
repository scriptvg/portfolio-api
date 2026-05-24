import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import db from "@/db";
import { projectsTable } from "@/drizzle/schemas/projects.schema";
import { emit } from "@/modules/webhooks/webhook-dispatcher";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import { projectImagePublicUrl } from "@/shared/utils/uploads";
import { assertTechnologyIdsExist } from "@/shared/validators/technology-ids";

import { DeepwikiService } from "@/modules/deepwiki/deepwiki.service";

import {
  assertSlugAvailable,
  enrichProject,
  enrichProjects,
  getProjectRowById,
  getProjectRowBySlug,
  listProjectRows,
  replaceProjectTechnologies
} from "./projects.service";
import {
  idParamSchema,
  normalizeOptionalUrl,
  projectBodySchema,
  projectPatchSchema,
  slugParamSchema
} from "./projects.validators";

export const getAllProjects = async (_req: Request, res: Response) => {
  const rows = await listProjectRows();
  const projects = await enrichProjects(rows);

  return ApiResponse.Success(res, "Projects fetched successfully", projects);
};

export const getProjectBySlug = async (req: Request, res: Response) => {
  const parsed = slugParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid slug", z.flattenError(parsed.error));
  }

  const row = await getProjectRowBySlug(parsed.data.slug);
  if (!row) {
    throw ApiError.notFound("Project not found");
  }

  return ApiResponse.Success(
    res,
    "Project fetched successfully",
    await enrichProject(row)
  );
};

export const createProject = async (req: Request, res: Response) => {
  const parsed = projectBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const {
    technologyIds,
    sortOrder = 0,
    liveUrl,
    githubUrl,
    slug,
    ...fields
  } = parsed.data;

  await assertSlugAvailable(slug);
  await assertTechnologyIdsExist(technologyIds);

  const id = randomUUID();

  await db.transaction(async tx => {
    await tx.insert(projectsTable).values({
      id,
      slug,
      sortOrder,
      liveUrl: normalizeOptionalUrl(liveUrl),
      githubUrl: normalizeOptionalUrl(githubUrl),
      ...fields
    });
    await replaceProjectTechnologies(id, technologyIds, tx);
  });

  const created = await getProjectRowById(id);
  if (!created) {
    throw ApiError.server("Failed to load created project");
  }

  const enriched = await enrichProject(created);
  emit("project.created", { project: enriched });
  return ApiResponse.created(res, "Project created", enriched);
};

export const replaceProject = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = projectBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  const { id } = idParsed.data;
  const existing = await getProjectRowById(id);

  if (!existing) {
    throw ApiError.notFound("Project not found");
  }

  const {
    technologyIds,
    sortOrder = 0,
    liveUrl,
    githubUrl,
    slug,
    ...fields
  } = bodyParsed.data;

  await assertSlugAvailable(slug, id);
  await assertTechnologyIdsExist(technologyIds);

  await db.transaction(async tx => {
    await tx
      .update(projectsTable)
      .set({
        slug,
        sortOrder,
        liveUrl: normalizeOptionalUrl(liveUrl),
        githubUrl: normalizeOptionalUrl(githubUrl),
        ...fields,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(projectsTable.id, id));
    await replaceProjectTechnologies(id, technologyIds, tx);
  });

  const updated = await getProjectRowById(id);
  if (!updated) {
    throw ApiError.server("Failed to load updated project");
  }

  const enriched = await enrichProject(updated);
  emit("project.updated", { project: enriched });
  return ApiResponse.Success(res, "Project updated", enriched);
};

export const patchProject = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = projectPatchSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  if (Object.keys(bodyParsed.data).length === 0) {
    throw ApiError.badRequest("No fields to update");
  }

  const { id } = idParsed.data;
  const existing = await getProjectRowById(id);

  if (!existing) {
    throw ApiError.notFound("Project not found");
  }

  const { technologyIds, liveUrl, githubUrl, slug, ...fields } =
    bodyParsed.data;

  if (slug !== undefined) {
    await assertSlugAvailable(slug, id);
  }

  if (technologyIds !== undefined) {
    await assertTechnologyIdsExist(technologyIds);
  }

  await db.transaction(async tx => {
    const patch: Record<string, unknown> = { ...fields };

    if (slug !== undefined) {
      patch.slug = slug;
    }
    if (liveUrl !== undefined) {
      patch.liveUrl = normalizeOptionalUrl(liveUrl);
    }
    if (githubUrl !== undefined) {
      patch.githubUrl = normalizeOptionalUrl(githubUrl);
    }

    if (Object.keys(patch).length > 0) {
      await tx
        .update(projectsTable)
        .set({
          ...patch,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(projectsTable.id, id));
    }

    if (technologyIds !== undefined) {
      await replaceProjectTechnologies(id, technologyIds, tx);
    }
  });

  const updated = await getProjectRowById(id);
  if (!updated) {
    throw ApiError.server("Failed to load updated project");
  }

  const enriched = await enrichProject(updated);
  emit("project.updated", { project: enriched });
  return ApiResponse.Success(res, "Project updated", enriched);
};

export const getProjectWikiBySlug = async (req: Request, res: Response) => {
  const parsed = slugParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid slug", z.flattenError(parsed.error));
  }

  const row = await getProjectRowBySlug(parsed.data.slug);
  if (!row) {
    throw ApiError.notFound("Project not found");
  }
  if (!row.githubFullName) {
    throw ApiError.notFound("Project is not linked to a GitHub repository");
  }

  const content = await DeepwikiService.readContents(row.githubFullName);
  return ApiResponse.Success(res, "Project wiki fetched", {
    repo: row.githubFullName,
    content
  });
};

export const uploadProjectImage = async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw ApiError.badRequest(
      "Adjunta una imagen en el campo `image` (multipart/form-data)."
    );
  }

  const url = projectImagePublicUrl(req, file.filename);
  return ApiResponse.created(res, "Imagen subida", { url });
};

export const deleteProject = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const { id } = idParsed.data;
  const existing = await getProjectRowById(id);

  if (!existing) {
    throw ApiError.notFound("Project not found");
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, id));

  emit("project.deleted", { id });
  return ApiResponse.Success(res, "Project deleted", { id });
};
