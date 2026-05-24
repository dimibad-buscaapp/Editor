import fs from 'node:fs';
import path from 'node:path';
import { findInsertTarget, getAutomationMarker } from './automationStudioService.js';

export type ScaffoldAutomationInput = {
	readonly name: string;
	readonly schedule?: string;
	readonly description?: string;
};

function toSafeName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'job';
}

function buildNodeSnippet(input: ScaffoldAutomationInput, safeName: string): string {
	const schedule = input.schedule ?? '*/15 * * * *';
	return `\n// Job gerado: ${input.name}\ncron.schedule('${schedule}', async () => {\n\tconsole.log('[${safeName}]', new Date().toISOString(), ${JSON.stringify(input.description ?? input.name)});\n});\n`;
}

function buildPowerShellSnippet(input: ScaffoldAutomationInput, safeName: string): string {
	return `\nfunction Invoke-${safeName} {\n\tWrite-Host "[${safeName}]" (Get-Date -Format o) ${JSON.stringify(input.description ?? input.name)}\n}\n`;
}

export function scaffoldAutomation(projectPath: string, input: ScaffoldAutomationInput): { filePath: string; snippet: string } {
	const { filePath, isPowerShell } = findInsertTarget(projectPath);
	const safeName = toSafeName(input.name);
	let content = fs.readFileSync(filePath, 'utf8');
	const marker = getAutomationMarker(isPowerShell);
	const snippet = isPowerShell
		? buildPowerShellSnippet(input, safeName)
		: buildNodeSnippet(input, safeName);

	if (!content.includes(marker)) {
		throw new Error(`Marcador ${marker} nao encontrado em ${path.basename(filePath)}`);
	}
	content = content.replace(marker, `${snippet}\n${marker}`);
	fs.writeFileSync(filePath, content, 'utf8');

	const jobsDir = path.join(projectPath, isPowerShell ? 'scripts' : 'src', 'jobs');
	fs.mkdirSync(jobsDir, { recursive: true });
	const metaFile = path.join(jobsDir, `${safeName}.meta.json`);
	fs.writeFileSync(metaFile, JSON.stringify({
		name: input.name,
		schedule: input.schedule,
		description: input.description,
		createdAt: new Date().toISOString()
	}, null, 2), 'utf8');

	return { filePath, snippet: snippet.trim() };
}
