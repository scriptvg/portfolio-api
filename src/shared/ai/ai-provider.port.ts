import type {
  AICapabilities,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderHealth
} from "./types";

/**
 * Puerto (hexagonal) del motor de IA.
 *
 * Define el contrato que todo adapter de proveedor debe satisfacer. Los
 * consumidores dependen de esta interfaz, no de un proveedor concreto, de modo
 * que añadir un proveedor nuevo no obliga a tocar el código que la usa.
 *
 * Contrato de capacidades: un proveedor que no soporte un método (p. ej. un
 * futuro proveedor sin embeddings) debe lanzar `AIProviderError` con
 * `kind: "unsupported"` en ese método, y reflejarlo en `capabilities`.
 */
export interface AIProvider {
  /** Identificador estable del proveedor (p. ej. "ollama"). */
  readonly name: string;

  /** Qué capacidades soporta este proveedor concreto. */
  readonly capabilities: AICapabilities;

  /** Chat one-shot (sin streaming). */
  chat(req: ChatRequest): Promise<ChatResponse>;

  /** Chat en streaming: emite fragmentos incrementales hasta `done: true`. */
  chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk>;

  /** Genera embeddings para uno o varios textos. */
  embed(req: EmbeddingRequest): Promise<EmbeddingResponse>;

  /** Comprueba disponibilidad y modelos del proveedor. */
  health(): Promise<ProviderHealth>;
}
