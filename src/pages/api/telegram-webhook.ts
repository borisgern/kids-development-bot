import type { NextApiRequest, NextApiResponse } from 'next';
import { webhookCallback } from 'grammy';
import { bot } from '../../lib/telegram';
import { defaultLogger } from '../../services/loggerService';

const handler = webhookCallback(bot, 'next-js');

export default async function telegramWebhook(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  if (req.method === 'POST') {
    try {
      const startTime = Date.now();
      
      // Log incoming webhook details (but not the full body for privacy)
      defaultLogger.debug('WEBHOOK', 'Incoming telegram webhook', {
        requestId,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content-length']
      });
      
      await handler(req, res);
      
      const duration = Date.now() - startTime;
      defaultLogger.debug('WEBHOOK', 'Webhook processed successfully', { requestId, duration });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      defaultLogger.error('WEBHOOK', 'Telegram webhook error', {
        requestId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      res.status(500).json({ error: 'Internal server error', requestId });
    }
  } else {
    defaultLogger.warn('WEBHOOK', `Invalid method ${req.method} attempted on webhook`, {
      requestId,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
    res.status(405).json({ error: 'Method not allowed', requestId });
  }
}