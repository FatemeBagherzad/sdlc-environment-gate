import axios, { AxiosInstance } from 'axios';
import { JiraConfig } from '../config';
import { parseDate } from '../dates';
import { TicketApproval, TicketInfo } from '../types';
import { TicketBackend } from './backend';

// The approval of a change is the workflow status of the issue. A free Jira
// plan has no approval feature of its own, that one only comes with Jira
// Service Management, so a status called Approved is what we look at.
export class JiraBackend implements TicketBackend {
  name = 'Jira';

  private config: JiraConfig;
  private client: AxiosInstance;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      auth: {
        username: config.email,
        password: config.apiToken
      },
      headers: { Accept: 'application/json' },
      timeout: 15000
    });
  }

  async lookup(ticketId: string): Promise<TicketInfo | null> {
    const response = await this.client.get('/rest/api/3/issue/' + ticketId, {
      params: { fields: this.fieldsToAsk() },
      validateStatus: (status) => status === 200 || status === 404
    });

    if (response.status === 404) {
      return null;
    }

    const fields = response.data.fields || {};
    const statusText = fields.status ? fields.status.name : 'unknown';

    return {
      id: response.data.key,
      approval: this.readApproval(statusText),
      statusText: statusText,
      windowStart: parseDate(readField(fields, this.config.windowStartField)),
      windowEnd: parseDate(readField(fields, this.config.windowEndField)),
      lookedUpAt: this.config.baseUrl + '/browse/' + ticketId
    };
  }

  // asking for only the fields we use keeps the answer small
  private fieldsToAsk(): string {
    const names = ['status'];

    if (this.config.windowStartField) {
      names.push(this.config.windowStartField);
    }

    if (this.config.windowEndField) {
      names.push(this.config.windowEndField);
    }

    return names.join(',');
  }

  // every project names its statuses differently so the names are configuration
  private readApproval(statusText: string): TicketApproval {
    const status = statusText.toLowerCase();

    if (this.config.rejectedStatuses.includes(status)) {
      return 'rejected';
    }

    if (this.config.approvedStatuses.includes(status)) {
      return 'approved';
    }

    return 'pending';
  }
}

// The window fields are configuration because a free Jira has nothing like a
// planned start and planned end. Those belong to the change management of Jira
// Service Management, which is not in the free plan. The due date of the issue
// is there on every plan, so that is the default for the end of the window, and
// the start is empty unless somebody made a date field for it.
function readField(fields: Record<string, any>, name: string): string | null {
  if (!name) {
    return null;
  }

  const value = fields[name];

  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}
