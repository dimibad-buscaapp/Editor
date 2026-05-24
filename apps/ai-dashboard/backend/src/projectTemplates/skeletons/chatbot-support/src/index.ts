import { Telegraf } from 'telegraf';
import axios from 'axios';

const token = process.env.TELEGRAM_BOT_TOKEN;
const handoffUrl = process.env.HANDOFF_WEBHOOK_URL ?? '';

const faq: Record<string, string> = {
	horario: 'Atendimento 24/7 via bot; humano em horario comercial.',
	preco: 'Consulte nosso site ou digite /contato.',
	contato: 'Envie sua mensagem que encaminhamos para a equipe.'
};

if (!token) {
	console.error('Defina TELEGRAM_BOT_TOKEN');
	process.exit(1);
}

const bot = new Telegraf(token);

bot.start(ctx => ctx.reply('Ola! Sou o assistente {{PROJECT_NAME}}. Pergunte sobre horario, preco ou contato.'));

bot.on('text', async ctx => {
	const text = ctx.message.text.toLowerCase();
	const key = Object.keys(faq).find(k => text.includes(k));
	if (key) {
		await ctx.reply(faq[key]!);
		return;
	}
	if (handoffUrl) {
		await axios.post(handoffUrl, { userId: ctx.from?.id, text: ctx.message.text }).catch(() => undefined);
	}
	await ctx.reply('Encaminhei para atendimento humano.');
});

// PRINCY_AUTOMATION_INSERT

bot.launch();
console.log('{{PROJECT_NAME}} chatbot support online');
