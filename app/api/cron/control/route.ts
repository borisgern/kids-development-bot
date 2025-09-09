import { NextRequest, NextResponse } from 'next/server';
import { CronService } from '../../../../src/services/cronService';

// Global cron service instance
let cronService: CronService | null = null;

function getCronService(): CronService {
  if (!cronService) {
    cronService = new CronService();
  }
  return cronService;
}

export async function GET() {
  try {
    const service = getCronService();
    
    const status = {
      jobs: service.getJobsStatus(),
      config: service.getConfig(),
      nextRunTime: service.getNextRunTime().toISOString(),
      currentTime: new Date().toISOString()
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting cron status:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobName } = body;

    const service = getCronService();

    switch (action) {
      case 'start-daily':
        service.startDailyBroadcast();
        return NextResponse.json({ 
          success: true, 
          message: 'Daily broadcast cron job started',
          config: service.getConfig()
        });

      case 'start-test':
        service.startTestCron();
        return NextResponse.json({ 
          success: true, 
          message: 'Test broadcast cron job started (every minute)'
        });

      case 'stop':
        if (jobName) {
          service.stopJob(jobName);
          return NextResponse.json({ 
            success: true, 
            message: `Stopped job: ${jobName}` 
          });
        } else {
          service.stopAllJobs();
          return NextResponse.json({ 
            success: true, 
            message: 'All cron jobs stopped' 
          });
        }

      case 'restart-daily':
        service.stopJob('daily-broadcast');
        service.startDailyBroadcast();
        return NextResponse.json({ 
          success: true, 
          message: 'Daily broadcast cron job restarted',
          config: service.getConfig()
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: start-daily, start-test, stop, restart-daily' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error controlling cron jobs:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}