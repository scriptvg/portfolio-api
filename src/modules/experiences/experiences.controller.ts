import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import db from "@/db";
import {
  EMPLOYMENT_TYPES,
  experiencesTable
} from "@/drizzle/schemas/experiences.schema";
import { emit } from "@/modules/webhooks/webhook-dispatcher";
import { ApiError } from "@/shared/errors/api-error";
import { technologyIdsSchema } from "@/shared/validators/technology-id";
import { assertTechnologyIdsExist } from "@/shared/validators/technology-ids";
import { ApiResponse } from "@/shared/utils/api-response";

import {
  enrichExperience,
  enrichExperiences,
  getExperienceRowById,
  listExperienceRows,
  replaceExperienceTechnologies
} from "./experiences.service";

const experienceBodySchema = z.object({
  title: z.string().min(1).max(255),
  position: z.string().min(1).max(255),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  company: z.string().min(1).max(255),
  period: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  sortOrder: z.number().int().min(0).optional(),
  technologyIds: technologyIdsSchema.default([])
});

const experiencePatchSchema = experienceBodySchema.partial();

const idParamSchema = z.object({
  id: z.string().uuid()
});

export const getAllExperiences = async (_req: Request, res: Response) => {
  const rows = await listExperienceRows();
  const experiences = await enrichExperiences(rows);

  return ApiResponse.Success(
    res,
    "Experiences fetched successfully",
    experiences
  );
};

export const createExperience = async (req: Request, res: Response) => {
  const parsed = experienceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const { technologyIds, sortOrder = 0, ...fields } = parsed.data;
  await assertTechnologyIdsExist(technologyIds);

  const id = randomUUID();

  await db.transaction(async tx => {
    await tx.insert(experiencesTable).values({
      id,
      sortOrder,
      ...fields
    });
    await replaceExperienceTechnologies(id, technologyIds, tx);
  });

  const created = await getExperienceRowById(id);
  if (!created) {
    throw ApiError.server("Failed to load created experience");
  }

  const enriched = await enrichExperience(created);
  emit("experience.created", { experience: enriched });
  return ApiResponse.created(res, "Experience created", enriched);
};

export const replaceExperience = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = experienceBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  const { id } = idParsed.data;
  const existing = await getExperienceRowById(id);

  if (!existing) {
    throw ApiError.notFound("Experience not found");
  }

  const { technologyIds, sortOrder = 0, ...fields } = bodyParsed.data;
  await assertTechnologyIdsExist(technologyIds);

  await db.transaction(async tx => {
    await tx
      .update(experiencesTable)
      .set({
        ...fields,
        sortOrder,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(experiencesTable.id, id));
    await replaceExperienceTechnologies(id, technologyIds, tx);
  });

  const updated = await getExperienceRowById(id);
  if (!updated) {
    throw ApiError.server("Failed to load updated experience");
  }

  const enriched = await enrichExperience(updated);
  emit("experience.updated", { experience: enriched });
  return ApiResponse.Success(res, "Experience updated", enriched);
};

export const patchExperience = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = experiencePatchSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  if (Object.keys(bodyParsed.data).length === 0) {
    throw ApiError.badRequest("No fields to update");
  }

  const { id } = idParsed.data;
  const existing = await getExperienceRowById(id);

  if (!existing) {
    throw ApiError.notFound("Experience not found");
  }

  const { technologyIds, ...fields } = bodyParsed.data;

  if (technologyIds !== undefined) {
    await assertTechnologyIdsExist(technologyIds);
  }

  await db.transaction(async tx => {
    if (Object.keys(fields).length > 0) {
      await tx
        .update(experiencesTable)
        .set({
          ...fields,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(experiencesTable.id, id));
    }

    if (technologyIds !== undefined) {
      await replaceExperienceTechnologies(id, technologyIds, tx);
    }
  });

  const updated = await getExperienceRowById(id);
  if (!updated) {
    throw ApiError.server("Failed to load updated experience");
  }

  const enriched = await enrichExperience(updated);
  emit("experience.updated", { experience: enriched });
  return ApiResponse.Success(res, "Experience updated", enriched);
};

export const deleteExperience = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const { id } = idParsed.data;
  const existing = await getExperienceRowById(id);

  if (!existing) {
    throw ApiError.notFound("Experience not found");
  }

  await db.delete(experiencesTable).where(eq(experiencesTable.id, id));

  emit("experience.deleted", { id });
  return ApiResponse.Success(res, "Experience deleted", { id });
};
