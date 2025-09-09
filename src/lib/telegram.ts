import { Bot } from 'grammy';
import { readDbData, writeDbData } from '../services/databaseService';
import { defaultLogger } from '../services/loggerService';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

export const bot = new Bot(token);

bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const username = ctx.from?.username || 'unknown';
  const firstName = ctx.from?.first_name || 'unknown';
  
  try {
    defaultLogger.info('BOT', 'Start command received', { 
      chatId, 
      username, 
      firstName 
    });
    
    const db = await readDbData();
    
    if (!db.subscribers.includes(chatId)) {
      db.subscribers.push(chatId);
      await writeDbData(db);
      
      defaultLogger.info('BOT', 'New subscriber added', { 
        chatId, 
        username, 
        totalSubscribers: db.subscribers.length 
      });
      
      await ctx.reply(
        `🎯 Добро пожаловать в "Квесты Развития"!\n\n` +
        `Теперь вы будете получать ежедневные задания для развития детей каждое утро в 7:00.\n\n` +
        `📝 Каждый день я буду отправлять по 3 задания для Дани и 3 для Тёмы.\n\n` +
        `Чтобы отписаться, используйте команду /stop`
      );
    } else {
      defaultLogger.debug('BOT', 'Existing subscriber tried to start', { chatId, username });
      
      await ctx.reply(
        `✅ Вы уже подписаны на получение заданий!\n\n` +
        `Ежедневные задания приходят в 7:00 утра.`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    defaultLogger.error('BOT', 'Error in /start command', { 
      chatId, 
      username, 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    try {
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    } catch (replyError) {
      defaultLogger.error('BOT', 'Failed to send error message to user', { 
        chatId, 
        error: replyError instanceof Error ? replyError.message : 'Unknown reply error' 
      });
    }
  }
});

bot.command('stop', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const username = ctx.from?.username || 'unknown';
  const firstName = ctx.from?.first_name || 'unknown';
  
  try {
    defaultLogger.info('BOT', 'Stop command received', { 
      chatId, 
      username, 
      firstName 
    });
    
    const db = await readDbData();
    const index = db.subscribers.indexOf(chatId);
    
    if (index > -1) {
      db.subscribers.splice(index, 1);
      await writeDbData(db);
      
      defaultLogger.info('BOT', 'Subscriber removed', { 
        chatId, 
        username, 
        remainingSubscribers: db.subscribers.length 
      });
      
      await ctx.reply(
        `👋 Вы успешно отписались от "Квестов Развития".\n\n` +
        `Чтобы снова подписаться, используйте команду /start`
      );
    } else {
      defaultLogger.debug('BOT', 'Non-subscriber tried to stop', { chatId, username });
      await ctx.reply('❌ Вы не были подписаны на рассылку.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    defaultLogger.error('BOT', 'Error in /stop command', { 
      chatId, 
      username, 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    try {
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    } catch (replyError) {
      defaultLogger.error('BOT', 'Failed to send error message to user', { 
        chatId, 
        error: replyError instanceof Error ? replyError.message : 'Unknown reply error' 
      });
    }
  }
});

export const startBot = async () => {
  try {
    await bot.start();
    defaultLogger.info('BOT', 'Telegram bot started successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    defaultLogger.error('BOT', 'Failed to start bot', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    });
    throw error;
  }
};

export const stopBot = async () => {
  try {
    await bot.stop();
    defaultLogger.info('BOT', 'Telegram bot stopped successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    defaultLogger.error('BOT', 'Error stopping bot', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    });
  }
};

// Add global error handler for the bot
bot.catch((err) => {
  const ctx = err.ctx;
  const chatId = ctx.chat?.id?.toString() || 'unknown';
  const username = ctx.from?.username || 'unknown';
  
  const error = err.error;
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  defaultLogger.error('BOT', 'Unhandled bot error', {
    chatId,
    username,
    error: errorMessage,
    stack: errorStack,
    updateType: ctx.update ? Object.keys(ctx.update)[0] : 'unknown'
  });
});