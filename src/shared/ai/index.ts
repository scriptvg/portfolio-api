/**
 * Barrel del motor de IA (puertos y adaptadores).
 *
 * Punto de entrada único para consumidores. Reexporta la fábrica, los tipos de
 * dominio neutrales, el puerto y el error de dominio. Este módulo NO depende de
 * Express ni de `modules/`: es reutilizable desde servicios, workers, etc.
 */
export { getAIProvider, resetAIProvider } from "./ai.factory";
export { AIProviderError } from "./ai.errors";
export type { AIProviderErrorKind } from "./ai.errors";
export type { AIProvider } from "./ai-provider.port";
export type {
  AICapabilities,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatRole,
  ChatStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderHealth,
  TokenUsage,
  ToolCall,
  ToolDefinition
} from "./types";
