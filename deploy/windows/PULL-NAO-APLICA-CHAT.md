# Por que `git pull` nao muda o chat no webeditor

## Causa

A extensao **Princy Ai** no browser carrega o ficheiro compilado:

`extensions/princy-ai/dist/browser/extension.js`

Essa pasta esta no `.gitignore` (`extensions/**/dist/`). O `git pull` **nao** envia nem atualiza o bundle.

O servico `PrincyAiCodeWeb` usa:

`--builtin-extensions-dir C:\Apps\Editor\extensions`

Ou seja, le diretamente `extensions/princy-ai/dist/`, nao o codigo em `src/`.

## O que fazer na VPS (apos cada pull com mudancas no chat)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\deploy-princy-after-pull.ps1 -ProjectRoot "C:\Apps\Editor"
```

Tempo tipico: 1–3 minutos (so `bundle-web` da extensao).

Se mudou tambem o workbench ou proxy `/princy-api` no servidor:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\deploy-princy-after-pull.ps1 -ProjectRoot "C:\Apps\Editor" -FullCompile
```

Depois no browser: **Ctrl+F5**.

## Como confirmar que aplicou

1. **DevTools** no painel do chat → `document.body.dataset.princyUiRev` = `cursor-editor-2026.05.23`
2. Activity bar com icone **+** (Criar) e lista de 5 tipos de projeto
3. Cabecalho do chat: **Princy** + faixa vermelha **Reconectar** se offline

## Chat offline (API)

| Teste | Comando |
|-------|---------|
| Agent direto | `Invoke-WebRequest http://127.0.0.1:3210/api/agent/health -UseBasicParsing` |
| Proxy editor | `Invoke-WebRequest http://127.0.0.1:3200/princy-api/api/agent/health -UseBasicParsing` |
| HTTPS publico | `Invoke-WebRequest https://princyai.com/princy-api/api/agent/health -UseBasicParsing` |

Se :3210 falhar: `Start-Service PrincyAiAgentBackend` ou `deploy\windows\agent-backend\start-princy-agent-backend.ps1`.

Se :3200/princy-api falhar mas :3210 OK: recompile o Code Web (`-FullCompile`).

Verificacao completa:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\verify-princy-chat-api.ps1
```
