import type { EmploymentType } from "@/drizzle/schemas/experiences.schema";

export type ExperienceSeed = {
  id: string;
  sortOrder: number;
  title: string;
  position: string;
  employmentType: EmploymentType;
  company: string;
  period: string;
  description: string;
  technologyIds: string[];
};

export const experiencesSeed: ExperienceSeed[] = [
  {
    id: "e1000001-0001-4001-8001-000000000001",
    sortOrder: 0,
    title: "Junior Full Stack Developer",
    position: "Junior Full Stack Developer",
    employmentType: "full_time",
    company: "AI Business Group",
    period: "Mar 2026 - Present",
    description:
      "Development and maintenance of AI-powered client applications, including responsive interfaces, backend integrations, and third-party API connectivity. Focused on building scalable full-stack solutions using modern web technologies and AI services.",
    technologyIds: [
      "openai",
      "react",
      "nextjs",
      "typescript",
      "supabase",
      "postgresql",
      "tailwindcss",
      "shadcn-ui",
      "fastapi",
      "sage",
      "odoo",
      "docker",
      "redis",
      "python"
    ]
  },
  {
    id: "e1000002-0002-4002-8002-000000000002",
    sortOrder: 1,
    title: "Junior Full Stack Developer",
    position: "Junior Full Stack Developer",
    employmentType: "full_time",
    company: "Ofitech.lat",
    period: "2025 - 2026",
    description:
      "Development and maintenance of client web applications, implementation of responsive user interfaces, and integration of modern backend services to improve performance and usability.",
    technologyIds: [
      "react",
      "nextjs",
      "typescript",
      "supabase",
      "postgresql",
      "tailwindcss",
      "shadcn-ui"
    ]
  },
  {
    id: "e1000003-0003-4003-8003-000000000003",
    sortOrder: 2,
    title: "Backend Development Bootcamp",
    position: "Backend Developer Trainee",
    employmentType: "internship",
    company: "Forward Costa Rica",
    period: "Apr 2025 - Jul 2025",
    description:
      "Intensive 3-month backend development bootcamp focused on professional software engineering practices using Django, MySQL, REST APIs, authentication systems, and agile methodologies. Included collaborative projects and hands-on development experience.",
    technologyIds: ["python", "django", "mysql", "nodejs", "jwt", "react"]
  },
  {
    id: "e1000004-0004-4004-8004-000000000004",
    sortOrder: 3,
    title: "Frontend Development Bootcamp",
    position: "Frontend Developer Trainee",
    employmentType: "internship",
    company: "Forward Costa Rica",
    period: "Jan 2025 - Mar 2025",
    description:
      "Intensive 3-month frontend development bootcamp focused on building modern web applications with React, component-based architecture, responsive design, and UI development best practices.",
    technologyIds: [
      "react",
      "html5",
      "css3",
      "javascript",
      "vite",
      "tailwindcss",
      "react-router",
      "tanstack-query",
      "shadcn-ui",
      "radix-ui",
      "bootstrap",
      "material-ui"
    ]
  }
];
