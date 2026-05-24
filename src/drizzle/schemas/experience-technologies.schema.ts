import { mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";

import { experiencesTable } from "./experiences.schema";
import { technologiesTable } from "./technologies.schema";

export const experienceTechnologiesTable = mysqlTable(
  "experience_technologies",
  {
    experienceId: varchar({ length: 36 })
      .notNull()
      .references(() => experiencesTable.id, { onDelete: "cascade" }),
    technologyId: varchar({ length: 36 })
      .notNull()
      .references(() => technologiesTable.id, { onDelete: "cascade" })
  },
  table => [primaryKey({ columns: [table.experienceId, table.technologyId] })]
);
