/**
 * Carga tecnologías, experiencias y proyectos desde los mocks legacy.
 * Uso: pnpm db:seed:content
 */
import dotenvFlow from "dotenv-flow";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";

dotenvFlow.config();

import db, { pool } from "@/db/index";
import { experiencesSeed } from "@/db/seed-data/experiences.data";
import { projectsSeed } from "@/db/seed-data/projects.data";
import { technologiesSeed } from "@/db/seed-data/technologies.data";
import { experienceTechnologiesTable } from "@/drizzle/schemas/experience-technologies.schema";
import { experiencesTable } from "@/drizzle/schemas/experiences.schema";
import { projectTechnologiesTable } from "@/drizzle/schemas/project-technologies.schema";
import { projectsTable } from "@/drizzle/schemas/projects.schema";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";

async function seedTechnologies() {
  if (technologiesSeed.length === 0) {
    return;
  }

  await db
    .insert(technologiesTable)
    .values(technologiesSeed)
    .onDuplicateKeyUpdate({
      set: {
        name: sql`values(${technologiesTable.name})`,
        icon: sql`values(${technologiesTable.icon})`,
        color: sql`values(${technologiesTable.color})`,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

  console.log(`Tecnologías: ${technologiesSeed.length} filas sincronizadas.`);
}

async function seedExperiences() {
  for (const experience of experiencesSeed) {
    await db
      .insert(experiencesTable)
      .values({
        id: experience.id,
        title: experience.title,
        position: experience.position,
        employmentType: experience.employmentType,
        company: experience.company,
        period: experience.period,
        description: experience.description,
        sortOrder: experience.sortOrder
      })
      .onDuplicateKeyUpdate({
        set: {
          title: sql`values(${experiencesTable.title})`,
          position: sql`values(${experiencesTable.position})`,
          employmentType: sql`values(${experiencesTable.employmentType})`,
          company: sql`values(${experiencesTable.company})`,
          period: sql`values(${experiencesTable.period})`,
          description: sql`values(${experiencesTable.description})`,
          sortOrder: sql`values(${experiencesTable.sortOrder})`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });

    await db
      .delete(experienceTechnologiesTable)
      .where(eq(experienceTechnologiesTable.experienceId, experience.id));

    const uniqueTechnologyIds = [...new Set(experience.technologyIds)];
    if (uniqueTechnologyIds.length > 0) {
      await db.insert(experienceTechnologiesTable).values(
        uniqueTechnologyIds.map(technologyId => ({
          experienceId: experience.id,
          technologyId
        }))
      );
    }
  }

  console.log(`Experiencias: ${experiencesSeed.length} filas sincronizadas.`);
}

async function seedProjects() {
  for (const project of projectsSeed) {
    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.slug, project.slug))
      .limit(1);

    const projectId = existing?.id ?? randomUUID();

    await db
      .insert(projectsTable)
      .values({
        id: projectId,
        slug: project.slug,
        title: project.title,
        description: project.description,
        imageUrl: project.imageUrl,
        liveUrl: project.liveUrl,
        githubUrl: project.githubUrl,
        sortOrder: project.sortOrder
      })
      .onDuplicateKeyUpdate({
        set: {
          title: sql`values(${projectsTable.title})`,
          description: sql`values(${projectsTable.description})`,
          imageUrl: sql`values(${projectsTable.imageUrl})`,
          liveUrl: sql`values(${projectsTable.liveUrl})`,
          githubUrl: sql`values(${projectsTable.githubUrl})`,
          sortOrder: sql`values(${projectsTable.sortOrder})`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });

    const [row] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.slug, project.slug))
      .limit(1);

    if (!row) {
      throw new Error(`No se pudo cargar el proyecto ${project.slug}`);
    }

    await db
      .delete(projectTechnologiesTable)
      .where(eq(projectTechnologiesTable.projectId, row.id));

    const uniqueTechnologyIds = [...new Set(project.technologyIds)];
    if (uniqueTechnologyIds.length > 0) {
      await db.insert(projectTechnologiesTable).values(
        uniqueTechnologyIds.map(technologyId => ({
          projectId: row.id,
          technologyId
        }))
      );
    }
  }

  console.log(`Proyectos: ${projectsSeed.length} filas sincronizadas.`);
}

async function assertSeedTechnologyIdsExist() {
  const referenced = new Set<string>();
  for (const experience of experiencesSeed) {
    for (const id of experience.technologyIds) {
      referenced.add(id);
    }
  }
  for (const project of projectsSeed) {
    for (const id of project.technologyIds) {
      referenced.add(id);
    }
  }

  if (referenced.size === 0) {
    return;
  }

  const rows = await db
    .select({ id: technologiesTable.id })
    .from(technologiesTable)
    .where(inArray(technologiesTable.id, [...referenced]));

  const found = new Set(rows.map(row => row.id));
  const missing = [...referenced].filter(id => !found.has(id));

  if (missing.length > 0) {
    throw new Error(
      `Tecnologías referenciadas en el seed pero no definidas: ${missing.join(", ")}`
    );
  }
}

async function main() {
  await seedTechnologies();
  await assertSeedTechnologyIdsExist();
  await seedExperiences();
  await seedProjects();
  console.log("Seed de portfolio completado.");
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
