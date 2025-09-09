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
          error: `File not found: ${filePath}. Please ensure the markdown files exist in the data directory.`
        };
      }

      // Check if file is readable
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (accessError) {
        return {
          success: false,
          tasks: [],
          error: `File is not readable: ${filePath}. Please check file permissions.`
        };
      }

      // Check file size - protect against very large files
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        return {
          success: false,
          tasks: [],
          error: `File too large: ${filePath} (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed size is 10MB.`
        };
      }

      if (stats.size === 0) {
        return {
          success: false,
          tasks: [],
          error: `File is empty: ${filePath}`
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check if content is valid UTF-8 and not corrupted
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          tasks: [],
          error: `File appears to be empty or corrupted: ${filePath}`
        };
      }

      const tasks = this.extractTasks(content);

      if (tasks.length === 0) {
        return {
          success: false,
          tasks: [],
          error: `No valid tasks found in file: ${filePath}. Please ensure tasks are formatted as "- [ ] Task description"`
        };
      }

      return {
        success: true,
        tasks
      };
    } catch (error) {
      if (error instanceof Error) {
        // Provide more specific error messages based on error type
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          return {
            success: false,
            tasks: [],
            error: `File not found: ${filePath}. Please check if the file exists.`
          };
        } else if (nodeError.code === 'EACCES') {
          return {
            success: false,
            tasks: [],
            error: `Permission denied: ${filePath}. Please check file permissions.`
          };
        } else if (nodeError.code === 'EMFILE' || nodeError.code === 'ENFILE') {
          return {
            success: false,
            tasks: [],
            error: `System resource error when reading: ${filePath}. Too many open files.`
          };
        } else if (error.name === 'SyntaxError') {
          return {
            success: false,
            tasks: [],
            error: `File encoding error: ${filePath}. Please ensure the file is saved as UTF-8.`
          };
        }
      }
      
      return {
        success: false,
        tasks: [],
        error: `Unexpected error parsing file: ${filePath}. ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private extractTasks(content: string): Task[] {
    const tasks: Task[] = [];

    try {
      const matches = content.matchAll(this.taskPattern);

      for (const match of matches) {
        if (match[1]) {
          const taskText = match[1].trim();
          
          // Skip empty or very short tasks
          if (taskText.length < 3) {
            continue;
          }
          
          // Skip tasks that are too long (likely formatting errors)
          if (taskText.length > 500) {
            continue;
          }
          
          // Check for potential encoding issues or strange characters
          if (taskText.includes('\uFFFD')) { // Unicode replacement character
            continue;
          }
          
          tasks.push({
            text: taskText,
            sent: false
          });
        }
      }
    } catch (error) {
      // If regex matching fails, try to extract tasks line by line as fallback
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('- [ ]')) {
          const taskText = trimmedLine.substring(5).trim();
          if (taskText.length >= 3 && taskText.length <= 500) {
            tasks.push({
              text: taskText,
              sent: false
            });
          }
        }
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