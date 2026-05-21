# dashboard.princyai.com (JSON) vs princyai.com (branco)

## Dashboard mostra JSON em vez da interface

Se `https://dashboard.princyai.com/` retorna:

```json
{"ok":true,"service":"Princy Ai Agent Backend",...}
```

O backend esta **sem build do frontend** ou ainda com codigo antigo (rota `GET /` em JSON).

No VPS:

```powershell
cd C:\Apps\Editor\apps\ai-dashboard
npm run build
# reinicie o backend (Ctrl+C no PS do agent e):
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Depois abra:

- **Chat IA (porta 3210):** `https://dashboard.princyai.com/` ou `https://dashboard.princyai.com/#/chat`
- Login: `https://dashboard.princyai.com/#/login`
- Hub: `https://dashboard.princyai.com/#/hub`
- Logs: `https://dashboard.princyai.com/#/logs`

Teste local:

```powershell
Invoke-WebRequest http://127.0.0.1:3210/ -UseBasicParsing | Select-Object StatusCode, @{n='Len';e={$_.Content.Length}}
```

Com frontend OK, o HTML tem milhares de caracteres (nao so JSON curto).

Metadados da API: `https://dashboard.princyai.com/api/meta`

---

## princyai.com fica em branco

HTTPS no dominio so encaminha para o **Code Web na porta 3200**. Pagina branca quase sempre significa:

1. **Code Web nao esta rodando** na 3200, ou
2. **Compilacao incompleta** (falta `out\vs\code\browser\workbench\workbench-dev.html`).

### 1) Subir o editor (obrigatorio)

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\code-web\start-princy-code-web.ps1
```

Espere a linha tipo `Web UI available at http://127.0.0.1:3200`.

### 2) Testar no VPS antes do dominio

```powershell
Invoke-WebRequest http://127.0.0.1:3200 -UseBasicParsing | Select-Object StatusCode, @{n='Len';e={$_.Content.Length}}
Test-Path C:\Apps\Editor\out\vs\code\browser\workbench\workbench-dev.html
```

Se `Len` for muito pequeno ou `Test-Path` for `False`, compile:

```powershell
cd C:\Apps\Editor
$env:NODE_OPTIONS = '--max-old-space-size=8192'
$env:PRINCY_SKIP_GULP_CLEAN = '1'
npm run compile-incremental
npm run compile-web
```

### 3) Caddy + backend

Os tres processos devem estar ativos:

| Processo | Porta |
|----------|-------|
| Agent backend | 3210 |
| Code Web | 3200 |
| Caddy | 80 / 443 |

```powershell
Invoke-WebRequest http://127.0.0.1:3200/princy-api/api/health -UseBasicParsing
Invoke-WebRequest https://princyai.com/princy-api/api/health -UseBasicParsing
```

### 4) Browser

- Abra `https://princyai.com` (nao so `www` se DNS de `www` estiver errado).
- F12 → Network: se muitos **404** em `vs/...` ou `workbench`, falta compile.
- Limpe cache / service worker da aba antiga (`127.0.0.1:3200`).

Settings no VPS (user data do Code Web):

```json
"princyai.useSameOriginApi": true,
"princyai.agentEndpoint": "https://princyai.com/princy-api"
```

Arquivo modelo: `deploy/windows/princy-production.settings.json`
