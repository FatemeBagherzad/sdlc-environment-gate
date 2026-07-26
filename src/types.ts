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

// TODO: the decision also needs a short version for the github comment,
// github does not show a long one on the deployment
export interface Decision {
  type: 'approve' | 'reject' | 'wait';
  reason: string;
}
