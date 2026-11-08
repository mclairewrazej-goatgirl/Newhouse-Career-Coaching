import { describe, expect, it } from 'vitest';
import { allDataFromWire } from '../api/mapping';
import { applyOp, emptyData } from './ops';

const base = () => {
  let d = applyOp(emptyData(), { action: 'upsertClient', client: { clientId: 'c_jordan01', name: 'Jordan', focus: '', active: true } });
  d = applyOp(d, {
    action: 'logSession',
    session: { sessionId: 's_sess0001', clientId: 'c_jordan01', date: '2026-11-01', bookedMin: 60, actualMin: 50, timed: true, covered: [], nextSteps: [], plannedId: '' },
    suggestions: [{ suggestionId: 'g_sugg0001', text: 'Reach out to two contacts' }],
  });
  return d;
};

describe('did they do it', () => {
  it('starts unanswered, can be set and cleared', () => {
    let d = base();
    expect(d.suggestions[0]).toMatchObject({ done: '', doneAt: '' });
    d = applyOp(d, { action: 'setSuggestionDone', suggestionId: 'g_sugg0001', done: 'no' });
    expect(d.suggestions[0].done).toBe('no');
    expect(d.suggestions[0].doneAt).not.toBe('');
    d = applyOp(d, { action: 'setSuggestionDone', suggestionId: 'g_sugg0001', done: '' });
    expect(d.suggestions[0]).toMatchObject({ done: '', doneAt: '' });
  });
  it('is kept when the same session is logged again', () => {
    let d = applyOp(base(), { action: 'setSuggestionDone', suggestionId: 'g_sugg0001', done: 'yes' });
    d = applyOp(d, {
      action: 'logSession',
      session: { sessionId: 's_sess0001', clientId: 'c_jordan01', date: '2026-11-01', bookedMin: 60, actualMin: 50, timed: true, covered: [], nextSteps: [], plannedId: '' },
      suggestions: [{ suggestionId: 'g_sugg0001', text: 'Reach out to two contacts' }],
    });
    expect(d.suggestions[0].done).toBe('yes');
  });
});

describe('made contact', () => {
  it('is saved on the mentor link', () => {
    let d = applyOp(base(), { action: 'upsertMentor', mentor: { mentorId: 'm_dana0001', name: 'Dana', role: '', organization: '', email: '', phone: '', notes: '', active: true } });
    d = applyOp(d, { action: 'upsertMentorLink', link: { linkId: 'l_link0001', mentorId: 'm_dana0001', clientId: 'c_jordan01', status: 'suggested', date: '2026-11-01', contacted: '', contactedOn: '' } });
    d = applyOp(d, { action: 'upsertMentorLink', link: { linkId: 'l_link0001', mentorId: 'm_dana0001', clientId: 'c_jordan01', status: 'suggested', date: '2026-11-01', contacted: 'yes', contactedOn: '' } });
    expect(d.mentorLinks).toEqual([expect.objectContaining({ contacted: 'yes', date: '2026-11-01' })]);
  });
});

describe('a sheet on an older connector', () => {
  it('reads missing columns as unanswered', () => {
    const d = allDataFromWire({
      suggestions: [{ suggestion_id: 'g_1', text: 'x', outcome: 'helpful', outcome_at: '' }],
      mentorLinks: [{ link_id: 'l_1', status: 'suggested' }],
    });
    expect(d.suggestions[0]).toMatchObject({ outcome: 'helpful', done: '', doneAt: '' });
    expect(d.mentorLinks[0]).toMatchObject({ contacted: '', contactedOn: '' });
  });
});
