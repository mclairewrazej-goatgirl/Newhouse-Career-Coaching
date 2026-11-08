/**
 * The one place where the connector's snake_case records become the app's
 * camelCase types and back.
 */
import type {
  AllData, Client, Mentor, MentorLink, Planned, Session, Suggestion,
} from './types';

type Json = Record<string, unknown>;

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

/** Renames the keys of a flat record. Values are left as they are. */
export function keysToCamel<T>(record: Json): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(record)) out[snakeToCamel(k)] = v;
  return out as T;
}

export function keysToSnake(record: object): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) out[camelToSnake(k)] = v;
  }
  return out;
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? value.map((r) => keysToCamel<T>(r as Json)) : []);

export function allDataFromWire(data: Json): AllData {
  return {
    clients: list<Client>(data.clients),
    planned: list<Planned>(data.planned),
    sessions: list<Session>(data.sessions),
    suggestions: list<Suggestion>(data.suggestions).map((s) => ({ ...s, done: s.done ?? '', doneAt: s.doneAt ?? '' })),
    mentors: list<Mentor>(data.mentors),
    mentorLinks: list<MentorLink>(data.mentorLinks).map((l) => ({ ...l, contacted: l.contacted ?? '', contactedOn: l.contactedOn ?? '' })),
    sheetUrl: typeof data.sheetUrl === 'string' ? data.sheetUrl : '',
    sheetName: typeof data.sheetName === 'string' ? data.sheetName : '',
  };
}
