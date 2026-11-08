import { useMemo, useState, type ReactNode } from 'react';
import type { Planned } from '../api/types';
import { FailedToast } from '../components/Toast';
import { useApp, useSync } from '../state/AppContext';
import { liveFromPlanned, useLive } from '../state/live';
import { NavContext, type Nav, type Tab } from '../state/nav';
import { Account } from './Account';
import { Clients } from './Clients';
import { LiveBar, LiveSession } from './LiveSession';
import { Mentors } from './Mentors';
import { Review } from './Review';
import { Schedule } from './Schedule';

export type { Tab } from '../state/nav';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'schedule', label: 'Schedule',
    icon: <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  },
  {
    id: 'clients', label: 'Clients',
    icon: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6" />,
  },
  {
    id: 'mentors', label: 'Mentors',
    icon: <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a6 6 0 0 1 11-3.3M11 20a5 5 0 0 1 10 0M12 4l0 0" />,
  },
  {
    id: 'review', label: 'Review',
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    id: 'account', label: 'Account',
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />,
  },
];

type LiveView = { open: false } | { open: true; startFor?: string };

export function AppShell() {
  const { live: liveStore } = useApp();
  const { data } = useSync();
  const live = useLive(liveStore);
  const [tab, setTab] = useState<Tab>('schedule');
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [openMentorId, setOpenMentorId] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [liveView, setLiveView] = useState<LiveView>({ open: false });

  const top = () => window.scrollTo(0, 0);

  const nav: Nav = useMemo(() => {
    const nameOf = (clientId: string) => data?.clients.find((c) => c.clientId === clientId)?.name ?? 'another client';
    /** Only one session can run at a time. Returns true if it's fine to start a new one. */
    const canStartNew = (sameAs?: (l: NonNullable<typeof live>) => boolean): boolean => {
      const cur = liveStore.get();
      if (!cur) return true;
      if (sameAs?.(cur)) return false;
      window.alert(`Your session with ${nameOf(cur.clientId)} is still in progress. End or discard it before starting another. Opening it now.`);
      return false;
    };
    return {
      go: (t) => { setTab(t); setOpenClientId(null); setOpenMentorId(null); setLiveView({ open: false }); top(); },
      openClient: (id) => { setTab('clients'); setOpenClientId(id); setLiveView({ open: false }); top(); },
      openMentor: (id) => { setTab('mentors'); setOpenMentorId(id); setLiveView({ open: false }); top(); },
      openSession: (p: Planned) => {
        if (canStartNew((cur) => cur.plannedId === p.plannedId)) liveStore.set(liveFromPlanned(p));
        setLiveView({ open: true }); top();
      },
      openLive: () => { setLiveView({ open: true }); top(); },
      startNow: (clientId) => {
        canStartNew();
        setLiveView({ open: true, startFor: clientId }); top();
      },
      plan: (clientId) => { setPlanFor(clientId ?? ''); setTab('schedule'); setOpenClientId(null); setLiveView({ open: false }); top(); },
    };
  }, [data, liveStore]);

  let main: ReactNode;
  if (liveView.open) {
    main = <LiveSession startFor={liveView.startFor} onClose={() => { setLiveView({ open: false }); top(); }} onOpenClient={nav.openClient} />;
  } else if (tab === 'schedule') {
    main = <Schedule onOpenClient={nav.openClient} planFor={planFor} onPlanForHandled={() => setPlanFor(null)} />;
  } else if (tab === 'clients') {
    main = <Clients openId={openClientId} onOpen={(id) => { setOpenClientId(id); top(); }} onPlan={(id) => nav.plan(id)} />;
  } else if (tab === 'mentors') {
    main = <Mentors openId={openMentorId} onOpen={(id) => { setOpenMentorId(id); top(); }} />;
  } else if (tab === 'review') {
    main = <Review />;
  } else {
    main = <Account />;
  }

  const widePage = liveView.open || tab === 'schedule' || tab === 'review' || (tab === 'clients' && !!openClientId);

  return (
    <NavContext.Provider value={nav}>
      <div className="shell">
        <main className={`shell-main${widePage ? ' page-wide' : ''}${live && !liveView.open ? ' with-live-bar' : ''}`}>{main}</main>
        <div className="bottom">
          <FailedToast onDetails={() => nav.go('account')} />
          {live && !liveView.open && <LiveBar live={live} onOpen={nav.openLive} />}
          <nav className="tabbar" aria-label="Main">
            <span className="brand-name display" aria-hidden="true">Coaching Tracker</span>
            {TABS.map((t) => (
              <button
                key={t.id} type="button" className="tab" aria-current={tab === t.id && !liveView.open ? 'page' : undefined}
                onClick={() => nav.go(t.id)}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </NavContext.Provider>
  );
}
