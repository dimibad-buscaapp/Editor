# Fase 8 — Página web (preview + publicar)

## Fluxo

1. **Criar projeto** — modo Creator (templates `webapp`, `landing`, `dashboard`, `saas`)
2. **Gerar código** — Chat / Composer / Agent no editor
3. **Build** — Build Center, tipo `web` → `npm run build` → `dist/`
4. **Preview** — cópia automática para rascunho após build OK
5. **Publicar** — botão Publicar no painel (ou API)

## Pastas (workspace-storage)

```
apps/ai-dashboard/workspace-storage/
├── projetos/{slug}/dist/          # saída do build Vite
├── princy-sites-preview/{slug}/   # rascunho (atualizado após build web)
└── princy-sites/{slug}/           # site publicado
    ├── index.html
    ├── assets/...
    └── manifest.json
```

## URLs públicas

| Estado | URL |
|--------|-----|
| Preview (rascunho) | `https://princyai.com/princy-sites-preview/{slug}/` |
| Publicado | `https://princyai.com/princy-sites/{slug}/` |

O agent backend (:3210) serve os ficheiros estáticos; o Caddy faz proxy de `/princy-sites*` e `/princy-sites-preview*` para :3210.

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/sites` | Lista sites (preview e/ou publicados) |
| GET | `/api/sites/:slug` | Estado + URLs |
| POST | `/api/sites/:slug/preview-sync` | Copia `dist/` → preview (`projectSlug?`, `projectPath?`) |
| POST | `/api/sites/:slug/publish` | Copia `dist/` → publicado + `manifest.json` |

Após build web de projeto com sucesso, o Build Center grava `previewUrl` no manifest do job e sincroniza o preview automaticamente.

## Variáveis de ambiente

| Variável | Padrão |
|----------|--------|
| `PRINCY_SITES_ROOT` | `{WORKSPACE_STORAGE}/princy-sites` |
| `PRINCY_SITES_PREVIEW_ROOT` | `{WORKSPACE_STORAGE}/princy-sites-preview` |
| `PRINCY_PUBLIC_ORIGIN` | `https://princyai.com` |

## Preparação VPS (script único)

PowerShell **como Administrador**, na raiz do repo:

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\deploy-fase8-pagina-web.ps1
```

O script faz: `git pull`, pastas de sites, build do agent, Caddy (`C:\Caddy\Caddyfile`), reinstala `PrincyAiAgentBackend`, sync da extensão e testes em `/api/sites`.

### Manual (passo a passo)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File .\deploy\windows\ensure-princy-sites-folder.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\build-princy-agent-backend.ps1
Copy-Item .\deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
C:\Caddy\caddy.exe reload --config C:\Caddy\Caddyfile
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\sync-princy-ai-out-extensions.ps1
```

## Extensão Princy AI

No **Build Center**, com tipo **Web** e um projeto selecionado:

- Stepper: Criar → Código → Build → Preview → Publicar
- **Creator** — abre o modo Creator
- **Abrir preview** — abre a URL de rascunho
- **Publicar** — publica em `/princy-sites/{slug}/`

## Verificação rápida

```powershell
Invoke-RestMethod http://127.0.0.1:3210/api/sites
Invoke-RestMethod https://princyai.com/princy-api/api/sites
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\verify-princy-chat-api.ps1
```

(Com `AGENT_API_TOKEN` definido, use `Authorization: Bearer ...` nas rotas POST.)
