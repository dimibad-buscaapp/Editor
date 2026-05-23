import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const app = Fastify({ logger: true });
app.get('/health', async () => ({ ok: true, name: '{{PROJECT_NAME}}' }));
app.get('/api/items', async () => prisma.item.findMany());
app.post('/api/items', async req => {
  const body = req.body as { title?: string };
  return prisma.item.create({ data: { title: body.title ?? 'Novo item' } });
});

// PRINCY_API_STUDIO_INSERT

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: '0.0.0.0' });

app.post('/api/auth/login', async () => ({ token: 'demo-jwt-{{PROJECT_SLUG}}' }));
