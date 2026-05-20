/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ShadowContext, TerminalCommandResult } from './agentClient';

const MAX_ACTIVE_CONTENT_LENGTH = 40000;
const MAX_DIAGNOSTICS = 40;

/** Empty shadow context for lightweight chat (no editor scan). */
export const EMPTY_SHADOW_CONTEXT: ShadowContext = {
	openTabs: [],
	diagnostics: []
};

export class ShadowContextManager implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private timer: unknown | undefined;
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
		if (this.timer) {
			clearTimeout(this.timer);
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
		if (this.timer) {
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(() => this.refresh(), 2000);
	}

	private refresh(): void {
		const editor = vscode.window.activeTextEditor;
		const activeContent = editor?.document.getText();
		this.snapshot = {
			activeFilePath: editor?.document.uri.toString(),
			activeLanguageId: editor?.document.languageId,
			activeContent: activeContent ? activeContent.slice(0, MAX_ACTIVE_CONTENT_LENGTH) : undefined,
			openTabs: collectOpenTabs(),
			diagnostics: collectDiagnostics(),
			lastTerminalResult: this.lastTerminalResult
		};
	}
}

function collectOpenTabs(): string[] {
	const tabs = vscode.window.tabGroups?.all.flatMap(group => group.tabs) ?? [];
	return tabs
		.map(tab => {
			const input = tab.input as { readonly uri?: vscode.Uri; readonly modified?: vscode.Uri; readonly original?: vscode.Uri };
			return input.uri?.toString() ?? input.modified?.toString() ?? input.original?.toString() ?? tab.label;
		})
		.slice(0, 30);
}

function collectDiagnostics(): string[] {
	return vscode.languages.getDiagnostics()
		.flatMap(([uri, diagnostics]) => diagnostics.map(diagnostic => {
			const line = diagnostic.range.start.line + 1;
			return `${uri.toString()}:${line} ${diagnostic.message}`;
		}))
		.slice(0, MAX_DIAGNOSTICS);
}
