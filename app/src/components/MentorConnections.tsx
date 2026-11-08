import { useId, useState, type FormEvent } from 'react';
import type { MentorLink, MentorLinkInput, YesNo } from '../api/types';
import { toDateString } from '../shared/dates';
import { formatDay } from '../shared/clients';
import { newId, nowIsoWithOffset } from '../shared/ids';
import { MENTOR_RECENT_DAYS, needsBreak, recentUseCount, STATUS_LABEL, telHref } from '../shared/mentors';
import { useApp, useSync } from '../state/AppContext';
import { useNav } from '../state/nav';
import { YesNoToggle } from './YesNoToggle';

const linkInput = (l: MentorLink): MentorLinkInput => ({
  linkId: l.linkId, mentorId: l.mentorId, clientId: l.clientId, status: l.status, date: l.date, createdAt: l.createdAt,
  contacted: l.contacted ?? '',
});

/** "Made contact" / "No contact yet" tag for lists. Nothing until it's been answered. */
export function ContactTag({ link }: { link: MentorLink }) {
  if (link.contacted === 'yes') return <span className="tag tag-contact-yes">Made contact</span>;
  if (link.contacted === 'no') return <span className="tag tag-contact-no">No contact yet</span>;
  return null;
}

interface Props {
  clientId: string;
  /** On the live screen, connecting is labelled "+ Add mentor connection". */
  live?: boolean;
}

/** A client's mentor connections, with "+ Connect". Shared by the client page and the live session. */
export function MentorConnections({ clientId, live = false }: Props) {
  const { sync } = useApp();
  const { data } = useSync();
  const nav = useNav();
  const id = useId();
  const [connecting, setConnecting] = useState(false);
  const [mentorId, setMentorId] = useState('');
  const [status, setStatus] = useState<MentorLink['status']>('suggested');
  if (!data) return null;

  const now = new Date();
  const today = toDateString(now);
  const links = data.mentorLinks.filter((l) => l.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));
  const mentors = data.mentors.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name));
  const chosen = data.mentors.find((m) => m.mentorId === mentorId);
  const chosenCount = chosen ? recentUseCount(chosen.mentorId, data.mentorLinks, now) : 0;
  const alreadyLinked = links.find((l) => l.mentorId === mentorId);

  function setLinkStatus(l: MentorLink, s: MentorLink['status']) {
    sync.enqueue({ action: 'upsertMentorLink', link: { ...linkInput(l), status: s, date: today } });
  }
  function setContacted(l: MentorLink, contacted: YesNo) {
    // Keeps the date: it records when the connection was made, which drives the "give them a break" count.
    sync.enqueue({ action: 'upsertMentorLink', link: { ...linkInput(l), contacted } });
  }
  function remove(l: MentorLink) {
    if (!window.confirm(`Remove the connection between ${l.mentorName} and ${l.clientName}?`)) return;
    sync.enqueue({ action: 'deleteMentorLink', linkId: l.linkId });
  }
  function connect(e: FormEvent) {
    e.preventDefault();
    if (!mentorId) return;
    sync.enqueue({
      action: 'upsertMentorLink',
      link: {
        linkId: alreadyLinked?.linkId ?? newId('l'), mentorId, clientId, status, date: today,
        createdAt: alreadyLinked?.createdAt || nowIsoWithOffset(), contacted: alreadyLinked?.contacted ?? '',
      },
    });
    setConnecting(false);
    setMentorId('');
    setStatus('suggested');
  }

  return (
    <section className="card stack-sm" aria-labelledby={`${id}-h`}>
      <div className="page-head">
        <h2 id={`${id}-h`} className="display section-title">Mentor connections</h2>
        {!connecting && !live && (
          <button type="button" className="btn-quiet" onClick={() => setConnecting(true)}>+ Connect</button>
        )}
      </div>

      {links.length === 0 && !connecting && <p className="muted">No mentors connected yet.</p>}
      {links.length > 0 && (
        <ul className="conn-list">
          {links.map((l) => {
            const m = data.mentors.find((x) => x.mentorId === l.mentorId);
            return (
              <li key={l.linkId} className="conn">
                <div className="conn-main">
                  <button type="button" className="link-text" onClick={() => nav.openMentor(l.mentorId)}>{l.mentorName}</button>
                  {m && (m.role || m.organization) && <span className="muted">{[m.role, m.organization].filter(Boolean).join(' · ')}</span>}
                  <span className="hint">{formatDay(l.date, now)}</span>
                </div>
                <div className="conn-status">
                  <label className="sr-only" htmlFor={`${id}-${l.linkId}`}>Status for {l.mentorName}</label>
                  <select id={`${id}-${l.linkId}`} className="field compact-field" value={l.status}
                    onChange={(e) => setLinkStatus(l, e.target.value as MentorLink['status'])}>
                    <option value="suggested">{STATUS_LABEL.suggested}</option>
                    <option value="introduced">{STATUS_LABEL.introduced}</option>
                  </select>
                  <button type="button" className="mini-btn" onClick={() => remove(l)} aria-label={`Remove ${l.mentorName}`}>×</button>
                </div>
                <YesNoToggle question="Did they make contact?" value={l.contacted ?? ''} onChange={(v) => setContacted(l, v)} />
                {live && (m?.email || m?.phone) && (
                  <div className="row">
                    {m?.email && <a className="btn-secondary link-button" href={`mailto:${m.email}`}>Email</a>}
                    {m?.phone && <a className="btn-secondary link-button" href={telHref(m.phone)}>Call</a>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {live && !connecting && (
        <button type="button" className="btn-quiet" onClick={() => setConnecting(true)}>+ Add mentor connection</button>
      )}

      {connecting && (
        <form className="stack-sm connect-form" onSubmit={connect}>
          <label className="field-label" htmlFor={`${id}-mentor`}>Mentor</label>
          <select id={`${id}-mentor`} className="field" value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
            <option value="">Choose a mentor…</option>
            {mentors.map((m) => {
              const n = recentUseCount(m.mentorId, data.mentorLinks, now);
              return <option key={m.mentorId} value={m.mentorId}>{m.name}{n ? ` (${n} recent)` : ''}</option>;
            })}
          </select>
          {mentors.length === 0 && <p className="hint">Add mentors on the Mentors tab first.</p>}
          {chosen && needsBreak(chosenCount) && (
            <p className="notice warn" role="alert">
              {chosen.name} has been connected with {chosenCount} clients in the last {MENTOR_RECENT_DAYS} days. Consider giving them a break.
            </p>
          )}
          {chosen?.notes && <p className="mentor-notes">{chosen.notes}</p>}
          {alreadyLinked && <p className="hint">Already connected. Saving will update that connection.</p>}
          <label className="field-label" htmlFor={`${id}-status`}>What did you do?</label>
          <select id={`${id}-status`} className="field" value={status} onChange={(e) => setStatus(e.target.value as MentorLink['status'])}>
            <option value="suggested">{STATUS_LABEL.suggested}</option>
            <option value="introduced">{STATUS_LABEL.introduced}</option>
          </select>
          <div className="row">
            <button type="submit" className="btn-primary" disabled={!mentorId}>Save connection</button>
            <button type="button" className="btn-quiet" onClick={() => setConnecting(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
