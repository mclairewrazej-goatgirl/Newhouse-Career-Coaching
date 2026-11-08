import { useState, type ReactNode } from 'react';
import { Account } from './Account';

export type Tab = 'schedule' | 'clients' | 'account';

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
    id: 'account', label: 'Account',
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />,
  },
];

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1 className="display page-title">{title}</h1>
      <div className="card"><p className="muted">{text}</p></div>
    </>
  );
}

export function AppShell() {
  const [tab, setTab] = useState<Tab>('schedule');

  return (
    <div className="shell">
      <main className="shell-main">
        {tab === 'schedule' && <Placeholder title="Schedule" text="Your planned and logged sessions will show here." />}
        {tab === 'clients' && <Placeholder title="Clients" text="Your clients will show here." />}
        {tab === 'account' && <Account />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id} type="button" className="tab" aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
