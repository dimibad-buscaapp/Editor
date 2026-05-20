/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { ILogService } from '../../platform/log/common/log.js';

const PROXY_PREFIX = '/princy-api';
const DEFAULT_TARGET_HOST = process.env['PRINCY_AGENT_API_HOST'] ?? '127.0.0.1';
const DEFAULT_TARGET_PORT = Number(process.env['PRINCY_AGENT_API_PORT'] ?? '3210');

export function isPrincyAgentApiProxyPath(pathname: string): boolean {
	return pathname === PROXY_PREFIX || pathname.startsWith(`${PROXY_PREFIX}/`);
}

/**
 * Proxies /princy-api/* to the Princy agent Fastify backend on localhost.
 * Enables same-origin fetch from the web extension (no CORS / no client-side 127.0.0.1).
 */
export function handlePrincyAgentApiProxy(
	req: IncomingMessage,
	res: ServerResponse,
	pathname: string,
	search: string | null | undefined,
	logService: ILogService
): void {
	const requestOrigin = req.headers['origin'];
	if (req.method === 'OPTIONS') {
		writeCorsHeaders(res, requestOrigin);
		res.writeHead(204);
		res.end();
		return;
	}

	const targetPath = pathname.length > PROXY_PREFIX.length
		? pathname.slice(PROXY_PREFIX.length)
		: '/';

	const headers: http.OutgoingHttpHeaders = {};
	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined || key === 'host' || key === 'connection') {
			continue;
		}
		headers[key] = value;
	}

	const proxyReq = http.request(
		{
			hostname: DEFAULT_TARGET_HOST,
			port: DEFAULT_TARGET_PORT,
			method: req.method,
			path: targetPath + (search ?? ''),
			headers
		},
		proxyRes => {
			writeCorsHeaders(res, requestOrigin);
			res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
			proxyRes.pipe(res);
		}
	);

	proxyReq.on('error', error => {
		logService.warn(`[Princy API proxy] ${req.method} ${pathname} -> ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}${targetPath}: ${error.message}`);
		writeCorsHeaders(res, requestOrigin);
		res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
		res.end(JSON.stringify({
			error: 'Princy agent backend unreachable',
			detail: error.message,
			hint: 'Start deploy/windows/agent-backend/start-princy-agent-backend.ps1 on port 3210'
		}));
	});

	if (req.method === 'GET' || req.method === 'HEAD') {
		proxyReq.end();
	} else {
		req.pipe(proxyReq);
	}
}

function writeCorsHeaders(res: ServerResponse, requestOrigin: string | undefined): void {
	if (requestOrigin) {
		res.setHeader('Access-Control-Allow-Origin', requestOrigin);
		res.setHeader('Access-Control-Allow-Credentials', 'true');
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');
	res.setHeader('Vary', 'Origin');
}
