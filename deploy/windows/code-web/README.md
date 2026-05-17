# Princy Ai Code-OSS Web Deploy

Este é o deploy principal do Princy Ai neste momento. Ele abre o Code-OSS/VS Code Web no navegador, em vez do MVP `apps/ai-dashboard`.

## Dados

- Repositorio: `https://github.com/dimibad-buscaapp/Editor.git`
- Projeto no VPS: `C:\Apps\Editor`
- Workspace inicial: `C:\Apps\Editor\workspaces\default`
- Porta interna: `3200`
- Dominio: `princyai.com`

## Preparar o Projeto

No VPS, dentro da raiz do projeto:

```powershell
Set-Location C:\Apps\Editor
git pull
npm install
```

O primeiro start pode baixar extensoes built-in e dependencias usadas pelo script do Code-OSS.

Se `npm install` falhar em pacotes nativos, instale o Visual Studio Build Tools com C++ e use Node LTS compatível.

Antes do primeiro start, compile o servidor e as extensoes web:

```powershell
npm run compile
npm run compile-web
```

## Rodar Manualmente

Pare qualquer processo que esteja usando a porta `3200`, incluindo `apps/ai-dashboard`.

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\start-princy-code-web.ps1
```

Teste no navegador do VPS:

```text
http://127.0.0.1:3200
```

Use este script, e nao `scripts\code-web.js`, para o deploy. `code-web.js` usa `@vscode/test-web` e monta um filesystem de teste; `code-server.bat` abre o Code-OSS Web real com acesso ao workspace em disco.

## Backend de IA

A extensão embutida `Princy Ai` chama o backend Fastify separado em `http://127.0.0.1:3210`.

Rode também:

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\agent-backend\start-princy-agent-backend.ps1
```

Veja [`../agent-backend/README.md`](../agent-backend/README.md).

## Rodar Como Servico

Opcionalmente, instale o NSSM e registre o serviço:

```powershell
Set-Location C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\code-web\install-princy-code-web-service.ps1
Start-Service PrincyAiCodeWeb
```

Logs:

```text
C:\Apps\Editor\logs\code-web.out.log
C:\Apps\Editor\logs\code-web.err.log
```

## HTTPS

Copie `deploy/windows/code-web/Caddyfile` para a configuração do Caddy.

Fluxo:

```text
https://princyai.com -> Caddy :443 -> 127.0.0.1:3200 -> Code-OSS Web
```

## Acesso Temporario

Nesta fase, mantenha o acesso privado:

- Preferencial: acessar pelo navegador no RDP do VPS.
- Alternativa temporaria: liberar `3200` apenas para o seu IP administrativo.
- Producao: usar Cloudflare Access, Caddy com autenticação, Authentik ou outro provedor externo.

Nao exponha `3200` publicamente sem controle de acesso.

Veja tambem [`AUTH.md`](AUTH.md) para a proxima camada de autenticacao de colaboradores.
