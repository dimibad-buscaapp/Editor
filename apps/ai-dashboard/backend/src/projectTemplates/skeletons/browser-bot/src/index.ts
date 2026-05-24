import { chromium } from 'playwright';

const url = process.env.TARGET_URL ?? 'https://example.com';

async function main(): Promise<void> {
	console.log('{{PROJECT_NAME}} browser bot starting');
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	await page.goto(url);
	const title = await page.title();
	console.log('[browser-bot] title=', title);

	// PRINCY_AUTOMATION_INSERT

	await browser.close();
	console.log('[browser-bot] done');
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
