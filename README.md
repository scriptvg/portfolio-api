# portfolio-api

Backend del ecosistema **portfolio**. Única fuente de verdad: owner del schema MySQL, validaciones, autenticación OAuth/JWT, y endpoints REST consumidos por `portfolio-web` y `portfolio-saas`.

- **Framework:** Express 5.2
- **ORM:** Drizzle 0.45 + mysql2
- **Auth:** Passport (`passport-google-oauth20`, `passport-github2`) + JWT + bcrypt
- **Validación:** Zod 4
- **Logs:** Pino + pino-http
- **Seguridad:** helmet, cors, express-rate-limit, cookie-parser, express-session
- **Uploads:** Multer (filesystem local en `uploads/`)
- **Docs:** swagger-autogen + swagger-ui-express

## Requisitos

- Node.js 20 LTS o 22 LTS
- pnpm 10.x
- MySQL 8.x corriendo (local o remoto)

## Quickstart

```bash
cp .env.example .env
# editar DATABASE_URL, JWT_SECRET, SESSION_SECRET, API_ADMIN_SECRET
# y opcionalmente GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET

pnpm install
pnpm db:migrate              # aplicar migraciones
pnpm db:seed:admin           # crear usuario admin inicial
pnpm dev                     # http://localhost:9000
```

Verificar:

```bash
curl http://localhost:9000/api/v1/health
# → { "success": true, "data": { "status": "ok" }, ... }
```

## Variables de entorno

```env
NODE_ENV=development
PORT=9000
LOG_LEVEL=info

DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB

JWT_SECRET=<>=32 chars random>
JWT_EXPIRES_IN=7d
SESSION_SECRET=<>=32 chars random>
API_ADMIN_SECRET=<>=16 chars random>

CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# OAuth — opcionales (set all three del proveedor o ninguno)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:9000/api/v1/auth/github/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

DASHBOARD_WRITE_EMAILS=
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

Ver [`.env.example`](./.env.example) para la plantilla completa.

## Scripts

| Script | Para qué |
|---|---|
| `pnpm dev` | tsx watch con NODE_ENV=development |
| `pnpm build` | `rm -rf dist && tsc && tsc-alias` |
| `pnpm start` | `node dist/server.js` (prod) |
| `pnpm lint` / `lint:fix` | ESLint |
| `pnpm format` / `format:check` | Prettier |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest una vuelta |
| `pnpm test:watch` | Vitest watch |
| `pnpm test:coverage` | cobertura V8 |
| `pnpm db:generate` | generar migración a partir del schema actual |
| `pnpm db:migrate` | aplicar migraciones pendientes |
| `pnpm db:studio` | abrir Drizzle Studio |
| `pnpm db:seed:admin` | crear/actualizar usuario admin |
| `pnpm db:seed:content` | seed de contenido demo |
| `pnpm docs:swagger` | regenerar OpenAPI con swagger-autogen (escribe `src/docs/swagger.json`) |

## Estructura

```
portfolio-api/
├── src/
│   ├── server.ts              entry point (carga app + listen)
│   ├── modules/               un directorio por dominio
│   │   ├── auth/              signup, signin, me, link, change-password
│   │   ├── oauth/             Passport Google/GitHub
│   │   ├── health/            /health + /health/detailed
│   │   ├── technologies/      CRUD tecnologías
│   │   ├── experiences/       CRUD experiencias
│   │   ├── projects/          CRUD proyectos
│   │   ├── settings/          settings + workspace (avatar upload)
│   │   ├── workspace-public/  lectura pública por slug
│   │   ├── webhooks/          eventos externos
│   │   ├── github-integration/ sync repos GitHub
│   │   └── deepwiki/          integración DeepWiki
│   ├── routes/                composición de routers
│   ├── shared/                transversal
│   │   ├── configs/           env, cors, swagger, passport
│   │   ├── constants/
│   │   ├── errors/            error classes + handler
│   │   ├── middlewares/       auth, rate-limit, validators, write-auth
│   │   ├── types/
│   │   ├── utils/
│   │   └── validators/        zod schemas comunes
│   ├── db/
│   │   ├── seed-admin-user.ts
│   │   ├── seed-portfolio-content.ts
│   │   └── seed-data/
│   ├── drizzle/
│   │   ├── schemas/           definición Drizzle
│   │   └── migrations/        SQL generado
│   └── docs/                  documentación API generada
├── scripts/                   utilidades CLI varias
├── tests/                     vitest (sanity + tests reales)
├── uploads/                   archivos subidos (gitignored)
├── drizzle.config.ts          config drizzle-kit
├── swagger.config.ts          generación OpenAPI
├── eslint.config.mjs
├── commitlint.config.ts       Conventional Commits
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

Estructura interna típica por módulo:

```
modules/<dominio>/
├── controller/
├── routes/
├── services/
├── validators/
└── types/
```

## Convenciones del API

- Prefix versionado: `/api/v1/...`.
- Respuestas envueltas:

```json
{ "success": true, "message": "...", "statusCode": 200, "data": ... }
```

- Mutaciones admin (sin usuario logueado): header `Authorization: Bearer <API_ADMIN_SECRET>`.
- Mutaciones con usuario: header `Authorization: Bearer <jwt>` (JWT emitido por `auth` o `oauth`).
- Validación de input: siempre con `zod` antes de tocar la DB.
- Errores: extender la clase base en `shared/errors/`; el handler global formatea la respuesta.

## Auth flow

Diagrama completo en [`../docs/architecture.md`](../docs/architecture.md) → Flujo de autenticación.

Resumen:
1. Usuario hace `GET /api/v1/auth/{github,google}` → Passport redirige al proveedor.
2. Proveedor regresa al `*_CALLBACK_URL` definido en `.env`.
3. API emite JWT HS256 firmado con `JWT_SECRET` y redirige al `CLIENT_URL/auth/callback?token=…`.
4. El frontend guarda el token y lo envía en `Authorization: Bearer <token>`.

Email/password vive en `/api/v1/auth/signup` y `/api/v1/auth/signin`.

## DB & migraciones

- Schema en `src/drizzle/schemas/`. Cambios → `pnpm db:generate` → revisar el SQL generado en `src/drizzle/migrations/`.
- `pnpm db:migrate` aplica las pendientes. Idempotente.
- Producción: ejecutar `db:migrate` como paso de deploy ANTES de levantar el nuevo binario.
- Para inspeccionar: `pnpm db:studio` abre Drizzle Studio en :4983.

## Despliegue

Ver [`../docs/deployment.md`](../docs/deployment.md) → sección `portfolio-api`.

Highlights:
- `pnpm build` → `pnpm start` con NODE_ENV=production.
- `uploads/` necesita persistencia (en PaaS efímero, mover a S3/R2).
- Detrás de proxy inverso: `TRUST_PROXY=1`.

## Notas

- Sin tests reales aún. `tests/sanity.test.ts` valida que la toolchain de vitest corre.
- Logs: usar siempre el logger pino inyectado, no `console.log`.
- Cualquier endpoint nuevo: actualizar `swagger.config.ts` para que aparezca en `/docs`.
