import { isConnectorAddress } from './connector';

/** base64url (no padding) of a text string. */
export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes base64url (with or without padding). Returns null if it isn't valid. */
export function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) return null;
  const b64 = value.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (b64.length % 4 === 1) return null;
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** The personal app link's ?connect= value -> connector address, or null if it isn't one. */
export function decodeConnectParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const address = decodeBase64Url(value.trim());
  return address !== null && isConnectorAddress(address) ? address.trim() : null;
}

export type ConnectResult =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'address'; address: string };

/** Reads ?connect= from a query string like location.search. */
export function readConnectFromSearch(search: string): ConnectResult {
  const params = new URLSearchParams(search);
  if (!params.has('connect')) return { kind: 'none' };
  const address = decodeConnectParam(params.get('connect'));
  return address ? { kind: 'address', address } : { kind: 'invalid' };
}

/** The same query string without ?connect= (other parameters kept). */
export function searchWithoutConnect(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('connect');
  const rest = params.toString();
  return rest ? '?' + rest : '';
}
