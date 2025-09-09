import * as cron from 'node-cron';
import { BroadcastService } from './broadcastService';
import { defaultLogger } from './loggerService';

export interface CronConfig {
  dailyBroadcastHour?: number;
  dailyBroadcastMinute?: number;
  enableTestCron?: boolean;
  timezone?: string;
}

export class CronService {
  private broadcastService: BroadcastService;
  private config: CronConfig;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(config?: CronConfig) {
    this.broadcastService = new BroadcastService();
    this.config = {
      dailyBroadcastHour: config?.dailyBroadcastHour || parseInt(process.env.DAILY_BROADCAST_HOUR || '7'),
      dailyBroadcastMinute: config?.dailyBroadcastMinute || parseInt(process.env.DAILY_BROADCAST_MINUTE || '0'),
      enableTestCron: config?.enableTestCron || process.env.ENABLE_TEST_CRON === 'true',
      timezone: config?.timezone || process.env.TZ || 'Europe/Lisbon'
    };
  }

  /**
   * Start the daily broadcast cron job
   */
  startDailyBroadcast(): void {
    const cronExpression = `${this.config.dailyBroadcastMinute} ${this.config.dailyBroadcastHour} * * *`;
    
    console.log(`Setting up daily broadcast cron job: ${cronExpression} (${this.config.timezone})`);
    
    const job = cron.schedule(cronExpression, async () => {
      defaultLogger.cronJobTriggered('daily-broadcast');
      await this.executeDailyBroadcast();
    }, {
      timezone: this.config.timezone
    });

    this.jobs.set('daily-broadcast', job);
    
    defaultLogger.cronJobStarted('daily-broadcast', cronExpression, this.config.timezone!);
    console.log(`✅ Daily broadcast cron job started: ${this.config.dailyBroadcastHour}:${this.config.dailyBroadcastMinute?.toString().padStart(2, '0')} ${this.config.timezone}`);
  }

  /**
   * Start test cron job (every minute) - for development/testing
   */
  startTestCron(): void {
    if (!this.config.enableTestCron) {
      console.log('⏭️  Test cron is disabled');
      return;
    }

    console.log('Setting up test broadcast cron job: every minute');
    
    const job = cron.schedule('* * * * *', async () => {
      console.log(`[${new Date().toISOString()}] Test broadcast cron job triggered`);
      await this.executeTestBroadcast();
    }, {
      timezone: this.config.timezone
    });

    this.jobs.set('test-broadcast', job);
    console.log('✅ Test broadcast cron job started (every minute)');
  }

  /**
   * Execute daily broadcast
   */
  private async executeDailyBroadcast(): Promise<void> {
    try {
      defaultLogger.broadcastStarted(0); // Will be updated by broadcast service
      const result = await this.broadcastService.sendDailyTasks();
      
      const summary = {
        success: result.success,
        timestamp: new Date().toISOString(),
        totalSubscribers: result.totalSubscribers,
        successfulDeliveries: result.successfulDeliveries,
        failedDeliveries: result.failedDeliveries,
        errorCount: result.errors.length
      };

      defaultLogger.cronJobCompleted('daily-broadcast', result.success, summary);
      console.log(`[${new Date().toISOString()}] Daily broadcast completed:`, summary);

      if (!result.success) {
        defaultLogger.error('CRON', 'Daily broadcast had errors', result.errors);
        console.error(`[${new Date().toISOString()}] Daily broadcast errors:`, result.errors);
      }

    } catch (error) {
      defaultLogger.error('CRON', 'Daily broadcast cron job failed', error);
      console.error(`[${new Date().toISOString()}] Daily broadcast cron job failed:`, error);
    }
  }

  /**
   * Execute test broadcast with shorter message
   */
  private async executeTestBroadcast(): Promise<void> {
    try {
      const testMessage = `🧪 Тест рассылки в ${new Date().toLocaleTimeString('ru-RU', { 
        timeZone: this.config.timezone,
        hour: '2-digit',
        minute: '2-digit'
      })}`;

      const result = await this.broadcastService.sendCustomMessage(testMessage);
      
      console.log(`[${new Date().toISOString()}] Test broadcast: ${result.success ? '✅' : '❌'} (${result.successfulDeliveries}/${result.totalSubscribers})`);

      if (result.errors.length > 0) {
        console.error(`[${new Date().toISOString()}] Test broadcast errors:`, result.errors);
      }

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Test broadcast cron job failed:`, error);
    }
  }

  /**
   * Stop specific cron job
   */
  stopJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobs.delete(jobName);
      console.log(`🛑 Stopped cron job: ${jobName}`);
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAllJobs(): void {
    for (const [jobName, job] of this.jobs.entries()) {
      job.stop();
      console.log(`🛑 Stopped cron job: ${jobName}`);
    }
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  getJobsStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    for (const [jobName] of this.jobs.entries()) {
      // node-cron doesn't expose running status, assume true if job exists
      status[jobName] = true;
    }
    return status;
  }

  /**
   * Get current configuration
   */
  getConfig(): CronConfig {
    return { ...this.config };
  }

  /**
   * Get next scheduled run time for daily broadcast
   */
  getNextRunTime(): Date {
    const now = new Date();
    const nextRun = new Date();
    
    nextRun.setHours(this.config.dailyBroadcastHour!, this.config.dailyBroadcastMinute!, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return nextRun;
  }
}

// Create default instance
export const defaultCronService = new CronService();