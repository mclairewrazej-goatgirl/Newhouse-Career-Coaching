/** Pure helpers for the Review tab. Weeks run Monday to Sunday in device time; months are calendar months. */
import type { AllData, MentorLink, Suggestion } from '../api/types';
import { addDays, toDateString } from './dates';

export type PeriodKind = 'week' | 'month';

export interface Period {
  kind: PeriodKind;
  /** First and last dates, inclusive, YYYY-MM-DD. */
  start: string;
  end: string;
}

/** The week or month containing `anchor`, moved by `offset` weeks/months. */
export function periodFor(kind: PeriodKind, anchor: Date, offset = 0): Period {
  if (kind === 'week') {
    const day = anchor.getDay(); // 0 Sunday .. 6 Saturday
    const monday = addDays(anchor, -((day + 6) % 7) + offset * 7);
    return { kind, start: toDateString(monday), end: toDateString(addDays(monday, 6)) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { kind, start: toDateString(first), end: toDateString(last) };
}

export function inPeriod(date: string, p: Period): boolean {
  return date >= p.start && date <= p.end;
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Nov 2 – Nov 8" (with years when they differ from now) or "November 2026". */
export function periodLabel(p: Period, locale?: string, now: Date = new Date()): string {
  const start = parse(p.start);
  if (p.kind === 'month') return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const end = parse(p.end);
  const withYear = start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) };
  return `${start.toLocaleDateString(locale, opts)} – ${end.toLocaleDateString(locale, opts)}`;
}

export type OutcomeFilter = 'all' | 'helpful' | 'not' | 'none';

export interface ReviewSummary {
  sessions: number;
  clients: number;
  minutes: number;
  suggestions: Suggestion[];
  links: MentorLink[];
  counts: Record<OutcomeFilter, number>;
}

/** Everything the Review tab shows for one period. */
export function reviewSummary(data: AllData, p: Period): ReviewSummary {
  const sessions = data.sessions.filter((s) => inPeriod(s.date, p));
  const sessionIds = new Set(sessions.map((s) => s.sessionId));
  const suggestions = data.suggestions
    .filter((g) => sessionIds.has(g.sessionId) || (!g.sessionId && inPeriod(g.date, p)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const links = data.mentorLinks.filter((l) => inPeriod(l.date, p)).sort((a, b) => b.date.localeCompare(a.date));
  return {
    sessions: sessions.length,
    clients: new Set(sessions.map((s) => s.clientId)).size,
    minutes: sessions.reduce((sum, s) => sum + (s.timed ? s.actualMin : s.bookedMin || s.actualMin), 0),
    suggestions,
    links,
    counts: {
      all: suggestions.length,
      helpful: suggestions.filter((g) => g.outcome === 'helpful').length,
      not: suggestions.filter((g) => g.outcome === 'not').length,
      none: suggestions.filter((g) => g.outcome === '').length,
    },
  };
}

export function filterSuggestions(list: readonly Suggestion[], f: OutcomeFilter): Suggestion[] {
  if (f === 'all') return list.slice();
  if (f === 'none') return list.filter((g) => g.outcome === '');
  return list.filter((g) => g.outcome === f);
}
