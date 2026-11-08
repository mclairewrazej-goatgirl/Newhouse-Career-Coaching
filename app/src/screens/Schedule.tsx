import { useEffect, useMemo, useState } from 'react';
import type { Planned } from '../api/types';
import { MonthCalendar } from '../components/MonthCalendar';
import { PlanForm } from '../components/PlanForm';
import { SyncStatus } from '../components/SyncStatus';
import { formatTime, formatWhen, nextBooking } from '../shared/clients';
import { toDateString } from '../shared/dates';
import { formatMinutes } from '../shared/minutes';
import { dayItems, dayMarks, longDayLabel } from '../shared/schedule';
import { useApp, useSync } from '../state/AppContext';
import { useLive } from '../state/live';
import { useNav } from '../state/nav';

interface Props {
  onOpenClient: (clientId: string) => void;
  /** Open the plan form straight away for this client (from a client's page). */
  planFor?: string | null;
  onPlanForHandled?: () => void;
}

type FormState = { mode: 'new'; clientId?: string } | { mode: 'edit'; planned: Planned } | null;

function MeetButton({ link, primary = false }: { link: string; primary?: boolean }) {
  if (!link) return null;
  return (
    <a className={`${primary ? 'btn-primary' : 'btn-secondary'} link-button`} href={link} target="_blank" rel="noopener noreferrer">
      Join Meet
    </a>
  );
}

/** "Open session" for a booking that is running now, "Start session" for one on today. */
function SessionButton({ p, today, liveId, onOpen }: { p: Planned; today: string; liveId: string | null; onOpen: (p: Planned) => void }) {
  if (liveId === p.plannedId) return <button type="button" className="btn-primary" onClick={() => onOpen(p)}>Open session</button>;
  if (p.date !== today) return null;
  return <button type="button" className="btn-primary" onClick={() => onOpen(p)}>Start session</button>;
}

export function Schedule({ onOpenClient, planFor, onPlanForHandled }: Props) {
  const { sync, live: liveStore } = useApp();
  const { data, status, loading } = useSync();
  const nav = useNav();
  const live = useLive(liveStore);
  const now = new Date();
  const today = toDateString(now);
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [form, setForm] = useState<FormState>(planFor != null ? { mode: 'new', clientId: planFor || undefined } : null);

  // The request to plan for a client has been taken into the form; clear it so it isn't reused.
  useEffect(() => {
    if (planFor != null) onPlanForHandled?.();
  }, [planFor, onPlanForHandled]);

  const planned = useMemo(() => data?.planned ?? [], [data]);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const marks = useMemo(() => dayMarks(planned, sessions), [planned, sessions]);
  const next = nextBooking(null, planned, now);
  const items = dayItems(selected, planned, sessions);

  function select(date: string) {
    setSelected(date);
    const [y, m] = date.split('-').map(Number);
    if (y !== view.year || m - 1 !== view.month) setView({ year: y, month: m - 1 });
  }

  function cancelBooking(p: Planned) {
    const ok = window.confirm(`Cancel ${p.clientName}'s session on ${longDayLabel(p.date)} at ${formatTime(p.startTime)}?`);
    if (!ok) return;
    sync.enqueue({ action: 'cancelPlanned', plannedId: p.plannedId });
    setForm(null);
  }

  return (
    <>
      <div className="page-head">
        <h1 className="display page-title">Schedule</h1>
        {!form && (
          <div className="head-actions">
            <button type="button" className="btn-primary" onClick={() => setForm({ mode: 'new' })}>+ Plan a session</button>
            {!live && <button type="button" className="btn-secondary" onClick={() => nav.startNow()}>Start unbooked session</button>}
          </div>
        )}
      </div>
      <SyncStatus status={status} compact />

      {form && (
        <PlanForm
          key={form.mode === 'edit' ? form.planned.plannedId : 'new'}
          clients={data?.clients ?? []}
          booked={planned}
          existing={form.mode === 'edit' ? form.planned : undefined}
          initialClientId={form.mode === 'new' ? form.clientId : undefined}
          initialDate={selected < today ? today : selected}
          onSave={(p) => {
            sync.enqueue({ action: 'upsertPlanned', planned: p });
            setForm(null);
            select(p.date);
          }}
          onCancel={() => setForm(null)}
          onCancelBooking={form.mode === 'edit' ? () => cancelBooking(form.planned) : undefined}
        />
      )}

      {!data && loading && <p className="muted" role="status">Loading your schedule…</p>}

      {data && !form && (
        <section className="card next-card" aria-labelledby="next-up">
          <h2 id="next-up" className="label">Next up</h2>
          {next ? (
            <>
              <p className="next-name display">{next.clientName}</p>
              <p className="ink-2">{formatWhen(next, now)} · {formatMinutes(next.bookedMin)}</p>
              <div className="row">
                <SessionButton p={next} today={today} liveId={live?.plannedId || null} onOpen={nav.openSession} />
                <MeetButton link={next.meetLink} primary={next.date !== today} />
                <button type="button" className="btn-quiet" onClick={() => setForm({ mode: 'edit', planned: next })}>Edit</button>
              </div>
            </>
          ) : (
            <p className="muted">Nothing booked. Tap <strong>+ Plan a session</strong> to book one.</p>
          )}
        </section>
      )}

      {data && (
        <MonthCalendar
          year={view.year} month={view.month} today={today} selected={selected} marks={marks}
          onSelect={select} onMonth={(year, month) => setView({ year, month })}
        />
      )}

      {data && (
        <section className="stack-sm" aria-labelledby="day-heading">
          <h2 id="day-heading" className="display section-title">
            {selected === today ? `Today, ${longDayLabel(selected).split(', ').slice(1).join(', ')}` : longDayLabel(selected)}
          </h2>
          {items.booked.length === 0 && items.logged.length === 0 && (
            <div className="card"><p className="muted">Nothing on this day.</p></div>
          )}
          {items.booked.map((p) => (
            <article key={p.plannedId} className="card day-item">
              <div className="day-item-main">
                <span className="dot dot-booked" aria-hidden="true" />
                <div>
                  <p className="list-title">{p.clientName}</p>
                  <p className="ink-2">{formatTime(p.startTime)} · {formatMinutes(p.bookedMin)}</p>
                </div>
              </div>
              <div className="row">
                <SessionButton p={p} today={today} liveId={live?.plannedId || null} onOpen={nav.openSession} />
                <MeetButton link={p.meetLink} />
                <button type="button" className="btn-quiet" onClick={() => setForm({ mode: 'edit', planned: p })}>Edit</button>
              </div>
            </article>
          ))}
          {items.logged.map((s) => (
            <button key={s.sessionId} type="button" className="card day-item day-item-logged" onClick={() => onOpenClient(s.clientId)}>
              <span className="day-item-main">
                <span className="dot dot-logged" aria-hidden="true" />
                <span>
                  <span className="list-title">{s.clientName}</span>
                  <span className="ink-2 block">Logged · {formatMinutes(s.timed ? s.actualMin : s.bookedMin)}</span>
                </span>
              </span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      )}
    </>
  );
}
