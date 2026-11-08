/**
 * Shared.gs — pure helpers with NO Google services: the sheet schema,
 * input validation, row <-> record mapping, bullet lists, id checks and
 * the formula-injection guard.
 *
 * This file is mirrored line-for-line in app/src/shared/connector.ts and
 * the Vitest suite in app/src/shared/connector.test.ts runs the same cases
 * against BOTH this file and the TypeScript copy. If you change one,
 * change the other and run `npm run check` in app/.
 *
 * Do not call SpreadsheetApp, Utilities, PropertiesService, etc. here.
 */

/** Column types:
 *  id        client-generated id with the given prefix ("c", "p", ...)
 *  text      trimmed string, `max` characters
 *  date      YYYY-MM-DD        time  HH:mm
 *  timestamp ISO 8601 with offset (or Z)
 *  int       whole number between `min` and `max`
 *  decimal   number rounded to 1 decimal place, `min`..`max`
 *  bool      true / false
 *  enum      one of `values` (first value is the default)
 *  url       "" or an https:// address
 *  bullets   list of strings; stored in the sheet as "• item" lines
 * `server: true` columns are filled in by the connector, never taken from
 * the app's input.
 * `added: '1.2.0'` marks a column added after the first release; sheets made
 * earlier get it appended to the header automatically (see missingHeaders).
 */
var SCHEMA = {
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

var TAB_NAMES = ['Clients', 'Planned', 'Sessions', 'Suggestions', 'Mentors', 'MentorLinks'];

var BULLET = '• ';
var MAX_BULLETS = 100;
var MAX_BULLET_LENGTH = 1000;

var CONNECTOR_ADDRESS_RE = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/;
var MIN_PASSWORD_LENGTH = 10;

/** The exact header row for a tab. */
function headersFor(tab) {
  return SCHEMA[tab].columns.map(function (c) { return c.name; });
}

/** True for ids like "c_ab12cd34" with the expected prefix. */
function isValidId(id, prefix) {
  return typeof id === 'string' && new RegExp('^' + prefix + '_[A-Za-z0-9_-]{6,64}$').test(id);
}

/** ["a", "b"] -> "• a\n• b". Blank items are dropped. */
function joinBullets(items) {
  return (items || [])
    .map(function (s) { return String(s).replace(/\s+/g, ' ').trim(); })
    .filter(function (s) { return s !== ''; })
    .map(function (s) { return BULLET + s; })
    .join('\n');
}

/** "• a\n• b" -> ["a", "b"]. Also accepts lines typed by hand with -, * or no marker. */
function splitBullets(text) {
  if (text === null || text === undefined) return [];
  return String(text)
    .split(/\r?\n/)
    .map(function (line) { return line.replace(/^\s*(•|-|\*)\s*/, '').trim(); })
    .filter(function (s) { return s !== ''; });
}

/** Stops the sheet treating text as a formula: prefix = + - @ with a quote. */
function escapeCell(value) {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

/** Undo escapeCell if the quote survived the round trip. */
function unescapeCell(value) {
  if (typeof value === 'string' && /^'[=+\-@]/.test(value)) return value.slice(1);
  return value;
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var y = Number(s.slice(0, 4));
  var m = Number(s.slice(5, 7));
  var d = Number(s.slice(8, 10));
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function isValidTimestamp(s) {
  return (
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s) &&
    isValidDate(s.slice(0, 10))
  );
}

function isConnectorAddress(s) {
  return typeof s === 'string' && CONNECTOR_ADDRESS_RE.test(s.trim());
}

function isPlausibleEmail(s) {
  return typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Problems with a new email/password, in plain words. Empty list = OK. */
function checkCredentials(email, password, confirm) {
  var problems = [];
  if (!isPlausibleEmail(email)) problems.push('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    problems.push('Use at least ' + MIN_PASSWORD_LENGTH + ' characters for the password.');
  } else if (password.length > 200) {
    problems.push('That password is too long.');
  }
  if (password !== confirm) problems.push("The two passwords don't match.");
  return problems;
}

/** Empty value for a column (used for blanks and server columns). */
function emptyFor(col) {
  switch (col.type) {
    case 'int':
    case 'decimal': return 0;
    case 'bool': return col.fallback === true;
    case 'bullets': return [];
    case 'enum': return col.values[0];
    default: return '';
  }
}

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/**
 * Checks and cleans one record from the app.
 * Returns {ok:true, value} or {ok:false, message}.
 * Server columns are set to their empty value for the connector to fill.
 */
function validateRecord(tab, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Missing ' + tab + ' details.' };
  }
  var out = {};
  var cols = SCHEMA[tab].columns;
  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    if (col.server) { out[col.name] = emptyFor(col); continue; }
    var raw = input[col.name];
    if (isBlank(raw) || (col.type === 'bullets' && Array.isArray(raw) && raw.length === 0)) {
      if (col.required) return { ok: false, message: col.name + ' is required.' };
      out[col.name] = emptyFor(col);
      continue;
    }
    var r = cleanValue(col, raw);
    if (!r.ok) return { ok: false, message: col.name + ' ' + r.message };
    out[col.name] = r.value;
  }
  return { ok: true, value: out };
}

function cleanValue(col, raw) {
  var s;
  switch (col.type) {
    case 'id':
      return isValidId(raw, col.prefix) ? { ok: true, value: raw } : { ok: false, message: 'is not a valid id.' };
    case 'text':
      if (typeof raw !== 'string') return { ok: false, message: 'must be text.' };
      s = raw.trim();
      if (s.length > col.max) return { ok: false, message: 'is too long (max ' + col.max + ').' };
      return { ok: true, value: s };
    case 'date':
      return isValidDate(raw) ? { ok: true, value: raw } : { ok: false, message: 'must be a date like 2026-11-10.' };
    case 'time':
      return isValidTime(raw) ? { ok: true, value: raw } : { ok: false, message: 'must be a time like 09:30.' };
    case 'timestamp':
      return isValidTimestamp(raw) ? { ok: true, value: raw } : { ok: false, message: 'must be a date and time with an offset.' };
    case 'int':
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < col.min || raw > col.max) {
        return { ok: false, message: 'must be a whole number from ' + col.min + ' to ' + col.max + '.' };
      }
      return { ok: true, value: raw };
    case 'decimal':
      if (typeof raw !== 'number' || !isFinite(raw) || raw < col.min || raw > col.max) {
        return { ok: false, message: 'must be a number from ' + col.min + ' to ' + col.max + '.' };
      }
      return { ok: true, value: Math.round(raw * 10) / 10 };
    case 'bool':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, message: 'must be true or false.' };
    case 'enum':
      return col.values.indexOf(raw) >= 0 ? { ok: true, value: raw } : { ok: false, message: 'must be one of: ' + col.values.join(', ') + '.' };
    case 'url':
      if (typeof raw !== 'string') return { ok: false, message: 'must be text.' };
      s = raw.trim();
      if (!/^https:\/\/\S+$/.test(s)) return { ok: false, message: 'must start with https://' };
      if (s.length > col.max) return { ok: false, message: 'is too long.' };
      return { ok: true, value: s };
    case 'bullets': {
      var items = typeof raw === 'string' ? splitBullets(raw) : raw;
      if (!Array.isArray(items)) return { ok: false, message: 'must be a list.' };
      if (items.length > MAX_BULLETS) return { ok: false, message: 'has too many points.' };
      var clean = [];
      for (var i = 0; i < items.length; i++) {
        if (typeof items[i] !== 'string') return { ok: false, message: 'must be a list of text.' };
        var t = items[i].replace(/\s+/g, ' ').trim();
        if (t.length > MAX_BULLET_LENGTH) return { ok: false, message: 'has a point that is too long.' };
        if (t !== '') clean.push(t);
      }
      return { ok: true, value: clean };
    }
  }
  return { ok: false, message: 'has an unknown type.' };
}

/** Is this cell value from the sheet empty? */
function isEmptyCell(v) {
  return v === '' || v === null || v === undefined;
}

/**
 * Sheet row (values in header order) -> record for the app.
 * Dates/times typed by hand must already be turned into text by the caller.
 */
function rowToRecord(tab, row) {
  var out = {};
  var cols = SCHEMA[tab].columns;
  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    var v = row[i];
    if (isEmptyCell(v)) { out[col.name] = emptyFor(col); continue; }
    switch (col.type) {
      case 'int':
      case 'decimal': {
        var n = Number(v);
        out[col.name] = isFinite(n) ? n : 0;
        break;
      }
      case 'bool':
        out[col.name] = v === true || String(v).trim().toUpperCase() === 'TRUE';
        break;
      case 'bullets':
        out[col.name] = splitBullets(unescapeCell(String(v)));
        break;
      default:
        out[col.name] = String(unescapeCell(typeof v === 'string' ? v : String(v))).trim();
    }
  }
  return out;
}

/** Record -> sheet row (values in header order), with text guarded against formulas. */
function recordToRow(tab, record) {
  return SCHEMA[tab].columns.map(function (col) {
    var v = record[col.name];
    switch (col.type) {
      case 'int':
      case 'decimal':
        return typeof v === 'number' ? v : '';
      case 'bool':
        return v === true;
      case 'bullets':
        return joinBullets(v || []);
      default:
        return isEmptyCell(v) ? '' : escapeCell(String(v));
    }
  });
}

/** Number formats for a row: plain text ("@") for every text-like column. */
function rowFormats(tab) {
  return SCHEMA[tab].columns.map(function (col) {
    if (col.type === 'int' || col.type === 'decimal' || col.type === 'bool') return 'General';
    return '@';
  });
}

/** Do the first cells of the sheet's header row match the schema? */
function headersMatch(tab, actual) {
  var expected = headersFor(tab);
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i] === undefined ? '' : actual[i]).trim() !== expected[i]) return false;
  }
  return true;
}

/**
 * For a sheet made before some columns were added: the header names to
 * append (e.g. ["done", "done_at"]) when the row matches the schema up to
 * those columns and the cells where they go are empty. [] when nothing is
 * missing; null when the header doesn't match (so nothing is changed).
 */
function missingHeaders(tab, actual) {
  var expected = headersFor(tab);
  var cols = SCHEMA[tab].columns;
  var cell = function (i) { return String(actual[i] === undefined || actual[i] === null ? '' : actual[i]).trim(); };
  var i = 0;
  while (i < expected.length && cell(i) === expected[i]) i++;
  if (i === expected.length) return [];
  for (var j = i; j < expected.length; j++) {
    if (!cols[j].added || cell(j) !== '') return null;
  }
  return expected.slice(i);
}
