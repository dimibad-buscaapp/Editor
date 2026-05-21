# DNS + certificado HTTPS (erros Let's Encrypt)

## Sintoma nos logs do Caddy

```txt
2.57.91.91: Invalid response from http://princyai.com/.well-known/acme-challenge/...: 500
DNS problem: NXDOMAIN looking up A for api.princyai.com
```

## Causa 1 — DNS aponta para outro servidor

O Let's Encrypt valida o dominio no IP que o **DNS publico** retorna.

No VPS:

```powershell
nslookup princyai.com
nslookup www.princyai.com
```

Deve mostrar **108.181.169.40** (IP deste VPS). Se mostrar **2.57.91.91** ou outro IP, corrija na Hostinger:

| Host | Tipo | Valor |
|------|------|-------|
| `@` | A | `108.181.169.40` |
| `www` | A | `108.181.169.40` |
| `dashboard` | A | `108.181.169.40` |
| `api` | A | `108.181.169.40` (opcional) |

Aguarde propagacao (5–60 min) e teste de novo.

## Causa 2 — api.princyai.com sem DNS

Enquanto nao houver registro `A` para `api`, deixe o bloco `api.princyai.com` **comentado** no `Caddyfile` (versao atual do repo).

Use a API pelo proxy no editor: `https://princyai.com/princy-api/...`

## Causa 3 — Code Web / backend parados

Com Caddy na frente, `:3200` e `:3210` precisam estar ativos:

```powershell
# PS1
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\agent-backend\start-princy-agent-backend.ps1

# PS2
powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\code-web\start-princy-code-web.ps1
```

## Atualizar Caddyfile e reiniciar Caddy

```powershell
Copy-Item C:\Apps\Editor\deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
# Ctrl+C no Caddy e:
C:\Caddy\caddy.exe run --config C:\Caddy\Caddyfile
```

## Usar o site antes do HTTPS (IP direto)

Enquanto o DNS nao propaga:

- Editor: `http://108.181.169.40:3200`
- Dashboard/logs: `http://108.181.169.40:3210` e `http://108.181.169.40:3210/#/logs`

## git pull com alteracoes locais

```powershell
cd C:\Apps\Editor
git stash push -u -m "vps-local"
git pull origin main
```
