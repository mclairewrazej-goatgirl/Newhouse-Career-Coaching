const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export type IdPrefix = 'c' | 'p' | 's' | 'g' | 'm' | 'l';

/** A new client-generated id like "c_k3x9q0m2a7bd" (12 random characters). */
export function newId(prefix: IdPrefix, random: (n: number) => Uint8Array = randomBytes): string {
  const bytes = random(12);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Now as ISO 8601 with the device's offset, e.g. 2026-11-08T10:05:00-07:00. */
export function nowIsoWithOffset(d: Date = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}
