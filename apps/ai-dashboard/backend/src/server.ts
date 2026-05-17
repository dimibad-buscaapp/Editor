import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { prisma } from './prisma.js';
import { registerAgentRoutes } from './agentRoutes.js';
import { registerRoutes } from './routes.js';

const app = Fastify({
	logger: true
});

await app.register(cookie, {
	secret: config.sessionSecret
});

await app.register(cors, {
	origin: config.appOrigin,
	credentials: true
});

app.setErrorHandler((error, _request, reply) => {
	if (error instanceof ZodError) {
		return reply.code(400).send({
			message: 'Validation failed',
			issues: error.issues
		});
	}

	const statusCode = reply.statusCode >= 400 ? reply.statusCode : 500;
	return reply.code(statusCode).send({
		message: statusCode >= 500 ? 'Internal server error' : error instanceof Error ? error.message : 'Request failed'
	});
});

await registerRoutes(app);
await registerAgentRoutes(app);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, '../frontend');
if (fs.existsSync(frontendDist)) {
	await app.register(staticFiles, {
		root: frontendDist,
		prefix: '/'
	});

	app.setNotFoundHandler((_request, reply) => {
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
