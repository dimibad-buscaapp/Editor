# Webeditor em branco (`/webeditor/`)

## Causa

O Caddy **nao pode** usar `handle_path /webeditor/*` (remove o prefixo `/webeditor` antes de enviar ao Code Web). O VS Code Web precisa receber o caminho completo e ser iniciado com:

```text
--server-base-path /webeditor
```

Sem isso, JS/CSS e WebSocket retornam 404 e a pagina fica branca.

## Diagnostico completo (pente fino)

```powershell
cd C:\Apps\Editor
git pull
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\audit-code-web-ultra.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\audit-code-web-ultra.ps1 -Fix
```

## Correcao no VPS (um comando)

```powershell
cd C:\Apps\Editor
git pull
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\boot-code-web-doctor.ps1
```

Primeira vez ou editor sempre travado (modo DEV):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\boot-code-web-doctor.ps1 -RunProductionCompile
```

O doctor: copia Caddyfile, reinstala **PrincyAiCodeWeb com node.exe direto** (sem PowerShell no NSSM), reinicia Caddy e testa `https://princyai.com/webeditor/`.

## Migracao raiz -> /webeditor

| Antes (dominio na raiz) | Agora |
|-------------------------|--------|
| `https://princyai.com` = editor | `https://princyai.com/` = landing (3210) |
| Caddy `reverse_proxy 3200` em tudo | `handle /webeditor*` -> 3200 |
| Sem `--server-base-path` | `--server-base-path /webeditor` |
| `.env` `CODE_WEB_URL=https://princyai.com` | `CODE_WEB_URL=http://127.0.0.1:3200/webeditor` |

Bloqueios comuns: Caddy parado (timeout), `handle_path /webeditor`, servico sem base path, cache/SW da era raiz, onboarding Copilot (corrigido no codigo), **`VSCODE_DEV=1` em producao** (usa HTML dev lento/fragil; meta `data-settings="undefined"` quebrava o boot — corrigido).

## workbench.css ausente (causa mais comum com servicos OK)

Sintomas no VPS:

- `workbench.js` existe, `workbench.css` = **False**
- `code-web.err.log`: `File not found: ...\workbench.css`
- HTTP 404 em `/webeditor/static/out/vs/code/browser/workbench/workbench.css`

`npm run compile-incremental` **nao** gera CSS; e preciso o bundle esbuild `server-web`:

```powershell
cd C:\Apps\Editor
git pull
# completo (primeira vez ou core desatualizado):
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1
# so falta CSS (ja tem out/ e workbench.js):
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1 -BundleOnly

Test-Path out\vs\code\browser\workbench\workbench.css
Restart-Service PrincyAiCodeWeb
```

Ou manualmente: `npm run bundle-server-web-out` depois `npm run compile-web`.

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
