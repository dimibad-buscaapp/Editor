import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { BuildType } from './types.js';

const BUILD_TYPES: readonly BuildType[] = ['apk', 'exe', 'web', 'api'];

export function getProjectsRoot(): string {
	return config.projectsRoot;
}

export function getBuildsRoot(): string {
	return config.buildsRoot;
}

export function getBuildJobDir(type: BuildType, buildId: string): string {
	return path.join(config.buildsRoot, type, buildId);
}

export function getBuildManifestPath(type: BuildType, buildId: string): string {
	return path.join(getBuildJobDir(type, buildId), 'manifest.json');
}

export function getBuildLogPath(type: BuildType, buildId: string): string {
	return path.join(getBuildJobDir(type, buildId), 'build.log');
}

export function getBuildArtifactPath(type: BuildType, buildId: string, artifactName: string): string {
	return path.join(getBuildJobDir(type, buildId), artifactName);
}

export function ensureBuildStorageLayout(): void {
	fs.mkdirSync(config.projectsRoot, { recursive: true });
	for (const type of BUILD_TYPES) {
		fs.mkdirSync(path.join(config.buildsRoot, type), { recursive: true });
	}
}

export function listProjectSlugs(): { readonly slug: string; readonly path: string }[] {
	ensureBuildStorageLayout();
	if (!fs.existsSync(config.projectsRoot)) {
		return [];
	}
	const entries = fs.readdirSync(config.projectsRoot, { withFileTypes: true });
	return entries
		.filter(entry => entry.isDirectory())
		.map(entry => ({
			slug: entry.name,
			path: path.join(config.projectsRoot, entry.name)
		}))
		.sort((a, b) => a.slug.localeCompare(b.slug));
}
