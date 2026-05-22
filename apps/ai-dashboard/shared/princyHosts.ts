/** VPS e URLs publicas Princy Ai (manter sincronizado com deploy/windows/princy-hosts.ps1). */
export const PRINCY_VPS_IP = '108.181.169.40';
export const PRINCY_DOMAIN = 'princyai.com';
export const PRINCY_DASHBOARD_DOMAIN = 'dashboard.princyai.com';

export const PRINCY_INDEX_PORT = 3220;
export const PRINCY_EDITOR_PORT = 3200;
export const PRINCY_DASHBOARD_PORT = 3210;

export const PRINCY_VPS_INDEX_URL = `http://${PRINCY_VPS_IP}:${PRINCY_INDEX_PORT}`;
export const PRINCY_VPS_EDITOR_URL = `http://${PRINCY_VPS_IP}:${PRINCY_EDITOR_PORT}/webeditor/`;
export const PRINCY_VPS_DASHBOARD_URL = `http://${PRINCY_VPS_IP}:${PRINCY_DASHBOARD_PORT}`;

export const PRINCY_PUBLIC_EDITOR_URL = `https://${PRINCY_DOMAIN}/webeditor/`;
export const PRINCY_PUBLIC_DASHBOARD_URL = `https://${PRINCY_DASHBOARD_DOMAIN}/`;
export const PRINCY_PUBLIC_API_PATH = '/princy-api';

export function isLocalDevHost(hostname: string): boolean {
	return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function isPrincyVpsHost(hostname: string): boolean {
	return hostname === PRINCY_VPS_IP || hostname === PRINCY_DOMAIN || hostname === `www.${PRINCY_DOMAIN}`;
}
