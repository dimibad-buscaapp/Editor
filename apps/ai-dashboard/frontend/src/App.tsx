import { useEffect, useState, type ReactElement } from 'react';
import { api, type User } from './api.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { HomePage } from './pages/HomePage.js';
import { HubPage } from './pages/HubPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { navigate, parseHashRoute, type AppRoute } from './router.js';

export function App(): ReactElement {
	const [route, setRoute] = useState<AppRoute>(() => parseHashRoute());
	const [user, setUser] = useState<User | null>(null);
	const [boot, setBoot] = useState(true);

	useEffect(() => {
		const onHash = (): void => setRoute(parseHashRoute());
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	useEffect(() => {
		if (isLogviewPath()) {
			return;
		}
		api.me()
			.then(result => setUser(result.user))
			.finally(() => setBoot(false));
	}, []);

	function onAuthenticated(next: User): void {
		setUser(next);
		navigate('dashboard');
	}

	if (route === 'chat') {
		return <ChatPage />;
	}

	if (route === 'logs') {
		return <LogsPage />;
	}

	if (route === 'hub') {
		const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
		if (host === 'princyai.com' || host === 'www.princyai.com') {
			return <HomePage />;
		}
		return <HubPage />;
	}

	if (route === 'login') {
		return <LoginPage onAuthenticated={onAuthenticated} />;
	}

	if (boot) {
		return <main className="centered">Carregando...</main>;
	}

	if (!user) {
		return <LoginPage onAuthenticated={onAuthenticated} />;
	}

	return <DashboardPage user={user} onLogout={() => setUser(null)} />;
}
