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
