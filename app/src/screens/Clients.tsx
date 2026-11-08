import { useMemo, useState } from 'react';
import { ClientForm } from '../components/ClientForm';
import { SyncStatus } from '../components/SyncStatus';
import { clientTotals, formatWhen, nextBooking, sortClients } from '../shared/clients';
import { newId, nowIsoWithOffset } from '../shared/ids';
import { formatMinutes } from '../shared/minutes';
import { useApp, useSync } from '../state/AppContext';
import { ClientDetail } from './ClientDetail';

interface Props {
  openId: string | null;
  onOpen: (clientId: string | null) => void;
  onPlan: (clientId: string) => void;
}

export function Clients({ openId, onOpen, onPlan }: Props) {
  const { sync } = useApp();
  const { data, status, loading } = useSync();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const now = new Date();
  const all = useMemo(() => sortClients(data?.clients ?? []), [data]);
  const active = all.filter((c) => c.active);
  const archived = all.filter((c) => !c.active);

  if (openId && data?.clients.some((c) => c.clientId === openId)) {
    return <ClientDetail clientId={openId} onBack={() => onOpen(null)} onPlan={() => onPlan(openId)} />;
  }

  function add(name: string, focus: string) {
    const clientId = newId('c');
    sync.enqueue({ action: 'upsertClient', client: { clientId, name, focus, active: true, createdAt: nowIsoWithOffset() } });
    setAdding(false);
  }

  const row = (c: (typeof all)[number]) => {
    const totals = clientTotals(c.clientId, data?.sessions ?? []);
    const next = nextBooking(c.clientId, data?.planned ?? [], now);
    return (
      <li key={c.clientId}>
        <button type="button" className="list-button" onClick={() => onOpen(c.clientId)}>
          <span className="list-main">
            <span className="list-title">{c.name}</span>
            {c.focus && <span className="muted">{c.focus}</span>}
            {c.active && (
              <span className="list-meta">
                {next ? `Next: ${formatWhen(next, now)}` : 'No session booked'}
              </span>
            )}
          </span>
          <span className="list-side" aria-label={`${formatMinutes(totals.actualMin)} coached`}>
            {formatMinutes(totals.actualMin)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1 className="display page-title">Clients</h1>
        {!adding && <button type="button" className="btn-primary" onClick={() => setAdding(true)}>+ Add client</button>}
      </div>
      <SyncStatus status={status} compact />

      {adding && <ClientForm submitLabel="Save client" onSave={add} onCancel={() => setAdding(false)} />}

      {!data && loading && <p className="muted" role="status">Loading your clients…</p>}
      {data && active.length === 0 && !adding && (
        <div className="card"><p className="muted">No clients yet. Tap <strong>+ Add client</strong> to add your first.</p></div>
      )}
      {active.length > 0 && <ul className="list card" aria-label="Clients">{active.map(row)}</ul>}

      {archived.length > 0 && (
        <>
          <button type="button" className="btn-quiet" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide archived clients' : `Show archived clients (${archived.length})`}
          </button>
          {showArchived && <ul className="list card" aria-label="Archived clients">{archived.map(row)}</ul>}
        </>
      )}
    </>
  );
}
