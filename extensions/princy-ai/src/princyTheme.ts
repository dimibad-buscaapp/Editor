/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const PRINCY_BLACK_THEME = 'Princy Black';

export function registerPrincyThemeOnActivate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('princyai.ui.forceBlackTheme')) {
				void applyPrincyBlackTheme();
			}
		})
	);

	void applyPrincyBlackTheme();
}

async function applyPrincyBlackTheme(): Promise<void> {
	const princyConfig = vscode.workspace.getConfiguration('princyai');
	if (!princyConfig.get<boolean>('ui.forceBlackTheme', true)) {
		return;
	}

	const workbench = vscode.workspace.getConfiguration('workbench');
	const current = workbench.get<string>('colorTheme');
	if (current === PRINCY_BLACK_THEME) {
		return;
	}

	await workbench.update('colorTheme', PRINCY_BLACK_THEME, vscode.ConfigurationTarget.Global);

	const editor = vscode.workspace.getConfiguration('editor');
	if (!editor.get<string>('fontFamily')?.includes('JetBrains')) {
		await editor.update(
			'fontFamily',
			"'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
			vscode.ConfigurationTarget.Global
		);
	}
}
