import { generateAgentChatCore, type AgentChatRequest } from '../agentChatService.js';
import { buildAgentChatResponse, type AgentChatResponse } from '../agentMetadata.js';
import { formatIntelligenceStatus } from '../agentMetadata.js';
import { agentStateToActionPhase } from '../actionRun/types.js';
import { config } from '../config.js';
import { generateComposerPlan } from '../composerPlanService.js';
import { getCompileJobStatus, validateVpsEnvironment, waitForCompileJob } from '../compileService.js';
import { generateExecutionPlan } from '../planGenerator.js';
import { detectSegment } from '../orchestrator/segments.js';
import { runDebugAutoHeal } from '../orchestrator/orchestrator.js';
import type { ModelSegment } from '../orchestrator/types.js';
import { runProjectTests } from '../testRunner.js';
import { indexEditorProject } from '../workspaceIndexer.js';
import { appendThinking, createJob, getJob, toActionRunSnapshot, toSnapshot, updateJob } from './store.js';
import type { AgentJobRecord, AgentJobSnapshot } from './types.js';

type ContinuePayload = {
	readonly applied: boolean;
	readonly paths?: readonly string[];
};

const continueWaiters = new Map<string, {
	readonly resolve: (payload: ContinuePayload) => void;
	readonly reject: (error: Error) => void;
}>();

function newJobId(): string {
	return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncActionPhase(jobId: string): void {
	const job = getJob(jobId);
	if (!job) {
		return;
	}
	updateJob(jobId, { actionPhase: agentStateToActionPhase(job.state, job.approvalStatus) });
}

export function startAgentJob(request: AgentChatRequest): AgentJobSnapshot {
	const mode = request.mode ?? 'agent';
	const job = createJob({
		id: newJobId(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
		state: 'THINKING',
		status: 'IN_PROGRESS',
		request,
		mode,
		plan: [],
		content: '',
		thinkingLog: ['Job criado. Iniciando orquestracao...'],
		approvalStatus: mode === 'agent' || mode === 'composer' ? 'pending' : undefined
	});

	void runAgentJobPipeline(job.id).catch(error => {
		updateJob(job.id, {
			state: 'FAILED',
			status: 'FAILED',
			error: error instanceof Error ? error.message : String(error)
		});
		appendThinking(job.id, `Falha fatal: ${error instanceof Error ? error.message : String(error)}`);
		syncActionPhase(job.id);
	});

	const snapshot = getJob(job.id);
	return snapshot ? toSnapshot(snapshot) : toSnapshot(job);
}

export function getAgentJobSnapshot(jobId: string): AgentJobSnapshot | undefined {
	const job = getJob(jobId);
	return job ? toSnapshot(job) : undefined;
}

export function getAgentActionRun(jobId: string) {
	const job = getJob(jobId);
	return job ? toActionRunSnapshot(job) : undefined;
}

export function approveAgentJob(jobId: string): { readonly ok: boolean; readonly message?: string } {
	const job = getJob(jobId);
	if (!job) {
		return { ok: false, message: 'Job not found' };
	}
	if (job.state !== 'AWAITING_APPROVAL') {
		return { ok: false, message: `Job nao aguarda aprovacao (estado: ${job.state})` };
	}
	updateJob(jobId, { approvalStatus: 'approved' });
	appendThinking(jobId, 'Plano aprovado pelo usuario. Aplique as mudancas e envie continue.');
	syncActionPhase(jobId);
	return { ok: true };
}

export function rejectAgentJob(jobId: string): { readonly ok: boolean; readonly message?: string } {
	const job = getJob(jobId);
	if (!job) {
		return { ok: false, message: 'Job not found' };
	}
	updateJob(jobId, {
		state: 'FAILED',
		status: 'FAILED',
		approvalStatus: 'rejected',
		error: 'Rejeitado pelo usuario',
		resultSummary: 'Acao cancelada pelo usuario.'
	});
	appendThinking(jobId, 'Plano rejeitado pelo usuario.');
	const waiter = continueWaiters.get(jobId);
	waiter?.reject(new Error('Rejeitado pelo usuario'));
	continueWaiters.delete(jobId);
	syncActionPhase(jobId);
	return { ok: true };
}

export function continueAgentJob(jobId: string, payload: ContinuePayload): { readonly ok: boolean; readonly message?: string } {
	const job = getJob(jobId);
	if (!job) {
		return { ok: false, message: 'Job not found' };
	}
	if (job.state !== 'AWAITING_APPROVAL') {
		return { ok: false, message: `Job nao aguarda continue (estado: ${job.state})` };
	}
	if (job.approvalStatus !== 'approved') {
		return { ok: false, message: 'Aprove o plano antes de continuar (POST .../approve)' };
	}
	if (!payload.applied) {
		return { ok: false, message: 'payload.applied deve ser true apos aplicar no workspace' };
	}

	updateJob(jobId, {
		state: 'APPLYING',
		appliedPaths: payload.paths ? [...payload.paths] : []
	});
	appendThinking(jobId, `Mudancas aplicadas em ${payload.paths?.length ?? 0} arquivo(s).`);
	syncActionPhase(jobId);

	const waiter = continueWaiters.get(jobId);
	if (waiter) {
		waiter.resolve(payload);
		continueWaiters.delete(jobId);
	}
	return { ok: true };
}

function waitForJobContinue(jobId: string): Promise<ContinuePayload> {
	return new Promise((resolve, reject) => {
		continueWaiters.set(jobId, { resolve, reject });
	});
}

async function runAgentJobPipeline(jobId: string): Promise<void> {
	const job = getJob(jobId);
	if (!job) {
		return;
	}

	const segment = resolveSegment(job.request);
	const mode = job.mode ?? job.request.mode ?? 'agent';
	updateJob(jobId, { segment, mode });
	syncActionPhase(jobId);

	if (config.simpleMode || mode === 'chat' || job.request.actionOnlyExplain) {
		await runChatExplainJob(jobId, job, segment);
		return;
	}

	if (mode === 'agent' || mode === 'composer') {
		await runActionPipelineJob(jobId, job, segment, mode);
		return;
	}

	await runLegacyAgentJob(jobId, job, segment);
}

async function runChatExplainJob(jobId: string, job: AgentJobRecord, segment: ModelSegment): Promise<void> {
	updateJob(jobId, { state: 'THINKING' });
	appendThinking(jobId, `Segmento: ${segment}`);
	syncActionPhase(jobId);

	if (config.projectRagIndexingEnabled) {
		appendThinking(jobId, 'Indexando arquivos do projeto...');
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
	appendThinking(jobId, 'Gerando explicacao...');
	syncActionPhase(jobId);

	const streamTokens = config.agentStreamTokens;
	const { startedAt, segment: usedSegment, completion } = await generateAgentChatCore(
		job.request,
		streamTokens ? fullText => updateJob(jobId, { content: fullText }) : undefined
	);
	const response = buildAgentChatResponse({
		completion,
		executionTimeMs: Date.now() - startedAt,
		segment: usedSegment,
		vpsCompileStatus: 'SKIPPED',
		phase: 'completed',
		suggestedCommands: []
	});

	updateJob(jobId, {
		state: 'SUCCESS',
		status: 'COMPLETED',
		content: response.content,
		resultSummary: 'Explicacao concluida (modo Chat — sem apply automatico).',
		response: {
			...response,
			plan,
			intelligence_status: formatIntelligenceStatus(response.metadata)
		}
	});
	appendThinking(jobId, 'Resposta pronta.');
	syncActionPhase(jobId);
}

async function runActionPipelineJob(
	jobId: string,
	job: AgentJobRecord,
	segment: ModelSegment,
	mode: 'agent' | 'composer'
): Promise<void> {
	updateJob(jobId, { state: 'THINKING' });
	appendThinking(jobId, `Segmento: ${segment} | Modo: ${mode}`);
	syncActionPhase(jobId);

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

	updateJob(jobId, { state: 'PLANNING' });
	appendThinking(jobId, 'Gerando plano estruturado (Composer)...');
	syncActionPhase(jobId);

	const instruction = [
		job.request.rulesText && `## Regras\n${job.request.rulesText}`,
		job.request.message
	].filter(Boolean).join('\n\n');

	const composerPlan = await generateComposerPlan({
		agent: job.request.agent,
		instruction,
		shadowContext: job.request.shadowContext,
		codeGraph: job.request.codeGraph
	});

	const affected = composerPlan.affectedFiles.length > 0
		? composerPlan.affectedFiles
		: [...new Set(composerPlan.operations.map(op => 'filePath' in op ? op.filePath : '').filter(Boolean))];

	updateJob(jobId, {
		composerPlan: { ...composerPlan, affectedFiles: affected },
		content: composerPlan.summary,
		state: 'AWAITING_APPROVAL',
		approvalStatus: 'pending'
	});
	appendThinking(jobId, `Aguardando aprovacao (${affected.length} arquivo(s), ${composerPlan.operations.length} operacao(oes)).`);
	syncActionPhase(jobId);

	if (mode === 'composer' && (job.request.skipPostApply || !job.request.trigger_compile)) {
		updateJob(jobId, {
			state: 'SUCCESS',
			status: 'COMPLETED',
			resultSummary: 'Plano pronto — aplique e use Verificar quando quiser.',
			response: buildPreviewResponse(job, composerPlan, plan, 'PENDING')
		});
		appendThinking(jobId, 'Composer: diff pronto para revisao.');
		syncActionPhase(jobId);
		return;
	}

	await waitForJobContinue(jobId);

	const current = getJob(jobId);
	if (!current || current.approvalStatus === 'rejected') {
		return;
	}

	if (job.request.skipPostApply) {
		await finishAfterApply(jobId, job, plan, composerPlan, 'SKIPPED', 'Mudancas aplicadas. Compile/test ignorados.');
		return;
	}

	await runPostApplyPhase(jobId, job, segment, plan, composerPlan);
}

async function runPostApplyPhase(
	jobId: string,
	job: AgentJobRecord,
	segment: ModelSegment,
	plan: string[],
	composerPlan: NonNullable<AgentJobRecord['composerPlan']>
): Promise<void> {
	updateJob(jobId, { state: 'COMPILING' });
	appendThinking(jobId, 'Validando compilacao no VPS...');
	syncActionPhase(jobId);

	let compileValidation = await validateVpsEnvironment({
		priority: job.request.priority,
		triggerCompile: job.request.trigger_compile ?? true
	});
	updateJob(jobId, { compileJobId: compileValidation.jobId });

	if (compileValidation.jobId) {
		appendThinking(jobId, `Aguardando compile-web (job ${compileValidation.jobId})...`);
		compileValidation = await waitForCompileJob(compileValidation.jobId, config.compileJobWaitTimeoutMs);
	}

	if (config.agentTestDrivenEnabled) {
		updateJob(jobId, { state: 'TESTING' });
		appendThinking(jobId, 'Executando testes (TDA)...');
		syncActionPhase(jobId);
		const testResult = await runProjectTests();
		updateJob(jobId, { testOutput: testResult.output });

		if (testResult.ran && !testResult.success && config.orchestratorAutoHeal) {
			await runHeal(jobId, job, segment, testResult.output, composerPlan.summary);
			return;
		}

		if (testResult.ran && !testResult.success) {
			updateJob(jobId, {
				state: 'FAILED',
				status: 'FAILED',
				error: 'Testes falharam',
				resultSummary: 'Apply OK; testes falharam.',
				response: buildPreviewResponse(job, composerPlan, plan, compileValidation.status, testResult.output)
			});
			appendThinking(jobId, 'Testes falharam.');
			syncActionPhase(jobId);
			return;
		}
		appendThinking(jobId, testResult.ran ? 'Testes passaram.' : 'Testes ignorados (script ausente).');
	}

	if (config.orchestratorAutoHeal && compileValidation.status === 'FAILED' && !compileValidation.serverMainReady) {
		await runHeal(jobId, job, segment, compileValidation.output ?? 'Compilacao VPS falhou.', composerPlan.summary);
		return;
	}

	const finalStatus = compileValidation.status;
	await finishAfterApply(
		jobId,
		job,
		plan,
		composerPlan,
		finalStatus,
		`Pipeline concluido. Compile: ${finalStatus}.`
	);
}

async function finishAfterApply(
	jobId: string,
	job: AgentJobRecord,
	plan: string[],
	composerPlan: NonNullable<AgentJobRecord['composerPlan']>,
	compileStatus: import('../orchestrator/types.js').VpsCompileStatus,
	resultSummary: string
): Promise<void> {
	const response = buildPreviewResponse(job, composerPlan, plan, compileStatus, getJob(jobId)?.testOutput);
	updateJob(jobId, {
		state: 'SUCCESS',
		status: 'COMPLETED',
		resultSummary,
		response
	});
	appendThinking(jobId, resultSummary);
	syncActionPhase(jobId);
}

function buildPreviewResponse(
	job: AgentJobRecord,
	composerPlan: NonNullable<AgentJobRecord['composerPlan']>,
	plan: string[],
	vpsCompileStatus: import('../orchestrator/types.js').VpsCompileStatus,
	testOutput?: string
): AgentChatResponse {
	const content = [
		composerPlan.summary,
		'',
		'---',
		`Arquivos: ${composerPlan.affectedFiles.join(', ') || '(nenhum)'}`,
		testOutput ? `\nTestes:\n${testOutput}` : ''
	].filter(Boolean).join('\n');

	return {
		content,
		message: content,
		plan,
		jobStatus: 'COMPLETED' as const,
		metadata: {
			segment_used: job.segment ?? 'LOGIC',
			primary_engine: 'orchestrator',
			fallback_engines: [],
			execution_time: '0.0s',
			status: 'COMPLETED' as const,
			vps_compile_status: vpsCompileStatus,
			consensus_applied: false,
			phase: 'completed' as const,
			timestamp: Date.now()
		},
		intelligence_status: formatIntelligenceStatus({
			segment_used: job.segment ?? 'LOGIC',
			primary_engine: 'orchestrator',
			fallback_engines: [],
			execution_time: '0.0s',
			status: 'COMPLETED' as const,
			vps_compile_status: vpsCompileStatus,
			consensus_applied: false,
			phase: 'completed' as const,
			timestamp: Date.now()
		})
	};
}

async function runLegacyAgentJob(jobId: string, job: AgentJobRecord, segment: ModelSegment): Promise<void> {
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
		streamTokens ? fullText => updateJob(jobId, { content: fullText }) : undefined
	);
	const baseResponse = buildAgentChatResponse({
		completion,
		executionTimeMs: Date.now() - startedAt,
		segment: usedSegment,
		vpsCompileStatus: 'PENDING',
		phase: 'processing',
		suggestedCommands: []
	});
	const response = { ...baseResponse, plan, jobStatus: 'IN_PROGRESS' as const };
	updateJob(jobId, { content: response.content, response });

	updateJob(jobId, { state: 'COMPILING' });
	appendThinking(jobId, 'Validando compilacao no VPS...');
	let compileValidation = await validateVpsEnvironment({
		priority: job.request.priority,
		triggerCompile: job.request.trigger_compile
	});
	updateJob(jobId, { compileJobId: compileValidation.jobId });

	if (compileValidation.jobId) {
		compileValidation = await waitForCompileJob(compileValidation.jobId, config.compileJobWaitTimeoutMs);
	}

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
					metadata: { ...response.metadata, phase: 'error', vps_compile_status: compileValidation.status },
					content: `${response.content}\n\n---\nFalha nos testes:\n${testResult.output}`
				}
			});
			return;
		}
	}

	const finalCompileStatus = compileValidation.jobId
		? getCompileJobStatus(compileValidation.jobId)?.status ?? compileValidation.status
		: compileValidation.status;

	updateJob(jobId, {
		state: 'SUCCESS',
		status: 'COMPLETED',
		resultSummary: 'Job legado concluido.',
		response: {
			...response,
			metadata: { ...response.metadata, phase: 'completed', vps_compile_status: finalCompileStatus },
			intelligence_status: formatIntelligenceStatus({
				...response.metadata,
				phase: 'completed',
				vps_compile_status: finalCompileStatus
			})
		}
	});
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
	syncActionPhase(jobId);

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
			resultSummary: 'Auto-healing aplicado.',
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
				intelligence_status: `[Princy IA] DEBUG | Auto-correcao aplicada | ${healed.primaryEngine}`
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
	syncActionPhase(jobId);
}

function resolveSegment(request: AgentChatRequest): ModelSegment {
	return request.force_segment ?? request.segment ?? detectSegment(request.message, request.filePath);
}
