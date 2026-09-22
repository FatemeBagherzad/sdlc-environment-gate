import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { createInstallationClient } from './github/client';
import { collectTextSources } from './github/sources';
import { sendDecision } from './github/callback';
import { findTicketReference } from './tickets';
import { decide } from './decision';
import { ClaimedItem, PendingStore } from './pending';
import { logger } from './logger';

async function checkOne(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore,
  claimed: ClaimedItem
): Promise<void> {
  const request = claimed.item.request;
  const client = await createInstallationClient(config.github, request.installationId);
  const sources = await collectTextSources(client, request);
  const reference = findTicketReference(config.backendMode, sources);

  if (!reference) {
    await sendDecision(
      client,
      request,
      'rejected',
      'No change ticket number was found for this deployment.'
    );

    store.finish(claimed);
    return;
  }

  const ticket = await backend.lookup(reference.id);

  const decision = decide({
    reference: reference,
    ticket: ticket,
    backendName: backend.name,
    now: new Date()
  });

  logger.info('waiting deployment checked again', {
    runId: request.runId,
    environment: request.environment,
    ticket: reference.id,
    decision: decision.type,
    detail: decision.detail
  });

  if (decision.type === 'approve') {
    await sendDecision(client, request, 'approved', decision.summary);
    store.finish(claimed);
    return;
  }

  if (decision.type === 'reject') {
    await sendDecision(client, request, 'rejected', decision.summary);
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
