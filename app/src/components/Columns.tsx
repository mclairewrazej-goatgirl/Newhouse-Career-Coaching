import { Children, useEffect, useState, type ReactNode } from 'react';

/** Width at which screens switch to the computer layout (two columns, menu at the top). Keep in step with app.css. */
export const WIDE_QUERY = '(min-width: 960px)';

export function useWide(): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_QUERY).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_QUERY);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

interface Props {
  left: ReactNode;
  right: ReactNode;
  /** Order on a phone, if not simply left then right. */
  phone?: ReactNode;
}

/** Two columns on a computer; one column on a phone. */
export function Columns({ left, right, phone }: Props) {
  const wide = useWide();
  if (!wide) return <>{phone ?? <>{left}{right}</>}</>;
  return (
    <div className="cols">
      <div className="col">{Children.toArray(left)}</div>
      <div className="col">{Children.toArray(right)}</div>
    </div>
  );
}
