import { createContext, useContext } from 'react';
import type { Planned } from '../api/types';

export type Tab = 'schedule' | 'clients' | 'mentors' | 'review' | 'account';

export interface Nav {
  go: (tab: Tab) => void;
  openClient: (clientId: string) => void;
  openMentor: (mentorId: string) => void;
  /** Open the live screen for a booked session (or the one already running). */
  openSession: (planned: Planned) => void;
  /** Back to the session in progress. */
  openLive: () => void;
  /** Start a session that wasn't booked (pick client and length). */
  startNow: (clientId?: string) => void;
  /** Open the plan form on the Schedule, optionally for one client. */
  plan: (clientId?: string) => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside <NavContext.Provider>');
  return nav;
}
