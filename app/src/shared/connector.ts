/**
 * Mirror of apps-script/Shared.gs: the sheet schema, validation, row <->
 * record mapping, bullet lists, id checks and the formula guard.
 *
 * Keep this file and Shared.gs in step. connector.test.ts runs the same
 * cases against both, so a drift shows up as a failing test.
 *
 * Records here use the sheet's snake_case column names (that is also what
 * the connector sends and receives). The app's camelCase types are mapped
 * from these in src/api/ (Phase 2).
 */

export type ColumnType =
  | 'id' | 'text' | 'date' | 'time' | 'timestamp'
  | 'int' | 'decimal' | 'bool' | 'enum' | 'url' | 'bullets';

export interface Column {
  name: string;
  type: ColumnType;
  prefix?: string;
  required?: boolean;
  server?: boolean;
  max?: number;
  min?: number;
  values?: string[];
  fallback?: boolean;
  /** Connector version that added this column; older sheets get it appended (see missingHeaders). */
  added?: string;
}

export type TabName = 'Clients' | 'Planned' | 'Sessions' | 'Suggestions' | 'Mentors' | 'MentorLinks';

export type CellValue = string | number | boolean | null | undefined;
export type RecordValue = string | number | boolean | string[];
export type SheetRecord = Record<string, RecordValue>;

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export const SCHEMA: Record<TabName, { key: string; columns: Column[] }> = {
  Clients: {
    key: 'client_id',
    columns: [
      { name: 'client_id', type: 'id', prefix: 'c', required: true },
      { name: 'name', type: 'text', max: 200, required: true },
      { name: 'focus', type: 'text', max: 1000 },
      { name: 'active', type: 'bool', fallback: true },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  Planned: {
    key: 'planned_id',
    columns: [
      { name: 'planned_id', type: 'id', prefix: 'p', required: true },
      { name: 'client_id', type: 'id', prefix: 'c', required: true },
      { name: 'client_name', type: 'text', max: 200, server: true },
      { name: 'date', type: 'date', required: true },
      { name: 'start_time', type: 'time', required: true },
      { name: 'booked_min', type: 'int', min: 1, max: 1440, required: true },
      { name: 'meet_link', type: 'url', max: 500 },
      { name: 'status', type: 'enum', values: ['booked', 'logged', 'cancelled'] },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  Sessions: {
    key: 'session_id',
    columns: [
      { name: 'session_id', type: 'id', prefix: 's', required: true },
      { name: 'client_id', type: 'id', prefix: 'c', required: true },
      { name: 'client_name', type: 'text', max: 200, server: true },
      { name: 'date', type: 'date', required: true },
      { name: 'booked_min', type: 'int', min: 1, max: 1440, required: true },
      { name: 'actual_min', type: 'decimal', min: 0, max: 1440, required: true },
      { name: 'timed', type: 'bool', fallback: false },
      { name: 'covered', type: 'bullets' },
      { name: 'next_steps', type: 'bullets' },
      { name: 'planned_id', type: 'id', prefix: 'p' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  Suggestions: {
    key: 'suggestion_id',
    columns: [
      { name: 'suggestion_id', type: 'id', prefix: 'g', required: true },
      { name: 'session_id', type: 'id', prefix: 's', server: true },
      { name: 'client_id', type: 'id', prefix: 'c', server: true },
      { name: 'client_name', type: 'text', max: 200, server: true },
      { name: 'date', type: 'date', server: true },
      { name: 'text', type: 'text', max: 1000, required: true },
      { name: 'outcome', type: 'enum', values: ['', 'helpful', 'not'], server: true },
      { name: 'outcome_at', type: 'timestamp', server: true },
      { name: 'done', type: 'enum', values: ['', 'yes', 'no'], server: true, added: '1.2.0' },
      { name: 'done_at', type: 'timestamp', server: true, added: '1.2.0' },
    ],
  },
  Mentors: {
    key: 'mentor_id',
    columns: [
      { name: 'mentor_id', type: 'id', prefix: 'm', required: true },
      { name: 'name', type: 'text', max: 200, required: true },
      { name: 'role', type: 'text', max: 200 },
      { name: 'organization', type: 'text', max: 200 },
      { name: 'email', type: 'text', max: 254 },
      { name: 'phone', type: 'text', max: 50 },
      { name: 'notes', type: 'text', max: 5000 },
      { name: 'active', type: 'bool', fallback: true },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  MentorLinks: {
    key: 'link_id',
    columns: [
      { name: 'link_id', type: 'id', prefix: 'l', required: true },
      { name: 'mentor_id', type: 'id', prefix: 'm', required: true },
      { name: 'mentor_name', type: 'text', max: 200, server: true },
      { name: 'client_id', type: 'id', prefix: 'c', required: true },
      { name: 'client_name', type: 'text', max: 200, server: true },
      { name: 'status', type: 'enum', values: ['suggested', 'introduced'] },
      { name: 'date', type: 'date', required: true },
      { name: 'created_at', type: 'timestamp' },
      { name: 'contacted', type: 'enum', values: ['', 'yes', 'no'], added: '1.2.0' },
      { name: 'contacted_on', type: 'date', added: '1.3.0' },
    ],
  },
};

export const TAB_NAMES: TabName[] = ['Clients', 'Planned', 'Sessions', 'Suggestions', 'Mentors', 'MentorLinks'];

export const BULLET = '• ';
export const MAX_BULLETS = 100;
export const MAX_BULLET_LENGTH = 1000;

export const CONNECTOR_ADDRESS_RE = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/;
export const MIN_PASSWORD_LENGTH = 10;

export function headersFor(tab: TabName): string[] {
  return SCHEMA[tab].columns.map((c) => c.name);
}

export function isValidId(id: unknown, prefix: string): boolean {
  return typeof id === 'string' && new RegExp('^' + prefix + '_[A-Za-z0-9_-]{6,64}$').test(id);
}

export function joinBullets(items: readonly string[] | null | undefined): string {
  return (items || [])
    .map((s) => String(s).replace(/\s+/g, ' ').trim())
    .filter((s) => s !== '')
    .map((s) => BULLET + s)
    .join('\n');
}

export function splitBullets(text: string | null | undefined): string[] {
  if (text === null || text === undefined) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(•|-|\*)\s*/, '').trim())
    .filter((s) => s !== '');
}

export function escapeCell<T>(value: T): T | string {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

export function unescapeCell<T>(value: T): T | string {
  if (typeof value === 'string' && /^'[=+\-@]/.test(value)) return value.slice(1);
  return value;
}

export function isValidDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(s: unknown): boolean {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isValidTimestamp(s: unknown): boolean {
  return (
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s) &&
    isValidDate(s.slice(0, 10))
  );
}

export function isConnectorAddress(s: unknown): boolean {
  return typeof s === 'string' && CONNECTOR_ADDRESS_RE.test(s.trim());
}

export function isPlausibleEmail(s: unknown): boolean {
  return typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function checkCredentials(email: unknown, password: unknown, confirm: unknown): string[] {
  const problems: string[] = [];
  if (!isPlausibleEmail(email)) problems.push('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    problems.push('Use at least ' + MIN_PASSWORD_LENGTH + ' characters for the password.');
  } else if (password.length > 200) {
    problems.push('That password is too long.');
  }
  if (password !== confirm) problems.push("The two passwords don't match.");
  return problems;
}

export function emptyFor(col: Column): RecordValue {
  switch (col.type) {
    case 'int':
    case 'decimal': return 0;
    case 'bool': return col.fallback === true;
    case 'bullets': return [];
    case 'enum': return (col.values ?? [''])[0];
    default: return '';
  }
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

export function validateRecord(tab: TabName, input: unknown): Result<SheetRecord> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Missing ' + tab + ' details.' };
  }
  const src = input as Record<string, unknown>;
  const out: SheetRecord = {};
  for (const col of SCHEMA[tab].columns) {
    if (col.server) { out[col.name] = emptyFor(col); continue; }
    const raw = src[col.name];
    if (isBlank(raw) || (col.type === 'bullets' && Array.isArray(raw) && raw.length === 0)) {
      if (col.required) return { ok: false, message: col.name + ' is required.' };
      out[col.name] = emptyFor(col);
      continue;
    }
    const r = cleanValue(col, raw);
    if (!r.ok) return { ok: false, message: col.name + ' ' + r.message };
    out[col.name] = r.value;
  }
  return { ok: true, value: out };
}

export function cleanValue(col: Column, raw: unknown): Result<RecordValue> {
  const max = col.max ?? Infinity;
  const min = col.min ?? -Infinity;
  switch (col.type) {
    case 'id':
      return isValidId(raw, col.prefix ?? '') ? { ok: true, value: raw as string } : { ok: false, message: 'is not a valid id.' };
    case 'text': {
      if (typeof raw !== 'string') return { ok: false, message: 'must be text.' };
      const s = raw.trim();
      if (s.length > max) return { ok: false, message: 'is too long (max ' + max + ').' };
      return { ok: true, value: s };
    }
    case 'date':
      return isValidDate(raw) ? { ok: true, value: raw as string } : { ok: false, message: 'must be a date like 2026-11-10.' };
    case 'time':
      return isValidTime(raw) ? { ok: true, value: raw as string } : { ok: false, message: 'must be a time like 09:30.' };
    case 'timestamp':
      return isValidTimestamp(raw) ? { ok: true, value: raw as string } : { ok: false, message: 'must be a date and time with an offset.' };
    case 'int':
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
        return { ok: false, message: 'must be a whole number from ' + min + ' to ' + max + '.' };
      }
      return { ok: true, value: raw };
    case 'decimal':
      if (typeof raw !== 'number' || !isFinite(raw) || raw < min || raw > max) {
        return { ok: false, message: 'must be a number from ' + min + ' to ' + max + '.' };
      }
      return { ok: true, value: Math.round(raw * 10) / 10 };
    case 'bool':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, message: 'must be true or false.' };
    case 'enum': {
      const values = col.values ?? [];
      return typeof raw === 'string' && values.indexOf(raw) >= 0
        ? { ok: true, value: raw }
        : { ok: false, message: 'must be one of: ' + values.join(', ') + '.' };
    }
    case 'url': {
      if (typeof raw !== 'string') return { ok: false, message: 'must be text.' };
      const s = raw.trim();
      if (!/^https:\/\/\S+$/.test(s)) return { ok: false, message: 'must start with https://' };
      if (s.length > max) return { ok: false, message: 'is too long.' };
      return { ok: true, value: s };
    }
    case 'bullets': {
      const items: unknown = typeof raw === 'string' ? splitBullets(raw) : raw;
      if (!Array.isArray(items)) return { ok: false, message: 'must be a list.' };
      if (items.length > MAX_BULLETS) return { ok: false, message: 'has too many points.' };
      const clean: string[] = [];
      for (const item of items) {
        if (typeof item !== 'string') return { ok: false, message: 'must be a list of text.' };
        const t = item.replace(/\s+/g, ' ').trim();
        if (t.length > MAX_BULLET_LENGTH) return { ok: false, message: 'has a point that is too long.' };
        if (t !== '') clean.push(t);
      }
      return { ok: true, value: clean };
    }
  }
  return { ok: false, message: 'has an unknown type.' };
}

function isEmptyCell(v: unknown): boolean {
  return v === '' || v === null || v === undefined;
}

export function rowToRecord(tab: TabName, row: readonly CellValue[]): SheetRecord {
  const out: SheetRecord = {};
  SCHEMA[tab].columns.forEach((col, i) => {
    const v = row[i];
    if (isEmptyCell(v)) { out[col.name] = emptyFor(col); return; }
    switch (col.type) {
      case 'int':
      case 'decimal': {
        const n = Number(v);
        out[col.name] = isFinite(n) ? n : 0;
        break;
      }
      case 'bool':
        out[col.name] = v === true || String(v).trim().toUpperCase() === 'TRUE';
        break;
      case 'bullets':
        out[col.name] = splitBullets(String(unescapeCell(String(v))));
        break;
      default:
        out[col.name] = String(unescapeCell(String(v))).trim();
    }
  });
  return out;
}

export function recordToRow(tab: TabName, record: Partial<SheetRecord>): (string | number | boolean)[] {
  return SCHEMA[tab].columns.map((col) => {
    const v = record[col.name];
    switch (col.type) {
      case 'int':
      case 'decimal':
        return typeof v === 'number' ? v : '';
      case 'bool':
        return v === true;
      case 'bullets':
        return joinBullets(Array.isArray(v) ? v : []);
      default:
        return isEmptyCell(v) ? '' : escapeCell(String(v));
    }
  });
}

export function rowFormats(tab: TabName): string[] {
  return SCHEMA[tab].columns.map((col) =>
    col.type === 'int' || col.type === 'decimal' || col.type === 'bool' ? 'General' : '@',
  );
}

export function headersMatch(tab: TabName, actual: readonly CellValue[]): boolean {
  const expected = headersFor(tab);
  for (let i = 0; i < expected.length; i++) {
    if (String(actual[i] === undefined ? '' : actual[i]).trim() !== expected[i]) return false;
  }
  return true;
}

/**
 * For a sheet made before some columns were added: the header names to
 * append when the row matches the schema up to those columns and the cells
 * where they go are empty. [] when nothing is missing; null when the header
 * doesn't match (so nothing is changed).
 */
export function missingHeaders(tab: TabName, actual: readonly CellValue[]): string[] | null {
  const expected = headersFor(tab);
  const cols = SCHEMA[tab].columns;
  const cell = (i: number) => String(actual[i] === undefined || actual[i] === null ? '' : actual[i]).trim();
  let i = 0;
  while (i < expected.length && cell(i) === expected[i]) i++;
  if (i === expected.length) return [];
  for (let j = i; j < expected.length; j++) {
    if (!cols[j].added || cell(j) !== '') return null;
  }
  return expected.slice(i);
}
