export type EndpointTestCase = {
	readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	readonly path: string;
	readonly body?: unknown;
	readonly expectStatus?: number;
};

export type EndpointTestResult = {
	readonly method: string;
	readonly path: string;
	readonly status: number;
	readonly ok: boolean;
	readonly error?: string;
};

export async function runEndpointTests(
	baseUrl: string,
	tests: readonly EndpointTestCase[]
): Promise<{ readonly results: EndpointTestResult[]; readonly passed: number; readonly failed: number }> {
	const base = baseUrl.replace(/\/+$/, '');
	const results: EndpointTestResult[] = [];

	for (const test of tests) {
		const url = `${base}${test.path.startsWith('/') ? test.path : `/${test.path}`}`;
		const expectStatus = test.expectStatus ?? 200;
		try {
			const init: RequestInit = {
				method: test.method,
				headers: { Accept: 'application/json' }
			};
			if (test.body !== undefined && test.method !== 'GET') {
				init.headers = { ...init.headers, 'Content-Type': 'application/json' };
				init.body = JSON.stringify(test.body);
			}
			const res = await fetch(url, init);
			results.push({
				method: test.method,
				path: test.path,
				status: res.status,
				ok: res.status === expectStatus
			});
		} catch (error) {
			results.push({
				method: test.method,
				path: test.path,
				status: 0,
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	const passed = results.filter(r => r.ok).length;
	return { results, passed, failed: results.length - passed };
}

export function defaultSmokeTests(): EndpointTestCase[] {
	return [
		{ method: 'GET', path: '/health', expectStatus: 200 },
		{ method: 'GET', path: '/api/items', expectStatus: 200 }
	];
}
