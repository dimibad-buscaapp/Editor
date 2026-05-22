# Boot log — /webeditor/log

Pagina de diagnostico do carregamento do Code-OSS Web (do clique ate a UI aparecer).

## URL

- https://princyai.com/webeditor/log/
- https://princyai.com/webeditor/log/?autostart=1 (inicia o teste sozinho)

## Fluxo

1. Na landing, **Abrir Web Editor** grava `sessionStorage.princy_webeditor_boot_t0`.
2. **Diagnostico boot (log)** abre `/webeditor/log/?autostart=1` e reutiliza esse T0.
3. A pagina faz probes HTTP (`/webeditor/`, `/princy-api/`, workbench.js) e carrega o editor num **iframe**.
4. Poll ate detectar `.monaco-workbench` ou timeout 3 min.
5. **Copiar log** envia a timeline para o suporte.

## Deploy no VPS

```powershell
cd C:\Apps\Editor
git pull
Copy-Item deploy\windows\code-web\Caddyfile C:\Caddy\Caddyfile -Force
Restart-Service PrincyCaddy
```

Arquivos estaticos: `deploy\windows\code-web\webeditor-log\index.html` (servidos pelo Caddy, nao pelo node :3200).

## Landing com botao novo

Apos `npm run build:frontend` em `apps\ai-dashboard`, reinicie `PrincyAiIndex` (:3220).
