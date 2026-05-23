# Fase 5 — Build Center

## Pastas (workspace-storage)

```
apps/ai-dashboard/workspace-storage/
├── projetos/           # projetos criados (Fase 4)
└── builds/
    ├── apk/{buildId}/
    ├── exe/{buildId}/
    ├── web/{buildId}/
    └── api/{buildId}/
        ├── manifest.json
        ├── build.log
        └── artifact.zip (ou .apk / .exe)
```

Padrao Fase 5: `PRINCY_PROJECTS_ROOT` deixa de ser `C:\Apps\Projects` e passa a `workspace-storage/projetos` (override opcional no `.env`).

## API

| Metodo | Rota |
|--------|------|
| POST | `/api/build/start` — `{ "type": "web\|api\|exe\|apk", "projectSlug?", "projectPath?", "note?" }` |
| GET | `/api/build/:id/status` |
| GET | `/api/build/:id/logs` — JSON (`?offset=`) ou SSE (`Accept: text/event-stream`) |
| GET | `/api/build/:id/download` |
| GET | `/api/projects` — lista slugs em `projetos/` |

Status publicos: `waiting` | `compiling` | `error` | `success`

Compat: `/api/agent/build` delega ao mesmo servico.

## Preparacao VPS

```powershell
cd C:\Apps\Editor
.\deploy\windows\ensure-princy-build-storage.ps1

# Migrar projetos antigos (uma vez):
# Copy-Item C:\Apps\Projects\* C:\Apps\Editor\apps\ai-dashboard\workspace-storage\projetos\ -Recurse -ErrorAction SilentlyContinue
```

`.env` recomendado:

```
WORKSPACE_STORAGE_ROOT=C:/Apps/Editor/apps/ai-dashboard/workspace-storage
```

## Deploy

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
.\deploy\windows\ensure-princy-build-storage.ps1
cd apps\ai-dashboard
npm run build
cd C:\Apps\Editor
.\deploy\windows\code-web\compile-princy-code-web-production.ps1
.\deploy\windows\code-web\sync-princy-ai-out-extensions.ps1
Restart-Service PrincyAiAgentBackend
.\deploy\windows\code-web\verify-princy-chat-api.ps1
```

## UI

Painel **Build Center** no chat Princy: tipo, projeto, logs em tempo real (SSE), download do artefato.

Sites web (preview + publicar): ver [FASE8-PAGINA-WEB.md](FASE8-PAGINA-WEB.md).

## Limites (MVP)

- APK: pipeline Capacitor completo — ver [FASE6-APK.md](FASE6-APK.md) (JDK 17 + Android SDK no VPS).
- EXE: pipeline Electron — ver [FASE7-EXE.md](FASE7-EXE.md) (Windows + electron-builder).
- Artefato max: `PRINCY_BUILD_ARTIFACT_MAX_MB` (default 500).
