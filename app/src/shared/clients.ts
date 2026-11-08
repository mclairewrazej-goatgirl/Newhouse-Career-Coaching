/** Pure helpers for the Clients screens. Times are in device (local) time. */
import type { Client, Planned, Session, Suggestion } from '../api/types';
import { toDateString } from './dates';

export interface ClientTotals {
  /** Sum of actual minutes. */
  actualMin: number;
  /** Sum of booked minutes. */
  bookedMin: number;
  sessions: number;
}

export function clientTotals(clientId: string, sessions: readonly Session[]): ClientTotals {
  let actualMin = 0;
  let bookedMin = 0;
  let count = 0;
  for (const s of sessions) {
    if (s.clientId !== clientId) continue;
    actualMin += s.actualMin || 0;
    bookedMin += s.bookedMin || 0;
    count += 1;
  }
  return { actualMin, bookedMin, sessions: count };
}

/** "YYYY-MM-DDTHH:mm" in device time, for comparing with planned date + start time. */
export function localStamp(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toDateString(d)}T${hh}:${mm}`;
}

/**
 * The client's soonest booked session that hasn't started yet, or one that
 * started within `graceMin` minutes (so a session in progress still shows).
 */
export function nextBooking(
  clientId: string | null, planned: readonly Planned[], now: Date, graceMin = 60,
): Planned | null {
  const from = localStamp(new Date(now.getTime() - graceMin * 60_000));
  let best: Planned | null = null;
  for (const p of planned) {
    if (p.status !== 'booked') continue;
    if (clientId !== null && p.clientId !== clientId) continue;
    const at = `${p.date}T${p.startTime}`;
    if (at < from) continue;
    if (!best || at < `${best.date}T${best.startTime}`) best = p;
  }
  return best;
}

/** A client's sessions, newest first. */
export function clientSessions(clientId: string, sessions: readonly Session[]): Session[] {
  return sessions
    .filter((s) => s.clientId === clientId)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

/** Suggestions for one session, in the order of its next steps. */
export function sessionSuggestions(session: Session, suggestions: readonly Suggestion[]): Suggestion[] {
  const mine = suggestions.filter((s) => s.sessionId === session.sessionId);
  const order = new Map(session.nextSteps.map((t, i) => [t, i]));
  return mine.sort((a, b) => (order.get(a.text) ?? 999) - (order.get(b.text) ?? 999));
}

/** Active clients A–Z, then archived. */
export function sortClients(clients: readonly Client[]): Client[] {
  return clients.slice().sort((a, b) =>
    a.active === b.active ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.active ? -1 : 1);
}

function parseLocal(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

/** "3:00 PM" style time in the device's own format. */
export function formatTime(time: string, locale?: string): string {
  return parseLocal('2000-01-01', time).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Tomorrow", "Yesterday" or e.g. "Thu, Nov 12" (with the year if it isn't this year). */
export function formatDay(date: string, now: Date, locale?: string): string {
  const today = toDateString(now);
  const day = parseLocal(date);
  const diff = Math.round((day.getTime() - parseLocal(today).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (day.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return day.toLocaleDateString(locale, opts);
}

export function formatWhen(p: Pick<Planned, 'date' | 'startTime'>, now: Date, locale?: string): string {
  return `${formatDay(p.date, now, locale)} · ${formatTime(p.startTime, locale)}`;
}
