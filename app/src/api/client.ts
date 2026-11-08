/**
 * Talks to the coach's sheet. Requests are POSTed as text/plain so the
 * browser sends them without a CORS preflight, which the sheet can't answer.
 */
import { allDataFromWire, keysToCamel, keysToSnake } from './mapping';
import {
  ApiError, type Api, type ApiErrorCode, type Client, type LoginResult, type Mentor, type MentorLink,
  type Planned, type Session, type Suggestion,
} from './types';

export const REQUEST_TIMEOUT_MS = 20_000;

export const MESSAGES = {
  network: "Can't reach your sheet. Check your internet connection and try again.",
  timeout: 'Your sheet took too long to answer. Please try again.',
  unreadable: 'Your sheet sent an answer the app could not read. Please try again.',
} as const;

const SERVER_CODES: ApiErrorCode[] = ['AUTH', 'LOCKED', 'BAD_INPUT', 'NOT_FOUND', 'SERVER'];

export interface ApiClientOptions {
  /** The sheet's connector address (…/exec). */
  address: string;
  getToken: () => string | null;
  /** Called when the sheet says the sign-in is missing or expired (not for a failed login). */
  onAuthError?: (error: ApiError) => void;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

type Json = Record<string, unknown>;

/** Turns a raw response body into data, or throws an ApiError. Exported for tests. */
export function parseResponse(text: string): unknown {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('SERVER', MESSAGES.unreadable);
  }
  if (!body || typeof body !== 'object') throw new ApiError('SERVER', MESSAGES.unreadable);
  const b = body as { ok?: unknown; data?: unknown; error?: { code?: unknown; message?: unknown } };
  if (b.ok === true) return b.data ?? {};
  const code = SERVER_CODES.includes(b.error?.code as ApiErrorCode) ? (b.error!.code as ApiErrorCode) : 'SERVER';
  const message = typeof b.error?.message === 'string' && b.error.message ? b.error.message : MESSAGES.unreadable;
  throw new ApiError(code, message);
}

export function createApiClient(options: ApiClientOptions): Api {
  const fetchFn = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  async function call(action: string, payload?: Json): Promise<Json> {
    const body: Json = { action };
    const token = options.getToken();
    if (token && action !== 'login' && action !== 'ping') body.token = token;
    if (payload) body.payload = payload;

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    let text: string;
    try {
      const res = await fetchFn(options.address, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) throw new ApiError('NETWORK', MESSAGES.network);
      text = await res.text();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('NETWORK', timedOut ? MESSAGES.timeout : MESSAGES.network);
    } finally {
      clearTimeout(timer);
    }

    try {
      return (parseResponse(text) ?? {}) as Json;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTH' && action !== 'login') options.onAuthError?.(err);
      throw err;
    }
  }

  const one = <T>(data: Json, key: string): T => keysToCamel<T>((data[key] ?? {}) as Json);

  return {
    async ping() {
      const d = await call('ping');
      return { version: String(d.version ?? '') };
    },
    async login(email, password) {
      const d = await call('login', { email, password });
      return d as unknown as LoginResult;
    },
    async logout() {
      await call('logout');
    },
    async getAll() {
      return allDataFromWire(await call('getAll'));
    },
    async upsertClient(client) {
      return one<Client>(await call('upsertClient', { client: keysToSnake(client) }), 'client');
    },
    async upsertPlanned(planned) {
      return one<Planned>(await call('upsertPlanned', { planned: keysToSnake(planned) }), 'planned');
    },
    async cancelPlanned(plannedId) {
      await call('cancelPlanned', { planned_id: plannedId });
    },
    async logSession(session, suggestions) {
      const d = await call('logSession', {
        session: keysToSnake(session),
        suggestions: suggestions.map((s) => keysToSnake(s)),
      });
      const list = Array.isArray(d.suggestions) ? d.suggestions : [];
      return {
        session: one<Session>(d, 'session'),
        suggestions: list.map((s) => keysToCamel<Suggestion>(s as Json)),
      };
    },
    async setSuggestionOutcome(suggestionId, outcome) {
      return one<Suggestion>(await call('setSuggestionOutcome', { suggestion_id: suggestionId, outcome }), 'suggestion');
    },
    async upsertMentor(mentor) {
      return one<Mentor>(await call('upsertMentor', { mentor: keysToSnake(mentor) }), 'mentor');
    },
    async upsertMentorLink(link) {
      return one<MentorLink>(await call('upsertMentorLink', { link: keysToSnake(link) }), 'link');
    },
    async deleteMentorLink(linkId) {
      await call('deleteMentorLink', { link_id: linkId });
    },
  };
}
