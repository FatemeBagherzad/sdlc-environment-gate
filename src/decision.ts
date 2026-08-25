import { describeWindow, formatDate } from './dates';
import { Decision, TicketInfo, TicketReference } from './types';

export interface DecisionInput {
  reference: TicketReference;
  ticket: TicketInfo | null;
  backendName: string;
  now: Date;
}

export function decide(input: DecisionInput): Decision {
  const reference = input.reference;
  const ticket = input.ticket;
  const foundIn = 'was found in the ' + reference.foundIn;
  const now = formatDate(input.now);

  if (!ticket) {
    return {
      type: 'reject',
      summary: 'Change ticket ' + reference.id + ' does not exist in ' + input.backendName + '.',
      detail:
        'Change ticket ' + reference.id + ' ' + foundIn + ', but ' + input.backendName +
        ' does not know this ticket. Create the change ticket first, or put the correct ticket' +
        ' number in the commit message or in the pull request. The deployment is rejected.'
    };
  }

  const window = describeWindow(ticket.windowStart, ticket.windowEnd);
  const state = 'Its state in ' + input.backendName + ' is "' + ticket.statusText + '".';

  if (ticket.approval === 'rejected') {
    return {
      type: 'reject',
      summary: 'Change ticket ' + ticket.id + ' is not approved, its state is "' + ticket.statusText + '".',
      detail:
        'Change ticket ' + ticket.id + ' ' + foundIn + '. ' + state +
        ' That state does not allow a deployment, so the deployment is rejected.' +
        ' Checked at ' + ticket.lookedUpAt + '.'
    };
  }

  if (ticket.approval === 'pending') {
    return {
      type: 'wait',
      summary: 'Waiting for ' + ticket.id + ' to be approved, its state is "' + ticket.statusText + '".',
      detail:
        'Change ticket ' + ticket.id + ' ' + foundIn + '. ' + state +
        ' The ticket is not approved yet, so the deployment stays pending and the ticket is' +
        ' checked again. The approval window is ' + window + '. Checked at ' + ticket.lookedUpAt + '.'
    };
  }

  if (ticket.windowEnd && input.now > ticket.windowEnd) {
    return {
      type: 'reject',
      summary: 'The approval window of ' + ticket.id + ' ended at ' + formatDate(ticket.windowEnd) + '.',
      detail:
        'Change ticket ' + ticket.id + ' ' + foundIn + ' and it is approved, but its approval' +
        ' window ' + window + ' has already ended. The current time is ' + now +
        '. The deployment is rejected, a new change ticket is needed. Checked at ' +
        ticket.lookedUpAt + '.'
    };
  }

  if (ticket.windowStart && input.now < ticket.windowStart) {
    return {
      type: 'wait',
      summary: ticket.id + ' is approved but its window starts at ' + formatDate(ticket.windowStart) + '.',
      detail:
        'Change ticket ' + ticket.id + ' ' + foundIn + ' and it is approved, but the approval' +
        ' window ' + window + ' has not started yet. The current time is ' + now +
        '. The deployment stays pending until the window opens. Checked at ' + ticket.lookedUpAt + '.'
    };
  }

  return {
    type: 'approve',
    summary: ticket.id + ' is approved and the deployment is inside its approval window.',
    detail:
      'Change ticket ' + ticket.id + ' ' + foundIn + '. ' + state +
      ' The current time ' + now + ' is inside the approval window ' + window +
      ', so the deployment is allowed to continue. Checked at ' + ticket.lookedUpAt + '.'
  };
}
