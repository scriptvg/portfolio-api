import { relations, sql } from "drizzle-orm";
import {
  boolean,
  json,
  mysqlTable,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

import { usersTable } from "@/drizzle/schemas/user.schema";

export type WorkspaceLink = {
  id: string;
  label: string;
  url: string;
};

export type WorkspaceSettings = {
  publicName: string;
  tagline: string;
  bio: string;
  avatarUrl: string;
  slug: string;
  status: "draft" | "published";
  links: WorkspaceLink[];
  metaTitle: string;
  metaDescription: string;
};

export type NotificationPrefs = {
  loginNewDevice: boolean;
  providerLinked: boolean;
  passwordChanged: boolean;
  weeklyDigest: boolean;
  publishErrors: boolean;
  contentEdits: boolean;
};

export type PanelTheme = "system" | "light" | "dark";
export type PanelLayout = "fixed" | "full";
export type PanelLanguage = "es" | "en";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  loginNewDevice: true,
  providerLinked: true,
  passwordChanged: true,
  weeklyDigest: false,
  publishErrors: true,
  contentEdits: false
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  publicName: "",
  tagline: "",
  bio: "",
  avatarUrl: "",
  slug: "",
  status: "draft",
  links: [],
  metaTitle: "",
  metaDescription: ""
};

export const userSettingsTable = mysqlTable("user_settings", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  panelTheme: varchar("panel_theme", { length: 16 })
    .notNull()
    .default("system"),
  panelLayout: varchar("panel_layout", { length: 16 })
    .notNull()
    .default("fixed"),
  panelLanguage: varchar("panel_language", { length: 8 })
    .notNull()
    .default("es"),
  confirmBeforeDelete: boolean("confirm_before_delete").notNull().default(true),
  notificationPrefs: json("notification_prefs")
    .$type<NotificationPrefs>()
    .notNull(),
  workspace: json("workspace").$type<WorkspaceSettings>().notNull(),
  /** Denormalized for unique public slug checks */
  workspaceSlug: varchar("workspace_slug", { length: 64 }).unique(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
});

export const userSettingsRelations = relations(
  userSettingsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [userSettingsTable.userId],
      references: [usersTable.id]
    })
  })
);
