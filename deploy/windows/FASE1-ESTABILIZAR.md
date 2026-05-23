# Fase 1 — Estabilizar base atual (Princy)

Antes de novos recursos, validar que `/webeditor`, `/princy-api`, chat dockado, Composer e streaming funcionam de forma repetível.

## Gates

| Gate | Script / acao | O que valida |
|------|----------------|--------------|
| **0** | `test-princy-phase1.ps1` | 4 URLs HTTP + proxy `/princy-api/api/health` |
| **1** | `verify-princy-webeditor.ps1` | Caddy, NSSM base path, compile, `.env` |
| **2** | `code-web\verify-princy-chat-api.ps1` | Health (2 rotas), jobs, SSE, composer-plan |
| **3** | Browser + boot log | Layout Explorer + editor + chat |

## Sequencia no VPS (Administrador)

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File deploy\windows\Start-PrincyAlwaysOnline.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\test-princy-phase1.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\verify-princy-webeditor.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1
Invoke-RestMethod http://127.0.0.1:3210/api/editor/stack-probes | ConvertTo-Json -Depth 5
```

Ou tudo de uma vez:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\run-fase1-validation.ps1
```

## Gate 0 — Checklist manual

```powershell
Invoke-WebRequest https://princyai.com/webeditor/ -UseBasicParsing
Invoke-WebRequest https://princyai.com/princy-api/api/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3200/webeditor/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3210/api/health -UseBasicParsing
```

Automatizado (exit 0/1):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\test-princy-phase1.ps1
```

Sem HTTPS publico (dev local):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\test-princy-phase1.ps1 -SkipPublicHttps
```

## Gate 3 — Browser

1. Abrir `https://princyai.com/webeditor/` (Ctrl+F5)
2. Explorer esquerda, editor centro, chat direita (nao maximizado)
3. Aba **Agent** — mensagem teste com streaming
4. Aba **Composer** — pedido de plano
5. Boot log: `https://princyai.com/webeditor/log/`

Settings criticos: `deploy\windows\princy-production.settings.json` → `.princy-user-data\User\settings.json`

## Matriz de remediacao

| Sintoma | Acao |
|---------|------|
| 502 `/webeditor/` | `code-web\fix-webeditor-502.ps1`; `Restart-Service PrincyAiCodeWeb` |
| Pagina branca | Caddy: `handle /webeditor*` (nao `handle_path`); `compile-princy-code-web-production.ps1` |
| `/princy-api` 502, :3210 OK | `Restart-Service PrincyAiAgentBackend`; recompilar `out/server-main.js` |
| Chat ausente | `code-web\apply-princy-webeditor-hotfix.ps1` + `Restart-Service PrincyAiCodeWeb` |
| Editor escondido | `forceMaximized: false` em settings de producao |
| Stream nao aparece | `princyai.chat.simpleMode: false`; verificar SSE no `verify-princy-chat-api.ps1` |
| Composer falha | Ollama + Postgres; ver `CHAT-502.md` |

Docs relacionados:

- [WEBEDITOR-BLANK.md](WEBEDITOR-BLANK.md) — tela branca
- [WEBEDITOR-VISUAL.md](code-web/WEBEDITOR-VISUAL.md) — layout e compile-web
- [SERVICOS-SEMPRE-ONLINE.md](SERVICOS-SEMPRE-ONLINE.md) — NSSM e servicos

## Pos-deploy (git pull)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\apply-princy-webeditor-hotfix.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1
Restart-Service PrincyAiCodeWeb
powershell -ExecutionPolicy Bypass -File deploy\windows\test-princy-phase1.ps1
```

## Definicao de pronto

- Gate 0 e scripts verify com **exit 0** (2x seguidas apos `Restart-Service PrincyAiCodeWeb`)
- `stack-probes`: webeditor e agent `ok: true`
- Browser: layout 3 colunas + Agent stream + Composer plan

## Monitoramento (opcional)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\install-princy-phase1-scheduled-task.ps1
```

Tarefa agendada **PrincyFase1Gate0** — Gate 0 a cada 6 horas; log em `logs\fase1-gate0.log`.
