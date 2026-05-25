import { agentStateToActionPhase, buildActionTasks, type ActionRunSnapshot } from '../actionRun/types.js';
import { prisma } from '../prisma.js';
import type { AgentJobRecord, AgentJobSnapshot } from './types.js';

const jobs = new Map<string, AgentJobRecord>();
let persistenceReady = false;

const EXECUTING_STATES = new Set([
	'THINKING', 'PLANNING', 'REVIEWING', 'GENERATING', 'APPLYING', 'COMPILING', 'TESTING', 'HEALING'
]);

function recordToDbRow(record: AgentJobRecord): Record<string, unknown> {
	return {
		id: record.id,
		workspaceId: record.workspaceId,
		state: record.state,
		status: record.status,
		mode: record.mode ?? record.request.mode,
		request: record.request as object,
		plan: record.plan,
		content: record.content,
		thinkingLog: record.thinkingLog,
		error: record.error,
		response: record.response as object | undefined,
		segment: record.segment,
		composerPlan: record.composerPlan as object | undefined,
		approvalStatus: record.approvalStatus,
		appliedPaths: record.appliedPaths,
		resultSummary: record.resultSummary,
		compileJobId: record.compileJobId,
		buildJobId: record.buildJobId,
		testOutput: record.testOutput,
		indexedFiles: record.indexedFiles,
		actionPhase: record.actionPhase ?? agentStateToActionPhase(record.state, record.approvalStatus),
		skipPostApply: record.skipPostApply ?? false,
		reviewerReport: record.reviewerReport as object | undefined,
		planDag: record.planDag as object | undefined,
		swarmJobId: record.swarmJobId
	};
}

function rowToRecord(row: {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	state: string;
	status: string;
	mode: string | null;
	request: unknown;
	plan: unknown;
	content: string;
	thinkingLog: unknown;
	error: string | null;
	response: unknown;
	segment: string | null;
	composerPlan: unknown;
	approvalStatus: string | null;
	appliedPaths: unknown;
	resultSummary: string | null;
	compileJobId: string | null;
	buildJobId: string | null;
	testOutput: string | null;
	indexedFiles: number | null;
	actionPhase: string | null;
	skipPostApply: boolean;
	reviewerReport: unknown;
	planDag: unknown;
	swarmJobId: string | null;
}): AgentJobRecord {
	const request = row.request as AgentJobRecord['request'];
	return {
		id: row.id,
		createdAt: row.createdAt.getTime(),
		updatedAt: row.updatedAt.getTime(),
		state: row.state as AgentJobRecord['state'],
		status: row.status as AgentJobRecord['status'],
		request,
		mode: (row.mode ?? request.mode) as AgentJobRecord['mode'],
		plan: Array.isArray(row.plan) ? row.plan.map(String) : [],
		content: row.content,
		thinkingLog: Array.isArray(row.thinkingLog) ? row.thinkingLog.map(String) : [],
		error: row.error ?? undefined,
		response: row.response as AgentJobRecord['response'],
		segment: row.segment as AgentJobRecord['segment'],
		composerPlan: row.composerPlan as AgentJobRecord['composerPlan'],
		approvalStatus: row.approvalStatus as AgentJobRecord['approvalStatus'],
		appliedPaths: Array.isArray(row.appliedPaths) ? row.appliedPaths.map(String) : undefined,
		resultSummary: row.resultSummary ?? undefined,
		compileJobId: row.compileJobId ?? undefined,
		buildJobId: row.buildJobId ?? undefined,
		testOutput: row.testOutput ?? undefined,
		indexedFiles: row.indexedFiles ?? undefined,
		actionPhase: row.actionPhase ?? undefined,
		skipPostApply: row.skipPostApply,
		reviewerReport: row.reviewerReport as AgentJobRecord['reviewerReport'],
		planDag: row.planDag as AgentJobRecord['planDag'],
		swarmJobId: row.swarmJobId ?? undefined,
		workspaceId: request.workspaceId
	};
}

async function persistJob(record: AgentJobRecord): Promise<void> {
	if (!persistenceReady) {
		return;
	}
	try {
		const data = recordToDbRow(record);
		await prisma.agentJob.upsert({
			where: { id: record.id },
			create: data as Parameters<typeof prisma.agentJob.upsert>[0]['create'],
			update: data as Parameters<typeof prisma.agentJob.upsert>[0]['update']
		});
	} catch {
		// Best-effort persistence
	}
}

export async function initAgentJobStore(): Promise<void> {
	persistenceReady = true;
	const rows = await prisma.agentJob.findMany({
		orderBy: { updatedAt: 'desc' },
		take: 500
	});

	for (const row of rows) {
		const record = rowToRecord(row);
		if (record.status === 'IN_PROGRESS' && EXECUTING_STATES.has(record.state)) {
			record.state = 'FAILED';
			record.status = 'FAILED';
			record.error = 'Interrompido por restart do servidor';
			record.resultSummary = 'Job interrompido — reinicie a tarefa.';
		}
		jobs.set(record.id, record);
		if (record.status === 'IN_PROGRESS' && (record.state === 'FAILED')) {
			await persistJob(record);
		}
	}
}

export function createJob(record: AgentJobRecord): AgentJobRecord {
	jobs.set(record.id, record);
	void persistJob(record);
	return record;
}

export function getJob(jobId: string): AgentJobRecord | undefined {
	return jobs.get(jobId);
}

export async function getJobAsync(jobId: string): Promise<AgentJobRecord | undefined> {
	const cached = jobs.get(jobId);
	if (cached) {
		return cached;
	}
	try {
		const row = await prisma.agentJob.findUnique({ where: { id: jobId } });
		if (!row) {
			return undefined;
		}
		const record = rowToRecord(row);
		jobs.set(record.id, record);
		return record;
	} catch {
		return undefined;
	}
}

export function updateJob(jobId: string, patch: Partial<AgentJobRecord>): AgentJobRecord | undefined {
	const current = jobs.get(jobId);
	if (!current) {
		return undefined;
	}

	const next: AgentJobRecord = {
		...current,
		...patch,
		updatedAt: Date.now()
	};
	jobs.set(jobId, next);
	void persistJob(next);
	return next;
}

export function appendThinking(jobId: string, line: string): void {
	const job = jobs.get(jobId);
	if (!job) {
		return;
	}
	job.thinkingLog.push(line);
	job.updatedAt = Date.now();
	void persistJob(job);
}

export function toSnapshot(job: AgentJobRecord): AgentJobSnapshot {
	return {
		jobId: job.id,
		state: job.state,
		status: job.status,
		plan: job.plan,
		content: job.content,
		thinkingLog: job.thinkingLog,
		error: job.error,
		response: job.response,
		compileJobId: job.compileJobId,
		buildJobId: job.buildJobId,
		testOutput: job.testOutput,
		indexedFiles: job.indexedFiles,
		mode: job.mode ?? job.request.mode,
		actionPhase: job.actionPhase ?? agentStateToActionPhase(job.state, job.approvalStatus),
		composerPlan: job.composerPlan,
		approvalStatus: job.approvalStatus,
		appliedPaths: job.appliedPaths,
		resultSummary: job.resultSummary,
		planOnly: job.planOnly,
		planDag: job.planDag,
		reviewerReport: job.reviewerReport,
		swarmJobId: job.swarmJobId
	};
}

export function toActionRunSnapshot(job: AgentJobRecord): ActionRunSnapshot {
	const mode = job.mode ?? job.request.mode ?? 'agent';
	return {
		runId: job.id,
		mode: mode === 'plan' ? 'plan' : mode,
		phase: agentStateToActionPhase(job.state, job.approvalStatus),
		planSummary: job.planDag?.summary ?? job.composerPlan?.summary ?? job.content.slice(0, 500),
		planSteps: job.plan,
		composerPlan: job.composerPlan,
		affectedFiles: job.composerPlan?.affectedFiles ?? [],
		compileJobId: job.compileJobId,
		buildJobId: job.buildJobId,
		testOutput: job.testOutput,
		resultSummary: job.resultSummary,
		approvalRequired: mode === 'agent' || mode === 'composer' || mode === 'plan',
		approvalStatus: job.approvalStatus,
		tasks: buildActionTasks(job.state, job.plan),
		planDag: job.planDag,
		reviewerReport: job.reviewerReport,
		swarmJobId: job.swarmJobId
	};
}

export function listActiveJobs(): readonly AgentJobRecord[] {
	return [...jobs.values()].filter(j => j.status === 'IN_PROGRESS');
}
