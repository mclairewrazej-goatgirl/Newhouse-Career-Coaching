import { createContext, useContext } from 'react';
import type { Api } from '../api/types';

export interface AppContextValue {
  api: Api;
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
