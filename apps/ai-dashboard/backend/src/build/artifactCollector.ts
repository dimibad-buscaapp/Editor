import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { CAPACITOR_DEBUG_APK_REL, resolveCapacitorDebugApk } from './capacitorApkPipeline.js';
import { ELECTRON_DIST_DIR, resolveElectronExe } from './electronExePipeline.js';
import type { BuildType } from './types.js';

async function findFirstFile(dir: string, pattern: RegExp): Promise<string | undefined> {
	if (!fs.existsSync(dir)) {
		return undefined;
	}
	const stack = [dir];
	while (stack.length > 0) {
		const current = stack.pop()!;
		const entries = fs.readdirSync(current, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === 'node_modules' || entry.name === '.git') {
					continue;
				}
				stack.push(full);
			} else if (pattern.test(entry.name)) {
				return full;
			}
		}
	}
	return undefined;
}

async function zipDirectory(sourceDir: string, destZip: string): Promise<void> {
	if (process.platform === 'win32') {
		await new Promise<void>((resolve, reject) => {
			const ps = spawn('powershell.exe', [
				'-NoProfile',
				'-Command',
				`Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${destZip.replace(/'/g, "''")}' -Force`
			], { shell: false });
			ps.on('close', code => (code === 0 ? resolve() : reject(new Error(`Compress-Archive exit ${code}`))));
			ps.on('error', reject);
		});
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const child = spawn('tar', ['-czf', destZip, '-C', sourceDir, '.'], { shell: false });
		child.on('close', code => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}`))));
		child.on('error', reject);
	});
}

function copyFileSync(src: string, dest: string): void {
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
}

function dirSizeBytes(dir: string): number {
	let total = 0;
	if (!fs.existsSync(dir)) {
		return 0;
	}
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			total += dirSizeBytes(full);
		} else {
			total += fs.statSync(full).size;
		}
	}
	return total;
}

function assertArtifactSize(bytes: number): void {
	const max = config.buildArtifactMaxMb * 1024 * 1024;
	if (bytes > max) {
		throw new Error(`Artefato excede limite de ${config.buildArtifactMaxMb} MB`);
	}
}

export async function collectBuildArtifact(
	type: BuildType,
	workspacePath: string,
	destDir: string
): Promise<string> {
	const distCandidates = [
		path.join(workspacePath, 'dist'),
		path.join(workspacePath, 'build'),
		path.join(workspacePath, 'out')
	];

	switch (type) {
		case 'web':
		case 'api': {
			const source = distCandidates.find(candidate => fs.existsSync(candidate));
			if (!source) {
				throw new Error('Pasta dist/ ou build/ nao encontrada apos npm run build');
			}
			assertArtifactSize(dirSizeBytes(source));
			const zipName = 'artifact.zip';
			const zipPath = path.join(destDir, zipName);
			await zipDirectory(source, zipPath);
			return zipName;
		}
		case 'apk': {
			const standard = resolveCapacitorDebugApk(workspacePath);
			const apk = standard ?? await findFirstFile(workspacePath, /\.apk$/i);
			if (!apk) {
				throw new Error(`Nenhum .apk encontrado (esperado: ${CAPACITOR_DEBUG_APK_REL})`);
			}
			const stat = fs.statSync(apk);
			assertArtifactSize(stat.size);
			const name = path.basename(apk);
			copyFileSync(apk, path.join(destDir, name));
			return name;
		}
		case 'exe': {
			const standard = resolveElectronExe(workspacePath);
			const exe = standard ?? await findFirstFile(workspacePath, /\.exe$/i);
			if (exe) {
				const stat = fs.statSync(exe);
				assertArtifactSize(stat.size);
				const name = path.basename(exe);
				copyFileSync(exe, path.join(destDir, name));
				return name;
			}
			const releaseDir = path.join(workspacePath, ELECTRON_DIST_DIR);
			if (fs.existsSync(releaseDir)) {
				assertArtifactSize(dirSizeBytes(releaseDir));
				const zipName = 'artifact.zip';
				await zipDirectory(releaseDir, path.join(destDir, zipName));
				return zipName;
			}
			throw new Error(`Nenhum .exe em ${ELECTRON_DIST_DIR}/ (execute npm run dist)`);
		}
		default:
			throw new Error(`Tipo de artefato desconhecido: ${type}`);
	}
}
