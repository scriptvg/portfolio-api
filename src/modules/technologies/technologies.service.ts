import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import db from "@/db";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";
import { emit } from "@/modules/webhooks/webhook-dispatcher";
import { ApiError } from "@/shared/errors/api-error";

export type Technology = typeof technologiesTable.$inferSelect;
export type TechnologyCreate = Pick<Technology, "name" | "icon" | "color">;
export type TechnologyPatch = Partial<TechnologyCreate>;

export async function getAllTechnologies(): Promise<Technology[]> {
  return db.select().from(technologiesTable);
}

export async function getTechnologyById(
  id: string
): Promise<Technology | undefined> {
  const [row] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);
  return row;
}

export async function createTechnology(
  data: TechnologyCreate
): Promise<Technology> {
  const id = randomUUID();
  await db.insert(technologiesTable).values({ id, ...data });

  const [created] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);

  if (created) emit("technology.created", { technology: created });
  return created;
}

export async function replaceTechnology(
  id: string,
  data: TechnologyCreate
): Promise<Technology> {
  const [existing] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Technology not found");
  }

  await db
    .update(technologiesTable)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(technologiesTable.id, id));

  const [updated] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);

  if (updated) emit("technology.updated", { technology: updated });
  return updated;
}

export async function patchTechnology(
  id: string,
  data: TechnologyPatch
): Promise<Technology> {
  const [existing] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Technology not found");
  }

  await db
    .update(technologiesTable)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(technologiesTable.id, id));

  const [updated] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);

  if (updated) emit("technology.updated", { technology: updated });
  return updated;
}

export async function deleteTechnology(id: string): Promise<{ id: string }> {
  const [existing] = await db
    .select()
    .from(technologiesTable)
    .where(eq(technologiesTable.id, id))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound("Technology not found");
  }

  await db.delete(technologiesTable).where(eq(technologiesTable.id, id));

  emit("technology.deleted", { id });
  return { id };
}
