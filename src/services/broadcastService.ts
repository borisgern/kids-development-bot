import { bot } from '../lib/telegram';
import { TaskService, DailyTaskSelection } from './taskService';
import { defaultLogger } from './loggerService';

export interface BroadcastResult {
  success: boolean;
  totalSubscribers: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  errors: string[];
}

export class BroadcastService {
  private taskService: TaskService;

  constructor(taskService?: TaskService) {
    this.taskService = taskService || new TaskService();
  }

  /**
   * Send daily tasks to all subscribers
   */
  async sendDailyTasks(): Promise<BroadcastResult> {
    const result: BroadcastResult = {
      success: false,
      totalSubscribers: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      errors: []
    };

    try {
      // Initialize task pools if needed
      const initResult = await this.taskService.initializeTaskPools();
      if (!initResult.success) {
        result.errors.push(...initResult.errors);
      }

      // Get subscribers
      const dbService = this.taskService.getDatabaseService();
      const subscribers = dbService.getSubscribers();
      result.totalSubscribers = subscribers.length;
      
      defaultLogger.broadcastStarted(subscribers.length);

      if (subscribers.length === 0) {
        result.errors.push('No subscribers found');
        return result;
      }

      // Select daily tasks
      const selection = this.taskService.selectDailyTasks();
      
      // Check if we have any tasks to send
      if (selection.danya.length === 0 && selection.tema.length === 0) {
        result.errors.push('No tasks available to send');
        return result;
      }

      // Format message
      const message = this.taskService.formatTelegramMessage(selection);

      // Send to all subscribers
      const broadcastResult = await this.broadcastMessage(subscribers, message);
      result.successfulDeliveries = broadcastResult.successfulDeliveries;
      result.failedDeliveries = broadcastResult.failedDeliveries;
      result.errors.push(...broadcastResult.errors);

      // Mark tasks as sent only if at least one delivery was successful
      if (result.successfulDeliveries > 0) {
        this.taskService.markTasksAsSent(selection);
      }

      result.success = result.successfulDeliveries > 0;
      
      defaultLogger.broadcastCompleted(result);

      return result;

    } catch (error) {
      const errorMessage = `Broadcast error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      defaultLogger.error('BROADCAST', errorMessage, error);
      return result;
    }
  }

  /**
   * Send a custom message to all subscribers
   */
  async sendCustomMessage(message: string): Promise<BroadcastResult> {
    const result: BroadcastResult = {
      success: false,
      totalSubscribers: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      errors: []
    };

    try {
      const dbService = this.taskService.getDatabaseService();
      const subscribers = dbService.getSubscribers();
      result.totalSubscribers = subscribers.length;

      if (subscribers.length === 0) {
        result.errors.push('No subscribers found');
        return result;
      }

      const broadcastResult = await this.broadcastMessage(subscribers, message);
      result.successfulDeliveries = broadcastResult.successfulDeliveries;
      result.failedDeliveries = broadcastResult.failedDeliveries;
      result.errors.push(...broadcastResult.errors);
      result.success = result.successfulDeliveries > 0;

      return result;

    } catch (error) {
      result.errors.push(`Custom message broadcast error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Send message to specific subscribers
   */
  private async broadcastMessage(
    subscribers: string[], 
    message: string
  ): Promise<{ successfulDeliveries: number; failedDeliveries: number; errors: string[] }> {
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    const errors: string[] = [];

    for (const chatId of subscribers) {
      try {
        await bot.api.sendMessage(chatId, message, {
          parse_mode: 'Markdown'
        });
        successfulDeliveries++;
        
        // Small delay between messages to avoid rate limiting
        await this.delay(100);
        
      } catch (error) {
        failedDeliveries++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to send to ${chatId}: ${errorMessage}`);
        
        // If user blocked the bot, remove them from subscribers
        if (errorMessage.includes('bot was blocked') || errorMessage.includes('chat not found')) {
          try {
            const dbService = this.taskService.getDatabaseService();
            dbService.removeSubscriber(chatId);
            console.log(`Removed blocked/deleted user ${chatId} from subscribers`);
          } catch (removeError) {
            console.error(`Failed to remove subscriber ${chatId}:`, removeError);
          }
        }
      }
    }

    return { successfulDeliveries, failedDeliveries, errors };
  }

  /**
   * Send error notification to subscribers
   */
  async sendErrorNotification(errorMessage: string): Promise<BroadcastResult> {
    const message = `❌ Произошла ошибка при загрузке заданий:\n\n${errorMessage}\n\nМы работаем над решением проблемы.`;
    return await this.sendCustomMessage(message);
  }

  /**
   * Get broadcast statistics
   */
  getBroadcastStatistics() {
    return {
      ...this.taskService.getStatistics(),
      poolsNeedReset: this.taskService.checkPoolsNeedReset()
    };
  }

  /**
   * Helper method to add delay between operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create default instance
export const defaultBroadcastService = new BroadcastService();