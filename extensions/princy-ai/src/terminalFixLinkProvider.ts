/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const ERROR_PATTERNS = [
	/\b(TypeError|SyntaxError|ReferenceError|Module not found|Cannot find module|TS\d{4}|Error:)\b/i,
	/^\s*at\s+.+:\d+:\d+/,
	/.+\.(ts|tsx|js|jsx|py|cs|java|go|rs|php):\d+:\d+/
];

export class PrincyTerminalLink extends vscode.TerminalLink {
	public constructor(
		startIndex: number,
		length: number,
		public readonly errorText: string
	) {
		super(startIndex, length, 'Fix with Princy AI');
	}
}

export class PrincyTerminalLinkProvider implements vscode.TerminalLinkProvider<PrincyTerminalLink> {
	public constructor(private readonly fixError: (errorText: string) => Promise<void>) { }

	public provideTerminalLinks(context: vscode.TerminalLinkContext): PrincyTerminalLink[] {
		if (!ERROR_PATTERNS.some(pattern => pattern.test(context.line))) {
			return [];
		}

		const startIndex = Math.max(0, context.line.search(/\S/));
		const length = Math.max(1, context.line.length - startIndex);
		return [new PrincyTerminalLink(startIndex, length, context.line.trim())];
	}

	public async handleTerminalLink(link: PrincyTerminalLink): Promise<void> {
		await this.fixError(link.errorText);
	}
}
