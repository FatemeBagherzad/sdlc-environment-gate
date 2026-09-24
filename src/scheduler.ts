import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { evaluateRequest } from './evaluate';
import { ClaimedItem, PendingStore } from './pending';
import { logger } from './logger';

async function checkOne(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore,
  claimed: ClaimedItem
): Promise<void> {
  const decision = await evaluateRequest(config, backend, claimed.item.request);

  if (decision.type !== 'wait') {
    store.finish(claimed);
    return;
  }

  claimed.item.lastCheckedAt = new Date().toISOString();
  claimed.item.lastMessage = decision.summary;
  store.putBack(claimed);
}

async function runOnce(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore
): Promise<void> {
  const claimed = store.takeWaitingItems();

  for (const entry of claimed) {
    // one broken deployment must not stop the others, so every one of them is
    // handled on its own
    try {
      await checkOne(config, backend, store, entry);
    } catch (error) {
      logger.error('could not check a waiting deployment', {
        runId: entry.item.request.runId,
        environment: entry.item.request.environment,
        error: String(error)
      });

      store.putBack(entry);
    }
  }
}

export function startScheduler(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore
): void {
  let busy = false;

  setInterval(() => {
    if (busy) {
      return;
    }

    busy = true;

    runOnce(config, backend, store)
      .catch((error) => {
        logger.error('the scheduler run failed', { error: String(error) });
      })
      .then(() => {
        busy = false;
      });
  }, config.recheckIntervalSeconds * 1000);

  logger.info('scheduler started', { every: config.recheckIntervalSeconds });
}
