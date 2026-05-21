# Velocidade da IA (Princy vs Cursor)

O Cursor usa modelos em nuvem com GPU. No VPS com **Ollama local em CPU**, a latencia sera sempre maior. Ainda assim da para melhorar bastante.

## 1. Modelo menor (maior ganho)

No `.env` do backend:

```env
OLLAMA_CHAT_MODEL=phi3:mini
# ou: llama3.2:1b, qwen2.5-coder:1.5b
```

No servidor:

```powershell
ollama pull phi3:mini
```

Evite `deepseek-coder-v2` (8GB+) em CPU se quiser respostas rapidas.

## 2. Limites de contexto e tokens

```env
PRINCY_SIMPLE_MODE=true
PRINCY_RAG_ENABLED=false
PRINCY_OLLAMA_NUM_PREDICT=1024
PRINCY_OLLAMA_NUM_CTX=2048
```

Valores menores = menos RAM e resposta mais curta/rapida.

## 3. API em nuvem (velocidade tipo Cursor) — recomendado

Com `AI_PROVIDER=groq`, o chat do dashboard usa Groq **mesmo com streaming** (simple mode).

Guia passo a passo: [GROQ-VPS.md](./GROQ-VPS.md)

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave
GROQ_CHAT_MODEL=llama-3.1-8b-instant
PRINCY_SIMPLE_MODE=true
PRINCY_RAG_ENABLED=false
```

```powershell
cd C:\Apps\Editor\apps\ai-dashboard
npm run build
Restart-Service PrincyAiAgentBackend
```

| Provider   | Variavel           | Velocidade |
|-----------|--------------------|------------|
| Groq      | `GROQ_API_KEY`     | Muito rapida |
| DeepSeek  | `DEEPSEEK_API_KEY` | Rapida     |
| OpenAI    | `OPENAI_API_KEY`   | Rapida     |

## 4. Ollama no Windows

- Feche outros modelos pesados carregados: `ollama ps`
- Deixe apenas um modelo em memoria
- Mais RAM livre = menos swap = menos lentidao

## 5. Expectativa realista

| Cenario              | Latencia tipica   |
|---------------------|-------------------|
| Ollama CPU + 8B model | 30s–3min por resposta |
| Ollama CPU + 1–3B model | 5–30s |
| Groq / DeepSeek API | 1–5s (parecido com Cursor) |

Para experiencia **parecida com o Cursor**, use API em nuvem (Groq recomendado para custo/velocidade).
