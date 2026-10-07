import { AxiosInstance } from 'axios';
import { ApprovalRequest } from '../types';
import { logger } from '../logger';

export type CallbackState = 'approved' | 'rejected';

// Github does not write down a limit for the comment on a deployment. 1024 is
// the number the docs give for a status report, so staying under that is safe.
const commentLimit = 1024;

function shorten(comment: string): string {
  if (comment.length <= commentLimit) {
    return comment;
  }

  return comment.substring(0, commentLimit - 3) + '...';
}

export async function sendDecision(
  client: AxiosInstance,
  request: ApprovalRequest,
  state: CallbackState,
  comment: string
): Promise<void> {
  const short = shorten(comment);

  await client.post(request.callbackUrl, {
    environment_name: request.environment,
    state: state,
    comment: short
  });

  logger.info('decision sent to github', {
    state: state,
    environment: request.environment,
    runId: request.runId,
    comment: short
  });
}
