import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { api, type DiagnosticReport } from '../api.js';
import { navigate } from '../router.js';

export function LogsPage(): ReactElement {
	const [report, setReport] = useState<DiagnosticReport | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setReport(await api.diagnostic());
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Falha ao carregar diagnostico');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
		const id = window.setInterval(() => void refresh(), 15_000);
		return () => window.clearInterval(id);
	}, [refresh]);

	async function clearLogs(): Promise<void> {
		await api.clearLogs();
		await refresh();
	}

	return (
		<main className="logs-shell">
			<header className="logs-header">
				<div>
					<p className="eyebrow">Princy Ai</p>
					<h1>Logs e diagnostico</h1>
					<p className="muted">Verifique backend, Ollama, Code Web e proxy /princy-api.</p>
				</div>
				<div className="logs-toolbar">
					<button type="button" onClick={() => void refresh()} disabled={loading}>Atualizar</button>
					<button type="button" className="secondary-button" onClick={() => void clearLogs()}>Limpar log HTTP</button>
					<button type="button" className="link-button" onClick={() => navigate('hub')}>Inicio</button>
				</div>
			</header>

			{loading && !report && <p className="muted">Carregando...</p>}
			{error && <p className="error">{error}</p>}

			{report && (
				<>
					<section className="logs-meta">
						<p><strong>Gerado:</strong> {report.generatedAt}</p>
						<p><strong>APP_ORIGIN:</strong> <code>{report.appOrigin}</code></p>
						<p><strong>CODE_WEB_URL:</strong> <code>{report.codeWebUrl}</code></p>
						<p><strong>API_PORT:</strong> <code>{report.apiPort}</code></p>
					</section>

					<section className="checks-grid">
						{report.checks.map(check => (
							<article key={check.id} className={`check-card ${check.ok ? 'ok' : 'fail'}`}>
								<h3>{check.label}</h3>
								<p>{check.detail}</p>
							</article>
						))}
					</section>

					{report.hints.length > 0 && (
						<section className="hints-box">
							<h2>Dicas</h2>
							<ul>{report.hints.map(hint => <li key={hint}>{hint}</li>)}</ul>
						</section>
					)}

					<section className="log-table-wrap">
						<h2>Ultimas requisicoes HTTP (backend)</h2>
						<table className="log-table">
							<thead>
								<tr>
									<th>Hora</th>
									<th>Metodo</th>
									<th>URL</th>
									<th>Status</th>
									<th>ms</th>
								</tr>
							</thead>
							<tbody>
								{report.recentRequests.length === 0 && (
									<tr><td colSpan={5} className="muted">Nenhuma requisicao registrada ainda.</td></tr>
								)}
								{report.recentRequests.map((row, index) => (
									<tr key={`${row.at}-${index}`} className={row.statusCode >= 400 ? 'row-fail' : ''}>
										<td>{row.at}</td>
										<td>{row.method}</td>
										<td><code>{row.url}</code></td>
										<td>{row.statusCode}</td>
										<td>{row.durationMs}</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</>
			)}
		</main>
	);
}
