export type ProjectSeed = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  liveUrl: string | null;
  githubUrl: string | null;
  sortOrder: number;
  technologyIds: string[];
};

export const projectsSeed: ProjectSeed[] = [
  {
    slug: "compodex",
    title: "Compodex",
    description:
      "A UI kit on top of Shadcn UI for desing and creating components for any kind of Pokemon Apps",
    imageUrl: "/compodex.png",
    sortOrder: 0,
    technologyIds: [
      "react",
      "nextjs",
      "tailwindcss",
      "radix-ui",
      "base-ui",
      "shadcn-ui"
    ],
    liveUrl: "https://compodex.netlify.app/",
    githubUrl: "https://github.com/scriptvg/compo-dex"
  },
  {
    slug: "exam-builder",
    title: "Exam Builder for Moodle",
    description:
      "A Moodle plugin that allows teachers to create and manage exams for their courses.",
    imageUrl: "/placeholder.svg",
    sortOrder: 1,
    technologyIds: ["moodle", "php", "javascript", "html5", "css3"],
    liveUrl: null,
    githubUrl: null
  },
  {
    slug: "virtual-academy",
    title: "Virtual Academy UPC",
    description:
      "A project for UPC Academy in collaboration with Ofitech.lat, using Moodle",
    imageUrl: "/placeholder.svg",
    sortOrder: 2,
    technologyIds: [
      "react",
      "nextjs",
      "tailwindcss",
      "shadcn-ui",
      "moodle",
      "php",
      "mysql"
    ],
    liveUrl: null,
    githubUrl: null
  },
  {
    slug: "parque-marino",
    title: "Parque Marino Project",
    description:
      "Web solution to centralize and administrative management for the park",
    imageUrl: "/placeholder.svg",
    sortOrder: 3,
    technologyIds: [
      "react",
      "tailwindcss",
      "shadcn-ui",
      "radix-ui",
      "django",
      "mysql",
      "jwt"
    ],
    liveUrl: null,
    githubUrl: "https://github.com/Fer-2202/Proyecto_Final"
  }
];
