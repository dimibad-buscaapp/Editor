# Fase 4 — Criador universal de projetos

## Templates (12)

| ID | Nome |
|----|------|
| webapp | Pagina Web |
| api | API REST |
| apk | Aplicativo Android APK |
| exe | Aplicativo Windows EXE |
| saas | Sistema SaaS |
| automation | Automacao |
| bot | Bot |
| dashboard | Dashboard |
| landing | Landing Page |
| auth | Sistema com login |
| payments | Sistema com pagamento |
| database | Sistema com banco de dados |

Pasta padrao (Fase 5): `apps/ai-dashboard/workspace-storage/projetos/<nome-do-projeto>`  
Override: `PRINCY_PROJECTS_ROOT` ou `WORKSPACE_STORAGE_ROOT` no `.env`

## API

| Metodo | Rota |
|--------|------|
| GET | `/api/projects/templates` |
| GET | `/api/projects/templates/:id` |
| POST | `/api/projects/create` — `{ "templateId", "projectName", "runInstall": true }` |
| GET | `/api/projects/create/:jobId` — status do npm install |

## Preparacao VPS

```powershell
# Na raiz do repositorio
.\deploy\windows\ensure-princy-projects-folder.ps1

# Fase 5: use ensure-princy-build-storage.ps1 (cria projetos/ + builds/)
# PRINCY_PROJECTS_ROOT=...  (opcional; default = workspace-storage/projetos)
```

## Deploy

```powershell
cd C:\Apps\Editor
git pull

cd apps\ai-dashboard
npm run build

cd C:\Apps\Editor
.\deploy\windows\code-web\compile-princy-code-web-production.ps1
.\deploy\windows\code-web\sync-princy-ai-out-extensions.ps1
.\deploy\windows\restart-princy-services.ps1
.\deploy\windows\code-web\verify-princy-chat-api.ps1
```

## Uso no editor

1. Abra o painel Princy IA a direita
2. Aba **Creator**
3. Digite o nome do projeto (ex: `meu-app`)
4. Clique **Criar** no card do template desejado
5. **Abrir pasta** ou **Build** apos criar

## Regenerar skeletons (dev)

```powershell
node apps\ai-dashboard\backend\scripts\generate-project-skeletons.mjs
```
