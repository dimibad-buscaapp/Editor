import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from '../config.js';

export type ScheduleResult = {
	readonly scheduled: boolean;
	readonly schedule: string;
	readonly taskName?: string;
	readonly localInstructions?: string;
};

function cronToSchtasksSchedule(cron: string): { modifier: string; time: string } {
	const parts = cron.trim().split(/\s+/);
	if (parts.length >= 2 && parts[0]?.startsWith('*/')) {
		const minutes = parts[0].replace('*/', '');
		return { modifier: `/sc minute /mo ${minutes}` , time: '' };
	}
	if (parts[0] === '0' && parts[1]?.startsWith('*/')) {
		const hours = parts[1].replace('*/', '');
		return { modifier: `/sc hourly /mo ${hours}`, time: '' };
	}
	return { modifier: '/sc daily', time: '/st 09:00' };
}

export async function scheduleAutomation(
	slug: string,
	projectPath: string,
	schedule: string,
	runCommand: string
): Promise<ScheduleResult> {
	const taskName = `PrincyAutomation_${slug}`;
	if (process.platform === 'win32') {
		const { modifier, time } = cronToSchtasksSchedule(schedule);
		const tr = `"node" "${path.join(projectPath, 'scripts', 'smoke-test.mjs')}"`;
		const args = [
			'/create', '/f',
			'/tn', taskName,
			modifier.split(' ')[1] ?? 'daily',
			...(modifier.includes('/mo') ? modifier.split(' ').slice(2) : []),
			...(time ? time.split(' ') : []),
			'/tr', runCommand || tr,
			'/ru', 'SYSTEM'
		].filter(Boolean);

		return new Promise(resolve => {
			const child = spawn('schtasks', args, { shell: true });
			let stderr = '';
			child.stderr?.on('data', chunk => { stderr += String(chunk); });
			child.on('close', code => {
				if (code === 0) {
					resolve({ scheduled: true, schedule, taskName });
				} else {
					resolve({
						scheduled: false,
						schedule,
						localInstructions: `schtasks falhou (${stderr.trim()}). Use node-cron local ou execute manualmente. Cron: ${schedule}`
					});
				}
			});
			child.on('error', () => {
				resolve({
					scheduled: false,
					schedule,
					localInstructions: `Agende localmente com cron "${schedule}" em ${projectPath}`
				});
			});
		});
	}

	return {
		scheduled: false,
		schedule,
		localInstructions: `Linux/macOS: adicione ao crontab "${schedule}" cd ${projectPath} && npm start`
	};
}

export async function unscheduleAutomation(taskName: string): Promise<boolean> {
	if (process.platform !== 'win32' || !taskName) {
		return false;
	}
	return new Promise(resolve => {
		const child = spawn('schtasks', ['/delete', '/tn', taskName, '/f'], { shell: true });
		child.on('close', code => resolve(code === 0));
		child.on('error', () => resolve(false));
	});
}

export function buildLocalScheduleInstructions(slug: string, schedule: string, projectPath: string): string {
	return [
		`Projeto: ${slug}`,
		`Pasta: ${projectPath}`,
		`Cron: ${schedule}`,
		`VPS: tarefa Windows PrincyAutomation_${slug} (requer Admin)`,
		`Local: npm start em ${projectPath} ou use a extensao "Executar aqui"`,
		`Manifest: ${path.join(config.automationsRoot, slug, 'manifest.json')}`
	].join('\n');
}
