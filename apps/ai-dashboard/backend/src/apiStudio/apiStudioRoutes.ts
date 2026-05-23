import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { getApiProjectInfo } from './apiStudioService.js';
import { defaultSmokeTests, runEndpointTests, type EndpointTestCase } from './endpointTester.js';
import { fetchOpenApiSpec, startDevServer, stopDevServer } from './devProcessManager.js';
import { runPrismaDbPush, runPrismaGenerate, runPrismaMigrate } from './prismaRunner.js';
import { scaffoldRoute } from './routeScaffolder.js';
import { assertSafeProjectName } from '../projectCreatorService.js';

const projectBodySchema = z.object({
	projectPath: z.string().optional()
});

const routeBodySchema = z.object({
	method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
	path: z.string().min(1),
	handlerName: z.string().optional(),
	projectPath: z.string().optional()
});

const migrateBodySchema = z.object({
	name: z.string().optional(),
	pushOnly: z.boolean().optional(),
	projectPath: z.string().optional()
});

const testBodySchema = z.object({
	tests: z.array(z.object({
		method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
		path: z.string(),
		body: z.unknown().optional(),
		expectStatus: z.number().int().optional()
	})).optional(),
	useDefaults: z.boolean().optional(),
	projectPath: z.string().optional(),
	startDev: z.boolean().optional()
});

const publicStudioPaths = new Set<string>(['/api/studio']);

function authorizeStudioRequest(request: FastifyRequest, reply: FastifyReply): void {
	if (!config.agentApiToken) {
		return;
	}
	const authorization = request.headers.authorization;
	if (authorization !== `Bearer ${config.agentApiToken}`) {
		reply.code(401);
		throw new Error('Invalid agent API token');
	}
}

function isPublicStudioPath(pathname: string): boolean {
	if (publicStudioPaths.has(pathname)) {
		return true;
	}
	return /^\/api\/studio\/[^/]+$/.test(pathname);
}

function parseSlug(params: { slug: string }): string {
	const slug = assertSafeProjectName(params.slug);
	return slug;
}

export async function registerApiStudioRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		const pathname = request.url.split('?')[0] ?? request.url;
		if (!pathname.startsWith('/api/studio')) {
			return;
		}
		if (config.publicChatEnabled && isPublicStudioPath(pathname)) {
			return;
		}
		authorizeStudioRequest(request, reply);
	});

	app.get('/api/studio', async () => ({
		ok: true,
		features: ['routes', 'prisma-migrate', 'endpoint-test', 'openapi', 'dev-server']
	}));

	app.get('/api/studio/:slug', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const query = projectBodySchema.parse(request.query ?? {});
		const info = getApiProjectInfo(slug, query.projectPath);
		return { ok: true, project: info };
	});

	app.post('/api/studio/:slug/routes', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = routeBodySchema.parse(request.body ?? {});
		try {
			const info = getApiProjectInfo(slug, body.projectPath);
			const result = scaffoldRoute(info.projectPath, {
				method: body.method,
				path: body.path,
				handlerName: body.handlerName
			});
			return { ok: true, slug, ...result };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/studio/:slug/prisma/migrate', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = migrateBodySchema.parse(request.body ?? {});
		try {
			const info = getApiProjectInfo(slug, body.projectPath);
			if (!info.hasPrisma) {
				return { ok: false, message: 'Projeto sem prisma/schema.prisma' };
			}
			let output: string;
			if (body.pushOnly) {
				output = await runPrismaDbPush(info.projectPath);
			} else {
				output = await runPrismaMigrate(info.projectPath, body.name);
			}
			return { ok: true, slug, output: output.slice(-8000) };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/studio/:slug/prisma/generate', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = projectBodySchema.parse(request.body ?? {});
		try {
			const info = getApiProjectInfo(slug, body.projectPath);
			const output = await runPrismaGenerate(info.projectPath);
			return { ok: true, slug, output: output.slice(-4000) };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/studio/:slug/test', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = testBodySchema.parse(request.body ?? {});
		try {
			const info = getApiProjectInfo(slug, body.projectPath);
			if (body.startDev) {
				await startDevServer(slug, info.projectPath);
			}
			const baseUrl = `http://127.0.0.1:${info.port}`;
			const tests: EndpointTestCase[] = body.tests?.length
				? body.tests
				: body.useDefaults !== false
					? defaultSmokeTests()
					: [{ method: 'GET', path: '/health', expectStatus: 200 }];
			const result = await runEndpointTests(baseUrl, tests);
			return { ok: true, slug, baseUrl, ...result };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.get('/api/studio/:slug/openapi', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const query = projectBodySchema.parse(request.query ?? {});
		try {
			const info = getApiProjectInfo(slug, query.projectPath);
			const spec = await fetchOpenApiSpec(`http://127.0.0.1:${info.port}`, info.stack);
			return { ok: true, slug, openapi: spec, docsUrl: info.docsUrl };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/studio/:slug/dev/start', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = projectBodySchema.parse(request.body ?? {});
		try {
			const info = getApiProjectInfo(slug, body.projectPath);
			const started = await startDevServer(slug, info.projectPath);
			return {
				ok: true,
				slug,
				port: started.port,
				alreadyRunning: started.alreadyRunning,
				docsUrl: info.docsUrl
			};
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/studio/:slug/dev/stop', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const stopped = stopDevServer(slug);
		return { ok: true, slug, stopped };
	});
}
