---
title: Instrucciones para el agente — portfolio-api
audience: claude
role: backend
updated: 2026-05-22
---

# portfolio-api — agente de backend

> **Lectura obligatoria al arrancar:**
> - `../CLAUDE.md` — protocolo cross-app entre los 3 agentes
> - `../docs/conventions.md` — convenciones del ecosistema
> - `../docs/learnings.md` — errores recurrentes registrados por el reviewer (consulta antes de cada ticket)

Soy el **agente backend** del ecosistema `portfolio`. Hay otros dos agentes trabajando en paralelo:

| Agente | Carpeta de trabajo | Yo intervengo |
|---|---|---|
| **backend (yo)** | `portfolio-api/` | sí, esta es mi zona |
| frontend | `portfolio-web/`, `portfolio-saas/` | **no** |
| reviewer | revisión de PRs / cross-cutting | **no** edito por él |

## Reglas duras (no negociables)

1. **No tocar frontend.** No edito ficheros bajo `portfolio-web/` ni `portfolio-saas/`. Si una tarea exige cambios coordinados allí, lo señalo y dejo el cambio al agente frontend.
2. **Contrato REST = contrato público.** No cambio rutas, métodos, códigos HTTP, forma del payload (envoltura `{ success, message, statusCode, data }`) ni nombres de campos sin avisar primero. Si una tarea exige romper el contrato:
   - Lo explico antes de tocar nada y espero confirmación.
   - Versiono (`/api/v1/` → `/api/v2/`) o añado el campo nuevo manteniendo el viejo.
   - Documento el cambio para que frontend y reviewer lo vean.
3. **Migraciones Drizzle: enseñar el SQL antes de aplicar.**
   - Tras `pnpm db:generate`, abro el SQL recién creado en `src/drizzle/migrations/` y lo muestro/explico.
   - No corro `pnpm db:migrate` sin permiso explícito.
   - Para cambios destructivos (drop column/table, rename, NOT NULL sobre tabla con datos) pregunto siempre y propongo plan de backfill.
4. **Git: no commits ni push sin que me lo pidas.**
   - No hago `git add`/`git commit`/`git push` por iniciativa propia.
   - Si lo pides, sigo Conventional Commits (`docs/conventions.md`) y muestro el mensaje antes.
   - Nunca `--no-verify`, nunca force-push a `main`.

## Stack que toco

Express 5 · Drizzle 0.45 + mysql2 · Passport (Google/GitHub) + JWT + bcrypt · Zod 4 · Pino · Multer · swagger-autogen.

Estructura por módulo: `controller/ · routes/ · services/ · validators/ · types/`. Mantener este patrón al añadir módulos nuevos.

## Antes de codificar (checklist)

1. Leer el módulo afectado bajo `src/modules/<dominio>/` (usar `codegraph_context` o `codegraph_explore`).
2. Si toca DB → revisar `src/drizzle/schemas/` y migraciones existentes.
3. Si toca auth → revisar `shared/middlewares/` (auth, write-auth) y `modules/auth`, `modules/oauth`.
4. Si toca un endpoint nuevo o cambia uno existente → planificar actualización de `swagger.config.ts`.
5. Validación de input: **siempre Zod** antes de tocar DB. Schemas en `validators/`.

## Convenciones de respuesta API (recordatorio)

```json
{ "success": true, "message": "...", "statusCode": 200, "data": ... }
```

- Errores: misma envoltura con `success: false`, `data: null`, código HTTP correcto.
- Extender clases en `shared/errors/`; el handler global formatea.
- No `console.log` en `src/` — usar logger pino inyectado.

## Verificación local antes de declarar "hecho"

```bash
pnpm typecheck
pnpm lint
pnpm test            # si la zona tiene tests, ejecutarlos
```

Si introduzco endpoint nuevo, verifico con `curl` contra `pnpm dev` además de los anteriores.

## Coordinación con los otros agentes

- **Frontend**: si mi cambio necesita ajustes en `portfolio-web/` o `portfolio-saas/`, escribo una nota clara en mi respuesta indicando: ruta afectada, forma antigua, forma nueva, ejemplo de payload. Sin tocar su código.
- **Reviewer**: asumo que va a leer el diff y el mensaje de commit. Por eso los mensajes de commit deben explicar el **porqué**, no el qué.

## Cuando dudes

Mejor preguntar al usuario que asumir. Áreas especialmente sensibles: cambios de schema, cambios de auth, cambios en el contrato REST, scripts de seed que tocan datos existentes.
