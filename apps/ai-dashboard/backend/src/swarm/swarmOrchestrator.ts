import { prisma } from '../prisma.js';
import { startAgentJob } from '../agentJob/runner.js';
import type { AgentRole, SwarmGraph, SwarmGraphNode } from '../agentJob/types.js';
import { generatePlanDag } from '../agentJob/planDagGenerator.js';
import type { AgentChatRequest } from '../agentChatService.js';
import { resolveWorkspaceId } from '../memoryGraph/memoryGraphService.js';
import { allocateWorktree, releaseSwarmWorktrees } from './worktreePool.js';

const swarmJobs = new Map<string, SwarmRuntime>();

type SwarmRuntime = {
	readonly id: string;
	readonly prompt: string;
	readonly workspaceId: string;
	status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	readonly concurrency: number;
	readonly nodes: SwarmGraphNode[];
	readonly request: AgentChatRequest;
	running: number;
};

const DEFAULT_CONCURRENCY = 3;

function newSwarmId(): string {
	return `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSubJobId(swarmId: string, role: string): string {
	return `${swarmId}-${role}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildEdges(nodes: readonly SwarmGraphNode[]): SwarmGraph['edges'] {
	const edges: Array<{ from: string; to: string }> = [];
	for (const node of nodes) {
		for (const dep of node.dependsOn) {
			edges.push({ from: dep, to: node.id });
		}
	}
	return edges;
}

export async function startSwarmJob(request: AgentChatRequest, concurrency = DEFAULT_CONCURRENCY): Promise<SwarmGraph> {
	const swarmId = newSwarmId();
	const workspaceId = resolveWorkspaceId({ workspaceId: request.workspaceId, context: request.context });
	const dag = await generatePlanDag({ message: request.message, agent: request.agent });

	const nodes: SwarmGraphNode[] = dag.nodes.map(node => ({
		id: node.id,
		role: (node.role ?? 'backend') as AgentRole,
		label: node.label,
		state: 'pending',
		status: 'IN_PROGRESS',
		dependsOn: node.dependsOn
	}));

	const graph: SwarmGraph = {
		swarmJobId: swarmId,
		status: 'IN_PROGRESS',
		prompt: request.message,
		nodes,
		edges: buildEdges(nodes)
	};

	await prisma.swarmJob.create({
		data: {
			id: swarmId,
			workspaceId,
			prompt: request.message,
			status: 'IN_PROGRESS',
			graph: graph as unknown as object,
			concurrency,
			subJobs: {
				create: nodes.map(node => ({
					id: newSubJobId(swarmId, node.role),
					role: node.role,
					status: 'IN_PROGRESS',
					state: 'pending',
					dependsOn: [...node.dependsOn]
				}))
			}
		}
	});

	const runtime: SwarmRuntime = {
		id: swarmId,
		prompt: request.message,
		workspaceId,
		status: 'IN_PROGRESS',
		concurrency,
		nodes: [...nodes],
		request,
		running: 0
	};
	swarmJobs.set(swarmId, runtime);

	void runSwarmOrchestrator(swarmId).catch(async error => {
		runtime.status = 'FAILED';
		await prisma.swarmJob.update({
			where: { id: swarmId },
			data: { status: 'FAILED', graph: { ...graph, status: 'FAILED', error: String(error) } as object }
		});
	});

	return graph;
}

export async function getSwarmGraph(swarmJobId: string): Promise<SwarmGraph | undefined> {
	const runtime = swarmJobs.get(swarmJobId);
	if (runtime) {
		return {
			swarmJobId: runtime.id,
			status: runtime.status,
			prompt: runtime.prompt,
			nodes: runtime.nodes,
			edges: buildEdges(runtime.nodes)
		};
	}

	const row = await prisma.swarmJob.findUnique({
		where: { id: swarmJobId },
		include: { subJobs: true }
	});
	if (!row) {
		return undefined;
	}

	const stored = row.graph as SwarmGraph | null;
	if (stored?.nodes?.length) {
		return stored;
	}

	const nodes: SwarmGraphNode[] = row.subJobs.map(sub => ({
		id: sub.id,
		role: sub.role as AgentRole,
		label: sub.role,
		state: sub.state,
		status: sub.status,
		dependsOn: Array.isArray(sub.dependsOn) ? (sub.dependsOn as string[]) : [],
		agentJobId: sub.agentJobId ?? undefined,
		worktreePath: sub.worktreePath ?? undefined
	}));

	return {
		swarmJobId: row.id,
		status: row.status,
		prompt: row.prompt,
		nodes,
		edges: buildEdges(nodes)
	};
}

async function persistSwarmGraph(runtime: SwarmRuntime): Promise<void> {
	const graph: SwarmGraph = {
		swarmJobId: runtime.id,
		status: runtime.status,
		prompt: runtime.prompt,
		nodes: runtime.nodes,
		edges: buildEdges(runtime.nodes)
	};
	await prisma.swarmJob.update({
		where: { id: runtime.id },
		data: { status: runtime.status, graph: graph as unknown as object }
	});
}

function depsSatisfied(node: SwarmGraphNode, nodes: readonly SwarmGraphNode[]): boolean {
	return node.dependsOn.every(depId => {
		const dep = nodes.find(n => n.id === depId);
		return dep?.state === 'done';
	});
}

async function runSwarmOrchestrator(swarmJobId: string): Promise<void> {
	const runtime = swarmJobs.get(swarmJobId);
	if (!runtime) {
		return;
	}

	const rolesToRelease: AgentRole[] = [];

	while (runtime.nodes.some(n => n.state !== 'done' && n.state !== 'failed')) {
		const ready = runtime.nodes.filter(n =>
			n.state === 'pending'
			&& depsSatisfied(n, runtime.nodes)
		).slice(0, Math.max(0, runtime.concurrency - runtime.running));

		if (ready.length === 0) {
			if (runtime.running === 0) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 500));
			continue;
		}

		await Promise.all(ready.map(async node => {
			runtime.running++;
			updateNode(runtime, node.id, { state: 'active', status: 'IN_PROGRESS' });
			await persistSwarmGraph(runtime);

			try {
				const worktreePath = await allocateWorktree({
					swarmJobId: runtime.id,
					role: node.role
				});

				const subJob = await prisma.swarmSubJob.findFirst({
					where: { swarmJobId: runtime.id, role: node.role }
				});

				const agentSnapshot = startAgentJob({
					...runtime.request,
					message: `[Swarm ${node.role}] ${node.label}\n\nContexto swarm:\n${runtime.prompt}`,
					mode: 'agent',
					workspaceId: runtime.workspaceId,
					swarmJobId: runtime.id,
					swarmRole: node.role,
					worktreePath
				});

				if (subJob) {
					await prisma.swarmSubJob.update({
						where: { id: subJob.id },
						data: {
							state: 'active',
							worktreePath,
							agentJobId: agentSnapshot.jobId
						}
					});
				}

				updateNode(runtime, node.id, {
					state: 'done',
					status: 'COMPLETED',
					agentJobId: agentSnapshot.jobId,
					worktreePath
				});
				rolesToRelease.push(node.role);
			} catch (error) {
				updateNode(runtime, node.id, {
					state: 'failed',
					status: 'FAILED'
				});
				await prisma.swarmSubJob.updateMany({
					where: { swarmJobId: runtime.id, role: node.role },
					data: { state: 'failed', status: 'FAILED', error: error instanceof Error ? error.message : String(error) }
				});
			} finally {
				runtime.running--;
				await persistSwarmGraph(runtime);
			}
		}));
	}

	const allDone = runtime.nodes.every(n => n.state === 'done');
	runtime.status = allDone ? 'COMPLETED' : 'FAILED';
	await persistSwarmGraph(runtime);
	await releaseSwarmWorktrees(runtime.id, rolesToRelease);
}

function updateNode(runtime: SwarmRuntime, nodeId: string, patch: Partial<SwarmGraphNode>): void {
	const index = runtime.nodes.findIndex(n => n.id === nodeId);
	if (index >= 0) {
		runtime.nodes[index] = { ...runtime.nodes[index], ...patch };
	}
}

export async function loadSwarmJobsFromDb(): Promise<void> {
	const rows = await prisma.swarmJob.findMany({
		where: { status: 'IN_PROGRESS' },
		include: { subJobs: true }
	});
	for (const row of rows) {
		const graph = row.graph as SwarmGraph | null;
		const nodes = graph?.nodes ?? row.subJobs.map(sub => ({
			id: sub.id,
			role: sub.role as AgentRole,
			label: sub.role,
			state: sub.state,
			status: sub.status,
			dependsOn: Array.isArray(sub.dependsOn) ? (sub.dependsOn as string[]) : [],
			agentJobId: sub.agentJobId ?? undefined,
			worktreePath: sub.worktreePath ?? undefined
		}));
		swarmJobs.set(row.id, {
			id: row.id,
			prompt: row.prompt,
			workspaceId: row.workspaceId ?? 'default',
			status: 'IN_PROGRESS',
			concurrency: row.concurrency,
			nodes: [...nodes],
			request: { agent: 'princy', message: row.prompt },
			running: 0
		});
		void runSwarmOrchestrator(row.id);
	}
}
