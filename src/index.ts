import cluster from 'cluster';
import { loadConfig } from './config';
import { createBackend } from './backends';
import { PendingStore } from './pending';
import { createServer } from './server';
import { startScheduler } from './scheduler';
import { logger } from './logger';

const config = loadConfig();

// Several workers share the same port. A deployment that fails or takes long
// only uses up one worker, the other ones keep answering github. If a worker
// dies the primary starts a new one.
function startPrimary(): void {
  const store = new PendingStore(config.stateDir);
  store.prepare();

  logger.info('starting workers', {
    workers: config.workerCount,
    mode: config.backendMode
  });

  for (let number = 0; number < config.workerCount; number++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn('a worker stopped, starting another one', {
      worker: worker.process.pid,
      code: code,
      signal: signal
    });

    cluster.fork();
  });
}

function startWorker(): void {
  const backend = createBackend(config);
  const store = new PendingStore(config.stateDir);
  const app = createServer(config, backend, store);

  app.listen(config.port, () => {
    logger.info('worker is listening', { port: config.port });
  });

  startScheduler(config, backend, store);
}

if (cluster.isPrimary) {
  startPrimary();
} else {
  startWorker();
}
