import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import { GithubConfig } from '../config';

// the app jwt is only used to ask for an installation token, it is valid for a
// few minutes and github does not accept more than 10
function createAppToken(config: GithubConfig): string {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iat: now - 60,
    exp: now + 540,
    iss: config.appId
  };

  return jwt.sign(payload, config.privateKey, { algorithm: 'RS256' });
}

export async function createInstallationClient(
  config: GithubConfig,
  installationId: number
): Promise<AxiosInstance> {
  const appToken = createAppToken(config);
  const url = config.apiUrl + '/app/installations/' + installationId + '/access_tokens';

  const response = await axios.post(url, {}, {
    headers: {
      Authorization: 'Bearer ' + appToken,
      Accept: 'application/vnd.github+json'
    },
    timeout: 10000
  });

  return axios.create({
    baseURL: config.apiUrl,
    headers: {
      Authorization: 'token ' + response.data.token,
      Accept: 'application/vnd.github+json'
    },
    timeout: 10000
  });
}
