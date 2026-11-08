import { useSync } from '../state/AppContext';

/** Grey placeholder blocks shown while the first load from the sheet is under way. */
export function Skeleton({ rows = 3, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div className="card skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row" aria-hidden="true">
          <span className="sk-line" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
          <span className="sk-line short" />
        </div>
      ))}
    </div>
  );
}

/** Before anything has loaded: placeholders while loading, or a friendly note if the sheet couldn't be reached. */
export function FirstLoad({ label }: { label: string }) {
  const { status, loading } = useSync();
  if (loading || (status.kind !== 'offline' && status.kind !== 'error')) return <Skeleton label={label} />;
  return (
    <p className="notice warn" role="status">
      Couldn't load from your sheet yet. Check your internet connection, then tap <strong>Sync now</strong> on the Account tab.
    </p>
  );
}
