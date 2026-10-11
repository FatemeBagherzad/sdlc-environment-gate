import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { createInstallationClient } from './github/client';
import { collectTextSources } from './github/sources';
import { sendDecision } from './github/callback';
import { postPullRequestComment } from './github/comment';
import { findTicketReference } from './tickets';
import { decide } from './decision';
import { ApprovalRequest, Decision } from './types';
import { logger } from './logger';

const noTicketFound: Decision = {
  type: 'reject',
  summary: 'No change ticket number was found for this deployment.',
  detail:
    'No change ticket number was found in the commit message, in the title or the description of' +
    ' the pull request, in the comments on the pull request or in the branch name. Add the change' +
    ' ticket number to one of them and run the workflow again. The deployment is rejected.'
};

// Everything that happens for one deployment. The webhook calls it the first
// time and the scheduler calls it again for the deployments that are waiting.
export async function evaluateRequest(
  config: AppConfig,
  backend: TicketBackend,
  request: ApprovalRequest,
  waitingSince: Date,
  lastSummary: string
): Promise<Decision> {
  const client = await createInstallationClient(config.github, request.installationId);
  const sources = await collectTextSources(client, request);
  const reference = findTicketReference(config.backendMode, sources);

  if (!reference) {
    logger.info('no ticket number found', {
      runId: request.runId,
      environment: request.environment
    });

    await sendDecision(client, request, 'rejected', noTicketFound.summary);
    return noTicketFound;
  }

  const ticket = await backend.lookup(reference.id);

  const decision = decide({
    reference: reference,
    ticket: ticket,
    backendName: backend.name,
    now: new Date(),
    waitingSince: waitingSince,
    maxWaitMinutes: config.maxWaitMinutes
  });

  logger.info('decision taken', {
    runId: request.runId,
    environment: request.environment,
    ticket: reference.id,
    foundIn: reference.foundIn,
    decision: decision.type,
    detail: decision.detail
  });

  if (decision.type === 'approve') {
    await sendDecision(client, request, 'approved', decision.summary);
  }

  if (decision.type === 'reject') {
    await sendDecision(client, request, 'rejected', decision.summary);
  }

  // on a wait this runs every minute, so the comment is only written when
  // something actually changed
  if (config.postPullRequestComment && decision.summary !== lastSummary) {
    const body = '**Environment `' + request.environment + '`**\n\n' + decision.detail;

    await postPullRequestComment(client, request, body);
  }

  return decision;
}
