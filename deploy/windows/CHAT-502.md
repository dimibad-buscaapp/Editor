# Chat mostra "502" ou "Chat 502"

## O que significa

A tela do chat carrega (mensagem de boas-vindas e fixa no navegador), mas ao enviar mensagem aparece erro **502/503**.

Isso **nao** e o editor (3200). E a **API do agente na 3210** ou o **Ollama** (LLM local).

## Checklist no VPS

```powershell
# 1) Backend rodando?
Invoke-WebRequest http://127.0.0.1:3210/api/agent/health -UseBasicParsing

# 2) Ollama rodando?
Invoke-WebRequest http://127.0.0.1:11434/api/tags -UseBasicParsing

# 3) Modelo instalado?
ollama pull deepseek-coder
```

## Subir o backend

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

No `.env` (`apps\ai-dashboard\.env`), para chat rapido no dashboard:

```env
PRINCY_SIMPLE_MODE=true
PRINCY_RAG_ENABLED=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=deepseek-coder
```

Depois `npm run build` em `apps\ai-dashboard` e reinicie o backend.

## Caddy

`https://dashboard.princyai.com` encaminha para `127.0.0.1:3210`. Se o backend parar, o chat devolve **502**.
