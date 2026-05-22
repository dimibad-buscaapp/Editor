# Webeditor em branco (`/webeditor/`)

## Causa

O Caddy **nao pode** usar `handle_path /webeditor/*` (remove o prefixo `/webeditor` antes de enviar ao Code Web). O VS Code Web precisa receber o caminho completo e ser iniciado com:

```text
--server-base-path /webeditor
```

Sem isso, JS/CSS e WebSocket retornam 404 e a pagina fica branca.

## Correcao no VPS

```powershell
cd C:\Apps\Editor
git pull

Copy-Item deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force

# Reinstalar servico Code Web com base path (ou editar NSSM manualmente)
powershell -File deploy\windows\install-princy-production-services.ps1

Restart-Service PrincyCaddy, PrincyAiCodeWeb

# Verificacao automatica (raiz vs /webeditor)
powershell -File deploy\windows\verify-princy-webeditor.ps1
```

## Migracao raiz -> /webeditor

| Antes (dominio na raiz) | Agora |
|-------------------------|--------|
| `https://princyai.com` = editor | `https://princyai.com/` = landing (3210) |
| Caddy `reverse_proxy 3200` em tudo | `handle /webeditor*` -> 3200 |
| Sem `--server-base-path` | `--server-base-path /webeditor` |
| `.env` `CODE_WEB_URL=https://princyai.com` | `CODE_WEB_URL=http://127.0.0.1:3200/webeditor` |

Bloqueios comuns: Caddy parado (timeout), `handle_path /webeditor`, servico sem base path, cache/SW da era raiz, onboarding Copilot (corrigido no codigo), **`VSCODE_DEV=1` em producao** (usa HTML dev lento/fragil; meta `data-settings="undefined"` quebrava o boot — corrigido).

## Producao: desligar VSCODE_DEV

O servico `run-princy-code-web.ps1` **nao** deve definir `VSCODE_DEV=1` no VPS publico. Sem isso, `isBuilt=true` e o servidor usa `workbench.html` (CSS unico, boot mais rapido).

Reinicie apos `git pull`:

```powershell
Restart-Service PrincyAiCodeWeb
```

Para debug local no VPS: `powershell -File deploy\windows\code-web\run-princy-code-web.ps1 -Dev`

## Testes

```powershell
Test-Path C:\Apps\Editor\out\vs\code\browser\workbench\workbench-dev.html
Invoke-WebRequest http://127.0.0.1:3200/webeditor/ -UseBasicParsing
Invoke-WebRequest https://princyai.com/webeditor/ -UseBasicParsing
Get-Content C:\Apps\Editor\logs\code-web.err.log -Tail 40
```

No navegador (F12 > Rede): nao deve haver 404 em arquivos sob `/webeditor/static/...`.

Teste de asset (nome correto — nao e `workbench.web.main.js`):

```powershell
Invoke-WebRequest "http://127.0.0.1:3200/webeditor/static/out/vs/code/browser/workbench/workbench.js" -UseBasicParsing -Method Head
```

## URL correta

- https://princyai.com/webeditor/ (com barra final)
- Raiz https://princyai.com/ e a landing do dashboard (3210), nao o editor.

## Erro no console: `Onboarding requires a default chat agent`

Princy remove `defaultChatAgent` (Copilot). O onboarding 2026 do VS Code quebrava o boot.

- Correcao no codigo: `onboardingVariationA.ts` ignora onboarding sem Copilot.
- Settings: `workbench.welcomePage.experimentalOnboarding": false` em `princy-production.settings.json`.
- Apos `git pull`: recompile o Code Web (`npm run compile-web`) e reinicie `PrincyAiCodeWeb`.
