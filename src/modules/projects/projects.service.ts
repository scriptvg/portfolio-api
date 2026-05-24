import { asc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

import db from "@/db";
import * as schema from "@/drizzle";
import { projectTechnologiesTable } from "@/drizzle/schemas/project-technologies.schema";
import { projectsTable } from "@/drizzle/schemas/projects.schema";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";
import { ApiError } from "@/shared/errors/api-error";

type DbClient = Pick<
  MySql2Database<typeof schema>,
  "insert" | "delete" | "select"
>;

export type ProjectRow = typeof projectsTable.$inferSelect;

export type ProjectTechnology = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type ProjectResponse = ProjectRow & {
  technologies: ProjectTechnology[];
};

export async function listProjectRows(): Promise<ProjectRow[]> {
  return db
    .select()
    .from(projectsTable)
    .orderBy(asc(projectsTable.sortOrder), asc(projectsTable.createdAt));
}

export async function getProjectRowById(
  id: string
): Promise<ProjectRow | undefined> {
  const [row] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  return row;
}

export async function getProjectRowBySlug(
  slug: string
): Promise<ProjectRow | undefined> {
  const [row] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.slug, slug))
    .limit(1);
  return row;
}

export async function assertSlugAvailable(
  slug: string,
  excludeId?: string
): Promise<void> {
  const existing = await getProjectRowBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw ApiError.badRequest("Slug already in use", { slug });
  }
}

export async function replaceProjectTechnologies(
  projectId: string,
  technologyIds: string[],
  client: DbClient = db
): Promise<void> {
  const unique = [...new Set(technologyIds)];

  await client
    .delete(projectTechnologiesTable)
    .where(eq(projectTechnologiesTable.projectId, projectId));

  if (unique.length === 0) {
    return;
  }

  await client.insert(projectTechnologiesTable).values(
    unique.map(technologyId => ({
      projectId,
      technologyId
    }))
  );
}

export async function enrichProjects(
  projects: ProjectRow[]
): Promise<ProjectResponse[]> {
  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map(project => project.id);

  const techRows = await db
    .select({
      projectId: projectTechnologiesTable.projectId,
      technology: {
        id: technologiesTable.id,
        name: technologiesTable.name,
        icon: technologiesTable.icon,
        color: technologiesTable.color
      }
    })
    .from(projectTechnologiesTable)
    .innerJoin(
      technologiesTable,
      eq(projectTechnologiesTable.technologyId, technologiesTable.id)
    )
    .where(inArray(projectTechnologiesTable.projectId, projectIds));

  const byProjectId = new Map<string, ProjectTechnology[]>();

  for (const row of techRows) {
    const list = byProjectId.get(row.projectId) ?? [];
    list.push(row.technology);
    byProjectId.set(row.projectId, list);
  }

  return projects.map(project => ({
    ...project,
    technologies: byProjectId.get(project.id) ?? []
  }));
}

export async function enrichProject(
  project: ProjectRow
): Promise<ProjectResponse> {
  const [enriched] = await enrichProjects([project]);
  return enriched;
}
