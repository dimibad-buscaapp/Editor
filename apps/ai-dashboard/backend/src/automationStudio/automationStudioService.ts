import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { resolveProjectPath } from '../projectCreatorService.js';
import { readAutomationManifest, type AutomationManifest } from './automationManifest.js';

export type AutomationType =
	| 'powershell'
	| 'node-cron'
	| 'playwright'
	| 'webhook'
	| 'api-client'
	| 'chatbot'
	| 'unknown';

export type AutomationProjectInfo = {
	readonly slug: string;
	readonly projectPath: string;
	readonly type: AutomationType;
	readonly hasPrisma: boolean;
	readonly entryScript?: string;
	readonly schedule?: string;
	readonly taskName?: string;
	readonly lastRunAt?: number;
	readonly lastRunStatus?: 'success' | 'error';
	readonly lastHealthCheck?: number;
	readonly lastFailure?: string;
};

export const AUTOMATION_MARKER = '// PRINCY_AUTOMATION_INSERT';
export const AUTOMATION_MARKER_PS = '# PRINCY_AUTOMATION_INSERT';

export function getAutomationMarker(isPowerShell: boolean): string {
	return isPowerShell ? AUTOMATION_MARKER_PS : AUTOMATION_MARKER;
}

export function resolveAutomationProject(slug: string, projectPath?: string): string {
	if (projectPath?.trim()) {
		const resolved = path.resolve(projectPath.trim());
		const root = path.resolve(config.projectsRoot);
		if (!resolved.startsWith(root + path.sep) && resolved !== root) {
			throw new Error('Projeto fora da pasta permitida.');
		}
		return resolved;
	}
	return resolveProjectPath(slug);
}

function readPackageJson(projectPath: string): { dependencies?: Record<string, string>; scripts?: Record<string, string> } | undefined {
	const pkgPath = path.join(projectPath, 'package.json');
	if (!fs.existsSync(pkgPath)) {
		return undefined;
	}
	try {
		return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string>; scripts?: Record<string, string> };
	} catch {
		return undefined;
	}
}

export function detectAutomationType(projectPath: string): AutomationType {
	if (fs.existsSync(path.join(projectPath, 'run.ps1')) || fs.existsSync(path.join(projectPath, 'scripts', 'main.ps1'))) {
		return 'powershell';
	}
	const pkg = readPackageJson(projectPath);
	const deps = { ...pkg?.dependencies, ...(pkg as { devDependencies?: Record<string, string> })?.devDependencies };
	if (deps?.['node-cron']) {
		return 'node-cron';
	}
	if (deps?.playwright || deps?.['@playwright/test']) {
		return 'playwright';
	}
	if (deps?.telegraf || deps?.['discord.js']) {
		return 'chatbot';
	}
	if (fs.existsSync(path.join(projectPath, 'src', 'integrations'))) {
		return 'api-client';
	}
	if (deps?.axios && deps?.['node-cron']) {
		return 'api-client';
	}
	const serverPath = path.join(projectPath, 'src', 'server.ts');
	if (deps?.fastify && fs.existsSync(serverPath)) {
		try {
			if (fs.readFileSync(serverPath, 'utf8').includes('/webhooks/')) {
				return 'webhook';
			}
		} catch {
			// ignore
		}
	}
	if (pkg?.scripts?.start || pkg?.scripts?.dev) {
		return 'node-cron';
	}
	return 'unknown';
}

export function findAutomationEntry(projectPath: string, type: AutomationType): string | undefined {
	const candidates: string[] = [];
	if (type === 'powershell') {
		candidates.push(
			path.join(projectPath, 'run.ps1'),
			path.join(projectPath, 'scripts', 'main.ps1'),
			path.join(projectPath, 'main.ps1')
		);
	} else {
		candidates.push(
			path.join(projectPath, 'src', 'index.ts'),
			path.join(projectPath, 'src', 'jobs', 'index.ts'),
			path.join(projectPath, 'src', 'server.ts'),
			path.join(projectPath, 'src', 'bot.ts')
		);
	}
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

export function findInsertTarget(projectPath: string): { filePath: string; isPowerShell: boolean } {
	const psTargets = [
		path.join(projectPath, 'scripts', 'main.ps1'),
		path.join(projectPath, 'run.ps1')
	];
	for (const target of psTargets) {
		if (fs.existsSync(target)) {
			return { filePath: target, isPowerShell: true };
		}
	}
	const nodeTargets = [
		path.join(projectPath, 'src', 'jobs', 'index.ts'),
		path.join(projectPath, 'src', 'index.ts'),
		path.join(projectPath, 'src', 'server.ts'),
		path.join(projectPath, 'src', 'bot.ts')
	];
	for (const target of nodeTargets) {
		if (fs.existsSync(target)) {
			return { filePath: target, isPowerShell: false };
		}
	}
	throw new Error('Ficheiro de automacao nao encontrado (src/jobs/index.ts ou run.ps1)');
}

export function getAutomationProjectInfo(slug: string, projectPath?: string): AutomationProjectInfo {
	const resolved = resolveAutomationProject(slug, projectPath);
	const type = detectAutomationType(resolved);
	const manifest = readAutomationManifest(slug);
	const entryScript = findAutomationEntry(resolved, type);
	return {
		slug,
		projectPath: resolved,
		type,
		hasPrisma: fs.existsSync(path.join(resolved, 'prisma', 'schema.prisma')),
		entryScript,
		schedule: manifest?.schedule,
		taskName: manifest?.taskName,
		lastRunAt: manifest?.lastRunAt,
		lastRunStatus: manifest?.lastRunStatus,
		lastHealthCheck: manifest?.lastHealthCheck,
		lastFailure: manifest?.lastFailure
	};
}

export function upsertManifestFromInfo(slug: string, info: AutomationProjectInfo): AutomationManifest {
	const existing = readAutomationManifest(slug);
	return {
		slug,
		type: info.type,
		projectPath: info.projectPath,
		schedule: existing?.schedule,
		taskName: existing?.taskName,
		lastRunAt: existing?.lastRunAt,
		lastRunStatus: existing?.lastRunStatus,
		lastRunOutput: existing?.lastRunOutput,
		lastHealthCheck: existing?.lastHealthCheck,
		lastFailure: existing?.lastFailure,
		autoHealJobId: existing?.autoHealJobId,
		triggerSecret: existing?.triggerSecret,
		updatedAt: Date.now()
	};
}
