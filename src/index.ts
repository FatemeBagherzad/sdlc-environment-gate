import { loadConfig } from './config';
import { createServer } from './server';
import { logger } from './logger';

const config = loadConfig();
const app = createServer();

app.listen(config.port, () => {
  logger.info('server started', { port: config.port, mode: config.backendMode });
});
