import { describe, expect, it } from 'vitest';
import { elapsedMinutes, elapsedMs, formatClock, NEW_TIMER, pause, progress, reset, start } from './timer';

describe('timer', () => {
  it('measures from timestamps across pauses', () => {
    let t = start(NEW_TIMER, 1_000);
    expect(elapsedMs(t, 61_000)).toBe(60_000);
    t = pause(t, 61_000);
    expect(elapsedMs(t, 999_999)).toBe(60_000); // paused: no change however long
    t = start(t, 100_000);
    expect(elapsedMs(t, 130_000)).toBe(90_000);
    expect(t.everStarted).toBe(true);
  });
  it('survives a reload because the state is plain data', () => {
    const t = start(NEW_TIMER, 0);
    const reloaded = JSON.parse(JSON.stringify(t));
    expect(elapsedMs(reloaded, 5 * 60_000)).toBe(5 * 60_000);
  });
  it('ignores double start and double pause', () => {
    const t = start(NEW_TIMER, 0);
    expect(start(t, 50)).toBe(t);
    const p = pause(t, 10);
    expect(pause(p, 20)).toBe(p);
  });
  it('resets', () => {
    expect(reset()).toEqual(NEW_TIMER);
  });
  it('gives minutes to 1 decimal', () => {
    expect(elapsedMinutes(start(NEW_TIMER, 0), 47 * 60_000 + 29_000)).toBe(47.5);
  });
  it('formats the clock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(425_000)).toBe('07:05');
    expect(formatClock(3_729_000)).toBe('1:02:09');
  });
  it('reports progress and going over', () => {
    expect(progress(30 * 60_000, 60)).toEqual({ fraction: 0.5, over: false });
    expect(progress(61 * 60_000, 60)).toEqual({ fraction: 1, over: true });
  });
});
