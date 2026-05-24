# Bloqueios de visual desativados (desbloqueio global)

## Travas corrigidas no codigo

| Bloqueio | Correcao |
|----------|----------|
| Chat maximizado (esconde editor) | `forceMaximized: false` + `princyLayoutUnlock` (45s de retries) |
| Startup maximiza se `defaultVisibility: maximized*` | `layout.ts` so maximiza se `forceMaximized === true` (antes era `!== false`) |
| Cache webview (UI antiga) | `PRINCY_CHAT_UI_REVISION` + `princyai.ui.forceVisualUnlock` recarrega painel |
| `dist/` nao vai no Git | `deploy-princy-after-pull.ps1` / `unlock-princy-visual-global.ps1` |
| Layout em `state.vscdb` | Script global apaga `workspaceStorage/**/state.vscdb` |
| Editor readonly | `files.readonly*` vazio forcado |

## Deploy VPS (obrigatorio para ver visual novo)

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\unlock-princy-visual-global.ps1 -ProjectRoot "C:\Apps\Editor"
```

Versao rapida (so extensao):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\deploy-princy-after-pull.ps1 -ProjectRoot "C:\Apps\Editor"
```

Depois **Ctrl+F5**. Confirmar: `document.body.dataset.princyUiRev` = `cursor-editor-2026.05.24-unlock`

## No editor

- F1 -> **Force Visual Reload (chat + layout)**
- F1 -> **Reset Princy Layout**

Setting: `princyai.ui.forceVisualUnlock` (default `true`) reaplica desbloqueio a cada 8s durante 3 min apos abrir.
