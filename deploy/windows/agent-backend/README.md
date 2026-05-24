# Princy Ai Agent Backend

Este serviço Fastify fornece a API usada pela extensão embutida `extensions/princy-ai`.

## Porta

```text
3210
```

## Reparo completo (chat offline no editor ou dashboard)

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\agent-backend\repair-princy-agent-3210.ps1 -ProjectRoot C:\Apps\Editor
```

Verifica servicos, build, `.env`, health `:3210`, proxy `:3200/princy-api`, HTTPS e `/api/diagnostic`.

O Code-OSS Web usa `3200`. O backend de IA usa `3210`.

## Preparar

```powershell
Set-Location C:\Apps\Editor\apps\ai-dashboard
notepad .env
```

Valores importantes:

```text
DATABASE_URL="postgresql://ai_dashboard:ai_dashboard@localhost:5432/ai_dashboard?schema=public"
APP_ORIGIN="http://127.0.0.1:3200"
API_HOST="127.0.0.1"
API_PORT="3210"
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
```

**Teste local no VPS** (editor em `http://127.0.0.1:3200`):

```text
APP_ORIGIN="http://127.0.0.1:3200"
CODE_WEB_URL="http://127.0.0.1:3200"
PRINCY_CORS_ORIGINS="https://princyai.com,http://127.0.0.1:3200"
```

Template: `apps/ai-dashboard/deploy/windows/princyai.env.local.example`

**Producao com dominio** (`princyai.com` na Hostinger + Caddy):

```text
APP_ORIGIN="https://princyai.com"
CODE_WEB_URL="https://princyai.com"
PRINCY_CORS_ORIGINS="https://princyai.com,http://127.0.0.1:3200"
```

Se o browser mostrar `Access-Control-Allow-Origin: https://princyai.com` mas o editor estiver em `http://127.0.0.1:3200`, ajuste `APP_ORIGIN` e `PRINCY_CORS_ORIGINS` e rode `npm run build:backend`.

No editor: `princyai.agentEndpoint` = `https://api.princyai.com`. Veja [`../DOMINIO-HOSTINGER.md`](../DOMINIO-HOSTINGER.md).

## Rodar Manualmente

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Teste:

```powershell
Invoke-WebRequest http://127.0.0.1:3210/api/health
```

## Rodar Como Servico

Opcionalmente, instale NSSM:

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\install-princy-agent-backend-service.ps1
Start-Service PrincyAiAgentBackend
```

## Endpoints Principais

- `POST /api/agent/inline-edit`
- `POST /api/agent/chat`
- `POST /api/agent/chat/stream`
- `POST /api/agent/index-file`
- `POST /api/agent/composer-plan`
- `POST /api/agent/repair-after-command`
- `GET /api/agent/models`
- `GET /api/agent/orchestrator/segments`
- `GET /v1/models`
- `POST /v1/chat/completions`

Se `AGENT_API_TOKEN` estiver definido no `.env`, configure o mesmo valor em `princyai.apiToken` no Princy Ai Web. Clientes OpenAI-compatible devem enviar `Authorization: Bearer <AGENT_API_TOKEN>`.

## Proxy OpenAI-Compatible

Use o backend Princy como Base URL em clientes que aceitam endpoint OpenAI customizado:

```text
http://127.0.0.1:3210/v1
```

Modelos aceitos:

- `deepseek`: agente principal Princy Ai DeepSeek.
- `princy`: alias da marca Princy Ai usando DeepSeek Coder local via Ollama.
- `qwen`: Qwen Coder local via Ollama.
- `codellama`: CodeLlama local via Ollama.
- `llama3`: Llama 3.1 local via Ollama.
- `mistral`: Mistral local via Ollama.
- `openai`: OpenAI opcional, requer `OPENAI_API_KEY`.

Exemplo:

```powershell
$headers = @{ Authorization = "Bearer $env:AGENT_API_TOKEN" }
$body = @{
  model = "princy"
  messages = @(@{ role = "user"; content = "Explique este workspace." })
} | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:3210/v1/chat/completions -Method Post -Headers $headers -ContentType "application/json" -Body $body
```

## Orquestrador de Consenso (Princy Ai)

Com `PRINCY_ORCHESTRATOR_ENABLED=true`, os agentes `princy` e `deepseek` usam 3 motores por segmento com fallback automatico:

| Segmento | Motor 1 | Motor 2 | Motor 3 |
|----------|---------|---------|---------|
| LOGIC | DeepSeek V3 | Llama 3.3 70B (Groq) | Mistral Large |
| FRONTEND | Gemini 1.5 Flash | Llama 3.1 8B (Groq) | Qwen 2.5 Coder |
| BACKEND | DeepSeek Coder | Qwen 2.5 Coder | Phi-3 |
| DEBUG | Llama 3.3 70B | Gemini 1.5 Flash | Mistral 7B |

Chaves suportadas no `.env`:

- `GROQ_API_KEY` para Llama/Mistral rapidos.
- `GOOGLE_AI_API_KEY` para Gemini Flash.
- `DEEPSEEK_API_KEY` para DeepSeek V3/Coder.
- `HUGGINGFACE_API_KEY` opcional.
- Sem chave cloud, o fallback usa Ollama local (`OLLAMA_BASE_URL`).

Consulte a matriz em tempo real:

```powershell
Invoke-RestMethod http://127.0.0.1:3210/api/agent/orchestrator/segments
```

## Agentes Locais Gratuitos

O seletor da extensão `Princy Ai` suporta estes agentes:

- `princy`: usa `OLLAMA_CHAT_MODEL`, por padrão `llama3.1`.
- `deepseek`: usa `deepseek-coder`.
- `qwen`: usa `qwen2.5-coder`.
- `codellama`: usa `codellama`.
- `llama3`: usa `llama3.1`.
- `mistral`: usa `mistral`.
- `openai`: opcional e pago, requer `OPENAI_API_KEY`.

Para usar os agentes locais sem cobrança por requisição, instale os modelos no Ollama:

```powershell
ollama pull llama3.1
ollama pull nomic-embed-text
ollama pull deepseek-coder
ollama pull qwen2.5-coder
ollama pull codellama
ollama pull mistral
```

Eles sao "ilimitados" no sentido de nao dependerem de cota externa, mas ficam limitados pela CPU/RAM/GPU do VPS.

## Composer, Shadow Context e Terminal

A extensao `Princy Ai` agora envia contexto silencioso junto das perguntas:

- arquivo ativo e linguagem;
- abas abertas;
- diagnosticos atuais do editor;
- ultimo resultado de terminal controlado pela Princy Ai;
- simbolos, definicoes e referencias coletadas via LSP.

O Composer retorna um plano JSON com operacoes multi-arquivo. A extensao mostra as operacoes para revisao e so aplica arquivos/comandos depois da aprovacao do usuario. Se um comando de verificacao falhar e o terminal oferecer Shell Integration, a saida capturada pode ser enviada para `/api/agent/repair-after-command` para gerar um plano de correcao.

Na UI, o chat da Princy Ai funciona como painel de processo: exibe checkpoints de raciocinio, blocos de codigo com acoes `Copy`, `Insert at Cursor` e `Apply to File`, e pre-visualizacao diff-like para operacoes Composer. Linhas de erro detectadas no terminal integrado ficam clicaveis via `Fix with Princy AI`, abrindo o Composer com o erro como contexto.
