import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export async function registerItemRoutes(app: FastifyInstance, prisma: PrismaClient): Promise<void> {
	app.get('/api/items', {
		schema: {
			tags: ['items'],
			description: 'Lista todos os items',
			response: { 200: { type: 'array', items: { type: 'object' } } }
		}
	}, async () => prisma.item.findMany());

	app.post('/api/items', {
		schema: {
			tags: ['items'],
			body: {
				type: 'object',
				properties: { title: { type: 'string' } }
			}
		}
	}, async req => {
		const body = req.body as { title?: string };
		return prisma.item.create({ data: { title: body.title ?? 'Novo item' } });
	});
}
