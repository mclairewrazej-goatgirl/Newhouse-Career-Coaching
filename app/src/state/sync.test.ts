import { describe, expect, it, vi } from 'vitest';
import { createDemoApi, DEMO_PASSWORD } from '../api/demo';
import { ApiError, type Api, type ClientInput } from '../api/types';
import { applyOp, emptyData } from './ops';
import { memoryStore } from './storage';
import { retryDelay, SYNC_KEYS, SyncEngine } from './sync';

const client = (id: string, name: string): ClientInput => ({ clientId: id, name, focus: '', active: true, createdAt: '2026-11-08T10:00:00-07:00' });

/** A demo sheet we can switch "offline", recording every call that reaches it. */
async function fakeSheet() {
  const api = createDemoApi({ latencyMs: 0 });
  await api.login('nancy@example.com', DEMO_PASSWORD);
  const calls: string[] = [];
  let offline = false;
  let failNext: ApiError | null = null;
  const wrapped = new Proxy(api, {
    get(target, prop: keyof Api) {
      const fn = target[prop] as (...a: unknown[]) => Promise<unknown>;
      return async (...args: unknown[]) => {
        if (offline) throw new ApiError('NETWORK', 'offline');
        if (failNext) { const e = failNext; failNext = null; throw e; }
        calls.push(String(prop));
        return fn.apply(target, args);
      };
    },
  }) as Api;
  return {
    api: wrapped, calls,
    setOffline: (v: boolean) => { offline = v; },
    failOnce: (e: ApiError) => { failNext = e; },
  };
}

function manualTimers() {
  const timers: { fn: () => void; ms: number }[] = [];
  return {
    timers,
    setTimer: (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: vi.fn(),
    fire: async () => { const t = timers.shift(); t?.fn(); await new Promise((r) => setTimeout(r, 20)); },
  };
}

describe('SyncEngine', () => {
  it('loads from the sheet and caches it for next time', async () => {
    const sheet = await fakeSheet();
    const store = memoryStore();
    const engine = new SyncEngine({ api: sheet.api, store, now: () => 1000 });
    expect(engine.getSnapshot().data).toBeNull();
    await engine.refresh();
    expect(engine.getSnapshot().data?.clients).toHaveLength(4);
    expect(engine.getSnapshot().status).toEqual({ kind: 'synced' });

    const again = new SyncEngine({ api: sheet.api, store });
    expect(again.getSnapshot().data?.clients).toHaveLength(4);
    expect(again.getSnapshot().lastSyncedAt).toBe(1000);
  });

  it('shows a change at once and sends changes in the order they were made', async () => {
    const sheet = await fakeSheet();
    const t = manualTimers();
    const engine = new SyncEngine({ api: sheet.api, store: memoryStore(), ...t });
    await engine.refresh();
    sheet.calls.length = 0;

    sheet.setOffline(true);
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    engine.enqueue({
      action: 'upsertPlanned',
      planned: { plannedId: 'p_new00001', clientId: 'c_new00001', date: '2026-11-12', startTime: '10:00', bookedMin: 45, meetLink: '', status: 'booked' },
    });
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex K.') });
    await engine.flush();

    const snap = engine.getSnapshot();
    expect(snap.data?.clients.find((c) => c.clientId === 'c_new00001')?.name).toBe('Alex K.');
    expect(snap.data?.planned.find((p) => p.plannedId === 'p_new00001')?.clientName).toBe('Alex K.');
    expect(snap.status).toEqual({ kind: 'offline', count: 3 });
    expect(sheet.calls).toEqual([]);

    sheet.setOffline(false);
    await engine.flush();
    expect(sheet.calls).toEqual(['upsertClient', 'upsertPlanned', 'upsertClient']);
    expect(engine.getSnapshot().status).toEqual({ kind: 'synced' });

    await engine.refresh();
    const planned = engine.getSnapshot().data?.planned.find((p) => p.plannedId === 'p_new00001');
    expect(planned?.clientName).toBe('Alex K.');
  });

  it('retries with growing waits while offline, then sends', async () => {
    const sheet = await fakeSheet();
    const t = manualTimers();
    const engine = new SyncEngine({ api: sheet.api, store: memoryStore(), ...t });
    await engine.refresh();
    sheet.setOffline(true);
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    await engine.flush();
    expect(t.timers.map((x) => x.ms)).toEqual([2000]);
    await t.fire();
    expect(t.timers.map((x) => x.ms)).toEqual([4000]);
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(retryDelay)).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);

    sheet.setOffline(false);
    await t.fire();
    expect(engine.getSnapshot().status).toEqual({ kind: 'synced' });
  });

  it('never duplicates a row when a change is sent again', async () => {
    const sheet = await fakeSheet();
    const store = memoryStore();
    const engine = new SyncEngine({ api: sheet.api, store });
    await engine.refresh();
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    await engine.flush();

    // Simulate the app closing after the sheet saved but before the outbox was cleared:
    // the same change is sent again on the next start.
    store.set(SYNC_KEYS.outbox, JSON.stringify([{ seq: 9, op: { action: 'upsertClient', client: client('c_new00001', 'Alex Kim') }, attempts: 1 }]));
    const restarted = new SyncEngine({ api: sheet.api, store });
    await restarted.refresh();
    const all = await sheet.api.getAll();
    expect(all.clients.filter((c) => c.clientId === 'c_new00001')).toHaveLength(1);
    expect(restarted.getSnapshot().data?.clients.filter((c) => c.clientId === 'c_new00001')).toHaveLength(1);
  });

  it('keeps waiting changes across a restart', async () => {
    const sheet = await fakeSheet();
    const store = memoryStore();
    const engine = new SyncEngine({ api: sheet.api, store, ...manualTimers() });
    await engine.refresh();
    sheet.setOffline(true);
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    await engine.flush();

    const restarted = new SyncEngine({ api: sheet.api, store });
    expect(restarted.getSnapshot().data?.clients.some((c) => c.clientId === 'c_new00001')).toBe(true);
    expect(restarted.getSnapshot().status.kind).toBe('pending');
    sheet.setOffline(false);
    await restarted.refresh();
    expect((await sheet.api.getAll()).clients.some((c) => c.clientId === 'c_new00001')).toBe(true);
  });

  it('does not reload over changes that are still waiting', async () => {
    const sheet = await fakeSheet();
    const engine = new SyncEngine({ api: sheet.api, store: memoryStore(), ...manualTimers() });
    await engine.refresh();
    sheet.setOffline(true);
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    await engine.refresh();
    expect(sheet.calls.filter((c) => c === 'getAll')).toHaveLength(1);
    expect(engine.getSnapshot().data?.clients.some((c) => c.clientId === 'c_new00001')).toBe(true);
  });

  it('sets aside a change the sheet refuses and carries on with the rest', async () => {
    const sheet = await fakeSheet();
    const engine = new SyncEngine({ api: sheet.api, store: memoryStore() });
    await engine.refresh();
    sheet.failOnce(new ApiError('BAD_INPUT', 'name is required.'));
    engine.enqueue({ action: 'upsertClient', client: client('c_bad00001', '') });
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    await engine.flush();
    const snap = engine.getSnapshot();
    expect(snap.status).toEqual({ kind: 'error', count: 0, message: 'name is required.' });
    expect(snap.data?.clients.some((c) => c.clientId === 'c_bad00001')).toBe(false);
    expect(snap.data?.clients.some((c) => c.clientId === 'c_new00001')).toBe(true);
    engine.dismissFailed();
    expect(engine.getSnapshot().status).toEqual({ kind: 'synced' });
  });

  it('pauses on an expired sign-in and resumes after signing in', async () => {
    const sheet = await fakeSheet();
    const t = manualTimers();
    const engine = new SyncEngine({ api: sheet.api, store: memoryStore(), ...t });
    await engine.refresh();
    sheet.failOnce(new ApiError('AUTH', 'Please sign in.'));
    engine.enqueue({ action: 'upsertClient', client: client('c_new00001', 'Alex Kim') });
    await engine.flush();
    expect(engine.getSnapshot().status).toEqual({ kind: 'pending', count: 1 });
    expect(t.timers).toHaveLength(0);
    await engine.refresh();
    expect(engine.getSnapshot().status).toEqual({ kind: 'synced' });
  });

  it('forgets everything on sign-out', async () => {
    const sheet = await fakeSheet();
    const store = memoryStore();
    const engine = new SyncEngine({ api: sheet.api, store });
    await engine.refresh();
    engine.clear();
    expect(engine.getSnapshot().data).toBeNull();
    expect(Object.values(SYNC_KEYS).map((k) => store.get(k))).toEqual([null, null, null]);
  });
});

describe('applyOp', () => {
  it('logging a session marks its planned row logged and lists its next steps', () => {
    let d = applyOp(emptyData(), { action: 'upsertClient', client: client('c_jordan01', 'Jordan') });
    d = applyOp(d, {
      action: 'upsertPlanned',
      planned: { plannedId: 'p_plan0001', clientId: 'c_jordan01', date: '2026-11-10', startTime: '10:00', bookedMin: 60, meetLink: '', status: 'booked' },
    });
    d = applyOp(d, {
      action: 'logSession',
      session: { sessionId: 's_sess0001', clientId: 'c_jordan01', date: '2026-11-10', bookedMin: 60, actualMin: 50, timed: true, covered: ['A'], nextSteps: [], plannedId: 'p_plan0001' },
      suggestions: [{ suggestionId: 'g_sugg0001', text: 'Do X' }],
    });
    expect(d.planned[0].status).toBe('logged');
    expect(d.sessions[0]).toMatchObject({ clientName: 'Jordan', nextSteps: ['Do X'] });
    expect(d.suggestions[0]).toMatchObject({ sessionId: 's_sess0001', clientName: 'Jordan', outcome: '' });
  });
  it('connecting the same mentor and client again updates the one row', () => {
    let d = applyOp(emptyData(), { action: 'upsertClient', client: client('c_jordan01', 'Jordan') });
    d = applyOp(d, { action: 'upsertMentor', mentor: { mentorId: 'm_dana0001', name: 'Dana', role: '', organization: '', email: '', phone: '', notes: '', active: true } });
    d = applyOp(d, { action: 'upsertMentorLink', link: { linkId: 'l_link0001', mentorId: 'm_dana0001', clientId: 'c_jordan01', status: 'suggested', date: '2026-11-01' } });
    d = applyOp(d, { action: 'upsertMentorLink', link: { linkId: 'l_link0002', mentorId: 'm_dana0001', clientId: 'c_jordan01', status: 'introduced', date: '2026-11-05' } });
    expect(d.mentorLinks).toEqual([expect.objectContaining({ linkId: 'l_link0001', status: 'introduced', date: '2026-11-05', mentorName: 'Dana' })]);
  });
});
