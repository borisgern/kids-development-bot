import { Bot } from 'grammy';
import { readDbData, writeDbData } from '../services/databaseService';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

export const bot = new Bot(token);

bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  try {
    const db = await readDbData();
    
    if (!db.subscribers.includes(chatId)) {
      db.subscribers.push(chatId);
      await writeDbData(db);
      
      await ctx.reply(
        `🎯 Добро пожаловать в "Квесты Развития"!\n\n` +
        `Теперь вы будете получать ежедневные задания для развития детей каждое утро в 7:00.\n\n` +
        `📝 Каждый день я буду отправлять по 3 задания для Дани и 3 для Тёмы.\n\n` +
        `Чтобы отписаться, используйте команду /stop`
      );
    } else {
      await ctx.reply(
        `✅ Вы уже подписаны на получение заданий!\n\n` +
        `Ежедневные задания приходят в 7:00 утра.`
      );
    }
  } catch (error) {
    console.error('Error in /start command:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.command('stop', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  try {
    const db = await readDbData();
    const index = db.subscribers.indexOf(chatId);
    
    if (index > -1) {
      db.subscribers.splice(index, 1);
      await writeDbData(db);
      
      await ctx.reply(
        `👋 Вы успешно отписались от "Квестов Развития".\n\n` +
        `Чтобы снова подписаться, используйте команду /start`
      );
    } else {
      await ctx.reply('❌ Вы не были подписаны на рассылку.');
    }
  } catch (error) {
    console.error('Error in /stop command:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

export const startBot = async () => {
  try {
    await bot.start();
    console.log('🤖 Telegram bot started successfully');
  } catch (error) {
    console.error('Failed to start bot:', error);
    throw error;
  }
};

export const stopBot = async () => {
  try {
    await bot.stop();
    console.log('🛑 Telegram bot stopped');
  } catch (error) {
    console.error('Error stopping bot:', error);
  }
};