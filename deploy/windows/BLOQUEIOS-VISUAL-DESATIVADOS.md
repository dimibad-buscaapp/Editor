# Bloqueios de visual desativados (pente fino)

## Travas encontradas e correcao

| Bloqueio | Onde | Correcao |
|----------|------|----------|
| Chat fullscreen (auxiliary bar maximizada) | `layout.ts` + workspace `state.vscdb` | `forceMaximized: false` + skip maximize no startup + `princyLayoutUnlock` |
| `defaultVisibility: maximized*` | VS Code workbench | Forcado `visible` em settings + extensao |
| `minimalWorkbench` saltava layout premium | `workbenchUi.ts` | Premium unlock **sempre** primeiro |
| `agentSessionsWelcomePage` no startup | VS Code | `startupEditor: none` |
| Onboarding welcome | VS Code | `welcomePage.experimentalOnboarding: false` |
| Editor escondido (readonly / centered) | settings + layout state | `readonly*` vazio, `centeredLayoutAutoResize: false` |
| Webview cache (painel antigo) | extensao | `retainContextWhenHidden: false` + `PRINCY_CHAT_UI_REVISION` |
| Extensao antiga no bundle | servidor web | `--builtin-extensions-dir` + `compile-web` + sync |
| Settings VPS incompletos | `princy-vps-local.settings.json` | Alinhado com producao |

## Ficheiros alterados

- `src/vs/workbench/browser/layout.ts` - nao maximiza se `forceMaximized === false`
- `src/vs/workbench/contrib/princy/browser/princyLayoutUnlock.contribution.ts` - desbloqueio apos restore
- `extensions/princy-ai/src/workbenchUi.ts` - premium sempre, sem travas
- `extensions/princy-ai/src/princyWorkbenchChat.ts` - startup sem agent welcome
- `deploy/windows/princy-production.settings.json`
- `deploy/windows/princy-vps-local.settings.json`

## Deploy VPS

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\force-princy-visual-web.ps1 -ProjectRoot C:\Apps\Editor
```

Ctrl+F5 no browser. F1 -> `Reset Princy Layout` se precisar.
