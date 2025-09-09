import { NextApiRequest, NextApiResponse } from 'next';
import { defaultLogger } from '../../src/services/loggerService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const lines = parseInt(req.query.lines as string) || 100;
    const level = req.query.level as string;
    const component = req.query.component as string;

    let logs = defaultLogger.getRecentLogs(lines);

    // Apply filters
    if (level) {
      logs = logs.filter(log => log.level === level.toUpperCase());
    }

    if (component) {
      logs = logs.filter(log => log.component === component.toUpperCase());
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs.reverse(), // Most recent first
      filters: {
        lines,
        level: level || 'all',
        component: component || 'all'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[${new Date().toISOString()}] Logs API error:`, error);

    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: errorMessage
    });
  }
}