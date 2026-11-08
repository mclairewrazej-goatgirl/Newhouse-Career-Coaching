import { describe, expect, it } from 'vitest';
import type { Client, Planned, Session, Suggestion } from '../api/types';
import {
  clientSessions, clientTotals, formatDay, formatTime, formatWhen, nextBooking, sessionSuggestions, sortClients,
} from './clients';

const session = (over: Partial<Session>): Session => ({
  sessionId: 's_x', clientId: 'c_a', clientName: 'A', date: '2026-11-01', bookedMin: 60, actualMin: 50, timed: true,
  covered: [], nextSteps: [], plannedId: '', createdAt: '', ...over,
});
const plan = (over: Partial<Planned>): Planned => ({
  plannedId: 'p_x', clientId: 'c_a', clientName: 'A', date: '2026-11-10', startTime: '10:00', bookedMin: 60,
  meetLink: '', status: 'booked', createdAt: '', ...over,
});

describe('clientTotals', () => {
  it('adds up actual and booked time for one client only', () => {
    const s = [
      session({ actualMin: 47.5, bookedMin: 60 }),
      session({ actualMin: 30, bookedMin: 30 }),
      session({ clientId: 'c_b', actualMin: 99, bookedMin: 99 }),
    ];
    expect(clientTotals('c_a', s)).toEqual({ actualMin: 77.5, bookedMin: 90, sessions: 2 });
    expect(clientTotals('c_none', s)).toEqual({ actualMin: 0, bookedMin: 0, sessions: 0 });
  });
});

describe('nextBooking', () => {
  const now = new Date(2026, 10, 10, 9, 0); // Nov 10, 9:00 local
  it('picks the soonest booked session from now', () => {
    const p = [
      plan({ plannedId: 'p_late', date: '2026-11-12', startTime: '09:00' }),
      plan({ plannedId: 'p_soon', date: '2026-11-10', startTime: '15:00' }),
      plan({ plannedId: 'p_past', date: '2026-11-09', startTime: '15:00' }),
      plan({ plannedId: 'p_cancel', date: '2026-11-10', startTime: '10:00', status: 'cancelled' }),
      plan({ plannedId: 'p_logged', date: '2026-11-10', startTime: '11:00', status: 'logged' }),
      plan({ plannedId: 'p_other', clientId: 'c_b', date: '2026-11-10', startTime: '09:30' }),
    ];
    expect(nextBooking('c_a', p, now)?.plannedId).toBe('p_soon');
    expect(nextBooking(null, p, now)?.plannedId).toBe('p_other');
    expect(nextBooking('c_none', p, now)).toBeNull();
  });
  it('still shows a session that started in the last hour', () => {
    const p = [plan({ plannedId: 'p_now', date: '2026-11-10', startTime: '08:30' })];
    expect(nextBooking('c_a', p, now)?.plannedId).toBe('p_now');
    expect(nextBooking('c_a', p, new Date(2026, 10, 10, 9, 31))).toBeNull();
  });
});

describe('clientSessions', () => {
  it('lists newest first', () => {
    const s = [
      session({ sessionId: 's_1', date: '2026-10-01' }),
      session({ sessionId: 's_3', date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' }),
      session({ sessionId: 's_4', date: '2026-11-01', createdAt: '2026-11-01T15:00:00Z' }),
      session({ sessionId: 's_b', clientId: 'c_b', date: '2026-12-01' }),
    ];
    expect(clientSessions('c_a', s).map((x) => x.sessionId)).toEqual(['s_4', 's_3', 's_1']);
  });
});

describe('sessionSuggestions', () => {
  it('returns this session\'s suggestions in next-step order', () => {
    const s = session({ sessionId: 's_1', nextSteps: ['First', 'Second'] });
    const g = (id: string, text: string, sessionId = 's_1'): Suggestion => ({
      suggestionId: id, sessionId, clientId: 'c_a', clientName: 'A', date: '', text, outcome: '', outcomeAt: '', done: '', doneAt: '',
    });
    expect(sessionSuggestions(s, [g('g_2', 'Second'), g('g_x', 'Other', 's_2'), g('g_1', 'First')]).map((x) => x.suggestionId))
      .toEqual(['g_1', 'g_2']);
  });
});

describe('sortClients', () => {
  it('puts active clients first, A to Z', () => {
    const c = (name: string, active = true): Client => ({ clientId: 'c_' + name, name, focus: '', active, createdAt: '' });
    expect(sortClients([c('sam'), c('Zed', false), c('Alex'), c('Bea', false)]).map((x) => x.name)).toEqual(['Alex', 'sam', 'Bea', 'Zed']);
  });
});

describe('formatting', () => {
  const now = new Date(2026, 10, 10, 9, 0);
  it('names nearby days', () => {
    expect(formatDay('2026-11-10', now)).toBe('Today');
    expect(formatDay('2026-11-11', now)).toBe('Tomorrow');
    expect(formatDay('2026-11-09', now)).toBe('Yesterday');
    expect(formatDay('2026-11-12', now, 'en-US')).toBe('Thu, Nov 12');
    expect(formatDay('2027-01-05', now, 'en-US')).toBe('Tue, Jan 5, 2027');
  });
  it('formats times and whole bookings', () => {
    expect(formatTime('15:00', 'en-US')).toBe('3:00 PM');
    expect(formatWhen({ date: '2026-11-11', startTime: '09:30' }, now, 'en-US')).toBe('Tomorrow · 9:30 AM');
  });
});
