/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ShadowContext, TerminalCommandResult } from './agentClient';
import { collectOpenTabLabels } from './tabUri';

const MAX_ACTIVE_CONTENT_LENGTH = 40000;
const MAX_DIAGNOSTICS = 40;

/** Empty shadow context for lightweight chat (no editor scan). */
export const EMPTY_SHADOW_CONTEXT: ShadowContext = {
	openTabs: [],
	diagnostics: []
};

export class ShadowContextManager implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private timer: ReturnType<typeof setTimeout> | undefined;
	private disposed = false;
	private snapshot: ShadowContext = {
		openTabs: [],
		diagnostics: []
	};
	private lastTerminalResult: TerminalCommandResult | undefined;

	public constructor() {
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(() => this.scheduleRefresh()),
			vscode.workspace.onDidChangeTextDocument(() => this.scheduleRefresh()),
			vscode.languages.onDidChangeDiagnostics(() => this.scheduleRefresh())
		);

		if (vscode.window.tabGroups) {
			this.disposables.push(vscode.window.tabGroups.onDidChangeTabs(() => this.scheduleRefresh()));
		}

		this.scheduleRefresh();
	}

	public dispose(): void {
		this.disposed = true;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	public getSnapshot(): ShadowContext {
		return this.snapshot;
	}

	public setLastTerminalResult(result: TerminalCommandResult): void {
		this.lastTerminalResult = result;
		this.snapshot = {
			...this.snapshot,
			lastTerminalResult: result
		};
	}

	private scheduleRefresh(): void {
		if (this.disposed) {
			return;
		}
		if (this.timer) {
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(() => {
			this.timer = undefined;
			if (!this.disposed) {
				this.refresh();
			}
		}, 2000);
	}

	private refresh(): void {
		try {
			const editor = vscode.window.activeTextEditor;
			const document = editor?.document;
			const activeContent = document?.getText();
			this.snapshot = {
				activeFilePath: document?.uri.toString(),
				activeLanguageId: document?.languageId,
				activeContent: activeContent ? activeContent.slice(0, MAX_ACTIVE_CONTENT_LENGTH) : undefined,
				openTabs: collectOpenTabLabels(30),
				diagnostics: collectDiagnostics(),
				lastTerminalResult: this.lastTerminalResult
			};
		} catch {
			// web: tabs/editors podem estar incompletos — não derrubar o extension host
		}
	}
}

function collectDiagnostics(): string[] {
	return vscode.languages.getDiagnostics()
		.flatMap(([uri, diagnostics]) => diagnostics.map(diagnostic => {
			const line = diagnostic.range.start.line + 1;
			return `${uri.toString()}:${line} ${diagnostic.message}`;
		}))
		.slice(0, MAX_DIAGNOSTICS);
}
