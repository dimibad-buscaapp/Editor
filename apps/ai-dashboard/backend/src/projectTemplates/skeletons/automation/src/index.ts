import cron from 'node-cron';
import './jobs/index.js';

console.log('{{PROJECT_NAME}} automation scheduler active');

// Keep process alive
process.stdin.resume();
