import { useApp, useSync } from '../state/AppContext';
import { SyncStatus } from '../components/SyncStatus';

function timeAgo(at: number | null): string {
  if (!at) return 'not yet';
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Phase 3 version: who's signed in, sync status with Sync now, the sheet, and Sign out. */
export function Account() {
  const { sync, email, demo, signOut } = useApp();
  const { data, status, loading, lastSyncedAt, failed } = useSync();

  return (
    <>
      <h1 className="display page-title">Account</h1>
      <section className="card stack">
        <div>
          <p className="label">Signed in as</p>
          <p className="value">{email || '—'}</p>
        </div>
        <div>
          <p className="label">Your sheet</p>
          <p className="value">
            {data?.sheetName || (loading ? 'Checking your sheet…' : '—')}
            {!demo && data?.sheetUrl && (
              <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer">Open my Google Sheet</a>
            )}
          </p>
        </div>
        <div className="stack-sm">
          <p className="label">Saving</p>
          <SyncStatus status={status} />
          <p className="hint">Last loaded from your sheet: {timeAgo(lastSyncedAt)}</p>
          {failed.length > 0 && (
            <div className="notice warn">
              <p>
                {failed.length === 1 ? "One change couldn't be saved" : `${failed.length} changes couldn't be saved`} and
                {' '}{failed.length === 1 ? 'was' : 'were'} undone on this device.
              </p>
              <button type="button" className="btn-quiet" onClick={() => sync.dismissFailed()}>OK</button>
            </div>
          )}
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => void sync.refresh()}>
            {loading ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        <button type="button" className="btn-secondary wide" onClick={() => void signOut()}>Sign out</button>
      </section>
    </>
  );
}
