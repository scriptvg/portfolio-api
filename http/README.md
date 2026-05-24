# HTTP requests — endpoints públicos

Colección de archivos `.http` para probar a mano los **endpoints públicos** de
`portfolio-api` (los que **no** requieren `Authorization`).

## Cómo usarlos

- **VS Code**: instala la extensión [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
  y pulsa _"Send Request"_ sobre cada bloque.
- **JetBrains** (WebStorm/IntelliJ): soporte nativo de archivos `.http`.

Cada archivo declara su propio `@baseUrl`. El servidor de desarrollo corre en
el puerto `9000` (`PORT` en `.env`), con todas las rutas bajo el prefijo
`/api/v1`. Si cambias el puerto, ajusta `@baseUrl` en cada archivo.

Arranca la API antes de lanzar las peticiones:

```bash
pnpm dev
```

## Qué hay aquí (solo público — sin auth)

| Archivo | Recurso | Endpoints |
|---|---|---|
| `health.http` | Health | `GET /health`, `GET /health/detailed` |
| `auth-public.http` | Auth (entrada pública) | `POST /auth/signup`, `POST /auth/signin` |
| `technologies.http` | Technologies | `GET /technologies` |
| `experiences.http` | Experiences | `GET /experiences` |
| `projects.http` | Projects | `GET /projects`, `GET /projects/by-slug/:slug`, `.../wiki` |
| `workspace.http` | Workspace público | `GET /workspace/:slug` |
| `github-public.http` | GitHub (stats públicas) | `GET /integrations/github/public/repos`, `.../:owner/:repo` |
| `deepwiki.http` | DeepWiki (proxy) | `GET .../structure`, `GET .../contents`, `POST .../ask` |

> **Nota de seguridad:** los endpoints de `deepwiki.http` hoy son públicos
> (sin auth). La auditoría los marcó como Hallazgo Alto #3 (proxy LLM sin
> autenticar). Se incluyen aquí porque reflejan el estado actual del código;
> si se protegen más adelante, este archivo deberá moverse a la colección
> autenticada.

Las mutaciones (POST/PUT/PATCH/DELETE de technologies, experiences, projects)
requieren `Authorization: Bearer <API_ADMIN_SECRET>` y **no** se incluyen aquí
por no ser públicas.
