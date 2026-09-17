import { parseDate, parseWindowEnd, describeWindow } from './dates';

describe('parseDate', () => {
  it('reads an iso date', () => {
    expect(parseDate('2026-09-14T18:00:00Z')!.toISOString()).toBe('2026-09-14T18:00:00.000Z');
  });

  it('treats a servicenow date as utc', () => {
    expect(parseDate('2026-09-14 18:00:00')!.toISOString()).toBe('2026-09-14T18:00:00.000Z');
  });

  it('returns null for an empty value', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it('returns null for something that is not a date', () => {
    expect(parseDate('next tuesday')).toBeNull();
  });
});

describe('parseWindowEnd', () => {
  it('turns a jira due date into the end of that day', () => {
    expect(parseWindowEnd('2026-09-20')!.toISOString()).toBe('2026-09-20T23:59:59.000Z');
  });

  it('leaves a date that already has a time alone', () => {
    expect(parseWindowEnd('2026-09-20T18:30:00Z')!.toISOString()).toBe('2026-09-20T18:30:00.000Z');
  });
});

describe('describeWindow', () => {
  it('says there is no window', () => {
    expect(describeWindow(null, null)).toBe('without a time window');
  });
});
