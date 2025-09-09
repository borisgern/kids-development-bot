import type { NextApiRequest, NextApiResponse } from 'next';
import { webhookCallback } from 'grammy';
import { bot } from '../../lib/telegram';

const handler = webhookCallback(bot, 'next-js');

export default async function telegramWebhook(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Telegram webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}