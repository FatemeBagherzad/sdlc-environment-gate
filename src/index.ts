import cluster from 'cluster';
import { loadConfig } from './config';
import { createBackend } from './backends';
import { PendingStore } from './pending';
import { createServer } from './server';
import { startScheduler } from './scheduler';
import { startPoller } from './poller';
import { logger } from './logger';

const config = loadConfig();

// Several workers share the same port. A deployment that fails or takes long
// only uses up one worker, the other ones keep answering github. If a worker
// dies the primary starts a new one.
function startPrimary(): void {
  const store = new PendingStore(config.stateDir);
  store.prepare();

  const recovered = store.recover();

  if (recovered > 0) {
    logger.info('deployments picked up from the last run', { count: recovered });
  }

  // Only the primary polls github. It serves no http traffic and there is only
  // one of it, so two workers can never approve the same deployment.
  if (config.discoveryMode !== 'webhook') {
    startPoller(config, createBackend(config), store);
  }

  logger.info('starting workers', {
    workers: config.workerCount,
    mode: config.backendMode,
    discovery: config.discoveryMode
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

    // whatever that worker was holding has to go back to the waiting folder
    store.recover();
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

  // the poller already looks at the waiting deployments again, so in the polling
  // modes the scheduler would only do the same work twice
  if (config.discoveryMode === 'webhook') {
    startScheduler(config, backend, store);
  }
}

if (cluster.isPrimary) {
  startPrimary();
} else {
  startWorker();
}
