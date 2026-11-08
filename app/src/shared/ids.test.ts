import { describe, expect, it } from 'vitest';
import { isValidId, isValidTimestamp } from './connector';
import { newId, nowIsoWithOffset } from './ids';

describe('ids', () => {
  it('makes ids the connector accepts', () => {
    for (const p of ['c', 'p', 's', 'g', 'm', 'l'] as const) expect(isValidId(newId(p), p)).toBe(true);
  });
  it('is random', () => {
    expect(new Set(Array.from({ length: 200 }, () => newId('c'))).size).toBe(200);
  });
  it('makes timestamps the connector accepts', () => {
    expect(isValidTimestamp(nowIsoWithOffset())).toBe(true);
  });
});
