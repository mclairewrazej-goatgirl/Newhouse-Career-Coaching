import type { SyncStatus as Status } from '../state/sync';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function syncStatusText(status: Status): string {
  switch (status.kind) {
    case 'synced': return 'Everything is saved to your sheet';
    case 'pending': return `Saving ${plural(status.count, 'change', 'changes')} to your sheet…`;
    case 'offline': return `Offline. ${plural(status.count, 'change is', 'changes are')} waiting and will be sent when you're back online.`;
    case 'error': return status.message;
  }
}

/** One-line sync status. `compact` is for the top of a screen. */
export function SyncStatus({ status, compact = false }: { status: Status; compact?: boolean }) {
  if (compact && status.kind === 'synced') return null;
  return (
    <p className={`sync sync-${status.kind}${compact ? ' compact' : ''}`} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {syncStatusText(status)}
    </p>
  );
}
