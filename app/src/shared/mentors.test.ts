import { describe, expect, it } from 'vitest';
import type { MentorLink } from '../api/types';
import {
  emailHint, latestLink, mentorConnections, needsBreak, phoneHint, recentFrom, recentUseCount, telHref, usageLabel,
} from './mentors';

const link = (over: Partial<MentorLink>): MentorLink => ({
  linkId: 'l_x', mentorId: 'm_dana', mentorName: 'Dana', clientId: 'c_a', clientName: 'A', status: 'suggested',
  date: '2026-11-01', createdAt: '', ...over,
});

describe('recent use (90-day window)', () => {
  const today = new Date(2026, 10, 8); // Nov 8 2026
  it('starts the window 89 days before today', () => {
    expect(recentFrom(today)).toBe('2026-08-11');
  });
  it('counts links inside the window, including today and the first day', () => {
    const links = [
      link({ date: '2026-11-08' }),
      link({ date: '2026-08-11' }), // day 90: counts
      link({ date: '2026-08-10' }), // day 91: too old
      link({ date: '2026-11-09' }), // future-dated: ignored
      link({ mentorId: 'm_other', date: '2026-11-01' }),
    ];
    expect(recentUseCount('m_dana', links, today)).toBe(2);
  });
  it('warns at the threshold', () => {
    expect(needsBreak(2)).toBe(false);
    expect(needsBreak(3)).toBe(true);
    expect(usageLabel(0)).toBe('Not used lately');
    expect(usageLabel(2)).toBe('2 in 90 days');
    expect(usageLabel(3)).toBe('3 in 90 days · rest');
  });
});

describe('connections', () => {
  it('finds the latest link', () => {
    const links = [link({ linkId: 'l_1', date: '2026-10-01' }), link({ linkId: 'l_2', date: '2026-11-03' })];
    expect(latestLink('m_dana', links)?.linkId).toBe('l_2');
    expect(latestLink('m_none', links)).toBeNull();
  });
  it('marks archived clients as past clients', () => {
    const rows = mentorConnections('m_dana', [link({ clientId: 'c_old' }), link({ clientId: 'c_a', date: '2026-11-05' })], [
      { clientId: 'c_a', name: 'A', focus: '', active: true, createdAt: '' },
      { clientId: 'c_old', name: 'Old', focus: '', active: false, createdAt: '' },
    ]);
    expect(rows.map((r) => [r.link.clientId, r.pastClient])).toEqual([['c_a', false], ['c_old', true]]);
  });
});

describe('contact hints', () => {
  it('never blocks, only hints', () => {
    expect(emailHint('')).toBe('');
    expect(emailHint('dana@example.com')).toBe('');
    expect(emailHint('dana at example')).toMatch(/doesn't look complete/);
    expect(phoneHint('403-555-0142')).toBe('');
    expect(phoneHint('555')).toMatch(/short/);
  });
  it('builds tel: links', () => {
    expect(telHref('(403) 555-0142 ext 2')).toBe('tel:4035550142');
    expect(telHref('+1 403 555 0142')).toBe('tel:+14035550142');
  });
});
