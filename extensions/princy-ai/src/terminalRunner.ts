/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TerminalCommandResult } from './agentClient';

const ALLOWED_COMMANDS = [
	/^npm (run )?(test|build|lint)(\b|$)/,
	/^npm run [\w:-]+(\b|$)/,
	/^python -m pytest(\b|$)/,
	/^pytest(\b|$)/
];

export class TerminalRunner {
	private terminal: vscode.Terminal | undefined;

	public async run(command: string): Promise<TerminalCommandResult> {
		const allowed = ALLOWED_COMMANDS.some(pattern => pattern.test(command.trim()));
		const confirmation = await vscode.window.showWarningMessage(
			allowed
				? `Executar comando de verificacao?\n\n${command}`
				: `Este comando esta fora da allowlist inicial. Executar mesmo assim?\n\n${command}`,
			{ modal: true },
			'Run',
			'Cancelar'
		);

		if (confirmation !== 'Run') {
			return {
				command,
				output: 'Comando cancelado pelo usuario.'
			};
		}

		this.terminal ??= vscode.window.createTerminal({ name: 'Princy Ai' });
		this.terminal.show();

		if (!this.terminal.shellIntegration) {
			this.terminal.sendText(command);
			return {
				command,
				output: 'Comando enviado ao terminal. Shell integration indisponivel para capturar a saida automaticamente.'
			};
		}

		const execution = this.terminal.shellIntegration.executeCommand(command);
		const exitCodePromise = waitForExitCode(execution);
		let output = '';
		const stream = execution.read();
		for await (const chunk of stream) {
			output += chunk;
			if (output.length > 20000) {
				output = output.slice(-20000);
			}
		}

		const exitCode = await exitCodePromise;
		return {
			command,
			exitCode,
			output
		};
	}
}

function waitForExitCode(execution: vscode.TerminalShellExecution): Promise<number | undefined> {
	return new Promise(resolve => {
		const disposable = vscode.window.onDidEndTerminalShellExecution(event => {
			if (event.execution === execution) {
				disposable.dispose();
				resolve(event.exitCode);
			}
		});
	});
}
