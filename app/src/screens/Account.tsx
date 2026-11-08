import { useApp, useSync } from '../state/AppContext';
import { SyncStatus } from '../components/SyncStatus';

function timeAgo(at: number | null): string {
  if (!at) return 'not yet';
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Who's signed in, saving status with Sync now, the sheet, how it works, and Sign out. */
export function Account() {
  const { sync, email, demo, signOut } = useApp();
  const { data, status, loading, lastSyncedAt, failed } = useSync();
  const waiting = status.kind === 'synced' ? 0 : status.count;

  return (
    <>
      <h1 className="display page-title">Account</h1>
      <section className="card stack" aria-label="Your account">
        <div>
          <p className="label">Signed in as</p>
          <p className="value">{email || '—'}</p>
        </div>
        <div>
          <p className="label">Your sheet</p>
          <p className="value">
            {data?.sheetName || (loading ? 'Checking your sheet…' : '—')}
          </p>
          {!demo && data?.sheetUrl && (
            <a className="btn-secondary link-button" href={data.sheetUrl} target="_blank" rel="noopener noreferrer">
              Open my Google Sheet
            </a>
          )}
        </div>
        <div className="stack-sm">
          <p className="label">Saving</p>
          <SyncStatus status={status} />
          <p className="hint">
            {waiting === 0 ? 'Nothing waiting to be sent.' : `${waiting === 1 ? '1 change' : `${waiting} changes`} waiting to be sent.`}
            {' '}Last loaded from your sheet: {timeAgo(lastSyncedAt)}.
          </p>
          {failed.length > 0 && (
            <div className="notice warn stack-sm">
              <p>
                {failed.length === 1 ? "One change couldn't be saved" : `${failed.length} changes couldn't be saved`} and
                {' '}{failed.length === 1 ? 'was' : 'were'} undone on this device:
              </p>
              <ul className="bullets">{failed.map((f) => <li key={f.seq}>{f.message}</li>)}</ul>
              <button type="button" className="btn-quiet" onClick={() => sync.dismissFailed()}>OK</button>
            </div>
          )}
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => void sync.refresh()}>
            {loading ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        <button type="button" className="btn-secondary wide" onClick={() => void signOut()}>Sign out</button>
      </section>

      <section className="card stack-sm" aria-labelledby="how-h">
        <h2 id="how-h" className="display section-title">How this works</h2>
        <ul className="bullets">
          <li>Your clients, sessions and notes are saved in your own Google Sheet. Nobody else has a copy.</li>
          <li>This app only shows and edits what's in your sheet. You can open the sheet any time to see everything.</li>
          <li>You need your email and password to see anything here.</li>
          <li>This phone keeps a copy so the app works without internet. Changes are sent to your sheet when you're back online.</li>
          <li>On a shared computer, tap <strong>Sign out</strong> when you're done.</li>
        </ul>
        <h3 className="prep-title">Forgot your password?</h3>
        <p>
          Open your Google Sheet on a computer and choose <strong>Coaching Tracker › Change email or password</strong> from the
          menu at the top. You don't need the old password. Afterwards, sign in again on each of your devices.
        </p>
      </section>
    </>
  );
}
