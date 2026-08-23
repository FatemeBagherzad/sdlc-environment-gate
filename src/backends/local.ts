import fs from 'fs';
import path from 'path';
import { LocalConfig } from '../config';
import { parseDate } from '../dates';
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
    const fields = readFields(content);

    return {
      id: ticketId,
      approval: readApproval(content, fields),
      statusText: fields['status'] || readApproval(content, fields),
      windowStart: parseDate(fields['window_start'] || fields['start']),
      windowEnd: parseDate(fields['window_end'] || fields['end']),
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

// a ticket file looks like this:
//   status: approved
//   window_start: 2026-09-01T18:00:00Z
//   window_end: 2026-09-01T22:00:00Z
function readFields(content: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const separator = line.indexOf(':');

    if (separator > 0) {
      const key = line.substring(0, separator).trim().toLowerCase();
      fields[key] = line.substring(separator + 1).trim();
    }
  }

  return fields;
}

function readApproval(content: string, fields: Record<string, string>): TicketApproval {
  // a file with only the word approved in it is also accepted, that is the
  // quickest way to try the app
  const text = (fields['status'] || content).toLowerCase();

  if (text.includes('denied') || text.includes('rejected')) {
    return 'rejected';
  }

  if (text.includes('approved')) {
    return 'approved';
  }

  return 'pending';
}
