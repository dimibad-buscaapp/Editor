import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export type AutomationManifest = {
	readonly slug: string;
	readonly type: string;
	readonly projectPath: string;
	readonly schedule?: string;
	readonly taskName?: string;
	readonly lastRunAt?: number;
	readonly lastRunStatus?: 'success' | 'error';
	readonly lastRunOutput?: string;
	readonly lastHealthCheck?: number;
	readonly lastFailure?: string;
	readonly autoHealJobId?: string;
	readonly triggerSecret?: string;
	readonly updatedAt: number;
};

export function ensureAutomationsStorageLayout(): void {
	fs.mkdirSync(config.automationsRoot, { recursive: true });
}

function manifestPath(slug: string): string {
	return path.join(config.automationsRoot, slug, 'manifest.json');
}

export function readAutomationManifest(slug: string): AutomationManifest | undefined {
	const filePath = manifestPath(slug);
	if (!fs.existsSync(filePath)) {
		return undefined;
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AutomationManifest;
	} catch {
		return undefined;
	}
}

export function writeAutomationManifest(manifest: AutomationManifest): void {
	ensureAutomationsStorageLayout();
	const dir = path.join(config.automationsRoot, manifest.slug);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(manifestPath(manifest.slug), JSON.stringify({
		...manifest,
		updatedAt: Date.now()
	}, null, 2), 'utf8');
}

export function appendAutomationLog(slug: string, text: string): void {
	const logPath = path.join(config.automationsRoot, slug, 'run.log');
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	fs.appendFileSync(logPath, text, 'utf8');
}

export function readAutomationLogs(slug: string, maxLines = 200): string {
	const logPath = path.join(config.automationsRoot, slug, 'run.log');
	if (!fs.existsSync(logPath)) {
		return '';
	}
	const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
	return lines.slice(-maxLines).join('\n');
}
