import { getBuildStatus, startBuild } from '../build/buildCenterService.js';
import type { BuildTarget } from '../projectTemplates/types.js';
import { getApiProjectInfo } from '../apiStudio/apiStudioService.js';
import { runPrismaMigrate } from '../apiStudio/prismaRunner.js';
import { startDevServer } from '../apiStudio/devProcessManager.js';
import { defaultSmokeTests, runEndpointTests } from '../apiStudio/endpointTester.js';
import { syncPreview, publishSite } from '../sites/webSiteService.js';
import { getAutomationProjectInfo } from '../automationStudio/automationStudioService.js';
import { runPowerShellScript } from '../automationStudio/powershellRunner.js';
import { runNpmScript, runSmokeTest } from '../automationStudio/nodeRunner.js';
import { pipelineRecipes, type PipelineRecipe } from './pipelineTemplates.js';

export type PipelineOptions = {
	readonly projectPath?: string;
	readonly autoPublish?: boolean;
};

export type PipelineStepResult = {
	readonly stepId: string;
	readonly ok: boolean;
	readonly message?: string;
	readonly data?: unknown;
};

async function waitForBuild(buildId: string, timeoutMs = 1_800_000): Promise<{ ok: boolean; message?: string }> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const status = getBuildStatus(buildId);
		if (!status) {
			return { ok: false, message: 'Build nao encontrado' };
		}
		if (status.status === 'success') {
			return { ok: true, message: status.previewUrl };
		}
		if (status.status === 'error') {
			return { ok: false, message: 'Build falhou' };
		}
		await new Promise(resolve => setTimeout(resolve, 3000));
	}
	return { ok: false, message: 'Timeout aguardando build' };
}

async function runBuildStep(slug: string, type: BuildTarget): Promise<PipelineStepResult> {
	try {
		const started = startBuild({ type, projectSlug: slug });
		const result = await waitForBuild(started.buildId);
		return { stepId: 'build', ok: result.ok, message: result.message, data: { buildId: started.buildId } };
	} catch (error) {
		return { stepId: 'build', ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

async function runStudioMigrate(slug: string, projectPath: string): Promise<PipelineStepResult> {
	try {
		const info = getApiProjectInfo(slug, projectPath);
		if (!info.hasPrisma) {
			return { stepId: 'migrate', ok: true, message: 'Sem Prisma — ignorado' };
		}
		const output = await runPrismaMigrate(info.projectPath);
		return { stepId: 'migrate', ok: true, message: output.slice(-500) };
	} catch (error) {
		return { stepId: 'migrate', ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

async function runStudioTest(slug: string, projectPath: string): Promise<PipelineStepResult> {
	try {
		const info = getApiProjectInfo(slug, projectPath);
		await startDevServer(slug, info.projectPath);
		const baseUrl = `http://127.0.0.1:${info.port}`;
		const result = await runEndpointTests(baseUrl, defaultSmokeTests());
		return {
			stepId: 'test',
			ok: result.failed === 0,
			message: `passed=${result.passed} failed=${result.failed}`,
			data: result
		};
	} catch (error) {
		return { stepId: 'test', ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

async function runAutomationTest(slug: string, projectPath: string): Promise<PipelineStepResult> {
	try {
		const info = getAutomationProjectInfo(slug, projectPath);
		const result = info.type === 'powershell'
			? await runPowerShellScript(info.projectPath)
			: await runSmokeTest(info.projectPath);
		return { stepId: 'test', ok: result.exitCode === 0, message: result.stdout.slice(-500) };
	} catch (error) {
		return { stepId: 'test', ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

async function runAutomationRun(slug: string, projectPath: string): Promise<PipelineStepResult> {
	try {
		const info = getAutomationProjectInfo(slug, projectPath);
		const result = info.type === 'powershell'
			? await runPowerShellScript(info.projectPath)
			: await runNpmScript(info.projectPath, 'start');
		return { stepId: 'run', ok: result.exitCode === 0, message: result.stdout.slice(-500) };
	} catch (error) {
		return { stepId: 'run', ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

export async function runAutomationPipeline(
	slug: string,
	recipe: PipelineRecipe,
	options: PipelineOptions = {}
): Promise<{ ok: boolean; slug: string; recipe: PipelineRecipe; steps: PipelineStepResult[] }> {
	const def = pipelineRecipes[recipe];
	const projectPath = options.projectPath ?? getAutomationProjectInfo(slug).projectPath;
	const steps: PipelineStepResult[] = [];

	for (const step of def.steps) {
		let result: PipelineStepResult;
		switch (step.action) {
			case 'build:web':
				result = await runBuildStep(slug, 'web');
				break;
			case 'build:api':
				result = await runBuildStep(slug, 'api');
				break;
			case 'sites:preview-sync':
				try {
					const previewUrl = await syncPreview(slug, projectPath);
					result = { stepId: 'preview', ok: true, message: previewUrl };
				} catch (error) {
					result = { stepId: 'preview', ok: false, message: error instanceof Error ? error.message : String(error) };
				}
				break;
			case 'sites:publish':
				if (options.autoPublish === false) {
					result = { stepId: 'publish', ok: true, message: 'Publicacao ignorada (autoPublish=false)' };
				} else {
					try {
						const published = await publishSite(slug, projectPath);
						result = { stepId: 'publish', ok: true, message: published.publishedUrl };
					} catch (error) {
						result = { stepId: 'publish', ok: false, message: error instanceof Error ? error.message : String(error) };
					}
				}
				break;
			case 'studio:migrate':
				result = await runStudioMigrate(slug, projectPath);
				break;
			case 'studio:test':
				result = await runStudioTest(slug, projectPath);
				break;
			case 'automation:test':
				result = await runAutomationTest(slug, projectPath);
				break;
			case 'automation:run':
				result = await runAutomationRun(slug, projectPath);
				break;
			default:
				result = { stepId: step.id, ok: false, message: `Acao desconhecida: ${step.action}` };
		}
		steps.push(result);
		if (!result.ok) {
			break;
		}
	}

	return {
		ok: steps.every(s => s.ok),
		slug,
		recipe,
		steps
	};
}
