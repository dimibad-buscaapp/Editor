import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getTemplate } from './projectTemplates/index.js';
import type { ProjectTemplateId } from './projectTemplates/types.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function resolveSkeletonsRoot(): string {
	const fromEditorRepo = path.join(
		config.editorProjectRoot,
		'apps',
		'ai-dashboard',
		'backend',
		'src',
		'projectTemplates',
		'skeletons'
	);
	if (fs.existsSync(fromEditorRepo)) {
		return fromEditorRepo;
	}
	const fromDist = path.join(moduleDir, 'projectTemplates', 'skeletons');
	if (fs.existsSync(fromDist)) {
		return fromDist;
	}
	return fromEditorRepo;
}

const TEXT_EXTENSIONS = new Set([
	'.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.env', '.example',
	'.yml', '.yaml', '.xml', '.gradle', '.properties', '.gitignore', '.prisma', '.mjs', '.cjs'
]);

export type CreateProjectInput = {
	readonly templateId: ProjectTemplateId;
	readonly projectName: string;
	readonly runInstall?: boolean;
};

export type CreateProjectResult = {
	readonly ok: true;
	readonly projectPath: string;
	readonly templateId: ProjectTemplateId;
	readonly slug: string;
	readonly installJobId?: string;
};

export type InstallJobStatus = 'QUEUED' | 'INSTALLING' | 'READY' | 'FAILED';

export type InstallJobSnapshot = {
	readonly jobId: string;
	readonly status: InstallJobStatus;
	readonly output: string;
	readonly projectPath: string;
};

type InstallJob = {
	readonly id: string;
	readonly projectPath: string;
	status: InstallJobStatus;
	output: string;
};

const installJobs = new Map<string, InstallJob>();

export function slugifyProjectName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48) || 'projeto';
}

export function assertSafeProjectName(name: string): string {
	const slug = slugifyProjectName(name);
	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) && slug !== 'projeto') {
		throw new Error('Nome invalido. Use letras, numeros e hifens (ex: meu-app).');
	}
	if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
		throw new Error('Nome de projeto invalido.');
	}
	return slug;
}

export function resolveProjectPath(slug: string): string {
	const root = path.resolve(config.projectsRoot);
	const resolved = path.resolve(root, slug);
	if (!resolved.startsWith(root + path.sep) && resolved !== root) {
		throw new Error('Caminho de projeto fora da pasta permitida.');
	}
	return resolved;
}

function resolveSkeletonPath(skeletonDir: string): string {
	const root = resolveSkeletonsRoot();
	const resolved = path.resolve(root, skeletonDir);
	if (!resolved.startsWith(root + path.sep) && resolved !== root) {
		throw new Error('Skeleton invalido.');
	}
	if (!fs.existsSync(resolved)) {
		throw new Error(`Skeleton nao encontrado: ${skeletonDir}`);
	}
	return resolved;
}

function shouldProcessFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	const base = path.basename(filePath);
	if (base === '.env.example' || base.endsWith('.example')) {
		return true;
	}
	return TEXT_EXTENSIONS.has(ext) || !ext;
}

function applyPlaceholders(content: string, vars: Record<string, string>): string {
	let result = content;
	for (const [key, value] of Object.entries(vars)) {
		result = result.split(`{{${key}}}`).join(value);
	}
	return result;
}

async function copySkeletonWithPlaceholders(
	sourceDir: string,
	targetDir: string,
	vars: Record<string, string>
): Promise<void> {
	await fs.promises.mkdir(targetDir, { recursive: true });
	const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
	for (const entry of entries) {
		const src = path.join(sourceDir, entry.name);
		const dest = path.join(targetDir, entry.name);
		if (entry.isDirectory()) {
			await copySkeletonWithPlaceholders(src, dest, vars);
			continue;
		}
		if (!entry.isFile()) {
			continue;
		}
		if (shouldProcessFile(src)) {
			const raw = await fs.promises.readFile(src, 'utf8');
			await fs.promises.writeFile(dest, applyPlaceholders(raw, vars), 'utf8');
		} else {
			await fs.promises.copyFile(src, dest);
		}
	}
}

function findPackageJsonDirs(root: string): string[] {
	const dirs: string[] = [];
	const queue = [root];
	while (queue.length > 0) {
		const current = queue.pop()!;
		const pkg = path.join(current, 'package.json');
		if (fs.existsSync(pkg)) {
			dirs.push(current);
		}
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) {
				continue;
			}
			queue.push(path.join(current, entry.name));
		}
	}
	return dirs.length > 0 ? dirs : [root];
}

function startInstallJob(projectPath: string): string {
	const jobId = `create-${Date.now()}`;
	const job: InstallJob = {
		id: jobId,
		projectPath,
		status: 'QUEUED',
		output: ''
	};
	installJobs.set(jobId, job);
	void runInstallJob(job);
	return jobId;
}

async function runInstallJob(job: InstallJob): Promise<void> {
	job.status = 'INSTALLING';
	const packageDirs = findPackageJsonDirs(job.projectPath);
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

	for (const dir of packageDirs) {
		job.output += `\n> npm install em ${dir}\n`;
		try {
			await new Promise<void>((resolve, reject) => {
				const child = spawn(npm, ['install'], {
					cwd: dir,
					env: process.env,
					shell: process.platform === 'win32'
				});
				child.stdout?.on('data', chunk => {
					job.output = `${job.output}${String(chunk)}`.slice(-12_000);
				});
				child.stderr?.on('data', chunk => {
					job.output = `${job.output}${String(chunk)}`.slice(-12_000);
				});
				child.on('close', code => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`npm install falhou em ${dir} (code ${code})`));
					}
				});
				child.on('error', reject);
			});
		} catch (error) {
			job.status = 'FAILED';
			job.output += `\n${error instanceof Error ? error.message : String(error)}`;
			return;
		}
	}
	job.status = 'READY';
}

export function getInstallJob(jobId: string): InstallJobSnapshot | undefined {
	const job = installJobs.get(jobId);
	if (!job) {
		return undefined;
	}
	return {
		jobId: job.id,
		status: job.status,
		output: job.output,
		projectPath: job.projectPath
	};
}

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
	const template = getTemplate(input.templateId);
	if (!template) {
		throw new Error(`Template desconhecido: ${input.templateId}`);
	}

	const slug = assertSafeProjectName(input.projectName);
	const projectPath = resolveProjectPath(slug);

	if (fs.existsSync(projectPath)) {
		throw new Error(`Projeto ja existe: ${projectPath}`);
	}

	await fs.promises.mkdir(config.projectsRoot, { recursive: true });

	const skeletonPath = resolveSkeletonPath(template.skeletonDir);
	const displayName = input.projectName.trim() || slug;
	const vars = {
		PROJECT_NAME: displayName,
		PROJECT_SLUG: slug,
		YEAR: String(new Date().getFullYear())
	};

	await copySkeletonWithPlaceholders(skeletonPath, projectPath, vars);

	let installJobId: string | undefined;
	if (input.runInstall) {
		installJobId = startInstallJob(projectPath);
	}

	return {
		ok: true,
		projectPath,
		templateId: template.id,
		slug,
		installJobId
	};
}
