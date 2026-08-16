import { AppConfig } from './config';
import { createInstallationClient } from './github/client';
import { collectTextSources } from './github/sources';
import { sendDecision } from './github/callback';
import { findTicketReference } from './tickets';
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

export async function handleProtectionRuleEvent(config: AppConfig, payload: any): Promise<void> {
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
      'No change ticket number was found in the commit message, the pull request or its comments.';

    await sendDecision(client, request, 'rejected', message);
    return;
  }

  logger.info('found a ticket number', {
    ticket: reference.id,
    foundIn: reference.foundIn,
    runId: request.runId
  });

  // the backends are not here yet, for now finding the ticket is enough
  await sendDecision(client, request, 'approved', 'Found ' + reference.id + ' in the ' + reference.foundIn + '.');
}
