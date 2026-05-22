# LogView — https://princyai.com/logview

Dashboard de diagnostico: landing (3220) → Code-OSS Web (3200).

## URLs

| URL | Servico |
|-----|---------|
| https://princyai.com/logview/ | HTML (agent :3210) |
| https://princyai.com/logview/?autostart=1 | Inicia simulacao landing→editor |
| /princy-api/api/editor/runtime-log | Tail logs VPS (2s) |
| /princy-api/api/editor/stack-probes | Probes 3220/3200/3210/HTTPS |

## Deploy VPS

```powershell
cd C:\Apps\Editor
git pull
cd apps\ai-dashboard
npm run build:backend
Copy-Item deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
Restart-Service PrincyAiAgentBackend, PrincyCaddy
```

Teste:

```powershell
Invoke-WebRequest https://princyai.com/logview/ -UseBasicParsing | Select-Object StatusCode
```

Deve retornar **200** e HTML com "LogView".
