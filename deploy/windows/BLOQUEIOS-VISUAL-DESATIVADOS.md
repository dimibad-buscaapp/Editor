# Bloqueios de visual desativados (desbloqueio global)

## Travas corrigidas no codigo

| Bloqueio | Correcao |
|----------|----------|
| Chat maximizado (esconde editor) | `forceMaximized: false` + `princyLayoutUnlock` |
| Startup maximiza se `defaultVisibility: maximized*` | `layout.ts` so maximiza se `forceMaximized === true` |
| Cache webview (UI antiga) | `PRINCY_CHAT_UI_REVISION` (r10: `cursor-agent-2026.05.25-r10`) + reload uma vez por revisao |
| Reset endpoint `/princy-api` relativo | `migrateWebAgentEndpoint` — nunca reposto por `princyVisualUnlock` |
| Reconnect a cada 8s desconectava chat | Timers 60s/120s; reconnect so se health OK > 30s atras |
| `dist/` nao vai no Git | `compile-princy-chat-only.ps1` / `deploy-princy-after-pull.ps1` |
| Layout em `state.vscdb` | Script global apaga `workspaceStorage/**/state.vscdb` |
| Editor readonly | `files.readonly*` vazio forcado |

## Deploy VPS (obrigatorio para ver visual novo)

```powershell
cd C:\Apps\Editor
pwsh -File deploy\windows\code-web\compile-princy-chat-only.ps1 -ProjectRoot C:\Apps\Editor
```

Ou unlock completo:

```powershell
pwsh -File deploy\windows\code-web\unlock-princy-visual-global.ps1 -ProjectRoot C:\Apps\Editor
```

Depois **Ctrl+F5** no browser. Confirmar no painel chat:

`document.body.dataset.princyUiRev` = `cursor-agent-2026.05.25-r10`

Endpoint: `https://princyai.com/princy-api` (nao `:3210` nem `127.0.0.1` no fetch do worker).

## No editor

- F1 -> **Force Visual Reload (chat + layout)**
- F1 -> **Reset Princy Layout**
- F1 -> **Reconnect Princy Backend**

Settings: `princyai.ui.forceVisualUnlock` e `princyai.ui.neverLockLayout` (default `true`).

**Nunca** correr `compile-incremental` **depois** de `bundle-server-web-out` em producao (pagina branca).
