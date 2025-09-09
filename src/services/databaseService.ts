import fs from 'fs';
import path from 'path';
import { Database, Task, TaskPool } from '@/types/database';

export class DatabaseService {
  private dbPath: string;
  private db: Database;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'db.json');
    this.db = this.loadDatabase();
  }

  private loadDatabase(): Database {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(data) as Database;
      }
    } catch (error) {
      console.error('Error loading database:', error);
    }

    return this.createDefaultDatabase();
  }

  private createDefaultDatabase(): Database {
    return {
      subscribers: [],
      taskPools: {
        danya: {
          tasks: [],
          lastReset: new Date().toISOString()
        },
        tema: {
          tasks: [],
          lastReset: new Date().toISOString()
        }
      }
    };
  }

  private saveDatabase(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
      throw new Error('Failed to save database');
    }
  }

  // Subscriber management
  addSubscriber(chatId: string): boolean {
    if (!this.db.subscribers.includes(chatId)) {
      this.db.subscribers.push(chatId);
      this.saveDatabase();
      return true;
    }
    return false;
  }

  removeSubscriber(chatId: string): boolean {
    const index = this.db.subscribers.indexOf(chatId);
    if (index > -1) {
      this.db.subscribers.splice(index, 1);
      this.saveDatabase();
      return true;
    }
    return false;
  }

  getSubscribers(): string[] {
    return [...this.db.subscribers];
  }

  isSubscribed(chatId: string): boolean {
    return this.db.subscribers.includes(chatId);
  }

  // Task pool management
  setTaskPool(child: 'danya' | 'tema', tasks: Task[]): void {
    this.db.taskPools[child] = {
      tasks,
      lastReset: new Date().toISOString()
    };
    this.saveDatabase();
  }

  getTaskPool(child: 'danya' | 'tema'): TaskPool {
    return this.db.taskPools[child];
  }

  getUnsentTasks(child: 'danya' | 'tema'): Task[] {
    return this.db.taskPools[child].tasks.filter(task => !task.sent);
  }

  markTasksAsSent(child: 'danya' | 'tema', taskTexts: string[]): void {
    const pool = this.db.taskPools[child];
    pool.tasks.forEach(task => {
      if (taskTexts.includes(task.text)) {
        task.sent = true;
      }
    });
    this.saveDatabase();
  }

  resetTaskPool(child: 'danya' | 'tema'): void {
    const pool = this.db.taskPools[child];
    pool.tasks.forEach(task => {
      task.sent = false;
    });
    pool.lastReset = new Date().toISOString();
    this.saveDatabase();
  }

  needsReset(child: 'danya' | 'tema'): boolean {
    const unsentTasks = this.getUnsentTasks(child);
    return unsentTasks.length === 0 && this.db.taskPools[child].tasks.length > 0;
  }

  selectRandomTasks(child: 'danya' | 'tema', count: number): Task[] {
    const unsentTasks = this.getUnsentTasks(child);
    
    if (unsentTasks.length === 0) {
      if (this.needsReset(child)) {
        this.resetTaskPool(child);
        return this.selectRandomTasks(child, count);
      }
      return [];
    }

    const selected: Task[] = [];
    const availableTasks = [...unsentTasks];

    for (let i = 0; i < Math.min(count, availableTasks.length); i++) {
      const randomIndex = Math.floor(Math.random() * availableTasks.length);
      selected.push(availableTasks[randomIndex]);
      availableTasks.splice(randomIndex, 1);
    }

    return selected;
  }

  // Initialize task pools from parsed tasks
  initializeTaskPools(danyaTasks: Task[], temaTasks: Task[]): void {
    this.setTaskPool('danya', danyaTasks);
    this.setTaskPool('tema', temaTasks);
  }

  // Get database statistics
  getStatistics() {
    return {
      subscribersCount: this.db.subscribers.length,
      danyaTasksTotal: this.db.taskPools.danya.tasks.length,
      danyaTasksSent: this.db.taskPools.danya.tasks.filter(t => t.sent).length,
      danyaLastReset: this.db.taskPools.danya.lastReset,
      temaTasksTotal: this.db.taskPools.tema.tasks.length,
      temaTasksSent: this.db.taskPools.tema.tasks.filter(t => t.sent).length,
      temaLastReset: this.db.taskPools.tema.lastReset
    };
  }
}