import fs from 'fs';
import path from 'path';
import { ApprovalRequest } from './types';

export interface PendingItem {
  request: ApprovalRequest;
  firstSeenAt: string;
  lastCheckedAt: string;
  lastMessage: string;
}

export interface ClaimedItem {
  fileName: string;
  item: PendingItem;
}

// A deployment that has to wait is written to a file. The files are kept in a
// folder so the workers share them and nothing is lost when one of them is
// restarted.
export class PendingStore {
  private waitingDir: string;
  private workingDir: string;

  constructor(stateDir: string) {
    this.waitingDir = path.join(stateDir, 'waiting');
    this.workingDir = path.join(stateDir, 'working');
  }

  prepare(): void {
    fs.mkdirSync(this.waitingDir, { recursive: true });
    fs.mkdirSync(this.workingDir, { recursive: true });
  }

  save(item: PendingItem): void {
    const fileName = fileNameFor(item.request);
    const target = path.join(this.waitingDir, fileName);

    fs.writeFileSync(target, JSON.stringify(item, null, 2));
  }

  remove(request: ApprovalRequest): void {
    const fileName = fileNameFor(request);

    removeIfThere(path.join(this.waitingDir, fileName));
    removeIfThere(path.join(this.workingDir, fileName));
  }

  // Moving the file is the lock. Only one worker can move a file, so two
  // workers never work on the same deployment at the same time.
  takeWaitingItems(): ClaimedItem[] {
    const claimed: ClaimedItem[] = [];

    for (const fileName of fs.readdirSync(this.waitingDir)) {
      if (!fileName.endsWith('.json')) {
        continue;
      }

      const target = path.join(this.workingDir, fileName);

      try {
        fs.renameSync(path.join(this.waitingDir, fileName), target);
      } catch (error) {
        continue;
      }

      try {
        const item = JSON.parse(fs.readFileSync(target, 'utf8')) as PendingItem;
        claimed.push({ fileName: fileName, item: item });
      } catch (error) {
        removeIfThere(target);
      }
    }

    return claimed;
  }

  putBack(claimed: ClaimedItem): void {
    fs.writeFileSync(
      path.join(this.waitingDir, claimed.fileName),
      JSON.stringify(claimed.item, null, 2)
    );

    removeIfThere(path.join(this.workingDir, claimed.fileName));
  }

  finish(claimed: ClaimedItem): void {
    removeIfThere(path.join(this.workingDir, claimed.fileName));
  }
}

function fileNameFor(request: ApprovalRequest): string {
  const name = [request.owner, request.repo, request.runId, request.environment].join('_');

  return name.replace(/[^a-zA-Z0-9_-]/g, '-') + '.json';
}

function removeIfThere(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch (error) {
    // already gone, nothing to do
  }
}
