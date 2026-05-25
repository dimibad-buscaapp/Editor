# Compilar editor web com chat e visual Cursor (Princy)

O browser **nao** usa `src/`. Precisa deste compile na maquina onde corre o servico (`C:\Apps\Editor` na VPS).

## Comando unico (recomendado)

PowerShell 7 na VPS:

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
pwsh -ExecutionPolicy Bypass -File .\deploy\windows\code-web\restore-princy-webeditor-route.ps1
pwsh -ExecutionPolicy Bypass -File .\deploy\windows\code-web\compile-full-princy-webeditor.ps1 -ProjectRoot "C:\Apps\Editor" -SkipPull
pwsh -ExecutionPolicy Bypass -File .\deploy\windows\code-web\fix-princy-browser-cache.ps1
Restart-Service PrincyAiCodeWeb, PrincyAiAgentBackend, PrincyCaddy
pwsh -ExecutionPolicy Bypass -File .\deploy\windows\code-web\verify-princy-visual-and-chat.ps1 -ProjectRoot "C:\Apps\Editor"
```

Tempo: **15 a 45 minutos**.

## O que este compile gera

| Etapa | Saida | Garante |
|-------|--------|---------|
| `compile-incremental` | `out/vs/workbench/...` | Layout chat docked (nao maximizado) |
| `compile-web` | `extensions/princy-ai/dist/browser/extension.js` | Visual chat Cursor, painel Agent, animacoes |
| `bundle-server-web-out` | `out/.../workbench.js` + `.css` | Modo producao no webeditor |

## Sucesso — deve aparecer no final

```
OK: Chat bundle (extension.js)
OK: Chat UI track (extension.js)
OK: extension.js com revisao cursor-agent-2026.05.25-r8
OK: princyLayoutUnlock em out/
```

No browser (Ctrl+F5):

- `document.body.dataset.princyUiRev` = **`cursor-agent-2026.05.25-r8`**
- Painel inferior e chat **fechados** ao carregar; ao abrir o chat: visual Cursor (nao fullscreen)

## Forcar visual AGORA (browser ainda antigo)

Se o compile completo ja passou mas o browser mostra UI velha:

```powershell
pwsh -ExecutionPolicy Bypass -File .\deploy\windows\code-web\force-princy-visual-now.ps1 -ProjectRoot "C:\Apps\Editor"
```

Tempo: **1-3 minutos**. Depois **no browser**:

1. Ctrl+Shift+Delete → limpar cache de `princyai.com` (ou janela anonima)
2. Ctrl+F5 em https://princyai.com/webeditor/
3. F1 → **Force Visual Reload**
4. F1 → **Unlock Princy Editor Layout**
5. F12 → Console **no painel chat** → `document.body.dataset.princyUiRev` = `cursor-agent-2026.05.25-r8`

## Se falhar

1. Confirme commit recente: `git log -1` deve ser `169d224c` ou mais novo.
2. Use **`pwsh`** (nao `powershell` 5.1) para rodar o script.
3. Se so mudou CSS do chat (sem workbench): `deploy-princy-after-pull.ps1` (1-3 min).

## Pre-requisitos na VPS

```powershell
node -v    # v20+
npm -v
pwsh -Version
```

Se `npm run compile-web` falhar com `esbuild` ausente:

```powershell
cd C:\Apps\Editor
npm install
```
