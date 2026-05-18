import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { agentConfigs, createChatCompletion } from './ai.js';
import { config } from './config.js';
import { buildRagSystemPrompt, indexAgentFile, retrieveAgentRelevantChunks } from './rag.js';

const agentModelSchema = z.enum(['princy', 'deepseek', 'qwen', 'codellama', 'llama3', 'mistral', 'openai']);

const inlineEditSchema = z.object({
	agent: agentModelSchema.default('princy'),
	instruction: z.string().min(1).max(4000),
	selectedText: z.string().min(1),
	languageId: z.string().min(1).max(80),
	filePath: z.string().min(1)
});

const chatSchema = z.object({
	agent: agentModelSchema.default('princy'),
	message: z.string().min(1).max(12000),
	filePath: z.string().optional(),
	selectedText: z.string().optional()
});

const indexFileSchema = z.object({
	filePath: z.string().min(1),
	languageId: z.string().min(1).max(80),
	content: z.string()
});

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		if (request.url.startsWith('/api/agent/')) {
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
					body.selectedText
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
		const message = await createChatCompletion([
			{
				role: 'system',
				content: `${buildRagSystemPrompt(chunks)}\n\nAgente selecionado: ${agentConfigs[body.agent].label}.\nSe sugerir comandos de terminal, coloque cada comando em uma linha começando com COMMAND:.`
			},
			{
				role: 'user',
				content: `${body.filePath ? `Arquivo atual: ${body.filePath}\n\n` : ''}${body.message}${selectedContext}`
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
