import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
const app = Fastify({ logger: true });
const users = new Map<string, string>();
app.post('/api/auth/register', async req => {
  const { email, password } = req.body as { email: string; password: string };
  users.set(email, await bcrypt.hash(password, 10));
  return { ok: true };
});
app.post('/api/auth/login', async req => {
  const { email, password } = req.body as { email: string; password: string };
  const hash = users.get(email);
  if (!hash || !(await bcrypt.compare(password, hash))) return { error: 'unauthorized' };
  const token = jwt.sign({ email }, process.env.JWT_SECRET ?? 'dev');
  return { token };
});
app.listen({ port: Number(process.env.PORT ?? 4002), host: '0.0.0.0' });
