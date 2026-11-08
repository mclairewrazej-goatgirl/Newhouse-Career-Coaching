/**
 * In-memory stand-in for the sheet, used when VITE_DEMO=1.
 * Any email works; the password is "demo-password" so the wrong-password
 * and lockout messages can be tried too.
 */
import { addDays, toDateString } from '../shared/dates';
import {
  ApiError, type AllData, type Api, type Client, type Mentor, type MentorLink, type Planned, type Session,
  type Suggestion,
} from './types';

export const DEMO_PASSWORD = 'demo-password';
const DEMO_LOCK_AFTER = 5;

const STAMP = (date: string, time = '09:00') => `${date}T${time}:00-07:00`;

/** Sample data from CLAUDE.md, with dates placed around `today`. */
export function demoData(today: Date = new Date()): AllData {
  const d = (offset: number) => toDateString(addDays(today, offset));

  const clients: Client[] = [
    { clientId: 'c_jordan01', name: 'Jordan Reyes', focus: 'Moving from teaching into UX research', active: true, createdAt: STAMP(d(-40)) },
    { clientId: 'c_priya001', name: 'Priya Nair', focus: 'Negotiating a promotion to team lead', active: true, createdAt: STAMP(d(-30)) },
    { clientId: 'c_samok001', name: 'Sam Okafor', focus: 'Returning to work after a career break', active: true, createdAt: STAMP(d(-20)) },
    { clientId: 'c_lee00001', name: 'Morgan Lee', focus: 'Finding a first job after graduating', active: false, createdAt: STAMP(d(-200)) },
  ];
  const name = (id: string) => clients.find((c) => c.clientId === id)!.name;

  const planned: Planned[] = [
    { plannedId: 'p_demo0001', clientId: 'c_jordan01', clientName: name('c_jordan01'), date: d(-7), startTime: '10:00', bookedMin: 60, meetLink: 'https://meet.google.com/abc-defg-hij', status: 'logged', createdAt: STAMP(d(-14)) },
    { plannedId: 'p_demo0002', clientId: 'c_priya001', clientName: name('c_priya001'), date: d(-3), startTime: '13:30', bookedMin: 45, meetLink: '', status: 'logged', createdAt: STAMP(d(-10)) },
    { plannedId: 'p_demo0003', clientId: 'c_jordan01', clientName: name('c_jordan01'), date: d(0), startTime: '15:00', bookedMin: 60, meetLink: 'https://meet.google.com/abc-defg-hij', status: 'booked', createdAt: STAMP(d(-7)) },
    { plannedId: 'p_demo0004', clientId: 'c_samok001', clientName: name('c_samok001'), date: d(1), startTime: '11:00', bookedMin: 30, meetLink: 'https://meet.google.com/xyz-abcd-efg', status: 'booked', createdAt: STAMP(d(-5)) },
    { plannedId: 'p_demo0005', clientId: 'c_priya001', clientName: name('c_priya001'), date: d(3), startTime: '09:30', bookedMin: 45, meetLink: '', status: 'booked', createdAt: STAMP(d(-3)) },
  ];

  const sessions: Session[] = [
    { sessionId: 's_demo0001', clientId: 'c_jordan01', clientName: name('c_jordan01'), date: d(-7), bookedMin: 60, actualMin: 52.5, timed: true,
      covered: ['Reviewed the case study draft', 'Talked through research methods from teaching'],
      nextSteps: ['Add two quotes from interview notes', 'Send the draft to Dana by Friday'], plannedId: 'p_demo0001', createdAt: STAMP(d(-7), '11:00') },
    { sessionId: 's_demo0002', clientId: 'c_priya001', clientName: name('c_priya001'), date: d(-3), bookedMin: 45, actualMin: 47, timed: true,
      covered: ['Listed wins from the last two quarters', 'Practised the opening of the promotion talk'],
      nextSteps: ['Book time with her manager', 'Write a one-page case for the role'], plannedId: 'p_demo0002', createdAt: STAMP(d(-3), '14:30') },
    { sessionId: 's_demo0003', clientId: 'c_samok001', clientName: name('c_samok001'), date: d(-12), bookedMin: 30, actualMin: 30, timed: false,
      covered: ['Explained the gap on the CV in one line'], nextSteps: ['Update LinkedIn headline'], plannedId: '', createdAt: STAMP(d(-12), '10:00') },
  ];

  const suggestions: Suggestion[] = [
    { suggestionId: 'g_demo0001', sessionId: 's_demo0001', clientId: 'c_jordan01', clientName: name('c_jordan01'), date: d(-7), text: 'Add two quotes from interview notes', outcome: 'helpful', outcomeAt: STAMP(d(-2)), done: 'yes', doneAt: STAMP(d(-2)) },
    { suggestionId: 'g_demo0002', sessionId: 's_demo0001', clientId: 'c_jordan01', clientName: name('c_jordan01'), date: d(-7), text: 'Send the draft to Dana by Friday', outcome: '', outcomeAt: '', done: '', doneAt: '' },
    { suggestionId: 'g_demo0003', sessionId: 's_demo0002', clientId: 'c_priya001', clientName: name('c_priya001'), date: d(-3), text: 'Book time with her manager', outcome: '', outcomeAt: '', done: '', doneAt: '' },
    { suggestionId: 'g_demo0004', sessionId: 's_demo0002', clientId: 'c_priya001', clientName: name('c_priya001'), date: d(-3), text: 'Write a one-page case for the role', outcome: '', outcomeAt: '', done: '', doneAt: '' },
    { suggestionId: 'g_demo0005', sessionId: 's_demo0003', clientId: 'c_samok001', clientName: name('c_samok001'), date: d(-12), text: 'Update LinkedIn headline', outcome: 'not', outcomeAt: STAMP(d(-5)), done: 'yes', doneAt: STAMP(d(-5)) },
  ];

  const mentors: Mentor[] = [
    { mentorId: 'm_dana0001', name: 'Dana Lee', role: 'UX Research Lead', organization: 'Northfield Digital', email: 'dana.lee@example.com', phone: '403-555-0142', notes: 'Happy to do 30-min coffee chats.\nPrefers email intros.', active: true, createdAt: STAMP(d(-120)) },
    { mentorId: 'm_marcus01', name: 'Marcus Chen', role: 'Director of Operations', organization: 'Bow Valley Health', email: 'marcus.chen@example.com', phone: '403-555-0178', notes: 'Good for people moving into management.', active: true, createdAt: STAMP(d(-100)) },
    { mentorId: 'm_aisha001', name: 'Aisha Rahman', role: 'HR Business Partner', organization: 'Calder & Ruiz', email: 'aisha.rahman@example.com', phone: '587-555-0110', notes: 'Can review CVs and talk about returning to work.', active: true, createdAt: STAMP(d(-90)) },
  ];
  const mname = (id: string) => mentors.find((m) => m.mentorId === id)!.name;

  const mentorLinks: MentorLink[] = [
    { linkId: 'l_demo0001', mentorId: 'm_dana0001', mentorName: mname('m_dana0001'), clientId: 'c_jordan01', clientName: name('c_jordan01'), status: 'introduced', date: d(-5), createdAt: STAMP(d(-7)), contacted: 'yes' },
    { linkId: 'l_demo0002', mentorId: 'm_dana0001', mentorName: mname('m_dana0001'), clientId: 'c_priya001', clientName: name('c_priya001'), status: 'suggested', date: d(-3), createdAt: STAMP(d(-3)), contacted: '' },
    { linkId: 'l_demo0003', mentorId: 'm_dana0001', mentorName: mname('m_dana0001'), clientId: 'c_samok001', clientName: name('c_samok001'), status: 'suggested', date: d(-20), createdAt: STAMP(d(-20)), contacted: '' },
    { linkId: 'l_demo0004', mentorId: 'm_aisha001', mentorName: mname('m_aisha001'), clientId: 'c_samok001', clientName: name('c_samok001'), status: 'introduced', date: d(-10), createdAt: STAMP(d(-12)), contacted: '' },
  ];

  return {
    clients, planned, sessions, suggestions, mentors, mentorLinks,
    sheetUrl: 'https://docs.google.com/spreadsheets/', sheetName: 'Coaching Tracker (demo)',
  };
}

export function createDemoApi(options: { onAuthError?: (e: ApiError) => void; latencyMs?: number } = {}): Api {
  const data = demoData();
  let signedIn = false;
  let fails = 0;
  const wait = () => new Promise((r) => setTimeout(r, options.latencyMs ?? 300));
  const nowIso = () => new Date().toISOString();

  async function guard() {
    await wait();
    if (!signedIn) {
      const e = new ApiError('AUTH', 'Please sign in.');
      options.onAuthError?.(e);
      throw e;
    }
  }
  function upsert<T>(items: T[], key: keyof T, item: T): T {
    const i = items.findIndex((x) => x[key] === item[key]);
    if (i >= 0) items[i] = item; else items.push(item);
    return item;
  }
  const clientName = (id: string) => {
    const c = data.clients.find((x) => x.clientId === id);
    if (!c) throw new ApiError('NOT_FOUND', "That client isn't in your sheet.");
    return c.name;
  };

  return {
    async ping() { await wait(); return { version: 'demo' }; },
    async login(email, password) {
      await wait();
      if (fails >= DEMO_LOCK_AFTER) throw new ApiError('LOCKED', 'Too many wrong tries. Sign-in is paused for 15 more minutes.');
      if (password !== DEMO_PASSWORD) {
        fails += 1;
        if (fails >= DEMO_LOCK_AFTER) throw new ApiError('LOCKED', 'Too many wrong tries. Sign-in is paused for 15 more minutes.');
        throw new ApiError('AUTH', 'Wrong email or password.');
      }
      fails = 0;
      signedIn = true;
      return { token: 'demo'.padEnd(64, '0'), email: email.trim().toLowerCase(), expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() };
    },
    async logout() { await wait(); signedIn = false; },
    async getAll() { await guard(); return structuredClone(data); },
    async upsertClient(c) {
      await guard();
      const saved = upsert(data.clients, 'clientId', { ...c, createdAt: c.createdAt || nowIso() });
      for (const rows of [data.planned, data.sessions, data.suggestions, data.mentorLinks]) {
        for (const r of rows) if (r.clientId === c.clientId) r.clientName = c.name;
      }
      return saved;
    },
    async upsertPlanned(p) {
      await guard();
      return upsert(data.planned, 'plannedId', { ...p, clientName: clientName(p.clientId), createdAt: p.createdAt || nowIso() });
    },
    async cancelPlanned(id) {
      await guard();
      const p = data.planned.find((x) => x.plannedId === id);
      if (!p) throw new ApiError('NOT_FOUND', "That planned session isn't in your sheet.");
      p.status = 'cancelled';
    },
    async logSession(s, sugg) {
      await guard();
      const session: Session = {
        ...s, clientName: clientName(s.clientId), createdAt: s.createdAt || nowIso(),
        nextSteps: sugg.length ? sugg.map((x) => x.text) : s.nextSteps,
      };
      upsert(data.sessions, 'sessionId', session);
      const saved = sugg.map((x) => {
        const old = data.suggestions.find((o) => o.suggestionId === x.suggestionId);
        return upsert(data.suggestions, 'suggestionId', {
          suggestionId: x.suggestionId, text: x.text, sessionId: session.sessionId, clientId: session.clientId,
          clientName: session.clientName, date: session.date, outcome: old?.outcome ?? '', outcomeAt: old?.outcomeAt ?? '',
          done: old?.done ?? '', doneAt: old?.doneAt ?? '',
        });
      });
      const plan = data.planned.find((p) => p.plannedId === s.plannedId);
      if (plan) plan.status = 'logged';
      return { session, suggestions: saved };
    },
    async setSuggestionOutcome(id, outcome) {
      await guard();
      const s = data.suggestions.find((x) => x.suggestionId === id);
      if (!s) throw new ApiError('NOT_FOUND', "That suggestion isn't in your sheet.");
      s.outcome = outcome;
      s.outcomeAt = outcome ? nowIso() : '';
      return { ...s };
    },
    async setSuggestionDone(id, done) {
      await guard();
      const s = data.suggestions.find((x) => x.suggestionId === id);
      if (!s) throw new ApiError('NOT_FOUND', "That suggestion isn't in your sheet.");
      s.done = done;
      s.doneAt = done ? nowIso() : '';
      return { ...s };
    },
    async upsertMentor(m) {
      await guard();
      const saved = upsert(data.mentors, 'mentorId', { ...m, createdAt: m.createdAt || nowIso() });
      for (const l of data.mentorLinks) if (l.mentorId === m.mentorId) l.mentorName = m.name;
      return saved;
    },
    async upsertMentorLink(l) {
      await guard();
      const mentor = data.mentors.find((m) => m.mentorId === l.mentorId);
      if (!mentor) throw new ApiError('NOT_FOUND', "That mentor isn't in your sheet.");
      const existing = data.mentorLinks.find((x) => x.mentorId === l.mentorId && x.clientId === l.clientId);
      const link: MentorLink = {
        ...l, linkId: existing?.linkId ?? l.linkId, mentorName: mentor.name, clientName: clientName(l.clientId),
        createdAt: existing?.createdAt || l.createdAt || nowIso(),
      };
      return upsert(data.mentorLinks, 'linkId', link);
    },
    async deleteMentorLink(id) {
      await guard();
      const i = data.mentorLinks.findIndex((x) => x.linkId === id);
      if (i >= 0) data.mentorLinks.splice(i, 1);
    },
  };
}
