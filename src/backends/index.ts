import { AppConfig } from '../config';
import { TicketBackend } from './backend';
import { LocalBackend } from './local';

export function createBackend(config: AppConfig): TicketBackend {
  if (config.backendMode === 'local') {
    return new LocalBackend(config.local);
  }

  throw new Error('backend mode ' + config.backendMode + ' is not implemented yet');
}
