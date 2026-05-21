# Princy Ai online (HTTPS + login + logs)

## URLs publicas (Caddy)

| Servico | URL | Porta interna |
|---------|-----|----------------|
| Editor Code Web | https://princyai.com | 3200 |
| Proxy API no editor | https://princyai.com/princy-api/... | → 3210 |
| API direta | https://api.princyai.com | 3210 |
| Login + dashboard + **logs** | https://dashboard.princyai.com | 3210 |

Pagina de diagnostico: **https://dashboard.princyai.com/#/logs**

---

## DNS Hostinger

Registros `A` para o IP do VPS: `@`, `www`, `api`, `dashboard`.

---

## PowerShell 1 — backend + dashboard + login

```powershell
cd C:\Apps\Editor
git pull origin main

cd C:\Apps\Editor\apps\ai-dashboard
Copy-Item .\deploy\windows\princyai.env.example .\.env
# edite SESSION_SECRET, DATABASE_URL, PRINCY_CORS_ORIGINS

cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Teste local:

```powershell
Invoke-WebRequest "http://127.0.0.1:3210/api/health" -UseBasicParsing
Start-Process "http://127.0.0.1:3210/#/logs"
```

---

## PowerShell 2 — Code Web (editor)

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\start-princy-code-web.ps1
```

Teste proxy:

```powershell
Invoke-WebRequest "http://127.0.0.1:3200/princy-api/api/health" -UseBasicParsing
```

---

## Caddy (HTTPS)

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\install-princy-caddy.ps1

# Depois, como Administrador:
C:\Caddy\caddy.exe run --config C:\Caddy\Caddyfile
```

Firewall: abrir **80** e **443** apenas.

---

## Settings do editor (HTTPS)

```json
{
  "princyai.agentEndpoint": "https://princyai.com/princy-api",
  "princyai.useSameOriginApi": true
}
```

**Nao** use `https://api.princyai.com/princy-api` no browser do editor — use o proxy na mesma origem `princyai.com`.

---

## Se a web nao abre

1. Abra **https://dashboard.princyai.com/#/logs** e veja checks vermelhos.
2. Confirme `dist/frontend` existe apos `npm run build` em `apps/ai-dashboard`.
3. PostgreSQL + Ollama rodando.
4. Code Web compilado (`npm run compile-incremental`).
