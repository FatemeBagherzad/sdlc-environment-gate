import crypto from 'crypto';
import { Request, Response } from 'express';
import { AppConfig } from './config';
import { logger } from './logger';

export function verifySignature(secret: string, body: Buffer, signature: string | undefined): boolean {
  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expected = 'sha256=' + digest;

  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function createWebhookHandler(config: AppConfig) {
  return function handleWebhook(request: Request, response: Response): void {
    const signature = request.header('x-hub-signature-256');
    const rawBody = request.body as Buffer;

    if (!verifySignature(config.github.webhookSecret, rawBody, signature)) {
      logger.warn('webhook signature did not match');
      response.status(401).json({ error: 'bad signature' });
      return;
    }

    const event = request.header('x-github-event');
    const payload = JSON.parse(rawBody.toString('utf8'));

    logger.info('webhook received', { event: event, action: payload.action });

    response.status(204).end();
  };
}
