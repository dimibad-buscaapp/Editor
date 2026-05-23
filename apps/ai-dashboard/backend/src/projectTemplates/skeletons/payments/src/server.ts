import Fastify from 'fastify';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-11-20.acacia' });
const app = Fastify({ logger: true });
app.get('/health', async () => ({ ok: true, service: '{{PROJECT_NAME}} payments' }));
app.post('/api/checkout', async () => {
  const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price_data: { currency: 'brl', product_data: { name: '{{PROJECT_NAME}}' }, unit_amount: 1000 }, quantity: 1 }], success_url: 'https://example.com/success', cancel_url: 'https://example.com/cancel' });
  return { url: session.url };
});
app.post('/webhooks/stripe', { config: { rawBody: true } }, async (req, reply) => {
  reply.send({ received: true });
});
app.listen({ port: Number(process.env.PORT ?? 4001), host: '0.0.0.0' });
