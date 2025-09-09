import { BroadcastService } from '../broadcastService';
import { TaskService } from '../taskService';
import { bot } from '../../lib/telegram';

// Mock dependencies
jest.mock('../../lib/telegram');
jest.mock('../taskService');

const mockBot = bot as jest.Mocked<typeof bot>;
const MockTaskService = TaskService as jest.MockedClass<typeof TaskService>;

describe('BroadcastService Integration Tests', () => {
  let broadcastService: BroadcastService;
  let mockTaskService: jest.Mocked<TaskService>;

  beforeEach(() => {
    // Setup mock TaskService
    mockTaskService = new MockTaskService() as jest.Mocked<TaskService>;

    // Mock TaskService methods
    mockTaskService.initializeTaskPools = jest.fn();
    mockTaskService.selectDailyTasks = jest.fn();
    mockTaskService.markTasksAsSent = jest.fn();
    mockTaskService.formatTelegramMessage = jest.fn();
    mockTaskService.getDatabaseService = jest.fn();

    // Mock bot API
    Object.defineProperty(mockBot, 'api', {
      value: {
        sendMessage: jest.fn()
      },
      writable: true,
      configurable: true
    });

    broadcastService = new BroadcastService(mockTaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Daily Tasks Broadcast', () => {
    beforeEach(() => {
      // Setup default mocks
      mockTaskService.initializeTaskPools.mockResolvedValue({
        success: true,
        errors: []
      });

      mockTaskService.selectDailyTasks.mockReturnValue({
        danya: [
          { text: 'Danya Task 1', sent: false },
          { text: 'Danya Task 2', sent: false }
        ],
        tema: [
          { text: 'Tema Task 1', sent: false }
        ]
      });

      mockTaskService.formatTelegramMessage.mockReturnValue(
        '*Задачи для Данила:*\n1. Danya Task 1\n2. Danya Task 2\n\n*Задачи для Артёма:*\n1. Tema Task 1'
      );

      // Mock database service
      const mockDbService = {
        getSubscribers: jest.fn().mockReturnValue(['123456', '789012'])
      };
      mockTaskService.getDatabaseService.mockReturnValue(mockDbService as any);

      // Mock successful message sending
      (mockBot.api.sendMessage as jest.Mock).mockResolvedValue({});
    });

    it('should successfully broadcast daily tasks to all subscribers', async () => {
      const result = await broadcastService.sendDailyTasks();

      expect(result.success).toBe(true);
      expect(result.totalSubscribers).toBe(2);
      expect(result.successfulDeliveries).toBe(2);
      expect(result.failedDeliveries).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify initialization was called
      expect(mockTaskService.initializeTaskPools).toHaveBeenCalledTimes(1);

      // Verify tasks were selected and marked as sent
      expect(mockTaskService.selectDailyTasks).toHaveBeenCalledTimes(1);
      expect(mockTaskService.markTasksAsSent).toHaveBeenCalledTimes(1);

      // Verify messages were sent
      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining('*Задачи для Данила:*'),
        { parse_mode: 'Markdown' }
      );
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        '789012',
        expect.stringContaining('*Задачи для Данила:*'),
        { parse_mode: 'Markdown' }
      );
    });

    it('should handle no subscribers gracefully', async () => {
      const mockDbService = {
        getSubscribers: jest.fn().mockReturnValue([])
      };
      mockTaskService.getDatabaseService.mockReturnValue(mockDbService as any);

      const result = await broadcastService.sendDailyTasks();

      expect(result.success).toBe(false);
      expect(result.totalSubscribers).toBe(0);
      expect(result.errors).toContain('No subscribers found');
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      expect(mockTaskService.markTasksAsSent).not.toHaveBeenCalled();
    });

    it('should handle no available tasks', async () => {
      mockTaskService.selectDailyTasks.mockReturnValue({
        danya: [],
        tema: []
      });

      const result = await broadcastService.sendDailyTasks();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No tasks available to send');
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      expect(mockTaskService.markTasksAsSent).not.toHaveBeenCalled();
    });

    it('should handle partial delivery failures', async () => {
      // Mock one successful and one failed delivery
      (mockBot.api.sendMessage as jest.Mock)
        .mockResolvedValueOnce({}) // First call succeeds
        .mockRejectedValueOnce(new Error('bot was blocked by the user')); // Second call fails

      const mockDbService = {
        getSubscribers: jest.fn().mockReturnValue(['123456', '789012']),
        removeSubscriber: jest.fn()
      };
      mockTaskService.getDatabaseService.mockReturnValue(mockDbService as any);

      const result = await broadcastService.sendDailyTasks();

      expect(result.success).toBe(true); // Success if at least one delivery worked
      expect(result.totalSubscribers).toBe(2);
      expect(result.successfulDeliveries).toBe(1);
      expect(result.failedDeliveries).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to send to 789012');

      // Should still mark tasks as sent since there was at least one successful delivery
      expect(mockTaskService.markTasksAsSent).toHaveBeenCalledTimes(1);

      // Should remove blocked user
      expect(mockDbService.removeSubscriber).toHaveBeenCalledWith('789012');
    });

    it('should handle initialization errors but continue with available tasks', async () => {
      mockTaskService.initializeTaskPools.mockResolvedValue({
        success: false,
        errors: ['Failed to load Danya tasks']
      });

      // Still return some tasks (maybe from previous initialization)
      mockTaskService.selectDailyTasks.mockReturnValue({
        danya: [],
        tema: [{ text: 'Tema Task 1', sent: false }]
      });

      const result = await broadcastService.sendDailyTasks();

      expect(result.success).toBe(true);
      expect(result.errors).toContain('Failed to load Danya tasks');
      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should not mark tasks as sent if all deliveries failed', async () => {
      (mockBot.api.sendMessage as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await broadcastService.sendDailyTasks();

      expect(result.success).toBe(false);
      expect(result.successfulDeliveries).toBe(0);
      expect(result.failedDeliveries).toBe(2);

      // Should not mark tasks as sent since no deliveries succeeded
      expect(mockTaskService.markTasksAsSent).not.toHaveBeenCalled();
    });
  });

  describe('Custom Message Broadcast', () => {
    beforeEach(() => {
      const mockDbService = {
        getSubscribers: jest.fn().mockReturnValue(['123456'])
      };
      mockTaskService.getDatabaseService.mockReturnValue(mockDbService as any);

      (mockBot.api.sendMessage as jest.Mock).mockResolvedValue({});
    });

    it('should send custom message to all subscribers', async () => {
      const customMessage = 'Test announcement';

      const result = await broadcastService.sendCustomMessage(customMessage);

      expect(result.success).toBe(true);
      expect(result.totalSubscribers).toBe(1);
      expect(result.successfulDeliveries).toBe(1);
      expect(result.failedDeliveries).toBe(0);

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        '123456',
        customMessage,
        { parse_mode: 'Markdown' }
      );
    });
  });

  describe('Error Notifications', () => {
    beforeEach(() => {
      const mockDbService = {
        getSubscribers: jest.fn().mockReturnValue(['123456'])
      };
      mockTaskService.getDatabaseService.mockReturnValue(mockDbService as any);

      (mockBot.api.sendMessage as jest.Mock).mockResolvedValue({});
    });

    it('should send error notification to subscribers', async () => {
      const errorMessage = 'Failed to parse task files';

      const result = await broadcastService.sendErrorNotification(errorMessage);

      expect(result.success).toBe(true);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining('❌ Произошла ошибка'),
        { parse_mode: 'Markdown' }
      );
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining(errorMessage),
        { parse_mode: 'Markdown' }
      );
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      const mockDbService = {
        getSubscribers: jest.fn().mockReturnValue(['123456', '789012', '345678'])
      };
      mockTaskService.getDatabaseService.mockReturnValue(mockDbService as any);

      (mockBot.api.sendMessage as jest.Mock).mockResolvedValue({});
    });

    it('should add delays between messages', async () => {
      const startTime = Date.now();

      await broadcastService.sendCustomMessage('Test message');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 200ms for 3 messages with 100ms delays
      expect(duration).toBeGreaterThan(150);
      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(3);
    });
  });
});