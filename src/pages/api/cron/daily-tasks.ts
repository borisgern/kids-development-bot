import { NextApiRequest, NextApiResponse } from 'next';
import { BroadcastService } from '../../../services/broadcastService';
import { defaultLogger } from '../../../services/loggerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = `cron-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    defaultLogger.warn('CRON_API', `Invalid method ${req.method} attempted`, { requestId, method: req.method });
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  try {
    defaultLogger.info('CRON_API', 'Starting daily tasks broadcast', { requestId });
    const startTime = Date.now();

    const broadcastService = new BroadcastService();
    const result = await broadcastService.sendDailyTasks();
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    const responseData = {
      success: result.success,
      timestamp: new Date().toISOString(),
      totalSubscribers: result.totalSubscribers,
      successfulDeliveries: result.successfulDeliveries,
      failedDeliveries: result.failedDeliveries,
      errors: result.errors,
      statistics: broadcastService.getBroadcastStatistics(),
      requestId,
      duration
    };

    if (result.success) {
      defaultLogger.info('CRON_API', 'Daily tasks broadcast completed successfully', {
        requestId,
        duration,
        totalSubscribers: result.totalSubscribers,
        successfulDeliveries: result.successfulDeliveries,
        failedDeliveries: result.failedDeliveries
      });
      return res.status(200).json(responseData);
    } else {
      // Even if broadcast failed, return 200 for cron job (don't retry)
      // but log as error internally
      defaultLogger.error('CRON_API', 'Daily tasks broadcast failed', {
        requestId,
        duration,
        errors: result.errors,
        totalSubscribers: result.totalSubscribers,
        successfulDeliveries: result.successfulDeliveries,
        failedDeliveries: result.failedDeliveries
      });
      return res.status(200).json(responseData);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const responseData = {
      success: false,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      totalSubscribers: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      errors: [errorMessage],
      requestId
    };

    defaultLogger.error('CRON_API', 'Daily tasks API error', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return 200 even on error to prevent cron retries
    return res.status(200).json(responseData);
  }
}