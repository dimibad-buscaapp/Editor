import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createChatCompletion } from './ai.js';
import { clearSession, createSession, getAuthenticatedUser, hashPassword, requireAuthenticatedUser, verifyPassword } from './auth.js';
import { prisma } from './prisma.js';
import { buildRagSystemPrompt, indexWorkspaceFiles, retrieveRelevantChunks } from './rag.js';
import { config } from './config.js';
import { buildDiagnosticReport } from './diagnostic.js';
import { clearRequestLogs, getRecentRequestLogs } from './requestLog.js';
import { createWorkspaceRoot, listWorkspaceFiles, normalizeWorkspacePath, readWorkspaceFile, writeWorkspaceFile } from './storage.js';

const credentialsSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	name: z.string().min(1).max(120).optional()
});

const workspaceSchema = z.object({
	name: z.string().min(1).max(120)
});

const fileContentSchema = z.object({
	path: z.string().min(1),
	content: z.string()
});

const indexJobSchema = z.object({
	files: z.array(z.object({
		path: z.string().min(1),
		chunks: z.array(z.string()).optional(),
		chunkCount: z.number().int().min(0).optional()
	})).min(1)
});

const chatSchema = z.object({
	workspaceId: z.string().optional(),
	sessionId: z.string().optional(),
	message: z.string().min(1).max(12000)
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
	/** Metadados da API (nao use GET / — raiz serve o dashboard SPA quando dist/frontend existe). */
	app.get('/api/meta', async () => ({
		ok: true,
		service: 'Princy Ai Agent Backend',
		health: '/api/health',
		dashboard: '/#/login',
		logs: '/#/logs',
		models: '/api/agent/models',
		openAiCompatible: '/v1/models'
	}));

	app.get('/api/health', async () => ({
		ok: true,
		service: 'princy-agent-backend',
		build: '2026-05-fsm',
		features: {
			agentFsmJobs: true,
			projectRagIndexing: config.projectRagIndexingEnabled,
			testDrivenAgent: config.agentTestDrivenEnabled,
			asyncJobs: config.agentAsyncJobsEnabled
		}
	}));

	/** Diagnóstico público — use em https://dashboard.princyai.com/#/logs */
	app.get('/api/diagnostic', async () => buildDiagnosticReport());

	app.get('/api/logs', async () => ({
		entries: getRecentRequestLogs(100)
	}));

	app.post('/api/logs/clear', async () => {
		clearRequestLogs();
		return { ok: true };
	});

	app.post('/api/auth/register', async (request, reply) => {
		const body = credentialsSchema.parse(request.body);
		const email = body.email.toLowerCase();
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return reply.code(409).send({ message: 'Email already registered' });
		}

		const user = await prisma.user.create({
			data: {
				email,
				name: body.name ?? email.split('@')[0],
				passwordHash: await hashPassword(body.password)
			},
			select: {
				id: true,
				email: true,
				name: true
			}
		});

		await createSession(reply, user.id);
		return { user };
	});

	app.post('/api/auth/login', async (request, reply) => {
		const body = credentialsSchema.omit({ name: true }).parse(request.body);
		const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
		if (!user || !await verifyPassword(body.password, user.passwordHash)) {
			return reply.code(401).send({ message: 'Invalid credentials' });
		}

		await createSession(reply, user.id);
		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name
			}
		};
	});

	app.post('/api/auth/logout', async (request, reply) => {
		await clearSession(request, reply);
		return { ok: true };
	});

	app.get('/api/auth/me', async request => {
		return { user: await getAuthenticatedUser(request) };
	});

	app.get('/api/workspaces', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		return {
			workspaces: await prisma.workspace.findMany({
				where: { userId: user.id },
				orderBy: { updatedAt: 'desc' },
				select: {
					id: true,
					name: true,
					createdAt: true,
					updatedAt: true
				}
			})
		};
	});

	app.post('/api/workspaces', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		const body = workspaceSchema.parse(request.body);
		const workspace = await prisma.workspace.create({
			data: {
				userId: user.id,
				name: body.name,
				rootPath: ''
			}
		});

		try {
			const rootPath = await createWorkspaceRoot(user.id, workspace.id, workspace.name);
			const updatedWorkspace = await prisma.workspace.update({
				where: { id: workspace.id },
				data: { rootPath },
				select: {
					id: true,
					name: true,
					createdAt: true,
					updatedAt: true
				}
			});
			return reply.code(201).send({ workspace: updatedWorkspace });
		} catch (error) {
			await prisma.workspace.delete({ where: { id: workspace.id } });
			throw error;
		}
	});

	app.get('/api/workspaces/:workspaceId/files', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		const workspace = await getWorkspaceForUser(String((request.params as { workspaceId: string }).workspaceId), user.id, reply);
		return { files: await listWorkspaceFiles(workspace.rootPath) };
	});

	app.get('/api/workspaces/:workspaceId/files/content', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		const workspace = await getWorkspaceForUser(String((request.params as { workspaceId: string }).workspaceId), user.id, reply);
		const query = z.object({ path: z.string().min(1) }).parse(request.query);
		return {
			path: normalizeWorkspacePath(query.path),
			content: await readWorkspaceFile(workspace.rootPath, query.path)
		};
	});

	app.put('/api/workspaces/:workspaceId/files/content', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		const workspace = await getWorkspaceForUser(String((request.params as { workspaceId: string }).workspaceId), user.id, reply);
		const body = fileContentSchema.parse(request.body);
		const normalizedPath = normalizeWorkspacePath(body.path);
		const writtenFile = await writeWorkspaceFile(workspace.rootPath, normalizedPath, body.content);

		await prisma.workspaceFile.upsert({
			where: {
				workspaceId_path: {
					workspaceId: workspace.id,
					path: normalizedPath
				}
			},
			create: {
				workspaceId: workspace.id,
				path: normalizedPath,
				contentHash: writtenFile.contentHash,
				size: writtenFile.size
			},
			update: {
				contentHash: writtenFile.contentHash,
				size: writtenFile.size
			}
		});

		return { path: normalizedPath, ...writtenFile };
	});

	app.post('/api/workspaces/:workspaceId/index-jobs', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		const workspace = await getWorkspaceForUser(String((request.params as { workspaceId: string }).workspaceId), user.id, reply);
		const body = indexJobSchema.parse(request.body);

		const indexedFiles = await indexWorkspaceFiles(workspace, body.files.map(file => ({
			path: file.path,
			chunks: file.chunks
		})));

		return reply.code(201).send({ files: indexedFiles });
	});

	app.post('/api/chat', async (request, reply) => {
		const user = await requireAuthenticatedUser(request, reply);
		const body = chatSchema.parse(request.body);

		if (body.workspaceId) {
			await getWorkspaceForUser(body.workspaceId, user.id, reply);
		}

		const chatSession = body.sessionId
			? await prisma.chatSession.findFirstOrThrow({ where: { id: body.sessionId, userId: user.id } })
			: await prisma.chatSession.create({
				data: {
					userId: user.id,
					workspaceId: body.workspaceId,
					title: body.message.slice(0, 80)
				}
			});

		await prisma.chatMessage.create({
			data: {
				sessionId: chatSession.id,
				role: 'user',
				content: body.message
			}
		});

		const chunks = body.workspaceId ? await retrieveRelevantChunks(body.workspaceId, body.message) : [];
		const assistantContent = await createChatCompletion([
			{
				role: 'system',
				content: buildRagSystemPrompt(chunks)
			},
			{
				role: 'user',
				content: body.message
			}
		]);

		const assistantMessage = await prisma.chatMessage.create({
			data: {
				sessionId: chatSession.id,
				role: 'assistant',
				content: assistantContent
			}
		});

		return {
			sessionId: chatSession.id,
			message: assistantMessage
		};
	});
}

async function getWorkspaceForUser(workspaceId: string, userId: string, reply: FastifyReply): Promise<{ id: string; rootPath: string }> {
	const workspace = await prisma.workspace.findFirst({
		where: {
			id: workspaceId,
			userId
		},
		select: {
			id: true,
			rootPath: true
		}
	});

	if (!workspace) {
		reply.code(404);
		throw new Error('Workspace not found');
	}

	return workspace;
}
