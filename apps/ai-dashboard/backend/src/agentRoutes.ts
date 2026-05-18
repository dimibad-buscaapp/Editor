import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { agentConfigs, createChatCompletion, type AgentModel, type ChatMessage } from './ai.js';
import { config } from './config.js';
import { buildRagSystemPrompt, indexAgentFile, retrieveAgentRelevantChunks } from './rag.js';

const agentModelSchema = z.enum(['princy', 'deepseek', 'qwen', 'codellama', 'llama3', 'mistral', 'openai']);

const inlineEditSchema = z.object({
	agent: agentModelSchema.default('princy'),
	instruction: z.string().min(1).max(4000),
	selectedText: z.string().min(1),
	languageId: z.string().min(1).max(80),
	filePath: z.string().min(1),
	shadowContext: z.unknown().optional(),
	codeGraph: z.unknown().optional()
});

const chatSchema = z.object({
	agent: agentModelSchema.default('princy'),
	message: z.string().min(1).max(12000),
	filePath: z.string().optional(),
	selectedText: z.string().optional(),
	shadowContext: z.unknown().optional(),
	codeGraph: z.unknown().optional()
});

const indexFileSchema = z.object({
	filePath: z.string().min(1),
	languageId: z.string().min(1).max(80),
	content: z.string()
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
	model: z.string().min(1).default('princy'),
	messages: z.array(openAiChatMessageSchema).min(1),
	stream: z.boolean().optional()
});

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		if (request.url.startsWith('/api/agent/') || request.url.startsWith('/v1/')) {
			authorizeAgentRequest(request, reply);
		}
	});

	app.get('/api/agent/models', async () => {
		return {
			models: Object.values(agentConfigs).map(agent => ({
				id: agent.id,
				label: agent.label,
				modelName: agent.modelName,
				isLocal: agent.isLocal
			}))
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
		], body.agent);

		return {
			replacement: stripCodeFence(replacement),
			explanation: 'Revise a substituicao antes de aplicar.'
		};
	});

	app.post('/api/agent/chat', async request => {
		const body = chatSchema.parse(request.body);
		const chunks = await retrieveAgentRelevantChunks(body.message);
		const selectedContext = body.selectedText ? `\n\nSelecao atual:\n${body.selectedText}` : '';
		const silentContext = buildSilentContext(body.shadowContext, body.codeGraph);
		const message = await createChatCompletion([
			{
				role: 'system',
				content: `${buildRagSystemPrompt(chunks)}\n\nAgente selecionado: ${agentConfigs[body.agent].label}.\nSe sugerir comandos de terminal, coloque cada comando em uma linha começando com COMMAND:.`
			},
			{
				role: 'user',
				content: `${body.filePath ? `Arquivo atual: ${body.filePath}\n\n` : ''}${body.message}${selectedContext}${silentContext}`
			}
		], body.agent);

		return {
			message,
			suggestedCommands: extractCommands(message)
		};
	});

	app.post('/api/agent/chat/stream', async (request, reply) => {
		const body = chatSchema.parse(request.body);
		const chunks = await retrieveAgentRelevantChunks(body.message);
		const message = await createChatCompletion([
			{
				role: 'system',
				content: `${buildRagSystemPrompt(chunks)}\n\nAgente selecionado: ${agentConfigs[body.agent].label}.`
			},
			{
				role: 'user',
				content: body.message
			}
		], body.agent);

		reply.raw.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		});
		reply.raw.write(`data: ${JSON.stringify({ type: 'message', text: message })}\n\n`);
		reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
		reply.raw.end();
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
		const chunks = await retrieveAgentRelevantChunks(body.instruction);
		const response = await createChatCompletion([
			{
				role: 'system',
				content: [
					buildRagSystemPrompt(chunks),
					`Agente selecionado: ${agentConfigs[body.agent].label}.`,
					'Voce esta no Composer Mode. Retorne somente JSON valido, sem Markdown.',
					'O JSON deve seguir este formato:',
					'{"summary":"...","warnings":["..."],"affectedFiles":["src/a.ts"],"operations":[{"type":"modify","filePath":"src/a.ts","search":"codigo antigo","replace":"codigo novo","rationale":"..."}]}',
					'Use operacoes create, modify, delete e runCommand. Para modify, prefira search/replace pequeno em vez de arquivo inteiro.'
				].join('\n\n')
			},
			{
				role: 'user',
				content: `${body.instruction}${buildSilentContext(body.shadowContext, body.codeGraph)}`
			}
		], body.agent);

		return parseComposerPlan(response);
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
		], body.agent);

		return parseComposerPlan(response);
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

	return 'princy';
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

function parseComposerPlan(value: string): z.infer<typeof composerPlanSchema> {
	const json = extractJsonObject(value);
	const parsed = composerPlanSchema.parse(JSON.parse(json));
	return {
		...parsed,
		operations: parsed.operations.map((operation, index) => ({
			...operation,
			id: operation.id ?? `op-${index + 1}`
		}))
	};
}

function extractJsonObject(value: string): string {
	const trimmed = value.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
	const candidate = fenced?.[1] ?? trimmed;
	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('A IA nao retornou um plano Composer em JSON valido.');
	}
	return candidate.slice(start, end + 1);
}
