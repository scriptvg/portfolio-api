import { and, eq, ne } from "drizzle-orm";

import db from "@/db";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_WORKSPACE_SETTINGS,
  userSettingsTable,
  type NotificationPrefs,
  type PanelLanguage,
  type PanelLayout,
  type PanelTheme,
  type WorkspaceLink,
  type WorkspaceSettings
} from "@/drizzle/schemas/user-settings.schema";
import { usersTable } from "@/drizzle/schemas/user.schema";
import { findUserById } from "@/modules/oauth/oauth.service";
import { ApiError } from "@/shared/errors/api-error";

export type PanelPreferencesDto = {
  theme: PanelTheme;
  layout: PanelLayout;
  language: PanelLanguage;
  confirmBeforeDelete: boolean;
};

export type UserSettingsDto = {
  panel: PanelPreferencesDto;
  notifications: NotificationPrefs;
  workspace: WorkspaceSettings;
};

/** Datos del workspace expuestos en el sitio público (sin JWT). */
export type PublicWorkspaceDto = {
  publicName: string;
  tagline: string;
  bio: string;
  avatarUrl: string;
  slug: string;
  links: WorkspaceLink[];
};

export async function getPublishedPublicWorkspaceBySlug(
  slug: string
): Promise<PublicWorkspaceDto | null> {
  const [row] = await db
    .select({ workspace: userSettingsTable.workspace })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.workspaceSlug, slug))
    .limit(1);

  if (!row?.workspace) {
    return null;
  }

  const w = row.workspace;
  if (w.status !== "published") {
    return null;
  }

  return {
    publicName: w.publicName,
    tagline: w.tagline,
    bio: w.bio,
    avatarUrl: w.avatarUrl,
    slug: w.slug,
    links: w.links
  };
}

function buildWorkspaceDefaults(
  userName: string,
  userEmail: string
): WorkspaceSettings {
  const baseSlug =
    userName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) ||
    userEmail.split("@")[0]?.replace(/[^a-z0-9-]/g, "-") ||
    "portfolio";

  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    publicName: userName,
    tagline: "",
    bio: "",
    slug: baseSlug,
    metaTitle: `${userName} — Portfolio`,
    metaDescription: "Portafolio web con proyectos y experiencia profesional."
  };
}

function rowToDto(row: typeof userSettingsTable.$inferSelect): UserSettingsDto {
  return {
    panel: {
      theme: row.panelTheme as PanelTheme,
      layout: row.panelLayout as PanelLayout,
      language: row.panelLanguage as PanelLanguage,
      confirmBeforeDelete: row.confirmBeforeDelete
    },
    notifications: row.notificationPrefs,
    workspace: row.workspace
  };
}

export async function getOrCreateUserSettings(
  userId: string
): Promise<UserSettingsDto> {
  const [existing] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .limit(1);

  if (existing) {
    return rowToDto(existing);
  }

  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  const workspace = buildWorkspaceDefaults(user.name, user.email);

  await db.insert(userSettingsTable).values({
    userId,
    panelTheme: "system",
    panelLayout: "fixed",
    panelLanguage: "es",
    confirmBeforeDelete: true,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    workspace,
    workspaceSlug: workspace.slug || null
  });

  const created = await getOrCreateUserSettings(userId);
  return created;
}

async function assertWorkspaceSlugAvailable(
  slug: string,
  userId: string
): Promise<void> {
  if (!slug) {
    return;
  }

  const [conflict] = await db
    .select({ userId: userSettingsTable.userId })
    .from(userSettingsTable)
    .where(
      and(
        eq(userSettingsTable.workspaceSlug, slug),
        ne(userSettingsTable.userId, userId)
      )
    )
    .limit(1);

  if (conflict) {
    throw ApiError.conflict("Este slug ya está en uso por otra cuenta");
  }
}

export async function patchPanelPreferences(
  userId: string,
  patch: Partial<PanelPreferencesDto>
): Promise<PanelPreferencesDto> {
  await getOrCreateUserSettings(userId);

  const updates: Partial<typeof userSettingsTable.$inferInsert> = {};

  if (patch.theme !== undefined) updates.panelTheme = patch.theme;
  if (patch.layout !== undefined) updates.panelLayout = patch.layout;
  if (patch.language !== undefined) updates.panelLanguage = patch.language;
  if (patch.confirmBeforeDelete !== undefined) {
    updates.confirmBeforeDelete = patch.confirmBeforeDelete;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(userSettingsTable)
      .set(updates)
      .where(eq(userSettingsTable.userId, userId));
  }

  const settings = await getOrCreateUserSettings(userId);
  return settings.panel;
}

export async function patchNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPrefs>
): Promise<NotificationPrefs> {
  const current = await getOrCreateUserSettings(userId);

  const next: NotificationPrefs = {
    ...current.notifications,
    ...patch
  };

  await db
    .update(userSettingsTable)
    .set({ notificationPrefs: next })
    .where(eq(userSettingsTable.userId, userId));

  return next;
}

export async function patchWorkspaceSettings(
  userId: string,
  patch: Partial<WorkspaceSettings>
): Promise<WorkspaceSettings> {
  const current = await getOrCreateUserSettings(userId);

  const next: WorkspaceSettings = {
    ...current.workspace,
    ...patch,
    links: patch.links ?? current.workspace.links
  };

  if (patch.slug !== undefined) {
    await assertWorkspaceSlugAvailable(patch.slug, userId);
    next.slug = patch.slug;
  }

  await db
    .update(userSettingsTable)
    .set({
      workspace: next,
      workspaceSlug: next.slug || null
    })
    .where(eq(userSettingsTable.userId, userId));

  return next;
}

/**
 * Reemplaza el `avatarUrl` del workspace y devuelve el anterior (para limpiar
 * el archivo si vivía en nuestro filesystem).
 */
export async function replaceWorkspaceAvatarUrl(
  userId: string,
  newAvatarUrl: string
): Promise<{ workspace: WorkspaceSettings; previousAvatarUrl: string }> {
  const current = await getOrCreateUserSettings(userId);
  const previousAvatarUrl = current.workspace.avatarUrl ?? "";

  const next: WorkspaceSettings = {
    ...current.workspace,
    avatarUrl: newAvatarUrl
  };

  await db
    .update(userSettingsTable)
    .set({ workspace: next })
    .where(eq(userSettingsTable.userId, userId));

  return { workspace: next, previousAvatarUrl };
}

export async function clearWorkspaceAvatarUrl(
  userId: string
): Promise<{ workspace: WorkspaceSettings; previousAvatarUrl: string }> {
  return replaceWorkspaceAvatarUrl(userId, "");
}

export async function patchUserProfile(
  userId: string,
  patch: { name?: string; image?: string | null }
) {
  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (patch.name !== undefined) {
    updates.name = patch.name.trim();
  }
  if (patch.image !== undefined) {
    updates.image = patch.image === "" ? null : patch.image;
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

  const fresh = await findUserById(userId);
  if (!fresh) {
    throw ApiError.server("Could not load user");
  }
  return fresh;
}
