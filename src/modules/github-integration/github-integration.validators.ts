import { z } from "zod";

export const connectBodySchema = z.object({
  token: z
    .string()
    .trim()
    .min(8, "El token parece demasiado corto")
    .max(255, "El token es demasiado largo")
});

export const listReposQuerySchema = z.object({
  visibility: z.enum(["all", "public", "private"]).optional(),
  affiliation: z.string().optional(),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  search: z.string().trim().optional()
});

export const importRepoBodySchema = z.object({
  owner: z.string().min(1).max(120),
  repo: z.string().min(1).max(120),
  /** Optional overrides; missing fields fall back to the GitHub values. */
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  imageUrl: z.url().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/i)
    .optional()
});

export const repoParamSchema = z.object({
  owner: z.string().min(1).max(120),
  repo: z.string().min(1).max(120)
});

export const linkRepoBodySchema = z.object({
  owner: z.string().min(1).max(120),
  repo: z.string().min(1).max(120),
  projectId: z.uuid(),
  overwriteTitle: z.boolean().optional(),
  overwriteDescription: z.boolean().optional(),
  overwriteImage: z.boolean().optional(),
  overwriteGithubUrl: z.boolean().optional(),
  overwriteLiveUrl: z.boolean().optional(),
  mergeTechnologies: z.boolean().optional()
});
