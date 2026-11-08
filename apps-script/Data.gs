/**
 * Data.gs — reads and writes the Clients, Planned, Sessions, Suggestions,
 * Mentors and MentorLinks tabs, mapping rows to records by the schema in
 * Shared.gs. Implements every data action in the API contract.
 *
 * Rules:
 *  - Every write holds the script lock, so two devices can't interleave.
 *  - Ids come from the app, so a retried write with the same id updates
 *    the same row instead of adding a duplicate.
 *  - *_name columns are copied from Clients/Mentors and kept in sync when
 *    a name changes.
 */

var SPREADSHEET_ID_KEY_ = 'spreadsheet_id';

function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY_);
  if (id) return SpreadsheetApp.openById(id);
  throw apiError_('SERVER', "Can't find your sheet. Open it and choose Coaching Tracker › 1. Prepare my sheet.");
}

function tz_() {
  return ss_().getSpreadsheetTimeZone();
}

/** Now, as ISO 8601 with the sheet's offset, e.g. 2026-11-08T10:05:00-07:00. */
function nowIso_() {
  return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** A Date typed into a cell by hand -> the text form the schema expects. */
function dateCellToText_(value, col, tz) {
  if (col.type === 'date') return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  if (col.type === 'time') return Utilities.formatDate(value, tz, 'HH:mm');
  return Utilities.formatDate(value, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** Runs fn while holding the script lock. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    throw apiError_('SERVER', 'Your sheet is busy. Please try again in a moment.');
  }
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function validated_(tab, input) {
  var r = validateRecord(tab, input);
  if (!r.ok) throw apiError_('BAD_INPUT', r.message);
  return r.value;
}

function requireId_(id, prefix, what) {
  if (!isValidId(id, prefix)) throw apiError_('BAD_INPUT', what + ' is not a valid id.');
  return id;
}

/* ---------- Tables ---------- */

/**
 * Loads a tab: {tab, sheet, records[], rowNums[], index{id -> i}}.
 * Rows with a blank id are skipped (e.g. left over from hand edits).
 */
function loadTable_(tab) {
  var sheet = ss_().getSheetByName(tab);
  if (!sheet) {
    throw apiError_('SERVER', 'Your sheet is missing the ' + tab + ' tab. Choose Coaching Tracker › 1. Prepare my sheet.');
  }
  var cols = SCHEMA[tab].columns;
  var lastRow = sheet.getLastRow();
  var header = lastRow >= 1 ? sheet.getRange(1, 1, 1, cols.length).getValues()[0] : [];
  if (!headersMatch(tab, header)) {
    throw apiError_('SERVER', 'The first row of the ' + tab + ' tab has been changed. It should read: ' + headersFor(tab).join(', ') + '.');
  }
  var t = { tab: tab, sheet: sheet, records: [], rowNums: [], index: {} };
  if (lastRow < 2) return t;

  var tz = tz_();
  var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  var keyCol = 0; // every tab's id is its first column
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (row[keyCol] === '' || row[keyCol] === null) continue;
    for (var c = 0; c < cols.length; c++) {
      if (row[c] instanceof Date) row[c] = dateCellToText_(row[c], cols[c], tz);
    }
    var rec = rowToRecord(tab, row);
    var key = rec[SCHEMA[tab].key];
    if (Object.prototype.hasOwnProperty.call(t.index, key)) continue; // keep the first copy of a duplicated id
    t.index[key] = t.records.length;
    t.records.push(rec);
    t.rowNums.push(r + 2);
  }
  return t;
}

function find_(t, id) {
  return Object.prototype.hasOwnProperty.call(t.index, id) ? t.records[t.index[id]] : null;
}

/** Writes rec over its existing row (matched by id) or appends a new row. */
function save_(t, rec) {
  var key = rec[SCHEMA[t.tab].key];
  var cols = SCHEMA[t.tab].columns.length;
  var rowNum;
  if (Object.prototype.hasOwnProperty.call(t.index, key)) {
    var i = t.index[key];
    rowNum = t.rowNums[i];
    t.records[i] = rec;
  } else {
    rowNum = Math.max(t.sheet.getLastRow(), 1) + 1;
    t.index[key] = t.records.length;
    t.records.push(rec);
    t.rowNums.push(rowNum);
  }
  t.sheet
    .getRange(rowNum, 1, 1, cols)
    .setNumberFormats([rowFormats(t.tab)])
    .setValues([recordToRow(t.tab, rec)]);
  return rec;
}

/** Deletes rows by id. Call last: row numbers in `t` are stale afterwards. */
function deleteRows_(t, ids) {
  var rows = ids
    .filter(function (id) { return Object.prototype.hasOwnProperty.call(t.index, id); })
    .map(function (id) { return t.rowNums[t.index[id]]; })
    .sort(function (a, b) { return b - a; });
  rows.forEach(function (rowNum) { t.sheet.deleteRow(rowNum); });
}

/** Copies a new name into the *_name column of every row that points at id. */
function syncName_(tabs, idCol, id, nameCol, name) {
  tabs.forEach(function (tab) {
    var t = loadTable_(tab);
    var colIdx = headersFor(tab).indexOf(nameCol) + 1;
    for (var i = 0; i < t.records.length; i++) {
      if (t.records[i][idCol] === id && t.records[i][nameCol] !== name) {
        t.sheet.getRange(t.rowNums[i], colIdx).setNumberFormat('@').setValue(escapeCell(name));
      }
    }
  });
}

/** created_at: keep the stored one; otherwise use the app's, or now. */
function keepCreatedAt_(rec, existing) {
  rec.created_at = (existing && existing.created_at) || rec.created_at || nowIso_();
}

/* ---------- Actions ---------- */

function getAll_() {
  var ss = ss_();
  return {
    clients: loadTable_('Clients').records,
    planned: loadTable_('Planned').records,
    sessions: loadTable_('Sessions').records,
    suggestions: loadTable_('Suggestions').records,
    mentors: loadTable_('Mentors').records,
    mentorLinks: loadTable_('MentorLinks').records,
    sheetUrl: ss.getUrl(),
    sheetName: ss.getName(),
  };
}

function upsertClient_(p) {
  var rec = validated_('Clients', p.client);
  return withLock_(function () {
    var t = loadTable_('Clients');
    var existing = find_(t, rec.client_id);
    keepCreatedAt_(rec, existing);
    save_(t, rec);
    if (existing && existing.name !== rec.name) {
      syncName_(['Planned', 'Sessions', 'Suggestions', 'MentorLinks'], 'client_id', rec.client_id, 'client_name', rec.name);
    }
    return { client: rec };
  });
}

function clientOrThrow_(clientId) {
  var client = find_(loadTable_('Clients'), clientId);
  if (!client) throw apiError_('NOT_FOUND', "That client isn't in your sheet.");
  return client;
}

function upsertPlanned_(p) {
  var rec = validated_('Planned', p.planned);
  var statusGiven = p.planned && typeof p.planned.status === 'string' && p.planned.status !== '';
  return withLock_(function () {
    rec.client_name = clientOrThrow_(rec.client_id).name;
    var t = loadTable_('Planned');
    var existing = find_(t, rec.planned_id);
    if (existing && !statusGiven) rec.status = existing.status;
    keepCreatedAt_(rec, existing);
    save_(t, rec);
    return { planned: rec };
  });
}

function cancelPlanned_(p) {
  var id = requireId_(p.planned_id, 'p', 'planned_id');
  return withLock_(function () {
    var t = loadTable_('Planned');
    var existing = find_(t, id);
    if (!existing) throw apiError_('NOT_FOUND', "That planned session isn't in your sheet.");
    existing.status = 'cancelled';
    save_(t, existing);
    return {};
  });
}

function logSession_(p) {
  var rec = validated_('Sessions', p.session);
  var input = p.suggestions === undefined || p.suggestions === null ? [] : p.suggestions;
  if (!Array.isArray(input)) throw apiError_('BAD_INPUT', 'suggestions must be a list.');
  if (input.length > MAX_BULLETS) throw apiError_('BAD_INPUT', 'Too many next steps.');
  var suggestions = input.map(function (s) { return validated_('Suggestions', s); });

  return withLock_(function () {
    var client = clientOrThrow_(rec.client_id);
    rec.client_name = client.name;
    // Sessions.next_steps is a readable copy of the Suggestions rows.
    if (suggestions.length) rec.next_steps = suggestions.map(function (s) { return s.text; });

    var sessions = loadTable_('Sessions');
    var existing = find_(sessions, rec.session_id);
    keepCreatedAt_(rec, existing);
    save_(sessions, rec);

    var sTable = loadTable_('Suggestions');
    var keep = {};
    var saved = suggestions.map(function (s) {
      var old = find_(sTable, s.suggestion_id);
      s.session_id = rec.session_id;
      s.client_id = rec.client_id;
      s.client_name = rec.client_name;
      s.date = rec.date;
      s.outcome = old ? old.outcome : '';
      s.outcome_at = old ? old.outcome_at : '';
      keep[s.suggestion_id] = true;
      return save_(sTable, s);
    });

    if (rec.planned_id) {
      var planned = loadTable_('Planned');
      var plan = find_(planned, rec.planned_id);
      // If the planned row was deleted by hand, still log the session.
      if (plan && plan.status !== 'logged') {
        plan.status = 'logged';
        save_(planned, plan);
      }
    }

    // Logging the same session again replaces its list of next steps.
    if (existing) {
      var stale = sTable.records
        .filter(function (s) { return s.session_id === rec.session_id && !keep[s.suggestion_id]; })
        .map(function (s) { return s.suggestion_id; });
      deleteRows_(sTable, stale);
    }
    return { session: rec, suggestions: saved };
  });
}

function setSuggestionOutcome_(p) {
  var id = requireId_(p.suggestion_id, 'g', 'suggestion_id');
  var outcome = p.outcome === undefined || p.outcome === null ? '' : p.outcome;
  if (['', 'helpful', 'not'].indexOf(outcome) < 0) {
    throw apiError_('BAD_INPUT', 'outcome must be "", "helpful" or "not".');
  }
  return withLock_(function () {
    var t = loadTable_('Suggestions');
    var s = find_(t, id);
    if (!s) throw apiError_('NOT_FOUND', "That suggestion isn't in your sheet.");
    s.outcome = outcome;
    s.outcome_at = outcome ? nowIso_() : '';
    save_(t, s);
    return { suggestion: s };
  });
}

function upsertMentor_(p) {
  var rec = validated_('Mentors', p.mentor);
  return withLock_(function () {
    var t = loadTable_('Mentors');
    var existing = find_(t, rec.mentor_id);
    keepCreatedAt_(rec, existing);
    save_(t, rec);
    if (existing && existing.name !== rec.name) {
      syncName_(['MentorLinks'], 'mentor_id', rec.mentor_id, 'mentor_name', rec.name);
    }
    return { mentor: rec };
  });
}

/** One row per mentor + client: connecting them again updates that row. */
function upsertMentorLink_(p) {
  var rec = validated_('MentorLinks', p.link);
  var statusGiven = p.link && typeof p.link.status === 'string' && p.link.status !== '';
  return withLock_(function () {
    var mentor = find_(loadTable_('Mentors'), rec.mentor_id);
    if (!mentor) throw apiError_('NOT_FOUND', "That mentor isn't in your sheet.");
    rec.mentor_name = mentor.name;
    rec.client_name = clientOrThrow_(rec.client_id).name;

    var t = loadTable_('MentorLinks');
    var existing = null;
    for (var i = 0; i < t.records.length; i++) {
      if (t.records[i].mentor_id === rec.mentor_id && t.records[i].client_id === rec.client_id) {
        existing = t.records[i];
        break;
      }
    }
    if (!existing) existing = find_(t, rec.link_id);
    if (existing) {
      rec.link_id = existing.link_id;
      if (!statusGiven) rec.status = existing.status;
    }
    keepCreatedAt_(rec, existing);
    save_(t, rec);
    return { link: rec };
  });
}

function deleteMentorLink_(p) {
  var id = requireId_(p.link_id, 'l', 'link_id');
  return withLock_(function () {
    // Deleting something already gone is fine: a retried delete must not fail.
    deleteRows_(loadTable_('MentorLinks'), [id]);
    return {};
  });
}
