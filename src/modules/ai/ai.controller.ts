import type { Request, Response } from "express";
import { z } from "zod";

import { ApiError } from "@/shared/errors/api-error";
import { ApiResponse } from "@/shared/utils/api-response";
import { STATUS_CODES } from "@/shared/constants/status-codes";
import { logger } from "@/shared/utils/logger";
import {
  AIProviderError,
  getAIProvider,
  type ChatRequest,
  type EmbeddingRequest
} from "@/shared/ai";
import { chatBodySchema, embedBodySchema } from "./ai.validators";

/**
 * Mapea un AIProviderError (error de dominio, agnóstico de HTTP) al ApiError
 * correspondiente. El mapeo dominio→HTTP vive aquí, en el borde, no en el motor:
 *   unreachable | timeout  → 503 (proveedor no disponible)
 *   aborted                → 400 (cancelado por el cliente; en SSE se silencia)
 *   model_not_found        → 404
 *   unsupported            → 501
 *   bad_response           → 502 (respuesta inválida del upstream)
 */
function toApiError(err: AIProviderError): ApiError {
  switch (err.kind) {
    case "unreachable":
    case "timeout":
      return new ApiError(STATUS_CODES.SERVICE_UNAVAILABLE, err.message);
    case "aborted":
      // El cliente canceló la petición; no es un error de servidor. En modo
      // SSE este caso se silencia antes de llegar aquí (ver postChat).
      return new ApiError(STATUS_CODES.BAD_REQUEST, err.message);
    case "model_not_found":
      return new ApiError(STATUS_CODES.NOT_FOUND, err.message);
    case "unsupported":
      return new ApiError(STATUS_CODES.NOT_IMPLEMENTED, err.message);
    case "bad_response":
      return new ApiError(STATUS_CODES.BAD_GATEWAY, err.message);
    default:
      return ApiError.server("AI provider error");
  }
}

/**
 * Loguea un error del provider con contexto (provider, kind) SIN volcar el
 * contenido de los mensajes del usuario, y devuelve el ApiError mapeado para
 * relanzarlo. Si no es un AIProviderError, lo deja pasar al handler global.
 */
function handleProviderError(err: unknown, op: string): never {
  if (AIProviderError.isAIProviderError(err)) {
    logger.error(
      { provider: err.provider, kind: err.kind, op },
      `AI provider error during ${op}`
    );
    throw toApiError(err);
  }
  throw err;
}

/** GET /api/v1/ai — health del proveedor configurado. */
export const getHealth = async (_req: Request, res: Response) => {
  const provider = getAIProvider();
  const health = await provider.health();

  if (!health.reachable) {
    // Mantiene la envoltura estándar con success:false y status 503.
    // NOTA: `data.error` puede contener detalle de bajo nivel (p. ej.
    // ECONNREFUSED, host:puerto del provider). Exponerlo es aceptable SOLO
    // porque esta ruta va detrás de `requireJwt`. Si este endpoint se hiciera
    // público, habría que filtrar/ocultar `data.error` para no filtrar
    // topología interna.
    return new ApiResponse({
      success: false,
      message: "AI provider is not reachable",
      statusCode: STATUS_CODES.SERVICE_UNAVAILABLE,
      data: health
    }).send(res);
  }

  return ApiResponse.Success(res, "AI provider is reachable", health);
};

/** POST /api/v1/ai/chat — chat one-shot o SSE según `stream`. */
export const postChat = async (req: Request, res: Response) => {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const provider = getAIProvider();
  const { messages, model, temperature, maxTokens, stream, tools } =
    parsed.data;

  const baseReq: ChatRequest = {
    messages,
    model,
    temperature,
    maxTokens,
    tools
  };

  if (!stream) {
    try {
      const result = await provider.chat(baseReq);
      return ApiResponse.Success(res, "Chat completion", result);
    } catch (err) {
      handleProviderError(err, "chat");
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // MODO SSE: EXCEPCIÓN DELIBERADA a la envoltura JSON {success,message,...}.
  // Un stream no es un payload único; emitimos eventos `data:` con cada chunk
  // y cerramos con `data: [DONE]`. Documentado para el reviewer y el frontend.
  // ───────────────────────────────────────────────────────────────────────
  const abortController = new AbortController();
  // Si el cliente corta la conexión, abortamos la petición al provider.
  req.on("close", () => abortController.abort());

  res.status(STATUS_CODES.OK);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Desactiva el buffering de nginx (TRUST_PROXY activo en prod): sin esta
  // cabecera nginx acumula la respuesta y el cliente recibe el stream de golpe.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  try {
    for await (const chunk of provider.chatStream({
      ...baseReq,
      signal: abortController.signal
    })) {
      if (res.writableEnded) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err) {
    // Cliente desconectado: no es un error real, salimos en silencio. Cubre
    // tanto la señal abortada localmente como el AIProviderError kind:"aborted"
    // que el provider lanza cuando la cancelación vino de la señal externa.
    const isAborted =
      abortController.signal.aborted ||
      (AIProviderError.isAIProviderError(err) && err.kind === "aborted");
    if (isAborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    if (AIProviderError.isAIProviderError(err)) {
      logger.error(
        { provider: err.provider, kind: err.kind, op: "chatStream" },
        "AI provider error during chatStream"
      );
    } else {
      logger.error({ op: "chatStream" }, "Unexpected error during chatStream");
    }

    // Las cabeceras SSE ya se enviaron; no podemos cambiar a la envoltura JSON.
    // Emitimos un evento de error en el propio stream y cerramos.
    if (!res.writableEnded) {
      const message = AIProviderError.isAIProviderError(err)
        ? err.message
        : "Internal streaming error";
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      res.end();
    }
  }
};

/** POST /api/v1/ai/embeddings — genera embeddings. */
export const postEmbeddings = async (req: Request, res: Response) => {
  const parsed = embedBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid body", z.flattenError(parsed.error));
  }

  const provider = getAIProvider();
  const embedReq: EmbeddingRequest = {
    input: parsed.data.input,
    model: parsed.data.model
  };

  try {
    const result = await provider.embed(embedReq);
    return ApiResponse.Success(res, "Embeddings generated", result);
  } catch (err) {
    handleProviderError(err, "embed");
  }
};
