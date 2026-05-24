# Visual do webeditor (layout Cursor)

O layout **estilo Cursor** depende de artefatos compilados e settings de producao.

| Artefato | Caminho | O que muda |
|----------|---------|------------|
| Workbench (editor) | `out/vs/code/browser/workbench/workbench.css` | Shell do Code Web |
| Extensão Princy IA | `extensions/princy-ai/dist/browser/extension.js` | Tema **Princy Black**, chat dockado à direita, abas Chat/Composer/Agent |
| Builtin no bundle | `workbench.js` ou `server-main.js` contém `princy-ai` | Sem isso a extensão **não carrega** no web |

Só compilar o `out/` **não** atualiza o painel de chat. É obrigatório `npm run compile-web` na extensão (ou script de produção completo).

## Layout esperado (apos deploy)

```
+------------------------------------------------------------------+
| Menu / Command Center / Activity bar (topo)                      |
+----------+-------------------------------+-------------------------+
| Explorer | Editor (tabs + codigo)      | Chat Princy (~300-400px)|
| (esq.)   |                               | Chat | Composer | Agent|
+----------+-------------------------------+-------------------------+
| Terminal / painel inferior (opcional)                              |
+------------------------------------------------------------------+
```

Checklist visual no browser (`https://princyai.com/webeditor/` + **Ctrl+F5**):

1. **Explorer** visível à esquerda (ficheiros do workspace).
2. **Editor** ao centro (não escondido pelo chat).
3. **Chat** à direita, **não maximizado** (barra estreita, redimensionável).
4. Barra superior com **command center** e **controles de layout**.
5. Painel chat: abas **Chat / Composer / Agent**, **Histórico** colapsável, botão **⚙** (settings).
6. Tema **Princy Black** (`#000000`).

Settings criticos (`deploy/windows/princy-production.settings.json`):

- `workbench.secondarySideBar.defaultVisibility`: `visible`
- `workbench.secondarySideBar.forceMaximized`: `false`
- `workbench.layoutControl.enabled`: `true`
- `window.menuBarVisibility`: `classic`
- `princyai.chat.simpleMode`: `false` (jobs + streaming no Agent)
- `princyai.workspaceIndex.onOpen`: `true`

## Forcar visual novo (recomendado)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\force-princy-visual-web.ps1 -ProjectRoot C:\Apps\Editor
```

Rapido (so extensao, se `out/` ja compilado):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\force-princy-visual-web.ps1 -ProjectRoot C:\Apps\Editor -SkipFullCompile
```

## Deploy no VPS (`C:\Apps\Editor`)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\apply-princy-webeditor-hotfix.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1
Restart-Service PrincyAiCodeWeb
```

Confirme:

- `Test-Path extensions\princy-ai\dist\browser\extension.js` → **True**
- `verify-princy-chat-api.ps1` → health + **POST /api/agent/jobs** com jobId
- Settings em `.princy-user-data\User/settings.json` com `forceMaximized: false`

Copie settings se necessario:

`deploy\windows\princy-production.settings.json` → `.princy-user-data\User\settings.json`

(ou `fix-princy-code-web-service.ps1`.)

## Log `princy-ai ausente` com caminho `c:\Apps\extensions\...`?

Causas comuns:

1. **Servidor antigo** — falta `compile-incremental` (webClientServer novo) + reiniciar servico.
2. **Falta `extension.js`** — `npm run compile-web` nao correu.
3. **Falta `out/extensions/princy-ai`** — o browser carrega de `out/extensions`; rode `sync-princy-ai-out-extensions.ps1` (incluido no hotfix).

Apos deploy correto o log deve mostrar:

`[WebClientServer] Builtin web: princy-ai (C:\Apps\Editor\extensions\princy-ai\dist\browser\extension.js)`

Verificacao rapida no VPS:

```powershell
Test-Path C:\Apps\Editor\extensions\princy-ai\dist\browser\extension.js
Test-Path C:\Apps\Editor\out\extensions\princy-ai\dist\browser\extension.js
Select-String -Path C:\Apps\Editor\logs\code-web.err.log -Pattern "Builtin web: princy-ai" | Select-Object -Last 3
```

## Edicao bloqueada (read-only)?

Settings de producao desactivam `files.readonlyInclude` e `files.readonlyFromPermissions`. A extensao reaplica no arranque. Se abrir a pasta `C:\Apps\Editor` inteira no browser, o `.vscode/settings.json` do repo ainda marca `out/**` como read-only — use o workspace `workspaces\default`.

## Chat maximizado / sem explorer?

Causa habitual: perfil antigo com auxiliary bar maximizada.

1. Atualize codigo e settings (acima).
2. No arranque a extensao chama `restoreAuxiliaryBar` automaticamente.
3. **Ctrl+F5** no browser; se persistir: Command Palette → **Restore Secondary Side Bar**.

## Ainda parece VS Code padrao?

1. **princy-ai ausente do bundle** → hotfix / `compile-web` antes de `bundle-server-web-out`.
2. `extension.js` nao compilado → tema Princy Black inexistente.
3. Cache → Ctrl+F5 ou aba anonima.
4. URL → `/webeditor/`, nao apenas o dominio raiz.
