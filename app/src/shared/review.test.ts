import { describe, expect, it } from 'vitest';
import type { AllData, Session, Suggestion } from '../api/types';
import { filterSuggestions, inPeriod, periodFor, periodLabel, reviewSummary } from './review';

const sess = (over: Partial<Session>): Session => ({
  sessionId: 's_x', clientId: 'c_a', clientName: 'A', date: '2026-11-03', bookedMin: 60, actualMin: 50, timed: true,
  covered: [], nextSteps: [], plannedId: '', createdAt: '', ...over,
});
const sugg = (over: Partial<Suggestion>): Suggestion => ({
  suggestionId: 'g_x', sessionId: 's_x', clientId: 'c_a', clientName: 'A', date: '2026-11-03', text: 't', outcome: '',
  outcomeAt: '', done: '', doneAt: '', ...over,
});
const data = (over: Partial<AllData>): AllData => ({
  clients: [], planned: [], sessions: [], suggestions: [], mentors: [], mentorLinks: [], sheetUrl: '', sheetName: '', ...over,
});

describe('periods', () => {
  it('runs weeks Monday to Sunday', () => {
    expect(periodFor('week', new Date(2026, 10, 8))).toEqual({ kind: 'week', start: '2026-11-02', end: '2026-11-08' }); // Sunday
    expect(periodFor('week', new Date(2026, 10, 2))).toEqual({ kind: 'week', start: '2026-11-02', end: '2026-11-08' }); // Monday
  });
  it('handles a week that spans two months', () => {
    const p = periodFor('week', new Date(2026, 10, 8), -1);
    expect(p).toEqual({ kind: 'week', start: '2026-10-26', end: '2026-11-01' });
    expect(periodLabel(p, 'en-US', new Date(2026, 10, 8))).toBe('Oct 26 – Nov 1');
  });
  it('shows years for a week across New Year', () => {
    const p = periodFor('week', new Date(2026, 11, 30));
    expect(p).toEqual({ kind: 'week', start: '2026-12-28', end: '2027-01-03' });
    expect(periodLabel(p, 'en-US', new Date(2026, 10, 8))).toBe('Dec 28, 2026 – Jan 3, 2027');
  });
  it('uses calendar months', () => {
    expect(periodFor('month', new Date(2026, 10, 8))).toEqual({ kind: 'month', start: '2026-11-01', end: '2026-11-30' });
    expect(periodFor('month', new Date(2026, 10, 8), -9)).toEqual({ kind: 'month', start: '2026-02-01', end: '2026-02-28' });
    expect(periodLabel(periodFor('month', new Date(2026, 10, 8)), 'en-US')).toBe('November 2026');
  });
  it('includes both ends', () => {
    const p = { kind: 'week' as const, start: '2026-11-02', end: '2026-11-08' };
    expect(inPeriod('2026-11-02', p)).toBe(true);
    expect(inPeriod('2026-11-08', p)).toBe(true);
    expect(inPeriod('2026-11-09', p)).toBe(false);
  });
});

describe('reviewSummary', () => {
  const d = data({
    sessions: [
      sess({ sessionId: 's_1', clientId: 'c_a', actualMin: 47.5 }),
      sess({ sessionId: 's_2', clientId: 'c_b', date: '2026-11-05', timed: false, bookedMin: 30, actualMin: 30 }),
      sess({ sessionId: 's_3', clientId: 'c_a', date: '2026-11-04', actualMin: 20 }),
      sess({ sessionId: 's_old', date: '2026-10-20' }),
    ],
    suggestions: [
      sugg({ suggestionId: 'g_1', sessionId: 's_1', outcome: 'helpful' }),
      sugg({ suggestionId: 'g_2', sessionId: 's_2', date: '2026-11-05', outcome: 'not' }),
      sugg({ suggestionId: 'g_3', sessionId: 's_2', date: '2026-11-05' }),
      sugg({ suggestionId: 'g_old', sessionId: 's_old', date: '2026-10-20', outcome: 'helpful' }),
    ],
    mentorLinks: [
      { linkId: 'l_1', mentorId: 'm', mentorName: 'Dana', clientId: 'c_a', clientName: 'A', status: 'suggested', date: '2026-11-06', createdAt: '', contacted: '' },
      { linkId: 'l_2', mentorId: 'm', mentorName: 'Dana', clientId: 'c_b', clientName: 'B', status: 'introduced', date: '2026-10-01', createdAt: '', contacted: '' },
    ],
  });
  const week = periodFor('week', new Date(2026, 10, 8));

  it('counts sessions, clients, time, suggestions and connections in the period', () => {
    const r = reviewSummary(d, week);
    expect(r.sessions).toBe(3);
    expect(r.clients).toBe(2);
    expect(r.minutes).toBe(97.5);
    expect(r.suggestions.map((g) => g.suggestionId)).toEqual(['g_2', 'g_3', 'g_1']);
    expect(r.counts).toEqual({ all: 3, helpful: 1, not: 1, none: 1 });
    expect(r.links.map((l) => l.linkId)).toEqual(['l_1']);
  });
  it('filters by feedback', () => {
    const r = reviewSummary(d, week);
    expect(filterSuggestions(r.suggestions, 'helpful').map((g) => g.suggestionId)).toEqual(['g_1']);
    expect(filterSuggestions(r.suggestions, 'none').map((g) => g.suggestionId)).toEqual(['g_3']);
  });
  it('is empty for a month with no sessions', () => {
    const r = reviewSummary(d, periodFor('month', new Date(2026, 0, 15)));
    expect(r).toEqual({ sessions: 0, clients: 0, minutes: 0, suggestions: [], links: [], counts: { all: 0, helpful: 0, not: 0, none: 0 } });
  });
});
