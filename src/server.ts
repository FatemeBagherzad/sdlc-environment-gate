import express from 'express';

export function createServer() {
  const app = express();

  app.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
}
