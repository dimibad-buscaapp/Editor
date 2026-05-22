import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import staticFiles from '@fastify/static';
import Fastify from 'fastify';

const indexPort = Number(process.env.INDEX_PORT ?? process.env.PRINCY_INDEX_PORT ?? '3220');
const indexHost = process.env.INDEX_HOST ?? process.env.PRINCY_VPS_HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, '../../dist/frontend');

if (!fs.existsSync(frontendDist)) {
	console.error(`Frontend dist ausente: ${frontendDist}. Rode npm run build:frontend`);
	process.exit(1);
}

await app.register(staticFiles, {
	root: frontendDist,
	prefix: '/',
	index: ['index.html']
});

app.get('/', async (_request, reply) => reply.sendFile('index.html'));

app.setNotFoundHandler((_request, reply) => {
	reply.sendFile('index.html');
});

await app.listen({ host: indexHost, port: indexPort });
console.log(`Princy index (landing) http://${indexHost}:${indexPort}`);
