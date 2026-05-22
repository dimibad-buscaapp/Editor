# Dominio Princy Ai (Hostinger + VPS Windows)

Este guia liga o dominio na **Hostinger** ao projeto no **VPS**, com duas portas internas:

| Servico | IP:porta VPS | URL publica |
|---------|---------------|-------------|
| Index / landing | `108.181.169.40:3220` | `https://princyai.com/` |
| Code-OSS Web (editor) | `108.181.169.40:3200` | `https://princyai.com/webeditor/` |
| Dashboard + API agent | `108.181.169.40:3210` | `https://dashboard.princyai.com/` |

**DNS nao usa porta.** A Hostinger so aponta o dominio para o IP **108.181.169.40**. O **Caddy** recebe HTTPS `80`/`443` e encaminha para `3220`, `3200` e `3210` no VPS.

Substitua `SEU_IP_VPS` pelo IP publico do servidor (ex.: `108.181.169.40`).

---

## 1. DNS na Hostinger (hPanel)

1. Acesse [hpanel.hostinger.com](https://hpanel.hostinger.com) → **Dominios** → `princyai.com` → **DNS / Zona DNS**.
2. Remova registros conflitantes (ex.: `A` antigo para parking, `CNAME` www errado).
3. Crie ou edite:

| Tipo | Nome / Host | Aponta para | TTL |
|------|-------------|-------------|-----|
| `A` | `@` | `SEU_IP_VPS` | 300–3600 |
| `A` | `www` | `SEU_IP_VPS` | 300–3600 |
| `A` | `api` | `SEU_IP_VPS` | 300–3600 |

Opcional (nao obrigatorio para o editor):

| Tipo | Nome | Aponta para | Uso |
|------|------|-------------|-----|
| `A` | `dashboard` | `SEU_IP_VPS` | Legado MVP dashboard |

4. **Desative proxy da Hostinger** se existir opcao tipo “CDN/proxy” no registro — use DNS direto para o IP do VPS (igual “DNS only” no Cloudflare).
5. Aguarde propagacao (5 min a 48 h). Teste:

```powershell
nslookup princyai.com
nslookup api.princyai.com
```

Ambos devem retornar `SEU_IP_VPS`.

---

## 2. Firewall no VPS (Windows Server)

Abra **somente** o que o Caddy precisa na internet:

```powershell
# HTTPS + redirecionamento HTTP
New-NetFirewallRule -DisplayName "Princy HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Princy HTTP"  -Direction Inbound -LocalPort 80  -Protocol TCP -Action Allow
```

**Nao** abra `3200` nem `3210` para a internet. Elas ficam em `127.0.0.1` e so o Caddy acessa.

---

## 3. Caddy no VPS (HTTPS automatico)

### Instalar Caddy (Windows)

A pasta `C:\Caddy` **nao existe** ate voce criar/instalar. Use o script do repo (cria pasta, baixa Caddy se preciso, copia Caddyfile):

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\install-princy-caddy.ps1
```

Ou manualmente:

```powershell
New-Item -ItemType Directory -Force C:\Caddy
winget install CaddyServer.Caddy
```

Feche e abra o PowerShell depois do `winget` para o comando `caddy` entrar no PATH.

### Configuracao

Se ja rodou o script acima, o Caddyfile ja esta em `C:\Caddy\Caddyfile`. Senao:

```powershell
New-Item -ItemType Directory -Force C:\Caddy
Copy-Item C:\Apps\Editor\deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
notepad C:\Caddy\Caddyfile
```

Use o Caddyfile do repo (nao encaminhe tudo para 3200 na raiz):

```powershell
Copy-Item C:\Apps\Editor\deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
```

Rotas:

| Path | Porta |
|------|-------|
| `/` landing | 3220 |
| `/webeditor/*` editor | 3200 (`handle /webeditor*`, **nao** `handle_path`) |
| `/princy-api/*` agent | 3210 |
| `dashboard.princyai.com` | 3210 |

Editor: `https://princyai.com/webeditor/` com `--server-base-path /webeditor`.

Verificacao: `powershell -File deploy\windows\verify-princy-webeditor.ps1`

Inicie o Caddy (**PowerShell como Administrador** — portas 80 e 443):

```powershell
# Se winget instalou no PATH:
caddy run --config C:\Caddy\Caddyfile

# Se o script baixou para C:\Caddy\caddy.exe:
C:\Caddy\caddy.exe run --config C:\Caddy\Caddyfile
```

Se `caddy` nao for reconhecido, use sempre `C:\Caddy\caddy.exe` apos rodar `install-princy-caddy.ps1`.

Ou registre como servico Windows (NSSM / `caddy install`).

Fluxo:

```text
Usuario → https://princyai.com:443 → Caddy → 127.0.0.1:3200 (editor)
Chat IA → https://api.princyai.com:443 → Caddy → 127.0.0.1:3210 (agent API)
```

O Caddy obtem certificado Let's Encrypt sozinho se as portas `80`/`443` estiverem abertas e o DNS ja apontar para o VPS.

---

## 4. Servicos no VPS (sempre rodando)

Em **dois** terminais ou como servicos NSSM:

```powershell
Set-Location C:\Apps\Editor

# Terminal 1 — editor (3200)
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\start-princy-code-web.ps1

# Terminal 2 — agent backend (3210)
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Testes locais no VPS:

```powershell
Invoke-WebRequest http://127.0.0.1:3200 -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3210/api/health -UseBasicParsing
```

Testes publicos (apos DNS + Caddy):

```text
https://princyai.com
https://api.princyai.com/api/health
```

---

## 5. `.env` do agent backend (producao)

Arquivo: `C:\Apps\Editor\apps\ai-dashboard\.env`

```env
APP_ORIGIN="https://princyai.com"
CODE_WEB_URL="http://108.181.169.40:3200/webeditor"
CODE_WEB_INTERNAL_URL="http://108.181.169.40:3200"
INDEX_PORT="3220"
PRINCY_VPS_HOST="108.181.169.40"
API_HOST="127.0.0.1"
API_PORT="3210"
PRINCY_CORS_ORIGINS="https://api.princyai.com"
AGENT_API_TOKEN="gere-um-token-longo-aqui"
SESSION_SECRET="outro-segredo-longo"
```

Depois:

```powershell
Set-Location C:\Apps\Editor\apps\ai-dashboard
npm run build:backend
```

Reinicie o agent backend.

---

## 6. Extensao Princy Ai — endpoint HTTPS

O navegador abre o editor em `https://princyai.com`. O chat **nao pode** chamar `http://127.0.0.1:3210` (mixed content). Configure:

**Configuracoes do usuario** (JSON) no Princy Ai Web:

```json
{
  "princyai.useSameOriginApi": true,
  "princyai.agentEndpoint": "https://princyai.com/princy-api",
  "princyai.apiToken": "mesmo-valor-de-AGENT_API_TOKEN"
}
```

Alternativa: `"princyai.agentEndpoint": "https://api.princyai.com"` (subdominio separado).

Ou copie o exemplo:

```powershell
Copy-Item C:\Apps\Editor\deploy\windows\princy-production.settings.json C:\Users\Administrator\AppData\Roaming\PrincyAi\User\settings.json
```

(Ajuste o caminho do `settings.json` conforme o perfil do Code-OSS Web no servidor.)

---

## 7. Checklist rapido

- [ ] DNS `@`, `www`, `api` → IP do VPS
- [ ] Firewall: `80`/`443` abertos; `3200`/`3210` fechados na internet
- [ ] Caddy rodando com `Caddyfile` atualizado
- [ ] Code Web na `3200`, agent na `3210`
- [ ] `.env` com `APP_ORIGIN=https://princyai.com`
- [ ] `princyai.agentEndpoint` = `https://api.princyai.com`
- [ ] Chat mostra **● online** no cabecalho

---

## Problemas comuns

| Sintoma | Causa | Solucao |
|---------|-------|---------|
| Site nao abre | DNS ainda nao propagou | `nslookup`, aguardar, conferir IP |
| HTTPS invalido | Caddy parado ou porta 443 bloqueada | Iniciar Caddy, abrir firewall |
| `Failed to fetch` no chat | API sem HTTPS ou backend parado | `api.princyai.com` + agent na 3210 |
| Chat offline com site OK | `agentEndpoint` errado | `https://api.princyai.com` |
| 401 no chat | Token diferente | Igualar `AGENT_API_TOKEN` e `princyai.apiToken` |

---

## Diagrama

```text
                    Hostinger DNS
                    @  → VPS IP
                    www → VPS IP
                    api → VPS IP
                         │
                         ▼
              ┌──────────────────────┐
              │   VPS Windows        │
              │   Caddy :443         │
              └──────────┬───────────┘
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  princyai.com      api.princyai.com    (outros)
         │                 │
         ▼                 ▼
   127.0.0.1:3200   127.0.0.1:3210
   Code-OSS Web      Agent Fastify
```
