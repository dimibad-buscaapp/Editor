# Princy Ai — paginas e portas (VPS)

| URL publica | IP:porta interna | Servico |
|-------------|------------------|---------|
| https://princyai.com/ | 108.181.169.40:3220 | Index / landing |
| https://princyai.com/webeditor/ | 108.181.169.40:3200 | Editor Code-OSS Web |
| https://princyai.com/princy-api/ | 108.181.169.40:3210 | API do agente (proxy Caddy) |
| https://dashboard.princyai.com/ | 108.181.169.40:3210 | Dashboard + chat IA |

DNS (Hostinger): registros `A` de `@`, `www`, `dashboard` → **108.181.169.40**. Portas **3220**, **3200**, **3210** ficam no VPS; na internet so **80/443** (Caddy).

**Nao use** `http://108.181.169.40:3200/` no browser de fora — costuma dar `ERR_CONNECTION_TIMED_OUT`. Use **https://princyai.com/webeditor/**.

## Variaveis centralizadas

```powershell
. C:\Apps\Editor\deploy\windows\princy-hosts.ps1
$PrincyPublicEditorUrl   # https://princyai.com/webeditor/
$PrincyVpsEditorUrl      # http://108.181.169.40:3200/webeditor
```

## Servicos NSSM

| Servico | Porta |
|---------|-------|
| PrincyAiIndex | 3220 |
| PrincyAiCodeWeb | 3200 |
| PrincyAiAgentBackend | 3210 |
| PrincyCaddy | 80, 443 |

## .env producao (trecho)

```env
APP_ORIGIN="https://princyai.com"
CODE_WEB_URL="http://108.181.169.40:3200/webeditor"
CODE_WEB_INTERNAL_URL="http://108.181.169.40:3200"
API_HOST="0.0.0.0"
API_PORT="3210"
INDEX_PORT="3220"
PRINCY_VPS_HOST="108.181.169.40"
```

Ollama e PostgreSQL continuam em `127.0.0.1` (somente na maquina).

## Sempre online (VPS)

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\Start-PrincyAlwaysOnline.ps1
```

Detalhes da porta 3200: `deploy\windows\PORT-3200-WEBEDITOR.md`
