import { z } from "zod";

/** Roles aceptados en mensajes de chat (espejo de ChatRole del dominio). */
const chatRoleSchema = z.enum(["system", "user", "assistant", "tool"]);

const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string(),
  toolCallId: z.string().optional(),
  name: z.string().optional()
});

/**
 * Validación mínima de herramientas (function-calling). El `parameters` es un
 * JSON Schema arbitrario; no lo validamos en profundidad (pass-through al modelo).
 */
const toolDefinitionSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown())
  })
});

export const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1, "messages must not be empty"),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().default(false),
  tools: z.array(toolDefinitionSchema).optional()
});

export const embedBodySchema = z.object({
  input: z.union([
    z.string().min(1, "input must not be empty"),
    z.array(z.string().min(1)).min(1, "input array must not be empty")
  ]),
  model: z.string().min(1).optional()
});

export type ChatBody = z.infer<typeof chatBodySchema>;
export type EmbedBody = z.infer<typeof embedBodySchema>;
