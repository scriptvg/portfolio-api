import { z } from "zod";

import { technologyIdsSchema } from "@/shared/validators/technology-id";

const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug");

const optionalUrlSchema = z.union([
  z.string().url().max(512),
  z.literal(""),
  z.null()
]);

export const projectBodySchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  imageUrl: z.string().max(512).optional().default(""),
  liveUrl: optionalUrlSchema.optional(),
  githubUrl: optionalUrlSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  technologyIds: technologyIdsSchema.default([])
});

export const projectPatchSchema = projectBodySchema.partial();

export const idParamSchema = z.object({
  id: z.string().uuid()
});

export const slugParamSchema = z.object({
  slug: slugSchema
});

export function normalizeOptionalUrl(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value;
}
