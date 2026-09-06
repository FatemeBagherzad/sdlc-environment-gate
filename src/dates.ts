export function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value.trim());

  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

const dayOnly = /^\d{4}-\d{2}-\d{2}$/;

// A jira due date is only a day, like 2026-09-20, with no time in it. As the end
// of a window that has to mean the end of that day. Reading it as plain midnight
// would close the window before the day even starts.
export function parseWindowEnd(value: string | null | undefined): Date | null {
  if (value && dayOnly.test(value.trim())) {
    return parseDate(value.trim() + 'T23:59:59Z');
  }

  return parseDate(value);
}

export function formatDate(value: Date): string {
  return value.toISOString();
}

export function describeWindow(start: Date | null, end: Date | null): string {
  if (start && end) {
    return 'between ' + formatDate(start) + ' and ' + formatDate(end);
  }

  if (start) {
    return 'starting at ' + formatDate(start);
  }

  if (end) {
    return 'ending at ' + formatDate(end);
  }

  return 'without a time window';
}
