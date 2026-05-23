import type { ProjectTemplateDefinition, ProjectTemplateId, ProjectTemplateSummary } from './types.js';

export const templates: Record<ProjectTemplateId, ProjectTemplateDefinition> = {
	webapp: {
		id: 'webapp',
		name: 'Pagina Web',
		description: 'Aplicacao web React com Vite e Tailwind CSS.',
		stack: ['React', 'Vite', 'Tailwind'],
		build: 'npm run build',
		buildTarget: 'web',
		skeletonDir: 'webapp',
		tags: ['frontend', 'web']
	},
	api: {
		id: 'api',
		name: 'Fastify API',
		description: 'API REST Fastify, Prisma, PostgreSQL e Swagger.',
		stack: ['Node', 'Fastify', 'Prisma', 'Swagger'],
		build: 'npm run build',
		buildTarget: 'api',
		skeletonDir: 'api',
		tags: ['backend', 'rest', 'fastify']
	},
	'express-api': {
		id: 'express-api',
		name: 'Express API',
		description: 'API REST Express, Prisma e documentacao Swagger.',
		stack: ['Node', 'Express', 'Prisma', 'Swagger'],
		build: 'npm run build',
		buildTarget: 'api',
		skeletonDir: 'express-api',
		tags: ['backend', 'rest', 'express']
	},
	webhook: {
		id: 'webhook',
		name: 'Webhook',
		description: 'Receber webhooks com validacao de assinatura e Swagger.',
		stack: ['Node', 'Fastify', 'Webhooks'],
		build: 'npm run build',
		buildTarget: 'api',
		skeletonDir: 'webhook',
		tags: ['backend', 'webhook']
	},
	apk: {
		id: 'apk',
		name: 'Aplicativo Android APK',
		description: 'React/Vite + Capacitor + Gradle → app-debug.apk',
		stack: ['React', 'Vite', 'Capacitor', 'Gradle'],
		build: 'npm run build → cap sync → gradlew assembleDebug',
		buildTarget: 'apk',
		skeletonDir: 'apk',
		tags: ['mobile', 'android']
	},
	exe: {
		id: 'exe',
		name: 'Aplicativo Windows EXE',
		description: 'React/Vite + Electron + electron-builder → dist/*.exe',
		stack: ['React', 'Vite', 'Electron', 'electron-builder'],
		build: 'npm run build → npm run dist',
		buildTarget: 'exe',
		skeletonDir: 'exe',
		tags: ['desktop', 'windows']
	},
	saas: {
		id: 'saas',
		name: 'Sistema SaaS',
		description: 'Monorepo com frontend web, API e autenticacao.',
		stack: ['React', 'Fastify', 'Prisma', 'JWT'],
		build: 'npm run build',
		buildTarget: 'web',
		skeletonDir: 'saas',
		tags: ['saas', 'fullstack']
	},
	automation: {
		id: 'automation',
		name: 'Automacao',
		description: 'Jobs agendados com Node e node-cron.',
		stack: ['Node', 'node-cron'],
		build: 'npm run build',
		skeletonDir: 'automation',
		tags: ['scripts', 'cron']
	},
	bot: {
		id: 'bot',
		name: 'Bot',
		description: 'Bot Telegram/Discord com handlers modulares.',
		stack: ['Node', 'Telegraf'],
		build: 'npm run build',
		skeletonDir: 'bot',
		tags: ['bot', 'telegram']
	},
	dashboard: {
		id: 'dashboard',
		name: 'Painel Admin',
		description: 'Painel administrativo com graficos e metricas.',
		stack: ['React', 'Vite', 'Recharts'],
		build: 'npm run build',
		buildTarget: 'web',
		skeletonDir: 'dashboard',
		tags: ['dashboard', 'analytics']
	},
	landing: {
		id: 'landing',
		name: 'Landing Page',
		description: 'Pagina de marketing estatica com Vite e Tailwind.',
		stack: ['Vite', 'Tailwind'],
		build: 'npm run build',
		buildTarget: 'web',
		skeletonDir: 'landing',
		tags: ['marketing', 'landing']
	},
	auth: {
		id: 'auth',
		name: 'Auth JWT',
		description: 'Login/registro com JWT, sessoes e frontend React.',
		stack: ['React', 'Fastify', 'JWT'],
		build: 'npm run build',
		buildTarget: 'api',
		skeletonDir: 'auth',
		tags: ['auth', 'security']
	},
	payments: {
		id: 'payments',
		name: 'Sistema com pagamento',
		description: 'Integracao Stripe com checkout e webhooks.',
		stack: ['Fastify', 'Stripe'],
		build: 'npm run build',
		buildTarget: 'api',
		skeletonDir: 'payments',
		tags: ['payments', 'stripe']
	},
	database: {
		id: 'database',
		name: 'Prisma + PostgreSQL',
		description: 'API com Prisma, migrations e CRUD de exemplo.',
		stack: ['Fastify', 'Prisma', 'PostgreSQL'],
		build: 'npm run build',
		buildTarget: 'api',
		skeletonDir: 'database',
		tags: ['database', 'prisma']
	}
};

export function listTemplates(): readonly ProjectTemplateSummary[] {
	return Object.values(templates).map(template => ({
		id: template.id,
		name: template.name,
		description: template.description,
		stack: template.stack,
		build: template.build,
		buildTarget: template.buildTarget,
		tags: template.tags
	}));
}

export function getTemplate(id: string): ProjectTemplateDefinition | undefined {
	if (id in templates) {
		return templates[id as ProjectTemplateId];
	}
	return undefined;
}
