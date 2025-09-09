import { NextRequest, NextResponse } from 'next/server';
import { BroadcastService } from '../../../../src/services/broadcastService';

export async function POST(request: NextRequest) {
  try {
    console.log(`[${new Date().toISOString()}] Starting daily tasks broadcast`);

    const broadcastService = new BroadcastService();
    const result = await broadcastService.sendDailyTasks();

    const responseData = {
      success: result.success,
      timestamp: new Date().toISOString(),
      totalSubscribers: result.totalSubscribers,
      successfulDeliveries: result.successfulDeliveries,
      failedDeliveries: result.failedDeliveries,
      errors: result.errors,
      statistics: broadcastService.getBroadcastStatistics()
    };

    console.log(`[${new Date().toISOString()}] Daily tasks broadcast completed:`, responseData);

    if (result.success) {
      return NextResponse.json(responseData);
    } else {
      // Even if broadcast failed, return 200 for cron job (don't retry)
      // but log as error internally
      console.error(`[${new Date().toISOString()}] Daily tasks broadcast failed:`, result.errors);
      return NextResponse.json(responseData);
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
      errors: [errorMessage]
    };

    console.error(`[${new Date().toISOString()}] Daily tasks API error:`, error);

    // Return 200 even on error to prevent cron retries
    return NextResponse.json(responseData);
  }
}