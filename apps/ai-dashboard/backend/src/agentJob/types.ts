import type { ActionRunMode, ApprovalStatus } from '../actionRun/types.js';
import type { AgentChatRequest } from '../agentChatService.js';
import type { AgentChatResponse } from '../agentMetadata.js';
import type { ComposerPlan } from '../composerPlanService.js';
import type { ModelSegment } from '../orchestrator/types.js';

export type AgentJobState =
	| 'IDLE'
	| 'THINKING'
	| 'PLANNING'
	| 'REVIEWING'
	| 'AWAITING_APPROVAL'
	| 'APPLYING'
	| 'GENERATING'
	| 'COMPILING'
	| 'TESTING'
	| 'HEALING'
	| 'SUCCESS'
	| 'FAILED';

export type AgentJobStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type AgentRole = 'planner' | 'frontend' | 'backend' | 'qa' | 'docs' | 'research' | 'reviewer';

export type PlanDagNode = {
	readonly id: string;
	readonly label: string;
	readonly role?: AgentRole;
	readonly dependsOn: readonly string[];
	readonly state: 'pending' | 'active' | 'done' | 'failed';
};

export type PlanDag = {
	readonly nodes: readonly PlanDagNode[];
	readonly summary: string;
};

export type ReviewerReport = {
	readonly approved: boolean;
	readonly checklist: readonly { readonly item: string; readonly passed: boolean }[];
	readonly summary: string;
	readonly suggestions: readonly string[];
};

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
	mode?: ActionRunMode | 'plan';
	actionPhase?: string;
	composerPlan?: ComposerPlan;
	approvalStatus?: ApprovalStatus;
	appliedPaths?: string[];
	resultSummary?: string;
	skipPostApply?: boolean;
	planOnly?: boolean;
	planDag?: PlanDag;
	reviewerReport?: ReviewerReport;
	workspaceId?: string;
	swarmJobId?: string;
	swarmRole?: AgentRole;
	worktreePath?: string;
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
	readonly mode?: ActionRunMode | 'plan';
	readonly actionPhase?: string;
	readonly composerPlan?: ComposerPlan;
	readonly approvalStatus?: ApprovalStatus;
	readonly appliedPaths?: readonly string[];
	readonly resultSummary?: string;
	readonly planOnly?: boolean;
	readonly planDag?: PlanDag;
	readonly reviewerReport?: ReviewerReport;
	readonly swarmJobId?: string;
};

export type SwarmGraphNode = {
	readonly id: string;
	readonly role: AgentRole;
	readonly label: string;
	readonly state: string;
	readonly status: string;
	readonly dependsOn: readonly string[];
	readonly agentJobId?: string;
	readonly worktreePath?: string;
};

export type SwarmGraph = {
	readonly swarmJobId: string;
	readonly status: string;
	readonly prompt: string;
	readonly nodes: readonly SwarmGraphNode[];
	readonly edges: readonly { readonly from: string; readonly to: string }[];
};
