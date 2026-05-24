/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient, type ProjectTemplateId } from './agentClient';
import { setPrincyAiStatus, labelForPrincyAiStatus } from './princyStatusBar';

export interface PrincyCreateAction {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly templateId: ProjectTemplateId;
	readonly icon: string;
	readonly command: string;
}

export const PRINCY_CREATE_ACTIONS: readonly PrincyCreateAction[] = [
	{
		id: 'project',
		label: 'Novo projeto',
		description: 'Site ou app web (React/Vite)',
		templateId: 'webapp',
		icon: 'folder',
		command: 'princyai.create.project'
	},
	{
		id: 'app',
		label: 'Novo aplicativo',
		description: 'App mobile Android (APK)',
		templateId: 'apk',
		icon: 'device-mobile',
		command: 'princyai.create.app'
	},
	{
		id: 'exe',
		label: 'Novo programa (.exe)',
		description: 'Aplicativo Windows (Electron)',
		templateId: 'exe',
		icon: 'package',
		command: 'princyai.create.exe'
	},
	{
		id: 'api',
		label: 'Nova API',
		description: 'Backend REST / Express',
		templateId: 'api',
		icon: 'server',
		command: 'princyai.create.api'
	},
	{
		id: 'system',
		label: 'Novo sistema',
		description: 'SaaS / painel completo',
		templateId: 'saas',
		icon: 'layers',
		command: 'princyai.create.system'
	}
] as const;

export async function promptProjectName(actionLabel: string): Promise<string | undefined> {
	return vscode.window.showInputBox({
		title: actionLabel,
		prompt: 'Nome da pasta do projeto (sem espacos)',
		placeHolder: 'meu-projeto',
		validateInput: value => {
			const trimmed = value.trim();
			if (!trimmed) {
				return 'Informe um nome.';
			}
			if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(trimmed)) {
				return 'Use apenas letras, numeros, ponto, hifen ou underscore.';
			}
			return undefined;
		}
	});
}

export async function runPrincyProjectCreate(
	client: AgentClient,
	templateId: ProjectTemplateId,
	projectName: string,
	options?: { readonly runInstall?: boolean; readonly openFolder?: boolean }
): Promise<{ readonly projectPath: string }> {
	const runInstall = options?.runInstall ?? true;
	const openFolder = options?.openFolder ?? true;

	void setPrincyAiStatus({ kind: 'planning', label: 'IA: Criando projeto' });

	const result = await client.createProject(templateId, projectName.trim(), runInstall);
	if (!result.ok || !result.projectPath) {
		throw new Error(result.message ?? 'Falha ao criar projeto');
	}

	if (result.installJobId) {
		const install = await client.pollCreateProjectInstall(result.installJobId);
		if (install.status === 'FAILED') {
			throw new Error(install.output || 'npm install falhou');
		}
	}

	if (openFolder) {
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(result.projectPath), true);
	}

	void setPrincyAiStatus({ kind: 'ready', label: labelForPrincyAiStatus('ready') });
	void vscode.window.showInformationMessage(`Projeto criado: ${result.projectPath}`);
	return { projectPath: result.projectPath };
}
