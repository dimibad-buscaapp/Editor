import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { config } from './config.js';
import {
	getArtifactFilePath,
	getBuildStatus,
	readBuildLogs,
	startBuild,
	subscribeBuildLogs
} from './build/buildCenterService.js';

const buildTypeSchema = z.enum(['apk', 'exe', 'web', 'api']);

const startBuildSchema = z.object({
	type: buildTypeSchema,
	projectPath: z.string().optional(),
	projectSlug: z.string().optional(),
	note: z.string().optional()
});

const publicBuildPaths = new Set([
	'/api/build/start'
]);

function authorizeBuildRequest(request: FastifyRequest, reply: FastifyReply): void {
	if (!config.agentApiToken) {
		return;
	}
	const authorization = request.headers.authorization;
	if (authorization !== `Bearer ${config.agentApiToken}`) {
		reply.code(401);
		throw new Error('Invalid agent API token');
	}
}

function isPublicBuildPath(path: string): boolean {
	if (publicBuildPaths.has(path)) {
		return true;
	}
	return /^\/api\/build\/[^/]+\/(status|logs|download)$/.test(path);
}

export async function registerBuildRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		const path = request.url.split('?')[0] ?? request.url;
		if (!path.startsWith('/api/build')) {
			return;
		}
		if (config.publicChatEnabled && isPublicBuildPath(path)) {
			return;
		}
		authorizeBuildRequest(request, reply);
	});

	app.post('/api/build/start', async request => {
		const body = startBuildSchema.parse(request.body);
		try {
			const status = startBuild(body);
			return { ok: true, buildId: status.buildId, status: status.status, type: status.type };
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			};
		}
	});

	app.get('/api/build/:id/status', async request => {
		const params = z.object({ id: z.string().min(1) }).parse(request.params);
		const status = getBuildStatus(params.id);
		if (!status) {
			return { ok: false, message: 'Build not found' };
		}
		return status;
	});

	app.get('/api/build/:id/logs', async (request, reply) => {
		const params = z.object({ id: z.string().min(1) }).parse(request.params);
		const query = z.object({ offset: z.coerce.number().int().min(0).optional() }).parse(request.query);
		const buildId = params.id;
		const accept = request.headers.accept ?? '';

		if (accept.includes('text/event-stream')) {
			reply.raw.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			});

			let offset = query.offset ?? 0;
			const sendChunk = (): void => {
				const chunk = readBuildLogs(buildId, offset);
				if (!chunk) {
					reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'Build not found' })}\n\n`);
					reply.raw.end();
					return;
				}
				if (chunk.lines) {
					reply.raw.write(`event: log\ndata: ${JSON.stringify({ text: chunk.lines })}\n\n`);
				}
				offset = chunk.offset;
				if (chunk.done) {
					reply.raw.write(`event: done\ndata: ${JSON.stringify({ offset })}\n\n`);
					reply.raw.end();
					unsubscribe();
					clearInterval(pollTimer);
				}
			};

			const unsubscribe = subscribeBuildLogs(buildId, text => {
				reply.raw.write(`event: log\ndata: ${JSON.stringify({ text })}\n\n`);
			});

			sendChunk();
			const pollTimer = setInterval(sendChunk, 1500);

			request.raw.on('close', () => {
				clearInterval(pollTimer);
				unsubscribe();
			});
			return reply;
		}

		const chunk = readBuildLogs(buildId, query.offset ?? 0);
		if (!chunk) {
			return { ok: false, message: 'Build not found' };
		}
		return { ok: true, buildId, ...chunk };
	});

	app.get('/api/build/:id/download', async (request, reply) => {
		const params = z.object({ id: z.string().min(1) }).parse(request.params);
		const artifact = getArtifactFilePath(params.id);
		if (!artifact) {
			return reply.code(404).send({ ok: false, message: 'Artifact not available' });
		}
		const stream = fs.createReadStream(artifact.filePath);
		return reply
			.header('Content-Disposition', `attachment; filename="${artifact.artifactName}"`)
			.type('application/octet-stream')
			.send(stream);
	});
}
