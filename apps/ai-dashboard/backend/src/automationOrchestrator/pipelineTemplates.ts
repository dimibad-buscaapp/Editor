export type PipelineRecipe = 'full-stack-web' | 'api-deploy' | 'daily-script';

export type PipelineStep = {
	readonly id: string;
	readonly label: string;
	readonly action: string;
};

export const pipelineRecipes: Record<PipelineRecipe, { readonly label: string; readonly steps: readonly PipelineStep[] }> = {
	'full-stack-web': {
		label: 'Site completo (build web + preview + publicar)',
		steps: [
			{ id: 'build', label: 'Build Center web', action: 'build:web' },
			{ id: 'preview', label: 'Sync preview', action: 'sites:preview-sync' },
			{ id: 'publish', label: 'Publicar site', action: 'sites:publish' }
		]
	},
	'api-deploy': {
		label: 'API (migrate + test + dev)',
		steps: [
			{ id: 'migrate', label: 'Prisma migrate', action: 'studio:migrate' },
			{ id: 'test', label: 'Testar endpoints', action: 'studio:test' },
			{ id: 'build', label: 'Build API', action: 'build:api' }
		]
	},
	'daily-script': {
		label: 'Script diario (executar + testar)',
		steps: [
			{ id: 'test', label: 'Smoke test', action: 'automation:test' },
			{ id: 'run', label: 'Executar', action: 'automation:run' }
		]
	}
};
