import type { InferSelectModel } from "drizzle-orm";

import type { usersTable } from "@/drizzle/schemas/user.schema";

export type UserRow = InferSelectModel<typeof usersTable>;
export type PublicUser = Omit<UserRow, "passwordHash">;

export function toPublicUser(row: UserRow): PublicUser {
  const { passwordHash: _hash, ...rest } = row;
  return rest;
}
