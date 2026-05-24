import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { assertSafeProjectName } from '../projectCreatorService.js';
import { appendAutomationLog, readAutomationLogs, writeAutomationManifest } from './automationManifest.js';
import { startAutomationProcess, stopAutomationProcess } from './automationProcessManager.js';
import { runSmokeTest, runNpmScript } from './nodeRunner.js';
import { runPowerShellScript } from './powershellRunner.js';
import { buildLocalScheduleInstructions, scheduleAutomation, unscheduleAutomation } from './schedulerService.js';
import { scaffoldAutomation } from './scriptScaffolder.js';
import {
	getAutomationProjectInfo,
	upsertManifestFromInfo,
	type AutomationType
} from './automationStudioService.js';
import { runAutomationPipeline } from '../automationOrchestrator/pipelineRunner.js';
import type { PipelineRecipe } from '../automationOrchestrator/pipelineTemplates.js';
import { startWatchdog, stopWatchdog, getWatchdogStatus } from './watchdogService.js';

const projectBodySchema = z.object({
	projectPath: z.string().optional()
});

const scaffoldBodySchema = z.object({
	name: z.string().min(1),
	schedule: z.string().optional(),
	description: z.string().optional(),
	projectPath: z.string().optional()
});

const scheduleBodySchema = z.object({
	schedule: z.string().min(1),
	projectPath: z.string().optional()
});

const pipelineBodySchema = z.object({
	recipe: z.enum(['full-stack-web', 'api-deploy', 'daily-script']),
	projectPath: z.string().optional(),
	autoPublish: z.boolean().optional()
});

const publicAutomationPaths = new Set<string>(['/api/automations']);

function authorizeAutomationRequest(request: FastifyRequest, reply: FastifyReply): void {
	if (!config.agentApiToken) {
		return;
	}
	const authorization = request.headers.authorization;
	if (authorization !== `Bearer ${config.agentApiToken}`) {
		reply.code(401);
		throw new Error('Invalid agent API token');
	}
}

function isPublicAutomationPath(pathname: string): boolean {
	if (publicAutomationPaths.has(pathname)) {
		return true;
	}
	return /^\/api\/automations\/[^/]+$/.test(pathname);
}

function parseSlug(params: { slug: string }): string {
	return assertSafeProjectName(params.slug);
}

const SUPPORTED_TYPES: readonly AutomationType[] = [
	'powershell', 'node-cron', 'playwright', 'webhook', 'api-client', 'chatbot'
];

export async function registerAutomationStudioRoutes(app: FastifyInstance): Promise<void> {
	app.addHook('preHandler', async (request, reply) => {
		const pathname = request.url.split('?')[0] ?? request.url;
		if (!pathname.startsWith('/api/automations')) {
			return;
		}
		if (config.publicChatEnabled && isPublicAutomationPath(pathname)) {
			return;
		}
		authorizeAutomationRequest(request, reply);
	});

	app.get('/api/automations', async () => ({
		ok: true,
		features: ['scaffold', 'run', 'test', 'schedule', 'pipeline', 'trigger', 'watchdog'],
		types: SUPPORTED_TYPES,
		watchdog: getWatchdogStatus()
	}));

	app.get('/api/automations/:slug', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const query = projectBodySchema.parse(request.query ?? {});
		const info = getAutomationProjectInfo(slug, query.projectPath);
		writeAutomationManifest(upsertManifestFromInfo(slug, info));
		return { ok: true, project: info };
	});

	app.post('/api/automations/:slug/scaffold', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = scaffoldBodySchema.parse(request.body ?? {});
		try {
			const info = getAutomationProjectInfo(slug, body.projectPath);
			const result = scaffoldAutomation(info.projectPath, {
				name: body.name,
				schedule: body.schedule,
				description: body.description
			});
			writeAutomationManifest({
				...upsertManifestFromInfo(slug, info),
				schedule: body.schedule ?? upsertManifestFromInfo(slug, info).schedule
			});
			return { ok: true, slug, ...result };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/automations/:slug/run', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = projectBodySchema.parse(request.body ?? {});
		try {
			const info = getAutomationProjectInfo(slug, body.projectPath);
			const result = info.type === 'powershell'
				? await runPowerShellScript(info.projectPath)
				: await runNpmScript(info.projectPath, 'start');
			const logText = `[run] exit=${result.exitCode}\n${result.stdout}\n${result.stderr}\n`;
			appendAutomationLog(slug, logText);
			writeAutomationManifest({
				...upsertManifestFromInfo(slug, info),
				lastRunAt: Date.now(),
				lastRunStatus: result.exitCode === 0 ? 'success' : 'error',
				lastRunOutput: logText.slice(-4000)
			});
			return { ok: result.exitCode === 0, slug, exitCode: result.exitCode, durationMs: result.durationMs, output: logText.slice(-4000) };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/automations/:slug/test', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = projectBodySchema.parse(request.body ?? {});
		try {
			const info = getAutomationProjectInfo(slug, body.projectPath);
			if (info.type !== 'powershell') {
				await startAutomationProcess(slug, info.projectPath);
			}
			const result = info.type === 'powershell'
				? await runPowerShellScript(info.projectPath)
				: await runSmokeTest(info.projectPath);
			const logText = `[test] exit=${result.exitCode}\n${result.stdout}\n${result.stderr}\n`;
			appendAutomationLog(slug, logText);
			writeAutomationManifest({
				...upsertManifestFromInfo(slug, info),
				lastRunAt: Date.now(),
				lastRunStatus: result.exitCode === 0 ? 'success' : 'error',
				lastRunOutput: logText.slice(-4000)
			});
			return { ok: result.exitCode === 0, slug, exitCode: result.exitCode, output: logText.slice(-4000) };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.post('/api/automations/:slug/schedule', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = scheduleBodySchema.parse(request.body ?? {});
		try {
			const info = getAutomationProjectInfo(slug, body.projectPath);
			const scheduled = await scheduleAutomation(slug, info.projectPath, body.schedule, '');
			const manifest = upsertManifestFromInfo(slug, info);
			writeAutomationManifest({
				...manifest,
				schedule: body.schedule,
				taskName: scheduled.taskName
			});
			return {
				ok: true,
				slug,
				...scheduled,
				localInstructions: scheduled.localInstructions ?? buildLocalScheduleInstructions(slug, body.schedule, info.projectPath)
			};
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	});

	app.delete('/api/automations/:slug/schedule', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const query = projectBodySchema.parse(request.query ?? {});
		const info = getAutomationProjectInfo(slug, query.projectPath);
		const manifest = upsertManifestFromInfo(slug, info);
		const removed = manifest.taskName ? await unscheduleAutomation(manifest.taskName) : false;
		writeAutomationManifest({ ...manifest, schedule: undefined, taskName: undefined });
		return { ok: true, slug, removed };
	});

	app.get('/api/automations/:slug/logs', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const query = z.object({ lines: z.coerce.number().int().optional() }).parse(request.query ?? {});
		return { ok: true, slug, logs: readAutomationLogs(slug, query.lines ?? 200) };
	});

	app.post('/api/automations/:slug/trigger', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = z.object({
			action: z.enum(['run', 'test', 'pipeline']).optional(),
			recipe: z.enum(['full-stack-web', 'api-deploy', 'daily-script']).optional(),
			secret: z.string().optional(),
			projectPath: z.string().optional()
		}).parse(request.body ?? {});
		const info = getAutomationProjectInfo(slug, body.projectPath);
		const manifest = upsertManifestFromInfo(slug, info);
		if (manifest.triggerSecret && body.secret !== manifest.triggerSecret) {
			return { ok: false, message: 'Secret invalido' };
		}
		const action = body.action ?? 'run';
		if (action === 'pipeline') {
			const result = await runAutomationPipeline(slug, body.recipe ?? 'daily-script', {
				projectPath: info.projectPath,
				autoPublish: true
			});
			return result;
		}
		if (action === 'test') {
			const result = info.type === 'powershell'
				? await runPowerShellScript(info.projectPath)
				: await runSmokeTest(info.projectPath);
			return { ok: result.exitCode === 0, slug, action, exitCode: result.exitCode };
		}
		const result = info.type === 'powershell'
			? await runPowerShellScript(info.projectPath)
			: await runNpmScript(info.projectPath, 'start');
		return { ok: result.exitCode === 0, slug, action: 'run', exitCode: result.exitCode };
	});

	app.post('/api/automations/:slug/pipeline', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = pipelineBodySchema.parse(request.body ?? {});
		return runAutomationPipeline(slug, body.recipe, {
			projectPath: body.projectPath,
			autoPublish: body.autoPublish
		});
	});

	app.post('/api/automations/:slug/dev/start', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		const body = projectBodySchema.parse(request.body ?? {});
		const info = getAutomationProjectInfo(slug, body.projectPath);
		const started = await startAutomationProcess(slug, info.projectPath);
		return { ok: true, slug, ...started };
	});

	app.post('/api/automations/:slug/dev/stop', async request => {
		const slug = parseSlug(z.object({ slug: z.string() }).parse(request.params));
		return { ok: true, slug, stopped: stopAutomationProcess(slug) };
	});

	app.post('/api/automations/watchdog/start', async () => {
		startWatchdog();
		return { ok: true, status: getWatchdogStatus() };
	});

	app.post('/api/automations/watchdog/stop', async () => {
		stopWatchdog();
		return { ok: true, status: getWatchdogStatus() };
	});
}
