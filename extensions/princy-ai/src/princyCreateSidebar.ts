/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import {
	PRINCY_CREATE_ACTIONS,
	type PrincyCreateAction,
	promptProjectName,
	runPrincyProjectCreate
} from './princyProjectCreate';

export const PRINCY_CREATE_VIEW_ID = 'princyCreate.actions';

class PrincyCreateTreeItem extends vscode.TreeItem {
	constructor(public readonly action: PrincyCreateAction) {
		super(action.label, vscode.TreeItemCollapsibleState.None);
		this.description = action.description;
		this.iconPath = new vscode.ThemeIcon(action.icon);
		this.tooltip = `${action.label}\n${action.description}`;
		this.contextValue = 'princyCreateAction';
		this.command = {
			command: action.command,
			title: action.label
		};
	}
}

class PrincyCreateTreeProvider implements vscode.TreeDataProvider<PrincyCreateTreeItem> {
	private readonly _onDidChange = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChange.event;

	refresh(): void {
		this._onDidChange.fire();
	}

	getTreeItem(element: PrincyCreateTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): PrincyCreateTreeItem[] {
		return PRINCY_CREATE_ACTIONS.map(action => new PrincyCreateTreeItem(action));
	}
}

export function registerPrincyCreateSidebar(context: vscode.ExtensionContext, client: AgentClient): void {
	const provider = new PrincyCreateTreeProvider();
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(PRINCY_CREATE_VIEW_ID, provider)
	);

	for (const action of PRINCY_CREATE_ACTIONS) {
		context.subscriptions.push(
			vscode.commands.registerCommand(action.command, () => runCreateCommand(client, action))
		);
	}
}

async function runCreateCommand(client: AgentClient, action: PrincyCreateAction): Promise<void> {
	const runInstall = await vscode.window.showQuickPick(
		[
			{ label: 'Sim', description: 'Executar npm install apos criar', value: true },
			{ label: 'Nao', description: 'Apenas gerar arquivos', value: false }
		],
		{ title: `${action.label} — dependencias?`, placeHolder: 'Instalar dependencias' }
	);
	if (runInstall === undefined) {
		return;
	}

	const name = await promptProjectName(action.label);
	if (!name?.trim()) {
		return;
	}

	try {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: action.label,
				cancellable: false
			},
			() => runPrincyProjectCreate(client, action.templateId, name.trim(), { runInstall: runInstall.value })
		);
		await vscode.commands.executeCommand('princyai.chat.focus');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		void vscode.window.showErrorMessage(`${action.label}: ${message}`);
	}
}
