import { AxiosInstance } from 'axios';
import { logger } from '../logger';

// In the polling mode no event tells us the pull requests of the deployment, so
// we ask which pull requests the commit belongs to.
export async function findPullRequestNumbers(
  client: AxiosInstance,
  owner: string,
  repo: string,
  sha: string
): Promise<number[]> {
  const numbers: number[] = [];

  try {
    const response = await client.get('/repos/' + owner + '/' + repo + '/commits/' + sha + '/pulls', {
      params: { per_page: 20 }
    });

    for (const pullRequest of response.data || []) {
      numbers.push(pullRequest.number);
    }
  } catch (error) {
    logger.warn('could not find the pull requests of a commit', {
      sha: sha,
      error: String(error)
    });
  }

  return numbers;
}
