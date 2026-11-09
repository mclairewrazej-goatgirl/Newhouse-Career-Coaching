import { describe, expect, it } from 'vitest';
import type { AllData, Session } from '../api/types';
import { emptyData } from '../state/ops';
import { coachingSummary, dateRange, summaryTitle } from './summary';

const session = (id: string, clientId: string, date: string, actualMin: number, createdAt = ''): Session => ({
  sessionId: id, clientId, clientName: '', date, bookedMin: 60, actualMin, timed: true, covered: [], nextSteps: [], plannedId: '', createdAt,
});

function data(): AllData {
  return {
    ...emptyData(),
    clients: [{ clientId: 'c_a', name: 'Ann', focus: 'New role', active: true, createdAt: '' }],
    sessions: [
      session('s_3', 'c_a', '2026-11-05', 50),
      session('s_1', 'c_a', '2026-10-01', 45),
      session('s_x', 'c_other', '2026-10-02', 99),
      session('s_2', 'c_a', '2026-10-15', 60.5),
    ],
    mentors: [
      { mentorId: 'm_z', name: 'Zed', role: '', organization: '', email: '', phone: '', notes: 'private', active: true, createdAt: '' },
      { mentorId: 'm_b', name: 'Bea', role: 'Lead', organization: 'Org', email: 'b@example.com', phone: '', notes: '', active: false, createdAt: '' },
      { mentorId: 'm_n', name: 'Not linked', role: '', organization: '', email: '', phone: '', notes: '', active: true, createdAt: '' },
    ],
    mentorLinks: [
      { linkId: 'l_1', mentorId: 'm_z', mentorName: 'Zed', clientId: 'c_a', clientName: 'Ann', status: 'suggested', date: '2026-10-01', createdAt: '', contacted: '', contactedOn: '' },
      { linkId: 'l_2', mentorId: 'm_b', mentorName: 'Bea', clientId: 'c_a', clientName: 'Ann', status: 'introduced', date: '2026-10-02', createdAt: '', contacted: '', contactedOn: '' },
      { linkId: 'l_3', mentorId: 'm_n', mentorName: 'Not linked', clientId: 'c_other', clientName: 'O', status: 'suggested', date: '2026-10-02', createdAt: '', contacted: '', contactedOn: '' },
    ],
  };
}

describe('coachingSummary', () => {
  it("lists only this client's sessions, oldest first, with range and total", () => {
    const s = coachingSummary(data(), 'c_a')!;
    expect(s.sessions.map((x) => x.sessionId)).toEqual(['s_1', 's_2', 's_3']);
    expect([s.from, s.to, s.totalMin]).toEqual(['2026-10-01', '2026-11-05', 155.5]);
  });
  it('includes connected mentors A–Z, archived ones too', () => {
    expect(coachingSummary(data(), 'c_a')!.mentors.map((m) => m.mentor.name)).toEqual(['Bea', 'Zed']);
  });
  it('carries whether and when the client made contact', () => {
    const d = data();
    d.mentorLinks[1] = { ...d.mentorLinks[1], contacted: 'yes', contactedOn: '2026-11-20' };
    const bea = coachingSummary(d, 'c_a')!.mentors[0];
    expect(bea.link).toMatchObject({ contacted: 'yes', contactedOn: '2026-11-20', status: 'introduced' });
  });
  it('orders same-day sessions by when they were saved', () => {
    const d = { ...data(), sessions: [session('s_b', 'c_a', '2026-10-01', 1, '2026-10-01T15:00'), session('s_a', 'c_a', '2026-10-01', 1, '2026-10-01T09:00')] };
    expect(coachingSummary(d, 'c_a')!.sessions.map((x) => x.sessionId)).toEqual(['s_a', 's_b']);
  });
  it('handles a client with no sessions, and an unknown client', () => {
    const d = { ...data(), sessions: [] };
    expect(coachingSummary(d, 'c_a')).toMatchObject({ from: '', to: '', totalMin: 0, sessions: [] });
    expect(coachingSummary(d, 'c_missing')).toBeNull();
  });
});

describe('dateRange and summaryTitle', () => {
  it('formats one date or a range', () => {
    expect(dateRange('2026-11-08', '2026-11-08', 'en-US')).toBe('November 8, 2026');
    expect(dateRange('2026-10-01', '2026-11-05', 'en-US')).toBe('October 1, 2026 – November 5, 2026');
    expect(dateRange('', '', 'en-US')).toBe('');
  });
  it('makes a safe file name', () => {
    expect(summaryTitle('Ann / B: "C"', '2026-11-08')).toBe('Coaching summary – Ann B C – 2026-11-08');
  });
});
