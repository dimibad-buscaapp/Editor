export type AppRoute = 'chat' | 'hub' | 'login' | 'dashboard' | 'logs';

export function parseHashRoute(): AppRoute {
	const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
	if (hash === 'chat' || hash === '') {
		return 'chat';
	}
	if (hash === 'login') {
		return 'login';
	}
	if (hash === 'dashboard') {
		return 'dashboard';
	}
	if (hash === 'logs' || hash === 'log' || hash === 'diagnostico') {
		return 'logs';
	}
	if (hash === 'hub') {
		return 'hub';
	}
	return 'chat';
}

export function navigate(route: AppRoute): void {
	if (route === 'chat') {
		window.location.hash = '#/';
		return;
	}
	window.location.hash = route === 'hub' ? '#/hub' : `#/${route}`;
}
