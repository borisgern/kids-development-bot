import { startBot } from '../lib/telegram';
import { defaultCronService } from '../services/cronService';

const main = async () => {
  console.log('🚀 Starting Telegram bot...');
  
  try {
    // Start the Telegram bot
    await startBot();
    console.log('✅ Bot is running in long polling mode');
    
    // Start cron jobs
    console.log('⏰ Starting cron jobs...');
    defaultCronService.startDailyBroadcast();
    
    // Start test cron if enabled
    if (process.env.ENABLE_TEST_CRON === 'true') {
      defaultCronService.startTestCron();
    }
    
    console.log('✅ All services started successfully');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  defaultCronService.stopAllJobs();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  defaultCronService.stopAllJobs();
  process.exit(0);
});

main();