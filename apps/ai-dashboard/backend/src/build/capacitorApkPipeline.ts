import fs from 'node:fs';
import path from 'node:path';

/** APK de debug padrao apos `gradlew assembleDebug` no projeto Capacitor. */
export const CAPACITOR_DEBUG_APK_REL = path.join(
	'android',
	'app',
	'build',
	'outputs',
	'apk',
	'debug',
	'app-debug.apk'
);

export function resolveCapacitorDebugApk(workspacePath: string): string | undefined {
	const standard = path.join(workspacePath, CAPACITOR_DEBUG_APK_REL);
	if (fs.existsSync(standard)) {
		return standard;
	}
	return undefined;
}

export function hasAndroidGradleProject(workspacePath: string): boolean {
	const androidDir = path.join(workspacePath, 'android');
	const gradlew = process.platform === 'win32'
		? path.join(androidDir, 'gradlew.bat')
		: path.join(androidDir, 'gradlew');
	return fs.existsSync(gradlew);
}

export type CapacitorApkPipelineStep = {
	readonly runNpm: (args: string[]) => Promise<void>;
	readonly runNpx: (args: string[]) => Promise<void>;
	readonly runGradle: (androidDir: string, gradleArgs: string[]) => Promise<void>;
	readonly log: (message: string) => void;
};

/**
 * React/Vite → Capacitor → Gradle → app-debug.apk
 * (equivalente aos comandos documentados na Fase 6)
 */
export async function runCapacitorApkPipeline(
	workspacePath: string,
	steps: CapacitorApkPipelineStep
): Promise<string> {
	const root = path.resolve(workspacePath);
	steps.log('[apk] Pipeline Capacitor: Vite build → cap sync → Gradle assembleDebug\n');

	if (!fs.existsSync(path.join(root, 'package.json'))) {
		throw new Error('package.json nao encontrado');
	}

	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	const hasCapacitor =
		pkg.dependencies?.['@capacitor/core'] ||
		pkg.devDependencies?.['@capacitor/cli'] ||
		fs.existsSync(path.join(root, 'capacitor.config.ts')) ||
		fs.existsSync(path.join(root, 'capacitor.config.json'));
	if (!hasCapacitor) {
		throw new Error('Projeto sem Capacitor (@capacitor/core ou capacitor.config)');
	}

	if (!fs.existsSync(path.join(root, 'node_modules'))) {
		steps.log('[apk] npm install (node_modules ausente)...\n');
		await steps.runNpm(['install']);
	}

	steps.log('[apk] npm run build (Vite)...\n');
	await steps.runNpm(['run', 'build']);

	const androidDir = path.join(root, 'android');
	if (!hasAndroidGradleProject(root)) {
		steps.log('[apk] npx cap add android...\n');
		await steps.runNpx(['cap', 'add', 'android']);
	}

	if (!hasAndroidGradleProject(root)) {
		throw new Error(
			'Pasta android/ sem gradlew apos cap add android. Instale Android SDK / JDK 17 no VPS.'
		);
	}

	steps.log('[apk] npx cap sync android...\n');
	await steps.runNpx(['cap', 'sync', 'android']);

	steps.log('[apk] gradlew assembleDebug...\n');
	await steps.runGradle(androidDir, ['assembleDebug']);

	const apkPath = resolveCapacitorDebugApk(root);
	if (!apkPath) {
		throw new Error(
			`APK nao encontrado em ${CAPACITOR_DEBUG_APK_REL}. Verifique Android SDK e o log do Gradle.`
		);
	}

	steps.log(`[apk] APK gerado: ${apkPath}\n`);
	return apkPath;
}
