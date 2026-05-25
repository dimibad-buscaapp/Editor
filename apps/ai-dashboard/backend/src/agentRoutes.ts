import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { agentConfigs, createChatCompletion, createChatCompletionDetailed, type AgentModel, type ChatMessage } from './ai.js';
import {
	approveAgentJob,
	continueAgentJob,
	executePlanJob,
	getAgentActionRun,
	getAgentJobSnapshot,
	getAgentJobSnapshotAsync,
	rejectAgentJob,
	startAgentJob
} from './agentJob/runner.js';
import { generateComposerPlan, parseComposerPlan as parseComposerPlanFromService } from './composerPlanService.js';
import { getBuildJob, startBuildJob } from './builderService.js';
import { generateAgentChatCore, handleAgentChat } from './agentChatService.js';
import { indexEditorProject } from './workspaceIndexer.js';
import { buildAgentChatResponse, formatIntelligenceStatus } from './agentMetadata.js';
import { getCompileJobStatus } from './compileService.js';
import { listSegmentEngines } from './orchestrator/engines.js';
import type { ModelSegment } from './orchestrator/types.js';
import { config } from './config.js';
import { readRuntimeLogs } from './editorRuntimeLog.js';
import { probeEditorStack } from './editorProbes.js';
import { runStarterChecklist, streamStarterChecklist } from './starterCheck.js';
import { buildRagSystemPrompt, indexAgentFile, retrieveAgentRelevantChunks } from './rag.js';
import { getMemoryContextForWorkspace, resolveWorkspaceId } from './memoryGraph/memoryGraphService.js';
import { getSwarmGraph, startSwarmJob } from './swarm/swarmOrchestrator.js';
import { listActiveJobs } from './agentJob/store.js';

const agentModelSchema = z.enum(['princy', 'deepseek', 'qwen', 'codellama', 'llama3', 'mistral', 'openai']);
const segmentSchema = z.enum(['LOGIC', 'FRONTEND', 'BACKEND', 'DEBUG']);

const inlineEditSchema = z.object({
	agent: agentModelSchema.default('princy'),
	instruction: z.string().min(1).max(4000),
	selectedText: z.string().min(1),
	languageId: z.string().min(1).max(80),
	filePath: z.string().min(1),
	shadowContext: z.unknown().optional(),
	codeGraph: z.unknown().optional()
});

const inlineCompleteSchema = z.object({
	agent: agentModelSchema.default('princy'),
	filePath: z.string().min(1),
	languageId: z.string().min(1).max(80),
	prefix: z.string().max(16000),
	suffix: z.string().max(4000).optional().default(''),
	linePrefix: z.string().max(500).optional().default('')
});

const chatSchema = z.object({
	agent: agentModelSchema.default('princy'),
	segment: segmentSchema.optional(),
	force_segment: segmentSchema.optional(),
	context: z.string().max(200).optional(),
	priority: z.enum(['normal', 'high']).default('normal'),
	stream: z.boolean().optional(),
	trigger_compile: z.boolean().optional(),
	async: z.boolean().optional(),
	message: z.string().min(1).max(12000),
	filePath: z.string().optional(),
	selectedText: z.string().optional(),
	shadowContext: z.unknown().optional(),
	codeGraph: z.unknown().optional(),
	contextAttachments: z.array(z.object({
		kind: z.string(),
		label: z.string(),
		content: z.string()
	})).optional(),
	rulesText: z.string().max(50000).optional(),
	mode: z.enum(['chat', 'composer', 'agent', 'builder', 'plan']).optional(),
	actionOnlyExplain: z.boolean().optional(),
	skipPostApply: z.boolean().optional(),
	workspaceId: z.string().optional()
});

const buildTargetSchema = z.enum(['web', 'api', 'exe', 'apk']);

const buildRequestSchema = z.object({
	target: buildTargetSchema,
	workspaceRoot: z.string().optional(),
	priority: z.enum(['normal', 'high']).optional()
});

const continueJobSchema = z.object({
	applied: z.boolean(),
	paths: z.array(z.string()).optional()
});

const indexFileSchema = z.object({
	filePath: z.string().min(1),
	languageId: z.string().min(1).max(80),
	content: z.string()
});

const indexBatchSchema = z.object({
	files: z.array(z.object({
		filePath: z.string().min(1),
		languageId: z.string().min(1).max(80),
		content: z.string()
	})).min(1).max(32)
});

const composerOperationSchema = z.discriminatedUnion('type', [
	z.object({
		id: z.string().optional(),
		type: z.literal('create'),
		filePath: z.string().min(1),
		content: z.string(),
		rationale: z.string().optional()
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('modify'),
		filePath: z.string().min(1),
		search: z.string().optional(),
		replace: z.string().optional(),
		content: z.string().optional(),
		rationale: z.string().optional()
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('delete'),
		filePath: z.string().min(1),
		rationale: z.string().optional()
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('runCommand'),
		command: z.string().min(1),
		rationale: z.string().optional()
	})
]);

const composerPlanSchema = z.object({
	summary: z.string().min(1),
	warnings: z.array(z.string()).default([]),
	affectedFiles: z.array(z.string()).default([]),
	operations: z.array(composerOperationSchema).default([])
});

const composerPlanRequestSchema = z.object({
	agent: agentModelSchema.default('princy'),
	instruction: z.string().min(1).max(12000),
	shadowContext: z.unknown().optional(),
	codeGraph: z.unknown().optional()
});

const repairAfterCommandSchema = z.object({
	agent: agentModelSchema.default('princy'),
	originalInstruction: z.string().min(1).max(12000),
	previousPlan: composerPlanSchema,
	commandResult: z.object({
		command: z.string(),
		exitCode: z.number().optional(),
		output: z.string()
	}),
	shadowContext: z.unknown().optional(),
	codeGraph: z.unknown().optional()
});

const swarmRequestSchema = chatSchema.extend({
	concurrency: z.number().int().min(1).max(8).optional()
});

const openAiChatMessageSchema = z.object({
	role: z.enum(['system', 'user', 'assistant']),
	content: z.union([
		z.string(),
		z.array(z.object({
			type: z.string(),
			text: z.string().optional()
		}))
	])
});

const openAiChatCompletionSchema = z.object({
	model: z.string().min(1).default('deepseek'),
	messages: z.array(openAiChatMessageSchema).min(1),
	stream: z.boolean().optional()
});

const publicAgentPathsWhenDashboardChat = new Set([
	'/api/agent/health',
	'/api/agent/bootstrap',
	'/api/agent/models',
	'/api/agent/chat',
	'/api/agent/chat/stream',
	'/api/agent/composer-plan',
	'/api/agent/jobs',
	'/api/agent/build',
	'/api/agent/swarm'
]);

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		const path = request.url.split('?')[0] ?? request.url;
		if (path === '/api/agent/health' || path === '/api/agent/bootstrap' || path.startsWith('/api/editor/')) {
			return;
		}
		if (config.publicChatEnabled && (
			publicAgentPathsWhenDashboardChat.has(path) ||
			path.startsWith('/api/agent/jobs/') ||
			path.startsWith('/api/agent/swarm/')
		)) {
			return;
		}
		if (request.url.startsWith('/api/agent/') || request.url.startsWith('/v1/')) {
			authorizeAgentRequest(request, reply);
		}
	});

	app.get('/api/agent/bootstrap', async () => ({
		ok: true,
		publicChat: config.publicChatEnabled,
		needsToken: Boolean(config.agentApiToken) && !config.publicChatEnabled,
		defaultAgent: 'princy',
		simpleMode: config.simpleMode,
		aiProvider: config.aiProvider,
		chatModel: config.aiProvider === 'groq' ? config.groqChatModel : config.ollamaChatModel,
		streamPath: '/api/agent/chat/stream',
		chatPath: '/api/agent/chat',
		features: {
			durableJobs: config.agentJobsPersisted,
			planMode: true,
			reviewerAgent: config.reviewerEnabled,
			memoryGraph: config.memoryGraphEnabled,
			swarm: config.swarmEnabled
		}
	}));

	app.get('/api/agent/health', async () => {
		const productionOrigin = config.appOrigin.startsWith('https://')
			&& !config.corsRelaxed
			&& config.apiHost !== '127.0.0.1';
		return {
			ok: true,
			service: 'princy-agent-api',
			build: '2026-05-swarm',
			port: config.apiPort,
			cors: config.corsRelaxed ? 'relaxed' : 'dynamic',
			streamJobs: config.agentAsyncJobsEnabled,
			durableJobs: config.agentJobsPersisted,
			swarmEnabled: config.swarmEnabled,
			activeJobs: listActiveJobs().length,
			environment: productionOrigin ? 'production' : 'development',
			appOrigin: config.appOrigin,
			codeWebUrl: config.codeWebUrl,
			publicChat: config.publicChatEnabled,
			simpleMode: config.simpleMode
		};
	});

	app.get('/api/editor/runtime-log', async (request) => {
		const query = request.query as { lines?: string };
		const lines = Math.min(200, Math.max(10, Number(query.lines ?? 80) || 80));
		return readRuntimeLogs(lines);
	});

	app.get('/api/editor/stack-probes', async () => probeEditorStack());

	app.get('/api/editor/starter-check', async () => runStarterChecklist());

	app.get('/api/editor/starter-check/stream', async (_request, reply) => {
		reply.hijack();
		reply.raw.writeHead(200, {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		});
		try {
			for await (const chunk of streamStarterChecklist()) {
				reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			reply.raw.write(`data: ${JSON.stringify({ type: 'error', data: { message } })}\n\n`);
		}
		reply.raw.end();
	});

	app.get('/api/agent/models', async () => {
		return {
			models: Object.values(agentConfigs).map(agent => ({
				id: agent.id,
				label: agent.label,
				modelName: agent.modelName,
				isLocal: agent.isLocal,
				orchestrator: agent.id === 'princy' || agent.id === 'deepseek'
			}))
		};
	});

	app.get('/api/agent/orchestrator/segments', async () => {
		return {
			enabled: config.orchestratorEnabled,
			consensusEnabled: config.orchestratorConsensusEnabled,
			segments: listSegmentEngines()
		};
	});

	app.post('/api/agent/inline-complete', async request => {
		const body = inlineCompleteSchema.parse(request.body);
		const raw = await createChatCompletion([
			{
				role: 'system',
				content: [
					'Voce completa codigo no cursor dentro do Princy Ai.',
					'Retorne SOMENTE o texto a inserir imediatamente apos o cursor.',
					'Nao repita codigo ja escrito antes do cursor.',
					'Sem Markdown, sem crases, sem explicacao.',
					'Prefira ate 6 linhas curtas.'
				].join('\n')
			},
			{
				role: 'user',
				content: [
					`Arquivo: ${body.filePath}`,
					`Linguagem: ${body.languageId}`,
					`Linha atual (prefixo parcial): ${body.linePrefix || '(vazio)'}`,
					'Codigo antes do cursor:',
					body.prefix,
					'Codigo depois do cursor:',
					body.suffix || '(fim do arquivo)'
				].join('\n\n')
			}
		], body.agent, {
			filePath: body.filePath,
			languageId: body.languageId,
			useOrchestrator: false,
			maxTokens: 120,
			temperature: 0.15
		});

		return {
			completion: normalizeInlineCompletion(raw, body.prefix, body.linePrefix ?? '')
		};
	});

	app.post('/api/agent/inline-edit', async request => {
		const body = inlineEditSchema.parse(request.body);
		const replacement = await createChatCompletion([
			{
				role: 'system',
				content: [
					'Voce e um agente de edicao de codigo dentro do Princy Ai Code-OSS Web.',
					'Retorne somente o codigo final que deve substituir a selecao do usuario.',
					'Nao use Markdown, nao use crases e nao explique a alteracao.'
				].join('\n')
			},
			{
				role: 'user',
				content: [
					`Arquivo: ${body.filePath}`,
					`Linguagem: ${body.languageId}`,
					`Instrucao: ${body.instruction}`,
					'Codigo selecionado:',
					body.selectedText,
					buildSilentContext(body.shadowContext, body.codeGraph)
				].join('\n\n')
			}
		], body.agent, {
			filePath: body.filePath,
			languageId: body.languageId
		});

		return {
			replacement: stripCodeFence(replacement),
			explanation: 'Revise a substituicao antes de aplicar.'
		};
	});

	app.get('/api/agent/compile-status/:jobId', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		const status = getCompileJobStatus(params.jobId);
		if (!status) {
			return { ok: false, message: 'Compile job not found' };
		}
		return { ok: true, ...status };
	});

	app.get('/api/agent/jobs/', async (_request, reply) => {
		return reply.code(400).send({
			ok: false,
			message: 'Missing jobId in URL',
			hint: 'POST /api/agent/jobs first, then GET /api/agent/jobs/{jobId} using the jobId from the response',
			example: 'Invoke-RestMethod http://127.0.0.1:3210/api/agent/jobs/{jobId}'
		});
	});

	app.post('/api/agent/jobs', async (request, reply) => {
		const body = chatSchema.parse(request.body);
		const snapshot = startAgentJob({
			agent: body.agent,
			message: body.message,
			context: body.context,
			force_segment: (body.force_segment ?? body.segment) as ModelSegment | undefined,
			priority: body.priority,
			trigger_compile: body.trigger_compile,
			filePath: body.filePath,
			selectedText: body.selectedText,
			shadowContext: body.shadowContext,
			codeGraph: body.codeGraph,
			mode: body.mode,
			actionOnlyExplain: body.actionOnlyExplain ?? body.mode === 'chat',
			skipPostApply: body.skipPostApply,
			rulesText: body.rulesText
		});

		if (!snapshot.jobId?.trim()) {
			request.log.error({ snapshot }, 'startAgentJob returned empty jobId');
			return reply.code(500).send({
				ok: false,
				message: 'Failed to create agent job (empty jobId)'
			});
		}

		request.log.info({ jobId: snapshot.jobId, state: snapshot.state }, 'agent job created');

		return {
			ok: true,
			jobId: snapshot.jobId,
			id: snapshot.jobId,
			state: snapshot.state,
			status: 'IN_PROGRESS',
			plan: snapshot.plan,
			thinkingLog: snapshot.thinkingLog
		};
	});

	app.post('/api/agent/jobs/:jobId/execute-plan', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		return executePlanJob(params.jobId);
	});

	app.get('/api/agent/jobs/:jobId', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		const snapshot = await getAgentJobSnapshotAsync(params.jobId);
		if (!snapshot) {
			return { ok: false, message: 'Agent job not found' };
		}

		const actionRun = getAgentActionRun(params.jobId);

		return {
			ok: true,
			...snapshot,
			actionRun,
			intelligence_status: snapshot.response
				? formatIntelligenceStatus(snapshot.response.metadata)
				: `[Princy IA] ${snapshot.state} | ${snapshot.status}`
		};
	});

	app.post('/api/agent/jobs/:jobId/approve', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		return approveAgentJob(params.jobId);
	});

	app.post('/api/agent/jobs/:jobId/reject', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		return rejectAgentJob(params.jobId);
	});

	app.post('/api/agent/jobs/:jobId/continue', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		const body = continueJobSchema.parse(request.body ?? {});
		return continueAgentJob(params.jobId, body);
	});

	app.post('/api/agent/build', async request => {
		const body = buildRequestSchema.parse(request.body);
		try {
			const snapshot = startBuildJob(body.target, body.workspaceRoot);
			return { ok: true, ...snapshot };
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			};
		}
	});

	app.get('/api/agent/build/:jobId', async request => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		const snapshot = getBuildJob(params.jobId);
		if (!snapshot) {
			return { ok: false, message: 'Build job not found' };
		}
		return { ok: true, ...snapshot };
	});

	app.get('/api/agent/jobs/:jobId/stream', async (request, reply) => {
		const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
		let lastContent = '';
		let lastState = '';
		let lastPhase = '';
		let lastPlanJson = '';
		let lastPlanDagJson = '';
		let lastReviewerJson = '';

		reply.raw.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		});

		const send = (payload: unknown) => {
			reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
		};

		const poll = async () => {
			const snapshot = await getAgentJobSnapshotAsync(params.jobId);
			const actionRun = getAgentActionRun(params.jobId);
			if (!snapshot) {
				send({ type: 'error', message: 'Agent job not found' });
				reply.raw.end();
				return;
			}

			if (snapshot.state !== lastState) {
				send({ type: 'state', state: snapshot.state, status: snapshot.status });
				lastState = snapshot.state;
			}

			if (actionRun && actionRun.phase !== lastPhase) {
				send({ type: 'phase', phase: actionRun.phase, actionRun });
				lastPhase = actionRun.phase;
			}

			if (snapshot.composerPlan) {
				const planJson = JSON.stringify(snapshot.composerPlan);
				if (planJson !== lastPlanJson) {
					send({
						type: 'composerPlan',
						plan: snapshot.composerPlan,
						affectedFiles: snapshot.composerPlan.affectedFiles
					});
					lastPlanJson = planJson;
				}
			}

			if (snapshot.planDag) {
				const dagJson = JSON.stringify(snapshot.planDag);
				if (dagJson !== lastPlanDagJson) {
					send({ type: 'planDag', planDag: snapshot.planDag });
					lastPlanDagJson = dagJson;
				}
			}

			if (snapshot.reviewerReport) {
				const revJson = JSON.stringify(snapshot.reviewerReport);
				if (revJson !== lastReviewerJson) {
					send({ type: 'reviewerReport', reviewerReport: snapshot.reviewerReport });
					lastReviewerJson = revJson;
				}
			}

			if (snapshot.swarmJobId) {
				send({ type: 'swarmRef', swarmJobId: snapshot.swarmJobId });
			}

			if (actionRun?.tasks?.length) {
				send({ type: 'tasks', tasks: actionRun.tasks });
			}

			if (snapshot.content !== lastContent) {
				send({ type: 'delta', text: snapshot.content });
				lastContent = snapshot.content;
			}

			if (snapshot.state === 'AWAITING_APPROVAL') {
				if (snapshot.mode === 'plan' || snapshot.planOnly) {
					send({
						type: 'done',
						response: snapshot.response ?? {
							content: snapshot.content,
							message: snapshot.content,
							plan: snapshot.plan,
							metadata: {
								segment_used: 'LOGIC',
								primary_engine: 'planner',
								fallback_engines: [],
								execution_time: '0.0s',
								status: 'COMPLETED',
								vps_compile_status: 'SKIPPED',
								consensus_applied: false,
								phase: 'completed',
								timestamp: Date.now()
							}
						},
						actionRun,
						resultSummary: snapshot.resultSummary,
						planDag: snapshot.planDag
					});
					reply.raw.end();
					return;
				}
				setTimeout(() => void poll(), 180);
				return;
			}

			if (snapshot.response && (snapshot.status === 'COMPLETED' || snapshot.state === 'SUCCESS')) {
				send({
					type: 'done',
					response: snapshot.response,
					actionRun,
					resultSummary: snapshot.resultSummary,
					intelligence_status: formatIntelligenceStatus(snapshot.response.metadata)
				});
				reply.raw.end();
				return;
			}

			if (snapshot.status === 'FAILED' || snapshot.state === 'FAILED') {
				send({ type: 'error', message: snapshot.error ?? 'Agent job failed', actionRun });
				reply.raw.end();
				return;
			}

			setTimeout(poll, 180);
		};

		void poll();
	});

	app.post('/api/agent/swarm', async (request, reply) => {
		if (!config.swarmEnabled) {
			return reply.code(503).send({ ok: false, message: 'Swarm desativado (PRINCY_SWARM_ENABLED=false)' });
		}
		const body = swarmRequestSchema.parse(request.body);
		const graph = await startSwarmJob({
			agent: body.agent,
			message: body.message,
			context: body.context,
			force_segment: (body.force_segment ?? body.segment) as ModelSegment | undefined,
			priority: body.priority,
			trigger_compile: body.trigger_compile,
			filePath: body.filePath,
			selectedText: body.selectedText,
			shadowContext: body.shadowContext,
			codeGraph: body.codeGraph,
			rulesText: body.rulesText,
			workspaceId: body.workspaceId
		}, body.concurrency ?? config.swarmConcurrency);
		return { ok: true, swarmJobId: graph.swarmJobId, graph };
	});

	app.get('/api/agent/swarm/:swarmJobId/graph', async request => {
		const params = z.object({ swarmJobId: z.string().min(1) }).parse(request.params);
		const graph = await getSwarmGraph(params.swarmJobId);
		if (!graph) {
			return { ok: false, message: 'Swarm job not found' };
		}
		return { ok: true, graph };
	});

	app.get('/api/agent/swarm/:swarmJobId/stream', async (request, reply) => {
		const params = z.object({ swarmJobId: z.string().min(1) }).parse(request.params);
		let lastGraphJson = '';

		reply.raw.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		});

		const send = (payload: unknown) => {
			reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
		};

		const poll = async () => {
			const graph = await getSwarmGraph(params.swarmJobId);
			if (!graph) {
				send({ type: 'error', message: 'Swarm job not found' });
				reply.raw.end();
				return;
			}

			const graphJson = JSON.stringify(graph);
			if (graphJson !== lastGraphJson) {
				send({ type: 'swarmGraph', graph });
				lastGraphJson = graphJson;
			}

			if (graph.status === 'COMPLETED' || graph.status === 'FAILED') {
				send({ type: 'done', graph });
				reply.raw.end();
				return;
			}

			setTimeout(() => void poll(), 400);
		};

		void poll();
	});

	app.get('/api/agent/memory/:workspaceId', async request => {
		const params = z.object({ workspaceId: z.string().min(1) }).parse(request.params);
		const context = await getMemoryContextForWorkspace(params.workspaceId, 30);
		return { ok: true, workspaceId: params.workspaceId, context };
	});

	app.post('/api/agent/index-workspace', async () => {
		const indexedFiles = await indexEditorProject(config.projectRagMaxFiles);
		return {
			ok: true,
			indexedFiles,
			workspace: config.agentWorkspaceName
		};
	});

	app.post('/api/agent/chat', async request => {
		const body = chatSchema.parse(request.body);

		if (body.async === true) {
			const snapshot = startAgentJob({
				agent: body.agent,
				message: body.message,
				context: body.context,
				force_segment: (body.force_segment ?? body.segment) as ModelSegment | undefined,
				priority: body.priority,
				trigger_compile: body.trigger_compile,
				filePath: body.filePath,
				selectedText: body.selectedText,
				shadowContext: body.shadowContext,
				codeGraph: body.codeGraph,
				mode: body.mode,
				actionOnlyExplain: body.actionOnlyExplain ?? body.mode === 'chat',
				skipPostApply: body.skipPostApply,
				rulesText: body.rulesText
			});

			return {
				jobId: snapshot.jobId,
				state: snapshot.state,
				status: 'IN_PROGRESS',
				plan: snapshot.plan,
				content: '',
				metadata: {
					segment_used: (body.force_segment ?? body.segment ?? 'BACKEND') as ModelSegment,
					primary_engine: 'orchestrator',
					fallback_engines: [],
					execution_time: '0.0s',
					status: 'COMPLETED',
					vps_compile_status: 'PENDING',
					consensus_applied: false,
					phase: 'processing',
					timestamp: Date.now()
				},
				thinkingLog: snapshot.thinkingLog,
				intelligence_status: `[Princy IA] 🧠 Job ${snapshot.jobId} | Estado: ${snapshot.state}`
			};
		}

		const response = await handleAgentChat({
			agent: body.agent,
			message: body.message,
			context: body.context,
			force_segment: (body.force_segment ?? body.segment) as ModelSegment | undefined,
			priority: body.priority,
			trigger_compile: body.trigger_compile,
			filePath: body.filePath,
			selectedText: body.selectedText,
			shadowContext: body.shadowContext,
			codeGraph: body.codeGraph
		});

		return {
			...response,
			intelligence_status: formatIntelligenceStatus(response.metadata)
		};
	});

	app.post('/api/agent/chat/stream', async (request, reply) => {
		const body = chatSchema.parse(request.body);
		const startedAt = Date.now();

		const writeSse = (payload: unknown) => {
			reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
		};

		try {
			reply.hijack();
			reply.raw.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			});

			let fullText = '';
			const { segment, completion } = await generateAgentChatCore({
				agent: body.agent,
				message: body.message,
				context: body.context,
				force_segment: (body.force_segment ?? body.segment) as ModelSegment | undefined,
				priority: body.priority,
				filePath: body.filePath,
				selectedText: body.selectedText,
				shadowContext: body.shadowContext,
				codeGraph: body.codeGraph,
				stream: true
			}, full => {
				fullText = full;
				writeSse({ type: 'delta', text: full });
			});

			const response = buildAgentChatResponse({
				completion,
				executionTimeMs: Date.now() - startedAt,
				segment,
				vpsCompileStatus: 'SKIPPED',
				phase: 'completed',
				suggestedCommands: extractCommands(fullText || completion.content)
			});

			writeSse({ type: 'metadata', metadata: response.metadata });
			writeSse({ type: 'message', text: response.content });
			writeSse({ type: 'intelligence_status', text: formatIntelligenceStatus(response.metadata) });
			writeSse({ type: 'done' });
			reply.raw.end();
		} catch (error) {
			const message = formatAgentChatError(error);
			request.log.error({ err: error }, 'agent chat stream failed');
			if (!reply.raw.headersSent) {
				return reply.code(503).send({ message });
			}
			writeSse({ type: 'error', text: message });
			writeSse({ type: 'done' });
			reply.raw.end();
		}
	});

	app.get('/v1/models', async () => {
		return {
			object: 'list',
			data: Object.values(agentConfigs).map(agent => ({
				id: agent.id,
				object: 'model',
				created: 0,
				owned_by: agent.isLocal ? 'princy-ai-local' : 'princy-ai-cloud',
				label: agent.label,
				model_name: agent.modelName
			}))
		};
	});

	app.post('/v1/chat/completions', async (request, reply) => {
		const body = openAiChatCompletionSchema.parse(request.body);
		const agent = resolveAgentModel(body.model);
		const messages = body.messages.map(toChatMessage);
		const content = await createChatCompletion(messages, agent);
		const id = `chatcmpl-princy-${Date.now()}`;
		const created = Math.floor(Date.now() / 1000);

		if (body.stream) {
			reply.raw.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			});
			reply.raw.write(`data: ${JSON.stringify({
				id,
				object: 'chat.completion.chunk',
				created,
				model: agent,
				choices: [
					{
						index: 0,
						delta: {
							role: 'assistant',
							content
						},
						finish_reason: null
					}
				]
			})}\n\n`);
			reply.raw.write(`data: ${JSON.stringify({
				id,
				object: 'chat.completion.chunk',
				created,
				model: agent,
				choices: [
					{
						index: 0,
						delta: {},
						finish_reason: 'stop'
					}
				]
			})}\n\n`);
			reply.raw.write('data: [DONE]\n\n');
			reply.raw.end();
			return;
		}

		return {
			id,
			object: 'chat.completion',
			created,
			model: agent,
			choices: [
				{
					index: 0,
					message: {
						role: 'assistant',
						content
					},
					finish_reason: 'stop'
				}
			],
			usage: {
				prompt_tokens: 0,
				completion_tokens: 0,
				total_tokens: 0
			}
		};
	});

	app.post('/api/agent/composer-plan', async request => {
		const body = composerPlanRequestSchema.parse(request.body);
		return generateComposerPlan(body);
	});

	app.post('/api/agent/repair-after-command', async request => {
		const body = repairAfterCommandSchema.parse(request.body);
		const response = await createChatCompletion([
			{
				role: 'system',
				content: [
					'Voce esta corrigindo uma mudanca Composer que falhou na verificacao.',
					'Retorne somente JSON valido no mesmo formato do ComposerPlan.',
					'Gere apenas as operacoes necessarias para corrigir o erro.'
				].join('\n\n')
			},
			{
				role: 'user',
				content: [
					`Pedido original: ${body.originalInstruction}`,
					`Plano anterior: ${JSON.stringify(body.previousPlan)}`,
					`Comando executado: ${body.commandResult.command}`,
					`Exit code: ${body.commandResult.exitCode ?? 'desconhecido'}`,
					`Saida:\n${body.commandResult.output}`,
					buildSilentContext(body.shadowContext, body.codeGraph)
				].join('\n\n')
			}
		], body.agent, {
			segment: 'DEBUG',
			useOrchestrator: true
		});

		return parseComposerPlanFromService(response);
	});

	app.post('/api/agent/index-file', async request => {
		const body = indexFileSchema.parse(request.body);
		const indexed = await indexAgentFile({
			workspaceName: config.agentWorkspaceName,
			filePath: body.filePath,
			content: `Linguagem: ${body.languageId}\n\n${body.content}`
		});

		return {
			ok: true,
			file: indexed
		};
	});

	app.post('/api/agent/index-batch', async request => {
		const body = indexBatchSchema.parse(request.body);
		let indexed = 0;
		for (const file of body.files) {
			await indexAgentFile({
				workspaceName: config.agentWorkspaceName,
				filePath: file.filePath,
				content: `Linguagem: ${file.languageId}\n\n${file.content}`
			});
			indexed++;
		}
		return { ok: true, indexed };
	});
}

function authorizeAgentRequest(request: FastifyRequest, reply: FastifyReply): void {
	if (!config.agentApiToken) {
		return;
	}

	const authorization = request.headers.authorization;
	if (authorization !== `Bearer ${config.agentApiToken}`) {
		reply.code(401);
		throw new Error('Invalid agent API token');
	}
}

function stripCodeFence(value: string): string {
	const trimmed = value.trim();
	const match = /^```(?:\w+)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
	return match ? match[1] : trimmed;
}

function normalizeInlineCompletion(raw: string, prefix: string, linePrefix: string): string {
	let completion = stripCodeFence(raw).replace(/^\s+/, '');
	if (!completion) {
		return '';
	}

	const tail = prefix.slice(-Math.min(prefix.length, 200));
	if (completion.startsWith(tail) && tail.length > 0) {
		completion = completion.slice(tail.length);
	}

	if (linePrefix && completion.startsWith(linePrefix) && linePrefix.length > 2) {
		completion = completion.slice(linePrefix.length);
	}

	const firstNewline = completion.indexOf('\n\n');
	if (firstNewline >= 0 && firstNewline < completion.length - 2) {
		completion = completion.slice(0, firstNewline + 1);
	}

	return completion.replace(/\r\n/g, '\n');
}

function formatAgentChatError(error: unknown): string {
	const detail = error instanceof Error ? error.message : String(error);
	const lower = detail.toLowerCase();
	if (lower.includes('econnrefused') || lower.includes('fetch failed') || lower.includes('ollama')) {
		return 'Ollama offline ou modelo ausente. No VPS: instale Ollama, rode "ollama pull deepseek-coder" e confirme http://127.0.0.1:11434';
	}
	if (lower.includes('openai_api_key')) {
		return 'OPENAI_API_KEY ausente no .env do backend.';
	}
	return detail || 'Falha ao gerar resposta do agente';
}

function extractCommands(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(line => line.startsWith('COMMAND:'))
		.map(line => line.replace(/^COMMAND:\s*/, ''))
		.filter(Boolean);
}

function buildSilentContext(shadowContext: unknown, codeGraph: unknown): string {
	const parts: string[] = [];
	if (shadowContext) {
		parts.push(`\n\n[CONTEXTO SILENCIOSO]\n${JSON.stringify(shadowContext).slice(0, 50000)}`);
	}
	if (codeGraph) {
		parts.push(`\n\n[CODE GRAPH]\n${JSON.stringify(codeGraph).slice(0, 20000)}`);
	}
	return parts.join('');
}

function resolveAgentModel(model: string): AgentModel {
	const normalized = model.toLowerCase();
	if (normalized in agentConfigs) {
		return normalized as AgentModel;
	}

	if (normalized.includes('deepseek')) {
		return 'deepseek';
	}
	if (normalized.includes('qwen')) {
		return 'qwen';
	}
	if (normalized.includes('codellama') || normalized.includes('code-llama')) {
		return 'codellama';
	}
	if (normalized.includes('llama')) {
		return 'llama3';
	}
	if (normalized.includes('mistral')) {
		return 'mistral';
	}
	if (normalized.includes('openai') || normalized.includes('gpt')) {
		return 'openai';
	}

	return 'deepseek';
}

function toChatMessage(message: z.infer<typeof openAiChatMessageSchema>): ChatMessage {
	const content = typeof message.content === 'string'
		? message.content
		: message.content
			.map(part => part.text)
			.filter((text): text is string => Boolean(text))
			.join('\n');

	return {
		role: message.role,
		content
	};
}
