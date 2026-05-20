# Princy Ai — chat somente via Webview

## Arquitetura correta

```
Painel Princy Ai (webview)
    ↓ fetch
http://127.0.0.1:3200/princy-api  (proxy Code Web)
    ↓
http://127.0.0.1:3210  (agent backend / Ollama)
```

## O que NÃO usar (ainda)

- `vscode.chat` / `createChatParticipant`
- Chat nativo VS Code (`workbench.panel.chat`)
- Agent Sessions Welcome com `ChatWidget` embutido
- Copilot-style agent host no browser

A extensão `princy-ai` **não** registra chat participants. O crash `Cannot read properties of undefined (reading 'id'|'metadata')` vinha do **chat nativo** sem agentes registrados.

## Correções no fork

1. `chatInputEditorContrib.ts` — ignora eventos sem `agent.metadata`
2. `agentSessionsWelcome` — não monta `ChatWidget` no produto Princy
3. `princyChatIsolation.ts` — redireciona comandos `workbench.action.chat.*` para o painel Princy

## UI

O painel usa variáveis CSS do VS Code (`--vscode-foreground`, `--vscode-sideBar-background`, etc.) para combinar com o tema do editor. Quick actions: `@workspace` (→ `@codebase`), `/fix`, `/explain`.

## Uso

- **Ctrl+L** → painel Princy Ai
- Motor padrão: **deepseek** (`princyai.defaultAgent`)
- Settings: `princyai.agentEndpoint` = `http://127.0.0.1:3200/princy-api`

## Recompilar

```powershell
cd C:\Apps\Editor
npm run compile-incremental
npm run compile-web
```
