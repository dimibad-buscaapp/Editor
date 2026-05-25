import { createChatCompletion } from '../ai.js';
import type { ComposerPlan } from '../composerPlanService.js';
import type { ReviewerReport } from './types.js';

export async function runReviewerAgent(params: {
	readonly instruction: string;
	readonly composerPlan: ComposerPlan;
	readonly agent: import('../ai.js').AgentModel;
}): Promise<ReviewerReport> {
	const opsSummary = params.composerPlan.operations.map(op => {
		const opType = (op as { type: string }).type;
		if (opType === 'runCommand') {
			return `- runCommand: ${(op as { command: string }).command}`;
		}
		if ('filePath' in op) {
			return `- ${opType}: ${(op as { filePath: string }).filePath}`;
		}
		return `- ${opType}`;
	}).join('\n');

	const raw = await createChatCompletion([
		{
			role: 'system',
			content: [
				'Voce e o Reviewer Agent da Princy IA — papel separado do implementador.',
				'Nao escreva codigo. Valide o plano/diff proposto.',
				'Responda APENAS JSON valido no formato:',
				'{"approved":boolean,"checklist":[{"item":string,"passed":boolean}],"summary":string,"suggestions":string[]}',
				'Checklist minima: seguranca, escopo, ficheiros corretos, comandos perigosos, testes.'
			].join('\n')
		},
		{
			role: 'user',
			content: [
				`Instrucao original:\n${params.instruction}`,
				`Resumo:\n${params.composerPlan.summary}`,
				`Ficheiros afetados:\n${params.composerPlan.affectedFiles.join(', ') || '(nenhum)'}`,
				`Operacoes:\n${opsSummary}`,
				params.composerPlan.warnings.length ? `Avisos:\n${params.composerPlan.warnings.join('\n')}` : ''
			].filter(Boolean).join('\n\n')
		}
	], params.agent, {
		useOrchestrator: false,
		maxTokens: 800,
		temperature: 0.1
	});

	return parseReviewerReport(raw);
}

function parseReviewerReport(raw: string): ReviewerReport {
	try {
		const jsonStart = raw.indexOf('{');
		const jsonEnd = raw.lastIndexOf('}');
		if (jsonStart >= 0 && jsonEnd > jsonStart) {
			const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<ReviewerReport>;
			return {
				approved: Boolean(parsed.approved),
				checklist: Array.isArray(parsed.checklist)
					? parsed.checklist.map(item => ({
						item: String((item as { item?: string }).item ?? 'item'),
						passed: Boolean((item as { passed?: boolean }).passed)
					}))
					: [],
				summary: String(parsed.summary ?? 'Revisao concluida.'),
				suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : []
			};
		}
	} catch {
		// fall through
	}

	const approved = !/rejeit|reject|bloque|unsafe|perigoso/i.test(raw);
	return {
		approved,
		checklist: [
			{ item: 'Analise automatica', passed: approved }
		],
		summary: raw.slice(0, 500) || 'Revisao heuristica concluida.',
		suggestions: approved ? [] : ['Revise o plano antes de aplicar.']
	};
}
