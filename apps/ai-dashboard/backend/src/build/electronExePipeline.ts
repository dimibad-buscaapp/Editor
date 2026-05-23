import fs from 'node:fs';
import path from 'node:path';

export const ELECTRON_DIST_DIR = 'dist';
export const ELECTRON_RELEASE_DIR = 'release';

export type ElectronExePipelineStep = {
	readonly runNpm: (args: string[]) => Promise<void>;
	readonly runNpx: (args: string[]) => Promise<void>;
	readonly log: (message: string) => void;
};

function findExeInDir(dir: string): string | undefined {
	if (!fs.existsSync(dir)) {
		return undefined;
	}
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isFile() && /\.exe$/i.test(entry.name)) {
			return path.join(dir, entry.name);
		}
	}
	return undefined;
}

/** Primeiro .exe em dist/, depois release/ (electron-builder). */
export function resolveElectronExe(workspacePath: string): string | undefined {
	const root = path.resolve(workspacePath);
	return findExeInDir(path.join(root, ELECTRON_DIST_DIR))
		?? findExeInDir(path.join(root, ELECTRON_RELEASE_DIR))
		?? undefined;
}

function hasElectronDeps(pkg: {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}): boolean {
	return Boolean(
		pkg.dependencies?.electron ||
		pkg.devDependencies?.electron ||
		pkg.devDependencies?.['electron-builder']
	);
}

/**
 * React/Vite → Electron → electron-builder → dist/*.exe
 */
export async function runElectronExePipeline(
	workspacePath: string,
	steps: ElectronExePipelineStep
): Promise<string> {
	if (process.platform !== 'win32') {
		throw new Error('Build EXE requer Windows (electron-builder target win)');
	}

	const root = path.resolve(workspacePath);
	steps.log('[exe] Pipeline Electron: Vite build → electron-builder → dist/*.exe\n');

	if (!fs.existsSync(path.join(root, 'package.json'))) {
		throw new Error('package.json nao encontrado');
	}

	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
		scripts?: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};

	if (!hasElectronDeps(pkg)) {
		throw new Error('Projeto sem Electron (electron ou electron-builder em package.json)');
	}

	if (!fs.existsSync(path.join(root, 'node_modules'))) {
		steps.log('[exe] npm install (node_modules ausente)...\n');
		await steps.runNpm(['install']);
	}

	if (pkg.scripts?.build) {
		steps.log('[exe] npm run build (Vite + electron main)...\n');
		await steps.runNpm(['run', 'build']);
	} else {
		steps.log('[exe] script "build" ausente — a saltar para dist\n');
	}

	if (pkg.scripts?.dist) {
		steps.log('[exe] npm run dist (electron-builder)...\n');
		await steps.runNpm(['run', 'dist']);
	} else if (pkg.scripts?.['build:exe']) {
		steps.log('[exe] npm run build:exe...\n');
		await steps.runNpm(['run', 'build:exe']);
	} else {
		steps.log('[exe] npx electron-builder --win portable...\n');
		await steps.runNpx(['electron-builder', '--win', 'portable']);
	}

	const exePath = resolveElectronExe(root);
	if (!exePath) {
		throw new Error(
			`Nenhum .exe em ${ELECTRON_DIST_DIR}/ ou ${ELECTRON_RELEASE_DIR}/. Verifique o log do electron-builder.`
		);
	}

	steps.log(`[exe] EXE gerado: ${exePath}\n`);
	return exePath;
}
