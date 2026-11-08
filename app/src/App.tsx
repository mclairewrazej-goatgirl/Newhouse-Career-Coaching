import { useCallback, useMemo, useState } from 'react';
import { createApiClient } from './api/client';
import { createDemoApi } from './api/demo';
import type { Api, LoginResult } from './api/types';
import { AppContext } from './state/AppContext';
import type { SessionStore, Stage } from './state/session';
import { AppShell } from './screens/AppShell';
import { NotLinked } from './screens/NotLinked';
import { SignIn } from './screens/SignIn';

interface Props {
  store: SessionStore;
  demo: boolean;
  /** The ?connect= link was there but wasn't a valid sheet address. */
  badLink: boolean;
}

export function App({ store, demo, badLink }: Props) {
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

  const onSignedIn = useCallback((r: LoginResult) => {
    store.signIn(r.token, r.email, r.expiresAt);
    setNotice('');
    setStage('app');
  }, [store]);

  const signOut = useCallback(async () => {
    try { await api?.logout(); } catch { /* signing out locally is what matters */ }
    store.signOut();
    setNotice('');
    setStage('signin');
  }, [api, store]);

  if (!api || stage === 'unlinked') return <NotLinked badLink={badLink} />;
  if (stage === 'signin') {
    return <SignIn api={api} demo={demo} initialEmail={store.email() ?? ''} notice={notice} onSignedIn={onSignedIn} />;
  }
  return (
    <AppContext.Provider value={{ api, demo, email: store.email() ?? '', signOut }}>
      <AppShell />
    </AppContext.Provider>
  );
}
