import { useState } from 'react';
import { ContactTag } from '../components/MentorConnections';
import { MentorForm } from '../components/MentorForm';
import { formatDay } from '../shared/clients';
import { MENTOR_RECENT_DAYS, mentorConnections, needsBreak, recentUseCount, STATUS_SHORT, telHref, usageLabel } from '../shared/mentors';
import { useApp, useSync } from '../state/AppContext';
import { useNav } from '../state/nav';

export function MentorDetail({ mentorId, onBack }: { mentorId: string; onBack: () => void }) {
  const { sync } = useApp();
  const { data } = useSync();
  const nav = useNav();
  const [editing, setEditing] = useState(false);
  const mentor = data?.mentors.find((m) => m.mentorId === mentorId);
  if (!data || !mentor) return null;

  const now = new Date();
  const n = recentUseCount(mentorId, data.mentorLinks, now);
  const connections = mentorConnections(mentorId, data.mentorLinks, data.clients);

  function toggleArchive() {
    if (mentor!.active && !window.confirm(`Archive ${mentor!.name}? They won't be offered for new connections. You can restore them any time.`)) return;
    sync.enqueue({ action: 'upsertMentor', mentor: { ...mentor!, active: !mentor!.active } });
  }

  return (
    <>
      <button type="button" className="back" onClick={onBack}>‹ Mentors</button>

      {editing ? (
        <MentorForm
          existing={mentor}
          onSave={(m) => { sync.enqueue({ action: 'upsertMentor', mentor: m }); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <header className="stack-sm">
          <h1 className="display page-title">{mentor.name}</h1>
          {(mentor.role || mentor.organization) && (
            <p className="ink-2">{[mentor.role, mentor.organization].filter(Boolean).join(' · ')}</p>
          )}
          {!mentor.active && <p><span className="tag">Archived</span></p>}
          <div className="row">
            <button type="button" className="btn-quiet" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn-quiet" onClick={toggleArchive}>{mentor.active ? 'Archive mentor' : 'Restore mentor'}</button>
          </div>
        </header>
      )}

      {needsBreak(n) && (
        <p className="notice warn">
          {mentor.name} has been connected with {n} clients in the last {MENTOR_RECENT_DAYS} days. Consider giving them a break.
        </p>
      )}

      <section className="card stack-sm" aria-labelledby="contact-h">
        <h2 id="contact-h" className="label">Contact</h2>
        {mentor.email && <a className="contact-row" href={`mailto:${mentor.email}`}><span className="muted">Email</span> {mentor.email}</a>}
        {mentor.phone && <a className="contact-row" href={telHref(mentor.phone)}><span className="muted">Phone</span> {mentor.phone}</a>}
        {!mentor.email && !mentor.phone && <p className="muted">No email or phone saved.</p>}
        {mentor.notes && (
          <>
            <h3 className="label">Notes</h3>
            <p className="mentor-notes">{mentor.notes}</p>
          </>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="conn-h">
        <div className="page-head">
          <h2 id="conn-h" className="display section-title">Connected clients</h2>
          <span className={`usage${needsBreak(n) ? ' usage-warn' : ''}`}>{usageLabel(n)}</span>
        </div>
        {connections.length === 0 ? (
          <div className="card"><p className="muted">Not connected with anyone yet. Connect them from a client's page or during a session.</p></div>
        ) : (
          <ul className="list card">
            {connections.map(({ link, pastClient }) => (
              <li key={link.linkId}>
                <button type="button" className="list-button" onClick={() => nav.openClient(link.clientId)}>
                  <span className="list-main">
                    <span className="list-title">{link.clientName}</span>
                    <span className="list-meta">
                      <span className={`tag tag-${link.status}`}>{STATUS_SHORT[link.status]}</span> {formatDay(link.date, now)}
                      {pastClient && ' · past client'}
                      {' '}<ContactTag link={link} />
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
