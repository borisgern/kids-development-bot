import { NextRequest, NextResponse } from 'next/server';
import { BroadcastService } from '../../../../src/services/broadcastService';

export async function POST(request: NextRequest) {
  try {
    console.log(`[${new Date().toISOString()}] Test broadcast initiated`);

    const broadcastService = new BroadcastService();
    
    // Check if a custom message was provided
    const body = await request.json().catch(() => ({}));
    const { message } = body;
    
    let result;
    if (message) {
      result = await broadcastService.sendCustomMessage(`🧪 **Тестовое сообщение:**\n\n${message}`);
    } else {
      result = await broadcastService.sendDailyTasks();
    }

    const responseData = {
      success: result.success,
      timestamp: new Date().toISOString(),
      totalSubscribers: result.totalSubscribers,
      successfulDeliveries: result.successfulDeliveries,
      failedDeliveries: result.failedDeliveries,
      errors: result.errors,
      statistics: broadcastService.getBroadcastStatistics(),
      messageType: message ? 'custom' : 'daily_tasks'
    };

    console.log(`[${new Date().toISOString()}] Test broadcast completed:`, responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Test broadcast error:`, error);

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      totalSubscribers: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      errors: [errorMessage]
    }, { status: 500 });
  }
}