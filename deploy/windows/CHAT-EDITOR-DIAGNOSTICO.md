# Chat do webeditor (Princy IA :3210)

## Por que o chat não funciona (checklist)

| # | Sintoma | Causa | Correção |
|---|---------|-------|----------|
| 1 | Visual VS Code padrão, sem painel ✦ | `princy-ai` não no bundle builtin | `compile-princy-code-web-production.ps1` (compile-web **antes** do bundle) |
| 2 | Chat não aparece à direita | Extensão não ativa / painel fechado | Abrir **✦** na barra secundária; settings `openChatOnStartup` |
| 3 | "Failed to fetch" / backend offline | API errada ou proxy ausente | `princyai.agentEndpoint`: `/princy-api` (não `:3210` direto no browser) |
| 4 | 404 em `/princy-api` | Code Web sem recompilar | `npm run compile-incremental` + reiniciar serviço |
| 5 | Backend :3210 OK mas chat offline | CORS ou URL sem base path | Com `/webeditor`, API pode ser `https://host/princy-api` (Caddy) ou `https://host/webeditor/princy-api` (proxy :3200) |
| 6 | Input não responde | Webview cache antigo | Ctrl+F5, limpar Service Worker, `Developer: Reload Window` |

## Fluxo correto da API

```
Browser (extensão) → /princy-api/api/agent/chat
  → Caddy :443/princy-api → :3210   OU
  → Code Web :3200/princy-api → proxy → :3210
```

**Nunca** configure no browser: `http://127.0.0.1:3210` (CORS entre portas 3200 e 3210).

## Settings (produção)

```json
{
  "princyai.useSameOriginApi": true,
  "princyai.agentEndpoint": "/princy-api",
  "princyai.ui.openChatOnStartup": true,
  "princyai.ui.defaultChat": true,
  "workbench.colorTheme": "Princy Black"
}
```

## Deploy completo (VPS)

```powershell
cd C:\Apps\Editor
git pull
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1
Restart-Service PrincyAiAgentBackend
Restart-Service PrincyAiCodeWeb
```

Testes:

```powershell
Invoke-WebRequest http://127.0.0.1:3210/api/agent/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3200/princy-api/api/agent/health -UseBasicParsing
Select-String -Path out\vs\workbench\services\extensionManagement\browser\builtinExtensionsScannerService.js -Pattern '"princy-ai"' -Quiet
```
