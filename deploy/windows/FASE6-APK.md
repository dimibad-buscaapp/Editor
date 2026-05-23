# Fase 6 — APK (Capacitor)

## Caminho viável

```
React / Vite
    ↓
Capacitor
    ↓
Android Studio / Gradle
    ↓
APK
```

## Comandos (projeto template `apk`)

```powershell
cd workspace-storage\projetos\<seu-projeto>
npm install
npm run build
npx cap add android      # primeira vez
npx cap sync android
cd android
.\gradlew assembleDebug
```

**Resultado:**

`android\app\build\outputs\apk\debug\app-debug.apk`

## Build Center (automático)

No painel **Build Center** → tipo **APK**:

1. `npm install` (se faltar `node_modules`)
2. `npm run build` (Vite → `dist/`)
3. `npx cap add android` (se `android/gradlew` ausente)
4. `npx cap sync android`
5. `android\gradlew.bat assembleDebug`
6. Artefato copiado para `workspace-storage\builds\apk\<buildId>\app-debug.apk`
7. Download via `GET /api/build/:id/download`

## Requisitos no VPS (Windows)

| Ferramenta | Uso |
|------------|-----|
| Node.js 20+ | Vite + Capacitor CLI |
| JDK 17 | Gradle |
| Android SDK | `assembleDebug` (variáveis `ANDROID_HOME`, `JAVA_HOME`) |

Sem SDK/JDK o log do Gradle no Build Center indica o erro; instale Android Studio ou command-line tools no servidor de build.

## Criar projeto

Creator → template **Aplicativo Android APK** → **Build Center** após `npm install`.

## Regenerar skeleton

```powershell
node apps\ai-dashboard\backend\scripts\generate-project-skeletons.mjs
```
