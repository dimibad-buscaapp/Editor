import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { registerSwagger } from './plugins/swagger.js';
import { registerItemRoutes } from './routes/items.js';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await registerSwagger(app);

app.get('/health', {
	schema: { tags: ['system'], description: 'Health check' }
}, async () => ({ ok: true, name: '{{PROJECT_NAME}}' }));

await registerItemRoutes(app, prisma);

// PRINCY_API_STUDIO_INSERT

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
