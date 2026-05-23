import type { BuildTarget } from '../actionRun/types.js';

export type ProjectTemplateId =
	| 'apk'
	| 'exe'
	| 'webapp'
	| 'saas'
	| 'api'
	| 'automation'
	| 'bot'
	| 'dashboard'
	| 'landing'
	| 'auth'
	| 'payments'
	| 'database';

export type ProjectTemplateDefinition = {
	readonly id: ProjectTemplateId;
	readonly name: string;
	readonly description: string;
	readonly stack: readonly string[];
	readonly build: string;
	readonly buildTarget?: BuildTarget;
	readonly skeletonDir: string;
	readonly tags?: readonly string[];
};

export type ProjectTemplateSummary = {
	readonly id: ProjectTemplateId;
	readonly name: string;
	readonly description: string;
	readonly stack: readonly string[];
	readonly build: string;
	readonly buildTarget?: BuildTarget;
	readonly tags?: readonly string[];
};
