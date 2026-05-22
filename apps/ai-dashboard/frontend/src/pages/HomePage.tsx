import type { ReactElement } from 'react';
import { navigate } from '../router.js';
import { resolveDashboardUrl, resolveEditorUrl } from '../princyHosts.js';

const EDITOR_URL = typeof window !== 'undefined'
	? resolveEditorUrl(window.location.hostname, window.location.origin)
	: 'https://princyai.com/webeditor/';

const DASHBOARD_URL = typeof window !== 'undefined'
	? resolveDashboardUrl(window.location.hostname)
	: 'https://dashboard.princyai.com/';

export function HomePage(): ReactElement {
	return (
		<main className="hub-shell home-shell">
			<section className="hub-card home-card">
				<p className="eyebrow">Princy Ai</p>
				<h1>Editor e IA no navegador</h1>
				<p className="muted">
					Pagina inicial em princyai.com. Abra o editor web, use o chat no dashboard ou entre na sua conta.
				</p>
				<div className="hub-actions">
					<a className="hub-btn primary" href={EDITOR_URL}>Abrir Web Editor</a>
					<a className="hub-btn" href={DASHBOARD_URL} target="_blank" rel="noreferrer">Chat IA (dashboard)</a>
					<button type="button" className="hub-btn" onClick={() => navigate('login')}>Entrar / criar conta</button>
					<button type="button" className="hub-btn" onClick={() => navigate('dashboard')}>Painel</button>
				</div>
				<ul className="hub-hints muted">
					<li>Editor: <code>{EDITOR_URL}</code></li>
					<li>Chat: <code>{DASHBOARD_URL}</code></li>
					<li>API no editor: <code>/princy-api</code></li>
				</ul>
			</section>
		</main>
	);
}
