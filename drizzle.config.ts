import "dotenv-flow/config";
import { Config, defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default defineConfig({
  out: "./src/drizzle/migrations",
  schema: "./src/drizzle/index.ts",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl
  },
  verbose: true,
  strict: true
}) satisfies Config;
