import { useState, type FormEvent, type ReactElement } from 'react';
import { api, type User } from '../api.js';
import { navigate } from '../router.js';

export function LoginPage(props: {
	readonly onAuthenticated: (user: User) => void;
}): ReactElement {
	const [mode, setMode] = useState<'login' | 'register'>('login');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent): Promise<void> {
		event.preventDefault();
		setError(null);
		try {
			const result = mode === 'login'
				? await api.login({ email, password })
				: await api.register({ name, email, password });
			props.onAuthenticated(result.user);
			navigate('dashboard');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Falha na autenticacao');
		}
	}

	return (
		<main className="auth-shell">
			<section className="auth-card">
				<p className="eyebrow">Princy Ai</p>
				<h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
				<p className="muted">Login para o dashboard (workspaces, chat e indexacao).</p>
				<form onSubmit={submit} className="form">
					{mode === 'register' && (
						<label htmlFor="princy-name">
							Nome
							<input id="princy-name" value={name} onChange={event => setName(event.target.value)} required />
						</label>
					)}
					<label htmlFor="princy-email">
						Email
						<input id="princy-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
					</label>
					<label htmlFor="princy-password">
						Senha
						<input id="princy-password" type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />
					</label>
					{error && <p className="error">{error}</p>}
					<button type="submit">{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
				</form>
				<button type="button" className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
					{mode === 'login' ? 'Precisa criar uma conta?' : 'Ja tem uma conta?'}
				</button>
				<p className="hub-footer">
					<button type="button" className="link-button" onClick={() => navigate('hub')}>Voltar</button>
					{' · '}
					<button type="button" className="link-button" onClick={() => navigate('logs')}>Ver logs</button>
				</p>
			</section>
		</main>
	);
}
