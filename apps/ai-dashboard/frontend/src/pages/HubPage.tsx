import type { ReactElement } from 'react';
import { navigate } from '../router.js';

export function HubPage(): ReactElement {
	const editorUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
		? 'http://127.0.0.1:3200'
		: `${window.location.origin}/webeditor/`;

	return (
		<main className="hub-shell">
			<section className="hub-card">
				<p className="eyebrow">Princy Ai</p>
				<h1>Plataforma online</h1>
				<p className="muted">Editor Code Web, agent backend, login e painel de diagnostico.</p>
				<div className="hub-actions">
					<button type="button" className="hub-btn primary" onClick={() => navigate('chat')}>Chat IA (estilo Cursor)</button>
					<a className="hub-btn" href={editorUrl} target="_blank" rel="noreferrer">Abrir editor (HTTPS)</a>
					<button type="button" className="hub-btn" onClick={() => navigate('login')}>Entrar / criar conta</button>
					<button type="button" className="hub-btn" onClick={() => navigate('dashboard')}>Dashboard</button>
					<button type="button" className="hub-btn warn" onClick={() => navigate('logs')}>Logs e diagnostico</button>
				</div>
				<ul className="hub-hints muted">
					<li>Editor: <code>{editorUrl}</code></li>
					<li>API agent: <code>/api/health</code> neste host</li>
					<li>Proxy no editor: <code>/princy-api/api/health</code></li>
				</ul>
			</section>
		</main>
	);
}
