import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { config } from './config.js';

function logviewHtmlPath(): string {
	return path.join(config.editorProjectRoot, 'deploy', 'windows', 'logview', 'index.html');
}

export async function registerLogviewRoutes(app: FastifyInstance): Promise<void> {
	const sendPage = async (_request: unknown, reply: FastifyReply): Promise<void> => {
		const htmlPath = logviewHtmlPath();
		if (!fs.existsSync(htmlPath)) {
			return reply.code(500).send({
				ok: false,
				message: 'logview.html ausente no VPS',
				expected: htmlPath,
				hint: 'git pull em C:\\Apps\\Editor'
			});
		}
		const html = fs.readFileSync(htmlPath, 'utf8');
		return reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(html);
	};

	app.get('/logview', sendPage);
	app.get('/logview/', sendPage);
}
