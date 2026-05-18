# Princy Ai Changes

Este documento consolida as mudancas recentes do Princy Ai para deploy no VPS Windows em `C:\Apps\Editor`.

## Identidade e Deploy

- O produto visivel agora usa a marca `Princy Ai` em `product.json`.
- O app principal roda como Princy Ai Web na porta `3200`.
- O backend de agentes roda separado na porta `3210`.
- O MVP `apps/ai-dashboard` permanece como laboratorio/backend, mas nao e mais a pagina principal do produto.

## Lockdown do Copilot

- O launcher `deploy/windows/code-web/start-princy-code-web.ps1` inicia o editor com:
  - `--disable-extension GitHub.copilot-chat`
  - `--disable-extension GitHub.copilot`
- `product.json` nao define mais `defaultChatAgent` apontando para Copilot.
- `product.json` nao concede mais `trustedExtensionAuthAccess` para `GitHub.copilot-chat`.
- `.vscode/settings.json` bloqueia Copilot, sugestoes inline e trigger suggestions externas no workspace.
- `.vscode/extensions.json` recomenda `princyai.princy-ai` e marca Copilot/Copilot Chat como indesejados.
- A pasta `extensions/copilot` foi removida do repositorio para evitar ativacao acidental e erro de modulo ausente.

## Agentes Princy Ai

A extensao embutida `extensions/princy-ai` oferece:

- Cmd+K/Cmd+K Cmd+I para edicao inline com IA.
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
