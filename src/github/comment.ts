import { AxiosInstance } from 'axios';
import { ApprovalRequest } from '../types';
import { logger } from '../logger';

// The comment on the deployment itself is short, so the whole explanation is
// written on the pull request where there is room for it.
export async function postPullRequestComment(
  client: AxiosInstance,
  request: ApprovalRequest,
  body: string
): Promise<void> {
  for (const number of request.pullRequests) {
    const path = '/repos/' + request.owner + '/' + request.repo + '/issues/' + number + '/comments';

    try {
      await client.post(path, { body: body });
    } catch (error) {
      logger.warn('could not write the comment on the pull request', {
        number: number,
        error: String(error)
      });
    }
  }
}
