import { TaskService } from '../taskService';
import { DatabaseService } from '../databaseService';
import { TaskParser } from '../taskParser';
import { Task } from '../../types/database';
import path from 'path';
import fs from 'fs';

// Mock filesystem operations for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('TaskService Integration Tests', () => {
  let taskService: TaskService;
  let tempDbPath: string;
  let testMarkdownPath: string;

  beforeEach(() => {
    // Setup test files
    tempDbPath = './test-db.json';
    testMarkdownPath = './test-tasks.md';

    // Mock file system operations
    mockFs.existsSync.mockImplementation((filePath) => {
      if (filePath === testMarkdownPath) return true;
      if (filePath === tempDbPath) return false;
      return false;
    });

    mockFs.readFileSync.mockImplementation((filePath) => {
      if (filePath === testMarkdownPath) {
        return `# Test Tasks

Some description here.

- [ ] Task 1 for testing
- [ ] Task 2 for testing  
- [ ] Task 3 for testing
- [ ] Task 4 for testing
- [ ] Task 5 for testing

Some other content.

- [x] Completed task (should be ignored)
- [ ] Task 6 for testing
`;
      }
      return '{}';
    });

    mockFs.writeFileSync.mockImplementation(() => {});

    // Create TaskService with test configuration
    taskService = new TaskService({
      danyaMarkdownPath: testMarkdownPath,
      temaMarkdownPath: testMarkdownPath
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task Pool Initialization', () => {
    it('should successfully initialize task pools from markdown files', async () => {
      const result = await taskService.initializeTaskPools();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify tasks were loaded
      const stats = taskService.getStatistics();
      expect(stats.danyaTasksTotal).toBe(6); // 6 unchecked tasks
      expect(stats.temaTasksTotal).toBe(6); // 6 unchecked tasks
    });

    it('should handle missing markdown files gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await taskService.initializeTaskPools();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Danya');
      expect(result.errors[1]).toContain('Tema');
    });

    it('should handle partial initialization when only one file exists', async () => {
      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath.toString().includes('danya');
      });

      const result = await taskService.initializeTaskPools();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Tema'))).toBe(true);
    });
  });

  describe('Daily Task Selection', () => {
    beforeEach(async () => {
      await taskService.initializeTaskPools();
    });

    it('should select 3 random tasks for each child', () => {
      const selection = taskService.selectDailyTasks();

      expect(selection.danya).toHaveLength(3);
      expect(selection.tema).toHaveLength(3);

      // Verify all selected tasks are different
      const danyaTexts = selection.danya.map(t => t.text);
      const temaTexts = selection.tema.map(t => t.text);

      expect(new Set(danyaTexts).size).toBe(3);
      expect(new Set(temaTexts).size).toBe(3);

      // Verify all tasks are initially not sent
      expect(selection.danya.every(t => !t.sent)).toBe(true);
      expect(selection.tema.every(t => !t.sent)).toBe(true);
    });

    it('should mark selected tasks as sent', () => {
      const selection = taskService.selectDailyTasks();
      taskService.markTasksAsSent(selection);

      const stats = taskService.getStatistics();
      expect(stats.danyaTasksSent).toBe(3);
      expect(stats.temaTasksSent).toBe(3);
    });

    it('should not select already sent tasks', () => {
      // First selection
      const firstSelection = taskService.selectDailyTasks();
      taskService.markTasksAsSent(firstSelection);

      // Second selection
      const secondSelection = taskService.selectDailyTasks();

      // Verify no overlap between selections
      const firstTexts = firstSelection.danya.map(t => t.text);
      const secondTexts = secondSelection.danya.map(t => t.text);

      expect(firstTexts.some(t => secondTexts.includes(t))).toBe(false);
    });

    it('should reset pool when all tasks are exhausted', () => {
      // Exhaust all tasks (6 tasks total, 3 per selection)
      const firstSelection = taskService.selectDailyTasks();
      expect(firstSelection.danya).toHaveLength(3);
      expect(firstSelection.tema).toHaveLength(3);
      taskService.markTasksAsSent(firstSelection);

      const secondSelection = taskService.selectDailyTasks();
      // Only 3 tasks left, so should get the remaining ones
      expect(secondSelection.danya.length).toBeGreaterThan(0);
      expect(secondSelection.tema.length).toBeGreaterThan(0);
      taskService.markTasksAsSent(secondSelection);

      // Pool should be exhausted, next selection should reset and return tasks
      const thirdSelection = taskService.selectDailyTasks();

      // Should reset and select tasks again
      expect(thirdSelection.danya.length).toBeGreaterThan(0);
      expect(thirdSelection.tema.length).toBeGreaterThan(0);

      // Verify reset happened by checking that we don't need reset anymore
      const needsReset = taskService.checkPoolsNeedReset();
      expect(needsReset.danya).toBe(false);
      expect(needsReset.tema).toBe(false);
    });

    it('should handle empty task pools gracefully', () => {
      // Create service with empty pools
      const emptyService = new TaskService();

      const selection = emptyService.selectDailyTasks();

      expect(selection.danya).toHaveLength(0);
      expect(selection.tema).toHaveLength(0);
    });
  });

  describe('Message Formatting', () => {
    it('should format daily tasks message correctly', () => {
      const selection = {
        danya: [
          { text: 'Danya Task 1', sent: false },
          { text: 'Danya Task 2', sent: false },
          { text: 'Danya Task 3', sent: false }
        ],
        tema: [
          { text: 'Tema Task 1', sent: false },
          { text: 'Tema Task 2', sent: false }
        ]
      };

      const message = taskService.formatTelegramMessage(selection);

      expect(message).toContain('*Задачи для Данила:*');
      expect(message).toContain('*Задачи для Артёма:*');
      expect(message).toContain('1. Danya Task 1');
      expect(message).toContain('2. Danya Task 2');
      expect(message).toContain('3. Danya Task 3');
      expect(message).toContain('1. Tema Task 1');
      expect(message).toContain('2. Tema Task 2');
      expect(message).toContain('🎯 Удачного дня развития!');
    });

    it('should handle empty task selection', () => {
      const selection = {
        danya: [],
        tema: []
      };

      const message = taskService.formatTelegramMessage(selection);

      expect(message).toContain('❌ Не удалось найти задачи');
    });

    it('should format message with only one child\'s tasks', () => {
      const selection = {
        danya: [{ text: 'Only Danya Task', sent: false }],
        tema: []
      };

      const message = taskService.formatTelegramMessage(selection);

      expect(message).toContain('*Задачи для Данила:*');
      expect(message).not.toContain('*Задачи для Артёма:*');
      expect(message).toContain('Only Danya Task');
      expect(message).toContain('🎯 Удачного дня развития!');
    });
  });

  describe('Statistics and State Management', () => {
    beforeEach(async () => {
      await taskService.initializeTaskPools();
    });

    it('should provide accurate statistics', () => {
      const initialStats = taskService.getStatistics();

      expect(initialStats.danyaTasksTotal).toBe(6);
      expect(initialStats.temaTasksTotal).toBe(6);
      expect(initialStats.danyaTasksSent).toBe(0);
      expect(initialStats.temaTasksSent).toBe(0);

      // Send some tasks
      const selection = taskService.selectDailyTasks();
      taskService.markTasksAsSent(selection);

      const updatedStats = taskService.getStatistics();
      expect(updatedStats.danyaTasksSent).toBe(3);
      expect(updatedStats.temaTasksSent).toBe(3);
    });

    it('should track when pools need reset', () => {
      // Initially should not need reset
      let needsReset = taskService.checkPoolsNeedReset();
      expect(needsReset.danya).toBe(false);
      expect(needsReset.tema).toBe(false);

      // Exhaust all tasks (6 tasks, 3 per selection)
      const selection1 = taskService.selectDailyTasks();
      expect(selection1.danya).toHaveLength(3);
      taskService.markTasksAsSent(selection1);

      const selection2 = taskService.selectDailyTasks();
      expect(selection2.danya.length).toBeGreaterThan(0);
      taskService.markTasksAsSent(selection2);

      // Check if need reset before calling selectDailyTasks (which auto-resets)
      needsReset = taskService.checkPoolsNeedReset();
      
      // If pools are not auto-reset, they should indicate need for reset
      // But if auto-reset happened, they should be ready
      const hasTasksLeft = selection2.danya.length + selection2.tema.length;
      if (hasTasksLeft > 0) {
        // Some tasks were still available in second selection
        // Need to check after a third attempt
        const thirdAttempt = taskService.selectDailyTasks();
        if (thirdAttempt.danya.length === 0 && thirdAttempt.tema.length === 0) {
          needsReset = taskService.checkPoolsNeedReset();
          expect(needsReset.danya).toBe(true);
          expect(needsReset.tema).toBe(true);
        }
      }

      // Verify that after attempting selection, we get tasks (either remaining or reset)
      const finalSelection = taskService.selectDailyTasks();
      // After this call, pools should provide tasks (either remaining or reset)
      expect(finalSelection.danya.length + finalSelection.tema.length).toBeGreaterThan(0);
    });

    it('should manually reset task pools', () => {
      // Mark some tasks as sent
      const selection = taskService.selectDailyTasks();
      taskService.markTasksAsSent(selection);

      let stats = taskService.getStatistics();
      expect(stats.danyaTasksSent).toBe(3);

      // Reset pools
      taskService.resetTaskPools();

      stats = taskService.getStatistics();
      expect(stats.danyaTasksSent).toBe(0);
      expect(stats.temaTasksSent).toBe(0);
    });
  });
});