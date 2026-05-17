# Princy Ai

Nome publico: Princy Ai

MVP web isolado para validar dashboard autenticado, workspaces, Monaco Editor, chat IA e indexacao inicial de arquivos antes de migrar conceitos para um fork Code-OSS.

## Stack

- React, Vite e TypeScript no frontend.
- Fastify e TypeScript no backend.
- Prisma e PostgreSQL para dados persistentes.
- Embeddings em JSONB com busca semantica calculada no backend.
- Monaco Editor para edicao de arquivos.
- Web Worker para preparar chunks de arquivos sem travar a interface.
- OpenAI ou Ollama para embeddings e resposta da LLM.

## Desenvolvimento Local

1. Copie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

2. Instale dependencias:

```powershell
npm install
```

3. Use PostgreSQL 17 local no Windows ou suba um PostgreSQL opcional por Docker.

Para Windows Server/local sem Docker, confirme que o `.env` aponta para:

```text
DATABASE_URL="postgresql://ai_dashboard:ai_dashboard@localhost:5432/ai_dashboard?schema=public"
```

Opcionalmente, em ambiente de desenvolvimento com Docker:

```powershell
docker compose up -d postgres
```

4. Gere o client Prisma e aplique as migrations.

Em desenvolvimento:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

No VPS/producao:

```powershell
npm run prisma:generate
npm run prisma:deploy
```

5. Configure o provider de IA no `.env`.

Para usar Ollama local:

```powershell
ollama pull llama3.1
ollama pull nomic-embed-text
```

Mantenha:

```text
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
```

Para usar OpenAI:

```text
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_CHAT_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

6. Inicie frontend e backend:

```powershell
npm run dev
```

O frontend fica em `http://localhost:5173` e o backend em `http://localhost:3200`.

## Funcionalidades Implementadas

- Registro, login, logout e sessao por cookie HTTP-only.
- Dashboard protegido por autenticacao.
- Criacao e listagem de workspaces.
- Armazenamento de arquivos por usuario/workspace em `workspace-storage`.
- Listagem, leitura e salvamento de arquivos com validacao de paths.
- Monaco Editor integrado ao workspace.
- Chat IA com persistencia de mensagens.
- Web Worker para gerar chunks de arquivos.
- RAG real: embeddings gravados em `FileChunk`, busca semantica no backend e resposta via OpenAI/Ollama.

## Modelo de Dados

O schema Prisma inicial inclui:

- `User`
- `Session`
- `Workspace`
- `WorkspaceFile`
- `ChatSession`
- `ChatMessage`
- `FileEmbeddingJob`
- `FileChunk`

## Notas de Seguranca

- Nao exponha o backend diretamente na internet sem HTTPS e reverse proxy.
- Troque `SESSION_SECRET` antes de qualquer deploy.
- Nao use a senha padrao do PostgreSQL em producao.
- O backend nunca aceita caminho absoluto vindo do cliente.
- Todos os acessos a workspaces sao filtrados por `userId`.
- Chunks enviados pelo frontend sao gravados apenas dentro do workspace autenticado.

## Deploy Inicial no VPS Windows Server 2025

Ambiente alvo:

- Repositorio: `https://github.com/dimibad-buscaapp/Editor.git`
- VPS: `108.181.169.40`
- Porta da aplicacao no VPS: `3200`
- Caminho no VPS: `C:\Apps\editor`
- Dominio: `princyai.com`

Recomendacao para o primeiro ambiente online:

1. Aponte `princyai.com` e `www.princyai.com` para `108.181.169.40`.
2. Use HTTPS com Caddy, Nginx, IIS ARR ou Cloudflare Tunnel.
3. Rode PostgreSQL 17 no Windows ou em container.
4. Rode `npm run prisma:deploy` para aplicar migrations sem exigir permissao de criar shadow database.
5. Rode o app Node.js como servico com PM2, NSSM ou Windows Service.
6. Mantenha apenas a porta `443` publica.
7. Use Caddy para encaminhar `443` para `127.0.0.1:3200`.
8. Deixe `5432`, `11434` e demais portas internas bloqueadas no firewall.
9. Quando houver execucao de codigo por workspace, isole com WSL2 ou containers por usuario/projeto.

Veja o guia especifico em `deploy/windows/README.md`.

## Fluxo RAG

1. O usuario clica em `Indexar`.
2. O frontend le os arquivos do workspace pela API autenticada.
3. Um Web Worker quebra os arquivos em chunks.
4. O backend gera embeddings com OpenAI ou Ollama.
5. Os chunks e embeddings sao persistidos no PostgreSQL como JSONB.
6. Ao enviar uma pergunta, o backend gera embedding da pergunta, calcula similaridade dos chunks e envia esse contexto para a LLM.

## Build de Producao

```powershell
npm run build
npm run start
```

O backend serve o frontend compilado de `dist/frontend` quando essa pasta existe.
