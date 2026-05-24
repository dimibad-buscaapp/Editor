import { Telegraf } from 'telegraf';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
	console.error('Defina TELEGRAM_BOT_TOKEN');
	process.exit(1);
}

const bot = new Telegraf(token);

bot.start(ctx => ctx.reply('Ola! {{PROJECT_NAME}} bot ativo.'));

// PRINCY_AUTOMATION_INSERT

bot.launch();
console.log('{{PROJECT_NAME}} bot online');
