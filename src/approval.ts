import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { PendingStore } from './pending';
import { evaluateRequest } from './evaluate';
import { ApprovalRequest } from './types';
import { logger } from './logger';

function readRunId(payload: any): number {
  if (payload.workflow_run && payload.workflow_run.id) {
    return payload.workflow_run.id;
  }

  const match = /\/actions\/runs\/(\d+)\//.exec(payload.deployment_callback_url || '');

  if (match) {
    return Number(match[1]);
  }

  return 0;
}

export function buildApprovalRequest(payload: any): ApprovalRequest | null {
  if (!payload.repository || !payload.deployment || !payload.deployment_callback_url) {
    return null;
  }

  const pullRequests: number[] = [];

  for (const pullRequest of payload.pull_requests || []) {
    pullRequests.push(pullRequest.number);
  }

  return {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    environment: payload.environment,
    runId: readRunId(payload),
    installationId: payload.installation.id,
    sha: payload.deployment.sha,
    ref: payload.deployment.ref,
    callbackUrl: payload.deployment_callback_url,
    pullRequests: pullRequests
  };
}

export async function handleProtectionRuleEvent(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore,
  payload: any
): Promise<void> {
  const request = buildApprovalRequest(payload);

  if (!request) {
    logger.warn('the event does not have the fields we need');
    return;
  }

  logger.info('deployment is waiting for us', {
    repo: request.owner + '/' + request.repo,
    environment: request.environment,
    runId: request.runId
  });

  const decision = await evaluateRequest(config, backend, request, new Date());

  if (decision.type !== 'wait') {
    store.remove(request);
    return;
  }

  // nothing is sent to github for a wait, the deployment stays pending there
  // and we keep the ticket so it can be looked at again
  const stamp = new Date().toISOString();

  store.save({
    request: request,
    firstSeenAt: stamp,
    lastCheckedAt: stamp,
    lastMessage: decision.summary
  });
}
