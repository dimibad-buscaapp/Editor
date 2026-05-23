import Fastify from 'fastify';
import { registerSwagger } from './plugins/swagger.js';

const app = Fastify({ logger: true });
await registerSwagger(app);

app.get('/health', async () => ({ ok: true, name: '{{PROJECT_NAME}}' }));

app.post('/webhooks/:provider', {
	schema: {
		tags: ['webhooks'],
		params: {
			type: 'object',
			properties: { provider: { type: 'string' } }
		}
	}
}, async (req, reply) => {
	const provider = (req.params as { provider: string }).provider;
	const secret = process.env.WEBHOOK_SECRET ?? '';
	const signature = req.headers['x-webhook-signature'] ?? req.headers['x-signature'];
	if (secret && signature !== secret) {
		return reply.code(401).send({ ok: false, message: 'Assinatura invalida' });
	}
	app.log.info({ provider, body: req.body }, 'webhook recebido');
	return { ok: true, provider, receivedAt: new Date().toISOString() };
});

// PRINCY_API_STUDIO_INSERT

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
