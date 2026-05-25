import { createChatCompletion } from '../ai.js';
import type { AgentRole, PlanDag, PlanDagNode } from '../agentJob/types.js';

export async function generatePlanDag(params: {
	readonly message: string;
	readonly agent: import('../ai.js').AgentModel;
}): Promise<PlanDag> {
	const raw = await createChatCompletion([
		{
			role: 'system',
			content: [
				'Voce e o Planner da Princy IA.',
				'Decomponha o pedido num DAG de tarefas (JSON apenas).',
				'Formato: {"summary":string,"nodes":[{"id":"t1","label":string,"role":"frontend|backend|qa|docs|research","dependsOn":[]}]}',
				'Maximo 8 nos. Sem codigo — so roadmap.'
			].join('\n')
		},
		{ role: 'user', content: params.message }
	], params.agent, {
		useOrchestrator: false,
		maxTokens: 1200,
		temperature: 0.2
	});

	return parsePlanDag(raw, params.message);
}

function parsePlanDag(raw: string, fallbackMessage: string): PlanDag {
	try {
		const jsonStart = raw.indexOf('{');
		const jsonEnd = raw.lastIndexOf('}');
		if (jsonStart >= 0 && jsonEnd > jsonStart) {
			const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
				summary?: string;
				nodes?: Array<{ id?: string; label?: string; role?: string; dependsOn?: string[] }>;
			};
			const nodes: PlanDagNode[] = (parsed.nodes ?? []).map((node, index) => ({
				id: String(node.id ?? `t${index + 1}`),
				label: String(node.label ?? `Tarefa ${index + 1}`),
				role: parseRole(node.role),
				dependsOn: Array.isArray(node.dependsOn) ? node.dependsOn.map(String) : [],
				state: 'pending' as const
			}));
			if (nodes.length > 0) {
				return {
					summary: String(parsed.summary ?? fallbackMessage.slice(0, 200)),
					nodes
				};
			}
		}
	} catch {
		// fall through
	}

	return {
		summary: fallbackMessage.slice(0, 200),
		nodes: [
			{ id: 't1', label: 'Analisar requisitos', role: 'planner', dependsOn: [], state: 'pending' },
			{ id: 't2', label: 'Implementar backend', role: 'backend', dependsOn: ['t1'], state: 'pending' },
			{ id: 't3', label: 'Implementar frontend', role: 'frontend', dependsOn: ['t1'], state: 'pending' },
			{ id: 't4', label: 'Validar (QA)', role: 'qa', dependsOn: ['t2', 't3'], state: 'pending' }
		]
	};
}

function parseRole(raw?: string): AgentRole | undefined {
	const value = (raw ?? '').toLowerCase();
	if (value === 'frontend' || value === 'backend' || value === 'qa' || value === 'docs' || value === 'research' || value === 'planner' || value === 'reviewer') {
		return value;
	}
	return undefined;
}
