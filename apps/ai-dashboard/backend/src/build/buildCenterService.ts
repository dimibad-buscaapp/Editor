import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { runCapacitorApkPipeline } from './capacitorApkPipeline.js';
import { runElectronExePipeline } from './electronExePipeline.js';
import { collectBuildArtifact } from './artifactCollector.js';
import {
	ensureBuildStorageLayout,
	getBuildArtifactPath,
	getBuildJobDir,
	getBuildLogPath,
	getBuildManifestPath,
	listProjectSlugs
} from './storageLayout.js';
import type {
	BuildInternalStatus,
	BuildJobSnapshot,
	BuildManifest,
	BuildStatusResponse,
	BuildTarget,
	BuildType,
	StartBuildInput
} from './types.js';
import { internalToPublicStatus } from './types.js';
import { syncPreview } from '../sites/webSiteService.js';

export { listProjectSlugs };

const TARGET_TIMEOUT_MS: Record<BuildType, number> = {
	web: 30 * 60_000,
	api: 20 * 60_000,
	exe: 45 * 60_000,
	apk: 45 * 60_000
};

type ActiveBuild = {
	readonly buildId: string;
	readonly type: BuildType;
	readonly workspacePath: string;
	readonly projectSlug?: string;
	internalStatus: BuildInternalStatus;
	readonly startedAt: number;
	finishedAt?: number;
	artifactName?: string;
	errorMessage?: string;
	logOffset: number;
};

const activeById = new Map<string, ActiveBuild>();
const activeByWorkspace = new Map<string, string>();
const logListeners = new Map<string, Set<(chunk: string) => void>>();

export function isWorkspaceRootAllowed(workspaceRoot: string): boolean {
	const resolved = path.resolve(workspaceRoot);
	return config.allowedWorkspaceRoots.some(root => {
		const allowed = path.resolve(root);
		return resolved === allowed || resolved.startsWith(allowed + path.sep);
	});
}

export function recoverInterruptedBuilds(): void {
	ensureBuildStorageLayout();
	const types: BuildType[] = ['apk', 'exe', 'web', 'api'];
	for (const type of types) {
		const typeDir = path.join(config.buildsRoot, type);
		if (!fs.existsSync(typeDir)) {
			continue;
		}
		for (const entry of fs.readdirSync(typeDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			const manifestPath = getBuildManifestPath(type, entry.name);
			if (!fs.existsSync(manifestPath)) {
				continue;
			}
			try {
				const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BuildManifest;
				if (manifest.internalStatus === 'BUILDING' || manifest.internalStatus === 'QUEUED') {
					writeManifest({
						...manifest,
						internalStatus: 'FAILED',
						status: 'error',
						finishedAt: Date.now(),
						errorMessage: 'Build interrompido (reinicio do servidor)',
						artifactReady: false
					});
				}
			} catch {
				// ignore corrupt manifest
			}
		}
	}
}

function writeManifest(manifest: BuildManifest): void {
	const manifestPath = getBuildManifestPath(manifest.type, manifest.buildId);
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

function readManifest(type: BuildType, buildId: string): BuildManifest | undefined {
	const manifestPath = getBuildManifestPath(type, buildId);
	if (!fs.existsSync(manifestPath)) {
		return undefined;
	}
	try {
		return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BuildManifest;
	} catch {
		return undefined;
	}
}

function findBuildTypeAndId(buildId: string): { type: BuildType; manifest: BuildManifest } | undefined {
	const types: BuildType[] = ['apk', 'exe', 'web', 'api'];
	for (const type of types) {
		const manifest = readManifest(type, buildId);
		if (manifest) {
			return { type, manifest };
		}
	}
	return undefined;
}

function appendLog(buildId: string, type: BuildType, chunk: string): void {
	const logPath = getBuildLogPath(type, buildId);
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	fs.appendFileSync(logPath, chunk, 'utf8');
	const active = activeById.get(buildId);
	if (active) {
		active.logOffset = fs.statSync(logPath).size;
	}
	const listeners = logListeners.get(buildId);
	if (listeners) {
		for (const listener of listeners) {
			listener(chunk);
		}
	}
}

function resolveWorkspace(input: StartBuildInput): { workspacePath: string; projectSlug?: string } {
	ensureBuildStorageLayout();
	if (input.projectSlug?.trim()) {
		const slug = input.projectSlug.trim();
		const workspacePath = path.join(config.projectsRoot, slug);
		if (!fs.existsSync(workspacePath)) {
			throw new Error(`Projeto nao encontrado: ${slug}`);
		}
		return { workspacePath, projectSlug: slug };
	}
	if (input.projectPath?.trim()) {
		const workspacePath = path.resolve(input.projectPath.trim());
		if (!isWorkspaceRootAllowed(workspacePath)) {
			throw new Error(`Workspace nao permitido: ${workspacePath}`);
		}
		const relative = path.relative(config.projectsRoot, workspacePath);
		const projectSlug = relative && !relative.startsWith('..') && !path.isAbsolute(relative)
			? relative.split(path.sep)[0]
			: undefined;
		return { workspacePath, projectSlug };
	}
	throw new Error('Informe projectSlug ou projectPath');
}

export function startBuild(input: StartBuildInput): BuildStatusResponse {
	const { workspacePath, projectSlug } = resolveWorkspace(input);
	const normalizedWorkspace = path.resolve(workspacePath);

	if (activeByWorkspace.has(normalizedWorkspace)) {
		const existingId = activeByWorkspace.get(normalizedWorkspace)!;
		const existing = activeById.get(existingId);
		if (existing && (existing.internalStatus === 'QUEUED' || existing.internalStatus === 'BUILDING')) {
			throw new Error(`Ja existe build em curso para este projeto (${existingId})`);
		}
	}

	const buildId = `build-${input.type}-${Date.now()}`;
	const jobDir = getBuildJobDir(input.type, buildId);
	fs.mkdirSync(jobDir, { recursive: true });
	fs.writeFileSync(getBuildLogPath(input.type, buildId), '', 'utf8');

	const manifest: BuildManifest = {
		buildId,
		type: input.type,
		status: 'waiting',
		internalStatus: 'QUEUED',
		workspacePath: normalizedWorkspace,
		projectSlug,
		note: input.note,
		startedAt: Date.now(),
		artifactReady: false
	};
	writeManifest(manifest);

	const active: ActiveBuild = {
		buildId,
		type: input.type,
		workspacePath: normalizedWorkspace,
		projectSlug,
		internalStatus: 'QUEUED',
		startedAt: Date.now(),
		logOffset: 0
	};
	activeById.set(buildId, active);
	activeByWorkspace.set(normalizedWorkspace, buildId);

	void runBuild(active, input.note);

	return toStatusResponse(manifest);
}

function toStatusResponse(manifest: BuildManifest): BuildStatusResponse {
	return {
		ok: true,
		buildId: manifest.buildId,
		type: manifest.type,
		status: manifest.status,
		startedAt: manifest.startedAt,
		finishedAt: manifest.finishedAt,
		artifactReady: manifest.artifactReady,
		artifactName: manifest.artifactName,
		workspacePath: manifest.workspacePath,
		projectSlug: manifest.projectSlug,
		previewUrl: manifest.previewUrl
	};
}

export function getBuildStatus(buildId: string): BuildStatusResponse | undefined {
	const found = findBuildTypeAndId(buildId);
	if (!found) {
		return undefined;
	}
	return toStatusResponse(found.manifest);
}

export function readBuildLogs(buildId: string, offset = 0): { lines: string; offset: number; done: boolean } | undefined {
	const found = findBuildTypeAndId(buildId);
	if (!found) {
		return undefined;
	}
	const logPath = getBuildLogPath(found.type, buildId);
	if (!fs.existsSync(logPath)) {
		return { lines: '', offset: 0, done: isTerminalStatus(found.manifest.internalStatus) };
	}
	const content = fs.readFileSync(logPath, 'utf8');
	const slice = content.slice(offset);
	const newOffset = offset + slice.length;
	return {
		lines: slice,
		offset: newOffset,
		done: isTerminalStatus(found.manifest.internalStatus)
	};
}

function isTerminalStatus(status: BuildInternalStatus): boolean {
	return status === 'READY' || status === 'FAILED' || status === 'SKIPPED';
}

export function subscribeBuildLogs(buildId: string, listener: (chunk: string) => void): () => void {
	let set = logListeners.get(buildId);
	if (!set) {
		set = new Set();
		logListeners.set(buildId, set);
	}
	set.add(listener);
	return () => {
		set?.delete(listener);
		if (set && set.size === 0) {
			logListeners.delete(buildId);
		}
	};
}

export function getArtifactFilePath(buildId: string): { filePath: string; artifactName: string } | undefined {
	const found = findBuildTypeAndId(buildId);
	if (!found?.manifest.artifactReady || !found.manifest.artifactName) {
		return undefined;
	}
	const filePath = getBuildArtifactPath(found.type, buildId, found.manifest.artifactName);
	if (!fs.existsSync(filePath)) {
		return undefined;
	}
	return { filePath, artifactName: found.manifest.artifactName };
}

/** Legacy /api/agent/build */
export function startBuildJob(target: BuildTarget, workspaceRoot?: string): BuildJobSnapshot {
	const root = path.resolve(workspaceRoot ?? config.editorProjectRoot);
	if (!isWorkspaceRootAllowed(root)) {
		throw new Error(`Workspace nao permitido: ${root}`);
	}
	const response = startBuild({ type: target, projectPath: root });
	const found = findBuildTypeAndId(response.buildId);
	if (!found) {
		throw new Error('Build nao encontrado apos start');
	}
	return legacySnapshotFromManifest(found.manifest);
}

export function getBuildJob(jobId: string): BuildJobSnapshot | undefined {
	const found = findBuildTypeAndId(jobId);
	if (!found) {
		return undefined;
	}
	return legacySnapshotFromManifest(found.manifest);
}

function legacySnapshotFromManifest(manifest: BuildManifest): BuildJobSnapshot {
	const logPath = getBuildLogPath(manifest.type, manifest.buildId);
	let output = '';
	if (fs.existsSync(logPath)) {
		output = fs.readFileSync(logPath, 'utf8').slice(-12_000);
	}
	const internal = manifest.internalStatus;
	const legacyStatus: BuildInternalStatus =
		internal === 'QUEUED' ? 'QUEUED'
			: internal === 'BUILDING' ? 'BUILDING'
				: internal === 'READY' ? 'READY'
					: internal === 'SKIPPED' ? 'SKIPPED'
						: 'FAILED';
	return {
		jobId: manifest.buildId,
		buildId: manifest.buildId,
		target: manifest.type,
		status: legacyStatus,
		output,
		artifactHint: manifest.artifactName
			? getBuildArtifactPath(manifest.type, manifest.buildId, manifest.artifactName)
			: undefined,
		startedAt: manifest.startedAt,
		finishedAt: manifest.finishedAt
	};
}

async function runBuild(active: ActiveBuild, note?: string): Promise<void> {
	active.internalStatus = 'BUILDING';
	updateManifest(active, { internalStatus: 'BUILDING', status: 'compiling' });
	appendLog(active.buildId, active.type, `[build] Iniciando ${active.type} em ${active.workspacePath}\n`);
	if (note?.trim()) {
		appendLog(active.buildId, active.type, `[nota] ${note.trim()}\n`);
	}

	const isEditorPlatform = path.resolve(active.workspacePath) === path.resolve(config.editorProjectRoot);

	try {
		if (isEditorPlatform) {
			await runEditorPlatformBuild(active);
		} else {
			await runProjectBuild(active);
		}
		await finalizeSuccess(active);
	} catch (error) {
		await finalizeError(active, error);
	} finally {
		activeByWorkspace.delete(path.resolve(active.workspacePath));
	}
}

async function finalizeSuccess(active: ActiveBuild): Promise<void> {
	try {
		const jobDir = getBuildJobDir(active.type, active.buildId);
		const artifactName = await collectBuildArtifact(active.type, active.workspacePath, jobDir);
		active.artifactName = artifactName;
		active.internalStatus = 'READY';
		active.finishedAt = Date.now();

		let previewUrl: string | undefined;
		const isEditorPlatform = path.resolve(active.workspacePath) === path.resolve(config.editorProjectRoot);
		if (active.type === 'web' && !isEditorPlatform && active.projectSlug) {
			try {
				previewUrl = await syncPreview(active.projectSlug, active.workspacePath);
				appendLog(active.buildId, active.type, `\n[sites] Preview: ${previewUrl}\n`);
			} catch (previewError) {
				const previewMessage = previewError instanceof Error ? previewError.message : String(previewError);
				appendLog(active.buildId, active.type, `\n[sites] Aviso preview: ${previewMessage}\n`);
			}
		}

		updateManifest(active, {
			internalStatus: 'READY',
			status: 'success',
			artifactName,
			artifactReady: true,
			finishedAt: active.finishedAt,
			...(previewUrl ? { previewUrl } : {})
		});
		appendLog(active.buildId, active.type, `\n[build] Sucesso. Artefato: ${artifactName}\n`);
	} catch (error) {
		await finalizeError(active, error);
	}
}

async function finalizeError(active: ActiveBuild, error: unknown): Promise<void> {
	const message = error instanceof Error ? error.message : String(error);
	active.internalStatus = 'FAILED';
	active.finishedAt = Date.now();
	active.errorMessage = message;
	updateManifest(active, {
		internalStatus: 'FAILED',
		status: 'error',
		errorMessage: message,
		artifactReady: false,
		finishedAt: active.finishedAt
	});
	appendLog(active.buildId, active.type, `\n[erro] ${message}\n`);
}

function updateManifest(active: ActiveBuild, patch: Partial<BuildManifest>): void {
	const current = readManifest(active.type, active.buildId);
	if (!current) {
		return;
	}
	writeManifest({ ...current, ...patch });
}

async function runProjectBuild(active: ActiveBuild): Promise<void> {
	const pkgPath = path.join(active.workspacePath, 'package.json');
	if (!fs.existsSync(pkgPath)) {
		throw new Error('package.json nao encontrado no projeto');
	}

	switch (active.type) {
		case 'web':
		case 'api':
			await runNpm(active, ['run', 'build']);
			break;
		case 'exe':
			await runElectronExeBuild(active);
			break;
		case 'apk':
			await runCapacitorApkBuild(active);
			break;
	}
}

async function runEditorPlatformBuild(active: ActiveBuild): Promise<void> {
	const timeoutMs = TARGET_TIMEOUT_MS[active.type];
	switch (active.type) {
		case 'web': {
			const scriptPath = path.join(config.editorProjectRoot, 'deploy', 'windows', 'code-web', 'compile-princy-code-web-production.ps1');
			if (process.platform === 'win32' && fs.existsSync(scriptPath)) {
				await runProcess(active, 'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-ProjectRoot', config.editorProjectRoot], config.editorProjectRoot, timeoutMs);
			} else {
				await runNpm(active, ['run', 'compile-web'], config.editorProjectRoot);
			}
			break;
		}
		case 'api': {
			const scriptPath = path.join(config.editorProjectRoot, 'deploy', 'windows', 'agent-backend', 'build-princy-agent-backend.ps1');
			if (process.platform === 'win32' && fs.existsSync(scriptPath)) {
				await runProcess(active, 'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-ProjectRoot', config.editorProjectRoot], config.editorProjectRoot, timeoutMs);
			} else {
				await runNpm(active, ['run', 'build'], path.join(config.editorProjectRoot, 'apps', 'ai-dashboard'));
			}
			break;
		}
		case 'exe': {
			const isEditorRoot = path.resolve(active.workspacePath) === path.resolve(config.editorProjectRoot);
			if (isEditorRoot) {
				const scriptPath = path.join(config.editorProjectRoot, 'deploy', 'windows', 'code-web', 'compile-princy-windows.ps1');
				if (process.platform === 'win32' && fs.existsSync(scriptPath)) {
					await runProcess(active, 'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-ProjectRoot', config.editorProjectRoot], config.editorProjectRoot, timeoutMs);
				} else {
					await runNpm(active, ['run', 'compile'], config.editorProjectRoot);
				}
			} else {
				await runElectronExeBuild(active);
			}
			break;
		}
		case 'apk':
			throw new Error('Build APK de plataforma Editor nao suportado; use um projeto template APK.');
	}
}

async function runCapacitorApkBuild(active: ActiveBuild): Promise<void> {
	await runCapacitorApkPipeline(active.workspacePath, {
		log: (message: string) => appendLog(active.buildId, active.type, message),
		runNpm: (args: string[]) => runNpm(active, args),
		runNpx: (args: string[]) => runNpx(active, args, TARGET_TIMEOUT_MS.apk),
		runGradle: (androidDir: string, gradleArgs: string[]) => runGradleAssemble(active, androidDir, gradleArgs)
	});
}

async function runElectronExeBuild(active: ActiveBuild): Promise<void> {
	await runElectronExePipeline(active.workspacePath, {
		log: (message: string) => appendLog(active.buildId, active.type, message),
		runNpm: (args: string[]) => runNpm(active, args),
		runNpx: (args: string[]) => runNpx(active, args, TARGET_TIMEOUT_MS.exe)
	});
}

async function runNpx(active: ActiveBuild, args: string[], timeoutMs?: number): Promise<void> {
	const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
	await runProcess(active, npx, args, active.workspacePath, timeoutMs ?? TARGET_TIMEOUT_MS[active.type]);
}

async function runGradleAssemble(active: ActiveBuild, androidDir: string, args: string[]): Promise<void> {
	const gradlew = process.platform === 'win32'
		? path.join(androidDir, 'gradlew.bat')
		: path.join(androidDir, 'gradlew');
	if (!fs.existsSync(gradlew)) {
		throw new Error('gradlew nao encontrado em android/');
	}
	await runProcess(active, gradlew, args, androidDir, TARGET_TIMEOUT_MS.apk);
}

async function runNpm(active: ActiveBuild, args: string[], cwd?: string): Promise<void> {
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	await runProcess(active, npm, args, cwd ?? active.workspacePath, TARGET_TIMEOUT_MS[active.type]);
}

async function runProcess(
	active: ActiveBuild,
	command: string,
	args: string[],
	cwd: string,
	timeoutMs: number
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
			shell: process.platform === 'win32'
		});
		const timer = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error(`Timeout de build (${Math.round(timeoutMs / 60_000)} min)`));
		}, timeoutMs);
		child.stdout?.on('data', chunk => appendLog(active.buildId, active.type, String(chunk)));
		child.stderr?.on('data', chunk => appendLog(active.buildId, active.type, String(chunk)));
		child.on('close', code => {
			clearTimeout(timer);
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Processo encerrou com codigo ${code ?? 'desconhecido'}`));
			}
		});
		child.on('error', error => {
			clearTimeout(timer);
			reject(error);
		});
	});
}

export function buildStatusToCompile(status: BuildInternalStatus): import('../orchestrator/types.js').VpsCompileStatus {
	switch (status) {
		case 'READY':
			return 'READY';
		case 'FAILED':
			return 'FAILED';
		case 'BUILDING':
		case 'QUEUED':
			return 'COMPILING';
		default:
			return 'PENDING';
	}
}
