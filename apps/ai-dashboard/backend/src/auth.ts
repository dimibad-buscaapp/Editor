import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

const scryptAsync = promisify(scrypt);
const sessionCookieName = 'ai_dashboard_session';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export type AuthenticatedUser = {
	id: string;
	email: string;
	name: string;
};

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const hash = await scryptAsync(password, salt, 64) as Buffer;
	return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [salt, hashHex] = storedHash.split(':');
	if (!salt || !hashHex) {
		return false;
	}

	const expectedHash = Buffer.from(hashHex, 'hex');
	const actualHash = await scryptAsync(password, salt, expectedHash.length) as Buffer;
	return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(reply: FastifyReply, userId: string): Promise<void> {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

	await prisma.session.create({
		data: {
			tokenHash: hashSessionToken(token),
			userId,
			expiresAt
		}
	});

	reply.setCookie(sessionCookieName, token, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		maxAge: sessionMaxAgeSeconds,
		secure: process.env.NODE_ENV === 'production'
	});
}

export async function clearSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const token = request.cookies[sessionCookieName];
	if (token) {
		await prisma.session.deleteMany({
			where: {
				tokenHash: hashSessionToken(token)
			}
		});
	}

	reply.clearCookie(sessionCookieName, { path: '/' });
}

export async function getAuthenticatedUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
	const token = request.cookies[sessionCookieName];
	if (!token) {
		return null;
	}

	const session = await prisma.session.findUnique({
		where: {
			tokenHash: hashSessionToken(token)
		},
		include: {
			user: {
				select: {
					id: true,
					email: true,
					name: true
				}
			}
		}
	});

	if (!session || session.expiresAt <= new Date()) {
		if (session) {
			await prisma.session.delete({
				where: {
					tokenHash: session.tokenHash
				}
			});
		}
		return null;
	}

	return session.user;
}

export async function requireAuthenticatedUser(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser> {
	const user = await getAuthenticatedUser(request);
	if (!user) {
		reply.code(401);
		throw new Error('Authentication required');
	}

	return user;
}
