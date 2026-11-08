import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from './api/client';
import { createDemoApi } from './api/demo';
import type { Api, LoginResult } from './api/types';
import { AppContext } from './state/AppContext';
import type { SessionStore, Stage } from './state/session';
import type { KeyValueStore } from './state/storage';
import { LiveStore } from './state/live';
import { SyncEngine } from './state/sync';
import { AppShell } from './screens/AppShell';
import { NotLinked } from './screens/NotLinked';
import { SignIn } from './screens/SignIn';

interface Props {
  store: SessionStore;
  kv: KeyValueStore;
  demo: boolean;
  /** The ?connect= link was there but wasn't a valid sheet address. */
  badLink: boolean;
}

/** Reload from the sheet when coming back to the app, at most this often. */
const REFRESH_GAP_MS = 5_000;

export function App({ store, kv, demo, badLink }: Props) {
  const [stage, setStage] = useState<Stage>(() => (demo ? 'signin' : store.stage()));
  const [notice, setNotice] = useState('');

  const api: Api | null = useMemo(() => {
    const onAuthError = () => {
      store.signOut();
      setNotice('Please sign in again.');
      setStage('signin');
    };
    if (demo) return createDemoApi({ onAuthError });
    const address = store.connector();
    return address ? createApiClient({ address, getToken: () => store.token(), onAuthError }) : null;
    // The address only changes on a fresh page load (new ?connect= link).
  }, [demo, store]);

  const sync = useMemo(() => (api ? new SyncEngine({ api, store: kv }) : null), [api, kv]);
  const live = useMemo(() => new LiveStore(kv), [kv]);

  // Load from the sheet when signed in, when the app comes back into view, and send waiting changes when back online.
  useEffect(() => {
    if (!sync || stage !== 'app') return;
    let last = 0;
    const refresh = () => {
      if (Date.now() - last < REFRESH_GAP_MS) return;
      last = Date.now();
      void sync.refresh();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const onOnline = () => { void sync.flush(); };
    refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', onOnline);
    };
  }, [sync, stage]);

  const onSignedIn = useCallback((r: LoginResult) => {
    store.signIn(r.token, r.email, r.expiresAt);
    setNotice('');
    setStage('app');
  }, [store]);

  const signOut = useCallback(async () => {
    const waiting = sync?.pendingOps().length ?? 0;
    if (waiting > 0) {
      const ok = window.confirm(
        `${waiting} change${waiting === 1 ? " hasn't" : "s haven't"} reached your sheet yet. ` +
        'If you sign out now, they will be lost. Sign out anyway?',
      );
      if (!ok) return;
    }
    if (live.get() && !window.confirm('A session is still in progress. Signing out will discard its timer and notes. Sign out anyway?')) return;
    try { await api?.logout(); } catch { /* signing out on this device is what matters */ }
    sync?.clear();
    live.clear();
    store.signOut();
    setNotice('');
    setStage('signin');
  }, [api, store, sync, live]);

  if (!api || !sync || stage === 'unlinked') return <NotLinked badLink={badLink} />;
  if (stage === 'signin') {
    return <SignIn api={api} demo={demo} initialEmail={store.email() ?? ''} notice={notice} onSignedIn={onSignedIn} />;
  }
  return (
    <AppContext.Provider value={{ api, sync, live, demo, email: store.email() ?? '', signOut }}>
      <AppShell />
    </AppContext.Provider>
  );
}
