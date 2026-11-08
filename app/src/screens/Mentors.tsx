import { useMemo, useState } from 'react';
import { MentorForm } from '../components/MentorForm';
import { FirstLoad } from '../components/Skeleton';
import { SyncStatus } from '../components/SyncStatus';
import { formatDay } from '../shared/clients';
import { latestLink, needsBreak, recentUseCount, STATUS_SHORT, usageLabel } from '../shared/mentors';
import { useApp, useSync } from '../state/AppContext';
import { MentorDetail } from './MentorDetail';

interface Props {
  openId: string | null;
  onOpen: (mentorId: string | null) => void;
}

export function Mentors({ openId, onOpen }: Props) {
  const { sync } = useApp();
  const { data, status } = useSync();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const now = new Date();

  const all = useMemo(() => (data?.mentors ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const active = all.filter((m) => m.active);
  const archived = all.filter((m) => !m.active);

  if (openId && data?.mentors.some((m) => m.mentorId === openId)) {
    return <MentorDetail mentorId={openId} onBack={() => onOpen(null)} />;
  }

  const row = (m: (typeof all)[number]) => {
    const links = data?.mentorLinks ?? [];
    const n = recentUseCount(m.mentorId, links, now);
    const last = latestLink(m.mentorId, links);
    return (
      <li key={m.mentorId}>
        <button type="button" className="list-button" onClick={() => onOpen(m.mentorId)}>
          <span className="list-main">
            <span className="list-title">{m.name}</span>
            {(m.role || m.organization) && <span className="muted">{[m.role, m.organization].filter(Boolean).join(' · ')}</span>}
            {last && (
              <span className="list-meta">
                {STATUS_SHORT[last.status]} to {last.clientName}, {formatDay(last.date, now)}
              </span>
            )}
          </span>
          {m.active && <span className={`usage${needsBreak(n) ? ' usage-warn' : ''}`}>{usageLabel(n)}</span>}
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1 className="display page-title">Mentors</h1>
        {!adding && <button type="button" className="btn-primary" onClick={() => setAdding(true)}>+ Add mentor</button>}
      </div>
      <SyncStatus status={status} compact />

      {adding && (
        <MentorForm
          onSave={(mentor) => { sync.enqueue({ action: 'upsertMentor', mentor }); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}

      {!data && <FirstLoad label="Loading your mentors…" />}
      {data && active.length === 0 && !adding && (
        <div className="card">
          <p className="muted">No mentors yet. Tap <strong>+ Add mentor</strong> to add people you can connect clients with.</p>
        </div>
      )}
      {active.length > 0 && <ul className="list card" aria-label="Mentors">{active.map(row)}</ul>}

      {archived.length > 0 && (
        <>
          <button type="button" className="btn-quiet" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide archived mentors' : `Show archived mentors (${archived.length})`}
          </button>
          {showArchived && <ul className="list card" aria-label="Archived mentors">{archived.map(row)}</ul>}
        </>
      )}
    </>
  );
}
