import { AxiosInstance } from 'axios';
import { AppConfig } from './config';
import { TicketBackend } from './backends/backend';
import { createInstallationClient } from './github/client';
import { findOrganizationInstallation, listInstallationRepositories, RepositoryName } from './github/installations';
import { findWaitingDeployments, WaitingDeployment } from './github/waiting';
import { findPullRequestNumbers } from './github/pulls';
import { evaluateAndRemember } from './evaluate';
import { PendingStore } from './pending';
import { ApprovalRequest } from './types';
import { logger } from './logger';

let knownInstallationId: number | null = null;

async function installationFor(config: AppConfig): Promise<number | null> {
  if (knownInstallationId !== null) {
    return knownInstallationId;
  }

  knownInstallationId = await findOrganizationInstallation(
    config.github,
    config.poll.organization
  );

  if (knownInstallationId === null) {
    logger.error('the app does not seem to be installed on this organisation', {
      organization: config.poll.organization
    });
  }

  return knownInstallationId;
}

function isWanted(config: AppConfig, repository: RepositoryName): boolean {
  if (config.poll.repositories.length === 0) {
    return true;
  }

  return config.poll.repositories.includes(repository.repo.toLowerCase());
}

// The callback url that the webhook gives us is exactly this address, so in the
// polling mode we can build it ourselves.
function callbackUrlFor(config: AppConfig, deployment: WaitingDeployment): string {
  return (
    config.github.apiUrl + '/repos/' + deployment.owner + '/' + deployment.repo +
    '/actions/runs/' + deployment.runId + '/deployment_protection_rule'
  );
}

async function handleOne(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore,
  client: AxiosInstance,
  installationId: number,
  deployment: WaitingDeployment
): Promise<void> {
  const request: ApprovalRequest = {
    owner: deployment.owner,
    repo: deployment.repo,
    environment: deployment.environment,
    runId: deployment.runId,
    installationId: installationId,
    sha: deployment.sha,
    ref: deployment.ref,
    callbackUrl: callbackUrlFor(config, deployment),
    pullRequests: await findPullRequestNumbers(
      client,
      deployment.owner,
      deployment.repo,
      deployment.sha
    )
  };

  // The poller sees the same deployment on every round, so the first time we saw
  // it has to come out of the store. Otherwise MAX_WAIT_MINUTES is never reached
  // and the same comment is written again and again.
  await evaluateAndRemember(config, backend, store, request);
}

async function pollOnce(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore
): Promise<void> {
  const installationId = await installationFor(config);

  if (installationId === null) {
    return;
  }

  const client = await createInstallationClient(config.github, installationId);
  const repositories = await listInstallationRepositories(client);
  let waitingCount = 0;

  for (const repository of repositories) {
    if (!isWanted(config, repository)) {
      continue;
    }

    // a repository with actions turned off answers with an error, and that must
    // not stop the other repositories
    try {
      const waiting = await findWaitingDeployments(client, repository);

      for (const deployment of waiting) {
        waitingCount = waitingCount + 1;

        try {
          await handleOne(config, backend, store, client, installationId, deployment);
        } catch (error) {
          logger.error('could not decide about a waiting deployment', {
            repo: deployment.owner + '/' + deployment.repo,
            runId: deployment.runId,
            environment: deployment.environment,
            error: String(error)
          });
        }
      }
    } catch (error) {
      logger.warn('could not look at a repository', {
        repo: repository.owner + '/' + repository.repo,
        error: String(error)
      });
    }
  }

  logger.debug('poll finished', {
    repositories: repositories.length,
    waiting: waitingCount
  });
}

export function startPoller(
  config: AppConfig,
  backend: TicketBackend,
  store: PendingStore
): void {
  let busy = false;

  setInterval(() => {
    if (busy) {
      return;
    }

    busy = true;

    pollOnce(config, backend, store)
      .catch((error) => {
        logger.error('the poll failed', { error: String(error) });
      })
      .then(() => {
        busy = false;
      });
  }, config.poll.intervalSeconds * 1000);

  logger.info('poller started', {
    organization: config.poll.organization,
    every: config.poll.intervalSeconds
  });
}
