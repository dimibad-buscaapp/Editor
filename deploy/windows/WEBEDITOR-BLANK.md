# Webeditor em branco (`/webeditor/`)

## Causa

O Caddy **nao pode** usar `handle_path /webeditor/*` (remove o prefixo `/webeditor` antes de enviar ao Code Web). O VS Code Web precisa receber o caminho completo e ser iniciado com:

```text
--server-base-path /webeditor
```

Sem isso, JS/CSS e WebSocket retornam 404 e a pagina fica branca.

## Correcao no VPS

```powershell
cd C:\Apps\Editor
git pull

Copy-Item deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force

# Reinstalar servico Code Web com base path (ou editar NSSM manualmente)
powershell -File deploy\windows\install-princy-production-services.ps1

Restart-Service PrincyCaddy, PrincyAiCodeWeb
```

## Testes

```powershell
Test-Path C:\Apps\Editor\out\vs\code\browser\workbench\workbench-dev.html
Invoke-WebRequest http://127.0.0.1:3200/webeditor/ -UseBasicParsing
Invoke-WebRequest https://princyai.com/webeditor/ -UseBasicParsing
Get-Content C:\Apps\Editor\logs\code-web.err.log -Tail 40
```

No navegador (F12 > Rede): nao deve haver 404 em arquivos sob `/webeditor/`.

## URL correta

- https://princyai.com/webeditor/ (com barra final)
- Raiz https://princyai.com/ e a landing do dashboard (3210), nao o editor.
