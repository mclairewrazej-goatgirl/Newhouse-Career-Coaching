import { useId, useState, type FormEvent } from 'react';

interface Props {
  initialName?: string;
  initialFocus?: string;
  submitLabel: string;
  onSave: (name: string, focus: string) => void;
  onCancel: () => void;
}

/** Name (required) and coaching focus (optional), used for adding and editing a client. */
export function ClientForm({ initialName = '', initialFocus = '', submitLabel, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [focus, setFocus] = useState(initialFocus);
  const [error, setError] = useState('');
  const id = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    onSave(name.trim(), focus.trim());
  }

  return (
    <form className="card stack-sm" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor={`${id}-name`}>Name</label>
      <input
        id={`${id}-name`} className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus
        maxLength={200} autoComplete="off"
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
      <label className="field-label" htmlFor={`${id}-focus`}>Coaching focus <span className="muted">(optional)</span></label>
      <input
        id={`${id}-focus`} className="field" value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={1000}
        placeholder="e.g. Moving from teaching into UX research" autoComplete="off"
      />
      <div className="row">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <button type="button" className="btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
