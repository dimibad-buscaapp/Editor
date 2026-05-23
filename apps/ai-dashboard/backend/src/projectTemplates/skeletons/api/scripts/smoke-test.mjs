const base = process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4000}`;

const tests = [
	{ method: 'GET', path: '/health', expect: 200 },
	{ method: 'GET', path: '/api/items', expect: 200 }
];

let failed = 0;
for (const t of tests) {
	const res = await fetch(`${base}${t.path}`, { method: t.method });
	if (res.status !== t.expect) {
		console.error(`FAIL ${t.method} ${t.path} -> ${res.status}`);
		failed++;
	} else {
		console.log(`OK ${t.method} ${t.path}`);
	}
}
process.exit(failed > 0 ? 1 : 0);
