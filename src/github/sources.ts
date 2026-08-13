import { AxiosInstance } from 'axios';
import { TextSource } from '../tickets';
import { ApprovalRequest } from '../types';
import { logger } from '../logger';

async function readCommitMessage(client: AxiosInstance, request: ApprovalRequest): Promise<string> {
  const path = '/repos/' + request.owner + '/' + request.repo + '/commits/' + request.sha;
  const response = await client.get(path);

  return response.data.commit.message;
}

async function readPullRequestText(
  client: AxiosInstance,
  request: ApprovalRequest,
  number: number
): Promise<TextSource[]> {
  const base = '/repos/' + request.owner + '/' + request.repo;
  const sources: TextSource[] = [];

  const pullRequest = await client.get(base + '/pulls/' + number);

  sources.push({
    label: 'title of pull request #' + number,
    text: pullRequest.data.title || ''
  });

  sources.push({
    label: 'description of pull request #' + number,
    text: pullRequest.data.body || ''
  });

  const comments = await client.get(base + '/issues/' + number + '/comments', {
    params: { per_page: 100 }
  });

  for (const comment of comments.data) {
    sources.push({
      label: 'comment from ' + comment.user.login + ' on pull request #' + number,
      text: comment.body || ''
    });
  }

  return sources;
}

// the order here is the order we search in, the commit message wins over a
// comment someone left on the pull request
export async function collectTextSources(
  client: AxiosInstance,
  request: ApprovalRequest
): Promise<TextSource[]> {
  const sources: TextSource[] = [];

  try {
    sources.push({
      label: 'commit message of ' + request.sha.substring(0, 7),
      text: await readCommitMessage(client, request)
    });
  } catch (error) {
    logger.warn('could not read the commit message', { error: String(error) });
  }

  for (const number of request.pullRequests) {
    try {
      const pullRequestSources = await readPullRequestText(client, request, number);
      sources.push(...pullRequestSources);
    } catch (error) {
      logger.warn('could not read pull request text', { number: number, error: String(error) });
    }
  }

  sources.push({ label: 'branch or tag name', text: request.ref });

  return sources;
}
