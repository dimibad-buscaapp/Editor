import { z } from 'zod';
import { agentConfigs, createChatCompletion, type AgentModel } from './ai.js';
import { buildRagSystemPrompt, retrieveAgentRelevantChunks } from './rag.js';

const composerOperationSchema = z.discriminatedUnion('type', [
	z.object({
		id: z.string().optional(),
		type: z.literal('create'),
		filePath: z.string().min(1),
		content: z.string(),
		rationale: z.string().optional()
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('modify'),
		filePath: z.string().min(1),
		search: z.string().optional(),
		replace: z.string().optional(),
		content: z.string().optional(),
		rationale: z.string().optional()
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('delete'),
		filePath: z.string().min(1),
		rationale: z.string().optional()
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('runCommand'),
		command: z.string().min(1),
		rationale: z.string().optional()
	})
]);

export const composerPlanSchema = z.object({
	summary: z.string().min(1),
	warnings: z.array(z.string()).default([]),
	affectedFiles: z.array(z.string()).default([]),
	operations: z.array(composerOperationSchema).default([])
});

export type ComposerPlan = z.infer<typeof composerPlanSchema>;
export type ComposerOperation = z.infer<typeof composerOperationSchema>;

export type ComposerPlanRequest = {
	readonly agent: AgentModel;
	readonly instruction: string;
	readonly shadowContext?: unknown;
	readonly codeGraph?: unknown;
};

function buildSilentContext(shadowContext: unknown, codeGraph: unknown): string {
	const parts: string[] = [];
	if (shadowContext) {
		parts.push(`\n\n[CONTEXTO SILENCIOSO]\n${JSON.stringify(shadowContext).slice(0, 50000)}`);
	}
	if (codeGraph) {
		parts.push(`\n\n[CODE GRAPH]\n${JSON.stringify(codeGraph).slice(0, 20000)}`);
	}
	return parts.join('');
}

function normalizeComposerOperation(raw: unknown): ComposerOperation | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const op = raw as Record<string, unknown>;
	const type = op.type === 'edit' ? 'modify' : op.type;
	const candidate = { ...op, type };
	const parsed = composerOperationSchema.safeParse(candidate);
	return parsed.success ? parsed.data : undefined;
}

function extractJsonObject(value: string): string {
	const trimmed = value.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
	const candidate = fenced?.[1] ?? trimmed;
	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('A IA nao retornou um plano Composer em JSON valido.');
	}
	return candidate.slice(start, end + 1);
}

export function parseComposerPlan(value: string): ComposerPlan {
	const json = extractJsonObject(value);
	const parsedUnknown: unknown = JSON.parse(json);
	const direct = composerPlanSchema.safeParse(parsedUnknown);
	if (direct.success) {
		return {
			...direct.data,
			operations: direct.data.operations.map((operation, index) => ({
				...operation,
				id: operation.id ?? `op-${index + 1}`
			}))
		};
	}

	const obj = parsedUnknown as Record<string, unknown>;
	const summary = typeof obj.summary === 'string' && obj.summary.trim().length > 0
		? obj.summary.trim()
		: 'Plano Composer (revise as operacoes sugeridas pela IA)';
	const warnings = Array.isArray(obj.warnings)
		? obj.warnings.filter((w): w is string => typeof w === 'string')
		: [];
	if (direct.error) {
		warnings.push(`Schema parcial: ${direct.error.issues.map(issue => issue.message).join('; ')}`);
	}
	const affectedFiles = Array.isArray(obj.affectedFiles)
		? obj.affectedFiles.filter((f): f is string => typeof f === 'string')
		: [];
	const operations: ComposerOperation[] = [];
	if (Array.isArray(obj.operations)) {
		for (const rawOp of obj.operations) {
			const op = normalizeComposerOperation(rawOp);
			if (op) {
				operations.push(op);
			}
		}
	}

	return {
		summary,
		warnings,
		affectedFiles,
		operations: operations.map((operation, index) => ({
			...operation,
			id: operation.id ?? `op-${index + 1}`
		}))
	};
}

export async function generateComposerPlan(request: ComposerPlanRequest): Promise<ComposerPlan> {
	const chunks = await retrieveAgentRelevantChunks(request.instruction);
	const response = await createChatCompletion([
		{
			role: 'system',
			content: [
				buildRagSystemPrompt(chunks),
				`Agente selecionado: ${agentConfigs[request.agent].label}.`,
				'Voce esta no Composer Mode. Retorne somente JSON valido, sem Markdown.',
				'O JSON deve seguir este formato:',
				'{"summary":"...","warnings":["..."],"affectedFiles":["src/a.ts"],"operations":[{"type":"modify","filePath":"src/a.ts","search":"codigo antigo","replace":"codigo novo","rationale":"..."}]}',
				'Use operacoes create, modify, delete e runCommand. Para modify, prefira search/replace pequeno em vez de arquivo inteiro.'
			].join('\n\n')
		},
		{
			role: 'user',
			content: `${request.instruction}${buildSilentContext(request.shadowContext, request.codeGraph)}`
		}
	], request.agent, {
		segment: 'LOGIC',
		useOrchestrator: true
	});

	return parseComposerPlan(response);
}
