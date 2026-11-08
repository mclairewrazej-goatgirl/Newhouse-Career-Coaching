import { useEffect, useId, useState, type FormEvent } from 'react';
import type { PlannedInput } from '../api/types';
import { BulletEditor } from '../components/BulletEditor';
import { MentorConnections } from '../components/MentorConnections';
import { OutcomeToggle } from '../components/OutcomeToggle';
import { PlanForm } from '../components/PlanForm';
import { clientSessions, formatDay, formatTime, sessionSuggestions } from '../shared/clients';
import { addDays, toDateString } from '../shared/dates';
import { newId, nowIsoWithOffset } from '../shared/ids';
import { formatMinutes } from '../shared/minutes';
import { LENGTH_CHOICES } from '../shared/schedule';
import { elapsedMinutes, elapsedMs, formatClock, isRunning, pause, progress, reset, start } from '../shared/timer';
import { useApp, useSync } from '../state/AppContext';
import { liveUnplanned, useLive, type LiveSession as Live } from '../state/live';

interface Props {
  /** Client to pre-select when starting an unbooked session. */
  startFor?: string;
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Re-renders once a second while `on`, so the clock moves. The time itself always comes from timestamps. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/** Keeps the screen awake while the timer runs, where the browser allows it. Fails silently. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    type Sentinel = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    let lock: Sentinel | null = null;
    let stopped = false;
    const get = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen').then((l) => { if (stopped) void l.release().catch(() => {}); else lock = l; }).catch(() => {});
    };
    get();
    document.addEventListener('visibilitychange', get);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', get);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}

/** Pick a client and length for a session that wasn't booked. */
function StartForm({ startFor, onStart, onCancel }: { startFor?: string; onStart: (s: Live) => void; onCancel: () => void }) {
  const { data } = useSync();
  const id = useId();
  const [clientId, setClientId] = useState(startFor ?? '');
  const [length, setLength] = useState(60);
  const [error, setError] = useState('');
  const clients = (data?.clients ?? []).filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Choose a client.'); return; }
    onStart(liveUnplanned(clientId, length));
  }

  return (
    <>
      <button type="button" className="back" onClick={onCancel}>‹ Back</button>
      <form className="card stack-sm" onSubmit={submit} noValidate aria-label="Start a session">
        <h1 className="display page-title">Start a session</h1>
        <p className="muted">For a session that wasn't booked. It starts now.</p>
        <label className="field-label" htmlFor={`${id}-client`}>Client</label>
        <select id={`${id}-client`} className="field" value={clientId} onChange={(e) => { setClientId(e.target.value); setError(''); }}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}>
          <option value="">Choose a client…</option>
          {clients.map((c) => <option key={c.clientId} value={c.clientId}>{c.name}</option>)}
        </select>
        {error && <p id={`${id}-err`} className="field-error">{error}</p>}
        <fieldset className="pills-field">
          <legend className="field-label">Booked for</legend>
          <div className="pills">
            {LENGTH_CHOICES.map((m) => (
              <button key={m} type="button" className="pill" aria-pressed={length === m} onClick={() => setLength(m)}>{m} min</button>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <button type="submit" className="btn-primary">Start session</button>
          <button type="button" className="btn-quiet" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </>
  );
}

/** The last logged session: what was covered and the suggestions to check in on. */
function PrepCard({ live }: { live: Live }) {
  const { data } = useSync();
  if (!data) return null;
  const now = new Date();
  const last = clientSessions(live.clientId, data.sessions).find((s) => s.sessionId !== live.sessionId);
  if (!last) {
    return (
      <section className="card prep" aria-labelledby="prep-h">
        <h2 id="prep-h" className="label">Before you start</h2>
        <p>This is your first session together. No earlier notes yet.</p>
      </section>
    );
  }
  const goals = sessionSuggestions(last, data.suggestions);
  return (
    <section className="card prep stack-sm" aria-labelledby="prep-h">
      <h2 id="prep-h" className="label">From last time · {formatDay(last.date, now)}</h2>
      {(goals.length > 0 || last.nextSteps.length > 0) && (
        <div className="stack-sm">
          <h3 className="prep-title">Goals for today</h3>
          {goals.length > 0 ? (
            <ul className="goal-list">
              {goals.map((g) => (
                <li key={g.suggestionId} className="goal">
                  <span>{g.text}</span>
                  <OutcomeToggle suggestion={g} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="bullets">{last.nextSteps.map((t, i) => <li key={i}>{t}</li>)}</ul>
          )}
        </div>
      )}
      {last.covered.length > 0 && (
        <div className="stack-sm">
          <h3 className="prep-title">Last time you covered</h3>
          <ul className="bullets">{last.covered.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function TimerCard({ live }: { live: Live }) {
  const { live: store } = useApp();
  const running = isRunning(live.timer);
  const now = useNow(running);
  useWakeLock(running);
  const ms = elapsedMs(live.timer, now);
  const { fraction, over } = progress(ms, live.bookedMin);
  const setTimer = (fn: (t: Live['timer']) => Live['timer']) => store.update((s) => ({ ...s, timer: fn(s.timer) }));

  return (
    <section className={`card timer${over ? ' over' : ''}`} aria-labelledby="timer-h">
      <h2 id="timer-h" className="sr-only">Timer</h2>
      <p className="timer-clock display" role="timer" aria-live="off">{formatClock(ms)}</p>
      <p className="muted">
        {over ? `Over the booked ${formatMinutes(live.bookedMin)}` : `of ${formatMinutes(live.bookedMin)} booked`}
        {!running && live.timer.everStarted && ' · Paused'}
      </p>
      <div className="progress" role="progressbar" aria-label="Time used" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}>
        <span style={{ width: `${fraction * 100}%` }} />
      </div>
      <div className="row">
        {running ? (
          <button type="button" className="btn-secondary" onClick={() => setTimer((t) => pause(t, Date.now()))}>Pause</button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setTimer((t) => start(t, Date.now()))}>
            {live.timer.everStarted ? 'Resume' : 'Begin'}
          </button>
        )}
        {live.timer.everStarted && (
          <button type="button" className="btn-quiet" onClick={() => {
            if (window.confirm('Reset the timer to zero?')) setTimer(() => reset());
          }}>Reset</button>
        )}
      </div>
    </section>
  );
}

/** The screen used during a session: prep, timer, notes, mentors, then save and book the next one. */
export function LiveSession({ startFor, onClose, onOpenClient }: Props) {
  const { sync, live: store } = useApp();
  const { data } = useSync();
  const live = useLive(store);
  const [booking, setBooking] = useState<{ clientId: string; initial: Partial<PlannedInput> } | null>(null);

  if (booking) {
    const done = () => onOpenClient(booking.clientId);
    return (
      <>
        <p className="notice" role="status">Session saved.</p>
        <PlanForm
          clients={data?.clients ?? []} booked={data?.planned ?? []} initialDate={booking.initial.date ?? toDateString(new Date())}
          initial={booking.initial} title="Book the next session?"
          onSave={(p) => { sync.enqueue({ action: 'upsertPlanned', planned: p }); done(); }}
          onCancel={done}
        />
      </>
    );
  }

  if (!live) return <StartForm startFor={startFor} onStart={(s) => store.set(s)} onCancel={onClose} />;

  const s = live;
  const client = data?.clients.find((c) => c.clientId === s.clientId);
  const name = client?.name ?? 'Client';
  const update = (fn: (x: Live) => Live) => store.update(fn);

  function end() {
    const now = Date.now();
    const timed = s.timer.everStarted;
    const actualMin = timed ? elapsedMinutes(s.timer, now) : s.bookedMin;
    const empty = !s.covered.length && !s.nextSteps.length;
    const msg = empty ? 'You haven’t added any notes. End and save this session anyway?' : `End and save this session with ${name}?`;
    if (!window.confirm(msg)) return;
    sync.enqueue({
      action: 'logSession',
      session: {
        sessionId: s.sessionId, clientId: s.clientId, date: s.date, bookedMin: s.bookedMin, actualMin, timed,
        covered: s.covered, nextSteps: s.nextSteps, plannedId: s.plannedId, createdAt: nowIsoWithOffset(),
      },
      suggestions: s.nextSteps.map((text) => ({ suggestionId: newId('g'), text })),
    });
    store.clear();
    window.scrollTo(0, 0);
    if (client && !client.active) { onOpenClient(s.clientId); return; }
    setBooking({
      clientId: s.clientId,
      initial: {
        clientId: s.clientId, date: toDateString(addDays(parseDate(s.date), 7)), startTime: s.startTime,
        bookedMin: s.bookedMin, meetLink: s.meetLink,
      },
    });
  }

  function discard() {
    if (!window.confirm('Discard this session? The timer and notes will be deleted and nothing is saved to your sheet.')) return;
    store.clear();
    onClose();
  }

  return (
    <>
      <button type="button" className="back" onClick={onClose}>‹ Back (session keeps running)</button>
      <header className="stack-sm">
        <p className="label">Session in progress</p>
        <h1 className="display page-title">{name}</h1>
        <p className="ink-2">
          {formatDay(s.date, new Date())} · {formatTime(s.startTime)} · {formatMinutes(s.bookedMin)} booked
        </p>
        {s.meetLink && (
          <a className="btn-primary link-button" href={s.meetLink} target="_blank" rel="noopener noreferrer">Join Google Meet</a>
        )}
      </header>

      <PrepCard live={s} />
      <TimerCard live={s} />
      <BulletEditor label="What you covered" items={s.covered} onChange={(covered) => update((x) => ({ ...x, covered }))}
        placeholder="e.g. Reviewed CV draft" />
      <BulletEditor label="Next steps" items={s.nextSteps} onChange={(nextSteps) => update((x) => ({ ...x, nextSteps }))}
        placeholder="e.g. Reach out to two contacts" />
      <MentorConnections clientId={s.clientId} live />
      <p className="hint">Your notes are saved on this device as you type. They go to your sheet when you end the session.</p>

      <button type="button" className="btn-primary wide end-btn" onClick={end}>End, save &amp; log</button>
      <button type="button" className="btn-danger" onClick={discard}>Discard session</button>
    </>
  );
}

/** Slim bar above the tabs while a session is running and its screen isn't open. */
export function LiveBar({ live, onOpen }: { live: Live; onOpen: () => void }) {
  const { data } = useSync();
  const running = isRunning(live.timer);
  const now = useNow(running);
  const name = data?.clients.find((c) => c.clientId === live.clientId)?.name ?? 'Client';
  return (
    <button type="button" className="live-bar" onClick={onOpen}>
      <span className={`live-dot${running ? ' on' : ''}`} aria-hidden="true" />
      <span className="live-bar-text">Session in progress · {name}</span>
      <span className="live-bar-clock">{live.timer.everStarted ? formatClock(elapsedMs(live.timer, now)) : 'Not started'}</span>
      <span className="chevron" aria-hidden="true">›</span>
    </button>
  );
}
