export type BuildType = 'apk' | 'exe' | 'web' | 'api';

/** API public status (Portuguese labels in UI map from these). */
export type BuildStatus = 'waiting' | 'compiling' | 'error' | 'success';

export type BuildInternalStatus = 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED' | 'SKIPPED';

export type BuildManifest = {
	readonly buildId: string;
	readonly type: BuildType;
	readonly status: BuildStatus;
	readonly internalStatus: BuildInternalStatus;
	readonly workspacePath: string;
	readonly projectSlug?: string;
	readonly note?: string;
	readonly startedAt: number;
	readonly finishedAt?: number;
	readonly artifactName?: string;
	readonly artifactReady: boolean;
	readonly errorMessage?: string;
	/** Fase 8: URL de preview apos build web de projeto. */
	readonly previewUrl?: string;
};

export type StartBuildInput = {
	readonly type: BuildType;
	readonly projectPath?: string;
	readonly projectSlug?: string;
	readonly note?: string;
};

export type BuildStatusResponse = {
	readonly ok: true;
	readonly buildId: string;
	readonly type: BuildType;
	readonly status: BuildStatus;
	readonly startedAt: number;
	readonly finishedAt?: number;
	readonly artifactReady: boolean;
	readonly artifactName?: string;
	readonly workspacePath: string;
	readonly projectSlug?: string;
	readonly previewUrl?: string;
};

export type BuildLogsResponse = {
	readonly ok: true;
	readonly buildId: string;
	readonly offset: number;
	readonly lines: string;
	readonly done: boolean;
};

/** Legacy agent/build compatibility. */
export type BuildTarget = BuildType;

export type BuildJobSnapshot = {
	readonly jobId: string;
	readonly buildId: string;
	readonly target: BuildTarget;
	readonly status: BuildInternalStatus;
	readonly output: string;
	readonly artifactHint?: string;
	readonly startedAt: number;
	readonly finishedAt?: number;
};

export function internalToPublicStatus(internal: BuildInternalStatus): BuildStatus {
	switch (internal) {
		case 'QUEUED':
			return 'waiting';
		case 'BUILDING':
			return 'compiling';
		case 'READY':
			return 'success';
		case 'FAILED':
		case 'SKIPPED':
		default:
			return 'error';
	}
}
