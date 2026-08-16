import { AxiosInstance } from 'axios';
import { ApprovalRequest } from '../types';
import { logger } from '../logger';

export type CallbackState = 'approved' | 'rejected';

export async function sendDecision(
  client: AxiosInstance,
  request: ApprovalRequest,
  state: CallbackState,
  comment: string
): Promise<void> {
  await client.post(request.callbackUrl, {
    environment_name: request.environment,
    state: state,
    comment: comment
  });

  logger.info('decision sent to github', {
    state: state,
    environment: request.environment,
    runId: request.runId,
    comment: comment
  });
}
