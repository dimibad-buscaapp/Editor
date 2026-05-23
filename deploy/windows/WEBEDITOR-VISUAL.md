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
