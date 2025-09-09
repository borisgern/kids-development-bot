import fs from 'fs';
import path from 'path';

export interface Task {
  text: string;
  sent: boolean;
}

export interface ParseResult {
  success: boolean;
  tasks: Task[];
  error?: string;
}

export class TaskParser {
  private readonly taskPattern = /^- \[ \] (.+)$/gm;

  parseMarkdownFile(filePath: string): ParseResult {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          tasks: [],
          error: `File not found: ${filePath}`
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const tasks = this.extractTasks(content);

      if (tasks.length === 0) {
        return {
          success: false,
          tasks: [],
          error: `No tasks found in file: ${filePath}`
        };
      }

      return {
        success: true,
        tasks
      };
    } catch (error) {
      return {
        success: false,
        tasks: [],
        error: `Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private extractTasks(content: string): Task[] {
    const matches = content.matchAll(this.taskPattern);
    const tasks: Task[] = [];

    for (const match of matches) {
      if (match[1]) {
        tasks.push({
          text: match[1].trim(),
          sent: false
        });
      }
    }

    return tasks;
  }

  parseMultipleFiles(filePaths: string[]): Map<string, ParseResult> {
    const results = new Map<string, ParseResult>();

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath, '.md');
      results.set(fileName, this.parseMarkdownFile(filePath));
    }

    return results;
  }
}