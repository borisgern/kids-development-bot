import { startBot } from '../lib/telegram';

const main = async () => {
  console.log('🚀 Starting Telegram bot...');
  
  try {
    await startBot();
    console.log('✅ Bot is running in long polling mode');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main();