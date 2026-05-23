/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type DiffLineKind = 'add' | 'remove' | 'ctx';

export interface DiffLine {
	readonly kind: DiffLineKind;
	readonly text: string;
}

/** Diff linha-a-linha simples para preview no webview. */
export function buildLineDiff(before: string, after: string, contextLines = 3): DiffLine[] {
	const a = before.split(/\r?\n/);
	const b = after.split(/\r?\n/);
	const lines: DiffLine[] = [];
	const max = Math.max(a.length, b.length);
	let i = 0;
	while (i < max) {
		if (a[i] === b[i]) {
			lines.push({ kind: 'ctx', text: '  ' + (a[i] ?? '') });
			i++;
			continue;
		}
		let j = i;
		while (j < max && a[j] !== b[j]) {
			j++;
		}
		const start = Math.max(0, i - contextLines);
		for (let k = start; k < i; k++) {
			if (lines.length === 0 || lines[lines.length - 1]?.text !== '  ' + (a[k] ?? '')) {
				lines.push({ kind: 'ctx', text: '  ' + (a[k] ?? '') });
			}
		}
		for (let k = i; k < j; k++) {
			if (k < a.length && (k >= b.length || a[k] !== b[k])) {
				lines.push({ kind: 'remove', text: '- ' + a[k] });
			}
			if (k < b.length && (k >= a.length || a[k] !== b[k])) {
				lines.push({ kind: 'add', text: '+ ' + b[k] });
			}
		}
		i = j;
	}
	if (lines.length > 80) {
		return lines.slice(0, 80);
	}
	return lines;
}
