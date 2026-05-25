import { mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";

import { educationTable } from "./education.schema";
import { technologiesTable } from "./technologies.schema";

export const educationTechnologiesTable = mysqlTable(
  "education_technologies",
  {
    educationId: varchar({ length: 36 })
      .notNull()
      .references(() => educationTable.id, { onDelete: "cascade" }),
    technologyId: varchar({ length: 36 })
      .notNull()
      .references(() => technologiesTable.id, { onDelete: "cascade" })
  },
  table => [primaryKey({ columns: [table.educationId, table.technologyId] })]
);
