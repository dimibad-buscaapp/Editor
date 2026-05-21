import type { ReactElement } from 'react';
import { navigate } from '../router.js';

const EDITOR_HTTPS = 'https://princyai.com';

export function HubPage(): ReactElement {
	const editorUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
		? 'http://127.0.0.1:3200'
		: EDITOR_HTTPS;

	return (
		<main className="hub-shell">
			<section className="hub-card">
				<p className="eyebrow">Princy Ai</p>
				<h1>Plataforma online</h1>
				<p className="muted">Editor Code Web, agent backend, login e painel de diagnostico.</p>
				<div className="hub-actions">
					<a className="hub-btn primary" href={editorUrl} target="_blank" rel="noreferrer">Abrir editor (HTTPS)</a>
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
