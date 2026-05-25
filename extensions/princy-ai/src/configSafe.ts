/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Atualiza setting so se existir no registry (evita CodeExpectedError no Code Web). */
export async function safeConfigUpdate(
	section: string,
	key: string,
	value: unknown,
	target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
): Promise<void> {
	const config = vscode.workspace.getConfiguration(section);
	if (config.inspect(key) === undefined) {
		return;
	}
	try {
		await config.update(key, value, target);
	} catch {
		// Web: chave pode existir em inspect mas nao ser gravavel nesta build.
	}
}
