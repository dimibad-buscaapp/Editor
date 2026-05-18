# Princy Ai Agent Backend

Este serviço Fastify fornece a API usada pela extensão embutida `extensions/princy-ai`.

## Porta

```text
3210
```

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
