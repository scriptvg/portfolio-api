import { z } from "zod";

const workspaceLinkSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  url: z.string().url().max(512)
});

export const patchPanelSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  layout: z.enum(["fixed", "full"]).optional(),
  language: z.enum(["es", "en"]).optional(),
  confirmBeforeDelete: z.boolean().optional()
});

export const patchNotificationsSchema = z.object({
  loginNewDevice: z.boolean().optional(),
  providerLinked: z.boolean().optional(),
  passwordChanged: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  publishErrors: z.boolean().optional(),
  contentEdits: z.boolean().optional()
});

export const patchWorkspaceSchema = z.object({
  publicName: z.string().min(1).max(255).optional(),
  tagline: z.string().max(255).optional(),
  bio: z.string().max(2000).optional(),
  avatarUrl: z.union([z.string().url().max(512), z.literal("")]).optional(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
    .optional(),
  status: z.enum(["draft", "published"]).optional(),
  links: z.array(workspaceLinkSchema).max(20).optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(320).optional()
});

export const patchMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  image: z
    .union([z.string().url().max(512), z.literal(""), z.null()])
    .optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
});
