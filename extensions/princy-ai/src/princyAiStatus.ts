/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Estados visuais sincronizados (StatusBar + title bar + webview). */
export type PrincyAiVisualStatus =
	| 'offline'
	| 'ready'
	| 'thinking'
	| 'planning'
	| 'editing'
	| 'testing'
	| 'building'
	| 'fixing'
	| 'error';

export interface PrincyAiStatusSnapshot {
	readonly kind: PrincyAiVisualStatus;
	readonly label: string;
	readonly detail?: string;
}

const LABELS: Record<PrincyAiVisualStatus, string> = {
	offline: 'IA: Offline',
	ready: 'IA: Pronto',
	thinking: 'IA: Thinking',
	planning: 'IA: Planning',
	editing: 'IA: Editing',
	testing: 'IA: Testing',
	building: 'IA: Building',
	fixing: 'IA: Fixing',
	error: 'IA: Erro'
};

export function labelForPrincyAiStatus(kind: PrincyAiVisualStatus): string {
	return LABELS[kind] ?? LABELS.ready;
}

/** Mapeia FSM do agent backend para status premium. */
export function mapAgentJobStateToStatus(state: string, hasContent = false): PrincyAiStatusSnapshot {
	const upper = state.toUpperCase();
	if (upper === 'THINKING') {
		return { kind: 'thinking', label: labelForPrincyAiStatus('thinking') };
	}
	if (upper === 'PLANNING') {
		return { kind: 'planning', label: labelForPrincyAiStatus('planning') };
	}
	if (upper === 'AWAITING_APPROVAL') {
		return { kind: 'planning', label: 'IA: Aguardando aprovacao' };
	}
	if (upper === 'APPLYING') {
		return { kind: 'editing', label: 'IA: Aplicando mudancas' };
	}
	if (upper === 'GENERATING') {
		return { kind: hasContent ? 'editing' : 'planning', label: labelForPrincyAiStatus(hasContent ? 'editing' : 'planning') };
	}
	if (upper === 'COMPILING') {
		return { kind: 'editing', label: 'IA: Editing (compile)' };
	}
	if (upper === 'TESTING') {
		return { kind: 'testing', label: labelForPrincyAiStatus('testing') };
	}
	if (upper === 'HEALING') {
		return { kind: 'fixing', label: labelForPrincyAiStatus('fixing') };
	}
	if (upper === 'FAILED') {
		return { kind: 'error', label: labelForPrincyAiStatus('error') };
	}
	if (upper === 'SUCCESS') {
		return { kind: 'ready', label: labelForPrincyAiStatus('ready') };
	}
	return { kind: 'ready', label: labelForPrincyAiStatus('ready') };
}

/** Fase do painel Agent (track estilo Cursor) a partir do estado do job. */
export function actionRunPhaseForAgentState(state: string): string {
	const upper = state.toUpperCase();
	if (upper === 'THINKING' || upper === 'PLANNING') {
		return 'planning';
	}
	if (upper === 'GENERATING') {
		return 'generating';
	}
	if (upper === 'AWAITING_APPROVAL') {
		return 'awaiting_approval';
	}
	if (upper === 'APPLYING') {
		return 'applying';
	}
	if (upper === 'COMPILING') {
		return 'building';
	}
	if (upper === 'TESTING' || upper === 'HEALING') {
		return 'verifying';
	}
	if (upper === 'SUCCESS') {
		return 'done';
	}
	if (upper === 'FAILED') {
		return 'failed';
	}
	return 'planning';
}

export function thinkingStepsForAgentState(state: string): Array<{ label: string; state: 'active' | 'done' | 'pending' }> {
	const upper = state.toUpperCase();
	const order = ['THINKING', 'PLANNING', 'AWAITING_APPROVAL', 'APPLYING', 'COMPILING', 'TESTING'] as const;
	const labels: Record<string, string> = {
		THINKING: 'Thinking',
		PLANNING: 'Planning',
		AWAITING_APPROVAL: 'Aprovar diff',
		APPLYING: 'Applying',
		GENERATING: 'Planning',
		COMPILING: 'Editing',
		TESTING: 'Testing'
	};
	if (upper === 'HEALING') {
		return [
			{ label: 'Thinking', state: 'done' },
			{ label: 'Planning', state: 'done' },
			{ label: 'Editing', state: 'done' },
			{ label: 'Testing', state: 'done' },
			{ label: 'Fixing', state: 'active' }
		];
	}
	let idx = order.indexOf(upper as typeof order[number]);
	if (idx === -1 && upper === 'GENERATING') {
		idx = 1;
	}
	if (idx === -1) {
		idx = 0;
	}
	return order.map((key, i) => ({
		label: labels[key] ?? key,
		state: i < idx ? 'done' : i === idx ? 'active' : 'pending'
	}));
}
