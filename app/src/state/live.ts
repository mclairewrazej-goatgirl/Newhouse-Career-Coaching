/**
 * The session being run right now. Saved to the device on every change so
 * the timer and notes survive refreshes, app switching and a flat battery.
 */
import { useSyncExternalStore } from 'react';
import type { Planned } from '../api/types';
import { toDateString } from '../shared/dates';
import { newId } from '../shared/ids';
import { NEW_TIMER, type TimerState } from '../shared/timer';
import type { KeyValueStore } from './storage';

export const LIVE_KEY = 'ct.live';

export interface LiveSession {
  sessionId: string;
  plannedId: string;
  clientId: string;
  date: string;
  startTime: string;
  bookedMin: number;
  meetLink: string;
  timer: TimerState;
  covered: string[];
  nextSteps: string[];
}

export function liveFromPlanned(p: Planned): LiveSession {
  return {
    sessionId: newId('s'), plannedId: p.plannedId, clientId: p.clientId, date: p.date, startTime: p.startTime,
    bookedMin: p.bookedMin, meetLink: p.meetLink, timer: { ...NEW_TIMER }, covered: [], nextSteps: [],
  };
}

export function liveUnplanned(clientId: string, bookedMin: number, now: Date = new Date()): LiveSession {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    sessionId: newId('s'), plannedId: '', clientId, date: toDateString(now), startTime: `${hh}:${mm}`, bookedMin,
    meetLink: '', timer: { ...NEW_TIMER }, covered: [], nextSteps: [],
  };
}

export class LiveStore {
  private value: LiveSession | null;
  private listeners = new Set<() => void>();

  constructor(private store: KeyValueStore) {
    let v: LiveSession | null = null;
    try { v = JSON.parse(store.get(LIVE_KEY) ?? 'null'); } catch { v = null; }
    this.value = v && typeof v === 'object' && v.sessionId ? v : null;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  get = (): LiveSession | null => this.value;

  set(next: LiveSession | null): void {
    this.value = next;
    if (next) this.store.set(LIVE_KEY, JSON.stringify(next));
    else this.store.remove(LIVE_KEY);
    this.listeners.forEach((fn) => fn());
  }

  update(fn: (s: LiveSession) => LiveSession): void {
    if (this.value) this.set(fn(this.value));
  }

  clear(): void {
    this.set(null);
  }
}

export function useLive(store: LiveStore): LiveSession | null {
  return useSyncExternalStore(store.subscribe, store.get);
}
