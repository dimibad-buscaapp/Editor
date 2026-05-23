# Fase 2 — Visual premium (Princy)

Checklist apos deploy (`git pull` + `apply-princy-webeditor-hotfix.ps1` + `compile-web` + restart servicos).

## Shell workbench

- [ ] Command Center visivel (`window.commandCenter: true`)
- [ ] Nome do projeto no centro (`window.title: ${rootName}`)
- [ ] StatusBar direita: `$(sparkle) IA: Pronto` (ou Thinking/Planning/Editing/Testing)
- [ ] Title bar: pill **Princy IA** com dot verde/cyan no Command Center
- [ ] Grid: activity bar topo | editor | chat ~360px | panel inferior

## Chat lateral

- [ ] Tema Princy Black
- [ ] Abas Chat / Composer / Agent com underline cyan na ativa
- [ ] Historico com timestamp e modo
- [ ] Agent: streaming token-a-token + timeline Thinking → Planning → Editing → Testing
- [ ] Task cards abaixo das mensagens durante job

## Composer

- [ ] Plano com diff enriquecido (linhas +/-)
- [ ] Botoes por operacao: Preview | Apply | Reject | Run | Build
- [ ] Preview abre `vscode.diff`
- [ ] Apply All / Reject All no topo

## Validacao automatica

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File deploy\windows\run-fase1-validation.ps1
```

## Deploy

```powershell
cd C:\Apps\Editor
git pull --no-rebase origin main
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\apply-princy-webeditor-hotfix.ps1
Restart-Service PrincyAiCodeWeb
```

Recompile workbench se alterou `src/vs/workbench` (title bar contrib):

```powershell
npm run compile-incremental
```
