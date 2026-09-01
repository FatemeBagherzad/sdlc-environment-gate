import axios, { AxiosInstance } from 'axios';
import { JiraConfig } from '../config';
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
      params: { fields: 'status' },
      validateStatus: (status) => status === 200 || status === 404
    });

    if (response.status === 404) {
      return null;
    }

    const fields = response.data.fields || {};
    const statusText = fields.status ? fields.status.name : 'unknown';

    return {
      id: response.data.key,
      approval: readApproval(statusText),
      statusText: statusText,
      windowStart: null,
      windowEnd: null,
      lookedUpAt: this.config.baseUrl + '/browse/' + ticketId
    };
  }
}

function readApproval(statusText: string): TicketApproval {
  const status = statusText.toLowerCase();

  if (status === 'rejected' || status === 'cancelled') {
    return 'rejected';
  }

  if (status === 'approved') {
    return 'approved';
  }

  return 'pending';
}
