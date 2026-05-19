import type { ModelSegment } from './types.js';

const logicKeywords = ['arquitetura', 'sistema', 'saas', 'fullstack', 'microserv', 'exe', 'desktop', 'monorepo', 'design', 'planej'];
const frontendKeywords = ['frontend', 'ui', 'ux', 'css', 'html', 'react', 'vue', 'svelte', 'tailwind', 'landing', 'dashboard', 'componente', 'webview'];
const backendKeywords = ['backend', 'api', 'rest', 'graphql', 'sql', 'postgres', 'prisma', 'fastify', 'express', 'node', 'python', 'endpoint', 'migration'];
const debugKeywords = ['debug', 'erro', 'error', 'fix', 'corrig', 'stack', 'exception', 'falha', 'bug', 'lint', 'teste quebrado', 'nao funciona'];

const frontendLanguages = new Set(['html', 'css', 'scss', 'less', 'javascriptreact', 'typescriptreact', 'vue', 'svelte']);
const backendLanguages = new Set(['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'php', 'sql']);

export function detectSegment(prompt: string, filePath?: string, languageId?: string): ModelSegment {
	const haystack = `${prompt}\n${filePath ?? ''}\n${languageId ?? ''}`.toLowerCase();

	if (debugKeywords.some(keyword => haystack.includes(keyword))) {
		return 'DEBUG';
	}

	if (frontendKeywords.some(keyword => haystack.includes(keyword)) || (languageId && frontendLanguages.has(languageId.toLowerCase()))) {
		return 'FRONTEND';
	}

	if (backendKeywords.some(keyword => haystack.includes(keyword)) || (languageId && backendLanguages.has(languageId.toLowerCase()))) {
		return 'BACKEND';
	}

	if (logicKeywords.some(keyword => haystack.includes(keyword))) {
		return 'LOGIC';
	}

	if (filePath) {
		const lowerPath = filePath.toLowerCase();
		if (/\.(tsx|jsx|vue|svelte|css|scss|html)$/.test(lowerPath)) {
			return 'FRONTEND';
		}
		if (/\.(sql|prisma)$/.test(lowerPath) || /(routes|api|server|backend)/.test(lowerPath)) {
			return 'BACKEND';
		}
	}

	return 'BACKEND';
}

export function isHighComplexity(prompt: string): boolean {
	const keywords = ['sistema', 'api', 'complexo', 'fullstack', 'arquitetura', 'saas', 'microserv', 'refator', 'multiplos arquivos', '.exe'];
	const haystack = prompt.toLowerCase();
	return keywords.some(keyword => haystack.includes(keyword)) || prompt.length > 1200;
}
