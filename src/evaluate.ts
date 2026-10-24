import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { PendingStore } from './pending';
import { createInstallationClient } from './github/client';
import { collectTextSources } from './github/sources';
import { sendDecision, sendStatusReport } from './github/callback';
import { postPullRequestComment } from './github/comment';
import { findTicketReference } from './tickets';
import { decide } from './decision';
import { ApprovalRequest, Decision } from './types';
import { logger } from './logger';

// github allows ten status reports on one deployment, leave a few spare
const statusReportLimit = 8;

const noTicketFound: Decision = {
  type: 'reject',
  summary: 'No change ticket number was found for this deployment.',
  detail:
    'No change ticket number was found in the commit message, in the title or the description of' +
    ' the pull request, in the comments on the pull request or in the branch name. Add the change' +
    ' ticket number to one of them and run the workflow again. The deployment is rejected.'
};

export interface EvaluateOptions {
  waitingSince: Date;
  lastSummary: string;
  statusReportsSent: number;
}

export interface EvaluateResult {
  decision: Decision;
  statusReportSent: boolean;
}

// Everything that happens for one deployment. The webhook calls it the first
// time and the scheduler calls it again while a deployment is waiting.
export async function evaluateRequest(
  config: AppConfig,
  backend: TicketBackend,
  request: ApprovalRequest,
  options: EvaluateOptions
): Promise<EvaluateResult> {
  const client = await createInstallationClient(config.github, request.installationId);
  const sources = await collectTextSources(client, request);
  const reference = findTicketReference(config.backendMode, sources);

  if (!reference) {
    logger.info('no ticket number found', {
      runId: request.runId,
      environment: request.environment
    });

    await sendDecision(client, request, 'rejected', noTicketFound.summary);

    return { decision: noTicketFound, statusReportSent: false };
  }

  const ticket = await backend.lookup(reference.id);

  const decision = decide({
    reference: reference,
    ticket: ticket,
    backendName: backend.name,
    now: new Date(),
    waitingSince: options.waitingSince,
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

  // this runs again and again while a deployment waits, so the reason is only
  // written when it actually changed
  const changed = decision.summary !== options.lastSummary;
  let statusReportSent = false;

  if (decision.type === 'wait' && changed && options.statusReportsSent < statusReportLimit) {
    try {
      await sendStatusReport(client, request, decision.detail);
      statusReportSent = true;
    } catch (error) {
      logger.warn('could not send the status report', {
        runId: request.runId,
        error: String(error)
      });
    }
  }

  if (config.postPullRequestComment && changed) {
    const body = '**Environment `' + request.environment + '`**\n\n' + decision.detail;

    await postPullRequestComment(client, request, body);
  }

  return { decision: decision, statusReportSent: statusReportSent };
}

// Used by the webhook and by the poller. The scheduler cannot use it because it
// already holds the file of the deployment.
export async function evaluateAndRemember(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore,
  request: ApprovalRequest
): Promise<Decision> {
  const known = store.read(request);
  const reportsSoFar = known && known.statusReports ? known.statusReports : 0;

  const result = await evaluateRequest(config, backend, request, {
    waitingSince: known ? new Date(known.firstSeenAt) : new Date(),
    lastSummary: known ? known.lastMessage : '',
    statusReportsSent: reportsSoFar
  });

  if (result.decision.type !== 'wait') {
    store.remove(request);
    return result.decision;
  }

  const stamp = new Date().toISOString();

  store.save({
    request: request,
    firstSeenAt: known ? known.firstSeenAt : stamp,
    lastCheckedAt: stamp,
    lastMessage: result.decision.summary,
    statusReports: reportsSoFar + (result.statusReportSent ? 1 : 0)
  });

  return result.decision;
}
