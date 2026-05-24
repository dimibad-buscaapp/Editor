import axios from 'axios';
import cron from 'node-cron';

const baseUrl = process.env.API_BASE_URL ?? 'https://httpbin.org';
const token = process.env.API_TOKEN ?? '';

async function fetchHealth(): Promise<void> {
	const res = await axios.get(`${baseUrl}/get`, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		timeout: 15_000
	});
	console.log('[api-integration] status', res.status);
}

cron.schedule('*/15 * * * *', () => {
	void fetchHealth();
});

// PRINCY_AUTOMATION_INSERT

console.log('{{PROJECT_NAME}} api integration started');
void fetchHealth();
