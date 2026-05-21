/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { focusPrincyChatPanel } from './princyWorkbenchChat';

/**
 * Princy Ai uses a dedicated sidebar webview (fetch → backend :3210).
 * Native VS Code Chat Participants / ChatWidget require registered agents and break without Copilot.
 */
const NATIVE_CHAT_COMMANDS = [
	'workbench.action.chat.open',
	'workbench.action.chat.openInEditor',
	'workbench.action.chat.openInSidebar',
	'workbench.action.chat.openInPanel',
	'workbench.action.chat.newChat',
	'workbench.action.chat.focusInput',
	'workbench.panel.chat.view.copilot.focus',
	'workbench.panel.chat.view.copilot.newChat',
	'workbench.action.chat.openAgentDebugPanel'
] as const;

export function registerPrincyChatIsolation(context: vscode.ExtensionContext): void {
	for (const commandId of NATIVE_CHAT_COMMANDS) {
		context.subscriptions.push(
			vscode.commands.registerCommand(commandId, async () => {
				await focusPrincyChatPanel();
				return undefined;
			})
		);
	}

	void applyNativeChatDisabledSettings();
}

async function applyNativeChatDisabledSettings(): Promise<void> {
	const target = vscode.ConfigurationTarget.Global;
	const chat = vscode.workspace.getConfiguration('chat');
	await chat.update('disableAIFeatures', true, target);
	await chat.update('agentsControl.enabled', 'hidden', target);
	await chat.update('agent.enabled', false, target);
	await chat.update('viewSessions.enabled', false, target);
	await chat.update('unifiedAgentsBar.enabled', false, target);
	await chat.update('agentHost.enabled', false, target);
	await chat.update('generalPurposeAgent.enabled', false, target);
	await chat.update('exploreAgent.defaultModel', undefined, target);
	await chat.update('planAgent.defaultModel', undefined, target);
}
