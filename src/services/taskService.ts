import { DatabaseService } from './databaseService';
import { TaskParser } from './taskParser';
import { Task } from '../types/database';
import path from 'path';

export interface DailyTaskSelection {
  danya: Task[];
  tema: Task[];
}

export interface TaskServiceConfig {
  danyaMarkdownPath?: string;
  temaMarkdownPath?: string;
}

export class TaskService {
  private dbService: DatabaseService;
  private taskParser: TaskParser;
  private config: TaskServiceConfig;

  constructor(config?: TaskServiceConfig) {
    this.dbService = new DatabaseService();
    this.taskParser = new TaskParser();
    this.config = {
      danyaMarkdownPath: config?.danyaMarkdownPath || path.join(process.cwd(), 'data', 'Dans_current_development_progress.md'),
      temaMarkdownPath: config?.temaMarkdownPath || path.join(process.cwd(), 'data', 'Temas_current_development_progress.md'),
    };
  }

  /**
   * Initialize task pools from markdown files
   */
  async initializeTaskPools(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Parse Danya's tasks
    const danyaResult = this.taskParser.parseMarkdownFile(this.config.danyaMarkdownPath!);
    if (!danyaResult.success) {
      errors.push(`Danya: ${danyaResult.error}`);
    }

    // Parse Tema's tasks
    const temaResult = this.taskParser.parseMarkdownFile(this.config.temaMarkdownPath!);
    if (!temaResult.success) {
      errors.push(`Tema: ${temaResult.error}`);
    }

    // Initialize database with parsed tasks (even if some failed)
    if (danyaResult.success || temaResult.success) {
      this.dbService.initializeTaskPools(
        danyaResult.success ? danyaResult.tasks : [],
        temaResult.success ? temaResult.tasks : []
      );
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Select 3 random tasks for each child
   */
  selectDailyTasks(): DailyTaskSelection {
    return {
      danya: this.dbService.selectRandomTasks('danya', 3),
      tema: this.dbService.selectRandomTasks('tema', 3)
    };
  }

  /**
   * Mark selected tasks as sent
   */
  markTasksAsSent(selection: DailyTaskSelection): void {
    if (selection.danya.length > 0) {
      this.dbService.markTasksAsSent('danya', selection.danya.map(t => t.text));
    }
    
    if (selection.tema.length > 0) {
      this.dbService.markTasksAsSent('tema', selection.tema.map(t => t.text));
    }
  }

  /**
   * Format tasks for Telegram message
   */
  formatTelegramMessage(selection: DailyTaskSelection): string {
    const messages: string[] = [];
    
    if (selection.danya.length > 0) {
      messages.push('*Задачи для Данила:*');
      selection.danya.forEach((task, index) => {
        messages.push(`${index + 1}. ${task.text}`);
      });
      messages.push(''); // Empty line
    }

    if (selection.tema.length > 0) {
      messages.push('*Задачи для Артёма:*');
      selection.tema.forEach((task, index) => {
        messages.push(`${index + 1}. ${task.text}`);
      });
      messages.push(''); // Empty line
    }

    if (messages.length === 0) {
      return '❌ Не удалось найти задачи для сегодня. Возможно, все задачи уже были отправлены или файлы с задачами пусты.';
    }

    messages.push('🎯 Удачного дня развития!');
    
    return messages.join('\n');
  }

  /**
   * Get task statistics
   */
  getStatistics() {
    return this.dbService.getStatistics();
  }

  /**
   * Get subscribers count
   */
  getSubscribersCount(): number {
    return this.dbService.getSubscribers().length;
  }

  /**
   * Check if task pools need reset
   */
  checkPoolsNeedReset(): { danya: boolean; tema: boolean } {
    return {
      danya: this.dbService.needsReset('danya'),
      tema: this.dbService.needsReset('tema')
    };
  }

  /**
   * Force reset task pools
   */
  resetTaskPools(children?: ('danya' | 'tema')[]): void {
    const toReset = children || ['danya', 'tema'];
    
    toReset.forEach(child => {
      this.dbService.resetTaskPool(child);
    });
  }

  /**
   * Get database service instance (for accessing subscriber methods)
   */
  getDatabaseService(): DatabaseService {
    return this.dbService;
  }
}

// Create default instance
export const defaultTaskService = new TaskService();