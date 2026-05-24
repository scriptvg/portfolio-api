import { Request, Response } from "express";
import { z } from "zod";

import { ApiError } from "@/shared/errors/api-error";
import { technologyIdSchema } from "@/shared/validators/technology-id";
import { ApiResponse } from "@/shared/utils/api-response";
import * as service from "./technologies.service";

const technologyBodySchema = z.object({
  name: z.string().min(1).max(255),
  icon: z.string().min(1).max(255),
  color: z.string().min(1).max(255)
});

const technologyPatchSchema = technologyBodySchema.partial();

const idParamSchema = z.object({
  id: technologyIdSchema
});

export const getAllTechnologies = async (_req: Request, res: Response) => {
  const technologies = await service.getAllTechnologies();
  return ApiResponse.Success(
    res,
    "Technologies fetched successfully",
    technologies
  );
};

export const createTechnology = async (req: Request, res: Response) => {
  const parsed = technologyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const created = await service.createTechnology(parsed.data);
  return ApiResponse.created(res, "Technology created", created);
};

export const replaceTechnology = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = technologyBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  const updated = await service.replaceTechnology(
    idParsed.data.id,
    bodyParsed.data
  );
  return ApiResponse.Success(res, "Technology updated", updated);
};

export const patchTechnology = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const bodyParsed = technologyPatchSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(bodyParsed.error));
  }

  if (Object.keys(bodyParsed.data).length === 0) {
    throw ApiError.badRequest("No fields to update");
  }

  const updated = await service.patchTechnology(
    idParsed.data.id,
    bodyParsed.data
  );
  return ApiResponse.Success(res, "Technology updated", updated);
};

export const deleteTechnology = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    throw ApiError.badRequest("Invalid id", z.flattenError(idParsed.error));
  }

  const result = await service.deleteTechnology(idParsed.data.id);
  return ApiResponse.Success(res, "Technology deleted", result);
};
