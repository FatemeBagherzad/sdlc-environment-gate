import express from 'express';
import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { createWebhookHandler } from './webhook';

export function createServer(config: AppConfig, backend: TicketBackend) {
  const app = express();

  app.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  // the signature is calculated over the exact bytes github sent us, so the
  // body must stay raw here
  app.post('/webhook', express.raw({ type: 'application/json' }), createWebhookHandler(config, backend));

  return app;
}
