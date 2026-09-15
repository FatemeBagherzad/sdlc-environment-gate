import axios, { AxiosInstance } from 'axios';
import { ServiceNowConfig } from '../config';
import { parseDate } from '../dates';
import { TicketApproval, TicketInfo } from '../types';
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
        sysparm_limit: 1,
        sysparm_fields: 'number,sys_id,approval,state,start_date,end_date',
        sysparm_display_value: 'all'
      }
    });

    const rows = response.data.result || [];

    if (rows.length === 0) {
      return null;
    }

    const change = rows[0];
    const approval = readValue(change.approval);
    const state = readValue(change.state);

    return {
      id: readValue(change.number),
      approval: this.readApproval(approval, state),
      statusText: 'approval ' + approval + ', state ' + state,
      windowStart: parseDate(readValue(change.start_date)),
      windowEnd: parseDate(readValue(change.end_date)),
      lookedUpAt:
        this.config.baseUrl + '/nav_to.do?uri=change_request.do?sys_id=' + readValue(change.sys_id)
    };
  }

  // A change is only good to go when the approval is given and the change is
  // not closed or cancelled already. Careful with the spelling, my instance
  // shows Canceled with one l, older ones have two, so both are in the default.
  private readApproval(approval: string, state: string): TicketApproval {
    const currentState = state.toLowerCase();
    const currentApproval = approval.toLowerCase();

    if (this.config.rejectedStates.includes(currentState)) {
      return 'rejected';
    }

    if (currentApproval === 'rejected' || currentApproval === 'not approved') {
      return 'rejected';
    }

    if (currentApproval === 'approved' && this.config.approvedStates.includes(currentState)) {
      return 'approved';
    }

    return 'pending';
  }
}

// with sysparm_display_value=all every field comes back as an object with a
// value and a display_value in it
function readValue(field: any): string {
  if (field === null || field === undefined) {
    return '';
  }

  if (typeof field === 'object') {
    return field.display_value || field.value || '';
  }

  return String(field);
}
