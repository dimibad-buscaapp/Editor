const base = process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4000}`;
const res = await fetch(`${base}/health`);
console.log(res.status === 200 ? 'OK /health' : `FAIL /health ${res.status}`);
process.exit(res.status === 200 ? 0 : 1);
