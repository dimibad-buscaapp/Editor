# Porta 3200 — Code-OSS Web (/webeditor)

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
| Args NSSM | `-ProjectRoot ... -HostName 0.0.0.0 -Port 3200 -ServerBasePath /webeditor -Dev` |
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
| Starting infinito | Porta ocupada / script PS quebrado | `Start-PrincyAlwaysOnline.ps1` |

## Teste rapido

```powershell
Invoke-WebRequest http://127.0.0.1:3200/webeditor/ -UseBasicParsing
Invoke-WebRequest https://princyai.com/webeditor/ -UseBasicParsing
```
