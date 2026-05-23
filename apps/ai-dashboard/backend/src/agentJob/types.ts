import type { ActionRunMode, ApprovalStatus } from '../actionRun/types.js';
import type { AgentChatRequest } from '../agentChatService.js';
import type { AgentChatResponse } from '../agentMetadata.js';
import type { ComposerPlan } from '../composerPlanService.js';
import type { ModelSegment } from '../orchestrator/types.js';

export type AgentJobState =
	| 'IDLE'
	| 'THINKING'
	| 'PLANNING'
	| 'AWAITING_APPROVAL'
	| 'APPLYING'
	| 'GENERATING'
	| 'COMPILING'
	| 'TESTING'
	| 'HEALING'
	| 'SUCCESS'
	| 'FAILED';

export type AgentJobStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type AgentJobRecord = {
	id: string;
	createdAt: number;
	updatedAt: number;
	state: AgentJobState;
	status: AgentJobStatus;
	request: AgentChatRequest;
	segment?: ModelSegment;
	plan: string[];
	content: string;
	error?: string;
	thinkingLog: string[];
	response?: AgentChatResponse;
	compileJobId?: string;
	buildJobId?: string;
	testOutput?: string;
	indexedFiles?: number;
	mode?: ActionRunMode;
	actionPhase?: string;
	composerPlan?: ComposerPlan;
	approvalStatus?: ApprovalStatus;
	appliedPaths?: string[];
	resultSummary?: string;
	skipPostApply?: boolean;
};

export type AgentJobSnapshot = {
	readonly jobId: string;
	readonly state: AgentJobState;
	readonly status: AgentJobStatus;
	readonly plan: readonly string[];
	readonly content: string;
	readonly thinkingLog: readonly string[];
	readonly error?: string;
	readonly response?: AgentChatResponse;
	readonly compileJobId?: string;
	readonly buildJobId?: string;
	readonly testOutput?: string;
	readonly indexedFiles?: number;
	readonly mode?: ActionRunMode;
	readonly actionPhase?: string;
	readonly composerPlan?: ComposerPlan;
	readonly approvalStatus?: ApprovalStatus;
	readonly appliedPaths?: readonly string[];
	readonly resultSummary?: string;
};
