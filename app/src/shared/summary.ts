/** What goes into a client's printable coaching summary. Pure, so it can be tested. */
import type { AllData, Client, Mentor, MentorLink, Session } from '../api/types';

export interface SummaryMentor {
  mentor: Mentor;
  link: MentorLink;
}

export interface CoachingSummary {
  client: Client;
  /** Oldest first. */
  sessions: Session[];
  /** First and last session dates (YYYY-MM-DD), or '' with no sessions. */
  from: string;
  to: string;
  totalMin: number;
  /** Mentors connected with this client, A–Z, with the connection (status, whether and when they made contact). */
  mentors: SummaryMentor[];
}

export function coachingSummary(data: AllData, clientId: string): CoachingSummary | null {
  const client = data.clients.find((c) => c.clientId === clientId);
  if (!client) return null;
  const sessions = data.sessions
    .filter((s) => s.clientId === clientId)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  const mentors: SummaryMentor[] = [];
  for (const link of data.mentorLinks) {
    if (link.clientId !== clientId) continue;
    const mentor = data.mentors.find((m) => m.mentorId === link.mentorId);
    if (mentor) mentors.push({ mentor, link });
  }
  mentors.sort((a, b) => a.mentor.name.localeCompare(b.mentor.name));
  return {
    client,
    sessions,
    from: sessions[0]?.date ?? '',
    to: sessions[sessions.length - 1]?.date ?? '',
    totalMin: sessions.reduce((sum, s) => sum + (s.actualMin || 0), 0),
    mentors,
  };
}

/** Long date like "November 8, 2026" (no weekday), in device time. */
export function longDate(date: string, locale?: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "November 1 – November 8, 2026", or one date when they match. */
export function dateRange(from: string, to: string, locale?: string): string {
  if (!from) return '';
  if (from === to) return longDate(from, locale);
  return `${longDate(from, locale)} – ${longDate(to, locale)}`;
}

/** Name for the saved PDF; characters that file names can't hold are removed. */
export function summaryTitle(clientName: string, today: string): string {
  const name = clientName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Client';
  return `Coaching summary – ${name} – ${today}`;
}
