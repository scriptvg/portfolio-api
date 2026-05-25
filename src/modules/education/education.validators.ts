import { z } from "zod";

import { technologyIdsSchema } from "@/shared/validators/technology-id";

export const educationBodySchema = z.object({
  institution: z.string().min(1).max(255),
  degree: z.string().min(1).max(255),
  fieldOfStudy: z.string().max(255).optional(),
  period: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  technologyIds: technologyIdsSchema.default([])
});

export const educationPatchSchema = educationBodySchema.partial();

export const idParamSchema = z.object({
  id: z.string().uuid()
});
