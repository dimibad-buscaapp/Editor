# Fase 3 — Chat IA de verdade (painel de acao)

## O que mudou

O chat deixou de ser apenas conversa e passou a expor um **pipeline de acao** unificado:

1. Entender o projeto (RAG / index)
2. Gerar plano
3. Listar arquivos afetados
4. Mostrar diff (Composer plan)
5. **Aprovar** pelo usuario
6. Aplicar no workspace (extensao)
7. Compilar no VPS
8. Testar
9. Mostrar resultado

## Modos

| Modo | Comportamento |
|------|----------------|
| **Chat** | Explicacao + plano textual; sem apply/compile automatico |
| **Composer** | Plano + diff; apply apos aprovacao; compile/test opcional (Verificar) |
| **Agent** | Pipeline completo com aprovacao, apply, compile e testes |
| **Builder** | Build Web / API / EXE / APK com logs no painel |

## API (backend :3210)

| Metodo | Rota |
|--------|------|
| POST | `/api/agent/jobs` — body pode incluir `mode`, `actionOnlyExplain`, `skipPostApply` |
| POST | `/api/agent/jobs/:id/approve` |
| POST | `/api/agent/jobs/:id/reject` |
| POST | `/api/agent/jobs/:id/continue` — `{ "applied": true, "paths": ["src/a.ts"] }` |
| GET | `/api/agent/jobs/:id/stream` — eventos `phase`, `composerPlan`, `tasks` |
| POST | `/api/agent/build` — `{ "target": "web" \| "api" \| "exe" \| "apk" }` |
| GET | `/api/agent/build/:jobId` |

## Settings (producao)

Em `deploy/windows/princy-production.settings.json`:

- `princyai.actionRun.approvalRequired`
- `princyai.actionRun.autoCompileAfterApply`
- `princyai.composer.autoVerify`
- `princyai.builder.defaultTarget`

## Deploy no VPS

```powershell
cd C:\Apps\Editor
git pull
cd apps\ai-dashboard
npm run build
cd C:\Apps\Editor
.\deploy\windows\code-web\compile-princy-code-web-production.ps1
.\deploy\windows\code-web\sync-princy-ai-out-extensions.ps1
.\deploy\windows\restart-princy-services.ps1
.\deploy\windows\code-web\verify-princy-chat-api.ps1
```

## Checklist browser

1. Abrir `https://princyai.com/webeditor/` — painel Princy a direita
2. Aba **Agent** — enviar pedido pequeno; aguardar diff e botoes **Aprovar tudo** / **Rejeitar**
3. Aprovar — arquivos alterados; status compile/test no painel
4. Aba **Builder** — escolher Web; **Compilar** — ver log
5. Aba **Chat** — resposta explicativa sem apply forcado

## Alvos Builder

| Alvo | Acao no VPS |
|------|-------------|
| web | `npm run compile-web` |
| api | `build-princy-agent-backend.ps1` ou `npm run build` em apps/ai-dashboard |
| exe | `compile-princy-windows.ps1` incremental |
| apk | `gradlew assembleDebug` se existir no workspace |
