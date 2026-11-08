import { useState } from 'react';
import type { Client, Session, Suggestion } from '../api/types';
import { ClientForm } from '../components/ClientForm';
import { Columns } from '../components/Columns';
import { MentorConnections } from '../components/MentorConnections';
import { clientSessions, clientTotals, formatDay, formatWhen, nextBooking, sessionSuggestions } from '../shared/clients';
import { toDateString } from '../shared/dates';
import { formatMinutes } from '../shared/minutes';
import { useApp, useSync } from '../state/AppContext';
import { useLive } from '../state/live';
import { CoachingSummary } from './CoachingSummary';
import { useNav } from '../state/nav';

const OUTCOME_LABEL: Record<Suggestion['outcome'], string> = { '': '', helpful: 'Helped', not: "Didn't help" };

function SessionCard({ session, suggestions, now }: { session: Session; suggestions: Suggestion[]; now: Date }) {
  const steps = suggestions.length
    ? suggestions.map((s) => ({ key: s.suggestionId, text: s.text, outcome: s.outcome, done: s.done }))
    : session.nextSteps.map((text, i) => ({ key: String(i), text, outcome: '' as const, done: '' as const }));
  return (
    <article className="card stack-sm session-card">
      <header className="session-head">
        <h3>{formatDay(session.date, now)}</h3>
        <p className="muted">
          Booked {formatMinutes(session.bookedMin)} · {session.timed ? `Actual ${formatMinutes(session.actualMin)}` : 'Not timed'}
        </p>
      </header>
      {session.covered.length > 0 && (
        <div>
          <h4 className="label">What you covered</h4>
          <ul className="bullets">{session.covered.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      {steps.length > 0 && (
        <div>
          <h4 className="label">Next steps</h4>
          <ul className="bullets">
            {steps.map((s) => (
              <li key={s.key}>
                {s.text}
                {s.done && <span className={`tag tag-done-${s.done}`}>{s.done === 'yes' ? 'Done' : 'Not done'}</span>}
                {s.outcome && <span className={`tag tag-${s.outcome}`}>{OUTCOME_LABEL[s.outcome]}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {session.covered.length === 0 && steps.length === 0 && <p className="muted">No notes for this session.</p>}
    </article>
  );
}

export function ClientDetail({ clientId, onBack, onPlan }: { clientId: string; onBack: () => void; onPlan: () => void }) {
  const { sync, live: liveStore } = useApp();
  const { data } = useSync();
  const nav = useNav();
  const live = useLive(liveStore);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(false);
  const client = data?.clients.find((c) => c.clientId === clientId);
  if (!data || !client) return null;
  if (summary) return <CoachingSummary clientId={clientId} onBack={() => { setSummary(false); window.scrollTo(0, 0); }} />;

  const now = new Date();
  const totals = clientTotals(clientId, data.sessions);
  const next = nextBooking(clientId, data.planned, now);
  const sessions = clientSessions(clientId, data.sessions);

  const save = (changes: Partial<Client>) => {
    sync.enqueue({ action: 'upsertClient', client: { ...client, ...changes } });
  };

  function toggleArchive() {
    if (client!.active) {
      const ok = window.confirm(
        `Archive ${client!.name}? They'll be hidden from your lists, but their sessions and notes are kept. You can restore them any time.`,
      );
      if (!ok) return;
    }
    save({ active: !client!.active });
  }

  return (
    <>
      <button type="button" className="back" onClick={onBack}>‹ Clients</button>

      {editing ? (
        <ClientForm
          initialName={client.name} initialFocus={client.focus} submitLabel="Save changes"
          onSave={(name, focus) => { save({ name, focus }); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <header className="stack-sm">
          <h1 className="display page-title">{client.name}</h1>
          {client.focus && <p className="ink-2">{client.focus}</p>}
          {!client.active && <p><span className="tag">Archived</span></p>}
          <div className="row">
            <button type="button" className="btn-quiet" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn-quiet" onClick={() => { setSummary(true); window.scrollTo(0, 0); }}>
              Coaching summary (PDF)
            </button>
            <button type="button" className="btn-quiet" onClick={toggleArchive}>
              {client.active ? 'Archive client' : 'Restore client'}
            </button>
          </div>
        </header>
      )}

      <Columns
        left={<>
      <section className="card total-card" aria-labelledby="total-heading">
        <h2 id="total-heading" className="label">Total time in coaching</h2>
        <p className="big-number display">{formatMinutes(totals.actualMin)}</p>
        <p className="muted">
          {totals.sessions === 1 ? '1 session' : `${totals.sessions} sessions`} · {formatMinutes(totals.bookedMin)} booked
        </p>
      </section>

      {client.active && (
        <section className="card stack-sm" aria-labelledby="next-heading">
          <h2 id="next-heading" className="label">Next session</h2>
          {next ? (
            <>
              <p className="value"><strong>{formatWhen(next, now)}</strong> · {formatMinutes(next.bookedMin)}</p>
              {(live?.plannedId === next.plannedId || (!live && next.date === toDateString(now))) && (
                <button type="button" className="btn-primary link-button" onClick={() => nav.openSession(next)}>
                  {live ? 'Open session' : 'Start session'}
                </button>
              )}
              {next.meetLink && (
                <a className="btn-secondary link-button" href={next.meetLink} target="_blank" rel="noopener noreferrer">
                  Join Google Meet
                </a>
              )}
            </>
          ) : (
            <>
              <p className="muted">Nothing booked yet.</p>
              <button type="button" className="btn-primary link-button" onClick={onPlan}>+ Plan a session</button>
            </>
          )}
          {live?.clientId === clientId && live.plannedId !== next?.plannedId ? (
            <button type="button" className="btn-secondary link-button" onClick={nav.openLive}>Open session in progress</button>
          ) : !live && (
            <button type="button" className="btn-quiet link-button" onClick={() => nav.startNow(clientId)}>Start an unbooked session</button>
          )}
        </section>
      )}

      <MentorConnections clientId={clientId} />

        </>}
        right={<>
      <section className="stack" aria-labelledby="history-heading">
        <h2 id="history-heading" className="display section-title">Sessions</h2>
        {sessions.length === 0 ? (
          <div className="card"><p className="muted">No sessions logged yet.</p></div>
        ) : (
          sessions.map((s) => (
            <SessionCard key={s.sessionId} session={s} suggestions={sessionSuggestions(s, data.suggestions)} now={now} />
          ))
        )}
      </section>
        </>}
      />
    </>
  );
}
