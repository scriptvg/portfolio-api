/**
 * Maps GitHub language names and repo topics to technology IDs that may exist
 * in the local catalog. The actual import step intersects this with
 * `technologies` rows, so unknown mappings are simply ignored.
 */
const LANGUAGE_MAP: Record<string, string> = {
  TypeScript: "typescript",
  JavaScript: "javascript",
  Python: "python",
  PHP: "php",
  HTML: "html5",
  CSS: "css",
  SCSS: "css",
  Shell: "linux",
  Dockerfile: "docker"
};

/** Topics seen on GitHub repos that we want to surface as technologies. */
const TOPIC_MAP: Record<string, string> = {
  react: "react",
  reactjs: "react",
  nextjs: "nextjs",
  "next-js": "nextjs",
  vite: "vite",
  tailwindcss: "tailwindcss",
  tailwind: "tailwindcss",
  shadcn: "shadcn-ui",
  "shadcn-ui": "shadcn-ui",
  "radix-ui": "radix-ui",
  mui: "material-ui",
  "material-ui": "material-ui",
  bootstrap: "bootstrap",
  jquery: "jquery",
  nodejs: "nodejs",
  "node-js": "nodejs",
  express: "express",
  nestjs: "nestjs",
  django: "django",
  fastapi: "fastapi",
  laravel: "laravel",
  postgresql: "postgresql",
  postgres: "postgresql",
  mysql: "mysql",
  mongodb: "mongodb",
  sqlite: "sqlite",
  redis: "redis",
  prisma: "prisma",
  drizzle: "drizzle",
  supabase: "supabase",
  firebase: "firebase",
  docker: "docker",
  nginx: "nginx",
  vercel: "vercel",
  cloudflare: "cloudflare",
  jest: "jest",
  vitest: "vitest",
  cypress: "cypress",
  openai: "openai",
  langchain: "langchain",
  graphql: "graphql",
  trpc: "trpc",
  axios: "axios",
  stripe: "stripe",
  paypal: "paypal",
  "react-router": "react-router",
  "tanstack-query": "tanstack-query",
  "react-query": "tanstack-query",
  zustand: "zustand",
  redux: "redux",
  odoo: "odoo",
  moodle: "moodle",
  replit: "replit",
  sage: "sage"
};

export function mapGitHubLanguagesToTechIds(
  languages: Record<string, number>
): string[] {
  const out = new Set<string>();
  for (const lang of Object.keys(languages)) {
    const id = LANGUAGE_MAP[lang];
    if (id) out.add(id);
  }
  return [...out];
}

export function mapGitHubTopicsToTechIds(topics: string[]): string[] {
  const out = new Set<string>();
  for (const topic of topics) {
    const id = TOPIC_MAP[topic.toLowerCase()];
    if (id) out.add(id);
  }
  return [...out];
}
