import { Router } from "express";

import { requireJwt } from "@/shared/middlewares/require-jwt";
import { aiLimiter } from "@/shared/middlewares/rate-limiter";
import { getHealth, postChat, postEmbeddings } from "./ai.controller";

const router = Router();

// Todas las rutas de IA son PROTEGIDAS (requireJwt) y limitadas (aiLimiter).
// Evita exponer un proxy LLM sin auth (Hallazgo Alto #3 del audit).
router.use(requireJwt, aiLimiter);

router.get(
  "/",
  /*
    #swagger.tags = ['AI']
    #swagger.summary = 'Health del proveedor de IA configurado'
    #swagger.description = 'Devuelve disponibilidad y modelos del proveedor. 503 si no es reachable.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Proveedor reachable (ProviderHealth en data)' }
    #swagger.responses[503] = { description: 'Proveedor no reachable (envoltura success:false)' }
  */
  getHealth
);

router.post(
  "/chat",
  /*
    #swagger.tags = ['AI']
    #swagger.summary = 'Chat completion (one-shot o streaming SSE)'
    #swagger.description = 'Si stream:false devuelve ChatResponse envuelto. Si stream:true responde text/event-stream (SSE): eventos data: con ChatStreamChunk y cierre data: [DONE]. El modo SSE es una excepcion deliberada a la envoltura JSON estandar.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        messages: [{ role: 'user', content: 'Hola' }],
        model: 'llama3.1',
        temperature: 0.7,
        maxTokens: 512,
        stream: false
      }
    }
    #swagger.responses[200] = { description: 'ChatResponse (JSON) o stream SSE segun stream' }
    #swagger.responses[404] = { description: 'Modelo inexistente' }
    #swagger.responses[503] = { description: 'Proveedor no disponible / timeout' }
    #swagger.responses[502] = { description: 'Respuesta invalida del proveedor' }
  */
  postChat
);

router.post(
  "/embeddings",
  /*
    #swagger.tags = ['AI']
    #swagger.summary = 'Genera embeddings de uno o varios textos'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { input: ['texto a vectorizar'], model: 'nomic-embed-text' }
    }
    #swagger.responses[200] = { description: 'EmbeddingResponse (embeddings: number[][]) en data' }
    #swagger.responses[503] = { description: 'Proveedor no disponible / timeout' }
  */
  postEmbeddings
);

export default router;
