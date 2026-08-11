import dotenv from 'dotenv';

dotenv.config();

export type BackendMode = 'local' | 'jira' | 'servicenow';

export interface GithubConfig {
  apiUrl: string;
  appId: string;
  privateKey: string;
  webhookSecret: string;
}

export interface AppConfig {
  port: number;
  backendMode: BackendMode;
  github: GithubConfig;
}

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error('missing environment variable ' + name);
  }

  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return value;
}

// the private key is given as base64 because a pem file with newlines in it is
// really annoying to pass through helm values and docker env files
function decodePrivateKey(value: string): string {
  if (value.includes('BEGIN')) {
    return value;
  }

  return Buffer.from(value, 'base64').toString('utf8');
}

function readBackendMode(): BackendMode {
  const value = optional('BACKEND_MODE', 'local').toLowerCase();

  if (value === 'local' || value === 'jira' || value === 'servicenow') {
    return value;
  }

  throw new Error('BACKEND_MODE has to be local, jira or servicenow');
}

export function loadConfig(): AppConfig {
  return {
    port: Number(optional('PORT', '3000')),
    backendMode: readBackendMode(),
    github: {
      apiUrl: optional('GITHUB_API_URL', 'https://api.github.com'),
      appId: required('GITHUB_APP_ID'),
      privateKey: decodePrivateKey(required('GITHUB_PRIVATE_KEY')),
      webhookSecret: required('GITHUB_WEBHOOK_SECRET')
    }
  };
}
