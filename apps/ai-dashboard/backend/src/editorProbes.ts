import { config } from './config.js';

export type StackProbe = {
	readonly name: string;
	readonly url: string;
	readonly ok: boolean;
	readonly status: number;
	readonly ms: number;
	readonly hint: string;
	readonly bodyPreview: string;
};

async function probeOne(name: string, url: string, expectWorkbench = false): Promise<StackProbe> {
	const start = Date.now();
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 12000);
		const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html,application/json' } });
		clearTimeout(timer);
		const text = await response.text();
		const ms = Date.now() - start;
		const hasWorkbench = /WORKBENCH_WEB_CONFIGURATION|workbench\.web\.main/.test(text);
		const isJson = text.trimStart().startsWith('{');
		let hint = '';
		if (!response.ok) {
			hint = 'HTTP erro';
		} else if (expectWorkbench && !hasWorkbench) {
			hint = 'HTML sem workbench (compile ou base path?)';
		} else if (isJson) {
			hint = 'JSON OK';
		} else {
			hint = 'HTML OK';
		}
		return {
			name,
			url,
			ok: response.ok && (!expectWorkbench || hasWorkbench),
			status: response.status,
			ms,
			hint,
			bodyPreview: text.slice(0, 100).replace(/\s+/g, ' ')
		};
	} catch (error) {
		return {
			name,
			url,
			ok: false,
			status: 0,
			ms: Date.now() - start,
			hint: error instanceof Error ? error.message : String(error),
			bodyPreview: ''
		};
	}
}

export async function probeEditorStack(): Promise<{ readonly ts: number; readonly probes: readonly StackProbe[] }> {
	const host = config.princyVpsHost;
	const probes = await Promise.all([
		probeOne('Index landing :3220', `http://127.0.0.1:${config.indexPort}/`),
		probeOne('Code Web :3200 /webeditor/', `http://127.0.0.1:3200${config.editorBasePath}/`, true),
		probeOne('Agent API :3210', `http://127.0.0.1:${config.apiPort}/api/agent/health`),
		probeOne('Public HTTPS /webeditor/', `https://princyai.com${config.editorBasePath}/`, true),
		probeOne('Public index', 'https://princyai.com/')
	]);
	return { ts: Date.now(), probes };
}
