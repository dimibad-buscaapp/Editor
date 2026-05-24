# IA + Web sempre online (Windows VPS)

## Revisao do seu `.env`

Problemas no arquivo atual:

| Item | Problema | Correcao |
|------|----------|----------|
| `OLLAMA_*` | Duplicado (com e sem aspas) | Uma linha so: `OLLAMA_BASE_URL="http://127.0.0.1:11434"` |
| `API_HOST` | `127.0.0.1` | Use `0.0.0.0` (Caddy ainda usa 127.0.0.1) |
| `CODE_WEB_URL` | `http://127.0.0.1:3200/webeditor` | Nao use `https://princyai.com` sozinho (e a landing) |
| `PRINCY_CORS_ORIGINS` | Falta dashboard | Inclua `https://dashboard.princyai.com` |
| `PRINCY_PUBLIC_CHAT` | Ausente | `PRINCY_PUBLIC_CHAT="true"` |
| `SESSION_SECRET` | Placeholder | Troque por segredo longo aleatorio |
| Orquestrador `true` | Com `PRINCY_SIMPLE_MODE=true` | Ignorado pelo codigo; pode deixar simple=true |

Arquivo modelo corrigido: `apps/ai-dashboard/deploy/windows/princyai.env.production.example`

```powershell
Copy-Item C:\Apps\Editor\apps\ai-dashboard\deploy\windows\princyai.env.production.example C:\Apps\Editor\apps\ai-dashboard\.env -Force
notepad C:\Apps\Editor\apps\ai-dashboard\.env
```

---

## Pre-requisitos

1. **PostgreSQL** rodando (DATABASE_URL)
2. **Ollama** instalado + `ollama pull deepseek-coder`
3. **Caddy** em `C:\Caddy\caddy.exe` + Caddyfile
4. **NSSM** (gerenciador de servico):

```powershell
winget install NSSM.NSSM
```

5. **IIS parado** (porta 80): `iisreset /stop`

---

## Instalar servicos (auto-start + reinicio)

PowerShell **como Administrador**:

```powershell
cd C:\Apps\Editor
git pull origin main

# Compile do editor (primeira vez, pode demorar)
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\start-princy-code-web.ps1
# Pare com Ctrl+C quando aparecer "Web UI available", depois:

powershell -ExecutionPolicy Bypass -File .\deploy\windows\install-princy-production-services.ps1
```

Iniciar:

```powershell
Start-Service PrincyAiAgentBackend, PrincyAiCodeWeb, PrincyCaddy
```

---

## Reiniciar quando precisar

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\restart-princy-services.ps1
```

Ou por servico:

```powershell
Restart-Service PrincyAiAgentBackend
Restart-Service PrincyAiCodeWeb
Restart-Service PrincyCaddy
```

---

## Logs

```text
C:\Apps\Editor\logs\agent-backend.out.log
C:\Apps\Editor\logs\code-web.out.log
C:\Apps\Editor\logs\caddy.out.log
```

---

## Apos mudar `.env`

```powershell
cd C:\Apps\Editor\apps\ai-dashboard
npm run build
Restart-Service PrincyAiAgentBackend
```

---

## Diagnostico

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\check-princy-ports.ps1
Get-Service PrincyAiAgentBackend, PrincyAiCodeWeb, PrincyCaddy
```

---

## Fase 1 — Estabilizar base

Checklist HTTP, chat, streaming e layout: **[FASE1-ESTABILIZAR.md](FASE1-ESTABILIZAR.md)**

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\run-fase1-validation.ps1
```

Gate 0 rapido (Task Scheduler opcional): `install-princy-phase1-scheduled-task.ps1`

Visual premium Fase 2: **[FASE2-VISUAL.md](FASE2-VISUAL.md)**
