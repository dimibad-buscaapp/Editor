/** Build kinds for templates (kept local so Fase 4 does not depend on actionRun). */
export type BuildTarget = 'web' | 'api' | 'exe' | 'apk';

export type ProjectTemplateId =
	| 'apk'
	| 'exe'
	| 'webapp'
	| 'saas'
	| 'api'
	| 'express-api'
	| 'webhook'
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
