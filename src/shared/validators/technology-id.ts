import { z } from "zod";

/** Slug estable (ej. `react`, `shadcn-ui`), alineado con el seed legacy. */
export const technologyIdSchema = z
  .string()
  .min(1)
  .max(36)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid technology id");

export const technologyIdsSchema = z.array(technologyIdSchema);
