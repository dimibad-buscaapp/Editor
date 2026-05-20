# Corrigir chat no Code Web (3200) com backend OK na 3210

## Conflito apos `git stash pop` (server.ts / chatView corrompido)

Se `git pull` falhar, `compile-web` mostrar 9 erros antigos ou **dezenas de erros em `chatView.ts`** (ex.: `2   hasSelection`, `private private readonly`), o stash deixou arquivos inconsistentes. **Nao commite** — volte ao `main` remoto:

```powershell
cd C:\Apps\Editor
git fetch origin main
git reset --hard origin/main
git stash drop
```

Isso restaura `server.ts`, `extensions/princy-ai/*` (incl. fix `495c7c99`) e remove o estado de merge. O script `diagnostico-princy.ps1` (untracked) permanece.

Depois:

```powershell
git pull origin main
npm run compile-web
```

**So se precisar commitar no VPS** (evite `git config --global`):

```powershell
$env:GIT_AUTHOR_NAME = "VPS Princy"
$env:GIT_AUTHOR_EMAIL = "vps@princyai.local"
$env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
$env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL
git commit -m "sua mensagem"
```

Resolucao manual (alternativa): abra `server.ts`, remova `<<<<<<<` / `=======` / `>>>>>>>`, mantenha a versao com `corsPolicy`, `git add`, commit com variaveis acima, `git pull`.

## Service Worker / cache antigo

Se o log mostrar `unexpected service worker version` (Found: 4, Expected: 5) no webview do **princy-ai**:

1. Feche todas as abas de `http://127.0.0.1:3200` (e `https://princyai.com` se usar).
2. F12 → **Application** → **Service Workers** → **Unregister** (todas).
3. **Storage** → **Clear site data** (marcar tudo).
4. Opcional no VPS: apague cache do perfil Princy e reinicie o servidor:

```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force C:\Apps\Editor\.princy-user-data\Cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force C:\Apps\Editor\.princy-user-data\Service Worker -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\code-web\start-princy-code-web.ps1
```

5. Abra de novo e **Ctrl+F5** (hard reload).

O launcher usa `--user-data-dir C:\Apps\Editor\.princy-user-data` para evitar perfil misturado com builds antigos.

## Extension host reconnect / code 1006

Logs como `socket timeout`, `reconnect`, `CloseEvent code: 1006`, `Extension host is unresponsive` costumam ser **efeito** do SW/cache antigo ou do servidor Code Web reiniciando. Depois de limpar cache e manter um unico `node` na 3200, devem parar de repetir.

`[LEAKED DISPOSABLE]` no reconnect e ruido conhecido do VS Code Web em dev — ignore se o host voltar a `responsive`.

WARN `Cannot register configuration defaults for 'window.menuBarVisibility'` — removido dos defaults da extensao; o menu compacto continua via `workbenchUi.ts` ao ativar a extensao.

## Modo simples (backend)

No `.env` do agent (`apps\ai-dashboard\.env`):

```env
PRINCY_SIMPLE_MODE=1
PRINCY_RAG_ENABLED=0
PRINCY_SHADOW_CONTEXT=0
```

Recompile: `npm run build:backend` e reinicie o agent.

## Erro CORS (o mais comum)

Sintoma no console do browser:

```txt
Access-Control-Allow-Origin: https://princyai.com
```

mas o editor abre em `http://127.0.0.1:3200`.

**Corrija o `.env`** em `C:\Apps\Editor\apps\ai-dashboard\.env`:

```env
APP_ORIGIN="http://127.0.0.1:3200"
CODE_WEB_URL="http://127.0.0.1:3200"
PRINCY_CORS_ORIGINS="https://princyai.com,http://127.0.0.1:3200"
```

Ou copie o template local:

```powershell
Copy-Item C:\Apps\Editor\apps\ai-dashboard\deploy\windows\princyai.env.local.example C:\Apps\Editor\apps\ai-dashboard\.env
```

Depois:

```powershell
cd C:\Apps\Editor\apps\ai-dashboard
npm run build:backend
```

Reinicie o agent backend.

Teste no console do browser (F12) em `http://127.0.0.1:3200`:

```js
fetch("http://127.0.0.1:3210/api/agent/models").then(r => r.json()).then(console.log)
```

Deve retornar `{ models: [...] }` sem erro CORS.

---

Se `http://127.0.0.1:3210` responde mas o chat mostra **Failed to fetch**, o navegador do editor (porta **3200**) nao pode usar `127.0.0.1:3210` direto (porta diferente = CORS). Use o **proxy** na mesma porta do editor.

## Correcao imediata (sem esperar git pull)

No Princy Ai Web: **F1** → `Preferences: Open User Settings (JSON)` e cole:

```json
{
  "princyai.agentEndpoint": "http://127.0.0.1:3200/princy-api",
  "princyai.useSameOriginApi": true
}
```

Reinicie o Code Web e teste no navegador **do VPS**:

`http://127.0.0.1:3200/princy-api/api/agent/models`

Deve retornar JSON com `models`. Se der 404, falta recompilar o servidor (passo 2).

## Passo 1 — Backend (ja OK no seu caso)

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Teste: `http://127.0.0.1:3210/api/health`

## Passo 2 — Recompilar Code Web + extensao (proxy /princy-api)

```powershell
cd C:\Apps\Editor
git pull
$env:PRINCY_SKIP_GULP_CLEAN = "1"
npm run compile-incremental
npm run compile-web
```

Reinicie o Code Web:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\start-princy-code-web.ps1
```

## Passo 3 — Testar proxy

```powershell
Invoke-WebRequest "http://127.0.0.1:3200/princy-api/api/agent/models" -UseBasicParsing
```

## Passo 4 — Chat

- Comando: **Princy Ai: Reconnect Agent Backend**
- Cabecalho do chat deve mostrar **online**
- Mensagem antiga `Usando lista local de agentes` some apos `compile-web` (extensao nova)

Ou copie settings prontos:

```powershell
Copy-Item C:\Apps\Editor\deploy\windows\princy-vps-local.settings.json "$env:APPDATA\Princy Ai\User\settings.json"
```

(Ajuste o caminho do perfil se o data folder for outro.)
