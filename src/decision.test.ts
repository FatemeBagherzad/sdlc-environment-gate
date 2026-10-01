import { decide } from './decision';
import { TicketInfo, TicketReference } from './types';

const reference: TicketReference = { id: 'CHG0045123', foundIn: 'commit message of a1b2c3d' };

function ticket(values: Partial<TicketInfo>): TicketInfo {
  return {
    id: 'CHG0045123',
    approval: 'approved',
    statusText: 'Approved',
    windowStart: null,
    windowEnd: null,
    lookedUpAt: 'https://dev12345.service-now.com',
    ...values
  };
}

function at(value: string): Date {
  return new Date(value);
}

describe('decide', () => {
  it('rejects when the ticket does not exist', () => {
    const decision = decide({
      reference: reference,
      ticket: null,
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T19:00:00Z')
    });

    expect(decision.type).toBe('reject');
    expect(decision.detail).toContain('does not know this ticket');
  });

  it('approves inside the window', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({
        windowStart: at('2026-09-01T18:00:00Z'),
        windowEnd: at('2026-09-01T22:00:00Z')
      }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T19:00:00Z')
    });

    expect(decision.type).toBe('approve');
  });

  it('approves when the ticket has no window', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({}),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T19:00:00Z')
    });

    expect(decision.type).toBe('approve');
  });

  it('waits when the window did not start yet', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({
        windowStart: at('2026-09-01T18:00:00Z'),
        windowEnd: at('2026-09-01T22:00:00Z')
      }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T09:00:00Z')
    });

    expect(decision.type).toBe('wait');
    expect(decision.detail).toContain('has not started yet');
  });

  it('rejects when the window is over', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({
        windowStart: at('2026-09-01T18:00:00Z'),
        windowEnd: at('2026-09-01T22:00:00Z')
      }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-02T08:00:00Z')
    });

    expect(decision.type).toBe('reject');
    expect(decision.detail).toContain('has already ended');
  });

  it('waits while the ticket is not approved yet', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({
        approval: 'pending',
        statusText: 'Assess',
        windowEnd: at('2026-09-01T22:00:00Z')
      }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T19:00:00Z')
    });

    expect(decision.type).toBe('wait');
  });

  it('rejects a ticket that was never approved and is out of its window', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({
        approval: 'pending',
        statusText: 'Assess',
        windowEnd: at('2026-09-01T22:00:00Z')
      }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-03T19:00:00Z')
    });

    expect(decision.type).toBe('reject');
  });

  it('gives up when it waited longer than it is allowed to', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({ approval: 'pending', statusText: 'Assess' }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 60,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T19:00:00Z')
    });

    expect(decision.type).toBe('reject');
    expect(decision.summary).toContain('Gave up');
  });

  it('rejects a ticket that was turned down', () => {
    const decision = decide({
      reference: reference,
      ticket: ticket({ approval: 'rejected', statusText: 'Rejected' }),
      backendName: 'ServiceNow',
      maxWaitMinutes: 720,
      waitingSince: at('2026-09-01T08:00:00Z'),
      now: at('2026-09-01T19:00:00Z')
    });

    expect(decision.type).toBe('reject');
  });
});
