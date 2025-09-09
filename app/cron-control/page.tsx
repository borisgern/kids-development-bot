'use client';

import { useState, useEffect } from 'react';

interface CronStatus {
  jobs: { [key: string]: boolean };
  config: {
    dailyBroadcastHour?: number;
    dailyBroadcastMinute?: number;
    enableTestCron?: boolean;
    timezone?: string;
  };
  nextRunTime: string;
  currentTime: string;
}

export default function CronControlPage() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/cron/control');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (action: string, jobName?: string) => {
    setActionLoading(action);
    try {
      const response = await fetch('/api/cron/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobName })
      });
      const result = await response.json();
      
      if (result.success) {
        await fetchStatus(); // Refresh status
        alert(result.message);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error executing action:', error);
      alert('Failed to execute action');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const testBroadcast = async () => {
    setActionLoading('test-broadcast');
    try {
      const response = await fetch('/api/test/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Manual test from control panel' })
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`Broadcast sent successfully! ${result.successfulDeliveries}/${result.totalSubscribers} delivered`);
      } else {
        alert(`Broadcast failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error testing broadcast:', error);
      alert('Failed to test broadcast');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!status) {
    return <div className="p-8">Error loading status</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Cron Jobs Control Panel</h1>
      
      {/* Current Status */}
      <div className="bg-gray-100 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Current Time:</strong><br />
            {new Date(status.currentTime).toLocaleString()}
          </div>
          <div>
            <strong>Next Daily Broadcast:</strong><br />
            {new Date(status.nextRunTime).toLocaleString()}
          </div>
          <div>
            <strong>Daily Broadcast Time:</strong><br />
            {status.config.dailyBroadcastHour?.toString().padStart(2, '0')}:
            {status.config.dailyBroadcastMinute?.toString().padStart(2, '0')} 
            ({status.config.timezone})
          </div>
          <div>
            <strong>Test Cron Enabled:</strong><br />
            {status.config.enableTestCron ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      {/* Job Status */}
      <div className="bg-gray-100 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Jobs</h2>
        {Object.keys(status.jobs).length === 0 ? (
          <p className="text-gray-600">No active cron jobs</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(status.jobs).map(([jobName, isRunning]) => (
              <div key={jobName} className="flex items-center justify-between p-3 bg-white rounded border">
                <span className="font-medium">{jobName}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    isRunning ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isRunning ? 'Running' : 'Stopped'}
                  </span>
                  <button
                    onClick={() => executeAction('stop', jobName)}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Daily Broadcast</h2>
          <div className="space-y-2">
            <button
              onClick={() => executeAction('start-daily')}
              disabled={actionLoading !== null}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {actionLoading === 'start-daily' ? 'Starting...' : 'Start Daily Job'}
            </button>
            <button
              onClick={() => executeAction('restart-daily')}
              disabled={actionLoading !== null}
              className="w-full px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
            >
              {actionLoading === 'restart-daily' ? 'Restarting...' : 'Restart Daily Job'}
            </button>
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="space-y-2">
            <button
              onClick={() => executeAction('start-test')}
              disabled={actionLoading !== null}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {actionLoading === 'start-test' ? 'Starting...' : 'Start Test Job (every minute)'}
            </button>
            <button
              onClick={testBroadcast}
              disabled={actionLoading !== null}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              {actionLoading === 'test-broadcast' ? 'Sending...' : 'Send Test Broadcast Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Stop */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-800">Emergency Controls</h2>
        <button
          onClick={() => executeAction('stop')}
          disabled={actionLoading !== null}
          className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {actionLoading === 'stop' ? 'Stopping...' : 'Stop All Jobs'}
        </button>
      </div>

      <div className="mt-8 text-sm text-gray-600">
        <p><strong>Note:</strong> To change the broadcast time, update DAILY_BROADCAST_HOUR and DAILY_BROADCAST_MINUTE in your .env file and restart the daily job.</p>
        <p className="mt-2">Page auto-refreshes every 5 seconds.</p>
      </div>
    </div>
  );
}