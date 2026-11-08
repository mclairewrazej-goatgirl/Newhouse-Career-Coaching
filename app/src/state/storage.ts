/** localStorage that never throws (private windows, blocked storage). */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function browserStore(): KeyValueStore {
  return {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ }
    },
  };
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => { data.set(key, value); },
    remove: (key) => { data.delete(key); },
  };
}
