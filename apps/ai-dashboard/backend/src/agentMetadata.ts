import type { ChatCompletionResult } from './ai.js';
import type { ModelSegment, OrchestratorStatus, VpsCompileStatus } from './orchestrator/types.js';

export type AgentResponsePhase = 'processing' | 'completed' | 'error' | 'compiling' | 'auto_healing';

export type AgentChatMetadata = {
	readonly segment_used: ModelSegment;
	readonly primary_engine: string;
	readonly fallback_engines: readonly string[];
	readonly execution_time: string;
	readonly status: OrchestratorStatus | 'COMPLETED' | 'FAILED';
	readonly vps_compile_status: VpsCompileStatus;
	readonly consensus_applied: boolean;
	readonly phase: AgentResponsePhase;
	readonly compile_job_id?: string;
	readonly code_web_reachable?: boolean;
	readonly server_main_ready?: boolean;
	readonly timestamp: number;
};

export type AgentJobStatusLabel = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type AgentChatResponse = {
	readonly content: string;
	readonly message: string;
	readonly metadata: AgentChatMetadata;
	readonly plan?: readonly string[];
	readonly jobStatus?: AgentJobStatusLabel;
	readonly intelligence_status?: string;
	readonly suggestedCommands?: readonly string[];
};

export function buildAgentChatResponse(input: {
	readonly completion: ChatCompletionResult;
	readonly executionTimeMs: number;
	readonly segment: ModelSegment;
	readonly vpsCompileStatus: VpsCompileStatus;
	readonly phase: AgentResponsePhase;
	readonly compileJobId?: string;
	readonly codeWebReachable?: boolean;
	readonly serverMainReady?: boolean;
	readonly suggestedCommands?: readonly string[];
}): AgentChatResponse {
	const engines = input.completion.orchestrator?.enginesUsed ?? [];
	const primaryEngine = input.completion.orchestrator?.primaryEngine ?? engines[0]?.split('@')[0] ?? 'deepseek-coder';
	const fallbackEngines = input.completion.orchestrator?.fallbackEngines.length
		? input.completion.orchestrator.fallbackEngines
		: engines.slice(1).map(engine => engine.split('@')[0]);

	const metadata: AgentChatMetadata = {
		segment_used: input.completion.orchestrator?.segment ?? input.segment,
		primary_engine: primaryEngine,
		fallback_engines: fallbackEngines,
		execution_time: `${(input.executionTimeMs / 1000).toFixed(1)}s`,
		status: input.completion.orchestrator?.status ?? 'COMPLETED',
		vps_compile_status: input.vpsCompileStatus,
		consensus_applied: input.completion.orchestrator?.consensusApplied ?? false,
		phase: input.phase,
		compile_job_id: input.compileJobId,
		code_web_reachable: input.codeWebReachable,
		server_main_ready: input.serverMainReady,
		timestamp: Date.now()
	};

	return {
		content: input.completion.content,
		message: input.completion.content,
		metadata,
		suggestedCommands: input.suggestedCommands
	};
}

export function formatIntelligenceStatus(metadata: AgentChatMetadata): string {
	const enginesLabel = [metadata.primary_engine, ...metadata.fallback_engines].filter(Boolean).join(' ➔ ');

	switch (metadata.phase) {
		case 'processing':
			return `[Princy IA] 🧠 Segmento: ${metadata.segment_used} | Motor: ${metadata.primary_engine}...`;
		case 'compiling':
			return `[Princy IA] ⚙️ Compilando no VPS (3200)... | Segmento: ${metadata.segment_used}`;
		case 'auto_healing':
			return `[Princy IA] ⚠️ DEBUG | Erro no compilador | Corrigindo com ${metadata.primary_engine}...`;
		case 'error':
			return `[Princy IA] ❌ ${metadata.segment_used} | Falha | ${metadata.execution_time}`;
		default:
			if (metadata.vps_compile_status === 'READY') {
				return `[Princy IA] ✅ ${metadata.segment_used} | Motores: [${enginesLabel}] | ${metadata.execution_time} | Compiled & Ready`;
			}
			if (metadata.vps_compile_status === 'FAILED') {
				return `[Princy IA] ⚠️ ${metadata.segment_used} | Motores: [${enginesLabel}] | Compilador 3200 com pendencias`;
			}
			return `[Princy IA] ✅ ${metadata.segment_used} | Motores: [${enginesLabel}] | ${metadata.execution_time}`;
	}
}
