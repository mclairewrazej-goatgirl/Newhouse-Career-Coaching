import { useEffect, useId, useState } from 'react';
import { toDateString } from '../shared/dates';
import { formatMinutes } from '../shared/minutes';
import { coachingSummary, dateRange, longDate, summaryTitle } from '../shared/summary';
import { useSync } from '../state/AppContext';

/**
 * Preview of a client's coaching summary, ready to save as a PDF with the
 * browser's print dialog. Only the .print-doc part is printed.
 */
export function CoachingSummary({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const { data } = useSync();
  const id = useId();
  const [withContacts, setWithContacts] = useState(false);
  const today = toDateString(new Date());
  const summary = data ? coachingSummary(data, clientId) : null;
  const title = summary ? summaryTitle(summary.client.name, today) : '';

  // The saved file is named after the page title.
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = title;
    return () => { document.title = before; };
  }, [title]);

  if (!summary) return null;
  const { client, sessions, mentors } = summary;

  return (
    <>
      <div className="no-print stack-sm">
        <button type="button" className="back" onClick={onBack}>‹ {client.name}</button>
        <h1 className="display page-title">Coaching summary</h1>
        <p className="muted">
          Check it over, then tap <strong>Save as PDF or print</strong>. On an iPhone, tap the share button in the print
          screen and choose <strong>Save to Files</strong>. On a computer, choose <strong>Save as PDF</strong> as the printer.
        </p>
        <label className="check" htmlFor={`${id}-contacts`}>
          <input id={`${id}-contacts`} type="checkbox" checked={withContacts} onChange={(e) => setWithContacts(e.target.checked)} />
          <span>Include mentor contact details</span>
        </label>
        <button type="button" className="btn-primary" onClick={() => window.print()}>Save as PDF or print</button>
      </div>

      <article className="print-doc" aria-label="Summary preview">
        <header className="doc-head">
          <p className="doc-kicker">Coaching summary</p>
          <h1 className="doc-name">{client.name}</h1>
          {client.focus && <p className="doc-focus">{client.focus}</p>}
          <p className="doc-meta">
            {sessions.length ? dateRange(summary.from, summary.to) : 'No sessions yet'}
            {sessions.length > 0 && <> · {sessions.length === 1 ? '1 session' : `${sessions.length} sessions`} · {formatMinutes(summary.totalMin)} in total</>}
          </p>
        </header>

        {sessions.map((s) => (
          <section key={s.sessionId} className="doc-session">
            <h2>{longDate(s.date)} <span className="doc-time">· {formatMinutes(s.actualMin)}</span></h2>
            {s.covered.length > 0 && (
              <>
                <h3>What we covered</h3>
                <ul>{s.covered.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </>
            )}
            {s.nextSteps.length > 0 && (
              <>
                <h3>Next steps</h3>
                <ul>{s.nextSteps.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </>
            )}
            {!s.covered.length && !s.nextSteps.length && <p className="doc-empty">No notes for this session.</p>}
          </section>
        ))}

        {mentors.length > 0 && (
          <section className="doc-session">
            <h2>People to connect with</h2>
            <ul className="doc-people">
              {mentors.map((m) => (
                <li key={m.mentorId}>
                  <strong>{m.name}</strong>
                  {(m.role || m.organization) && <>, {[m.role, m.organization].filter(Boolean).join(', ')}</>}
                  {withContacts && (m.email || m.phone) && (
                    <span className="doc-contact">{[m.email, m.phone].filter(Boolean).join(' · ')}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="doc-foot">Prepared {longDate(today)}</footer>
      </article>
    </>
  );
}
