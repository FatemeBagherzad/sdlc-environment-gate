import crypto from 'crypto';
import { verifySignature } from './webhook';

const body = Buffer.from('{"action":"requested"}');

function signWith(secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifySignature', () => {
  it('accepts the signature github would send', () => {
    expect(verifySignature('the-secret', body, signWith('the-secret'))).toBe(true);
  });

  it('refuses a signature made with another secret', () => {
    expect(verifySignature('the-secret', body, signWith('something-else'))).toBe(false);
  });

  it('refuses when there is no signature header at all', () => {
    expect(verifySignature('the-secret', body, undefined)).toBe(false);
  });

  it('refuses a signature that is not even the right length', () => {
    expect(verifySignature('the-secret', body, 'sha256=abc')).toBe(false);
  });
});
