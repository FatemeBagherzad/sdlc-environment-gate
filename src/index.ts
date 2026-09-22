import { loadConfig } from './config';
import { createBackend } from './backends';
import { PendingStore } from './pending';
import { createServer } from './server';
import { startScheduler } from './scheduler';
import { logger } from './logger';

const config = loadConfig();
const backend = createBackend(config);
const store = new PendingStore(config.stateDir);

store.prepare();

const app = createServer(config, backend, store);

app.listen(config.port, () => {
  logger.info('server started', { port: config.port, mode: config.backendMode });
});

startScheduler(config, backend, store);
