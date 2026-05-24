import { relations, sql } from "drizzle-orm";
import {
  int,
  json,
  mysqlTable,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

import { usersTable } from "@/drizzle/schemas/user.schema";

/** Snapshot of the GitHub profile so we can render it without re-fetching. */
export type GitHubProfileSnapshot = {
  login: string;
  id: number;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  publicRepos: number;
  publicGists: number;
  followers: number;
  following: number;
  createdAt: string;
};

export const githubIntegrationsTable = mysqlTable("github_integrations", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** Base64-encoded AES-256-GCM ciphertext of the PAT. */
  tokenCipher: varchar("token_cipher", { length: 1024 }).notNull(),
  /** Base64 IV (12 bytes) used in GCM. */
  tokenIv: varchar("token_iv", { length: 64 }).notNull(),
  /** Base64 GCM auth tag (16 bytes). */
  tokenTag: varchar("token_tag", { length: 64 }).notNull(),
  /** Last 4 chars of the PAT (for "ghp_…XXXX" UI display). */
  tokenPreview: varchar("token_preview", { length: 16 }).notNull(),
  githubLogin: varchar("github_login", { length: 64 }).notNull(),
  githubId: int("github_id").notNull(),
  scopes: varchar("scopes", { length: 512 }).notNull().default(""),
  profile: json("profile").$type<GitHubProfileSnapshot>().notNull(),
  connectedAt: timestamp("connected_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  lastSyncedAt: timestamp("last_synced_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});

export const githubIntegrationsRelations = relations(
  githubIntegrationsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [githubIntegrationsTable.userId],
      references: [usersTable.id]
    })
  })
);
