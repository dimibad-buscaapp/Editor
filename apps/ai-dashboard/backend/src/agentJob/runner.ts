import { generateAgentChatCore, type AgentChatRequest } from '../agentChatService.js';
import { buildAgentChatResponse } from '../agentMetadata.js';
import { formatIntelligenceStatus } from '../agentMetadata.js';
import { config } from '../config.js';
import { getCompileJobStatus, validateVpsEnvironment } from '../compileService.js';
import { generateExecutionPlan } from '../planGenerator.js';
import { detectSegment } from '../orchestrator/segments.js';
import { runDebugAutoHeal } from '../orchestrator/orchestrator.js';
import type { ModelSegment } from '../orchestrator/types.js';
import { runProjectTests } from '../testRunner.js';
import { indexEditorProject } from '../workspaceIndexer.js';
import { appendThinking, createJob, getJob, toSnapshot, updateJob } from './store.js';
import type { AgentJobRecord, AgentJobSnapshot } from './types.js';

function newJobId(): string {
	return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function startAgentJob(request: AgentChatRequest): AgentJobSnapshot {
	const job = createJob({
		id: newJobId(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
		state: 'THINKING',
		status: 'IN_PROGRESS',
		request,
		plan: [],
		content: '',
		thinkingLog: ['Job criado. Iniciando orquestracao...']
	});

	void runAgentJobPipeline(job.id).catch(error => {
		updateJob(job.id, {
			state: 'FAILED',
			status: 'FAILED',
			error: error instanceof Error ? error.message : String(error)
		});
		appendThinking(job.id, `Falha fatal: ${error instanceof Error ? error.message : String(error)}`);
	});

	const snapshot = getJob(job.id);
	return snapshot ? toSnapshot(snapshot) : toSnapshot(job);
}

export function getAgentJobSnapshot(jobId: string): AgentJobSnapshot | undefined {
	const job = getJob(jobId);
	return job ? toSnapshot(job) : undefined;
}

async function runAgentJobPipeline(jobId: string): Promise<void> {
	const job = getJob(jobId);
	if (!job) {
		return;
	}

	const segment = resolveSegment(job.request);
	updateJob(jobId, { state: 'THINKING', segment });
	appendThinking(jobId, `Segmento: ${segment}`);

	if (config.projectRagIndexingEnabled) {
		appendThinking(jobId, 'Indexando arquivos do projeto para memoria RAG...');
		const indexedFiles = await indexEditorProject(config.projectRagMaxFiles);
		updateJob(jobId, { indexedFiles });
		appendThinking(jobId, `Indexados ${indexedFiles} arquivos.`);
	}

	const plan = await generateExecutionPlan({
		message: job.request.message,
		segment,
		agent: job.request.agent
	});
	updateJob(jobId, { plan });
	appendThinking(jobId, `Plano: ${plan.join(' | ')}`);

	updateJob(jobId, { state: 'GENERATING' });
	appendThinking(jobId, 'Gerando resposta com motores do segmento...');
	const streamTokens = config.agentStreamTokens;
	const { startedAt, segment: usedSegment, completion } = await generateAgentChatCore(
		job.request,
		streamTokens
			? fullText => updateJob(jobId, { content: fullText })
			: undefined
	);
	const baseResponse = buildAgentChatResponse({
		completion,
		executionTimeMs: Date.now() - startedAt,
		segment: usedSegment,
		vpsCompileStatus: 'PENDING',
		phase: 'processing',
		suggestedCommands: []
	});
	const response = {
		...baseResponse,
		plan,
		jobStatus: 'IN_PROGRESS' as const
	};
	updateJob(jobId, {
		content: response.content,
		response
	});

	updateJob(jobId, { state: 'COMPILING' });
	appendThinking(jobId, 'Validando compilacao no VPS...');
	let compileValidation = await validateVpsEnvironment({
		priority: job.request.priority,
		triggerCompile: job.request.trigger_compile
	});
	updateJob(jobId, { compileJobId: compileValidation.jobId });

	if (config.agentTestDrivenEnabled && (job.request.priority === 'high' || job.request.trigger_compile)) {
		updateJob(jobId, { state: 'TESTING' });
		appendThinking(jobId, 'Executando testes (TDA)...');
		const testResult = await runProjectTests();
		updateJob(jobId, { testOutput: testResult.output });

		if (testResult.ran && !testResult.success && config.orchestratorAutoHeal) {
			await runHeal(jobId, job, segment, testResult.output, response.content);
			return;
		}

		if (testResult.ran && !testResult.success) {
			updateJob(jobId, {
				state: 'FAILED',
				status: 'FAILED',
				error: 'Testes falharam',
				response: {
					...response,
					metadata: {
						...response.metadata,
						phase: 'error',
						vps_compile_status: compileValidation.status
					},
					content: `${response.content}\n\n---\nFalha nos testes:\n${testResult.output}`
				}
			});
			appendThinking(jobId, 'Testes falharam.');
			return;
		}
		appendThinking(jobId, testResult.ran ? 'Testes passaram.' : 'Testes ignorados (script ausente).');
	}

	if (config.orchestratorAutoHeal && compileValidation.status === 'FAILED' && !compileValidation.serverMainReady) {
		await runHeal(
			jobId,
			job,
			segment,
			compileValidation.output ?? 'Compilacao VPS falhou.',
			response.content
		);
		return;
	}

	const finalCompileStatus = compileValidation.jobId
		? getCompileJobStatus(compileValidation.jobId)?.status ?? compileValidation.status
		: compileValidation.status;

	updateJob(jobId, {
		state: 'SUCCESS',
		status: 'COMPLETED',
		response: {
			...response,
			metadata: {
				...response.metadata,
				phase: 'completed',
				vps_compile_status: finalCompileStatus
			},
			intelligence_status: formatIntelligenceStatus({
				...response.metadata,
				phase: 'completed',
				vps_compile_status: finalCompileStatus
			})
		}
	});
	appendThinking(jobId, 'Job concluido com sucesso.');
}

async function runHeal(
	jobId: string,
	job: AgentJobRecord,
	segment: ModelSegment,
	errorLog: string,
	previousContent: string
): Promise<void> {
	updateJob(jobId, { state: 'HEALING' });
	appendThinking(jobId, 'Auto-healing DEBUG ativado...');

	try {
		const healed = await runDebugAutoHeal({
			originalMessage: job.request.message,
			previousContent,
			compileOutput: [
				'Voce e o modulo de correcao da Princy IA.',
				`O codigo gerado causou erro:\n${errorLog}`,
				job.request.filePath ? `Arquivo: ${job.request.filePath}` : '',
				'Forneca apenas o codigo corrigido.'
			].filter(Boolean).join('\n\n'),
			messages: []
		});

		const content = `${previousContent}\n\n---\n## Auto-correcao DEBUG\n\n${healed.content}`;
		updateJob(jobId, {
			state: 'SUCCESS',
			status: 'COMPLETED',
			content,
			response: {
				content,
				message: content,
				metadata: {
					segment_used: 'DEBUG',
					primary_engine: healed.primaryEngine,
					fallback_engines: healed.fallbackEngines,
					execution_time: `${(healed.executionTimeMs / 1000).toFixed(1)}s`,
					status: healed.status,
					vps_compile_status: 'FAILED',
					consensus_applied: healed.consensusApplied,
					phase: 'auto_healing',
					timestamp: Date.now()
				},
				intelligence_status: `[Princy IA] ⚠️ DEBUG | Auto-correcao aplicada | ${healed.primaryEngine}`
			}
		});
		appendThinking(jobId, 'Auto-healing concluido.');
	} catch (error) {
		updateJob(jobId, {
			state: 'FAILED',
			status: 'FAILED',
			error: error instanceof Error ? error.message : String(error)
		});
		appendThinking(jobId, 'Auto-healing falhou.');
	}
}

function resolveSegment(request: AgentChatRequest): ModelSegment {
	return request.force_segment ?? request.segment ?? detectSegment(request.message, request.filePath);
}
