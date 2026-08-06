import { BackendMode } from './config';
import { TicketReference } from './types';

export interface TextSource {
  label: string;
  text: string;
}

const jiraPattern = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;
const serviceNowPattern = /\bCHG\d{5,}\b/g;

// these look exactly like a jira key but they are not, we hit all of them in
// real commit messages
const notJiraKeys = ['UTF-8', 'SHA-1', 'SHA-256', 'ISO-8601', 'RFC-3339', 'HTTP-2', 'BASE-64'];

function patternsFor(mode: BackendMode): RegExp[] {
  if (mode === 'jira') {
    return [jiraPattern];
  }

  if (mode === 'servicenow') {
    return [serviceNowPattern];
  }

  // local mode is only used for testing so it accepts both formats
  return [serviceNowPattern, jiraPattern];
}

function isRealTicket(candidate: string): boolean {
  return !notJiraKeys.includes(candidate.toUpperCase());
}

export function findTicketReference(mode: BackendMode, sources: TextSource[]): TicketReference | null {
  const patterns = patternsFor(mode);

  for (const source of sources) {
    for (const pattern of patterns) {
      const matches = source.text.match(pattern) || [];

      for (const match of matches) {
        if (isRealTicket(match)) {
          return { id: match, foundIn: source.label };
        }
      }
    }
  }

  return null;
}
