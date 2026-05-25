/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

function joinFsPath(base: string, ...segments: string[]): string {
	return segments.reduce(
		(uri, segment) => vscode.Uri.joinPath(uri, segment),
		vscode.Uri.file(base)
	).fsPath;
}

/** Maps paths between main workspace and swarm git worktrees. */
export function mapWorktreePathToWorkspace(worktreePath: string, filePath: string): string {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		return filePath;
	}
	const workspaceRoot = folders[0].uri.fsPath;
	const normalized = filePath.replace(/\\/g, '/');
	const wtNorm = worktreePath.replace(/\\/g, '/');
	if (normalized.startsWith(wtNorm)) {
		const relative = normalized.slice(wtNorm.length).replace(/^\//, '');
		return relative ? joinFsPath(workspaceRoot, relative) : workspaceRoot;
	}
	return filePath;
}

export function mapWorkspacePathToWorktree(worktreePath: string, filePath: string): string {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		return filePath;
	}
	const workspaceRoot = folders[0].uri.fsPath.replace(/\\/g, '/');
	const normalized = filePath.replace(/\\/g, '/');
	if (normalized.startsWith(workspaceRoot)) {
		const relative = normalized.slice(workspaceRoot.length).replace(/^\//, '');
		return relative ? joinFsPath(worktreePath, relative) : worktreePath;
	}
	return filePath;
}

export function resolveActiveWorktreePath(): string | undefined {
	return vscode.workspace.getConfiguration('princyai').get<string>('swarm.activeWorktreePath') || undefined;
}

export async function setActiveWorktreePath(worktreePath: string | undefined): Promise<void> {
	await vscode.workspace.getConfiguration('princyai').update('swarm.activeWorktreePath', worktreePath ?? '', vscode.ConfigurationTarget.Workspace);
}
