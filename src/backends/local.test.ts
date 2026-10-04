import fs from 'fs';
import os from 'os';
import path from 'path';
import { LocalBackend } from './local';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tickets-'));
const backend = new LocalBackend({ ticketsPath: folder });

beforeAll(() => {
  fs.writeFileSync(
    path.join(folder, 'CHG0012345.txt'),
    'status: approved\nwindow_start: 2026-10-04T17:00:00Z\nwindow_end: 2026-10-04T21:00:00Z\n'
  );

  fs.writeFileSync(path.join(folder, 'OPS-99.txt'), 'denied\n');
});

describe('LocalBackend', () => {
  it('reads an approved ticket and its window', async () => {
    const ticket = await backend.lookup('CHG0012345');

    expect(ticket!.approval).toBe('approved');
    expect(ticket!.windowStart!.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(ticket!.windowEnd!.toISOString()).toBe('2026-10-04T21:00:00.000Z');
  });

  it('reads a file that only has one word in it', async () => {
    const ticket = await backend.lookup('OPS-99');

    expect(ticket!.approval).toBe('rejected');
  });

  it('gives back nothing when there is no file', async () => {
    expect(await backend.lookup('CHG0000000')).toBeNull();
  });
});
