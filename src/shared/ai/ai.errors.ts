/**
 * Error de dominio del motor de IA, agnóstico de transporte HTTP.
 *
 * NO mapea a códigos HTTP aquí: el mapeo a HTTP es responsabilidad del borde
 * (controller / error-handler). El campo discriminante `kind` permite a esa
 * capa decidir el status adecuado sin acoplarse al proveedor.
 */
export type AIProviderErrorKind =
  | "unreachable"
  | "timeout"
  | "aborted"
  | "bad_response"
  | "unsupported"
  | "model_not_found";

export class AIProviderError extends Error {
  public readonly kind: AIProviderErrorKind;
  public readonly provider: string;
  /** Causa subyacente (error de red, detalle HTTP, etc.). */
  public readonly cause?: unknown;

  constructor(
    kind: AIProviderErrorKind,
    provider: string,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "AIProviderError";
    this.kind = kind;
    this.provider = provider;
    this.cause = options?.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static isAIProviderError(err: unknown): err is AIProviderError {
    return err instanceof AIProviderError;
  }
}
