import { AxiosInstance } from 'axios';
import { RepositoryName } from './installations';
import { logger } from '../logger';

export interface WaitingDeployment {
  owner: string;
  repo: string;
  runId: number;
  environment: string;
  sha: string;
  ref: string;
}

// A run with the status "waiting" is a run that stopped in front of a
// deployment protection rule. The run itself does not say which environment is
// waiting, that comes from the pending deployments of the run.
export async function findWaitingDeployments(
  client: AxiosInstance,
  repository: RepositoryName
): Promise<WaitingDeployment[]> {
  const base = '/repos/' + repository.owner + '/' + repository.repo;
  const waiting: WaitingDeployment[] = [];

  const runs = await client.get(base + '/actions/runs', {
    params: { status: 'waiting', per_page: 50 }
  });

  for (const run of runs.data.workflow_runs || []) {
    try {
      const pending = await client.get(base + '/actions/runs/' + run.id + '/pending_deployments');

      for (const entry of pending.data || []) {
        if (!entry.environment || !entry.environment.name) {
          continue;
        }

        waiting.push({
          owner: repository.owner,
          repo: repository.repo,
          runId: run.id,
          environment: entry.environment.name,
          sha: run.head_sha,
          ref: run.head_branch || run.head_sha
        });
      }
    } catch (error) {
      logger.warn('could not read the pending deployments of a run', {
        repo: repository.owner + '/' + repository.repo,
        runId: run.id,
        error: String(error)
      });
    }
  }

  return waiting;
}
