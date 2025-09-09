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
        
        // If parsing completely failed for both children, notify users and return
        if (initResult.errors.length >= 2) {
          defaultLogger.error('BROADCAST', 'Complete initialization failure', { errors: initResult.errors });
          const errorNotification = await this.sendErrorNotification(
            `Не удалось загрузить задачи из файлов:\n${initResult.errors.join('\n')}`
          );
          result.totalSubscribers = errorNotification.totalSubscribers;
          result.successfulDeliveries = errorNotification.successfulDeliveries;
          result.failedDeliveries = errorNotification.failedDeliveries;
          result.errors.push(...errorNotification.errors);
          return result;
        }
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
        const message = 'Все задачи уже были отправлены. Пулы задач будут автоматически обновлены в следующий раз.';
        result.errors.push('No tasks available to send');
        
        // Notify users that all tasks have been sent
        const notification = await this.sendCustomMessage(`📝 ${message}`);
        result.totalSubscribers = notification.totalSubscribers;
        result.successfulDeliveries = notification.successfulDeliveries;
        result.failedDeliveries = notification.failedDeliveries;
        result.errors.push(...notification.errors);
        
        defaultLogger.info('BROADCAST', 'All tasks have been sent, notified users');
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
   * Send message to specific subscribers with retry logic
   */
  private async broadcastMessage(
    subscribers: string[], 
    message: string,
    maxRetries: number = 3
  ): Promise<{ successfulDeliveries: number; failedDeliveries: number; errors: string[] }> {
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    const errors: string[] = [];

    for (const chatId of subscribers) {
      let attempt = 0;
      let sent = false;
      
      while (attempt < maxRetries && !sent) {
        try {
          attempt++;
          
          await bot.api.sendMessage(chatId, message, {
            parse_mode: 'Markdown'
          });
          
          successfulDeliveries++;
          sent = true;
          defaultLogger.debug('BROADCAST', `Message sent successfully to ${chatId}`, { attempt });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Check if this is a permanent error (don't retry these)
          if (this.isPermanentError(errorMessage)) {
            errors.push(`Permanent error for ${chatId}: ${errorMessage}`);
            defaultLogger.warn('BROADCAST', `Permanent error for ${chatId}`, { error: errorMessage, attempt });
            
            // Handle user blocking or chat deletion
            if (errorMessage.includes('bot was blocked') || 
                errorMessage.includes('chat not found') ||
                errorMessage.includes('user is deactivated') ||
                errorMessage.includes('Bad Request: chat not found')) {
              try {
                const dbService = this.taskService.getDatabaseService();
                dbService.removeSubscriber(chatId);
                defaultLogger.info('BROADCAST', `Removed inactive user ${chatId} from subscribers`);
              } catch (removeError) {
                defaultLogger.error('BROADCAST', `Failed to remove subscriber ${chatId}`, removeError);
              }
            }
            break; // Don't retry permanent errors
          }
          
          // Check if this is a rate limit error
          if (this.isRateLimitError(errorMessage)) {
            const retryDelay = attempt * 1000 + Math.random() * 1000; // Exponential backoff with jitter
            defaultLogger.warn('BROADCAST', `Rate limited for ${chatId}, retrying in ${retryDelay}ms`, { attempt, error: errorMessage });
            await this.delay(retryDelay);
          } else if (attempt < maxRetries) {
            // For other temporary errors, wait a bit before retrying
            const retryDelay = attempt * 500;
            defaultLogger.warn('BROADCAST', `Temporary error for ${chatId}, retrying in ${retryDelay}ms`, { attempt, error: errorMessage });
            await this.delay(retryDelay);
          }
          
          // If this was the final attempt, log the failure
          if (attempt === maxRetries) {
            errors.push(`Failed to send to ${chatId} after ${maxRetries} attempts: ${errorMessage}`);
            defaultLogger.error('BROADCAST', `Failed to send to ${chatId} after ${maxRetries} attempts`, { error: errorMessage });
          }
        }
      }
      
      if (!sent) {
        failedDeliveries++;
      }
      
      // Small delay between subscribers to avoid overwhelming the API
      await this.delay(100);
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
   * Check if an error is permanent (should not be retried)
   */
  private isPermanentError(errorMessage: string): boolean {
    const permanentErrorPatterns = [
      'bot was blocked',
      'chat not found',
      'user is deactivated',
      'Bad Request: chat not found',
      'Forbidden: bot can\'t send messages to the user',
      'Forbidden: user is deactivated',
      'Bad Request: invalid chat_id',
      'Bad Request: PEER_ID_INVALID'
    ];
    
    return permanentErrorPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if an error is due to rate limiting
   */
  private isRateLimitError(errorMessage: string): boolean {
    const rateLimitPatterns = [
      'Too Many Requests',
      'rate limit',
      'retry after',
      '429'
    ];
    
    return rateLimitPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
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