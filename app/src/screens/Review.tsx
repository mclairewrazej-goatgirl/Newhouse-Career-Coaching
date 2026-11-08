import { useState } from 'react';
import { OutcomeToggle } from '../components/OutcomeToggle';
import { FirstLoad } from '../components/Skeleton';
import { SyncStatus } from '../components/SyncStatus';
import { formatDay } from '../shared/clients';
import { STATUS_SHORT } from '../shared/mentors';
import { formatMinutes } from '../shared/minutes';
import { filterSuggestions, periodFor, periodLabel, reviewSummary, type OutcomeFilter, type PeriodKind } from '../shared/review';
import { useSync } from '../state/AppContext';
import { useNav } from '../state/nav';

const FILTERS: { id: OutcomeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'helpful', label: 'Helped' },
  { id: 'not', label: "Didn't help" },
  { id: 'none', label: 'Not rated' },
];

/** Week or month at a glance, and a place to mark which suggestions helped. */
export function Review() {
  const { data, status } = useSync();
  const nav = useNav();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const now = new Date();
  const period = periodFor(kind, now, offset);
  const label = offset === 0 ? (kind === 'week' ? 'This week' : 'This month') : periodLabel(period);

  const choose = (k: PeriodKind) => { setKind(k); setOffset(0); };

  if (!data) {
    return (
      <>
        <h1 className="display page-title">Review</h1>
        <FirstLoad label="Loading your review…" />
      </>
    );
  }

  const r = reviewSummary(data, period);
  const shown = filterSuggestions(r.suggestions, filter);

  return (
    <>
      <h1 className="display page-title">Review</h1>
      <SyncStatus status={status} compact />

      <div className="segmented" role="group" aria-label="Period">
        <button type="button" aria-pressed={kind === 'week'} onClick={() => choose('week')}>Week</button>
        <button type="button" aria-pressed={kind === 'month'} onClick={() => choose('month')}>Month</button>
      </div>

      <div className="period-nav">
        <button type="button" className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label={`Previous ${kind}`}>‹</button>
        <div className="period-label">
          <h2 className="display section-title" aria-live="polite">{label}</h2>
          {offset === 0 && <p className="hint">{periodLabel(period)}</p>}
        </div>
        <button type="button" className="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label={`Next ${kind}`}>›</button>
      </div>

      <div className="stats">
        <div className="stat card">
          <p className="stat-num display">{r.sessions}</p>
          <p className="stat-label">{r.sessions === 1 ? 'session' : 'sessions'}</p>
          <p className="hint">{r.clients === 1 ? '1 client' : `${r.clients} clients`}</p>
        </div>
        <div className="stat card">
          <p className="stat-num display">{formatMinutes(r.minutes)}</p>
          <p className="stat-label">time coached</p>
        </div>
        <div className="stat card">
          <p className="stat-num display">{r.counts.all}</p>
          <p className="stat-label">{r.counts.all === 1 ? 'suggestion given' : 'suggestions given'}</p>
        </div>
        <div className="stat card">
          <p className="stat-num display">{r.links.length}</p>
          <p className="stat-label">{r.links.length === 1 ? 'mentor connection' : 'mentor connections'}</p>
        </div>
      </div>

      <section className="stack-sm" aria-labelledby="sugg-h">
        <h2 id="sugg-h" className="display section-title">Suggestions</h2>
        <div className="chips" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="chip-count">{r.counts[f.id]}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="card">
            <p className="muted">{r.counts.all === 0 ? 'No suggestions in this period.' : 'None match this filter.'}</p>
          </div>
        ) : (
          <ul className="list card">
            {shown.map((g) => (
              <li key={g.suggestionId} className="review-item">
                <p>{g.text}</p>
                <p className="hint">
                  <button type="button" className="link-text" onClick={() => nav.openClient(g.clientId)}>{g.clientName}</button>
                  {' · '}{formatDay(g.date, now)}
                </p>
                <OutcomeToggle suggestion={g} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="links-h">
        <h2 id="links-h" className="display section-title">Mentor connections</h2>
        {r.links.length === 0 ? (
          <div className="card"><p className="muted">No mentor connections in this period.</p></div>
        ) : (
          <ul className="list card">
            {r.links.map((l) => (
              <li key={l.linkId}>
                <button type="button" className="list-button" onClick={() => nav.openMentor(l.mentorId)}>
                  <span className="list-main">
                    <span className="list-title">{l.mentorName} → {l.clientName}</span>
                    <span className="list-meta">
                      <span className={`tag tag-${l.status}`}>{STATUS_SHORT[l.status]}</span> {formatDay(l.date, now)}
                    </span>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
