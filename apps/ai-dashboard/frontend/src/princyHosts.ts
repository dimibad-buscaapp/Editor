export const PRINCY_VPS_IP = '108.181.169.40';
export const PRINCY_EDITOR_PORT = 3200;
export const PRINCY_DASHBOARD_PORT = 3210;
export const PRINCY_INDEX_PORT = 3220;

export function isLocalDevHost(hostname: string): boolean {
	return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function resolveEditorUrl(hostname: string, origin: string): string {
	if (isLocalDevHost(hostname) || hostname === PRINCY_VPS_IP) {
		return `http://${PRINCY_VPS_IP}:${PRINCY_EDITOR_PORT}/webeditor/`;
	}
	if (hostname === 'princyai.com' || hostname === 'www.princyai.com') {
		return `${origin}/webeditor/`;
	}
	return `${origin}/webeditor/`;
}

export function resolveDashboardUrl(hostname: string): string {
	if (isLocalDevHost(hostname) || hostname === PRINCY_VPS_IP) {
		return `http://${PRINCY_VPS_IP}:${PRINCY_DASHBOARD_PORT}/`;
	}
	return 'https://dashboard.princyai.com/';
}

/** Base URL para /api/agent/* (evita HTML da landing :3220 em princyai.com). */
export function resolveAgentApiBase(hostname: string, port: string): string {
	if (hostname === 'dashboard.princyai.com') {
		return '';
	}
	if (port === String(PRINCY_DASHBOARD_PORT)) {
		return '';
	}
	if (hostname === 'princyai.com' || hostname === 'www.princyai.com') {
		return '/princy-api';
	}
	if (hostname === PRINCY_VPS_IP && port === String(PRINCY_INDEX_PORT)) {
		return `http://${PRINCY_VPS_IP}:${PRINCY_DASHBOARD_PORT}`;
	}
	if (isLocalDevHost(hostname) && (port === '5173' || port === '')) {
		return '';
	}
	if (isLocalDevHost(hostname) && port === String(PRINCY_INDEX_PORT)) {
		return `http://127.0.0.1:${PRINCY_DASHBOARD_PORT}`;
	}
	if (isLocalDevHost(hostname)) {
		return `http://127.0.0.1:${PRINCY_DASHBOARD_PORT}`;
	}
	return '/princy-api';
}
