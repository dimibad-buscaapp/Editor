/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { enforcePrincyEditorUnlocked } from './workbenchUi';
import type { PrincyChatViewProvider } from './chatView';

const UNLOCK_INTERVAL_MS = 8000;
const UNLOCK_DURATION_MS = 180_000;

/** Desbloqueio visual/ediciao global: layout + recarga do painel chat (cache webview). */
export function registerPrincyVisualUnlock(
	context: vscode.ExtensionContext,
	provider: PrincyChatViewProvider
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('princyai.ui.forceVisualReload', () => {
			void runGlobalVisualUnlock(provider, true);
		}),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (
				event.affectsConfiguration('princyai.ui.forceVisualUnlock')
				|| event.affectsConfiguration('workbench.secondarySideBar.forceMaximized')
				|| event.affectsConfiguration('workbench.secondarySideBar.defaultVisibility')
				|| event.affectsConfiguration('files.readonlyInclude')
			) {
				void runGlobalVisualUnlock(provider, false);
			}
		}),
		vscode.window.onDidChangeWindowState(state => {
			if (state.focused && isForceVisualUnlockEnabled()) {
				void runGlobalVisualUnlock(provider, false);
			}
		})
	);

	void runGlobalVisualUnlock(provider, false);

	const started = Date.now();
	const timer = setInterval(() => {
		if (!isForceVisualUnlockEnabled()) {
			clearInterval(timer);
			return;
		}
		if (Date.now() - started > UNLOCK_DURATION_MS) {
			clearInterval(timer);
			return;
		}
		void runGlobalVisualUnlock(provider, false);
	}, UNLOCK_INTERVAL_MS);
	context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

function isForceVisualUnlockEnabled(): boolean {
	return vscode.workspace.getConfiguration('princyai').get<boolean>('ui.forceVisualUnlock', true);
}

export async function runGlobalVisualUnlock(
	provider: PrincyChatViewProvider,
	showMessage: boolean
): Promise<void> {
	if (!isForceVisualUnlockEnabled()) {
		return;
	}

	const target = vscode.ConfigurationTarget.Global;
	const wb = vscode.workspace.getConfiguration('workbench');
	const files = vscode.workspace.getConfiguration('files');

	await wb.update('secondarySideBar.forceMaximized', false, target);
	await wb.update('secondarySideBar.defaultVisibility', 'visible', target);
	await files.update('readonlyInclude', {}, target);
	await files.update('readonlyExclude', {}, target);
	await files.update('readonlyFromPermissions', false, target);
	await vscode.workspace.getConfiguration('editor').update('centeredLayoutAutoResize', false, target);

	await enforcePrincyEditorUnlocked();
	try {
		await vscode.commands.executeCommand('princy.unlockEditorLayout');
	} catch {
		// workbench command only in Code OSS build with contrib princy
	}
	provider.forceReloadPanel();

	if (showMessage) {
		void vscode.window.showInformationMessage('Princy: visual e layout recarregados (Ctrl+F5 no browser se usar webeditor).');
	}
}
