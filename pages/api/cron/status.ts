import { NextApiRequest, NextApiResponse } from 'next';
import { defaultCronService } from '../../../src/services/cronService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = defaultCronService.getJobsStatus();
    const config = defaultCronService.getConfig();
    const nextRunTime = defaultCronService.getNextRunTime();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      jobs: status,
      config: {
        dailyBroadcastHour: config.dailyBroadcastHour,
        dailyBroadcastMinute: config.dailyBroadcastMinute,
        timezone: config.timezone,
        enableTestCron: config.enableTestCron
      },
      nextRunTime: nextRunTime.toISOString(),
      nextRunTimeFormatted: nextRunTime.toLocaleString('ru-RU', {
        timeZone: config.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[${new Date().toISOString()}] Cron status API error:`, error);

    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: errorMessage
    });
  }
}