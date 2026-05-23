import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { resolveCorsOrigin } from './corsPolicy.js';
import { prisma } from './prisma.js';
import { registerAgentRoutes } from './agentRoutes.js';
import { registerProjectRoutes } from './projectRoutes.js';
import { registerLogviewRoutes } from './logviewRoutes.js';
import { recordRequest } from './requestLog.js';
import { registerRoutes } from './routes.js';

const app = Fastify({
	logger: true
});

await app.register(cookie, {
	secret: config.sessionSecret
});

await app.register(cors, {
	origin: (origin, callback) => {
		if (config.corsRelaxed) {
			callback(null, true);
			return;
		}
		callback(null, resolveCorsOrigin(origin));
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
	allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control']
});

app.setErrorHandler((error, request, reply) => {
	if (error instanceof ZodError) {
		return reply.code(400).send({
			message: 'Validation failed',
			issues: error.issues
		});
	}

	const statusCode = reply.statusCode >= 400 ? reply.statusCode : 500;
	const isAgentRoute = request.url.startsWith('/api/agent/') || request.url.startsWith('/v1/');
	const errorMessage = error instanceof Error ? error.message : 'Request failed';

	if (statusCode >= 500) {
		request.log.error({ err: error, url: request.url }, 'request failed');
	}

	return reply.code(statusCode).send({
		message: isAgentRoute ? errorMessage : statusCode >= 500 ? 'Internal server error' : errorMessage,
		detail: isAgentRoute && error instanceof Error ? error.stack : undefined
	});
});

app.addHook('onResponse', async (request, reply) => {
	const start = (request as { _princyStart?: number })._princyStart;
	const durationMs = typeof start === 'number' ? Date.now() - start : 0;
	recordRequest({
		method: request.method,
		url: request.url,
		statusCode: reply.statusCode,
		durationMs
	});
});

app.addHook('onRequest', async request => {
	(request as { _princyStart?: number })._princyStart = Date.now();
});

await registerRoutes(app);
await registerAgentRoutes(app);
await registerProjectRoutes(app);
await registerLogviewRoutes(app);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, '../../dist/frontend');
	if (fs.existsSync(frontendDist)) {
	await app.register(staticFiles, {
		root: frontendDist,
		prefix: '/',
		index: ['index.html'],
		allowedPath: (_pathName, _root, request) => {
			const url = request.url.split('?')[0] ?? request.url;
			return !url.startsWith('/api/') && !url.startsWith('/v1/') && !url.startsWith('/logview');
		}
	});

	app.get('/', async (_request, reply) => reply.sendFile('index.html'));

	app.setNotFoundHandler((request, reply) => {
		if (request.url.startsWith('/api/') || request.url.startsWith('/v1/')) {
			return reply.code(404).send({
				ok: false,
				message: 'API route not found',
				path: request.url
			});
		}
		reply.sendFile('index.html');
	});
}

const close = async (): Promise<void> => {
	await app.close();
	await prisma.$disconnect();
};

process.on('SIGINT', () => {
	close().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
	close().finally(() => process.exit(0));
});

await app.listen({
	host: config.apiHost,
	port: config.apiPort
});
