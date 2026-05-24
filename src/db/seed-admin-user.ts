/**
 * Crea o actualiza el usuario administrador por correo.
 * Uso: SEED_EMAIL='admin@example.com' SEED_PASSWORD='tu-clave' pnpm db:seed:admin
 * Ambas variables son obligatorias; sin ellas el script termina con error.
 */
import dotenvFlow from "dotenv-flow";
import { randomUUID } from "node:crypto";

dotenvFlow.config();

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import db, { pool } from "@/db/index";
import { usersTable } from "@/drizzle/schemas/user.schema";

const NAME = "Alan Vélez";
const BCRYPT_ROUNDS = 10;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Error: ${name} no está definido. Ejecútalo con ${name}='valor' pnpm db:seed:admin`
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = requireEnv("SEED_EMAIL");
  const password = requireEnv("SEED_PASSWORD");

  const normalized = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalized))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({
        name: NAME,
        passwordHash,
        email: normalized
      })
      .where(eq(usersTable.id, existing.id));
    console.log("Usuario actualizado (misma fila, nuevo hash de contraseña).");
  } else {
    await db.insert(usersTable).values({
      id: randomUUID(),
      name: NAME,
      email: normalized,
      age: 0,
      passwordHash,
      image: null,
      googleId: null,
      githubId: null
    });
    console.log("Usuario creado.");
  }

  console.log(`Email del admin: ${normalized}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
