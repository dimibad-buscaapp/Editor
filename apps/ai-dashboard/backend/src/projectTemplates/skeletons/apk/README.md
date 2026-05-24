# {{PROJECT_NAME}}

App Android: **React/Vite → Capacitor → Gradle → APK**

## Requisitos

- Node.js 20+
- JDK 17+ (Android)
- Android SDK (ou Android Studio)

## Comandos (manual)

```bash
npm install
npm run build
npx cap add android    # primeira vez (cria pasta android/)
npx cap sync android
cd android
./gradlew assembleDebug   # Windows: .\gradlew assembleDebug
```

**APK gerado:**

`android/app/build/outputs/apk/debug/app-debug.apk`

## Build Center (Princy)

No painel **Build Center**, tipo **APK**: o backend executa o mesmo pipeline automaticamente.

Gerado por Princy IA Creator — {{YEAR}}.
