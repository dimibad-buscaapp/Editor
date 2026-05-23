# Fase 9 — APIs e sistemas (API Studio)

## Fluxo

1. **Criar projeto** — modo Creator (templates `api`, `express-api`, `webhook`, `database`, `auth`, `saas`)
2. **Rotas e schema** — API Studio: nova rota, Prisma migrate, gerar client
3. **Testar** — smoke tests HTTP (`/health`, `/api/items` quando existir)
4. **Swagger** — abrir `/docs` (Fastify) ou `/docs` + `/openapi.json` (Express)

## Templates API

| ID | Nome | Stack |
|----|------|-------|
| `api` | Fastify API | Fastify, Prisma, Swagger UI |
| `express-api` | Express API | Express, Prisma, swagger-jsdoc |
| `webhook` | Webhook | Fastify, validacao de assinatura |
| `database` | Prisma + PostgreSQL | Fastify, Prisma |
| `auth` | Auth JWT | Fastify, bcrypt, JWT |
| `saas` | Sistema SaaS | Monorepo web + API |

Cada skeleton inclui o marcador `// PRINCY_API_STUDIO_INSERT` em `server.ts` para o scaffolder inserir rotas.

## API Studio (agent backend :3210)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/studio` | Capacidades do modulo |
| GET | `/api/studio/:slug` | Info do projeto (stack, port, URLs docs) |
| POST | `/api/studio/:slug/routes` | Scaffold de rota (`method`, `path`) |
| POST | `/api/studio/:slug/prisma/migrate` | `prisma migrate dev` (ou `pushOnly: true`) |
| POST | `/api/studio/:slug/prisma/generate` | `prisma generate` |
| POST | `/api/studio/:slug/test` | Testes HTTP (inicia dev server se `startDev: true`) |
| GET | `/api/studio/:slug/openapi` | OpenAPI JSON (servidor dev deve estar a correr) |
| POST | `/api/studio/:slug/dev/start` | `npm run dev` em background |
| POST | `/api/studio/:slug/dev/stop` | Para o processo dev |

Parametro opcional em body/query: `projectPath` (deve estar dentro de `projectsRoot`).

## Extensao Princy AI

Modo **API Studio** no painel de chat:

- Stepper: Criar → Rotas/DB → Migrate → Testar → Swagger
- Selecionar projeto, metodo HTTP, path → **Nova rota**
- **Migrate** — Prisma migrate dev
- **Testar** — smoke tests com dev server
- **Swagger** — abre `docsUrl` no browser

## Preparacao VPS (script unico)

PowerShell **como Administrador**, na raiz do repo:

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\deploy-fase9-apis-sistemas.ps1
```

O script faz: `git pull`, build do agent, reinstala `PrincyAiAgentBackend`, sync da extensao e probe `/api/studio`.

### Manual (passo a passo)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\build-princy-agent-backend.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\sync-princy-ai-out-extensions.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\verify-princy-chat-api.ps1
```

## Validar localmente

```powershell
cd C:\Apps\Editor\apps\ai-dashboard
$env:API_PORT = "3210"
node dist\backend\server.js
```

Noutro terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3210/api/studio
Invoke-RestMethod "http://127.0.0.1:3210/api/studio/meu-projeto"
```

## Notas

- Projetos ficam em `apps/ai-dashboard/workspace-storage/projetos/{slug}/`
- PostgreSQL: configure `DATABASE_URL` no `.env` do projeto antes de migrate
- Porta padrao: `4000` (ou `PORT` no `.env`)
- Logs do agent: `C:\Apps\Editor\logs\agent-backend.err.log`
