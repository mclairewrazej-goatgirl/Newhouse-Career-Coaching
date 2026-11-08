/** Pure helpers for the Schedule tab. All dates are device-local YYYY-MM-DD strings. */
import type { Planned, Session } from '../api/types';
import { toDateString } from './dates';

export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
}

/** Weeks (Sunday first) covering the whole month. `month` is 0-11. */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: toDateString(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month);
  return weeks;
}

/** { year, month } moved by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export interface DayMarks {
  booked: number;
  logged: number;
}

/** How many booked and logged sessions fall on each date. */
export function dayMarks(planned: readonly Planned[], sessions: readonly Session[]): Map<string, DayMarks> {
  const marks = new Map<string, DayMarks>();
  const get = (date: string) => {
    let m = marks.get(date);
    if (!m) { m = { booked: 0, logged: 0 }; marks.set(date, m); }
    return m;
  };
  for (const p of planned) if (p.status === 'booked') get(p.date).booked += 1;
  for (const s of sessions) get(s.date).logged += 1;
  return marks;
}

/** Booked sessions on a date (by start time) and sessions logged that day. */
export function dayItems(date: string, planned: readonly Planned[], sessions: readonly Session[]) {
  return {
    booked: planned.filter((p) => p.date === date && p.status === 'booked').sort((a, b) => a.startTime.localeCompare(b.startTime)),
    logged: sessions.filter((s) => s.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export type LinkCheck = { ok: true; warning?: string; value: string } | { ok: false; error: string };

/** Meet link: optional; must start with https://; other services are allowed with a gentle note. */
export function checkMeetLink(input: string): LinkCheck {
  const value = input.trim();
  if (!value) return { ok: true, value: '' };
  if (!/^https:\/\/\S+$/.test(value)) return { ok: false, error: 'The link should start with https://' };
  if (value.length > 500) return { ok: false, error: 'That link is too long.' };
  let host = '';
  try { host = new URL(value).hostname; } catch { return { ok: false, error: "That doesn't look like a link." }; }
  if (host !== 'meet.google.com') {
    return { ok: true, value, warning: "This isn't a Google Meet link. That's fine if you use another video service." };
  }
  return { ok: true, value };
}

export const LENGTH_CHOICES = [30, 45, 60, 90] as const;

/** Booked length from the pills or the custom box. Returns null if it isn't a sensible whole number of minutes. */
export function parseLength(custom: string): number | null {
  const n = Number(custom.trim());
  return Number.isInteger(n) && n >= 1 && n <= 1440 ? n : null;
}

/** A sensible default start time: the next whole hour, between 08:00 and 17:00. */
export function defaultStartTime(now: Date): string {
  const h = Math.min(17, Math.max(8, now.getHours() + 1));
  return `${String(h).padStart(2, '0')}:00`;
}

export function monthLabel(year: number, month: number, locale?: string): string {
  return new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function longDayLabel(date: string, locale?: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}
