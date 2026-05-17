# Princy Ai Deploy no Windows Server

Este guia prepara o deploy do Princy Ai no VPS Windows Server.

## Dados Oficiais

- Repositorio: `https://github.com/dimibad-buscaapp/Editor.git`
- VPS: `108.181.169.40`
- Porta da aplicacao no VPS: `3200`
- Caminho do projeto no VPS: `C:\Apps\editor`
- Dominio principal: `princyai.com`
- Nome publico: `Princy Ai`

## DNS na Hostinger

Crie ou ajuste estes registros DNS:

```text
Tipo  Nome  Valor
A     @     108.181.169.40
A     www   108.181.169.40
```

DNS nao usa porta. O acesso web publico deve usar `443` com HTTPS, e o proxy deve encaminhar para a aplicacao em `127.0.0.1:3200`.

## Portas Recomendadas

- Publicas: `443` e, opcionalmente, `80` apenas para redirecionar para HTTPS.
- Aplicacao: `3200`, preferencialmente restrita ao localhost quando usar Caddy.
- Internas: `5434`, `11434`.

## Instalar o Projeto

No VPS, abra PowerShell como administrador:

```powershell
New-Item -ItemType Directory -Force C:\Apps
Set-Location C:\Apps
git clone https://github.com/dimibad-buscaapp/Editor.git editor
Set-Location C:\Apps\editor\apps\ai-dashboard
npm install
Copy-Item .\deploy\windows\princyai.env.example .\.env
```

Edite `.env` e troque:

- `SESSION_SECRET`
- senha do PostgreSQL em `DATABASE_URL`
- provider de IA, se for usar OpenAI em vez de Ollama

## Banco de Dados

No Windows Server, use o PostgreSQL 17 instalado no sistema. O Princy Ai nao exige `pgvector`; os embeddings sao salvos como JSONB e a similaridade e calculada no backend.

```powershell
npm run prisma:generate
npm run prisma:migrate
```

## Ollama Local

Se o provider for `ollama`:

```powershell
ollama pull llama3.1
ollama pull nomic-embed-text
```

## Build e Execucao

```powershell
npm run build
npm run start
```

Para producao, rode o processo Node como servico usando PM2, NSSM ou Windows Service.

## Reverse Proxy HTTPS

Use Caddy para simplificar HTTPS automatico. Copie `deploy/windows/Caddyfile` para o local de configuracao do Caddy e inicie o servico.

Fluxo esperado:

```text
https://princyai.com -> Caddy :443 -> 127.0.0.1:3200 -> Princy Ai
```

Nao exponha `5434` nem `11434` diretamente na internet. Se estiver usando Caddy, mantenha a aplicacao em `127.0.0.1:3200`.
