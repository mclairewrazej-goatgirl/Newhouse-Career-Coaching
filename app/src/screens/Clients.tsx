import { useId, useState, type FormEvent } from 'react';
import { newId, nowIsoWithOffset } from '../shared/ids';
import { useApp, useSync } from '../state/AppContext';
import { SyncStatus } from '../components/SyncStatus';

/** Phase 3 version: the client list and "+ Add client", enough to see syncing work. Phase 4 builds the rest. */
export function Clients() {
  const { sync } = useApp();
  const { data, status, loading } = useSync();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [error, setError] = useState('');
  const errorId = useId();

  const clients = (data?.clients ?? []).filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    sync.enqueue({
      action: 'upsertClient',
      client: { clientId: newId('c'), name: name.trim(), focus: focus.trim(), active: true, createdAt: nowIsoWithOffset() },
    });
    setName('');
    setFocus('');
    setError('');
    setAdding(false);
  }

  return (
    <>
      <div className="page-head">
        <h1 className="display page-title">Clients</h1>
        {!adding && (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>+ Add client</button>
        )}
      </div>
      <SyncStatus status={status} compact />

      {adding && (
        <form className="card stack-sm" onSubmit={save} noValidate>
          <label className="field-label" htmlFor="client-name">Name</label>
          <input
            id="client-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus
            aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
          />
          {error && <p id={errorId} className="field-error">{error}</p>}
          <label className="field-label" htmlFor="client-focus">Coaching focus <span className="muted">(optional)</span></label>
          <input id="client-focus" className="field" value={focus} onChange={(e) => setFocus(e.target.value)} />
          <div className="row">
            <button type="submit" className="btn-primary">Save client</button>
            <button type="button" className="btn-quiet" onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}

      {!data && loading && <p className="muted" role="status">Loading your clients…</p>}
      {data && clients.length === 0 && !adding && (
        <div className="card"><p className="muted">No clients yet. Tap <strong>+ Add client</strong> to add your first.</p></div>
      )}
      {clients.length > 0 && (
        <ul className="list card">
          {clients.map((c) => (
            <li key={c.clientId}>
              <span className="list-title">{c.name}</span>
              {c.focus && <span className="muted">{c.focus}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
