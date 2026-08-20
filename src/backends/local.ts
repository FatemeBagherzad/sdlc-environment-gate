import fs from 'fs';
import path from 'path';
import { LocalConfig } from '../config';
import { TicketApproval, TicketInfo } from '../types';
import { TicketBackend } from './backend';

// the local backend is only there to try the app out without a real jira or
// servicenow, every ticket is a small text file in one folder
export class LocalBackend implements TicketBackend {
  name = 'the local ticket folder';

  private config: LocalConfig;

  constructor(config: LocalConfig) {
    this.config = config;
  }

  async lookup(ticketId: string): Promise<TicketInfo | null> {
    const file = this.findFile(ticketId);

    if (!file) {
      return null;
    }

    const content = fs.readFileSync(file, 'utf8');

    return {
      id: ticketId,
      approval: readApproval(content),
      statusText: readApproval(content),
      windowStart: null,
      windowEnd: null,
      lookedUpAt: file
    };
  }

  private findFile(ticketId: string): string | null {
    const candidates = [ticketId, ticketId + '.txt'];

    for (const candidate of candidates) {
      const full = path.join(this.config.ticketsPath, candidate);

      if (fs.existsSync(full)) {
        return full;
      }
    }

    return null;
  }
}

function readApproval(content: string): TicketApproval {
  const text = content.toLowerCase();

  if (text.includes('denied') || text.includes('rejected')) {
    return 'rejected';
  }

  if (text.includes('approved')) {
    return 'approved';
  }

  return 'pending';
}
