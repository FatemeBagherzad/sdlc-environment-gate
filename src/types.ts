export interface TicketReference {
  id: string;
  foundIn: string;
}

export type TicketApproval = 'approved' | 'rejected' | 'pending';

export interface TicketInfo {
  id: string;
  approval: TicketApproval;
  statusText: string;
  windowStart: Date | null;
  windowEnd: Date | null;
  // human readable place where we looked the ticket up, goes into the message
  lookedUpAt: string;
}

export interface ApprovalRequest {
  owner: string;
  repo: string;
  environment: string;
  runId: number;
  installationId: number;
  sha: string;
  ref: string;
  callbackUrl: string;
  pullRequests: number[];
}

export type DecisionType = 'approve' | 'reject' | 'wait';

export interface Decision {
  type: DecisionType;
  // github only shows a short comment on the deployment, the long version goes
  // to the logs and to the pull request
  summary: string;
  detail: string;
}
