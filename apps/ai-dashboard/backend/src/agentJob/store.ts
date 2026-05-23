import { agentStateToActionPhase, buildActionTasks, type ActionRunSnapshot } from '../actionRun/types.js';
import type { AgentJobRecord, AgentJobSnapshot } from './types.js';

const jobs = new Map<string, AgentJobRecord>();

export function createJob(record: AgentJobRecord): AgentJobRecord {
	jobs.set(record.id, record);
	return record;
}

export function getJob(jobId: string): AgentJobRecord | undefined {
	return jobs.get(jobId);
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
	return next;
}

export function appendThinking(jobId: string, line: string): void {
	const job = jobs.get(jobId);
	if (!job) {
		return;
	}
	job.thinkingLog.push(line);
	job.updatedAt = Date.now();
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
		resultSummary: job.resultSummary
	};
}

export function toActionRunSnapshot(job: AgentJobRecord): ActionRunSnapshot {
	const mode = job.mode ?? job.request.mode ?? 'agent';
	return {
		runId: job.id,
		mode,
		phase: agentStateToActionPhase(job.state, job.approvalStatus),
		planSummary: job.composerPlan?.summary ?? job.content.slice(0, 500),
		planSteps: job.plan,
		composerPlan: job.composerPlan,
		affectedFiles: job.composerPlan?.affectedFiles ?? [],
		compileJobId: job.compileJobId,
		buildJobId: job.buildJobId,
		testOutput: job.testOutput,
		resultSummary: job.resultSummary,
		approvalRequired: mode === 'agent' || mode === 'composer',
		approvalStatus: job.approvalStatus,
		tasks: buildActionTasks(job.state, job.plan)
	};
}
