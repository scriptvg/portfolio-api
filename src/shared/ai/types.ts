/**
 * Tipos de dominio NEUTRALES para el motor de IA.
 *
 * Deliberadamente agnósticos de proveedor: NO reflejan el formato "wire" de
 * Ollama (ni de ningún otro backend). Cada adapter de proveedor traduce entre
 * estos tipos y su API concreta. Así, consumidores (controllers, servicios,
 * workers) dependen solo de este contrato y no de un proveedor en particular.
 */

/** Rol del autor de un mensaje en una conversación. */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** Un mensaje individual dentro de una conversación. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Presente en mensajes `role: "tool"`: id de la tool-call que se responde. */
  toolCallId?: string;
  /** Nombre asociado (p. ej. nombre de la función para mensajes de tool). */
  name?: string;
}

/**
 * Definición de una herramienta (function-calling) que el modelo puede invocar.
 * `parameters` es un JSON Schema que describe los argumentos de la función.
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

/** Invocación de una herramienta emitida por el modelo. */
export interface ToolCall {
  id?: string;
  type: "function";
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Petición de chat (one-shot o streaming, según el método invocado). */
export interface ChatRequest {
  /** Si se omite, el provider usa su modelo por defecto. */
  model?: string;
  messages: ChatMessage[];
  /** Herramientas disponibles para function-calling (pass-through al modelo). */
  tools?: ToolDefinition[];
  /** Aleatoriedad del muestreo. Rango habitual 0..2. */
  temperature?: number;
  /** Máximo de tokens a generar en la respuesta. */
  maxTokens?: number;
  /** Señal de cancelación para abortar la petición subyacente. */
  signal?: AbortSignal;
}

/** Uso de tokens reportado por el proveedor (cuando esté disponible). */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Respuesta de chat no-streaming. */
export interface ChatResponse {
  model: string;
  message: {
    role: ChatRole;
    content: string;
    toolCalls?: ToolCall[];
  };
  usage?: TokenUsage;
  /** Motivo de finalización reportado por el proveedor (p. ej. "stop"). */
  finishReason?: string;
}

/** Fragmento incremental emitido durante un chat en streaming. */
export interface ChatStreamChunk {
  /** Texto incremental de este fragmento (puede ser cadena vacía). */
  delta: string;
  /** `true` solo en el último fragmento del stream. */
  done: boolean;
  /** Tool-calls acumuladas (normalmente llegan en el fragmento final). */
  toolCalls?: ToolCall[];
  /** Uso de tokens (normalmente solo en el fragmento final). */
  usage?: TokenUsage;
}

/** Petición de embeddings. */
export interface EmbeddingRequest {
  /** Si se omite, el provider usa su modelo de embeddings por defecto. */
  model?: string;
  /** Texto único o lote de textos a vectorizar. */
  input: string | string[];
}

/** Respuesta de embeddings: un vector por cada entrada, en orden. */
export interface EmbeddingResponse {
  model: string;
  embeddings: number[][];
}

/** Capacidades soportadas por un proveedor concreto. */
export interface AICapabilities {
  chat: boolean;
  streaming: boolean;
  embeddings: boolean;
  tools: boolean;
}

/** Estado de salud / disponibilidad de un proveedor. */
export interface ProviderHealth {
  provider: string;
  reachable: boolean;
  defaultModel: string;
  availableModels?: string[];
  error?: string;
}
