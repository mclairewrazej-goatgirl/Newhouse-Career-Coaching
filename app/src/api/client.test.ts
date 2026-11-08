import { describe, expect, it, vi } from 'vitest';
import { createApiClient, MESSAGES, parseResponse } from './client';
import { createDemoApi, DEMO_PASSWORD } from './demo';
import { camelToSnake, keysToCamel, keysToSnake, snakeToCamel } from './mapping';
import { ApiError } from './types';
import { createSessionStore, KEYS } from '../state/session';
import { memoryStore } from '../state/storage';

const ADDRESS = 'https://script.google.com/macros/s/AKfy123/exec';

function fakeFetch(body: unknown, init: { status?: number } = {}) {
  return vi.fn<typeof fetch>(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: init.status ?? 200 }));
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof ApiError ? `${e.code}: ${e.message}` : `other: ${String(e)}`;
  }
}

describe('parseResponse', () => {
  it('returns data on ok', () => {
    expect(parseResponse('{"ok":true,"data":{"version":"1.0.0"}}')).toEqual({ version: '1.0.0' });
  });
  it('maps every server error code and keeps its message', () => {
    for (const code of ['AUTH', 'LOCKED', 'BAD_INPUT', 'NOT_FOUND', 'SERVER']) {
      expect(() => parseResponse(JSON.stringify({ ok: false, error: { code, message: 'm' } }))).toThrow(
        expect.objectContaining({ code, message: 'm' }),
      );
    }
  });
  it('treats unknown codes and unreadable answers as SERVER', () => {
    expect(() => parseResponse('{"ok":false,"error":{"code":"WEIRD"}}')).toThrow(
      expect.objectContaining({ code: 'SERVER', message: MESSAGES.unreadable }),
    );
    expect(() => parseResponse('<html>Sign in to Google</html>')).toThrow(expect.objectContaining({ code: 'SERVER' }));
    expect(() => parseResponse('null')).toThrow(expect.objectContaining({ code: 'SERVER' }));
  });
});

describe('createApiClient', () => {
  it('POSTs text/plain JSON with the token, but never sends the token with login', async () => {
    const fetchFn = fakeFetch({ ok: true, data: { clients: [{ client_id: 'c_x0000001', name: 'X', focus: '', active: true, created_at: '' }] } });
    const api = createApiClient({ address: ADDRESS, getToken: () => 'tok', fetchFn });
    const all = await api.getAll();
    expect(all.clients[0]).toEqual({ clientId: 'c_x0000001', name: 'X', focus: '', active: true, createdAt: '' });
    const [url, req] = fetchFn.mock.calls[0];
    expect(url).toBe(ADDRESS);
    expect(req?.method).toBe('POST');
    expect((req?.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/);
    expect(JSON.parse(String(req?.body))).toEqual({ action: 'getAll', token: 'tok' });

    fetchFn.mockClear();
    await codeOf(api.login('a@b.co', 'pw'));
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({
      action: 'login', payload: { email: 'a@b.co', password: 'pw' },
    });
  });

  it('sends snake_case and reads back camelCase', async () => {
    const fetchFn = fakeFetch({ ok: true, data: { planned: { planned_id: 'p_x0000001', client_name: 'X', booked_min: 60 } } });
    const api = createApiClient({ address: ADDRESS, getToken: () => 't', fetchFn });
    const planned = await api.upsertPlanned({
      plannedId: 'p_x0000001', clientId: 'c_x0000001', date: '2026-11-10', startTime: '10:00', bookedMin: 60,
      meetLink: '', status: 'booked',
    });
    expect(planned).toEqual({ plannedId: 'p_x0000001', clientName: 'X', bookedMin: 60 });
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body)).payload.planned).toEqual({
      planned_id: 'p_x0000001', client_id: 'c_x0000001', date: '2026-11-10', start_time: '10:00', booked_min: 60,
      meet_link: '', status: 'booked',
    });
  });

  it('reports a network failure or HTTP error as NETWORK', async () => {
    const down = createApiClient({ address: ADDRESS, getToken: () => null, fetchFn: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) });
    expect(await codeOf(down.ping())).toBe(`NETWORK: ${MESSAGES.network}`);
    const http = createApiClient({ address: ADDRESS, getToken: () => null, fetchFn: fakeFetch('oops', { status: 500 }) });
    expect(await codeOf(http.ping())).toBe(`NETWORK: ${MESSAGES.network}`);
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const hang = vi.fn((_u: RequestInfo | URL, req?: RequestInit) => new Promise<Response>((_res, rej) => {
        req?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      }));
      const api = createApiClient({ address: ADDRESS, getToken: () => null, fetchFn: hang, timeoutMs: 20_000 });
      const result = codeOf(api.ping());
      await vi.advanceTimersByTimeAsync(20_000);
      expect(await result).toBe(`NETWORK: ${MESSAGES.timeout}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls onAuthError for an expired sign-in, but not for a wrong password', async () => {
    const onAuthError = vi.fn();
    const auth = fakeFetch({ ok: false, error: { code: 'AUTH', message: 'Please sign in.' } });
    const api = createApiClient({ address: ADDRESS, getToken: () => 't', fetchFn: auth, onAuthError });
    expect(await codeOf(api.getAll())).toBe('AUTH: Please sign in.');
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(await codeOf(api.login('a@b.co', 'nope'))).toBe('AUTH: Please sign in.');
    expect(onAuthError).toHaveBeenCalledTimes(1);
  });
});

describe('auth redirect', () => {
  it('clears the saved token and sends the app back to sign-in on AUTH', async () => {
    const kv = memoryStore();
    const session = createSessionStore(kv);
    session.link(ADDRESS);
    session.signIn('tok', 'nancy@example.com', '2099-01-01T00:00:00Z');
    expect(session.stage()).toBe('app');

    const api = createApiClient({
      address: ADDRESS, getToken: () => session.token(), fetchFn: fakeFetch({ ok: false, error: { code: 'AUTH', message: 'x' } }),
      onAuthError: () => session.signOut(),
    });
    await codeOf(api.getAll());
    expect(kv.get(KEYS.token)).toBeNull();
    expect(session.stage()).toBe('signin');
    expect(session.email()).toBe('nancy@example.com'); // kept to pre-fill the form
  });
});

describe('session store', () => {
  it('starts unlinked, and linking a different sheet signs out', () => {
    const session = createSessionStore(memoryStore());
    expect(session.stage()).toBe('unlinked');
    session.link(ADDRESS);
    expect(session.stage()).toBe('signin');
    session.signIn('tok', 'a@b.co', '2099-01-01T00:00:00Z');
    session.link(ADDRESS);
    expect(session.token()).toBe('tok');
    session.link(ADDRESS.replace('AKfy123', 'Other'));
    expect(session.token()).toBeNull();
  });
  it('ignores a saved address that is not a connector address', () => {
    const session = createSessionStore(memoryStore({ [KEYS.connector]: 'https://evil.example.com/exec' }));
    expect(session.stage()).toBe('unlinked');
  });
  it('treats an expired sign-in as signed out', () => {
    const session = createSessionStore(memoryStore(), () => Date.parse('2026-12-09T00:00:00Z'));
    session.link(ADDRESS);
    session.signIn('tok', 'a@b.co', '2026-12-08T00:00:00Z');
    expect(session.stage()).toBe('signin');
  });
});

describe('mapping', () => {
  it('converts keys both ways', () => {
    expect(snakeToCamel('outcome_at')).toBe('outcomeAt');
    expect(camelToSnake('mentorLinks')).toBe('mentor_links');
    expect(keysToSnake({ nextSteps: ['a'], plannedId: '', createdAt: undefined })).toEqual({ next_steps: ['a'], planned_id: '' });
    expect(keysToCamel({ next_steps: ['a'] })).toEqual({ nextSteps: ['a'] });
  });
});

describe('demo api', () => {
  it('needs the demo password and locks after five wrong tries', async () => {
    const api = createDemoApi({ latencyMs: 0 });
    expect(await codeOf(api.getAll())).toMatch(/^AUTH/);
    for (let i = 0; i < 4; i++) expect(await codeOf(api.login('a@b.co', 'wrong'))).toMatch(/^AUTH/);
    expect(await codeOf(api.login('a@b.co', 'wrong'))).toMatch(/^LOCKED/);
    expect(await codeOf(api.login('a@b.co', DEMO_PASSWORD))).toMatch(/^LOCKED/);
  });
  it('serves the sample data once signed in', async () => {
    const api = createDemoApi({ latencyMs: 0 });
    await api.login('nancy@example.com', DEMO_PASSWORD);
    const all = await api.getAll();
    expect(all.clients.map((c) => c.name)).toEqual(['Jordan Reyes', 'Priya Nair', 'Sam Okafor', 'Morgan Lee']);
    expect(all.clients.filter((c) => !c.active)).toHaveLength(1);
    expect(all.mentors.map((m) => m.name)).toEqual(['Dana Lee', 'Marcus Chen', 'Aisha Rahman']);
    expect(all.mentorLinks.filter((l) => l.mentorId === 'm_dana0001')).toHaveLength(3);
  });
});
