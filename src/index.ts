import { loadConfig } from './config';
import { createBackend } from './backends';
import { createServer } from './server';
import { logger } from './logger';

const config = loadConfig();
const backend = createBackend(config);
const app = createServer(config, backend);

app.listen(config.port, () => {
  logger.info('server started', { port: config.port, mode: config.backendMode });
});
