import axios, { AxiosInstance } from 'axios';
import { ServiceNowConfig } from '../config';
import { parseDate } from '../dates';
import { TicketInfo } from '../types';
import { TicketBackend } from './backend';

// Only the table api is used here. It is on by default on every instance,
// including a free personal developer instance, and change_request is part of
// the base change management.
export class ServiceNowBackend implements TicketBackend {
  name = 'ServiceNow';

  private config: ServiceNowConfig;
  private client: AxiosInstance;

  constructor(config: ServiceNowConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      auth: {
        username: config.username,
        password: config.password
      },
      headers: { Accept: 'application/json' },
      timeout: 15000
    });
  }

  async lookup(ticketId: string): Promise<TicketInfo | null> {
    const response = await this.client.get('/api/now/table/change_request', {
      params: {
        sysparm_query: 'number=' + ticketId,
        sysparm_limit: 1
      }
    });

    const rows = response.data.result || [];

    if (rows.length === 0) {
      return null;
    }

    const change = rows[0];

    return {
      id: change.number,
      approval: 'pending',
      statusText: change.approval,
      windowStart: parseDate(change.start_date),
      windowEnd: parseDate(change.end_date),
      lookedUpAt: this.config.baseUrl + '/nav_to.do?uri=change_request.do?sys_id=' + change.sys_id
    };
  }
}
