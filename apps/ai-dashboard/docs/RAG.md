# RAG no Princy Ai Dashboard

Este documento adapta a base RAG ao nosso ambiente atual.

## Decisao Atual

Nao estamos usando Docker nem `pgvector` no VPS. O PostgreSQL 17 esta instalado diretamente no Windows Server.

Por isso, a implementacao atual usa:

- PostgreSQL 17 local.
- Prisma.
- Embeddings persistidos em `JSONB`.
- Similaridade por cosseno calculada no backend TypeScript.
- Providers preparados para Ollama local ou OpenAI.

Essa decisao permite subir o projeto sem compilar ou instalar a extensao `pgvector` no Windows. Quando quisermos otimizar escala/performance, podemos migrar a coluna `embedding` para `vector` e voltar a usar busca vetorial no banco.

## Onde Esta Implementado

- Schema: [`../prisma/schema.prisma`](../prisma/schema.prisma)
- Migration inicial: [`../prisma/migrations/20260517150000_initial_rag_schema/migration.sql`](../prisma/migrations/20260517150000_initial_rag_schema/migration.sql)
- Providers de IA: [`../backend/src/ai.ts`](../backend/src/ai.ts)
- Indexacao e busca semantica: [`../backend/src/rag.ts`](../backend/src/rag.ts)
- Rotas Fastify: [`../backend/src/routes.ts`](../backend/src/routes.ts)

## Fluxo

1. O frontend le os arquivos do workspace pela API autenticada.
2. Um Web Worker divide os arquivos em chunks.
3. O backend gera embeddings usando Ollama ou OpenAI.
4. Os chunks sao gravados em `FileChunk`, com `embedding` em `JSONB`.
5. No chat, o backend gera embedding da pergunta.
6. O backend calcula similaridade entre a pergunta e os chunks.
7. Os chunks mais relevantes entram no prompt enviado para a LLM.

## Configuracao de IA

Ollama local:

```text
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_CHAT_MODEL="llama3.1"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"
```

OpenAI:

```text
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_CHAT_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

## Deploy no VPS

Use:

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run build
npm run start
```

Nao use `npm run prisma:migrate` no VPS, porque ele chama `migrate dev` e precisa criar shadow database.

## Portas no Deploy Atual

- `3200`: Code-OSS Web, interface principal.
- `3210`: backend Fastify do dashboard e da API do agente.
- `5432`: PostgreSQL local.
- `11434`: Ollama local.

A extensão embutida `princy-ai` chama o backend em `princyai.agentEndpoint`, com padrão `http://127.0.0.1:3210`.
