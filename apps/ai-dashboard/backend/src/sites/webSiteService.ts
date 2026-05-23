import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { resolveProjectPath } from '../projectCreatorService.js';

function isWorkspaceRootAllowed(workspaceRoot: string): boolean {
	const resolved = path.resolve(workspaceRoot);
	return config.allowedWorkspaceRoots.some(root => {
		const allowed = path.resolve(root);
		return resolved === allowed || resolved.startsWith(allowed + path.sep);
	});
}

const DIST_CANDIDATES = ['dist', 'build', 'out'] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SiteManifest = {
	readonly slug: string;
	readonly publishedAt: number;
	readonly sourceProjectPath?: string;
	readonly buildId?: string;
};

export type SiteInfo = {
	readonly slug: string;
	readonly previewUrl: string;
	readonly publishedUrl: string;
	readonly hasPreview: boolean;
	readonly hasPublished: boolean;
	readonly publishedAt?: number;
	readonly sourceProjectPath?: string;
};

export type SiteListEntry = SiteInfo;

export function validateSlug(slug: string): void {
	const normalized = slug.trim().toLowerCase();
	if (!normalized || normalized.includes('..') || !SLUG_PATTERN.test(normalized)) {
		throw new Error('Slug de site invalido.');
	}
}

export function normalizeSlug(slug: string): string {
	validateSlug(slug);
	return slug.trim().toLowerCase();
}

export function ensureSitesStorageLayout(): void {
	for (const dir of [config.sitesPublishedRoot, config.sitesPreviewRoot]) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

export function resolveDistDir(projectPath: string): string {
	const resolved = path.resolve(projectPath);
	for (const name of DIST_CANDIDATES) {
		const candidate = path.join(resolved, name);
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
			return candidate;
		}
	}
	throw new Error('Pasta dist/, build/ ou out/ nao encontrada apos npm run build');
}

export function buildPreviewUrl(slug: string): string {
	return `${config.publicOrigin}${config.sitesPreviewPathPrefix}/${normalizeSlug(slug)}/`;
}

export function buildPublishedUrl(slug: string): string {
	return `${config.publicOrigin}${config.sitesPublishedPathPrefix}/${normalizeSlug(slug)}/`;
}

function siteManifestPath(slug: string): string {
	return path.join(config.sitesPublishedRoot, normalizeSlug(slug), 'manifest.json');
}

function readPublishedManifest(slug: string): SiteManifest | undefined {
	const manifestPath = siteManifestPath(slug);
	if (!fs.existsSync(manifestPath)) {
		return undefined;
	}
	try {
		return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SiteManifest;
	} catch {
		return undefined;
	}
}

function hasIndexHtml(dir: string): boolean {
	return fs.existsSync(path.join(dir, 'index.html'));
}

export async function copyDistTo(slug: string, distPath: string, targetRoot: string): Promise<void> {
	const normalized = normalizeSlug(slug);
	const resolvedDist = path.resolve(distPath);
	if (!fs.existsSync(resolvedDist)) {
		throw new Error(`Pasta de build nao encontrada: ${resolvedDist}`);
	}
	if (!hasIndexHtml(resolvedDist)) {
		throw new Error('dist/ sem index.html — build incompleto?');
	}

	ensureSitesStorageLayout();
	const dest = path.join(targetRoot, normalized);
	const tmp = path.join(targetRoot, `.${normalized}.tmp-${Date.now()}`);

	await fs.promises.mkdir(tmp, { recursive: true });
	await fs.promises.cp(resolvedDist, tmp, { recursive: true, force: true });

	if (fs.existsSync(dest)) {
		await fs.promises.rm(dest, { recursive: true, force: true });
	}
	await fs.promises.rename(tmp, dest);
}

export function resolveProjectPathForSite(
	slug: string,
	input: { readonly projectSlug?: string; readonly projectPath?: string }
): string {
	if (input.projectPath?.trim()) {
		const resolved = path.resolve(input.projectPath.trim());
		if (!isWorkspaceRootAllowed(resolved)) {
			throw new Error(`Projeto fora das pastas permitidas: ${resolved}`);
		}
		return resolved;
	}
	const projectSlug = (input.projectSlug ?? slug).trim();
	return resolveProjectPath(projectSlug);
}

export async function syncPreview(slug: string, projectPath: string): Promise<string> {
	const normalized = normalizeSlug(slug);
	const distPath = resolveDistDir(projectPath);
	await copyDistTo(normalized, distPath, config.sitesPreviewRoot);
	return buildPreviewUrl(normalized);
}

export async function publishSite(
	slug: string,
	projectPath: string,
	options?: { readonly buildId?: string }
): Promise<{ readonly publishedUrl: string; readonly manifest: SiteManifest }> {
	const normalized = normalizeSlug(slug);
	const distPath = resolveDistDir(projectPath);
	await copyDistTo(normalized, distPath, config.sitesPublishedRoot);

	const manifest: SiteManifest = {
		slug: normalized,
		publishedAt: Date.now(),
		sourceProjectPath: path.resolve(projectPath),
		...(options?.buildId ? { buildId: options.buildId } : {})
	};
	const dest = path.join(config.sitesPublishedRoot, normalized);
	fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

	return { publishedUrl: buildPublishedUrl(normalized), manifest };
}

export function getSiteInfo(slug: string): SiteInfo {
	const normalized = normalizeSlug(slug);
	const previewDir = path.join(config.sitesPreviewRoot, normalized);
	const publishedDir = path.join(config.sitesPublishedRoot, normalized);
	const hasPreview = hasIndexHtml(previewDir);
	const hasPublished = hasIndexHtml(publishedDir);
	const manifest = readPublishedManifest(normalized);

	return {
		slug: normalized,
		previewUrl: buildPreviewUrl(normalized),
		publishedUrl: buildPublishedUrl(normalized),
		hasPreview,
		hasPublished,
		publishedAt: manifest?.publishedAt,
		sourceProjectPath: manifest?.sourceProjectPath
	};
}

export function listSites(): SiteListEntry[] {
	ensureSitesStorageLayout();
	const slugs = new Set<string>();

	for (const root of [config.sitesPublishedRoot, config.sitesPreviewRoot]) {
		if (!fs.existsSync(root)) {
			continue;
		}
		for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith('.')) {
				continue;
			}
			try {
				validateSlug(entry.name);
				slugs.add(entry.name);
			} catch {
				// ignore invalid folder names
			}
		}
	}

	return [...slugs].sort().map(slug => getSiteInfo(slug));
}
