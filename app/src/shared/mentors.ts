/** Pure helpers for mentors and who they've been connected with. */
import type { Client, MentorLink } from '../api/types';
import { addDays, toDateString } from './dates';

/** A mentor connected this many times in RECENT_DAYS gets the "give them a break" warning. */
export const MENTOR_RECENT_LIMIT = 3;
export const MENTOR_RECENT_DAYS = 90;

/** First date (YYYY-MM-DD) that still counts as recent on `today`. */
export function recentFrom(today: Date): string {
  return toDateString(addDays(today, -(MENTOR_RECENT_DAYS - 1)));
}

/** MentorLinks rows for this mentor dated within the last 90 days (today included). */
export function recentUseCount(mentorId: string, links: readonly MentorLink[], today: Date): number {
  const from = recentFrom(today);
  const to = toDateString(today);
  return links.filter((l) => l.mentorId === mentorId && l.date >= from && l.date <= to).length;
}

export function needsBreak(count: number): boolean {
  return count >= MENTOR_RECENT_LIMIT;
}

/** "Not used lately", "2 in 90 days", "3 in 90 days · rest". */
export function usageLabel(count: number): string {
  if (count === 0) return 'Not used lately';
  return `${count} in ${MENTOR_RECENT_DAYS} days${needsBreak(count) ? ' · rest' : ''}`;
}

/** The mentor's most recent connection (by date). */
export function latestLink(mentorId: string, links: readonly MentorLink[]): MentorLink | null {
  let best: MentorLink | null = null;
  for (const l of links) {
    if (l.mentorId !== mentorId) continue;
    if (!best || l.date > best.date || (l.date === best.date && l.createdAt > best.createdAt)) best = l;
  }
  return best;
}

export const STATUS_LABEL: Record<MentorLink['status'], string> = {
  suggested: 'Suggested they get in touch',
  introduced: 'I reached out and introduced them',
};

export const STATUS_SHORT: Record<MentorLink['status'], string> = {
  suggested: 'Suggested',
  introduced: 'Introduced',
};

/** A mentor's connections, newest first, with whether the client is archived. */
export function mentorConnections(mentorId: string, links: readonly MentorLink[], clients: readonly Client[]) {
  return links
    .filter((l) => l.mentorId === mentorId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((l) => ({ link: l, pastClient: clients.find((c) => c.clientId === l.clientId)?.active === false }));
}

/** Light checks that never block saving. */
export function emailHint(email: string): string {
  const v = email.trim();
  return v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "This email address doesn't look complete." : '';
}

export function phoneHint(phone: string): string {
  const v = phone.trim();
  return v && v.replace(/\D/g, '').length < 7 ? 'This phone number looks short.' : '';
}

/** tel: link with only the characters phones understand (an "ext 2" part is dropped). */
export function telHref(phone: string): string {
  const main = phone.split(/\s*(?:ext\.?|x)\s*\d/i)[0];
  return 'tel:' + main.replace(/[^\d+*#]/g, '');
}
