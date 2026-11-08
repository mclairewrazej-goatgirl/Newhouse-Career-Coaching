import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Api } from '../api/types';
import type { SyncEngine, SyncSnapshot } from './sync';

export interface AppContextValue {
  api: Api;
  sync: SyncEngine;
  email: string;
  demo: boolean;
  signOut: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>');
  return ctx;
}

/** The local copy of the sheet plus sync status; re-renders when either changes. */
export function useSync(): SyncSnapshot {
  const { sync } = useApp();
  return useSyncExternalStore(sync.subscribe, sync.getSnapshot);
}
