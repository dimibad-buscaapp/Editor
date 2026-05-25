/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { safeConfigUpdate } from './configSafe';
import {
	applyPrincySecondarySideBarVisibilitySetting,
	ensureCursorLayoutOnStartup,
	getPrincySecondarySideBarDefaultVisibility,
	scheduleOpenPrincyChatOnStartup,
	shouldOpenChatOnStartup
} from './princyWorkbenchChat';

export function registerPrincyWorkbenchUi(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (
				event.affectsConfiguration('princyai.ui.minimalWorkbench')
				|| event.affectsConfiguration('princyai.ui.openChatOnStartup')
				|| event.affectsConfiguration('princyai.ui.panelOpenOnStartup')
				|| event.affectsConfiguration('princyai.chat.dockedRight')
				|| event.affectsConfiguration('workbench.secondarySideBar.forceMaximized')
				|| event.affectsConfiguration('workbench.secondarySideBar.defaultVisibility')
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
	// Sempre desbloqueia layout premium primeiro (minimalWorkbench nao pode pular isto)
	await applyPremiumWorkbench();
	const princy = vscode.workspace.getConfiguration('princyai');
	if (princy.get<boolean>('ui.minimalWorkbench', false)) {
		await applyMinimalWorkbenchExtras();
	}
}

/** Layout Cursor: editor visivel + chat dockado a direita (nunca maximizado). */
export async function applyPremiumWorkbench(): Promise<void> {
	const target = vscode.ConfigurationTarget.Global;
	const wb = vscode.workspace.getConfiguration('workbench');
	const win = vscode.workspace.getConfiguration('window');
	const files = vscode.workspace.getConfiguration('files');
	const princy = vscode.workspace.getConfiguration('princyai');

	// Desativa travas de layout / visual antigo
	await applyPrincySecondarySideBarVisibilitySetting();
	await safeConfigUpdate('workbench', 'panel.opensMaximized', 'never', target);
	await safeConfigUpdate('workbench', 'startupEditor', 'none', target);
	await safeConfigUpdate('workbench', 'welcomePage.experimentalOnboarding', false, target);
	await safeConfigUpdate('workbench', 'editor.centeredLayoutAutoResize', false, target);
	await safeConfigUpdate('workbench', 'activityBar.visible', true, target);
	await safeConfigUpdate('workbench', 'activityBar.location', 'default', target);
	await safeConfigUpdate('workbench', 'layoutControl.enabled', true, target);
	await safeConfigUpdate('workbench', 'statusBar.visible', true, target);
	await safeConfigUpdate('window', 'commandCenter', true, target);
	await safeConfigUpdate('window', 'menuBarVisibility', 'classic', target);

	await safeConfigUpdate('files', 'readonlyInclude', {}, target);
	await safeConfigUpdate('files', 'readonlyExclude', {}, target);
	await safeConfigUpdate('files', 'readonlyFromPermissions', false, target);

	await clearAuxiliaryBarFullscreen();

	if (shouldOpenChatOnStartup()) {
		scheduleOpenPrincyChatOnStartup();
		if (princy.get<boolean>('chat.dockedRight', true)) {
			await ensureCursorLayoutOnStartup();
		}
	} else {
		// Garante setting hidden mesmo se outro modulo gravou visible
		const expected = getPrincySecondarySideBarDefaultVisibility();
		if (wb.get<string>('secondarySideBar.defaultVisibility') !== expected) {
			await safeConfigUpdate('workbench', 'secondarySideBar.defaultVisibility', expected, target);
		}
	}
}

/** Ajustes opcionais compactos (so apos premium unlock). */
async function applyMinimalWorkbenchExtras(): Promise<void> {
	const target = vscode.ConfigurationTarget.Global;
	const ed = vscode.workspace.getConfiguration('editor');
	const bc = vscode.workspace.getConfiguration('breadcrumbs');

	await safeConfigUpdate('editor', 'minimap.enabled', false, target);
	await safeConfigUpdate('editor', 'glyphMargin', false, target);
	await safeConfigUpdate('editor', 'scrollBeyondLastLine', false, target);
	await safeConfigUpdate('editor', 'smoothScrolling', true, target);
	await safeConfigUpdate('breadcrumbs', 'enabled', true, target);
}

/** Remove maximize da barra lateral direita (so restore; toggle cego maximizaria de novo). */
async function clearAuxiliaryBarFullscreen(): Promise<void> {
	try {
		await vscode.commands.executeCommand('princy.unlockEditorLayout');
	} catch {
		// workbench contrib princy
	}
	try {
		await vscode.commands.executeCommand('workbench.action.restoreAuxiliaryBar');
	} catch {
		// comando pode nao existir nesta build
	}
}

/** Reaplica layout premium e desbloqueia edicao. */
export async function enforcePrincyEditorUnlocked(): Promise<void> {
	await applyPrincyWorkbenchLayout();
}
