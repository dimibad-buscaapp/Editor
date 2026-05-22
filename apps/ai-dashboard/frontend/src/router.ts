export type AppRoute = 'chat' | 'hub' | 'login' | 'dashboard' | 'workspace' | 'logs';

function defaultRouteForHost(): AppRoute {
	if (typeof window === 'undefined') {
		return 'hub';
	}
	const host = window.location.hostname.toLowerCase();
	if (host === 'dashboard.princyai.com') {
		return 'chat';
	}
	return 'hub';
}

export function parseHashRoute(): AppRoute {
	const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
	if (hash === 'chat') {
		return 'chat';
	}
	if (hash === '') {
		return defaultRouteForHost();
	}
	if (hash === 'login') {
		return 'login';
	}
	if (hash === 'dashboard') {
		return 'chat';
	}
	if (hash === 'workspace') {
		return 'workspace';
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
	if (route === 'hub') {
		window.location.hash = '#/';
		return;
	}
	if (route === 'chat') {
		window.location.hash = '#/chat';
		return;
	}
	window.location.hash = `#/${route}`;
}
