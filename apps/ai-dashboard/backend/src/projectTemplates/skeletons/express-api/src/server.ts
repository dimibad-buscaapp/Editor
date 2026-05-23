import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
	definition: {
		openapi: '3.0.0',
		info: { title: '{{PROJECT_NAME}} API', version: '0.1.0' }
	},
	apis: ['./src/server.ts']
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/openapi.json', (_req, res) => res.json(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [system]
 */
app.get('/health', (_req, res) => {
	res.json({ ok: true, name: '{{PROJECT_NAME}}' });
});

/**
 * @openapi
 * /api/items:
 *   get:
 *     summary: Lista items
 *     tags: [items]
 */
app.get('/api/items', async (_req, res) => {
	res.json(await prisma.item.findMany());
});

app.post('/api/items', async (req, res) => {
	const title = typeof req.body?.title === 'string' ? req.body.title : 'Novo item';
	res.json(await prisma.item.create({ data: { title } }));
});

// PRINCY_API_STUDIO_INSERT

const port = Number(process.env.PORT ?? 4000);
app.listen(port, '0.0.0.0', () => {
	console.log(`Express API on http://127.0.0.1:${port}`);
});
