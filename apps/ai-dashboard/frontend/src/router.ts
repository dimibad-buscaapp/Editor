export type AppRoute = 'hub' | 'login' | 'dashboard' | 'logs';

export function parseHashRoute(): AppRoute {
	const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
	if (hash === 'login') {
		return 'login';
	}
	if (hash === 'dashboard') {
		return 'dashboard';
	}
	if (hash === 'logs' || hash === 'log' || hash === 'diagnostico') {
		return 'logs';
	}
	return 'hub';
}

export function navigate(route: AppRoute): void {
	const path = route === 'hub' ? '' : route;
	window.location.hash = path ? `#/${path}` : '#/';
}
