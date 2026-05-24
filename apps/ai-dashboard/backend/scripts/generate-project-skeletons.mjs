#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/projectTemplates/skeletons');

function w(rel, content) {
	const full = path.join(root, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content.replace(/\n/g, '\n'), 'utf8');
}

const gitignore = `node_modules\ndist\nbuild\n.env\n.DS_Store\n`;

const readme = (title, steps) => `# {{PROJECT_NAME}}

${title}

## Requisitos

- Node.js 20+

## Configuracao

1. Copie \`.env.example\` para \`.env\`
${steps}

## Scripts

- \`npm run dev\` — desenvolvimento
- \`npm run build\` — build de producao
- \`npm start\` — producao (quando aplicavel)

Gerado por Princy IA Creator — {{YEAR}}.
`;

// --- webapp ---
w('webapp/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}',
	private: true,
	version: '0.1.0',
	type: 'module',
	scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview', start: 'vite preview' },
	dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
	devDependencies: {
		'@types/react': '^18.3.12', '@types/react-dom': '^18.3.1',
		'@vitejs/plugin-react': '^4.3.4', autoprefixer: '^10.4.20', postcss: '^8.4.49',
		tailwindcss: '^3.4.15', typescript: '^5.6.3', vite: '^5.4.11'
	}
}, null, 2));

w('webapp/.gitignore', gitignore);
w('webapp/.env.example', 'VITE_API_URL=http://localhost:3210\n');
w('webapp/README.md', readme('Aplicacao web React + Vite + Tailwind.', '2. `npm install`\n3. `npm run dev`'));
w('webapp/index.html', `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>{{PROJECT_NAME}}</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`);
w('webapp/vite.config.ts', `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { port: 5173 } });\n`);
w('webapp/tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', jsx: 'react-jsx', moduleResolution: 'bundler', strict: true, skipLibCheck: true }, include: ['src'] }, null, 2));
w('webapp/tailwind.config.js', `export default { content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] };\n`);
w('webapp/postcss.config.js', `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`);
w('webapp/src/main.tsx', `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n`);
w('webapp/src/App.tsx', `export default function App() {\n  return (\n    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">\n      <h1 className="text-3xl font-bold text-cyan-400">{{PROJECT_NAME}}</h1>\n      <p className="mt-4 text-slate-300">Starter webapp Princy — edite src/App.tsx</p>\n    </main>\n  );\n}\n`);
w('webapp/src/index.css', `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);

// --- api ---
w('api/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-api',
	private: true, version: '0.1.0', type: 'module',
	scripts: { dev: 'tsx watch src/server.ts', build: 'tsc', start: 'node dist/server.js', 'prisma:generate': 'prisma generate', 'prisma:migrate': 'prisma migrate dev' },
	dependencies: { '@prisma/client': '^5.22.0', fastify: '^4.28.1', zod: '^3.23.8' },
	devDependencies: { prisma: '^5.22.0', tsx: '^4.19.2', typescript: '^5.6.3', '@types/node': '^22.9.0' }
}, null, 2));
w('api/.gitignore', gitignore);
w('api/.env.example', 'DATABASE_URL=postgresql://user:pass@localhost:5432/{{PROJECT_SLUG}}\nPORT=4000\n');
w('api/README.md', readme('API REST Fastify + Prisma.', '2. Configure DATABASE_URL\n3. `npm install && npx prisma migrate dev`\n4. `npm run dev`'));
w('api/tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', outDir: 'dist', rootDir: 'src', strict: true, esModuleInterop: true, skipLibCheck: true }, include: ['src'] }, null, 2));
w('api/prisma/schema.prisma', `generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\nmodel Item {\n  id        String   @id @default(cuid())\n  title     String\n  createdAt DateTime @default(now())\n}\n`);
w('api/src/server.ts', `import Fastify from 'fastify';\nimport { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();\nconst app = Fastify({ logger: true });\napp.get('/health', async () => ({ ok: true, name: '{{PROJECT_NAME}}' }));\napp.get('/api/items', async () => prisma.item.findMany());\napp.post('/api/items', async req => {\n  const body = req.body as { title?: string };\n  return prisma.item.create({ data: { title: body.title ?? 'Novo item' } });\n});\nconst port = Number(process.env.PORT ?? 4000);\napp.listen({ port, host: '0.0.0.0' });\n`);

// --- landing (copy webapp lighter) ---
for (const f of ['package.json','index.html','vite.config.ts','tsconfig.json','tailwind.config.js','postcss.config.js']) {
	w(`landing/${f}`, fs.readFileSync(path.join(root, 'webapp', f), 'utf8'));
}
w('landing/.gitignore', gitignore);
w('landing/.env.example', '');
w('landing/README.md', readme('Landing page marketing.', '2. `npm install`\n3. `npm run dev`'));
w('landing/src/main.tsx', `import './index.css';\ndocument.querySelector('#app')!.innerHTML = \`<div class="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8"><h1 class="text-5xl font-bold">{{PROJECT_NAME}}</h1><p class="mt-4 text-xl text-gray-400">Sua landing page Princy</p><a href="#" class="mt-8 px-6 py-3 bg-cyan-500 text-black rounded-lg font-semibold">Comecar</a></div>\`;\n`);
w('landing/src/index.css', `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);
w('landing/index.html', `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{{PROJECT_NAME}}</title></head><body><div id="app"></div><script type="module" src="/src/main.tsx"></script></body></html>`);

// --- dashboard ---
for (const f of ['package.json','index.html','vite.config.ts','tsconfig.json','tailwind.config.js','postcss.config.js','src/index.css']) {
	if (fs.existsSync(path.join(root, 'webapp', f))) w(`dashboard/${f}`, fs.readFileSync(path.join(root, 'webapp', f), 'utf8'));
}
w('dashboard/.gitignore', gitignore);
w('dashboard/package.json', fs.readFileSync(path.join(root, 'webapp', 'package.json'), 'utf8').replace('"react-dom": "^18.3.1"', '"react-dom": "^18.3.1", "recharts": "^2.13.3"'));
w('dashboard/README.md', readme('Dashboard com graficos Recharts.', '2. `npm install`\n3. `npm run dev`'));
w('dashboard/src/main.tsx', fs.readFileSync(path.join(root, 'webapp', 'src/main.tsx'), 'utf8'));
w('dashboard/src/App.tsx', `import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\nconst data = [{ name: 'Jan', v: 40 }, { name: 'Fev', v: 55 }, { name: 'Mar', v: 48 }];\nexport default function App() {\n  return (\n    <main className="min-h-screen bg-slate-900 text-white p-8">\n      <h1 className="text-2xl font-bold mb-6">{{PROJECT_NAME}} Dashboard</h1>\n      <div className="h-64 bg-slate-800 rounded-lg p-4">\n        <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#334155"/><XAxis dataKey="name" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Line type="monotone" dataKey="v" stroke="#22d3ee"/></LineChart></ResponsiveContainer>\n      </div>\n    </main>\n  );\n}\n`);

// --- database (like api) ---
for (const f of ['package.json', '.gitignore', '.env.example', 'tsconfig.json', 'prisma/schema.prisma']) {
	w(`database/${f}`, fs.readFileSync(path.join(root, 'api', f), 'utf8'));
}
w('database/README.md', readme('Sistema com banco Prisma + CRUD.', '2. DATABASE_URL no .env\n3. `npm install && npx prisma migrate dev`'));
w('database/src/server.ts', fs.readFileSync(path.join(root, 'api', 'src/server.ts'), 'utf8'));

// --- payments ---
w('payments/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-payments', private: true, version: '0.1.0', type: 'module',
	scripts: { dev: 'tsx watch src/server.ts', build: 'tsc', start: 'node dist/server.js' },
	dependencies: { fastify: '^4.28.1', stripe: '^17.3.1', zod: '^3.23.8' },
	devDependencies: { tsx: '^4.19.2', typescript: '^5.6.3', '@types/node': '^22.9.0' }
}, null, 2));
w('payments/.gitignore', gitignore);
w('payments/.env.example', 'STRIPE_SECRET_KEY=sk_test_...\nSTRIPE_WEBHOOK_SECRET=whsec_...\nPORT=4001\n');
w('payments/README.md', readme('API Stripe checkout + webhook.', '2. Chaves Stripe no .env\n3. `npm run dev`'));
w('payments/tsconfig.json', fs.readFileSync(path.join(root, 'api', 'tsconfig.json'), 'utf8'));
w('payments/src/server.ts', `import Fastify from 'fastify';\nimport Stripe from 'stripe';\nconst stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-11-20.acacia' });\nconst app = Fastify({ logger: true });\napp.get('/health', async () => ({ ok: true, service: '{{PROJECT_NAME}} payments' }));\napp.post('/api/checkout', async () => {\n  const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price_data: { currency: 'brl', product_data: { name: '{{PROJECT_NAME}}' }, unit_amount: 1000 }, quantity: 1 }], success_url: 'https://example.com/success', cancel_url: 'https://example.com/cancel' });\n  return { url: session.url };\n});\napp.post('/webhooks/stripe', { config: { rawBody: true } }, async (req, reply) => {\n  reply.send({ received: true });\n});\napp.listen({ port: Number(process.env.PORT ?? 4001), host: '0.0.0.0' });\n`);

// --- automation ---
w('automation/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-automation', private: true, version: '0.1.0', type: 'module',
	scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' },
	dependencies: { 'node-cron': '^3.0.3' },
	devDependencies: { tsx: '^4.19.2', typescript: '^5.6.3', '@types/node': '^22.9.0' }
}, null, 2));
w('automation/.gitignore', gitignore);
w('automation/README.md', readme('Jobs agendados com node-cron.', '2. `npm install`\n3. `npm run dev`'));
w('automation/tsconfig.json', fs.readFileSync(path.join(root, 'api', 'tsconfig.json'), 'utf8'));
w('automation/src/index.ts', `import cron from 'node-cron';\nconsole.log('{{PROJECT_NAME}} automation started');\ncron.schedule('*/5 * * * *', () => console.log('[cron]', new Date().toISOString(), 'heartbeat'));\n`);

// --- bot ---
w('bot/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-bot', private: true, version: '0.1.0', type: 'module',
	scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' },
	dependencies: { telegraf: '^4.16.3' },
	devDependencies: { tsx: '^4.19.2', typescript: '^5.6.3', '@types/node': '^22.9.0' }
}, null, 2));
w('bot/.gitignore', gitignore);
w('bot/.env.example', 'TELEGRAM_BOT_TOKEN=\n');
w('bot/README.md', readme('Bot Telegram com Telegraf.', '2. TELEGRAM_BOT_TOKEN no .env\n3. `npm run dev`'));
w('bot/tsconfig.json', fs.readFileSync(path.join(root, 'api', 'tsconfig.json'), 'utf8'));
w('bot/src/index.ts', `import { Telegraf } from 'telegraf';\nconst token = process.env.TELEGRAM_BOT_TOKEN;\nif (!token) { console.error('Defina TELEGRAM_BOT_TOKEN'); process.exit(1); }\nconst bot = new Telegraf(token);\nbot.start(ctx => ctx.reply('Ola! {{PROJECT_NAME}} bot ativo.'));\nbot.launch();\n`);

// --- apk (React/Vite → Capacitor → Gradle → app-debug.apk) ---
w('apk/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}', private: true, version: '0.1.0', type: 'module',
	scripts: {
		dev: 'vite',
		build: 'tsc -b && vite build',
		'cap:sync': 'npx cap sync android',
		'cap:add-android': 'npx cap add android',
		preview: 'vite preview'
	},
	dependencies: { '@capacitor/android': '^6.2.0', '@capacitor/core': '^6.2.0', react: '^18.3.1', 'react-dom': '^18.3.1' },
	devDependencies: { '@capacitor/cli': '^6.2.0', '@vitejs/plugin-react': '^4.3.4', typescript: '^5.6.3', vite: '^5.4.11', '@types/react': '^18.3.12', '@types/react-dom': '^18.3.1' }
}, null, 2));
w('apk/.gitignore', gitignore + 'android/\n');
w('apk/capacitor.config.ts', `import type { CapacitorConfig } from '@capacitor/cli';\nconst config: CapacitorConfig = {\n  appId: 'com.princy.{{PROJECT_SLUG}}',\n  appName: '{{PROJECT_NAME}}',\n  webDir: 'dist'\n};\nexport default config;\n`);
w('apk/README.md', `# {{PROJECT_NAME}}

App Android: **React/Vite → Capacitor → Gradle → APK**

## Requisitos

- Node.js 20+
- JDK 17+ (Android)
- Android SDK (ou Android Studio)

## Comandos (manual)

\`\`\`bash
npm install
npm run build
npx cap add android    # primeira vez (cria pasta android/)
npx cap sync android
cd android
./gradlew assembleDebug   # Windows: .\\gradlew assembleDebug
\`\`\`

**APK gerado:**

\`android/app/build/outputs/apk/debug/app-debug.apk\`

## Build Center (Princy)

No painel **Build Center**, tipo **APK**: o backend executa o mesmo pipeline automaticamente.

Gerado por Princy IA Creator — {{YEAR}}.
`);
w('apk/index.html', fs.readFileSync(path.join(root, 'webapp', 'index.html'), 'utf8'));
w('apk/vite.config.ts', fs.readFileSync(path.join(root, 'webapp', 'vite.config.ts'), 'utf8'));
w('apk/tsconfig.json', fs.readFileSync(path.join(root, 'webapp', 'tsconfig.json'), 'utf8'));
w('apk/src/main.tsx', fs.readFileSync(path.join(root, 'webapp', 'src/main.tsx'), 'utf8'));
w('apk/src/App.tsx', `export default function App() {\n  return (\n    <main style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 24, fontFamily: 'system-ui' }}>\n      <h1 style={{ color: '#22d3ee' }}>{{PROJECT_NAME}}</h1>\n      <p>App Android Capacitor — edite src/App.tsx</p>\n    </main>\n  );\n}\n`);

// --- exe (React/Vite → Electron → electron-builder → dist/*.exe) ---
w('exe/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-desktop',
	private: true,
	version: '0.1.0',
	main: 'dist-electron/main.js',
	scripts: {
		dev: 'concurrently "vite" "tsc -p electron -w"',
		build: 'vite build && tsc -p electron',
		dist: 'npm run build && electron-builder --win portable',
		start: 'electron .'
	},
	dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
	devDependencies: {
		'@vitejs/plugin-react': '^4.3.4',
		concurrently: '^9.1.0',
		electron: '^33.2.0',
		'electron-builder': '^25.1.8',
		typescript: '^5.6.3',
		vite: '^5.4.11',
		'@types/react': '^18.3.12',
		'@types/react-dom': '^18.3.1'
	},
	build: {
		appId: 'com.princy.{{PROJECT_SLUG}}',
		productName: '{{PROJECT_NAME}}',
		directories: { output: 'dist' },
		files: ['dist/**/*', 'dist-electron/**/*', 'package.json'],
		win: { target: ['portable'] }
	}
}, null, 2));
w('exe/.gitignore', gitignore + 'dist-electron\n');
w('exe/README.md', `# {{PROJECT_NAME}}

App Windows: **React/Vite → Electron → electron-builder → .exe**

## Requisitos

- Node.js 20+
- Windows (build do instalador/portable)

## Comandos (manual)

\`\`\`powershell
npm install
npm run build
npm run dist
\`\`\`

**Resultado:**

\`dist\\*.exe\` (portable)

## Build Center (Princy)

No painel **Build Center**, tipo **EXE**: o backend executa o mesmo pipeline automaticamente.

Gerado por Princy IA Creator — {{YEAR}}.
`);
w('exe/vite.config.ts', `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], base: './' });\n`);
w('exe/index.html', fs.readFileSync(path.join(root, 'webapp', 'index.html'), 'utf8'));
w('exe/src/main.tsx', fs.readFileSync(path.join(root, 'webapp', 'src/main.tsx'), 'utf8'));
w('exe/src/App.tsx', fs.readFileSync(path.join(root, 'webapp', 'src/App.tsx'), 'utf8'));
w('exe/electron/main.ts', `import { app, BrowserWindow } from 'electron';\nimport path from 'node:path';\nfunction createWindow() {\n  const win = new BrowserWindow({ width: 960, height: 640, webPreferences: { preload: path.join(__dirname, 'preload.js') } });\n  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);\n  else win.loadFile(path.join(__dirname, '../dist/index.html'));\n}\napp.whenReady().then(createWindow);\n`);
w('exe/electron/preload.ts', `// preload seguro\n`);
w('exe/electron/tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS', outDir: '../dist-electron', rootDir: '.', strict: true, esModuleInterop: true }, include: ['*.ts'] }, null, 2));

// --- saas monorepo ---
w('saas/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-saas', private: true, version: '0.1.0', workspaces: ['apps/web', 'apps/api'],
	scripts: { dev: 'npm run dev -w apps/web & npm run dev -w apps/api', build: 'npm run build -w apps/api && npm run build -w apps/web' }
}, null, 2));
w('saas/.gitignore', gitignore);
w('saas/README.md', readme('Monorepo SaaS (web + API + auth).', '2. `npm install` na raiz\n3. Configure apps/api/.env\n4. `npm run dev`'));
w('saas/apps/api/package.json', fs.readFileSync(path.join(root, 'api', 'package.json'), 'utf8').replace('{{PROJECT_SLUG}}-api', '{{PROJECT_SLUG}}-saas-api'));
w('saas/apps/api/.env.example', 'DATABASE_URL=postgresql://localhost:5432/{{PROJECT_SLUG}}\nJWT_SECRET=change-me\nPORT=4000\n');
w('saas/apps/api/src/server.ts', fs.readFileSync(path.join(root, 'api', 'src/server.ts'), 'utf8') + `\napp.post('/api/auth/login', async () => ({ token: 'demo-jwt-{{PROJECT_SLUG}}' }));\n`);
for (const f of ['tsconfig.json', 'prisma/schema.prisma']) w(`saas/apps/api/${f}`, fs.readFileSync(path.join(root, 'api', f), 'utf8'));
w('saas/apps/web/package.json', fs.readFileSync(path.join(root, 'webapp', 'package.json'), 'utf8'));
w('saas/apps/web/vite.config.ts', fs.readFileSync(path.join(root, 'webapp', 'vite.config.ts'), 'utf8'));
w('saas/apps/web/index.html', fs.readFileSync(path.join(root, 'webapp', 'index.html'), 'utf8'));
w('saas/apps/web/src/main.tsx', fs.readFileSync(path.join(root, 'webapp', 'src/main.tsx'), 'utf8'));
w('saas/apps/web/src/App.tsx', `export default function App() { return <main className="p-8"><h1>{{PROJECT_NAME}} SaaS</h1><p>Web + API monorepo</p></main>; }\n`);
w('saas/apps/web/src/index.css', fs.readFileSync(path.join(root, 'webapp', 'src/index.css'), 'utf8'));

// --- auth ---
w('auth/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-auth', private: true, version: '0.1.0', workspaces: ['apps/web', 'apps/api'],
	scripts: { dev: 'npm run dev -w apps/api', build: 'npm run build -w apps/api && npm run build -w apps/web' }
}, null, 2));
w('auth/.gitignore', gitignore);
w('auth/README.md', readme('Login JWT + frontend React.', '2. `npm install`\n3. apps/api/.env com JWT_SECRET'));
w('auth/apps/api/package.json', JSON.stringify({
	name: '{{PROJECT_SLUG}}-auth-api', type: 'module', version: '0.1.0',
	scripts: { dev: 'tsx watch src/server.ts', build: 'tsc', start: 'node dist/server.js' },
	dependencies: { fastify: '^4.28.1', jsonwebtoken: '^9.0.2', bcryptjs: '^2.4.3', zod: '^3.23.8' },
	devDependencies: { tsx: '^4.19.2', typescript: '^5.6.3', '@types/node': '^22.9.0', '@types/jsonwebtoken': '^9.0.7', '@types/bcryptjs': '^2.4.6' }
}, null, 2));
w('auth/apps/api/.env.example', 'JWT_SECRET=change-me-long\nPORT=4002\n');
w('auth/apps/api/tsconfig.json', fs.readFileSync(path.join(root, 'api', 'tsconfig.json'), 'utf8'));
w('auth/apps/api/src/server.ts', `import Fastify from 'fastify';\nimport jwt from 'jsonwebtoken';\nimport bcrypt from 'bcryptjs';\nconst app = Fastify({ logger: true });\nconst users = new Map<string, string>();\napp.post('/api/auth/register', async req => {\n  const { email, password } = req.body as { email: string; password: string };\n  users.set(email, await bcrypt.hash(password, 10));\n  return { ok: true };\n});\napp.post('/api/auth/login', async req => {\n  const { email, password } = req.body as { email: string; password: string };\n  const hash = users.get(email);\n  if (!hash || !(await bcrypt.compare(password, hash))) return app.httpErrors.unauthorized();\n  const token = jwt.sign({ email }, process.env.JWT_SECRET ?? 'dev');\n  return { token };\n});\napp.listen({ port: Number(process.env.PORT ?? 4002), host: '0.0.0.0' });\n`);
w('auth/apps/web/package.json', fs.readFileSync(path.join(root, 'webapp', 'package.json'), 'utf8'));
w('auth/apps/web/src/App.tsx', `export default function App() {\n  return (\n    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">\n      <form className="p-8 border border-slate-700 rounded-xl w-80">\n        <h1 className="text-xl font-bold mb-4">{{PROJECT_NAME}} Login</h1>\n        <input className="w-full mb-2 p-2 rounded bg-slate-800" placeholder="email" />\n        <input type="password" className="w-full mb-4 p-2 rounded bg-slate-800" placeholder="senha" />\n        <button className="w-full py-2 bg-cyan-500 text-black rounded font-semibold">Entrar</button>\n      </form>\n    </main>\n  );\n}\n`);
for (const f of ['index.html', 'vite.config.ts', 'src/main.tsx', 'src/index.css']) {
	w(`auth/apps/web/${f}`, fs.readFileSync(path.join(root, 'webapp', f), 'utf8'));
}

console.log('All 12 skeletons generated under', root);
