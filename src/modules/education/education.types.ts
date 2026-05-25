import { educationTable } from "@/drizzle/schemas/education.schema";

export type EducationRow = typeof educationTable.$inferSelect;

export type EducationTechnology = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type EducationResponse = EducationRow & {
  technologies: EducationTechnology[];
};
