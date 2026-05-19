import { createChatCompletion, type AgentModel } from './ai.js';
import { isHighComplexity } from './orchestrator/segments.js';
import type { ModelSegment } from './orchestrator/types.js';

export async function generateExecutionPlan(input: {
	readonly message: string;
	readonly segment: ModelSegment;
	readonly agent: AgentModel;
}): Promise<string[]> {
	if (!isHighComplexity(input.message)) {
		return [
			`Analisar pedido no segmento ${input.segment}`,
			'Gerar implementacao',
			'Validar compilacao e testes'
		];
	}

	const raw = await createChatCompletion([
		{
			role: 'system',
			content: 'Voce planeja tarefas de engenharia de software. Retorne somente JSON valido: {"plan":["passo 1","passo 2"]}. Maximo 6 passos curtos.'
		},
		{
			role: 'user',
			content: `Segmento: ${input.segment}\nPedido: ${input.message}`
		}
	], input.agent, {
		segment: input.segment,
		useOrchestrator: true
	});

	try {
		const start = raw.indexOf('{');
		const end = raw.lastIndexOf('}');
		if (start === -1 || end === -1) {
			throw new Error('JSON ausente');
		}
		const parsed = JSON.parse(raw.slice(start, end + 1)) as { plan?: string[] };
		if (!parsed.plan?.length) {
			throw new Error('Plano vazio');
		}
		return parsed.plan.slice(0, 6);
	} catch {
		return [
			`Planejar solucao (${input.segment})`,
			'Implementar codigo principal',
			'Gerar testes e validar build'
		];
	}
}
