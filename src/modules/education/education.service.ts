import { asc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

import db from "@/db";
import * as schema from "@/drizzle";
import { educationTechnologiesTable } from "@/drizzle/schemas/education-technologies.schema";
import { educationTable } from "@/drizzle/schemas/education.schema";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";

import type {
  EducationResponse,
  EducationRow,
  EducationTechnology
} from "./education.types";

type DbClient = Pick<
  MySql2Database<typeof schema>,
  "insert" | "delete" | "select"
>;

export async function listEducationRows(): Promise<EducationRow[]> {
  return db
    .select()
    .from(educationTable)
    .orderBy(asc(educationTable.sortOrder), asc(educationTable.createdAt));
}

export async function getEducationRowById(
  id: string
): Promise<EducationRow | undefined> {
  const [row] = await db
    .select()
    .from(educationTable)
    .where(eq(educationTable.id, id))
    .limit(1);
  return row;
}

export async function replaceEducationTechnologies(
  educationId: string,
  technologyIds: string[],
  client: DbClient = db
): Promise<void> {
  const unique = [...new Set(technologyIds)];

  await client
    .delete(educationTechnologiesTable)
    .where(eq(educationTechnologiesTable.educationId, educationId));

  if (unique.length === 0) {
    return;
  }

  await client.insert(educationTechnologiesTable).values(
    unique.map((technologyId: string) => ({
      educationId,
      technologyId
    }))
  );
}

export async function enrichEducations(
  educations: EducationRow[]
): Promise<EducationResponse[]> {
  if (educations.length === 0) {
    return [];
  }

  const educationIds = educations.map(education => education.id);

  const techRows = await db
    .select({
      educationId: educationTechnologiesTable.educationId,
      technology: {
        id: technologiesTable.id,
        name: technologiesTable.name,
        icon: technologiesTable.icon,
        color: technologiesTable.color
      }
    })
    .from(educationTechnologiesTable)
    .innerJoin(
      technologiesTable,
      eq(educationTechnologiesTable.technologyId, technologiesTable.id)
    )
    .where(inArray(educationTechnologiesTable.educationId, educationIds));

  const byEducationId = new Map<string, EducationTechnology[]>();

  for (const row of techRows) {
    const list = byEducationId.get(row.educationId) ?? [];
    list.push(row.technology);
    byEducationId.set(row.educationId, list);
  }

  return educations.map(education => ({
    ...education,
    technologies: byEducationId.get(education.id) ?? []
  }));
}

export async function enrichEducation(
  education: EducationRow
): Promise<EducationResponse> {
  const [enriched] = await enrichEducations([education]);
  return enriched;
}
