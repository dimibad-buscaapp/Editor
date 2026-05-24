/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { labelForPrincyAiStatus, type PrincyAiStatusSnapshot } from './princyAiStatus';

let statusBarItem: vscode.StatusBarItem | undefined;
let current: PrincyAiStatusSnapshot = { kind: 'ready', label: labelForPrincyAiStatus('ready') };

export function registerPrincyStatusBar(context: vscode.ExtensionContext): void {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
	statusBarItem.command = 'princyai.chat.focus';
	statusBarItem.tooltip = 'Princy IA — clique para abrir o chat';
	context.subscriptions.push(statusBarItem);
	applyStatusBar(current);
	statusBarItem.show();
}

export async function setPrincyAiStatus(snapshot: PrincyAiStatusSnapshot): Promise<void> {
	current = snapshot;
	if (statusBarItem) {
		statusBarItem.text = `$(sparkle) ${snapshot.label}`;
		statusBarItem.backgroundColor = snapshot.kind === 'error'
			? new vscode.ThemeColor('statusBarItem.errorBackground')
			: snapshot.kind === 'offline'
				? new vscode.ThemeColor('statusBarItem.warningBackground')
				: undefined;
		statusBarItem.tooltip = snapshot.detail
			? `Princy IA — ${snapshot.detail}`
			: 'Princy IA — clique para abrir o chat';
	}
	try {
		await vscode.commands.executeCommand('princyai.updateTitleBarStatus', snapshot.label, snapshot.kind);
	} catch {
		// workbench command available after contrib loads
	}
}

export function getPrincyAiStatus(): PrincyAiStatusSnapshot {
	return current;
}

function applyStatusBar(snapshot: PrincyAiStatusSnapshot): void {
	if (!statusBarItem) {
		return;
	}
	statusBarItem.text = `$(sparkle) ${snapshot.label}`;
}
