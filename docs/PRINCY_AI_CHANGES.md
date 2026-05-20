# Princy Ai Changes

Este documento consolida as mudancas recentes do Princy Ai para deploy no VPS Windows em `C:\Apps\Editor`.

## Identidade e Deploy

- O produto visivel agora usa a marca `Princy Ai` em `product.json`.
- O app principal roda como Princy Ai Web na porta `3200`.
- O backend de agentes roda separado na porta `3210`.
- O MVP `apps/ai-dashboard` permanece como laboratorio/backend, mas nao e mais a pagina principal do produto.

## Lockdown do Copilot

- O launcher `deploy/windows/code-web/start-princy-code-web.ps1` inicia o editor com:
  - `--disable-extension` para: `GitHub.copilot`, `GitHub.copilot-chat`, `GitHub.vscode-pull-request-github`, `vscode.github-authentication`, `vscode.microsoft-authentication`
- `product.json` nao define mais `defaultChatAgent` apontando para Copilot.
- `product.json` nao concede mais `trustedExtensionAuthAccess` para `GitHub.copilot-chat`.
- `.vscode/settings.json` bloqueia Copilot, sugestoes inline e trigger suggestions externas no workspace.
- `.vscode/extensions.json` recomenda `princyai.princy-ai` e marca Copilot/Copilot Chat como indesejados.
- A pasta `extensions/copilot` foi removida do repositorio para evitar ativacao acidental e erro de modulo ausente.

## Agentes Princy Ai

A extensao embutida `extensions/princy-ai` oferece:

- Cmd+K/Cmd+K Cmd+I para edicao inline com IA (Ask Princy).
- Ghost text (inline suggest) via Ollama enquanto digita, configuravel em `princyai.ghostText.*`.
- Tema **Princy Black** (preto puro estilo Cursor) aplicado por padrao via `princyai.ui.forceBlackTheme`.
- Chat lateral redesenhado (composer fixo embaixo, bolhas do usuario, visual Cursor-like).
- Chat padrao: apenas **Princy Ai** na barra direita (auxiliary bar); chat nativo da plataforma nao registra container sem `defaultChatAgent`.
- `princyai.ui.defaultChat`: desliga sessoes/agent bar nativos e abre `workbench.view.extension.princyai` ao iniciar.
- Contexto `@file`, `@folder`, `@selection`, `@terminal`, `@codebase` no chat.
- Regras em `.princy/rules/*.md`, `.princyrule` ou `.cursorrules`.
- Indexacao em lote do workspace (`princyai.indexWorkspace`, `/api/agent/index-batch`).
- Composer com **Apply All** / **Reject All** e lista de arquivos afetados.
- Workbench minimalista (activity bar topo, sem minimap, menu compacto).
- Streaming token-a-token: Ollama/OpenAI stream + SSE `GET /api/agent/jobs/:id/stream`.
- Fontes: `deploy/windows/install-princy-fonts.ps1` (JetBrains Mono + Cascadia).
- Cmd+L para foco no chat lateral.
- Seletor de agentes gratuitos locais via Ollama: `princy`, `deepseek`, `qwen`, `codellama`, `llama3` e `mistral`.
- Agente `openai` opcional quando `OPENAI_API_KEY` estiver configurada.
- Chat com Markdown rico, acoes em blocos de codigo e checkpoints de processo.
- Composer Mode para planos multi-arquivo com operacoes `create`, `modify`, `delete` e `runCommand`.
- Shadow Context com arquivo ativo, abas abertas, diagnosticos e ultimo resultado do terminal.
- Code Graph inicial via LSP para simbolos, definicoes e referencias.
- Terminal controlado com captura de resultado e fluxo de reparo.
- `Fix with Princy AI` no terminal para transformar erros detectados em contexto do Composer.

## Proxy OpenAI-Compatible

O backend expõe endpoints compativeis com clientes que aceitam OpenAI Base URL:

```text
GET  http://127.0.0.1:3210/v1/models
POST http://127.0.0.1:3210/v1/chat/completions
```

Base URL:

```text
http://127.0.0.1:3210/v1
```

Se `AGENT_API_TOKEN` estiver definido, envie:

```text
Authorization: Bearer <AGENT_API_TOKEN>
```

Modelos externos sao roteados para agentes Princy:

- `princy` -> Princy Ai.
- `deepseek` -> DeepSeek Coder.
- `qwen` -> Qwen Coder.
- `codellama` -> CodeLlama.
- `llama3` -> Llama 3.1.
- `mistral` -> Mistral.
- `openai` ou `gpt*` -> OpenAI opcional.

## Como Rodar no VPS

Code web:

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\start-princy-code-web.ps1
```

Backend de agentes:

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Modelos Ollama recomendados:

```powershell
ollama pull llama3.1
ollama pull nomic-embed-text
ollama pull deepseek-coder
ollama pull qwen2.5-coder
ollama pull codellama
ollama pull mistral
```

## Validacao Git e Build

Antes de enviar:

```powershell
git status
git diff --stat
git log -5 --oneline
```

Backend:

```powershell
Set-Location C:\Apps\Editor\apps\ai-dashboard
npm run build:backend
```

Code-OSS/Princy Ai Web no VPS:

```powershell
Set-Location C:\Apps\Editor
npm run compile
npm run compile-web
```

Depois do push, confirme:

```powershell
git log -5 --oneline
git status
```

## Erro no chat: `Failed to fetch`

Sintoma: o painel mostra `[Princy IA] Falha` ou `Failed to fetch` logo apos iniciar o job.

Causas comuns:

1. **Agent backend parado** — o Code Web (`3200`) nao inclui a API; inicie:
   ```powershell
   .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
   ```
   Teste no navegador: `http://127.0.0.1:3210/api/health`

2. **CORS** — o backend deve aceitar a origem do editor. No `.env` do backend:
   - `APP_ORIGIN=http://127.0.0.1:3200`
   - `CODE_WEB_URL=http://127.0.0.1:3200`
   - Opcional: `PRINCY_CORS_ORIGINS=https://princyai.com`

3. **HTTPS + HTTP misto** — se o editor abre em `https://princyai.com`, o browser bloqueia chamadas para `http://127.0.0.1:3210`. Use proxy HTTPS para a API ou configure `princyai.agentEndpoint` para URL segura.

4. **Token** — se `AGENT_API_TOKEN` estiver definido no servidor, configure `princyai.apiToken` com o mesmo valor (erro costuma ser HTTP 401, nao `Failed to fetch`).

O chat mostra **● online / ● offline** no cabecalho apos checar `GET /api/agent/health`.

Com Caddy, prefira API na mesma origem: `https://princyai.com/princy-api` (ver `deploy/windows/code-web/Caddyfile`).
O Code Web tambem expoe `http://HOST:3200/princy-api` (proxy no servidor para `127.0.0.1:3210`) — necessario para o chat no browser.
A extensao tenta `/princy-api` automaticamente (`princyai.useSameOriginApi`).
Comando: **Princy Ai: Reconnect Agent Backend** (`princyai.reconnectBackend`).

Chat somente webview (evita crash `agent.id` / `agent.metadata` no chat nativo): ver [`PRINCY_CHAT_WEBVIEW_ONLY.md`](PRINCY_CHAT_WEBVIEW_ONLY.md).
