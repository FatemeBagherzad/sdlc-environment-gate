import { AxiosInstance } from 'axios';
import { GithubConfig } from '../config';
import { createAppClient } from './client';
import { logger } from '../logger';

export interface RepositoryName {
  owner: string;
  repo: string;
}

// The app can be installed in more than one place. We only want the one from
// the configuration, and we need its installation id to get a token. A personal
// account works here too, the login is what is compared.
export async function findOrganizationInstallation(
  config: GithubConfig,
  organization: string
): Promise<number | null> {
  const client = createAppClient(config);
  const wanted = organization.toLowerCase();

  for (let page = 1; page <= 20; page++) {
    const response = await client.get('/app/installations', {
      params: { per_page: 100, page: page }
    });

    const installations = response.data || [];

    for (const installation of installations) {
      const account = installation.account;

      if (account && String(account.login).toLowerCase() === wanted) {
        return installation.id;
      }
    }

    if (installations.length < 100) {
      return null;
    }
  }

  logger.warn('gave up looking through the installations', { organization: organization });

  return null;
}

export async function listInstallationRepositories(
  client: AxiosInstance
): Promise<RepositoryName[]> {
  const repositories: RepositoryName[] = [];

  for (let page = 1; page <= 50; page++) {
    const response = await client.get('/installation/repositories', {
      params: { per_page: 100, page: page }
    });

    const found = response.data.repositories || [];

    for (const repository of found) {
      repositories.push({ owner: repository.owner.login, repo: repository.name });
    }

    if (found.length < 100) {
      break;
    }
  }

  return repositories;
}
