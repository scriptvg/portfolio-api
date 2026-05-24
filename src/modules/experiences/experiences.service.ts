import { asc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

import db from "@/db";
import * as schema from "@/drizzle";
import { experienceTechnologiesTable } from "@/drizzle/schemas/experience-technologies.schema";
import { experiencesTable } from "@/drizzle/schemas/experiences.schema";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";
import { ApiError } from "@/shared/errors/api-error";

type slugProp = { slug: string };

type DbClient = Pick<
  MySql2Database<typeof schema>,
  "insert" | "delete" | "select"
>;

export type ExperienceRow = typeof experiencesTable.$inferSelect;

export type ExperienceTechnology = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type ExperienceResponse = ExperienceRow & {
  technologies: ExperienceTechnology[];
};

export async function listExperienceRows(): Promise<ExperienceRow[]> {
  return db
    .select()
    .from(experiencesTable)
    .orderBy(asc(experiencesTable.sortOrder), asc(experiencesTable.createdAt));
}

export async function getExperienceRowById(
  id: string
): Promise<ExperienceRow | undefined> {
  const [row] = await db
    .select()
    .from(experiencesTable)
    .where(eq(experiencesTable.id, id))
    .limit(1);
  return row;
}

export async function replaceExperienceTechnologies(
  experienceId: string,
  technologyIds: string[],
  client: DbClient = db
): Promise<void> {
  const unique = [...new Set(technologyIds)];

  await client
    .delete(experienceTechnologiesTable)
    .where(eq(experienceTechnologiesTable.experienceId, experienceId));

  if (unique.length === 0) {
    return;
  }

  await client.insert(experienceTechnologiesTable).values(
    unique.map((technologyId: string) => ({
      experienceId,
      technologyId
    }))
  );
}

export async function enrichExperiences(
  experiences: ExperienceRow[]
): Promise<ExperienceResponse[]> {
  if (experiences.length === 0) {
    return [];
  }

  const experienceIds = experiences.map(experience => experience.id);

  const techRows = await db
    .select({
      experienceId: experienceTechnologiesTable.experienceId,
      technology: {
        id: technologiesTable.id,
        name: technologiesTable.name,
        icon: technologiesTable.icon,
        color: technologiesTable.color
      }
    })
    .from(experienceTechnologiesTable)
    .innerJoin(
      technologiesTable,
      eq(experienceTechnologiesTable.technologyId, technologiesTable.id)
    )
    .where(inArray(experienceTechnologiesTable.experienceId, experienceIds));

  const byExperienceId = new Map<string, ExperienceTechnology[]>();

  for (const row of techRows) {
    const list = byExperienceId.get(row.experienceId) ?? [];
    list.push(row.technology);
    byExperienceId.set(row.experienceId, list);
  }

  return experiences.map(experience => ({
    ...experience,
    technologies: byExperienceId.get(experience.id) ?? []
  }));
}

export async function enrichExperience(
  experience: ExperienceRow
): Promise<ExperienceResponse> {
  const [enriched] = await enrichExperiences([experience]);
  return enriched;
}
