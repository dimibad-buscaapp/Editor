# Corrigir chat no Code Web (3200) com backend OK na 3210

## Service Worker / cache antigo

Se o log mostrar `unexpected service worker version`:

1. Abra `http://127.0.0.1:3200` → F12 → **Application**
2. **Service Workers** → **Unregister**
3. **Storage** → **Clear site data**
4. Recarregue com **Ctrl+F5**

O launcher usa `--user-data-dir C:\Apps\Editor\.princy-user-data` para evitar perfil quebrado.

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
