import { TicketInfo } from '../types';

export interface TicketBackend {
  // used in the messages we send back to github
  name: string;

  lookup(ticketId: string): Promise<TicketInfo | null>;
}
