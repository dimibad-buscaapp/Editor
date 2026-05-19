import type { ChatMessage } from '../ai.js';
import { config } from '../config.js';
import { segmentEngines } from './engines.js';
import { callEngine } from './providers.js';
import { detectSegment, isHighComplexity } from './segments.js';
import type { EngineSpec, ModelSegment, OrchestratorExecuteOptions, OrchestratorResult, OrchestratorStatus } from './types.js';

const validationMarkers = ['erro', 'error', 'correcao', 'correção', 'incorreto', 'falha', 'bug', 'problema', 'inseguro', 'nao compila', 'não compila'];

export class PrincyOrchestrator {
	async execute(options: OrchestratorExecuteOptions): Promise<OrchestratorResult> {
		const startedAt = Date.now();
		const userPrompt = this.extractUserPrompt(options.messages);
		const segment = options.segment ?? detectSegment(userPrompt, options.filePath, options.languageId);
		const engines = segmentEngines[segment];
		const enginesUsed: string[] = [];
		let consensusApplied = false;
		let usedFallback = false;

		let result = await this.tryEnginesInOrder(engines, options.messages, enginesUsed);
		if (enginesUsed.length > 1) {
			usedFallback = true;
		}

		if (config.orchestratorConsensusEnabled && isHighComplexity(userPrompt)) {
			consensusApplied = true;
			const validation = await this.tryEnginesInOrder(
				[engines[1], engines[2]],
				[
					{
						role: 'system',
						content: 'Voce valida codigo gerado por outro modelo. Responda de forma objetiva. Se houver problema, comece com CORRECAO: e descreva o erro.'
					},
					{
						role: 'user',
						content: `Valide este resultado e aponte erros ou riscos:\n\n${result.content}`
					}
				],
				enginesUsed,
				true
			);

			if (this.needsRefinement(validation.content)) {
				result = await this.tryEnginesInOrder(
					[engines[2], engines[0]],
					[
						{
							role: 'system',
							content: 'Voce corrige e melhora codigo com base em feedback de validacao. Retorne a versao final corrigida.'
						},
						{
							role: 'user',
							content: [
								`Feedback do validador:\n${validation.content}`,
								`Resultado original:\n${result.content}`,
								`Pedido original:\n${userPrompt}`
							].join('\n\n')
						}
					],
					enginesUsed,
					true
				);
				usedFallback = true;
			}
		}

		const uniqueEngines = [...new Set(enginesUsed)];
		const primaryEngine = uniqueEngines[0]?.split('@')[0] ?? engines[0].id;
		const fallbackEngines = uniqueEngines.slice(1).map(engine => engine.split('@')[0]);

		return {
			content: result.content,
			segment,
			enginesUsed: uniqueEngines,
			primaryEngine,
			fallbackEngines,
			consensusApplied,
			status: usedFallback ? 'FALLBACK' : 'COMPLETED',
			executionTimeMs: Date.now() - startedAt
		};
	}

	private async tryEnginesInOrder(
		engines: readonly EngineSpec[],
		messages: readonly ChatMessage[],
		enginesUsed: string[],
		allowDuplicate = false
	): Promise<{ content: string }> {
		const errors: string[] = [];

		for (const engine of engines) {
			const engineKey = `${engine.id}@${engine.provider}`;
			if (!allowDuplicate && enginesUsed.some(used => used.startsWith(`${engine.id}@`))) {
				continue;
			}

			try {
				const response = await callEngine(engine, messages);
				enginesUsed.push(`${engine.id}@${response.provider}`);
				return { content: response.content };
			} catch (error) {
				errors.push(`${engine.id}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		throw new Error(`Todos os motores falharam. ${errors.join(' | ')}`);
	}

	private extractUserPrompt(messages: readonly ChatMessage[]): string {
		const userMessages = messages.filter(message => message.role === 'user');
		return userMessages[userMessages.length - 1]?.content ?? '';
	}

	private needsRefinement(validation: string): boolean {
		const normalized = validation.toLowerCase();
		return validationMarkers.some(marker => normalized.includes(marker));
	}
}

let orchestrator: PrincyOrchestrator | undefined;

export function getPrincyOrchestrator(): PrincyOrchestrator {
	orchestrator ??= new PrincyOrchestrator();
	return orchestrator;
}

export async function runDebugAutoHeal(input: {
	readonly originalMessage: string;
	readonly previousContent: string;
	readonly compileOutput: string;
	readonly messages: readonly ChatMessage[];
}): Promise<OrchestratorResult> {
	const orchestratorInstance = getPrincyOrchestrator();
	return orchestratorInstance.execute({
		segment: 'DEBUG',
		messages: [
			...input.messages,
			{
				role: 'system',
				content: 'Modo auto-healing: corrija o erro de compilacao ou build sem explicar o processo.'
			},
			{
				role: 'user',
				content: [
					`Pedido original: ${input.originalMessage}`,
					`Resposta anterior:\n${input.previousContent}`,
					`Erro de compilacao/build:\n${input.compileOutput}`,
					'Retorne a correcao final pronta para aplicar.'
				].join('\n\n')
			}
		]
	});
}
