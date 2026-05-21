# Groq no VPS (chat rapido com streaming)

## .env recomendado

Edite `C:\Apps\Editor\apps\ai-dashboard\.env`:

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave
GROQ_CHAT_MODEL=llama-3.1-8b-instant

PRINCY_SIMPLE_MODE=true
PRINCY_RAG_ENABLED=false
PRINCY_ORCHESTRATOR_CONSENSUS=false
PRINCY_OLLAMA_NUM_PREDICT=2048
```

Chave: https://console.groq.com → API Keys.

Modelos uteis no Groq:

| Modelo | Uso |
|--------|-----|
| `llama-3.1-8b-instant` | Rapido, bom para chat geral |
| `llama-3.3-70b-versatile` | Mais capaz, um pouco mais lento |
| `qwen-qwq-32b` | Codigo (se disponivel na conta) |

## Deploy

```powershell
cd C:\Apps\Editor
git pull
cd apps\ai-dashboard
npm run build
Restart-Service PrincyAiAgentBackend
```

## Confirmar que usa Groq

1. Envie uma mensagem no chat do dashboard.
2. No rodape/status da resposta deve aparecer motor **`groq`** (nao `deepseek-coder`).
3. Resposta deve comecar em **1–5 segundos** (nao minutos).

Teste local:

```powershell
$body = @{ agent='princy'; message='diga apenas: ok' } | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:3210/api/agent/chat -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
```

## Erros comuns

| Erro | Solucao |
|------|---------|
| `GROQ_API_KEY is required` | Falta chave no `.env` ou servico nao reiniciado |
| `401` | Chave invalida ou revogada |
| `429` | Limite da conta Groq — espere ou troque modelo |
| Ainda lento / `deepseek-coder` | `AI_PROVIDER` nao e `groq` ou build antigo — `git pull` + `npm run build` |

## Voltar para Ollama local

```env
AI_PROVIDER=ollama
PRINCY_SIMPLE_MODE=true
```

Reinicie o servico.
