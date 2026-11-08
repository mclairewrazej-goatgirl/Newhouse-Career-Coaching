import { useId, useState, type FormEvent } from 'react';
import type { Mentor, MentorInput } from '../api/types';
import { newId, nowIsoWithOffset } from '../shared/ids';
import { emailHint, phoneHint } from '../shared/mentors';

interface Props {
  existing?: Mentor;
  onSave: (m: MentorInput) => void;
  onCancel: () => void;
}

/** Add or edit a mentor. Only the name is required; email and phone get gentle hints, never blocks. */
export function MentorForm({ existing, onSave, onCancel }: Props) {
  const id = useId();
  const [f, setF] = useState({
    name: existing?.name ?? '', role: existing?.role ?? '', organization: existing?.organization ?? '',
    email: existing?.email ?? '', phone: existing?.phone ?? '', notes: existing?.notes ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) { setError('Enter a name.'); return; }
    onSave({
      mentorId: existing?.mentorId ?? newId('m'),
      name: f.name.trim(), role: f.role.trim(), organization: f.organization.trim(), email: f.email.trim(),
      phone: f.phone.trim(), notes: f.notes.trim(), active: existing?.active ?? true,
      createdAt: existing?.createdAt || nowIsoWithOffset(),
    });
  }

  const eh = emailHint(f.email);
  const ph = phoneHint(f.phone);
  const field = (k: 'role' | 'organization', label: string) => (
    <>
      <label className="field-label" htmlFor={`${id}-${k}`}>{label} <span className="muted">(optional)</span></label>
      <input id={`${id}-${k}`} className="field" value={f[k]} onChange={set(k)} maxLength={200} autoComplete="off" />
    </>
  );

  return (
    <form className="card stack-sm" onSubmit={submit} noValidate aria-label={existing ? 'Edit mentor' : 'Add mentor'}>
      <h2 className="display section-title">{existing ? 'Edit mentor' : 'Add mentor'}</h2>
      <label className="field-label" htmlFor={`${id}-name`}>Name</label>
      <input
        id={`${id}-name`} className="field" value={f.name} onChange={set('name')} maxLength={200} autoComplete="off" autoFocus
        aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
      {field('role', 'Role')}
      {field('organization', 'Organization')}
      <label className="field-label" htmlFor={`${id}-email`}>Email <span className="muted">(optional)</span></label>
      <input id={`${id}-email`} className="field" type="email" inputMode="email" value={f.email} onChange={set('email')}
        maxLength={254} autoComplete="off" aria-describedby={eh ? `${id}-eh` : undefined} />
      {eh && <p id={`${id}-eh`} className="hint">{eh} You can still save it.</p>}
      <label className="field-label" htmlFor={`${id}-phone`}>Phone <span className="muted">(optional)</span></label>
      <input id={`${id}-phone`} className="field" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')}
        maxLength={50} autoComplete="off" aria-describedby={ph ? `${id}-ph` : undefined} />
      {ph && <p id={`${id}-ph`} className="hint">{ph} You can still save it.</p>}
      <label className="field-label" htmlFor={`${id}-notes`}>Notes <span className="muted">(optional)</span></label>
      <textarea id={`${id}-notes`} className="field textarea" value={f.notes} onChange={set('notes')} maxLength={5000} rows={3}
        placeholder="e.g. Prefers email intros" />
      <div className="row">
        <button type="submit" className="btn-primary">{existing ? 'Save changes' : 'Save mentor'}</button>
        <button type="button" className="btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
