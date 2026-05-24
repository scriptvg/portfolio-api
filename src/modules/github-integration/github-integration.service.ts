import { eq, inArray, sql } from "drizzle-orm";

import db from "@/db";
import {
  githubIntegrationsTable,
  type GitHubProfileSnapshot
} from "@/drizzle/schemas/github-integrations.schema";
import { technologiesTable } from "@/drizzle/schemas/technologies.schema";
import { openSecret, sealSecret } from "@/shared/utils/secret-box";

import { GitHubClient, type GitHubUser } from "./github-client";

export type GitHubIntegrationRow = typeof githubIntegrationsTable.$inferSelect;

export type GitHubIntegrationPublic = Omit<
  GitHubIntegrationRow,
  "tokenCipher" | "tokenIv" | "tokenTag"
>;

export function toPublicIntegration(
  row: GitHubIntegrationRow
): GitHubIntegrationPublic {
  const { tokenCipher: _c, tokenIv: _i, tokenTag: _t, ...rest } = row;
  void _c;
  void _i;
  void _t;
  return rest;
}

export async function getIntegrationByUserId(
  userId: string
): Promise<GitHubIntegrationRow | undefined> {
  const [row] = await db
    .select()
    .from(githubIntegrationsTable)
    .where(eq(githubIntegrationsTable.userId, userId))
    .limit(1);
  return row;
}

/** Returns a GitHubClient bound to the decrypted PAT, or null when missing. */
export async function getClientForUser(
  userId: string
): Promise<GitHubClient | null> {
  const integration = await getIntegrationByUserId(userId);
  if (!integration) return null;
  const token = openSecret({
    cipher: integration.tokenCipher,
    iv: integration.tokenIv,
    tag: integration.tokenTag
  });
  return new GitHubClient(token);
}

function profileFromGitHubUser(user: GitHubUser): GitHubProfileSnapshot {
  return {
    login: user.login,
    id: user.id,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
    bio: user.bio,
    company: user.company,
    blog: user.blog,
    location: user.location,
    email: user.email,
    publicRepos: user.public_repos,
    publicGists: user.public_gists,
    followers: user.followers,
    following: user.following,
    createdAt: user.created_at
  };
}

export async function connectIntegration(
  userId: string,
  token: string
): Promise<GitHubIntegrationRow> {
  const client = new GitHubClient(token);
  const { data: viewer, scopes } = await client.getViewer();
  const sealed = sealSecret(token);
  const profile = profileFromGitHubUser(viewer);
  const tokenPreview = `…${token.slice(-4)}`;

  const existing = await getIntegrationByUserId(userId);
  if (existing) {
    await db
      .update(githubIntegrationsTable)
      .set({
        tokenCipher: sealed.cipher,
        tokenIv: sealed.iv,
        tokenTag: sealed.tag,
        tokenPreview,
        githubLogin: viewer.login,
        githubId: viewer.id,
        scopes,
        profile,
        lastSyncedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(githubIntegrationsTable.userId, userId));
  } else {
    await db.insert(githubIntegrationsTable).values({
      userId,
      tokenCipher: sealed.cipher,
      tokenIv: sealed.iv,
      tokenTag: sealed.tag,
      tokenPreview,
      githubLogin: viewer.login,
      githubId: viewer.id,
      scopes,
      profile
    });
  }

  const row = await getIntegrationByUserId(userId);
  if (!row) {
    throw new Error("Failed to load github integration after upsert");
  }
  return row;
}

export async function disconnectIntegration(userId: string): Promise<void> {
  await db
    .delete(githubIntegrationsTable)
    .where(eq(githubIntegrationsTable.userId, userId));
}

export async function refreshProfile(
  userId: string
): Promise<GitHubIntegrationRow> {
  const integration = await getIntegrationByUserId(userId);
  if (!integration) {
    throw new Error("Integration not found");
  }
  const token = openSecret({
    cipher: integration.tokenCipher,
    iv: integration.tokenIv,
    tag: integration.tokenTag
  });
  const client = new GitHubClient(token);
  const { data: viewer, scopes } = await client.getViewer();
  await db
    .update(githubIntegrationsTable)
    .set({
      githubLogin: viewer.login,
      githubId: viewer.id,
      scopes,
      profile: profileFromGitHubUser(viewer),
      lastSyncedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(githubIntegrationsTable.userId, userId));
  const updated = await getIntegrationByUserId(userId);
  if (!updated) {
    throw new Error("Integration vanished after refresh");
  }
  return updated;
}

/** Returns the subset of `candidateIds` that actually exist as technologies. */
export async function resolveExistingTechnologyIds(
  candidateIds: string[]
): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const rows = await db
    .select({ id: technologiesTable.id })
    .from(technologiesTable)
    .where(inArray(technologiesTable.id, candidateIds));
  return rows.map(row => row.id);
}
