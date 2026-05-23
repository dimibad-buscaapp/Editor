import cron from 'node-cron';
console.log('{{PROJECT_NAME}} automation started');
cron.schedule('*/5 * * * *', () => console.log('[cron]', new Date().toISOString(), 'heartbeat'));
