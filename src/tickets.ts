import { BackendMode } from './config';
import { TicketReference } from './types';

export interface TextSource {
  label: string;
  text: string;
}

const jiraPattern = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;
const serviceNowPattern = /\bCHG\d{5,}\b/;

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

export function findTicketReference(mode: BackendMode, sources: TextSource[]): TicketReference | null {
  const patterns = patternsFor(mode);

  for (const source of sources) {
    for (const pattern of patterns) {
      const match = pattern.exec(source.text);

      if (match) {
        return { id: match[0], foundIn: source.label };
      }
    }
  }

  return null;
}
