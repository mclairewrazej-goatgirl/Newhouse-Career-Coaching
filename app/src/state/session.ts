/**
 * Which sheet this device is linked to, and who is signed in.
 * Plain functions over a key-value store so it can be tested without React.
 */
import { isConnectorAddress } from '../shared/connector';
import type { KeyValueStore } from './storage';
import { LIVE_KEY } from './live';
import { SYNC_KEYS } from './sync';

export const KEYS = {
  connector: 'ct.connector',
  token: 'ct.token',
  email: 'ct.email',
  expiresAt: 'ct.expiresAt',
} as const;

export type Stage = 'unlinked' | 'signin' | 'app';

export interface SessionStore {
  connector(): string | null;
  /** Saves the sheet address. Linking to a different sheet signs the device out. */
  link(address: string): void;
  token(): string | null;
  email(): string | null;
  signIn(token: string, email: string, expiresAt: string): void;
  signOut(): void;
  stage(): Stage;
}

export function createSessionStore(store: KeyValueStore, now: () => number = Date.now): SessionStore {
  const self: SessionStore = {
    connector() {
      const v = store.get(KEYS.connector);
      return v && isConnectorAddress(v) ? v : null;
    },
    link(address) {
      if (store.get(KEYS.connector) !== address) {
        self.signOut();
        // A different sheet: the saved copy and waiting changes belong to the old one.
        Object.values(SYNC_KEYS).forEach((k) => store.remove(k));
        store.remove(LIVE_KEY);
        store.set(KEYS.connector, address);
      }
    },
    token() {
      const token = store.get(KEYS.token);
      const exp = Date.parse(store.get(KEYS.expiresAt) ?? '');
      if (!token) return null;
      if (Number.isFinite(exp) && exp <= now()) return null;
      return token;
    },
    email() {
      return store.get(KEYS.email);
    },
    signIn(token, email, expiresAt) {
      store.set(KEYS.token, token);
      store.set(KEYS.email, email);
      store.set(KEYS.expiresAt, expiresAt);
    },
    signOut() {
      store.remove(KEYS.token);
      store.remove(KEYS.expiresAt);
    },
    stage() {
      if (!self.connector()) return 'unlinked';
      return self.token() ? 'app' : 'signin';
    },
  };
  return self;
}
