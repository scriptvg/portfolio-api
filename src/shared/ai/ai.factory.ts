import env from "@/shared/configs/env";
import type { AIProvider } from "./ai-provider.port";
import { OllamaProvider } from "./providers/ollama.provider";

/**
 * Fábrica del proveedor de IA con singleton perezoso.
 *
 * Selecciona el adapter según `env.AI_PROVIDER`. Para añadir un proveedor nuevo:
 *   1. Crear su adapter en `providers/<nombre>.provider.ts` implementando AIProvider.
 *   2. Añadir el valor al enum `AI_PROVIDER` en `shared/configs/env.ts`.
 *   3. Añadir un `case` en el switch de `createProvider`.
 * Ningún consumidor (controllers, servicios, workers) necesita cambiar.
 */
let instance: AIProvider | null = null;

function createProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case "ollama":
      return new OllamaProvider();
    default:
      // Inalcanzable mientras el enum de Zod restrinja AI_PROVIDER, pero
      // protege contra ampliaciones del enum sin su adapter correspondiente.
      throw new Error(
        `Unsupported AI_PROVIDER: "${String(env.AI_PROVIDER)}". ` +
          "Add an adapter in shared/ai/providers/ and a case in ai.factory.ts."
      );
  }
}

/** Devuelve el proveedor de IA configurado (instancia única perezosa). */
export function getAIProvider(): AIProvider {
  if (!instance) {
    instance = createProvider();
  }
  return instance;
}

/** Resetea el singleton. Pensado para tests; no usar en runtime normal. */
export function resetAIProvider(): void {
  instance = null;
}
