import { inArray } from "drizzle-orm";

import db from "@/db";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";
import { ApiError } from "@/shared/errors/api-error";

type idProp = { id: string | number };

export async function assertTechnologyIdsExist(
  technologyIds: string[]
): Promise<void> {
  const unique = [...new Set(technologyIds)];
  if (unique.length === 0) {
    return;
  }

  const found = await db
    .select({ id: technologiesTable.id })
    .from(technologiesTable)
    .where(inArray(technologiesTable.id, unique));

  if (found.length !== unique.length) {
    const foundSet = new Set(found.map((row: idProp) => row.id));
    const missing = unique.filter((id: string) => !foundSet.has(id));
    throw ApiError.badRequest("Unknown technology id(s)", { missing });
  }
}
