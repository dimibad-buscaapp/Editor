# Fase 7 — EXE (Electron)

## Caminho viável

```
React / Vite
    ↓
Electron
    ↓
electron-builder
    ↓
.exe
```

## Comandos (projeto template `exe`)

```powershell
cd workspace-storage\projetos\<seu-projeto>
npm install
npm run build
npm run dist
```

**Resultado:**

`dist\*.exe` (target portable)

## Build Center (automático)

No painel **Build Center** → tipo **EXE**:

1. `npm install` (se faltar `node_modules`)
2. `npm run build` (Vite + compile electron main → `dist-electron/`)
3. `npm run dist` (`electron-builder --win portable`)
4. Artefato em `workspace-storage\builds\exe\<buildId>\`
5. Download via `GET /api/build/:id/download`

## Requisitos no VPS

| Requisito | Nota |
|-----------|------|
| Windows | Build EXE nao suportado em Linux/macOS no pipeline |
| Node.js 20+ | Vite + electron-builder |
| Espaco em disco | Download do Electron (~150 MB na primeira vez) |
| Rede | npm + cache electron-builder |

## Criar projeto

Creator → template **Aplicativo Windows EXE** → **Build Center** após `npm install`.

## Regenerar skeleton

```powershell
node apps\ai-dashboard\backend\scripts\generate-project-skeletons.mjs
```
