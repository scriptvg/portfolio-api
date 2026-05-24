import { mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";

import { projectsTable } from "./projects.schema";
import { technologiesTable } from "./technologies.schema";

export const projectTechnologiesTable = mysqlTable(
  "project_technologies",
  {
    projectId: varchar({ length: 36 })
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    technologyId: varchar({ length: 36 })
      .notNull()
      .references(() => technologiesTable.id, { onDelete: "cascade" })
  },
  table => [primaryKey({ columns: [table.projectId, table.technologyId] })]
);
