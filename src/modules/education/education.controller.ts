import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import db from "@/db";
import { educationTable } from "@/drizzle/schemas/education.schema";
import { emit } from "@/modules/webhooks/webhook-dispatcher";
import { ApiError } from "@/shared/errors/api-error";
import { assertTechnologyIdsExist } from "@/shared/validators/technology-ids";
import { ApiResponse } from "@/shared/utils/api-response";

import {
  enrichEducation,
  enrichEducations,
  getEducationRowById,
  listEducationRows,
  replaceEducationTechnologies
} from "./education.service";
import {
  educationBodySchema,
  educationPatchSchema,
  idParamSchema
} from "./education.validators";

// #swagger.tags = ['Education']

export const getAllEducation = async (_req: Request, res: Response) => {
  // #swagger.summary = 'List all education entries'
  // #swagger.description = 'Returns all education rows ordered by sortOrder asc, createdAt asc, each enriched with technologies[].'
  // #swagger.responses[200] = { description: 'Education list fetched' }
  const rows = await listEducationRows();
  const education = await enrichEducations(rows);

  return ApiResponse.Success(res, "Education fetched successfully", education);
};

export const createEducation = async (req: Request, res: Response) => {
  // #swagger.summary = 'Create an education entry'
  // #swagger.security = [{ bearerAuth: [] }]
  // #swagger.parameters['body'] = { in: 'body', required: true, schema: { institution: 'Universidad de X', degree: 'Ingeniería en Sistemas', fieldOfStudy: 'Sistemas de Información', period: '2018 – 2022', description: 'Descripción opcional', sortOrder: 0, technologyIds: [] } }
  // #swagger.responses[201] = { description: 'Education entry created' }
  // #swagger.responses[400] = { description: 'Validation error' }
  // #swagger.responses[401] = { description: 'Unauthorized' }
  const parsed = educationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const { technologyIds, sortOrder = 0, ...fields } = parsed.data;
  await assertTechnologyIdsExist(technologyIds);

  const id = randomUUID();

  await db.transaction(async tx => {
    await tx.insert(educationTable).values({
      id,
      sortOrder,
      ...fields
    });
    await replaceEducationTechnologies(id, technologyIds, tx);
  });

  const created = await getEducationRowById(id);
  if (!created) {
    throw ApiError.server("Failed to load created education entry");
  }

  const enriched = await enrichEducation(created);
  emit("education.created", { education: enriched });
  return ApiResponse.created(res, "Education entry created", enriched);
};

export const replaceEducation = async (req: Request, res: Response) => {
  // #swagger.summary = 'Replace (full update) an education entry'
  // #swagger.security = [{ bearerAuth: [] }]
  // #swagger.parameters['id'] = { in: 'path', required: true, type: 'string', format: 'uuid' }
  // #swagger.parameters['body'] = { in: 'body', required: true, schema: { institution: 'Universidad de X', degree: 'Ingeniería en Sistemas', fieldOfStudy: 'Sistemas de Información', period: '2018 – 2022', description: 'Descripción opcional', sortOrder: 0, technologyIds: [] } }
  // #swagger.responses[200] = { description: 'Education entry updated' }
  // #swagger.responses[400] = { description: 'Validation error' }
  // #swagger.responses[401] = { description: 'Unauthorized' }
  // #swagger.responses[404] = { description: 'Not found' }
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = educationBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  const { id } = idParsed.data;
  const existing = await getEducationRowById(id);

  if (!existing) {
    throw ApiError.notFound("Education entry not found");
  }

  const { technologyIds, sortOrder = 0, ...fields } = bodyParsed.data;
  await assertTechnologyIdsExist(technologyIds);

  await db.transaction(async tx => {
    await tx
      .update(educationTable)
      .set({
        ...fields,
        sortOrder,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(educationTable.id, id));
    await replaceEducationTechnologies(id, technologyIds, tx);
  });

  const updated = await getEducationRowById(id);
  if (!updated) {
    throw ApiError.server("Failed to load updated education entry");
  }

  const enriched = await enrichEducation(updated);
  emit("education.updated", { education: enriched });
  return ApiResponse.Success(res, "Education entry updated", enriched);
};

export const patchEducation = async (req: Request, res: Response) => {
  // #swagger.summary = 'Partial update an education entry'
  // #swagger.security = [{ bearerAuth: [] }]
  // #swagger.parameters['id'] = { in: 'path', required: true, type: 'string', format: 'uuid' }
  // #swagger.parameters['body'] = { in: 'body', schema: { institution: 'Universidad de X', degree: 'Ingeniería en Sistemas', fieldOfStudy: 'Sistemas de Información', period: '2018 – 2022', description: 'Descripción opcional', sortOrder: 0, technologyIds: [] } }
  // #swagger.responses[200] = { description: 'Education entry patched' }
  // #swagger.responses[400] = { description: 'Validation error or empty body' }
  // #swagger.responses[401] = { description: 'Unauthorized' }
  // #swagger.responses[404] = { description: 'Not found' }
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = educationPatchSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  if (Object.keys(bodyParsed.data).length === 0) {
    throw ApiError.badRequest("No fields to update");
  }

  const { id } = idParsed.data;
  const existing = await getEducationRowById(id);

  if (!existing) {
    throw ApiError.notFound("Education entry not found");
  }

  const { technologyIds, ...fields } = bodyParsed.data;

  if (technologyIds !== undefined) {
    await assertTechnologyIdsExist(technologyIds);
  }

  await db.transaction(async tx => {
    if (Object.keys(fields).length > 0) {
      await tx
        .update(educationTable)
        .set({
          ...fields,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(educationTable.id, id));
    }

    if (technologyIds !== undefined) {
      await replaceEducationTechnologies(id, technologyIds, tx);
    }
  });

  const updated = await getEducationRowById(id);
  if (!updated) {
    throw ApiError.server("Failed to load updated education entry");
  }

  const enriched = await enrichEducation(updated);
  emit("education.updated", { education: enriched });
  return ApiResponse.Success(res, "Education entry updated", enriched);
};

export const deleteEducation = async (req: Request, res: Response) => {
  // #swagger.summary = 'Delete an education entry'
  // #swagger.security = [{ bearerAuth: [] }]
  // #swagger.parameters['id'] = { in: 'path', required: true, type: 'string', format: 'uuid' }
  // #swagger.responses[200] = { description: 'Education entry deleted' }
  // #swagger.responses[401] = { description: 'Unauthorized' }
  // #swagger.responses[404] = { description: 'Not found' }
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const { id } = idParsed.data;
  const existing = await getEducationRowById(id);

  if (!existing) {
    throw ApiError.notFound("Education entry not found");
  }

  await db.delete(educationTable).where(eq(educationTable.id, id));

  emit("education.deleted", { id });
  return ApiResponse.Success(res, "Education entry deleted", { id });
};
