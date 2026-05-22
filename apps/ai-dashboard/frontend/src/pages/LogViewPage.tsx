import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
	type BootTraceEntry,
	type BootTraceLevel,
	type LogviewBundle,
	fetchLogviewBundle,
	postClientTrace,
	resetServerTrace
} from '../logviewClient.js';
import { navigate } from '../router.js';
import { resolveEditorUrl } from '../princyHosts.js';

const EDITOR_URL = typeof window !== 'undefined'
	? resolveEditorUrl(window.location.hostname, window.location.origin)
	: 'https://princyai.com/webeditor/';

function traceBubbleRole(level: BootTraceLevel): string {
	switch (level) {
		case 'error':
			return 'system';
		case 'warn':
			return 'warn';
		case 'ok':
			return 'ok';
		case 'access':
			return 'user';
		default:
			return 'assistant';
	}
}

function traceAvatar(level: BootTraceLevel): string {
	switch (level) {
		case 'error':
			return 'ERR';
		case 'warn':
			return '!!';
		case 'ok':
			return 'OK';
		case 'access':
			return 'HTTP';
		default:
			return 'LOG';
	}
}

type SimStep = {
	readonly label: string;
	readonly url: string;
	readonly phase: string;
};

const SIM_STEPS: readonly SimStep[] = [
	{ label: 'Landing index (3220)', url: '/', phase: 'index-landing' },
	{ label: 'API bundle (3210 via /princy-api)', url: '/princy-api/api/editor/logview-bundle?lines=20', phase: 'princy-api' },
	{ label: 'Code Web raiz /webeditor/', url: '/webeditor/', phase: 'code-web-root' },
	{ label: 'Workbench HTML', url: '/webeditor/workbench.html', phase: 'code-web-html' },
	{ label: 'Workbench CSS prod', url: '/webeditor/out/vs/code/browser/workbench/workbench.web.main.css', phase: 'code-web-css' },
	{ label: 'Workbench JS prod', url: '/webeditor/out/vs/code/browser/workbench/workbench.web.main.js', phase: 'code-web-js' }
];

async function probeUrl(step: SimStep): Promise<{ status: number; ms: number; preview: string; level: BootTraceLevel }> {
	const t0 = performance.now();
	try {
		const response = await fetch(step.url, {
			method: 'GET',
			cache: 'no-store',
			headers: { Accept: '*/*' }
		});
		const ms = Math.round(performance.now() - t0);
		const ct = response.headers.get('content-type') ?? '';
		let preview = '';
		try {
			const text = await response.text();
			preview = text.slice(0, 280).replace(/\s+/g, ' ');
		} catch {
			preview = '(corpo nao legivel)';
		}
		const level: BootTraceLevel = response.ok ? 'ok' : response.status >= 500 ? 'error' : 'warn';
		const detail = `HTTP ${response.status} · ${ms}ms · ${ct}\n${preview}`;
		await postClientTrace({
			level,
			phase: step.phase,
			message: step.label,
			detail
		});
		return { status: response.status, ms, preview, level };
	} catch (error) {
		const ms = Math.round(performance.now() - t0);
		const msg = error instanceof Error ? error.message : String(error);
		await postClientTrace({
			level: 'error',
			phase: step.phase,
			message: step.label,
			detail: `Falha de rede apos ${ms}ms: ${msg}`
		});
		return { status: 0, ms, preview: msg, level: 'error' };
	}
}

export function LogViewPage(): ReactElement {
	const [bundle, setBundle] = useState<LogviewBundle | null>(null);
	const [pollError, setPollError] = useState<string | null>(null);
	const [statusLine, setStatusLine] = useState('Conectando...');
	const [simulating, setSimulating] = useState(false);
	const [copyOk, setCopyOk] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const autostartDone = useRef(false);

	useEffect(() => {
		document.body.classList.add('chat-body');
		return () => document.body.classList.remove('chat-body');
	}, []);

	const refresh = useCallback(async () => {
		try {
			const data = await fetchLogviewBundle();
			setBundle(data);
			setPollError(null);
			setStatusLine(`Atualizado ${new Date(data.ts).toLocaleTimeString()} · ${data.trace.length} eventos`);
		} catch (error) {
			setPollError(error instanceof Error ? error.message : 'Falha no bundle');
			setStatusLine('Backend offline ou /princy-api incorreto');
		}
	}, []);

	useEffect(() => {
		void refresh();
		const id = window.setInterval(() => void refresh(), 1500);
		return () => window.clearInterval(id);
	}, [refresh]);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [bundle?.trace.length, simulating]);

	const runSimulation = useCallback(async () => {
		if (simulating) {
			return;
		}
		setSimulating(true);
		setStatusLine('Simulando index → webeditor...');
		await resetServerTrace();
		await postClientTrace({
			level: 'info',
			phase: 'logview',
			message: 'Inicio simulacao: landing (3220) → Code Web (3200)',
			detail: `origin=${window.location.origin} editor=${EDITOR_URL}`
		});
		for (const step of SIM_STEPS) {
			setStatusLine(`Testando: ${step.label}`);
			await probeUrl(step);
			await refresh();
		}
		await postClientTrace({
			level: 'info',
			phase: 'logview',
			message: 'Simulacao concluida',
			detail: 'Revise entradas ERR/warn acima; abra o editor se todos os OK'
		});
		await refresh();
		setSimulating(false);
		setStatusLine('Simulacao concluida');
	}, [refresh, simulating]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('autostart') === '1' && !autostartDone.current) {
			autostartDone.current = true;
			void runSimulation();
		}
	}, [runSimulation]);

	async function copyAll(): Promise<void> {
		const text = bundle?.copyText ?? '';
		if (!text) {
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			setCopyOk(true);
			window.setTimeout(() => setCopyOk(false), 2500);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = text;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
			setCopyOk(true);
			window.setTimeout(() => setCopyOk(false), 2500);
		}
	}

	async function clearTrace(): Promise<void> {
		await resetServerTrace();
		await postClientTrace({ level: 'info', phase: 'logview', message: 'Trace limpo pelo usuario' });
		await refresh();
	}

	function renderTraceRow(row: BootTraceEntry): ReactElement {
		const role = traceBubbleRole(row.level);
		return (
			<article key={row.id} className={`chat-bubble ${role}`}>
				<div className="chat-avatar" aria-hidden="true">{traceAvatar(row.level)}</div>
				<div className="chat-bubble-body">
					<p className="chat-meta logview-meta">
						+{row.elapsedMs}ms · {row.phase} · {row.at}
					</p>
					<p className="chat-paragraph"><strong>{row.message}</strong></p>
					{row.detail ? <pre className="chat-code logview-detail"><code>{row.detail}</code></pre> : null}
				</div>
			</article>
		);
	}

	const traceRows = bundle?.trace ?? [];

	return (
		<div className="chat-app">
			<aside className="chat-sidebar">
				<div className="chat-brand">
					<span className="chat-logo" aria-hidden="true">L</span>
					<div>
						<strong>LogView</strong>
						<span className="muted">Index → Code Web</span>
					</div>
				</div>

				<button
					type="button"
					className="chat-side-btn primary"
					disabled={simulating}
					onClick={() => void runSimulation()}
				>
					{simulating ? 'Simulando...' : 'Simular index → editor'}
				</button>

				<button type="button" className="chat-side-btn" onClick={() => void copyAll()} disabled={!bundle?.copyText}>
					{copyOk ? 'Copiado!' : 'Copiar log completo'}
				</button>

				<button type="button" className="chat-side-btn ghost" onClick={() => void clearTrace()}>
					Limpar trace
				</button>

				<button type="button" className="chat-side-btn ghost" onClick={() => void refresh()}>
					Atualizar agora
				</button>

				<nav className="chat-nav">
					<a href={EDITOR_URL} target="_blank" rel="noreferrer">Abrir Code Web</a>
					<a href="/">Hub / landing</a>
					<button type="button" onClick={() => navigate('chat')}>Chat</button>
					<button type="button" onClick={() => navigate('hub')}>Hub (#)</button>
				</nav>
			</aside>

			<section className="chat-main">
				<header className="chat-topbar">
					<h1>Boot trace — tempo real</h1>
					<span className="chat-status">{statusLine}</span>
				</header>

				{pollError ? (
					<div className="chat-banner error">
						{pollError} — confira PrincyAiAgentBackend :3210 e Caddy /princy-api → 3210
					</div>
				) : null}

				<div className="chat-thread" ref={scrollRef}>
					<article className="chat-bubble assistant">
						<div className="chat-avatar" aria-hidden="true">AI</div>
						<div className="chat-bubble-body">
							<p className="chat-paragraph">
								Acompanhe cada acesso e erro do caminho <strong>landing :3220</strong> →{' '}
								<strong>/princy-api</strong> → <strong>/webeditor/ :3200</strong>.
								Use <strong>Simular</strong> para testar URLs como o browser; depois <strong>Copiar log completo</strong> para colar no suporte.
							</p>
						</div>
					</article>

					{traceRows.map(renderTraceRow)}

					{bundle?.probes?.map(p => (
						<article key={p.name} className={`chat-bubble ${p.ok ? 'ok' : 'system'}`}>
							<div className="chat-avatar" aria-hidden="true">{p.ok ? 'OK' : 'X'}</div>
							<div className="chat-bubble-body">
								<p className="chat-paragraph"><strong>Probe: {p.name}</strong></p>
								<p className="chat-meta">{p.url} — HTTP {p.status} · {p.ms}ms</p>
								<p className="chat-paragraph muted">{p.hint}</p>
								{p.bodyPreview ? (
									<pre className="chat-code logview-detail"><code>{p.bodyPreview}</code></pre>
								) : null}
							</div>
						</article>
					))}

					{bundle?.runtimeLogs?.logs && Object.keys(bundle.runtimeLogs.logs).length > 0 ? (
						<article className="chat-bubble assistant">
							<div className="chat-avatar" aria-hidden="true">NSSM</div>
							<div className="chat-bubble-body">
								<p className="chat-paragraph"><strong>Arquivos de log no VPS</strong></p>
								{Object.entries(bundle.runtimeLogs.logs).map(([name, lines]) => (
									<div key={name}>
										<p className="chat-meta">{name}</p>
										<pre className="chat-code logview-detail"><code>{lines.slice(-25).join('\n') || '(vazio)'}</code></pre>
									</div>
								))}
							</div>
						</article>
					) : null}
				</div>

				<footer className="chat-composer">
					<div className="chat-composer-inner logview-footer">
						<p className="chat-hint muted">
							Atualiza a cada 1,5s · {traceRows.length} linhas de trace · probes + NSSM no fim do scroll
						</p>
					</div>
				</footer>
			</section>
		</div>
	);
}
