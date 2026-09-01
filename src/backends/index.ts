import { AppConfig } from '../config';
import { TicketBackend } from './backend';
import { LocalBackend } from './local';
import { JiraBackend } from './jira';

export function createBackend(config: AppConfig): TicketBackend {
  if (config.backendMode === 'local') {
    return new LocalBackend(config.local);
  }

  if (config.backendMode === 'jira') {
    return new JiraBackend(config.jira);
  }

  throw new Error('backend mode ' + config.backendMode + ' is not implemented yet');
}
