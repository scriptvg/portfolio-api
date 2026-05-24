import env from "@/shared/configs/env";
import { logger } from "@/shared/utils/logger";
import { AIProviderError } from "../ai.errors";
import type { AIProvider } from "../ai-provider.port";
import type {
  AICapabilities,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatRole,
  ChatStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderHealth,
  ToolCall,
  ToolDefinition
} from "../types";

const PROVIDER_NAME = "ollama";

// ───────────────────────────────────────────────────────────────────────────
// Formato "wire" de Ollama (lo que viaja por HTTP). Vive SOLO en este adapter;
// el resto del sistema trabaja con los tipos de dominio neutrales de ../types.
// ───────────────────────────────────────────────────────────────────────────

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
}

interface OllamaMessage {
  role?: string;
  content?: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaChatResponse {
  model?: string;
  message?: OllamaMessage;
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  model?: string;
  embeddings?: number[][];
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

// ───────────────────────────────────────────────────────────────────────────
// Mapeo dominio → wire
// ───────────────────────────────────────────────────────────────────────────

function toOllamaMessages(
  messages: ChatMessage[]
): Array<Record<string, unknown>> {
  return messages.map(m => {
    const wire: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.name !== undefined) wire.name = m.name;
    // Ollama identifica la respuesta de tool por nombre; conservamos el id en
    // tool_call_id por compatibilidad futura aunque Ollama hoy lo ignore.
    if (m.toolCallId !== undefined) wire.tool_call_id = m.toolCallId;
    return wire;
  });
}

function toOllamaTools(
  tools: ToolDefinition[]
): Array<Record<string, unknown>> {
  return tools.map(t => ({
    type: t.type,
    function: {
      name: t.function.name,
      ...(t.function.description !== undefined && {
        description: t.function.description
      }),
      parameters: t.function.parameters
    }
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// Mapeo wire → dominio
// ───────────────────────────────────────────────────────────────────────────

function parseToolArguments(
  args: Record<string, unknown> | string | undefined
): Record<string, unknown> {
  if (args === undefined) return {};
  if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return args;
}

function toDomainToolCalls(
  toolCalls: OllamaToolCall[] | undefined
): ToolCall[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  return toolCalls.map(tc => ({
    type: "function" as const,
    function: {
      name: tc.function?.name ?? "",
      arguments: parseToolArguments(tc.function?.arguments)
    }
  }));
}

function normalizeRole(role: string | undefined): ChatRole {
  if (
    role === "system" ||
    role === "user" ||
    role === "assistant" ||
    role === "tool"
  ) {
    return role;
  }
  return "assistant";
}

function toUsage(res: OllamaChatResponse) {
  const promptTokens = res.prompt_eval_count;
  const completionTokens = res.eval_count;
  if (promptTokens === undefined && completionTokens === undefined) {
    return undefined;
  }
  const totalTokens =
    promptTokens !== undefined && completionTokens !== undefined
      ? promptTokens + completionTokens
      : undefined;
  return { promptTokens, completionTokens, totalTokens };
}

// ───────────────────────────────────────────────────────────────────────────
// Adapter
// ───────────────────────────────────────────────────────────────────────────

export class OllamaProvider implements AIProvider {
  public readonly name = PROVIDER_NAME;
  public readonly capabilities: AICapabilities = {
    chat: true,
    streaming: true,
    embeddings: true,
    // Pass-through tipado: aceptamos `tools` y exponemos `toolCalls`.
    tools: true
  };

  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly embeddingModel: string;
  private readonly timeoutMs: number;

  constructor() {
    // Sin barra final para componer rutas de forma predecible.
    this.baseUrl = env.OLLAMA_BASE_URL.replace(/\/+$/, "");
    this.defaultModel = env.OLLAMA_DEFAULT_MODEL;
    this.embeddingModel = env.OLLAMA_EMBEDDING_MODEL;
    this.timeoutMs = env.AI_REQUEST_TIMEOUT_MS;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: toOllamaMessages(req.messages),
      stream: false,
      options: this.buildOptions(req)
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = toOllamaTools(req.tools);
    }

    const res = await this.fetchJson("/api/chat", body, req.signal, model);
    const data = (await this.readJson(res, model)) as OllamaChatResponse;

    const message = data.message ?? {};
    return {
      model: data.model ?? model,
      message: {
        role: normalizeRole(message.role),
        content: message.content ?? "",
        toolCalls: toDomainToolCalls(message.tool_calls)
      },
      usage: toUsage(data),
      finishReason: data.done_reason
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const model = req.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: toOllamaMessages(req.messages),
      stream: true,
      options: this.buildOptions(req)
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = toOllamaTools(req.tools);
    }

    const res = await this.fetchJson("/api/chat", body, req.signal, model);
    if (!res.body) {
      throw new AIProviderError(
        "bad_response",
        PROVIDER_NAME,
        "Ollama returned an empty streaming body"
      );
    }

    // Cuerpo NDJSON: una línea JSON por fragmento. Acumulamos en buffer y
    // emitimos por cada línea completa.
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const rawChunk of streamToAsyncIterable(res.body)) {
      buffer += decoder.decode(rawChunk, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length === 0) continue;
        const chunk = this.parseStreamLine(line, model);
        if (chunk) yield chunk;
      }
    }

    // Flush de cualquier resto sin newline final.
    const tail = buffer.trim();
    if (tail.length > 0) {
      const chunk = this.parseStreamLine(tail, model);
      if (chunk) yield chunk;
    }
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = req.model ?? this.embeddingModel;
    const res = await this.fetchJson(
      "/api/embed",
      { model, input: req.input },
      undefined,
      model
    );
    const data = (await this.readJson(res, model)) as OllamaEmbedResponse;

    if (!Array.isArray(data.embeddings)) {
      throw new AIProviderError(
        "bad_response",
        PROVIDER_NAME,
        "Ollama embed response is missing 'embeddings' array"
      );
    }

    return {
      model: data.model ?? model,
      embeddings: data.embeddings
    };
  }

  async health(): Promise<ProviderHealth> {
    try {
      const res = await this.rawFetch("/api/tags", {
        method: "GET"
      });
      if (!res.ok) {
        return {
          provider: PROVIDER_NAME,
          reachable: false,
          defaultModel: this.defaultModel,
          error: `Ollama responded with HTTP ${res.status}`
        };
      }
      const data = (await res.json()) as OllamaTagsResponse;
      const availableModels = (data.models ?? [])
        .map(m => m.name)
        .filter((n): n is string => typeof n === "string");
      return {
        provider: PROVIDER_NAME,
        reachable: true,
        defaultModel: this.defaultModel,
        availableModels
      };
    } catch (err) {
      logger.warn(
        { provider: PROVIDER_NAME, kind: "unreachable" },
        "AI provider health check failed"
      );
      return {
        provider: PROVIDER_NAME,
        reachable: false,
        defaultModel: this.defaultModel,
        error: err instanceof Error ? err.message : "Unknown error"
      };
    }
  }

  // ─── Helpers internos ─────────────────────────────────────────────────────

  private buildOptions(req: ChatRequest): Record<string, unknown> {
    const options: Record<string, unknown> = {};
    if (req.temperature !== undefined) options.temperature = req.temperature;
    if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
    return options;
  }

  private parseStreamLine(
    line: string,
    model: string
  ): ChatStreamChunk | undefined {
    let data: OllamaChatResponse;
    try {
      data = JSON.parse(line) as OllamaChatResponse;
    } catch {
      // Línea NDJSON corrupta: la registramos sin contenido de usuario y la
      // ignoramos en lugar de romper todo el stream.
      logger.warn(
        { provider: PROVIDER_NAME, kind: "bad_response" },
        "Skipping malformed NDJSON line from Ollama stream"
      );
      return undefined;
    }

    const message = data.message ?? {};
    return {
      delta: message.content ?? "",
      done: data.done === true,
      toolCalls: toDomainToolCalls(message.tool_calls),
      usage: data.done === true ? toUsage(data) : undefined
    };
  }

  /** Realiza un POST JSON y devuelve la Response cruda, mapeando errores HTTP. */
  private async fetchJson(
    path: string,
    body: unknown,
    signal: AbortSignal | undefined,
    model: string
  ): Promise<Response> {
    const res = await this.rawFetch(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      },
      signal
    );

    if (!res.ok) {
      await this.throwForHttpError(res, model);
    }
    return res;
  }

  /** fetch nativo con timeout vía AbortController, traduciendo fallos de red. */
  private async rawFetch(
    path: string,
    init: RequestInit,
    externalSignal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    // Encadena la señal externa (p. ej. desconexión del cliente) con el timeout.
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else
        externalSignal.addEventListener("abort", onExternalAbort, {
          once: true
        });
    }

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal
      });
    } catch (err) {
      // Abort de la señal externa (p. ej. el cliente cerró la conexión SSE):
      // no es un fallo del servidor ni del upstream, sino una cancelación.
      if (externalSignal?.aborted) {
        throw new AIProviderError(
          "aborted",
          PROVIDER_NAME,
          "Ollama request aborted by client",
          { cause: err }
        );
      }
      // Distinguir timeout propio (nuestro AbortController) de fallo de red.
      if (controller.signal.aborted) {
        throw new AIProviderError(
          "timeout",
          PROVIDER_NAME,
          `Ollama request timed out after ${this.timeoutMs}ms`,
          { cause: err }
        );
      }
      throw new AIProviderError(
        "unreachable",
        PROVIDER_NAME,
        `Cannot reach Ollama at ${this.baseUrl}`,
        { cause: err }
      );
    } finally {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  private async readJson(res: Response, model: string): Promise<unknown> {
    try {
      return await res.json();
    } catch (err) {
      throw new AIProviderError(
        "bad_response",
        PROVIDER_NAME,
        `Ollama returned an unparseable response (model: ${model})`,
        { cause: err }
      );
    }
  }

  private async throwForHttpError(
    res: Response,
    model: string
  ): Promise<never> {
    const detail = await res.text().catch(() => "");
    // 404 → modelo inexistente; Ollama responde 404 cuando el modelo no está.
    if (res.status === 404) {
      throw new AIProviderError(
        "model_not_found",
        PROVIDER_NAME,
        `Ollama model not found: ${model}`,
        { cause: detail }
      );
    }
    throw new AIProviderError(
      "bad_response",
      PROVIDER_NAME,
      `Ollama responded with HTTP ${res.status}`,
      { cause: detail }
    );
  }
}

/**
 * Adapta un ReadableStream<Uint8Array> (web stream del body de fetch) a un
 * AsyncIterable consumible con `for await`. Node soporta esto nativamente, pero
 * lo encapsulamos para no depender de detalles de tipado del lib.dom.
 */
async function* streamToAsyncIterable(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
