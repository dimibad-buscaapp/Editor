/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export function registerPrincyWorkbenchUi(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('princyai.ui.minimalWorkbench')) {
				void applyMinimalWorkbench();
			}
		})
	);
	void applyMinimalWorkbench();
}

async function applyMinimalWorkbench(): Promise<void> {
	if (!vscode.workspace.getConfiguration('princyai').get<boolean>('ui.minimalWorkbench', true)) {
		return;
	}

	const target = vscode.ConfigurationTarget.Global;
	const wb = vscode.workspace.getConfiguration('workbench');
	const win = vscode.workspace.getConfiguration('window');
	const ed = vscode.workspace.getConfiguration('editor');

	await wb.update('activityBar.location', 'top', target);
	await wb.update('editor.showTabs', 'multiple', target);
	await wb.update('statusBar.visible', true, target);
	await wb.update('layoutControl.enabled', false, target);
	await wb.update('tips.enabled', false, target);
	await win.update('menuBarVisibility', 'compact', target);
	await ed.update('minimap.enabled', false, target);
	await vscode.workspace.getConfiguration('breadcrumbs').update('enabled', true, target);
}
