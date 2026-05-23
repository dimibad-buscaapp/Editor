import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { resolveProjectPath } from '../projectCreatorService.js';

export type ApiStack = 'fastify' | 'express' | 'unknown';

export type ApiProjectInfo = {
	readonly slug: string;
	readonly projectPath: string;
	readonly stack: ApiStack;
	readonly hasPrisma: boolean;
	readonly port: number;
	readonly docsUrl: string;
	readonly openapiUrl: string;
	readonly healthUrl: string;
};

const API_STUDIO_MARKER = '// PRINCY_API_STUDIO_INSERT';

export function getApiStudioMarker(): string {
	return API_STUDIO_MARKER;
}

export function resolveApiProject(slug: string, projectPath?: string): string {
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

function readPackageJson(projectPath: string): { dependencies?: Record<string, string> } | undefined {
	const pkgPath = path.join(projectPath, 'package.json');
	if (!fs.existsSync(pkgPath)) {
		return undefined;
	}
	try {
		return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string> };
	} catch {
		return undefined;
	}
}

export function detectApiStack(projectPath: string): ApiStack {
	const pkg = readPackageJson(projectPath);
	const deps = { ...pkg?.dependencies, ...(pkg as { devDependencies?: Record<string, string> })?.devDependencies };
	if (deps?.fastify) {
		return 'fastify';
	}
	if (deps?.express) {
		return 'express';
	}
	return 'unknown';
}

export function detectPort(projectPath: string): number {
	const envPath = path.join(projectPath, '.env');
	if (fs.existsSync(envPath)) {
		const match = fs.readFileSync(envPath, 'utf8').match(/^PORT=(\d+)/m);
		if (match?.[1]) {
			return Number(match[1]);
		}
	}
	const examplePath = path.join(projectPath, '.env.example');
	if (fs.existsSync(examplePath)) {
		const match = fs.readFileSync(examplePath, 'utf8').match(/^PORT=(\d+)/m);
		if (match?.[1]) {
			return Number(match[1]);
		}
	}
	return 4000;
}

export function hasPrisma(projectPath: string): boolean {
	return fs.existsSync(path.join(projectPath, 'prisma', 'schema.prisma'));
}

export function getApiProjectInfo(slug: string, projectPath?: string): ApiProjectInfo {
	const resolved = resolveApiProject(slug, projectPath);
	const port = detectPort(resolved);
	const base = `http://127.0.0.1:${port}`;
	const stack = detectApiStack(resolved);
	return {
		slug,
		projectPath: resolved,
		stack,
		hasPrisma: hasPrisma(resolved),
		port,
		docsUrl: stack === 'express' ? `${base}/docs` : `${base}/docs`,
		openapiUrl: stack === 'express' ? `${base}/openapi.json` : `${base}/docs/json`,
		healthUrl: `${base}/health`
	};
}

export function findServerEntry(projectPath: string): string {
	const candidates = [
		path.join(projectPath, 'src', 'server.ts'),
		path.join(projectPath, 'apps', 'api', 'src', 'server.ts')
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	throw new Error('server.ts nao encontrado no projeto');
}
