import fs from 'node:fs';
import path from 'node:path';
import { detectApiStack, findServerEntry, getApiStudioMarker } from './apiStudioService.js';

export type ScaffoldRouteInput = {
	readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	readonly path: string;
	readonly handlerName?: string;
};

function toHandlerName(routePath: string): string {
	const base = routePath
		.replace(/^\/+/, '')
		.replace(/\//g, '_')
		.replace(/[{}:]/g, '')
		.replace(/[^a-zA-Z0-9_]/g, '_')
		|| 'route';
	return `handle_${base}`;
}

function buildFastifySnippet(input: ScaffoldRouteInput, handlerName: string): string {
	const method = input.method.toLowerCase();
	return `\napp.${method}('${input.path}', {\n\tschema: { tags: ['api-studio'], description: 'Auto-generated' }\n}, async (req, reply) => {\n\treturn { ok: true, path: '${input.path}' };\n});\n`;
}

function buildExpressSnippet(input: ScaffoldRouteInput, handlerName: string): string {
	return `\napp.${input.method.toLowerCase()}('${input.path}', async (req, res) => {\n\tres.json({ ok: true, path: '${input.path}' });\n});\n`;
}

export function scaffoldRoute(projectPath: string, input: ScaffoldRouteInput): { filePath: string; snippet: string } {
	if (!input.path.startsWith('/')) {
		throw new Error('path deve comecar com /');
	}
	const stack = detectApiStack(projectPath);
	const handlerName = input.handlerName ?? toHandlerName(input.path);
	const serverPath = findServerEntry(projectPath);
	let content = fs.readFileSync(serverPath, 'utf8');
	const marker = getApiStudioMarker();
	const snippet = stack === 'express'
		? buildExpressSnippet(input, handlerName)
		: buildFastifySnippet(input, handlerName);

	if (!content.includes(marker)) {
		throw new Error(`Marcador ${marker} nao encontrado em server.ts`);
	}
	content = content.replace(marker, `${snippet}\n${marker}`);
	fs.writeFileSync(serverPath, content, 'utf8');

	const routesDir = path.join(path.dirname(serverPath), 'routes');
	fs.mkdirSync(routesDir, { recursive: true });
	const routeFile = path.join(routesDir, `${handlerName}.ts`);
	const routeFileContent = `// Rota gerada pelo API Studio: ${input.method} ${input.path}\nexport const meta = { method: '${input.method}', path: '${input.path}' };\n`;
	fs.writeFileSync(routeFile, routeFileContent, 'utf8');

	return { filePath: serverPath, snippet: snippet.trim() };
}
