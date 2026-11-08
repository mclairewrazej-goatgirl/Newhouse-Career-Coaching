import { useId, useState, type KeyboardEvent } from 'react';

interface Props {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

/** Bullet list: Enter or + adds, tap a point to edit it, ↑ ↓ reorder, × removes. */
export function BulletEditor({ label, items, onChange, placeholder }: Props) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  function add() {
    const t = draft.replace(/\s+/g, ' ').trim();
    if (!t) return;
    onChange([...items, t]);
    setDraft('');
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  }
  function startEdit(i: number) {
    setEditing(i);
    setEditText(items[i]);
  }
  function finishEdit() {
    if (editing === null) return;
    const t = editText.replace(/\s+/g, ' ').trim();
    onChange(t ? items.map((x, i) => (i === editing ? t : x)) : items.filter((_, i) => i !== editing));
    setEditing(null);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <section className="card stack-sm" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="display section-title">{label}</h2>
      {items.length > 0 && (
        <ol className="bullet-edit">
          {items.map((t, i) => (
            <li key={i}>
              {editing === i ? (
                <input
                  className="field" value={editText} autoFocus aria-label={`Edit point ${i + 1}`}
                  onChange={(e) => setEditText(e.target.value)} onBlur={finishEdit}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finishEdit(); } if (e.key === 'Escape') setEditing(null); }}
                />
              ) : (
                <button type="button" className="bullet-text" onClick={() => startEdit(i)} aria-label={`${t}. Tap to edit.`}>
                  {t}
                </button>
              )}
              <span className="bullet-actions">
                <button type="button" className="mini-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move "${t}" up`}>↑</button>
                <button type="button" className="mini-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move "${t}" down`}>↓</button>
                <button type="button" className="mini-btn" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Remove "${t}"`}>×</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="field-with-button">
        <input
          id={`${id}-new`} className="field" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
          placeholder={placeholder ?? 'Type a point and press Enter'} aria-label={`Add to ${label}`} enterKeyHint="enter"
        />
        <button type="button" className="btn-primary" onClick={add} aria-label={`Add to ${label}`}>+</button>
      </div>
    </section>
  );
}
