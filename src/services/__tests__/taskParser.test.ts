import fs from 'fs';
import path from 'path';
import { TaskParser } from '../taskParser';

jest.mock('fs');

describe('TaskParser', () => {
  let parser: TaskParser;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    parser = new TaskParser();
    jest.clearAllMocks();
  });

  describe('parseMarkdownFile', () => {
    it('should successfully parse tasks from markdown file', () => {
      const mockContent = `
# Test Tasks

## Section 1
- [ ] Task 1
- [ ] Task 2
- [x] Completed task (should be ignored)
- [ ] Task 3

## Section 2
- [ ] Task 4
Some text here
- [ ] Task 5
      `;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parser.parseMarkdownFile('test.md');

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(5);
      expect(result.tasks[0]).toEqual({ text: 'Task 1', sent: false });
      expect(result.tasks[1]).toEqual({ text: 'Task 2', sent: false });
      expect(result.tasks[2]).toEqual({ text: 'Task 3', sent: false });
      expect(result.tasks[3]).toEqual({ text: 'Task 4', sent: false });
      expect(result.tasks[4]).toEqual({ text: 'Task 5', sent: false });
    });

    it('should handle multi-line tasks', () => {
      const mockContent = `
- [ ] Task with multiple words and special characters (parentheses)
- [ ] Задача на русском языке с цифрами 123
- [ ] Task with "quotes" and 'apostrophes'
      `;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parser.parseMarkdownFile('test.md');

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].text).toBe('Task with multiple words and special characters (parentheses)');
      expect(result.tasks[1].text).toBe('Задача на русском языке с цифрами 123');
      expect(result.tasks[2].text).toBe('Task with "quotes" and \'apostrophes\'');
    });

    it('should return error when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = parser.parseMarkdownFile('nonexistent.md');

      expect(result.success).toBe(false);
      expect(result.tasks).toHaveLength(0);
      expect(result.error).toContain('File not found');
    });

    it('should return error when no tasks found in file', () => {
      const mockContent = `
# Header
Some text without tasks
- [x] Completed task only
      `;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parser.parseMarkdownFile('test.md');

      expect(result.success).toBe(false);
      expect(result.tasks).toHaveLength(0);
      expect(result.error).toContain('No tasks found');
    });

    it('should handle file read errors', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = parser.parseMarkdownFile('test.md');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('parseMultipleFiles', () => {
    it('should parse multiple files and return map with results', () => {
      const file1Content = '- [ ] Task A\n- [ ] Task B';
      const file2Content = '- [ ] Task C';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (filePath.toString().includes('file1')) return file1Content;
        if (filePath.toString().includes('file2')) return file2Content;
        return '';
      });

      const results = parser.parseMultipleFiles(['/path/file1.md', '/path/file2.md']);

      expect(results.size).toBe(2);
      
      const file1Result = results.get('file1');
      expect(file1Result?.success).toBe(true);
      expect(file1Result?.tasks).toHaveLength(2);

      const file2Result = results.get('file2');
      expect(file2Result?.success).toBe(true);
      expect(file2Result?.tasks).toHaveLength(1);
    });

    it('should handle mixed success and failure results', () => {
      mockFs.existsSync.mockImplementation((filePath) => {
        return !filePath.toString().includes('missing');
      });
      mockFs.readFileSync.mockReturnValue('- [ ] Task');

      const results = parser.parseMultipleFiles([
        '/path/existing.md',
        '/path/missing.md'
      ]);

      expect(results.size).toBe(2);
      
      const existingResult = results.get('existing');
      expect(existingResult?.success).toBe(true);

      const missingResult = results.get('missing');
      expect(missingResult?.success).toBe(false);
      expect(missingResult?.error).toContain('File not found');
    });
  });
});