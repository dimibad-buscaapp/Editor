import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from './config.js';
import { listProjectSlugs } from './build/buildCenterService.js';
import { createProject, getInstallJob } from './projectCreatorService.js';
import { getTemplate, listTemplates } from './projectTemplates/index.js';

const templateIdSchema = z.enum([
	'apk', 'exe', 'webapp', 'saas', 'api', 'automation', 'bot',
	'dashboard', 'landing', 'auth', 'payments', 'database'
]);

const createProjectSchema = z.object({
	templateId: templateIdSchema,
	projectName: z.string().min(1).max(64),
	runInstall: z.boolean().optional().default(false)
});

const publicProjectPaths = new Set([
	'/api/projects',
	'/api/projects/templates'
]);

function authorizeProjectRequest(request: FastifyRequest, reply: FastifyReply): void {
	if (!config.agentApiToken) {
		return;
	}
	const authorization = request.headers.authorization;
	if (authorization !== `Bearer ${config.agentApiToken}`) {
		reply.code(401);
		throw new Error('Invalid agent API token');
	}
}

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		const path = request.url.split('?')[0] ?? request.url;
		if (!path.startsWith('/api/projects')) {
			return;
		}
		if (config.publicChatEnabled && (
			publicProjectPaths.has(path) ||
			path.startsWith('/api/projects/templates/') ||
			path === '/api/projects/create' ||
			path.startsWith('/api/projects/create/')
		)) {
			return;
		}
		authorizeProjectRequest(request, reply);
	});

	app.get('/api/projects', async () => ({
		ok: true,
		projectsRoot: config.projectsRoot,
		projects: listProjectSlugs()
	}));

	app.get('/api/projects/templates', async () => ({
		ok: true,
		templates: listTemplates()
	}));

	app.get('/api/projects/templates/:id', async request => {
		const params = z.object({ id: templateIdSchema }).parse(request.params);
		const template = getTemplate(params.id);
		if (!template) {
			return { ok: false, message: 'Template not found' };
		}
		return {
			ok: true,
			template: {
				id: template.id,
				name: template.name,
				description: template.description,
				stack: template.stack,
				build: template.build,
				buildTarget: template.buildTarget,
				tags: template.tags
			}
		};
	});

	app.post('/api/projects/create', async request => {
		const body = createProjectSchema.parse(request.body);
		try {
			const result = await createProject({
				templateId: body.templateId,
				projectName: body.projectName,
				runInstall: body.runInstall
			});
			const template = getTemplate(body.templateId);
			return {
				...result,
				build: template?.build,
				buildTarget: template?.buildTarget
			};
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			};
		}
	});

	app.get('/api/projects/create/:jobId', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		const snapshot = getInstallJob(params.jobId);
		if (!snapshot) {
			return { ok: false, message: 'Install job not found' };
		}
		return { ok: true, ...snapshot };
	});
}
