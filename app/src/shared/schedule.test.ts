import { describe, expect, it } from 'vitest';
import type { Planned, Session } from '../api/types';
import {
  checkMeetLink, dayItems, dayMarks, defaultStartTime, longDayLabel, monthGrid, monthLabel, parseLength, shiftMonth,
} from './schedule';

const plan = (over: Partial<Planned>): Planned => ({
  plannedId: 'p_x', clientId: 'c_a', clientName: 'A', date: '2026-11-10', startTime: '10:00', bookedMin: 60,
  meetLink: '', status: 'booked', createdAt: '', ...over,
});
const sess = (over: Partial<Session>): Session => ({
  sessionId: 's_x', clientId: 'c_a', clientName: 'A', date: '2026-11-10', bookedMin: 60, actualMin: 50, timed: true,
  covered: [], nextSteps: [], plannedId: '', createdAt: '', ...over,
});

describe('monthGrid', () => {
  it('lays out November 2026 in Sunday-first weeks', () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(5);
    expect(g[0][0]).toEqual({ date: '2026-11-01', day: 1, inMonth: true }); // Nov 1 2026 is a Sunday
    expect(g[4][6]).toEqual({ date: '2026-12-05', day: 5, inMonth: false });
  });
  it('pads the start of a month that begins mid-week', () => {
    const g = monthGrid(2027, 0); // Jan 1 2027 is a Friday
    expect(g[0].slice(0, 5).every((d) => !d.inMonth)).toBe(true);
    expect(g[0][5].date).toBe('2027-01-01');
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });
  it('handles a 4-week February', () => {
    expect(monthGrid(2026, 1)).toHaveLength(4); // Feb 2026 starts on Sunday
  });
});

describe('shiftMonth', () => {
  it('crosses year ends', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('dayMarks and dayItems', () => {
  const planned = [
    plan({ plannedId: 'p_2', startTime: '15:00' }),
    plan({ plannedId: 'p_1', startTime: '09:00' }),
    plan({ plannedId: 'p_c', status: 'cancelled' }),
    plan({ plannedId: 'p_l', status: 'logged' }),
    plan({ plannedId: 'p_o', date: '2026-11-11' }),
  ];
  const sessions = [sess({ sessionId: 's_1' }), sess({ sessionId: 's_2', date: '2026-11-03' })];
  it('counts booked and logged per day, ignoring cancelled', () => {
    const m = dayMarks(planned, sessions);
    expect(m.get('2026-11-10')).toEqual({ booked: 2, logged: 1 });
    expect(m.get('2026-11-11')).toEqual({ booked: 1, logged: 0 });
    expect(m.get('2026-11-03')).toEqual({ booked: 0, logged: 1 });
    expect(m.get('2026-11-12')).toBeUndefined();
  });
  it('lists a day by start time', () => {
    const d = dayItems('2026-11-10', planned, sessions);
    expect(d.booked.map((p) => p.plannedId)).toEqual(['p_1', 'p_2']);
    expect(d.logged.map((s) => s.sessionId)).toEqual(['s_1']);
  });
});

describe('checkMeetLink', () => {
  it('accepts blank and Meet links', () => {
    expect(checkMeetLink('  ')).toEqual({ ok: true, value: '' });
    expect(checkMeetLink(' https://meet.google.com/abc-defg-hij ')).toEqual({ ok: true, value: 'https://meet.google.com/abc-defg-hij' });
  });
  it('warns about, but allows, other https links', () => {
    const r = checkMeetLink('https://zoom.us/j/123');
    expect(r.ok && r.warning).toMatch(/isn't a Google Meet link/);
  });
  it('refuses links without https://', () => {
    expect(checkMeetLink('meet.google.com/abc').ok).toBe(false);
    expect(checkMeetLink('http://meet.google.com/abc').ok).toBe(false);
  });
});

describe('small helpers', () => {
  it('parses custom lengths', () => {
    expect(parseLength('75')).toBe(75);
    expect(parseLength('0')).toBeNull();
    expect(parseLength('45.5')).toBeNull();
    expect(parseLength('abc')).toBeNull();
  });
  it('suggests the next whole hour within working hours', () => {
    expect(defaultStartTime(new Date(2026, 10, 10, 9, 20))).toBe('10:00');
    expect(defaultStartTime(new Date(2026, 10, 10, 6, 0))).toBe('08:00');
    expect(defaultStartTime(new Date(2026, 10, 10, 21, 0))).toBe('17:00');
  });
  it('labels months and days', () => {
    expect(monthLabel(2026, 10, 'en-US')).toBe('November 2026');
    expect(longDayLabel('2026-11-10', 'en-US')).toBe('Tuesday, November 10');
  });
});
