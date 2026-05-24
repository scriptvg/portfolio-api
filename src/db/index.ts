import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import env from "@/shared/configs/env";
import * as schema from "@/drizzle";

export const pool = mysql.createPool(env.DATABASE_URL);

const db = drizzle(pool, {
  schema,
  mode: "default",
  logger: env.NODE_ENV === "development"
});

export default db;
