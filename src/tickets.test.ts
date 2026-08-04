import { findTicketReference } from './tickets';

describe('findTicketReference', () => {
  it('finds a jira key in a commit message', () => {
    const sources = [{ label: 'commit message', text: 'OPS-4412 deploy the new worker' }];
    const found = findTicketReference('jira', sources);

    expect(found).not.toBeNull();
    expect(found!.id).toBe('OPS-4412');
    expect(found!.foundIn).toBe('commit message');
  });

  it('finds a servicenow change number', () => {
    const sources = [{ label: 'pull request body', text: 'change CHG0045123 is raised for this' }];
    const found = findTicketReference('servicenow', sources);

    expect(found!.id).toBe('CHG0045123');
  });

  it('does not return a jira key when servicenow is configured', () => {
    const sources = [{ label: 'commit message', text: 'OPS-4412 deploy the new worker' }];

    expect(findTicketReference('servicenow', sources)).toBeNull();
  });

  it('returns the first source that has a match', () => {
    const sources = [
      { label: 'branch name', text: 'feature/no-ticket-here' },
      { label: 'commit message', text: 'PLAT-77 fix the thing' }
    ];

    expect(findTicketReference('local', sources)!.foundIn).toBe('commit message');
  });

  it('returns null when nothing matches', () => {
    const sources = [{ label: 'commit message', text: 'quick fix for the login page' }];

    expect(findTicketReference('jira', sources)).toBeNull();
  });
});
