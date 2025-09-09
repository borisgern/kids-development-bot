import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

export class LoggerService {
  private logDir: string;
  private logFile: string;
  private maxLogSize: number;
  private maxLogFiles: number;

  constructor(
    logDir: string = path.join(process.cwd(), 'logs'),
    maxLogSize: number = 10 * 1024 * 1024, // 10MB
    maxLogFiles: number = 5
  ) {
    this.logDir = logDir;
    this.logFile = path.join(logDir, 'bot.log');
    this.maxLogSize = maxLogSize;
    this.maxLogFiles = maxLogFiles;
    
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      component,
      message,
      ...(data && { data })
    };
    
    return JSON.stringify(logEntry);
  }

  private writeToFile(formattedMessage: string): void {
    try {
      // Check if log rotation is needed
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.maxLogSize) {
          this.rotateLog();
        }
      }

      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private rotateLog(): void {
    try {
      // Move current log to backup
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(this.logDir, `bot.log.${i}`);
        const newFile = path.join(this.logDir, `bot.log.${i + 1}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current log to .1
      if (fs.existsSync(this.logFile)) {
        fs.renameSync(this.logFile, path.join(this.logDir, 'bot.log.1'));
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private log(level: LogLevel, component: string, message: string, data?: any): void {
    const formattedMessage = this.formatMessage(level, component, message, data);
    
    // Always log to console
    const consoleMessage = `[${new Date().toISOString()}] [${level}] [${component}] ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage, data);
        break;
      case LogLevel.INFO:
        console.info(consoleMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(consoleMessage, data);
        break;
    }
    
    // Write to file
    this.writeToFile(formattedMessage);
  }

  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  warn(component: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  error(component: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, component, message, data);
  }

  // Convenience methods for cron monitoring
  cronJobStarted(jobName: string, schedule: string, timezone: string): void {
    this.info('CRON', `Job started: ${jobName}`, {
      schedule,
      timezone,
      nextRun: this.getNextRunTime(schedule, timezone)
    });
  }

  cronJobTriggered(jobName: string): void {
    this.info('CRON', `Job triggered: ${jobName}`);
  }

  cronJobCompleted(jobName: string, success: boolean, stats?: any): void {
    this.info('CRON', `Job completed: ${jobName}`, {
      success,
      ...stats
    });
  }

  broadcastStarted(subscriberCount: number): void {
    this.info('BROADCAST', `Starting daily broadcast`, { subscriberCount });
  }

  broadcastCompleted(stats: any): void {
    this.info('BROADCAST', `Broadcast completed`, stats);
  }

  private getNextRunTime(schedule: string, timezone: string): string {
    try {
      const now = new Date();
      const [minute, hour] = schedule.split(' ');
      const nextRun = new Date();
      
      nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      return nextRun.toISOString();
    } catch (error) {
      return 'Unable to calculate';
    }
  }

  // Get recent logs for monitoring
  getRecentLogs(lines: number = 100): LogEntry[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const data = fs.readFileSync(this.logFile, 'utf8');
      const logLines = data.trim().split('\n').slice(-lines);
      
      return logLines
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch (error) {
            return null;
          }
        })
        .filter(entry => entry !== null) as LogEntry[];
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }
}

// Create default logger instance
export const defaultLogger = new LoggerService();