import { describe, expect, it } from 'vitest';
import { addDays, toDateString } from './dates';

describe('dates', () => {
  it('formats local dates', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('adds days across month and year ends', () => {
    expect(toDateString(addDays(new Date(2026, 11, 30), 3))).toBe('2027-01-02');
    expect(toDateString(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });
});
