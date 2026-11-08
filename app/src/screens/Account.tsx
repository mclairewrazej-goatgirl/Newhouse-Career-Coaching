import { useEffect, useState } from 'react';
import { ApiError } from '../api/types';
import { useApp } from '../state/AppContext';

/** Phase 2 version: who's signed in, a check that the sheet answers, and Sign out. */
export function Account() {
  const { api, email, demo, signOut } = useApp();
  const [sheet, setSheet] = useState<{ name: string; url: string } | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let live = true;
    api.getAll()
      .then((d) => { if (live) setSheet({ name: d.sheetName, url: d.sheetUrl }); })
      .catch((e: unknown) => {
        if (live && !(e instanceof ApiError && e.code === 'AUTH')) {
          setProblem(e instanceof ApiError ? e.message : "Can't reach your sheet right now.");
        }
      });
    return () => { live = false; };
  }, [api]);

  return (
    <>
      <h1 className="display page-title">Account</h1>
      <section className="card stack">
        <div>
          <p className="label">Signed in as</p>
          <p className="value">{email || '—'}</p>
        </div>
        <div>
          <p className="label">Your sheet</p>
          {problem ? (
            <p className="notice error" role="alert">{problem}</p>
          ) : sheet ? (
            <p className="value">
              {sheet.name}
              {!demo && sheet.url && (
                <a href={sheet.url} target="_blank" rel="noopener noreferrer">Open my Google Sheet</a>
              )}
            </p>
          ) : (
            <p className="muted" role="status">Checking your sheet…</p>
          )}
        </div>
        <button type="button" className="btn-secondary wide" onClick={() => void signOut()}>Sign out</button>
      </section>
    </>
  );
}
