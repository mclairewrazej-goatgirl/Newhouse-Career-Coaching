import { describe, expect, it } from 'vitest';
import sharedGs from '../../../apps-script/Shared.gs?raw';
import * as ts from './connector';

/**
 * Loads apps-script/Shared.gs (plain JavaScript, no Google services) so the
 * same tests run against the connector's real code and the app's mirror.
 */
function loadGs(): typeof ts {
  const names = [
    'SCHEMA', 'TAB_NAMES', 'headersFor', 'isValidId', 'joinBullets', 'splitBullets',
    'escapeCell', 'unescapeCell', 'isValidDate', 'isValidTime', 'isValidTimestamp',
    'isConnectorAddress', 'isPlausibleEmail', 'checkCredentials', 'validateRecord',
    'rowToRecord', 'recordToRow', 'rowFormats', 'headersMatch', 'missingHeaders',
  ];
  const factory = new Function(`${sharedGs}\nreturn { ${names.join(', ')} };`);
  return factory() as typeof ts;
}

const gs = loadGs();

const NOW = '2026-11-08T10:05:00-06:00';

describe.each([
  ['TypeScript mirror', ts],
  ['Shared.gs', gs],
])('%s', (_label, impl) => {
  describe('schema', () => {
    it('has the exact header rows from CLAUDE.md', () => {
      expect(impl.headersFor('Clients')).toEqual(['client_id', 'name', 'focus', 'active', 'created_at']);
      expect(impl.headersFor('Planned')).toEqual([
        'planned_id', 'client_id', 'client_name', 'date', 'start_time', 'booked_min', 'meet_link', 'status', 'created_at',
      ]);
      expect(impl.headersFor('Sessions')).toEqual([
        'session_id', 'client_id', 'client_name', 'date', 'booked_min', 'actual_min', 'timed', 'covered', 'next_steps',
        'planned_id', 'created_at',
      ]);
      expect(impl.headersFor('Suggestions')).toEqual([
        'suggestion_id', 'session_id', 'client_id', 'client_name', 'date', 'text', 'outcome', 'outcome_at', 'done', 'done_at',
      ]);
      expect(impl.headersFor('Mentors')).toEqual([
        'mentor_id', 'name', 'role', 'organization', 'email', 'phone', 'notes', 'active', 'created_at',
      ]);
      expect(impl.headersFor('MentorLinks')).toEqual([
        'link_id', 'mentor_id', 'mentor_name', 'client_id', 'client_name', 'status', 'date', 'created_at', 'contacted', 'contacted_on',
      ]);
    });

    it('matches the schema between the two copies', () => {
      expect(impl.SCHEMA).toEqual(ts.SCHEMA);
      expect(impl.TAB_NAMES).toEqual(ts.TAB_NAMES);
    });

    it('checks a header row, ignoring extra columns to the right', () => {
      expect(impl.headersMatch('Clients', ['client_id', 'name', 'focus', 'active', 'created_at', 'my notes'])).toBe(true);
      expect(impl.headersMatch('Clients', ['client_id', 'Name', 'focus', 'active', 'created_at'])).toBe(false);
      expect(impl.headersMatch('Clients', ['client_id', 'name'])).toBe(false);
    });

    it('finds columns added since a sheet was made, and nothing else', () => {
      const old = ['suggestion_id', 'session_id', 'client_id', 'client_name', 'date', 'text', 'outcome', 'outcome_at'];
      expect(impl.missingHeaders('Suggestions', old)).toEqual(['done', 'done_at']);
      expect(impl.missingHeaders('Suggestions', [...old, 'done', '', ''])).toEqual(['done_at']);
      expect(impl.missingHeaders('Suggestions', [...old, 'done', 'done_at'])).toEqual([]);
      // Something else is where the new column would go: leave it alone.
      expect(impl.missingHeaders('Suggestions', [...old, 'my notes'])).toBeNull();
      // Columns from the first release are never added automatically.
      expect(impl.missingHeaders('Clients', ['client_id', 'name', 'focus', 'active'])).toBeNull();
      expect(impl.missingHeaders('MentorLinks', ['link_id', 'mentor_id', 'mentor_name', 'client_id', 'client_name', 'status', 'date', 'created_at']))
        .toEqual(['contacted', 'contacted_on']);
    });
  });

  describe('ids', () => {
    it('accepts the right prefix and rejects others', () => {
      expect(impl.isValidId('c_8f2a91bc', 'c')).toBe(true);
      expect(impl.isValidId('c_8f2a-91_bc', 'c')).toBe(true);
      expect(impl.isValidId('p_8f2a91bc', 'c')).toBe(false);
      expect(impl.isValidId('c_abc', 'c')).toBe(false);
      expect(impl.isValidId('c_has space1', 'c')).toBe(false);
      expect(impl.isValidId('c_=HYPERLINK', 'c')).toBe(false);
      expect(impl.isValidId(42, 'c')).toBe(false);
    });
  });

  describe('bullets', () => {
    it('joins with "• " lines and drops blanks', () => {
      expect(impl.joinBullets(['Case study is solid', '  ', 'Send  draft\nby Friday'])).toBe(
        '• Case study is solid\n• Send draft by Friday',
      );
      expect(impl.joinBullets([])).toBe('');
    });
    it('splits back, tolerating hand-typed lines', () => {
      expect(impl.splitBullets('• One\n• Two')).toEqual(['One', 'Two']);
      expect(impl.splitBullets('- One\r\n* Two\nThree\n\n')).toEqual(['One', 'Two', 'Three']);
      expect(impl.splitBullets('')).toEqual([]);
      expect(impl.splitBullets(null)).toEqual([]);
    });
    it('round-trips', () => {
      const items = ['Add two quotes', 'Book a coffee chat with Dana'];
      expect(impl.splitBullets(impl.joinBullets(items))).toEqual(items);
    });
  });

  describe('formula guard', () => {
    it('quotes text that would start a formula', () => {
      expect(impl.escapeCell('=IMPORTXML("x")')).toBe(`'=IMPORTXML("x")`);
      expect(impl.escapeCell('+1 403-555-0142')).toBe(`'+1 403-555-0142`);
      expect(impl.escapeCell('-ish')).toBe(`'-ish`);
      expect(impl.escapeCell('@home')).toBe(`'@home`);
      expect(impl.escapeCell('Jordan')).toBe('Jordan');
      expect(impl.escapeCell(5)).toBe(5);
    });
    it('removes the quote again on the way back', () => {
      expect(impl.unescapeCell(`'+1 403-555-0142`)).toBe('+1 403-555-0142');
      expect(impl.unescapeCell(`'tis`)).toBe(`'tis`);
    });
  });

  describe('dates and times', () => {
    it('validates real calendar dates', () => {
      expect(impl.isValidDate('2026-11-10')).toBe(true);
      expect(impl.isValidDate('2028-02-29')).toBe(true);
      expect(impl.isValidDate('2026-02-29')).toBe(false);
      expect(impl.isValidDate('2026-13-01')).toBe(false);
      expect(impl.isValidDate('10/11/2026')).toBe(false);
    });
    it('validates 24-hour times', () => {
      expect(impl.isValidTime('09:30')).toBe(true);
      expect(impl.isValidTime('23:59')).toBe(true);
      expect(impl.isValidTime('24:00')).toBe(false);
      expect(impl.isValidTime('9:30')).toBe(false);
    });
    it('validates timestamps with an offset', () => {
      expect(impl.isValidTimestamp(NOW)).toBe(true);
      expect(impl.isValidTimestamp('2026-11-08T16:05:00.123Z')).toBe(true);
      expect(impl.isValidTimestamp('2026-11-08T10:05')).toBe(false);
      expect(impl.isValidTimestamp('2026-11-08')).toBe(false);
    });
  });

  describe('setup checks', () => {
    it('accepts only a deployed connector address', () => {
      expect(impl.isConnectorAddress('https://script.google.com/macros/s/AKfycbx123-_abc/exec')).toBe(true);
      expect(impl.isConnectorAddress('https://script.google.com/macros/s/AKfycbx123/dev')).toBe(false);
      expect(impl.isConnectorAddress('http://script.google.com/macros/s/AKfycbx123/exec')).toBe(false);
      expect(impl.isConnectorAddress('https://script.google.com/a/macros/x/s/AK/exec/extra')).toBe(false);
    });
    it('explains credential problems in plain words', () => {
      expect(impl.checkCredentials('nancy@example.com', 'longenough1', 'longenough1')).toEqual([]);
      expect(impl.checkCredentials('nancy', 'short', 'shorter')).toEqual([
        'Enter a valid email address.',
        'Use at least 10 characters for the password.',
        "The two passwords don't match.",
      ]);
    });
  });

  describe('validateRecord', () => {
    it('cleans a client and fills defaults', () => {
      const r = impl.validateRecord('Clients', { client_id: 'c_jordan01', name: '  Jordan Reyes ', created_at: NOW });
      expect(r).toEqual({
        ok: true,
        value: { client_id: 'c_jordan01', name: 'Jordan Reyes', focus: '', active: true, created_at: NOW },
      });
    });
    it('requires a name', () => {
      const r = impl.validateRecord('Clients', { client_id: 'c_jordan01', name: '  ' });
      expect(r).toEqual({ ok: false, message: 'name is required.' });
    });
    it('rejects a missing or non-object payload', () => {
      expect(impl.validateRecord('Clients', undefined).ok).toBe(false);
      expect(impl.validateRecord('Clients', ['x']).ok).toBe(false);
    });
    it('checks planned sessions', () => {
      const base = {
        planned_id: 'p_plan0001', client_id: 'c_jordan01', date: '2026-11-10', start_time: '10:00', booked_min: 60,
      };
      const ok = impl.validateRecord('Planned', { ...base, client_name: 'ignored', meet_link: 'https://meet.google.com/abc-defg-hij' });
      expect(ok.ok && ok.value).toMatchObject({ client_name: '', status: 'booked', meet_link: 'https://meet.google.com/abc-defg-hij' });
      expect(impl.validateRecord('Planned', { ...base, booked_min: 0 }).ok).toBe(false);
      expect(impl.validateRecord('Planned', { ...base, booked_min: 45.5 }).ok).toBe(false);
      expect(impl.validateRecord('Planned', { ...base, booked_min: '60' }).ok).toBe(false);
      expect(impl.validateRecord('Planned', { ...base, meet_link: 'meet.google.com/abc' })).toEqual({
        ok: false, message: 'meet_link must start with https://',
      });
      expect(impl.validateRecord('Planned', { ...base, status: 'done' }).ok).toBe(false);
      expect(impl.validateRecord('Planned', { ...base, date: '2026-11-31' }).ok).toBe(false);
    });
    it('checks sessions, rounding actual time and cleaning bullets', () => {
      const r = impl.validateRecord('Sessions', {
        session_id: 's_sess0001', client_id: 'c_jordan01', date: '2026-11-10', booked_min: 60, actual_min: 47.46,
        timed: true, covered: ['Case study', ' ', 'Findings'], next_steps: '• Add quotes\n• Send draft',
      });
      expect(r.ok && r.value).toMatchObject({
        actual_min: 47.5, timed: true, covered: ['Case study', 'Findings'], next_steps: ['Add quotes', 'Send draft'],
        planned_id: '',
      });
      expect(impl.validateRecord('Sessions', { session_id: 's_sess0001', client_id: 'c_jordan01', date: '2026-11-10', booked_min: 60 }))
        .toEqual({ ok: false, message: 'actual_min is required.' });
      expect(impl.validateRecord('Sessions', {
        session_id: 's_sess0001', client_id: 'c_jordan01', date: '2026-11-10', booked_min: 60, actual_min: 5,
        covered: ['x'.repeat(1001)],
      }).ok).toBe(false);
    });
    it('never takes server-controlled suggestion fields from the app', () => {
      const r = impl.validateRecord('Suggestions', {
        suggestion_id: 'g_sugg0001', text: 'Add two quotes', outcome: 'helpful', session_id: 's_other001', done: 'yes',
      });
      expect(r.ok && r.value).toEqual({
        suggestion_id: 'g_sugg0001', session_id: '', client_id: '', client_name: '', date: '', text: 'Add two quotes',
        outcome: '', outcome_at: '', done: '', done_at: '',
      });
    });
    it('lets mentors save with any email or phone formatting', () => {
      const r = impl.validateRecord('Mentors', {
        mentor_id: 'm_dana0001', name: 'Dana Lee', email: 'dana at example', phone: '(403) 555 0142 ext 2',
      });
      expect(r.ok).toBe(true);
    });
    it('defaults mentor link status to suggested', () => {
      const r = impl.validateRecord('MentorLinks', {
        link_id: 'l_link0001', mentor_id: 'm_dana0001', client_id: 'c_jordan01', date: '2026-11-03',
      });
      expect(r.ok && r.value).toMatchObject({ status: 'suggested', mentor_name: '', client_name: '', contacted: '' });
    });
    it('records whether the client made contact with the mentor', () => {
      const base = { link_id: 'l_link0001', mentor_id: 'm_dana0001', client_id: 'c_jordan01', date: '2026-11-03' };
      expect(impl.validateRecord('MentorLinks', { ...base, contacted: 'yes' })).toMatchObject({ ok: true, value: { contacted: 'yes' } });
      expect(impl.validateRecord('MentorLinks', { ...base, contacted: 'maybe' }).ok).toBe(false);
      expect(impl.validateRecord('MentorLinks', { ...base, contacted: 'yes', contacted_on: '2026-11-20' }))
        .toMatchObject({ ok: true, value: { contacted_on: '2026-11-20' } });
      expect(impl.validateRecord('MentorLinks', { ...base, contacted_on: 'Nov 20' }).ok).toBe(false);
    });
  });

  describe('row mapping', () => {
    it('turns a session record into a sheet row and back', () => {
      const record = {
        session_id: 's_sess0001', client_id: 'c_jordan01', client_name: 'Jordan Reyes', date: '2026-11-10',
        booked_min: 60, actual_min: 47.5, timed: true, covered: ['Case study', '=not a formula'],
        next_steps: ['Add quotes'], planned_id: '', created_at: NOW,
      };
      const row = impl.recordToRow('Sessions', record);
      expect(row).toEqual([
        's_sess0001', 'c_jordan01', 'Jordan Reyes', '2026-11-10', 60, 47.5, true,
        '• Case study\n• =not a formula', '• Add quotes', '', NOW,
      ]);
      expect(impl.rowToRecord('Sessions', row)).toEqual(record);
    });
    it('reads hand-edited cells sensibly', () => {
      const rec = impl.rowToRecord('Clients', ['c_jordan01', "'=Jordan", '', 'TRUE', '']);
      expect(rec).toEqual({ client_id: 'c_jordan01', name: '=Jordan', focus: '', active: true, created_at: '' });
      expect(impl.rowToRecord('Clients', ['c_x000001', 'X', '', 'false', '']).active).toBe(false);
      expect(impl.rowToRecord('Clients', ['c_x000001', 'X', '', '', '']).active).toBe(true);
      expect(impl.rowToRecord('Planned', ['p_x000001', 'c_x000001', 'X', '2026-11-10', '10:00', '45', '', '', '']))
        .toMatchObject({ booked_min: 45, status: 'booked' });
    });
    it('guards text cells against formulas', () => {
      const row = impl.recordToRow('Mentors', {
        mentor_id: 'm_dana0001', name: 'Dana Lee', phone: '+1 403-555-0142', notes: '@ the library', active: true,
      });
      expect(row[5]).toBe(`'+1 403-555-0142`);
      expect(row[6]).toBe(`'@ the library`);
      expect(row[7]).toBe(true);
    });
    it('gives plain-text formats to text columns only', () => {
      expect(impl.rowFormats('Sessions')).toEqual(['@', '@', '@', '@', 'General', 'General', 'General', '@', '@', '@', '@']);
    });
  });
});
