import { config } from './config.js';

const defaultAllowedOrigins = new Set([
	config.appOrigin,
	config.codeWebUrl,
	'http://108.181.169.40:3200',
	'http://108.181.169.40:3220',
	'http://127.0.0.1:3200',
	'http://localhost:3200',
	'http://127.0.0.1:5173',
	'http://localhost:5173',
	'https://princyai.com',
	'http://princyai.com',
	'https://www.princyai.com'
]);

for (const origin of config.corsOrigins) {
	defaultAllowedOrigins.add(origin);
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
	if (!origin) {
		return true;
	}

	if (defaultAllowedOrigins.has(origin)) {
		return true;
	}

	try {
		const url = new URL(origin);
		// Code Web local no VPS (APP_ORIGIN pode ser https://princyai.com em producao)
		if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
			return true;
		}
		if (url.hostname.endsWith('.princyai.com') || url.hostname === 'princyai.com') {
			return true;
		}
		// Editor por IP do VPS antes do dominio (ex.: http://108.x.x.x:3200)
		if (url.port === '3200' || url.port === '443' || url.port === '') {
			return true;
		}
	} catch {
		return false;
	}

	return false;
}

/** Origem a devolver no header Access-Control-Allow-Origin (eco da requisicao). */
export function resolveCorsOrigin(requestOrigin: string | undefined): boolean | string {
	if (!requestOrigin) {
		return true;
	}
	return isAllowedCorsOrigin(requestOrigin) ? requestOrigin : false;
}
