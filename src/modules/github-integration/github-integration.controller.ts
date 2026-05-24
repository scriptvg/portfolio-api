import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";

import { eq, inArray, sql } from "drizzle-orm";

import db from "@/db";
import { projectTechnologiesTable } from "@/drizzle/schemas/project-technologies.schema";
import { projectsTable } from "@/drizzle/schemas/projects.schema";
import { emit } from "@/modules/webhooks/webhook-dispatcher";
import {
  assertSlugAvailable,
  enrichProject,
  getProjectRowById,
  getProjectRowBySlug,
  replaceProjectTechnologies
} from "@/modules/projects/projects.service";
import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";

import {
  mapGitHubLanguagesToTechIds,
  mapGitHubTopicsToTechIds
} from "./language-mapping";
import {
  connectIntegration,
  disconnectIntegration,
  getClientForUser,
  getIntegrationByUserId,
  refreshProfile,
  resolveExistingTechnologyIds,
  toPublicIntegration
} from "./github-integration.service";
import {
  getPublicRepoStats,
  getPublicRepoStatsByFullName
} from "./github-public.service";
import {
  connectBodySchema,
  importRepoBodySchema,
  linkRepoBodySchema,
  listReposQuerySchema,
  repoParamSchema
} from "./github-integration.validators";

function getUserId(req: Request): string {
  if (!req.user?.id) {
    throw ApiError.unauthorized("Authentication required");
  }
  return req.user.id;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const getStatus = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const integration = await getIntegrationByUserId(userId);
  if (!integration) {
    return ApiResponse.Success(res, "Not connected", { connected: false });
  }
  return ApiResponse.Success(res, "Connected", {
    connected: true,
    integration: toPublicIntegration(integration)
  });
};

export const connect = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const parsed = connectBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }
  try {
    const row = await connectIntegration(userId, parsed.data.token);
    return ApiResponse.created(res, "GitHub conectado", {
      integration: toPublicIntegration(row)
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest(
      error instanceof Error ? error.message : "No se pudo conectar con GitHub"
    );
  }
};

export const disconnect = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  await disconnectIntegration(userId);
  return ApiResponse.Success(res, "GitHub desconectado", { ok: true });
};

export const refresh = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const row = await refreshProfile(userId);
  return ApiResponse.Success(res, "Perfil actualizado", {
    integration: toPublicIntegration(row)
  });
};

export const listRepos = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const client = await getClientForUser(userId);
  if (!client) {
    throw ApiError.badRequest("GitHub no está conectado");
  }
  const parsed = listReposQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", z.flattenError(parsed.error));
  }
  const repos = await client.listRepos(parsed.data);
  const filtered = parsed.data.search
    ? repos.filter(
        repo =>
          repo.name.toLowerCase().includes(parsed.data.search!.toLowerCase()) ||
          repo.full_name
            .toLowerCase()
            .includes(parsed.data.search!.toLowerCase())
      )
    : repos;
  return ApiResponse.Success(res, "Repos fetched", filtered);
};

export const getRepoDetails = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const client = await getClientForUser(userId);
  if (!client) {
    throw ApiError.badRequest("GitHub no está conectado");
  }
  const parsed = repoParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid params", z.flattenError(parsed.error));
  }
  const [repo, languages, topics] = await Promise.all([
    client.getRepo(parsed.data.owner, parsed.data.repo),
    client.getRepoLanguages(parsed.data.owner, parsed.data.repo),
    client.getRepoTopics(parsed.data.owner, parsed.data.repo)
  ]);
  const suggestedIds = [
    ...mapGitHubLanguagesToTechIds(languages),
    ...mapGitHubTopicsToTechIds(topics)
  ];
  const matchedTechnologyIds = await resolveExistingTechnologyIds([
    ...new Set(suggestedIds)
  ]);

  return ApiResponse.Success(res, "Repo details", {
    repo,
    languages,
    topics,
    matchedTechnologyIds
  });
};

export const importRepo = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const client = await getClientForUser(userId);
  if (!client) {
    throw ApiError.badRequest("GitHub no está conectado");
  }
  const parsed = importRepoBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const repo = await client.getRepo(parsed.data.owner, parsed.data.repo);
  const [languages, topics] = await Promise.all([
    client.getRepoLanguages(parsed.data.owner, parsed.data.repo),
    client.getRepoTopics(parsed.data.owner, parsed.data.repo)
  ]);
  const candidateTechIds = [
    ...mapGitHubLanguagesToTechIds(languages),
    ...mapGitHubTopicsToTechIds(topics)
  ];
  const technologyIds = await resolveExistingTechnologyIds([
    ...new Set(candidateTechIds)
  ]);

  const title = parsed.data.title ?? repo.name;
  const description =
    parsed.data.description ??
    repo.description ??
    `Imported from ${repo.full_name}`;
  const imageUrl = parsed.data.imageUrl ?? repo.owner.avatar_url;

  let slug = parsed.data.slug ?? slugify(repo.name);
  let suffix = 1;
  while (await getProjectRowBySlug(slug)) {
    suffix += 1;
    slug = `${slugify(repo.name)}-${suffix}`;
  }
  await assertSlugAvailable(slug);

  const id = randomUUID();
  await db.transaction(async tx => {
    await tx.insert(projectsTable).values({
      id,
      slug,
      title,
      description,
      imageUrl,
      liveUrl: repo.homepage ?? null,
      githubUrl: repo.html_url,
      sortOrder: 0,
      githubRepoId: repo.id,
      githubFullName: repo.full_name
    });
    await replaceProjectTechnologies(id, technologyIds, tx);
  });

  const created = await getProjectRowById(id);
  if (!created) {
    throw ApiError.server("Failed to load imported project");
  }
  const enriched = await enrichProject(created);
  emit("project.created", { project: enriched, source: "github-import" });
  return ApiResponse.created(res, "Proyecto importado", enriched);
};

export const linkRepoToProject = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const client = await getClientForUser(userId);
  if (!client) {
    throw ApiError.badRequest("GitHub no está conectado");
  }
  const parsed = linkRepoBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const project = await getProjectRowById(parsed.data.projectId);
  if (!project) {
    throw ApiError.notFound("Proyecto no encontrado");
  }

  const repo = await client.getRepo(parsed.data.owner, parsed.data.repo);
  const [languages, topics] = await Promise.all([
    client.getRepoLanguages(parsed.data.owner, parsed.data.repo),
    client.getRepoTopics(parsed.data.owner, parsed.data.repo)
  ]);
  const candidateTechIds = [
    ...mapGitHubLanguagesToTechIds(languages),
    ...mapGitHubTopicsToTechIds(topics)
  ];
  const ghTechIds = await resolveExistingTechnologyIds([
    ...new Set(candidateTechIds)
  ]);

  const patch: Record<string, unknown> = {
    githubRepoId: repo.id,
    githubFullName: repo.full_name,
    updatedAt: sql`CURRENT_TIMESTAMP`
  };
  if (parsed.data.overwriteTitle) patch.title = repo.name;
  if (parsed.data.overwriteDescription && repo.description) {
    patch.description = repo.description;
  }
  if (parsed.data.overwriteImage) {
    patch.imageUrl = repo.owner.avatar_url;
  }
  if (parsed.data.overwriteGithubUrl) {
    patch.githubUrl = repo.html_url;
  } else if (!project.githubUrl) {
    // Always set if currently empty.
    patch.githubUrl = repo.html_url;
  }
  if (parsed.data.overwriteLiveUrl && repo.homepage) {
    patch.liveUrl = repo.homepage;
  }

  await db.transaction(async tx => {
    await tx
      .update(projectsTable)
      .set(patch)
      .where(eq(projectsTable.id, project.id));

    if (parsed.data.mergeTechnologies && ghTechIds.length > 0) {
      const existingLinks = await tx
        .select({ technologyId: projectTechnologiesTable.technologyId })
        .from(projectTechnologiesTable)
        .where(eq(projectTechnologiesTable.projectId, project.id));
      const existingIds = new Set(existingLinks.map(r => r.technologyId));
      const toAdd = ghTechIds.filter(id => !existingIds.has(id));
      if (toAdd.length > 0) {
        await tx.insert(projectTechnologiesTable).values(
          toAdd.map(technologyId => ({
            projectId: project.id,
            technologyId
          }))
        );
      }
    }
  });

  const updated = await getProjectRowById(project.id);
  if (!updated) {
    throw ApiError.server("Failed to load linked project");
  }
  const enriched = await enrichProject(updated);
  emit("project.updated", { project: enriched, source: "github-link" });
  return ApiResponse.Success(res, "Repo vinculado al proyecto", enriched);
};

export const getPublicRepo = async (req: Request, res: Response) => {
  const parsed = repoParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid params", z.flattenError(parsed.error));
  }
  try {
    const stats = await getPublicRepoStats(parsed.data.owner, parsed.data.repo);
    return ApiResponse.Success(res, "Public repo stats", stats);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest(
      error instanceof Error ? error.message : "GitHub fetch failed"
    );
  }
};

const publicReposQuerySchema = z.object({
  fullNames: z
    .string()
    .min(1)
    .transform(value =>
      value
        .split(",")
        .map(part => part.trim())
        .filter(Boolean)
    )
});

export const getPublicReposBatch = async (req: Request, res: Response) => {
  const parsed = publicReposQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", z.flattenError(parsed.error));
  }
  const results = await Promise.all(
    parsed.data.fullNames
      .slice(0, 30)
      .map(fullName => getPublicRepoStatsByFullName(fullName))
  );
  return ApiResponse.Success(
    res,
    "Public repos stats",
    results.filter(
      (stats): stats is NonNullable<typeof stats> => stats !== null
    )
  );
};

// Ensure the unused imports above are kept (drizzle helpers).
void inArray;
