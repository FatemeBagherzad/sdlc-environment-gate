import { buildApprovalRequest } from './approval';

function event(extra: Record<string, unknown> = {}) {
  return {
    action: 'requested',
    environment: 'production',
    deployment_callback_url:
      'https://api.github.com/repos/acme/web/actions/runs/4411/deployment_protection_rule',
    deployment: { sha: 'a1b2c3d4', ref: 'main' },
    repository: { name: 'web', owner: { login: 'acme' } },
    installation: { id: 42 },
    pull_requests: [{ number: 7 }, { number: 9 }],
    ...extra
  };
}

describe('buildApprovalRequest', () => {
  it('reads what we need out of the event', () => {
    const request = buildApprovalRequest(event())!;

    expect(request.owner).toBe('acme');
    expect(request.repo).toBe('web');
    expect(request.environment).toBe('production');
    expect(request.installationId).toBe(42);
    expect(request.sha).toBe('a1b2c3d4');
    expect(request.pullRequests).toEqual([7, 9]);
  });

  it('takes the run id out of the callback url', () => {
    expect(buildApprovalRequest(event())!.runId).toBe(4411);
  });

  it('prefers the run id that is in the event', () => {
    const request = buildApprovalRequest(event({ workflow_run: { id: 8899 } }))!;

    expect(request.runId).toBe(8899);
  });

  it('gives back nothing when the event has no deployment in it', () => {
    expect(buildApprovalRequest({ action: 'requested' })).toBeNull();
  });
});
