/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

type TabResourceInput = {
	readonly uri?: vscode.Uri;
	readonly modified?: vscode.Uri;
	readonly original?: vscode.Uri;
};

/** Safe label/path for a tab (web: input may be undefined). */
export function getTabResourceLabel(tab: vscode.Tab): string {
	const input = tab.input as TabResourceInput | undefined;
	if (!input) {
		return tab.label;
	}
	return input.uri?.toString() ?? input.modified?.toString() ?? input.original?.toString() ?? tab.label;
}

export function collectOpenTabLabels(max = 40): string[] {
	const tabs = vscode.window.tabGroups?.all.flatMap(group => group.tabs) ?? [];
	return tabs.map(getTabResourceLabel).slice(0, max);
}
