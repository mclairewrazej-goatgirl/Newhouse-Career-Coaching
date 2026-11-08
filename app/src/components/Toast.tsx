import { useEffect, useRef, useState } from 'react';
import { useSync } from '../state/AppContext';

const SHOW_MS = 7000;

/** A short message at the bottom when the sheet refuses a change. Details stay on the Account tab. */
export function FailedToast({ onDetails }: { onDetails: () => void }) {
  const { failed } = useSync();
  const seen = useRef(failed.length);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (failed.length > seen.current) {
      setShow(true);
      const t = setTimeout(() => setShow(false), SHOW_MS);
      seen.current = failed.length;
      return () => clearTimeout(t);
    }
    seen.current = failed.length;
  }, [failed.length]);

  if (!show) return null;
  return (
    <div className="toast" role="alert">
      <p>A change couldn't be saved to your sheet and was undone.</p>
      <div className="toast-actions">
        <button type="button" className="toast-btn" onClick={() => { setShow(false); onDetails(); }}>Details</button>
        <button type="button" className="toast-btn" onClick={() => setShow(false)} aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}
