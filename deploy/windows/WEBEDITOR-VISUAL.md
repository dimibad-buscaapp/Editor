# Visual do webeditor não mudou

O layout **estilo Cursor** (chat à direita, Princy Black, Composer) depende de **dois** artefatos:

| Artefato | Caminho | O que muda |
|----------|---------|------------|
| Workbench (editor) | `out/vs/code/browser/workbench/workbench.css` | Shell do Code Web |
| Extensão Princy IA | `extensions/princy-ai/dist/browser/extension.js` | Tema **Princy Black**, painel de chat, API |

Só compilar o `out/` **não** atualiza o visual do chat. É obrigatório `npm run compile-web` (ou o script de produção completo).

## Checklist rápido (VPS: `C:\Apps\Editor`)

```powershell
cd C:\Apps\Editor
git pull
npm install   # se node_modules/gulp não existir
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1
```

Confirme:

- `Test-Path extensions\princy-ai\dist\browser\extension.js` → **True**
- No painel de chat, o subtítulo do header mostra **`Cursor layout · cursor-v2`**
- Tema: **Princy Black** (barra de atividades e editor pretos `#000000`)

Reinicie o serviço Code Web e limpe cache do browser:

```powershell
Restart-Service PrincyAiCodeWeb
```

No browser: `https://princyai.com/webeditor/` → **Ctrl+F5**.

## Settings

Copie `deploy\windows\princy-production.settings.json` para:

`C:\Apps\Editor\.princy-user-data\User\settings.json`

(ou rode `fix-princy-code-web-service.ps1`, que copia automaticamente.)

## Ainda parece o VS Code padrão?

1. Extensão ausente → tema "Princy Black" não existe na lista.
2. Chat não aberto → abra o ícone **✦** na barra lateral secundária (direita).
3. Cache CDN/browser → Ctrl+F5 ou aba anónima.
4. URL errada → use `/webeditor/`, não só `princyai.com/`.
