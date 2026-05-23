import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import staticFiles from '@fastify/static';
import { z } from 'zod';
import { config } from '../config.js';
import {
	ensureSitesStorageLayout,
	getSiteInfo,
	listSites,
	normalizeSlug,
	publishSite,
	resolveProjectPathForSite,
	syncPreview,
	validateSlug
} from './webSiteService.js';

const siteBodySchema = z.object({
	projectSlug: z.string().optional(),
	projectPath: z.string().optional(),
	buildId: z.string().optional()
});

const ASSET_EXT = /\.(js|mjs|cjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|json|wasm|txt|xml)$/i;

const publicSitePaths = new Set([
	'/api/sites'
]);

function authorizeSiteRequest(request: FastifyRequest, reply: FastifyReply): void {
	if (!config.agentApiToken) {
		return;
	}
	const authorization = request.headers.authorization;
	if (authorization !== `Bearer ${config.agentApiToken}`) {
		reply.code(401);
		throw new Error('Invalid agent API token');
	}
}

function isPublicSitePath(pathname: string): boolean {
	if (publicSitePaths.has(pathname)) {
		return true;
	}
	return /^\/api\/sites\/[^/]+$/.test(pathname);
}

function parseSiteRequestPath(url: string, prefix: string): { slug: string; subPath: string } | undefined {
	const pathname = url.split('?')[0] ?? url;
	if (!pathname.startsWith(prefix)) {
		return undefined;
	}
	const rest = pathname.slice(prefix.length).replace(/^\/+/, '');
	if (!rest) {
		return undefined;
	}
	const segments = rest.split('/').filter(Boolean);
	if (segments.length === 0) {
		return undefined;
	}
	const slug = segments[0]!;
	const subPath = segments.slice(1).join('/');
	return { slug, subPath };
}

async function handleSiteStaticRequest(
	request: FastifyRequest,
	reply: FastifyReply,
	root: string,
	prefix: string
): Promise<void> {
	const pathname = request.url.split('?')[0] ?? request.url;
	const parsed = parseSiteRequestPath(pathname, prefix);
	if (!parsed) {
		return reply.code(404).send({ message: 'Site not found' });
	}

	try {
		validateSlug(parsed.slug);
	} catch {
		return reply.code(404).send({ message: 'Site not found' });
	}

	const siteDir = path.join(root, parsed.slug);
	if (!fs.existsSync(siteDir)) {
		return reply.code(404).send({ message: 'Site not found' });
	}

	if (parsed.subPath) {
		const filePath = path.join(siteDir, parsed.subPath);
		if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
			return reply.sendFile(parsed.subPath, siteDir);
		}
		if (ASSET_EXT.test(parsed.subPath)) {
			return reply.code(404).send({ message: 'Not found' });
		}
	}

	const indexPath = path.join(siteDir, 'index.html');
	if (!fs.existsSync(indexPath)) {
		return reply.code(404).send({ message: 'index.html not found' });
	}
	return reply.sendFile('index.html', siteDir);
}

function registerSiteRedirect(app: FastifyInstance, prefix: string): void {
	app.get(`${prefix}/:slug`, async (request, reply) => {
		const params = z.object({ slug: z.string().min(1) }).parse(request.params);
		try {
			validateSlug(params.slug);
		} catch {
			return reply.code(404).send({ message: 'Site not found' });
		}
		const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
		return reply.code(301).redirect(`${prefix}/${normalizeSlug(params.slug)}/${query}`);
	});
}

export async function registerSiteRoutes(app: FastifyInstance): Promise<void> {
	ensureSitesStorageLayout();

	app.addHook('preHandler', async (request, reply) => {
		const pathname = request.url.split('?')[0] ?? request.url;
		if (!pathname.startsWith('/api/sites')) {
			return;
		}
		if (config.publicChatEnabled && isPublicSitePath(pathname)) {
			return;
		}
		authorizeSiteRequest(request, reply);
	});

	app.get('/api/sites', async () => ({
		ok: true,
		sites: listSites(),
		publishedPathPrefix: config.sitesPublishedPathPrefix,
		previewPathPrefix: config.sitesPreviewPathPrefix,
		publicOrigin: config.publicOrigin
	}));

	app.get('/api/sites/:slug', async request => {
		const params = z.object({ slug: z.string().min(1) }).parse(request.params);
		const info = getSiteInfo(params.slug);
		return { ok: true, site: info };
	});

	app.post('/api/sites/:slug/preview-sync', async request => {
		const params = z.object({ slug: z.string().min(1) }).parse(request.params);
		const body = siteBodySchema.parse(request.body ?? {});
		try {
			const projectPath = resolveProjectPathForSite(params.slug, body);
			const previewUrl = await syncPreview(params.slug, projectPath);
			return { ok: true, slug: normalizeSlug(params.slug), previewUrl, site: getSiteInfo(params.slug) };
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			};
		}
	});

	app.post('/api/sites/:slug/publish', async request => {
		const params = z.object({ slug: z.string().min(1) }).parse(request.params);
		const body = siteBodySchema.parse(request.body ?? {});
		try {
			const projectPath = resolveProjectPathForSite(params.slug, body);
			const result = await publishSite(params.slug, projectPath, {
				buildId: body.buildId
			});
			return {
				ok: true,
				slug: normalizeSlug(params.slug),
				publishedUrl: result.publishedUrl,
				publishedAt: result.manifest.publishedAt,
				site: getSiteInfo(params.slug)
			};
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			};
		}
	});
}

export async function registerSiteStatic(app: FastifyInstance): Promise<void> {
	ensureSitesStorageLayout();

	await app.register(staticFiles, {
		root: config.sitesPublishedRoot,
		prefix: `${config.sitesPublishedPathPrefix}/`,
		decorateReply: true,
		wildcard: false
	});

	await app.register(staticFiles, {
		root: config.sitesPreviewRoot,
		prefix: `${config.sitesPreviewPathPrefix}/`,
		decorateReply: false,
		wildcard: false
	});

	registerSiteRedirect(app, config.sitesPublishedPathPrefix);
	registerSiteRedirect(app, config.sitesPreviewPathPrefix);

	const publishedWildcard = `${config.sitesPublishedPathPrefix}/:slug/*`;
	const previewWildcard = `${config.sitesPreviewPathPrefix}/:slug/*`;

	app.get(publishedWildcard, async (request, reply) =>
		handleSiteStaticRequest(request, reply, config.sitesPublishedRoot, `${config.sitesPublishedPathPrefix}/`));
	app.get(previewWildcard, async (request, reply) =>
		handleSiteStaticRequest(request, reply, config.sitesPreviewRoot, `${config.sitesPreviewPathPrefix}/`));
}
