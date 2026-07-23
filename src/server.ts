import express from 'express';
import { AppConfig } from './config';
import { createWebhookHandler } from './webhook';

export function createServer(config: AppConfig) {
  const app = express();

  app.use(express.json());

  app.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/webhook', createWebhookHandler(config));

  return app;
}
