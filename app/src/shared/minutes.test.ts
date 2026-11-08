import { describe, expect, it } from 'vitest';
import { formatMinutes } from './minutes';

describe('formatMinutes', () => {
  it('shows minutes only under an hour', () => {
    expect(formatMinutes(45)).toBe('45 min');
  });
  it('shows hours and padded minutes', () => {
    expect(formatMinutes(65)).toBe('1 h 05 min');
  });
  it('rounds and never goes negative', () => {
    expect(formatMinutes(47.5)).toBe('48 min');
    expect(formatMinutes(-3)).toBe('0 min');
  });
});
