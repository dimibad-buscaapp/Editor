/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ensureCursorLayoutOnStartup, scheduleOpenPrincyChatOnStartup } from './princyWorkbenchChat';

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

	await wb.update('activityBar.location', 'default', target);
	await wb.update('editor.showTabs', 'multiple', target);
	await wb.update('statusBar.visible', true, target);
	await wb.update('layoutControl.enabled', true, target);
	await wb.update('tips.enabled', false, target);
	await wb.update('secondarySideBar.defaultVisibility', 'visible', target);
	await wb.update('secondarySideBar.forceMaximized', false, target);
	await wb.update('panel.defaultLocation', 'bottom', target);
	await wb.update('panel.opensMaximized', 'never', target);
	await win.update('commandCenter', true, target);
	await win.update('title', '${rootName}', target);
	await wb.update('tree.indent', 12, target);
	await wb.update('editor.centeredLayoutAutoResize', true, target);
	await win.update('menuBarVisibility', 'classic', target);
	await ed.update('minimap.enabled', false, target);
	await ed.update('glyphMargin', false, target);
	await ed.update('lineHeight', 0, target);
	await ed.update('renderLineHighlight', 'line', target);
	await ed.update('scrollBeyondLastLine', false, target);
	await ed.update('smoothScrolling', true, target);
	await bc.update('enabled', true, target);

	const files = vscode.workspace.getConfiguration('files');
	await files.update('readonlyInclude', {}, target);
	await files.update('readonlyExclude', {}, target);
	await files.update('readonlyFromPermissions', false, target);

	await wb.update('activityBar.visible', true, target);

	if (princy.get<boolean>('ui.openChatOnStartup', true)) {
		scheduleOpenPrincyChatOnStartup();
	}
	void ensureCursorLayoutOnStartup();
}

/** Reaplica layout Cursor e desbloqueia edicao (chamar apos pull/settings antigos). */
export async function enforcePrincyEditorUnlocked(): Promise<void> {
	await applyMinimalWorkbench();
}
