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
