import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { createInstallationClient } from './github/client';
import { collectTextSources } from './github/sources';
import { sendDecision } from './github/callback';
import { findTicketReference } from './tickets';
import { decide } from './decision';
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

  const client = await createInstallationClient(config.github, request.installationId);
  const sources = await collectTextSources(client, request);
  const reference = findTicketReference(config.backendMode, sources);

  if (!reference) {
    const message =
      'No change ticket number was found in the commit message, in the pull request or in its' +
      ' comments. The deployment is rejected.';

    logger.info('no ticket number found', { runId: request.runId });
    await sendDecision(client, request, 'rejected', message);
    return;
  }

  const ticket = await backend.lookup(reference.id);

  const decision = decide({
    reference: reference,
    ticket: ticket,
    backendName: backend.name,
    now: new Date()
  });

  logger.info('decision taken', {
    runId: request.runId,
    ticket: reference.id,
    decision: decision.type,
    detail: decision.detail
  });

  if (decision.type === 'approve') {
    await sendDecision(client, request, 'approved', decision.summary);
    return;
  }

  if (decision.type === 'reject') {
    await sendDecision(client, request, 'rejected', decision.summary);
    return;
  }

  // nothing to send for a wait, github keeps the deployment pending
}
