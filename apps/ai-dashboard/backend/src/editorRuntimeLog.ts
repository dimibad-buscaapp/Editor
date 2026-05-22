import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const LOG_FILES = [
	'index.out.log',
	'index.err.log',
	'code-web.out.log',
	'code-web.err.log',
	'caddy.out.log',
	'caddy.err.log',
	'agent-backend.out.log',
	'agent-backend.err.log'
] as const;

export type RuntimeLogPayload = {
	readonly ok: boolean;
	readonly ts: number;
	readonly projectRoot: string;
	readonly logs: Record<string, readonly string[]>;
};

export function readRuntimeLogs(maxLines = 80): RuntimeLogPayload {
	const logsDir = path.join(config.editorProjectRoot, 'logs');
	const logs: Record<string, string[]> = {};

	for (const name of LOG_FILES) {
		const filePath = path.join(logsDir, name);
		try {
			if (!fs.existsSync(filePath)) {
				logs[name] = [`(arquivo ausente: ${filePath})`];
				continue;
			}
			const raw = fs.readFileSync(filePath, 'utf8');
			const lines = raw.split(/\r?\n/).filter(line => line.length > 0);
			logs[name] = lines.slice(-maxLines);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logs[name] = [`(erro ao ler: ${message})`];
		}
	}

	return {
		ok: true,
		ts: Date.now(),
		projectRoot: config.editorProjectRoot,
		logs
	};
}
