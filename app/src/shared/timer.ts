/**
 * Session timer worked out from timestamps, never by counting ticks, so it
 * stays right through refreshes, app switching and screen lock.
 */
export interface TimerState {
  /** When the current running stretch began (ms since epoch), or null when paused/not started. */
  startedAt: number | null;
  /** Time from earlier stretches, before the last pause. */
  accumulatedMs: number;
  /** Has the timer ever been started? (false -> the session is logged as untimed) */
  everStarted: boolean;
}

export const NEW_TIMER: TimerState = { startedAt: null, accumulatedMs: 0, everStarted: false };

export const isRunning = (t: TimerState): boolean => t.startedAt !== null;

export function elapsedMs(t: TimerState, now: number): number {
  return t.accumulatedMs + (t.startedAt !== null ? Math.max(0, now - t.startedAt) : 0);
}

export function start(t: TimerState, now: number): TimerState {
  return t.startedAt !== null ? t : { ...t, startedAt: now, everStarted: true };
}

export function pause(t: TimerState, now: number): TimerState {
  return t.startedAt === null ? t : { ...t, accumulatedMs: elapsedMs(t, now), startedAt: null };
}

export function reset(): TimerState {
  return { ...NEW_TIMER };
}

/** Minutes to 1 decimal place, as stored in Sessions.actual_min. */
export function elapsedMinutes(t: TimerState, now: number): number {
  return Math.round(elapsedMs(t, now) / 6000) / 10;
}

/** "07:05" or "1:02:09". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Share of the booked time used, 0..1 (capped), and whether it has gone over. */
export function progress(elapsed: number, bookedMin: number): { fraction: number; over: boolean } {
  const booked = Math.max(1, bookedMin) * 60_000;
  return { fraction: Math.min(1, elapsed / booked), over: elapsed > booked };
}
