import { describe, expect, it } from 'vitest';
import { LIVE_KEY, liveFromPlanned, liveUnplanned, LiveStore } from './live';
import { memoryStore } from './storage';

describe('LiveStore', () => {
  it('saves every change so a reload picks up where it left off', () => {
    const kv = memoryStore();
    const a = new LiveStore(kv);
    a.set(liveUnplanned('c_jordan01', 45, new Date(2026, 10, 8, 9, 5)));
    a.update((s) => ({ ...s, covered: ['Intro'], timer: { startedAt: 1000, accumulatedMs: 0, everStarted: true } }));
    const b = new LiveStore(kv);
    expect(b.get()).toMatchObject({ clientId: 'c_jordan01', date: '2026-11-08', startTime: '09:05', bookedMin: 45, covered: ['Intro'] });
    expect(b.get()?.timer.startedAt).toBe(1000);
    b.clear();
    expect(kv.get(LIVE_KEY)).toBeNull();
  });
  it('starts from a planned session', () => {
    const s = liveFromPlanned({
      plannedId: 'p_x0000001', clientId: 'c_a', clientName: 'A', date: '2026-11-10', startTime: '10:00', bookedMin: 60,
      meetLink: 'https://meet.google.com/x', status: 'booked', createdAt: '',
    });
    expect(s).toMatchObject({ plannedId: 'p_x0000001', bookedMin: 60, meetLink: 'https://meet.google.com/x', timer: { everStarted: false } });
    expect(s.sessionId).toMatch(/^s_/);
  });
  it('ignores a damaged saved value', () => {
    expect(new LiveStore(memoryStore({ [LIVE_KEY]: '{oops' })).get()).toBeNull();
  });
});
