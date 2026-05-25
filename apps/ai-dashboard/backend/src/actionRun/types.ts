import type { ComposerPlan } from '../composerPlanService.js';

export type ActionPhase =
	| 'understanding'
	| 'planning'
	| 'preview'
	| 'awaiting_approval'
	| 'applying'
	| 'building'
	| 'compiling'
	| 'testing'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type ActionRunMode = 'chat' | 'composer' | 'agent' | 'builder' | 'plan';

export type BuildTarget = 'web' | 'api' | 'exe' | 'apk';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ActionTask = {
	readonly id: string;
	readonly label: string;
	readonly state: 'pending' | 'active' | 'done' | 'failed';
};

export type ActionRunSnapshot = {
	readonly runId: string;
	readonly mode: ActionRunMode;
	readonly phase: ActionPhase;
	readonly planSummary?: string;
	readonly planSteps?: readonly string[];
	readonly composerPlan?: ComposerPlan;
	readonly affectedFiles?: readonly string[];
	readonly buildTarget?: BuildTarget;
	readonly compileJobId?: string;
	readonly buildJobId?: string;
	readonly testOutput?: string;
	readonly resultSummary?: string;
	readonly approvalRequired: boolean;
	readonly approvalStatus?: ApprovalStatus;
	readonly tasks?: readonly ActionTask[];
	readonly planDag?: import('../agentJob/types.js').PlanDag;
	readonly reviewerReport?: import('../agentJob/types.js').ReviewerReport;
	readonly swarmJobId?: string;
};

export function agentStateToActionPhase(state: string, approvalStatus?: ApprovalStatus): ActionPhase {
	switch (state) {
		case 'THINKING':
			return 'understanding';
		case 'PLANNING':
			return 'planning';
		case 'REVIEWING':
			return 'planning';
		case 'AWAITING_APPROVAL':
			return approvalStatus === 'approved' ? 'preview' : 'awaiting_approval';
		case 'APPLYING':
			return 'applying';
		case 'GENERATING':
			return 'planning';
		case 'COMPILING':
			return 'compiling';
		case 'TESTING':
			return 'testing';
		case 'HEALING':
			return 'testing';
		case 'SUCCESS':
			return 'completed';
		case 'FAILED':
			return 'failed';
		default:
			return 'understanding';
	}
}

export function buildActionTasks(state: string, planSteps: readonly string[]): readonly ActionTask[] {
	const phase = agentStateToActionPhase(state);
	const steps: ActionTask[] = [
		{ id: 'understand', label: 'Entender projeto', state: 'pending' },
		{ id: 'plan', label: 'Gerar plano', state: 'pending' },
		{ id: 'files', label: 'Listar arquivos', state: 'pending' },
		{ id: 'diff', label: 'Preparar diff', state: 'pending' },
		{ id: 'approve', label: 'Aguardar aprovacao', state: 'pending' },
		{ id: 'compile', label: 'Compilar', state: 'pending' },
		{ id: 'test', label: 'Testar', state: 'pending' },
		{ id: 'result', label: 'Resultado', state: 'pending' }
	];
	const order = ['understand', 'plan', 'files', 'diff', 'approve', 'compile', 'test', 'result'];
	const activeIdx =
		phase === 'understanding' ? 0
			: phase === 'planning' ? 1
				: phase === 'preview' || phase === 'awaiting_approval' ? 4
					: phase === 'applying' ? 4
						: phase === 'compiling' || phase === 'building' ? 5
							: phase === 'testing' ? 6
								: phase === 'completed' ? 8
									: phase === 'failed' || phase === 'cancelled' ? -1
										: 0;
	for (let i = 0; i < steps.length; i++) {
		const id = order[i];
		const step = steps.find(s => s.id === id);
		if (!step) {
			continue;
		}
		if (activeIdx < 0) {
			(step as { state: ActionTask['state'] }).state = i <= 3 ? 'done' : 'failed';
		} else if (i < activeIdx) {
			(step as { state: ActionTask['state'] }).state = 'done';
		} else if (i === activeIdx) {
			(step as { state: ActionTask['state'] }).state = 'active';
		}
	}
	if (planSteps.length > 0 && activeIdx >= 1) {
		const planStep = steps.find(s => s.id === 'plan');
		if (planStep) {
			(planStep as { label: string }).label = `Plano (${planSteps.length} passos)`;
		}
	}
	return steps;
}
