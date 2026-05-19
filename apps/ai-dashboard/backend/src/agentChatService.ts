import { agentConfigs, createChatCompletionDetailed, type AgentModel, type ChatMessage } from './ai.js';
import { buildAgentChatResponse, type AgentChatResponse } from './agentMetadata.js';
import { validateVpsEnvironment } from './compileService.js';
import { config } from './config.js';
import { buildRagSystemPrompt, retrieveAgentRelevantChunks } from './rag.js';
import { detectSegment, isHighComplexity } from './orchestrator/segments.js';
import { runDebugAutoHeal } from './orchestrator/orchestrator.js';
import type { ModelSegment } from './orchestrator/types.js';
import { generateExecutionPlan } from './planGenerator.js';

export type AgentChatRequest = {
	readonly agent: AgentModel;
	readonly message: string;
	readonly context?: string;
	readonly force_segment?: ModelSegment;
	readonly segment?: ModelSegment;
	readonly priority?: 'normal' | 'high';
	readonly stream?: boolean;
	readonly trigger_compile?: boolean;
	readonly filePath?: string;
	readonly selectedText?: string;
	readonly shadowContext?: unknown;
	readonly codeGraph?: unknown;
};

function resolveSegment(body: AgentChatRequest): ModelSegment {
	return body.force_segment ?? body.segment ?? detectSegment(
		body.message,
		body.filePath,
		body.shadowContext && typeof body.shadowContext === 'object' && body.shadowContext !== null && 'activeLanguageId' in body.shadowContext
			? String((body.shadowContext as { activeLanguageId?: string }).activeLanguageId ?? '')
			: undefined
	);
}

function buildMessages(body: AgentChatRequest, chunks: Awaited<ReturnType<typeof retrieveAgentRelevantChunks>>): ChatMessage[] {
	const selectedContext = body.selectedText ? `\n\nSelecao atual:\n${body.selectedText}` : '';
	const silentContext = buildSilentContext(body.shadowContext, body.codeGraph);
	const contextLine = body.context ? `Contexto do projeto: ${body.context}\n\n` : '';

	return [
		{
			role: 'system',
			content: `${buildRagSystemPrompt(chunks)}\n\nAgente selecionado: ${agentConfigs[body.agent].label}.\nSe sugerir comandos de terminal, coloque cada comando em uma linha começando com COMMAND:.`
		},
		{
			role: 'user',
			content: `${contextLine}${body.filePath ? `Arquivo atual: ${body.filePath}\n\n` : ''}${body.message}${selectedContext}${silentContext}`
		}
	];
}

export async function generateAgentChatCore(body: AgentChatRequest): Promise<{
	readonly startedAt: number;
	readonly segment: ModelSegment;
	readonly messages: ChatMessage[];
	readonly completion: Awaited<ReturnType<typeof createChatCompletionDetailed>>;
}> {
	const startedAt = Date.now();
	const segment = resolveSegment(body);
	const chunks = await retrieveAgentRelevantChunks(body.message);
	const messages = buildMessages(body, chunks);
	const completion = await createChatCompletionDetailed(messages, body.agent, {
		segment,
		filePath: body.filePath,
		languageId: body.shadowContext && typeof body.shadowContext === 'object' && body.shadowContext !== null && 'activeLanguageId' in body.shadowContext
			? String((body.shadowContext as { activeLanguageId?: string }).activeLanguageId ?? '')
			: undefined
	});

	return { startedAt, segment, messages, completion };
}

export async function handleAgentChat(body: AgentChatRequest, plan?: readonly string[]): Promise<AgentChatResponse> {
	const segment = resolveSegment(body);
	let executionPlan = plan;
	if (!executionPlan && isHighComplexity(body.message)) {
		executionPlan = await generateExecutionPlan({
			message: body.message,
			segment,
			agent: body.agent
		});
	}

	const { startedAt, completion: initialCompletion, messages } = await generateAgentChatCore(body);
	let completion = initialCompletion;

	let compileValidation = await validateVpsEnvironment({
		priority: body.priority,
		triggerCompile: body.trigger_compile
	});

	// Compilacao roda em background; o cliente faz polling via compile_job_id.

	if (config.orchestratorAutoHeal && compileValidation.status === 'FAILED' && !compileValidation.serverMainReady) {
		try {
			const compileOutput = compileValidation.output ?? 'server-main.js ausente ou Code Web indisponivel no VPS (porta 3200).';
			const healed = await runDebugAutoHeal({
				originalMessage: body.message,
				previousContent: completion.content,
				compileOutput,
				messages
			});

			completion = {
				content: `${completion.content}\n\n---\n## Auto-correcao DEBUG (Princy IA)\n\n${healed.content}`,
				orchestrator: {
					segment: healed.segment,
					enginesUsed: healed.enginesUsed,
					primaryEngine: healed.primaryEngine,
					fallbackEngines: healed.fallbackEngines,
					consensusApplied: healed.consensusApplied,
					status: healed.status,
					executionTimeMs: healed.executionTimeMs
				}
			};

			return buildAgentChatResponse({
				completion,
				executionTimeMs: Date.now() - startedAt,
				segment: healed.segment,
				vpsCompileStatus: compileValidation.status,
				phase: 'auto_healing',
				compileJobId: compileValidation.jobId,
				codeWebReachable: compileValidation.codeWebReachable,
				serverMainReady: compileValidation.serverMainReady,
				suggestedCommands: extractCommands(completion.content)
			});
		} catch (healError) {
			console.warn('[princy-ai] Auto-healing falhou:', healError instanceof Error ? healError.message : healError);
		}
	}

	const response = buildAgentChatResponse({
		completion,
		executionTimeMs: Date.now() - startedAt,
		segment,
		vpsCompileStatus: compileValidation.status,
		phase: compileValidation.status === 'COMPILING' ? 'compiling' : 'completed',
		compileJobId: compileValidation.jobId,
		codeWebReachable: compileValidation.codeWebReachable,
		serverMainReady: compileValidation.serverMainReady,
		suggestedCommands: extractCommands(completion.content)
	});

	return {
		...response,
		plan: executionPlan ? [...executionPlan] : undefined,
		jobStatus: 'COMPLETED'
	};
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

function extractCommands(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(line => line.startsWith('COMMAND:'))
		.map(line => line.replace(/^COMMAND:\s*/, ''))
		.filter(Boolean);
}
