/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ensureCursorLayoutOnStartup, scheduleOpenPrincyChatOnStartup } from './princyWorkbenchChat';

export function registerPrincyWorkbenchUi(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (
				event.affectsConfiguration('princyai.ui.minimalWorkbench')
				|| event.affectsConfiguration('princyai.ui.openChatOnStartup')
				|| event.affectsConfiguration('princyai.chat.dockedRight')
			) {
				void applyPrincyWorkbenchLayout();
			}
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('princyai.ui.resetLayout', () => enforcePrincyEditorUnlocked())
	);
	void applyPrincyWorkbenchLayout();
}

async function applyPrincyWorkbenchLayout(): Promise<void> {
	const princy = vscode.workspace.getConfiguration('princyai');
	if (princy.get<boolean>('ui.minimalWorkbench', false)) {
		await applyMinimalWorkbench();
	} else {
		await applyPremiumWorkbench();
	}
}

/** Layout Cursor completo: editor visivel + chat dockado a direita (nao maximizado). */
export async function applyPremiumWorkbench(): Promise<void> {
	const target = vscode.ConfigurationTarget.Global;
	const wb = vscode.workspace.getConfiguration('workbench');
	const win = vscode.workspace.getConfiguration('window');
	const files = vscode.workspace.getConfiguration('files');

	// Travas antigas que escondem o editor ou maximizam o chat
	await wb.update('secondarySideBar.forceMaximized', false, target);
	await wb.update('secondarySideBar.defaultVisibility', 'visible', target);
	await wb.update('panel.opensMaximized', 'never', target);
	await wb.update('activityBar.visible', true, target);
	await wb.update('activityBar.location', 'default', target);
	await wb.update('layoutControl.enabled', true, target);
	await wb.update('statusBar.visible', true, target);
	await win.update('commandCenter', true, target);
	await win.update('menuBarVisibility', 'classic', target);

	await files.update('readonlyInclude', {}, target);
	await files.update('readonlyExclude', {}, target);
	await files.update('readonlyFromPermissions', false, target);

	await clearAuxiliaryBarFullscreen();

	const princy = vscode.workspace.getConfiguration('princyai');
	if (princy.get<boolean>('ui.openChatOnStartup', true)) {
		scheduleOpenPrincyChatOnStartup();
	}
	if (princy.get<boolean>('chat.dockedRight', true)) {
		await ensureCursorLayoutOnStartup();
	}
}

async function applyMinimalWorkbench(): Promise<void> {
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

	await clearAuxiliaryBarFullscreen();

	const princy = vscode.workspace.getConfiguration('princyai');
	if (princy.get<boolean>('ui.openChatOnStartup', true)) {
		scheduleOpenPrincyChatOnStartup();
	}
	await ensureCursorLayoutOnStartup();
}

/** Remove maximize da barra lateral direita (estado antigo em workspace storage). */
async function clearAuxiliaryBarFullscreen(): Promise<void> {
	try {
		await vscode.commands.executeCommand('workbench.action.restoreAuxiliaryBar');
	} catch {
		// comando pode nao existir nesta build
	}
}

/** Reaplica layout premium e desbloqueia edicao (apos pull ou settings antigos). */
export async function enforcePrincyEditorUnlocked(): Promise<void> {
	await applyPrincyWorkbenchLayout();
}
