import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";

import db from "@/db";
import { usersTable } from "@/drizzle/schemas/user.schema";
import { ApiError } from "@/shared/errors/api-error";

export type OAuthProvider = "google" | "github";

type FindOrCreateParams = {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name: string;
  image?: string;
};

export async function findOrCreateOAuthUser(
  params: FindOrCreateParams
): Promise<typeof usersTable.$inferSelect> {
  const email = params.email.trim().toLowerCase();
  const providerIdColumn =
    params.provider === "google" ? usersTable.googleId : usersTable.githubId;

  const [byProvider] = await db
    .select()
    .from(usersTable)
    .where(eq(providerIdColumn, params.providerId))
    .limit(1);

  if (byProvider) {
    const normalizedCurrent = byProvider.email.trim().toLowerCase();
    if (email !== normalizedCurrent) {
      const [emailTakenByOther] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(eq(usersTable.email, email), ne(usersTable.id, byProvider.id))
        )
        .limit(1);

      if (emailTakenByOther) {
        throw ApiError.conflict(
          "Ya existe otra cuenta con este correo. Inicia sesión con esa cuenta y vincula GitHub en Configuración."
        );
      }
    }

    await db
      .update(usersTable)
      .set({
        name: params.name,
        image: params.image ?? byProvider.image,
        email
      })
      .where(eq(usersTable.id, byProvider.id));

    const [fresh] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, byProvider.id))
      .limit(1);

    if (!fresh) {
      throw new Error("User missing after update");
    }
    return fresh;
  }

  const [byEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (byEmail) {
    await db
      .update(usersTable)
      .set({
        name: params.name,
        image: params.image ?? byEmail.image,
        googleId:
          params.provider === "google" ? params.providerId : byEmail.googleId,
        githubId:
          params.provider === "github" ? params.providerId : byEmail.githubId
      })
      .where(eq(usersTable.id, byEmail.id));

    const [linked] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, byEmail.id))
      .limit(1);

    if (!linked) {
      throw new Error("User missing after link");
    }
    return linked;
  }

  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    name: params.name,
    email,
    age: 0,
    image: params.image,
    googleId: params.provider === "google" ? params.providerId : null,
    githubId: params.provider === "github" ? params.providerId : null,
    passwordHash: null
  });

  const [created] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!created) {
    throw new Error("User missing after insert");
  }
  return created;
}

export async function findUserByEmail(
  email: string
): Promise<typeof usersTable.$inferSelect | undefined> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalized))
    .limit(1);
  return row;
}

export async function findUserById(
  id: string
): Promise<typeof usersTable.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  return row;
}

export async function linkGoogleToUser(
  accountUserId: string,
  params: {
    googleId: string;
    email: string;
    displayName?: string;
    photoUrl?: string;
  }
): Promise<typeof usersTable.$inferSelect> {
  const email = params.email.trim().toLowerCase();
  const [other] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.googleId, params.googleId))
    .limit(1);
  if (other && other.id !== accountUserId) {
    throw new Error("This Google account is already linked to another user");
  }
  const user = await findUserById(accountUserId);
  if (!user) {
    throw new Error("User not found");
  }
  if (user.googleId && user.googleId !== params.googleId) {
    throw new Error(
      "This account is already linked to a different Google account"
    );
  }
  if (email !== user.email) {
    throw new Error("The Google account email must match your profile email");
  }

  await db
    .update(usersTable)
    .set({
      googleId: params.googleId,
      name: params.displayName?.trim() || user.name,
      image: params.photoUrl ?? user.image
    })
    .where(eq(usersTable.id, accountUserId));

  const [fresh] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, accountUserId))
    .limit(1);
  if (!fresh) {
    throw new Error("User missing after link");
  }
  return fresh;
}

export async function linkGitHubToUser(
  accountUserId: string,
  params: {
    githubId: string;
    profileEmails: string[];
    displayName?: string;
    photoUrl?: string;
  }
): Promise<typeof usersTable.$inferSelect> {
  const user = await findUserById(accountUserId);
  if (!user) {
    throw new Error("User not found");
  }
  if (user.githubId && user.githubId !== params.githubId) {
    throw new Error(
      "This account is already linked to a different GitHub account"
    );
  }

  const normalizedProfileEmails = params.profileEmails.map(e =>
    e.trim().toLowerCase()
  );
  if (!normalizedProfileEmails.includes(user.email.toLowerCase())) {
    throw new Error(
      "Your GitHub account must include your profile email (check GitHub email visibility and OAuth scope user:email)"
    );
  }

  const [dupeGithub] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.githubId, params.githubId))
    .limit(1);

  if (dupeGithub && dupeGithub.id !== accountUserId) {
    // El mismo GitHub quedó en otra fila (p. ej. login previo con noreply). OAuth ya verificó
    // que el correo del perfil está en GitHub; movemos el vínculo a la cuenta actual.
    await db
      .update(usersTable)
      .set({ githubId: null })
      .where(eq(usersTable.id, dupeGithub.id));
  }

  await db
    .update(usersTable)
    .set({
      githubId: params.githubId,
      name: params.displayName?.trim() || user.name,
      image: params.photoUrl ?? user.image
    })
    .where(eq(usersTable.id, accountUserId));

  const [fresh] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, accountUserId))
    .limit(1);
  if (!fresh) {
    throw new Error("User missing after link");
  }
  return fresh;
}

function assertHasAnotherLoginMethod(params: {
  passwordHash: string | null;
  googleId: string | null;
  githubId: string | null;
  unlinking: "google" | "github";
}): void {
  const hasPassword = !!params.passwordHash;
  if (params.unlinking === "github") {
    if (!hasPassword && !params.googleId) {
      throw ApiError.badRequest(
        "Añade una contraseña o vincula Google antes de desvincular GitHub, para no perder el acceso a la cuenta."
      );
    }
    return;
  }
  if (!hasPassword && !params.githubId) {
    throw ApiError.badRequest(
      "Añade una contraseña o vincula GitHub antes de desvincular Google, para no perder el acceso a la cuenta."
    );
  }
}

export async function unlinkGitHubFromUser(
  userId: string
): Promise<typeof usersTable.$inferSelect> {
  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.notFound("Usuario no encontrado");
  }
  if (!user.githubId) {
    throw ApiError.badRequest("Esta cuenta no tiene GitHub vinculado.");
  }
  assertHasAnotherLoginMethod({
    passwordHash: user.passwordHash,
    googleId: user.googleId,
    githubId: user.githubId,
    unlinking: "github"
  });

  await db
    .update(usersTable)
    .set({ githubId: null })
    .where(eq(usersTable.id, userId));

  const [fresh] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!fresh) {
    throw new Error("User missing after unlink");
  }
  return fresh;
}

export async function unlinkGoogleFromUser(
  userId: string
): Promise<typeof usersTable.$inferSelect> {
  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.notFound("Usuario no encontrado");
  }
  if (!user.googleId) {
    throw ApiError.badRequest("Esta cuenta no tiene Google vinculado.");
  }
  assertHasAnotherLoginMethod({
    passwordHash: user.passwordHash,
    googleId: user.googleId,
    githubId: user.githubId,
    unlinking: "google"
  });

  await db
    .update(usersTable)
    .set({ googleId: null })
    .where(eq(usersTable.id, userId));

  const [fresh] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!fresh) {
    throw new Error("User missing after unlink");
  }
  return fresh;
}
