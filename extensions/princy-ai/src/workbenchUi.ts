/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { focusPrincyChatPanel } from './princyWorkbenchChat';

export function registerPrincyWorkbenchUi(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('princyai.ui.minimalWorkbench') || event.affectsConfiguration('princyai.ui.openChatOnStartup')) {
				void applyMinimalWorkbench();
			}
		})
	);
	void applyMinimalWorkbench();
}

async function applyMinimalWorkbench(): Promise<void> {
	const princy = vscode.workspace.getConfiguration('princyai');
	if (!princy.get<boolean>('ui.minimalWorkbench', true)) {
		return;
	}

	const target = vscode.ConfigurationTarget.Global;
	const wb = vscode.workspace.getConfiguration('workbench');
	const win = vscode.workspace.getConfiguration('window');
	const ed = vscode.workspace.getConfiguration('editor');
	const bc = vscode.workspace.getConfiguration('breadcrumbs');

	await wb.update('activityBar.location', 'top', target);
	await wb.update('editor.showTabs', 'multiple', target);
	await wb.update('statusBar.visible', true, target);
	await wb.update('layoutControl.enabled', false, target);
	await wb.update('tips.enabled', false, target);
	await wb.update('secondarySideBar.defaultVisibility', 'visible', target);
	await wb.update('panel.defaultLocation', 'bottom', target);
	await wb.update('panel.opensMaximized', 'never', target);
	await wb.update('commandCenter.enabled', true, target);
	await wb.update('tree.indent', 12, target);
	await wb.update('editor.centeredLayoutAutoResize', true, target);
	await win.update('menuBarVisibility', 'compact', target);
	await ed.update('minimap.enabled', false, target);
	await ed.update('glyphMargin', false, target);
	await ed.update('lineHeight', 0, target);
	await ed.update('renderLineHighlight', 'line', target);
	await ed.update('scrollBeyondLastLine', false, target);
	await ed.update('smoothScrolling', true, target);
	await bc.update('enabled', true, target);

	if (princy.get<boolean>('ui.openChatOnStartup', true)) {
		setTimeout(() => void focusPrincyChatPanel(), 900);
	}
}
