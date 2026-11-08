import { useId, useState, type FormEvent } from 'react';
import type { Client, Planned, PlannedInput } from '../api/types';
import { isValidDate, isValidTime } from '../shared/connector';
import { newId, nowIsoWithOffset } from '../shared/ids';
import { checkMeetLink, defaultStartTime, LENGTH_CHOICES, parseLength } from '../shared/schedule';

interface Props {
  clients: Client[];
  /** Editing an existing booking, or planning a new one. */
  existing?: Planned;
  initialDate: string;
  initialClientId?: string;
  onSave: (planned: PlannedInput) => void;
  onCancel: () => void;
  /** Cancel the booking itself (only when editing). */
  onCancelBooking?: () => void;
}

export function PlanForm({ clients, existing, initialDate, initialClientId, onSave, onCancel, onCancelBooking }: Props) {
  const id = useId();
  const startLen = existing?.bookedMin ?? 60;
  const [clientId, setClientId] = useState(existing?.clientId ?? initialClientId ?? '');
  const [date, setDate] = useState(existing?.date ?? initialDate);
  const [time, setTime] = useState(existing?.startTime ?? defaultStartTime(new Date()));
  const [length, setLength] = useState<number | 'custom'>(
    (LENGTH_CHOICES as readonly number[]).includes(startLen) ? startLen : 'custom',
  );
  const [custom, setCustom] = useState((LENGTH_CHOICES as readonly number[]).includes(startLen) ? '' : String(startLen));
  const [link, setLink] = useState(existing?.meetLink ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const linkCheck = checkMeetLink(link);
  // Keep the booked client in the list even if they've since been archived.
  const choices = clients.filter((c) => c.active || c.clientId === existing?.clientId);

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!clientId) errs.client = 'Choose a client.';
    if (!isValidDate(date)) errs.date = 'Choose a date.';
    if (!isValidTime(time)) errs.time = 'Choose a start time.';
    const minutes = length === 'custom' ? parseLength(custom) : length;
    if (minutes === null) errs.length = 'Enter the length in whole minutes.';
    if (!linkCheck.ok) errs.link = linkCheck.error;
    setErrors(errs);
    if (Object.keys(errs).length || minutes === null || !linkCheck.ok) return;
    onSave({
      plannedId: existing?.plannedId ?? newId('p'),
      clientId,
      date,
      startTime: time,
      bookedMin: minutes,
      meetLink: linkCheck.value,
      status: existing?.status ?? 'booked',
      createdAt: existing?.createdAt || nowIsoWithOffset(),
    });
  }

  const err = (key: string) =>
    errors[key] ? <p id={`${id}-${key}-err`} className="field-error">{errors[key]}</p> : null;
  const described = (key: string) => (errors[key] ? `${id}-${key}-err` : undefined);

  return (
    <form className="card stack-sm" onSubmit={submit} noValidate aria-label={existing ? 'Edit session' : 'Plan a session'}>
      <h2 className="display section-title">{existing ? 'Edit session' : 'Plan a session'}</h2>

      <label className="field-label" htmlFor={`${id}-client`}>Client</label>
      <select
        id={`${id}-client`} className="field" value={clientId} onChange={(e) => setClientId(e.target.value)}
        aria-invalid={!!errors.client} aria-describedby={described('client')}
      >
        <option value="">Choose a client…</option>
        {choices.map((c) => <option key={c.clientId} value={c.clientId}>{c.name}</option>)}
      </select>
      {err('client')}

      <div className="two-up">
        <div className="stack-xs">
          <label className="field-label" htmlFor={`${id}-date`}>Date</label>
          <input
            id={`${id}-date`} className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.date} aria-describedby={described('date')}
          />
          {err('date')}
        </div>
        <div className="stack-xs">
          <label className="field-label" htmlFor={`${id}-time`}>Start time</label>
          <input
            id={`${id}-time`} className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)}
            aria-invalid={!!errors.time} aria-describedby={described('time')}
          />
          {err('time')}
        </div>
      </div>

      <fieldset className="pills-field">
        <legend className="field-label">Booked for</legend>
        <div className="pills">
          {LENGTH_CHOICES.map((m) => (
            <button
              key={m} type="button" className="pill" aria-pressed={length === m} onClick={() => setLength(m)}
            >
              {m} min
            </button>
          ))}
          <button type="button" className="pill" aria-pressed={length === 'custom'} onClick={() => setLength('custom')}>
            Custom
          </button>
        </div>
        {length === 'custom' && (
          <div className="custom-length">
            <label className="field-label" htmlFor={`${id}-custom`}>Minutes</label>
            <input
              id={`${id}-custom`} className="field" type="number" inputMode="numeric" min={1} max={1440} step={1}
              value={custom} onChange={(e) => setCustom(e.target.value)} autoFocus
              aria-invalid={!!errors.length} aria-describedby={described('length')}
            />
          </div>
        )}
        {err('length')}
      </fieldset>

      <label className="field-label" htmlFor={`${id}-link`}>Google Meet link <span className="muted">(optional)</span></label>
      <input
        id={`${id}-link`} className="field" type="url" inputMode="url" autoComplete="off" spellCheck={false}
        placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)}
        aria-invalid={!!errors.link} aria-describedby={errors.link ? `${id}-link-err` : linkCheck.ok && linkCheck.warning ? `${id}-link-warn` : undefined}
      />
      {err('link')}
      {!errors.link && linkCheck.ok && linkCheck.warning && <p id={`${id}-link-warn`} className="hint">{linkCheck.warning}</p>}

      <div className="row">
        <button type="submit" className="btn-primary">{existing ? 'Save changes' : 'Book session'}</button>
        <button type="button" className="btn-quiet" onClick={onCancel}>{existing ? 'Close' : 'Cancel'}</button>
      </div>
      {existing && onCancelBooking && (
        <button type="button" className="btn-danger" onClick={onCancelBooking}>Cancel this session</button>
      )}
    </form>
  );
}
