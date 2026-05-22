# Porta 3200 — Code-OSS Web (/webeditor)

## Raiz vs /webeditor (erro mais comum)

| Config | URL no log `Web UI available` | HTTPS publico |
|--------|------------------------------|---------------|
| **Errado** (antigo OSS na raiz) | `http://...:3200` | `https://princyai.com/webeditor/` → **branco / 404** |
| **Certo** | `http://...:3200/webeditor` | `https://princyai.com/webeditor/` → workbench |

O processo Node **tem** de arrancar com `--server-base-path /webeditor`. O Caddy envia `/webeditor/*` intacto; sem esse flag o servidor trata o path como lixo.

```powershell
nssm get PrincyAiCodeWeb AppParameters
# deve conter: --server-base-path /webeditor

powershell -File deploy\windows\code-web\ensure-webeditor-base-path.ps1
```

## Fluxo completo

```text
Internet (HTTPS :443)
    |
    v
PrincyCaddy (C:\Caddy\Caddyfile)
    |  handle /webeditor*  -> NAO usar handle_path (mantem prefixo)
    v
127.0.0.1:3200  ou  108.181.169.40:3200
    |
    v
PrincyAiCodeWeb (NSSM) -> powershell -> run-princy-code-web.ps1
    |
    v
node out\server-main.js
  workspaces\default
  --host 0.0.0.0
  --port 3200
  --without-connection-token    <- sem isso = Forbidden
  --server-base-path /webeditor
  --user-data-dir .princy-user-data
```

## Ligacoes

| De | Para | Como |
|----|------|------|
| Browser | `https://princyai.com/webeditor/` | Caddy :443 |
| Caddy | `:3200` | reverse_proxy |
| Editor HTML/JS | `/webeditor/oss-dev/static/...` | mesmo host (base path) |
| Chat Princy (extensao) | `https://princyai.com/princy-api` | Caddy -> :3210 (NAO :3200 direto no browser) |
| Backend probes | `http://108.181.169.40:3200/webeditor` | CODE_WEB_URL no .env |

## Servico Windows (sempre online)

| Item | Valor |
|------|-------|
| Nome | `PrincyAiCodeWeb` |
| Startup | `Automatic` (SERVICE_AUTO_START) |
| Runner | `deploy\windows\code-web\run-princy-code-web.ps1` |
| Args NSSM | `-ProjectRoot ... -HostName 0.0.0.0 -Port 3200 -ServerBasePath /webeditor` (producao auto se compile OK) |
| Compile producao | `deploy\windows\code-web\compile-princy-code-web-production.ps1` |
| Logs | `logs\code-web.out.log`, `logs\code-web.err.log` |

## Comandos VPS (Administrador)

```powershell
cd C:\Apps\Editor
git pull
powershell -ExecutionPolicy Bypass -File deploy\windows\Start-PrincyAlwaysOnline.ps1
```

Reinstalar NSSM do zero:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\Start-PrincyAlwaysOnline.ps1 -ReinstallServices
```

## Erros comuns

| Sintoma | Causa | Correcao |
|---------|-------|----------|
| Forbidden | Sem `--without-connection-token` | Usar `run-princy-code-web.ps1` (ja inclui) |
| EADDRINUSE | Dois processos na 3200 | `Stop-CodeWebPort.ps1` + um so servico |
| Tela branca | VSCODE_DEV + meta undefined antigo | `git pull` + reiniciar servico |
| Demora / nao abre OSS | Modo DEV (`VSCODE_DEV=1`, milhares de .js) | `compile-princy-code-web-production.ps1` + reiniciar servico |
| Starting infinito | Porta ocupada / script PS quebrado | `Start-PrincyAlwaysOnline.ps1` |

## `ERR_CONNECTION_TIMED_OUT` em `http://108.181.169.40:3200/`

Isto e **esperado** se voce abre a porta 3200 no browser de fora do VPS:

| Onde testa | Resultado normal |
|------------|------------------|
| PC / celular → `http://108.181.169.40:3200/` | **Timeout** — firewall do provedor (Hostinger) e muitas vezes o Windows **nao** expoem 3200 na internet |
| PC / celular → `https://princyai.com/webeditor/` | **Correto** — Caddy :443 → `127.0.0.1:3200` por dentro |
| **No VPS** → `http://127.0.0.1:3200/webeditor/` | Deve responder **200** se `PrincyAiCodeWeb` estiver Running |

A porta 3200 e **interna** ao servidor. Na internet publica use so **80/443** (Caddy).

### Diagnostico no VPS (PowerShell como Admin)

```powershell
cd C:\Apps\Editor
Get-Service PrincyAiCodeWeb, PrincyCaddy
powershell -File deploy\windows\check-princy-ports.ps1
Invoke-WebRequest http://127.0.0.1:3200/webeditor/ -UseBasicParsing -TimeoutSec 15
Invoke-WebRequest https://princyai.com/webeditor/ -UseBasicParsing -TimeoutSec 15
```

Se `127.0.0.1:3200` falhar → servico parado ou compile ausente:

```powershell
powershell -File deploy\windows\Start-PrincyAlwaysOnline.ps1
# ou
powershell -File deploy\windows\code-web\fix-webeditor-502.ps1
```

Se local OK mas `https://princyai.com/webeditor/` falhar → Caddy:

```powershell
Copy-Item C:\Apps\Editor\deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
caddy validate --config C:\Caddy\Caddyfile
Restart-Service PrincyCaddy
```

### Abrir 3200 na internet (opcional, nao recomendado)

So se precisar de acesso direto por IP (debug): regra no firewall Windows **e** painel VPS (security group) para TCP 3200. Producao: prefira sempre `https://princyai.com/webeditor/`.

## Teste rapido

```powershell
Invoke-WebRequest http://127.0.0.1:3200/webeditor/ -UseBasicParsing
Invoke-WebRequest https://princyai.com/webeditor/ -UseBasicParsing
```
