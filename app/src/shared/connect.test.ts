import { describe, expect, it } from 'vitest';
import {
  decodeBase64Url, decodeConnectParam, encodeBase64Url, readConnectFromSearch, searchWithoutConnect,
} from './connect';

const ADDRESS = 'https://script.google.com/macros/s/AKfycbx123-_abc/exec';
// What the sheet's Utilities.base64EncodeWebSafe gives, with "=" padding removed.
const FROM_SHEET = 'aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5MTIzL2V4ZWM';

describe('connect parameter', () => {
  it('decodes the link the sheet makes', () => {
    expect(decodeConnectParam(FROM_SHEET)).toBe('https://script.google.com/macros/s/AKfy123/exec');
  });
  it('round-trips with padding or without', () => {
    const enc = encodeBase64Url(ADDRESS);
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeConnectParam(enc)).toBe(ADDRESS);
    expect(decodeConnectParam(enc + '=')).toBe(ADDRESS);
  });
  it('rejects anything that is not a connector address', () => {
    expect(decodeConnectParam(encodeBase64Url('https://evil.example.com/exec'))).toBeNull();
    expect(decodeConnectParam(encodeBase64Url(ADDRESS.replace('/exec', '/dev')))).toBeNull();
    expect(decodeConnectParam('not base64!')).toBeNull();
    expect(decodeConnectParam('a')).toBeNull();
    expect(decodeConnectParam('')).toBeNull();
    expect(decodeConnectParam(null)).toBeNull();
  });
  it('rejects bytes that are not text', () => {
    expect(decodeBase64Url('_w')).toBeNull();
  });
  it('reads it from the address bar', () => {
    expect(readConnectFromSearch('')).toEqual({ kind: 'none' });
    expect(readConnectFromSearch('?connect=' + encodeBase64Url(ADDRESS))).toEqual({ kind: 'address', address: ADDRESS });
    expect(readConnectFromSearch('?connect=junk')).toEqual({ kind: 'invalid' });
  });
  it('removes only the connect parameter', () => {
    expect(searchWithoutConnect('?connect=abc')).toBe('');
    expect(searchWithoutConnect('?x=1&connect=abc')).toBe('?x=1');
  });
});
