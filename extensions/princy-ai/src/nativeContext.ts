/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CodeGraphContext, ShadowContext } from './agentClient';
import { collectCodeGraphContext } from './codeGraph';

const MAX_ACTIVE_CONTENT_LENGTH = 50000;
const MAX_DIAGNOSTICS = 80;
const MAX_WORKSPACE_FILES = 160;

export interface NativeContextBundle {
	readonly shadowContext: ShadowContext;
	readonly codeGraph: CodeGraphContext;
}

export async function collectNativeContext(baseContext?: ShadowContext): Promise<NativeContextBundle> {
	const editor = vscode.window.activeTextEditor;
	const activeContent = editor?.document.getText();
	const [workspaceTree, codeGraph] = await Promise.all([
		collectWorkspaceTree(),
		collectCodeGraphContext()
	]);

	return {
		shadowContext: {
			...baseContext,
			activeFilePath: editor?.document.uri.toString() ?? baseContext?.activeFilePath,
			activeLanguageId: editor?.document.languageId ?? baseContext?.activeLanguageId,
			activeContent: activeContent ? activeContent.slice(0, MAX_ACTIVE_CONTENT_LENGTH) : baseContext?.activeContent,
			activeSelection: editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection).slice(0, 12000) : undefined,
			openTabs: collectOpenTabs(),
			diagnostics: collectDiagnostics(),
			workspaceFolders: vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString()) ?? [],
			workspaceTree,
			lastTerminalResult: baseContext?.lastTerminalResult
		},
		codeGraph
	};
}

function collectOpenTabs(): string[] {
	const tabs = vscode.window.tabGroups?.all.flatMap(group => group.tabs) ?? [];
	return tabs
		.map(tab => {
			const input = tab.input as { readonly uri?: vscode.Uri; readonly modified?: vscode.Uri; readonly original?: vscode.Uri };
			return input.uri?.toString() ?? input.modified?.toString() ?? input.original?.toString() ?? tab.label;
		})
		.slice(0, 40);
}

function collectDiagnostics(): string[] {
	return vscode.languages.getDiagnostics()
		.flatMap(([uri, diagnostics]) => diagnostics.map(diagnostic => {
			const line = diagnostic.range.start.line + 1;
			return `${uri.toString()}:${line} ${diagnostic.message}`;
		}))
		.slice(0, MAX_DIAGNOSTICS);
}

async function collectWorkspaceTree(): Promise<string[]> {
	if (!vscode.workspace.workspaceFolders?.length) {
		return [];
	}

	const files = await vscode.workspace.findFiles(
		'**/*',
		'{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.build/**,**/package-lock.json}',
		MAX_WORKSPACE_FILES
	);
	return files.map(uri => vscode.workspace.asRelativePath(uri, false)).sort();
}
