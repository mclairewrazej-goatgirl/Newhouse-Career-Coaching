/**
 * Changes the app makes, as data. Each one is applied to the local copy
 * straight away (optimistic) and sent to the sheet later from the outbox.
 * applyOp mirrors what the connector does, so the screen matches what the
 * sheet will hold once the change arrives.
 */
import type {
  AllData, Api, Client, ClientInput, Mentor, MentorInput, MentorLink, MentorLinkInput, Outcome, Planned,
  PlannedInput, Session, SessionInput, Suggestion, SuggestionInput,
} from '../api/types';

export type Op =
  | { action: 'upsertClient'; client: ClientInput }
  | { action: 'upsertPlanned'; planned: PlannedInput }
  | { action: 'cancelPlanned'; plannedId: string }
  | { action: 'logSession'; session: SessionInput; suggestions: SuggestionInput[] }
  | { action: 'setSuggestionOutcome'; suggestionId: string; outcome: Outcome }
  | { action: 'upsertMentor'; mentor: MentorInput }
  | { action: 'upsertMentorLink'; link: MentorLinkInput }
  | { action: 'deleteMentorLink'; linkId: string };

/** What the sheet sent back for an op. */
export type OpResult =
  | { action: 'upsertClient'; client: Client }
  | { action: 'upsertPlanned'; planned: Planned }
  | { action: 'cancelPlanned'; plannedId: string }
  | { action: 'logSession'; session: Session; suggestions: Suggestion[] }
  | { action: 'setSuggestionOutcome'; suggestion: Suggestion }
  | { action: 'upsertMentor'; mentor: Mentor }
  | { action: 'upsertMentorLink'; link: MentorLink }
  | { action: 'deleteMentorLink'; linkId: string };

export function emptyData(): AllData {
  return { clients: [], planned: [], sessions: [], suggestions: [], mentors: [], mentorLinks: [], sheetUrl: '', sheetName: '' };
}

function upsertBy<T, K extends keyof T>(items: T[], key: K, item: T): T[] {
  const i = items.findIndex((x) => x[key] === item[key]);
  if (i < 0) return [...items, item];
  const out = items.slice();
  out[i] = item;
  return out;
}

function renameClient(d: AllData, clientId: string, name: string): AllData {
  const fix = <T extends { clientId: string; clientName: string }>(rows: T[]) =>
    rows.map((r) => (r.clientId === clientId && r.clientName !== name ? { ...r, clientName: name } : r));
  return { ...d, planned: fix(d.planned), sessions: fix(d.sessions), suggestions: fix(d.suggestions), mentorLinks: fix(d.mentorLinks) };
}

function withClient(d: AllData, client: Client): AllData {
  const old = d.clients.find((c) => c.clientId === client.clientId);
  const next = { ...d, clients: upsertBy(d.clients, 'clientId', client) };
  return old && old.name !== client.name ? renameClient(next, client.clientId, client.name) : next;
}

function withMentor(d: AllData, mentor: Mentor): AllData {
  const old = d.mentors.find((m) => m.mentorId === mentor.mentorId);
  const next = { ...d, mentors: upsertBy(d.mentors, 'mentorId', mentor) };
  if (!old || old.name === mentor.name) return next;
  return {
    ...next,
    mentorLinks: next.mentorLinks.map((l) => (l.mentorId === mentor.mentorId ? { ...l, mentorName: mentor.name } : l)),
  };
}

/** One row per mentor + client, like the connector. */
function withLink(d: AllData, link: MentorLink): AllData {
  const i = d.mentorLinks.findIndex((l) => l.mentorId === link.mentorId && l.clientId === link.clientId);
  if (i < 0) return { ...d, mentorLinks: upsertBy(d.mentorLinks, 'linkId', link) };
  const mentorLinks = d.mentorLinks.slice();
  mentorLinks[i] = { ...link, linkId: d.mentorLinks[i].linkId, createdAt: d.mentorLinks[i].createdAt || link.createdAt };
  return { ...d, mentorLinks };
}

function withSession(d: AllData, session: Session, suggestions: Suggestion[]): AllData {
  const existed = d.sessions.some((s) => s.sessionId === session.sessionId);
  let next: AllData = { ...d, sessions: upsertBy(d.sessions, 'sessionId', session) };
  const keep = new Set(suggestions.map((s) => s.suggestionId));
  if (existed) {
    next = { ...next, suggestions: next.suggestions.filter((s) => s.sessionId !== session.sessionId || keep.has(s.suggestionId)) };
  }
  for (const s of suggestions) next = { ...next, suggestions: upsertBy(next.suggestions, 'suggestionId', s) };
  if (session.plannedId) {
    next = { ...next, planned: next.planned.map((p) => (p.plannedId === session.plannedId ? { ...p, status: 'logged' as const } : p)) };
  }
  return next;
}

const nameOf = (d: AllData, clientId: string) => d.clients.find((c) => c.clientId === clientId)?.name ?? '';

/** Applies a change locally, the way the connector will. */
export function applyOp(d: AllData, op: Op): AllData {
  switch (op.action) {
    case 'upsertClient': {
      const old = d.clients.find((c) => c.clientId === op.client.clientId);
      return withClient(d, { ...op.client, createdAt: old?.createdAt || op.client.createdAt || '' });
    }
    case 'upsertPlanned': {
      const old = d.planned.find((p) => p.plannedId === op.planned.plannedId);
      return {
        ...d,
        planned: upsertBy(d.planned, 'plannedId', {
          ...op.planned, clientName: nameOf(d, op.planned.clientId), createdAt: old?.createdAt || op.planned.createdAt || '',
        }),
      };
    }
    case 'cancelPlanned':
      return { ...d, planned: d.planned.map((p) => (p.plannedId === op.plannedId ? { ...p, status: 'cancelled' as const } : p)) };
    case 'logSession': {
      const clientName = nameOf(d, op.session.clientId);
      const old = d.sessions.find((s) => s.sessionId === op.session.sessionId);
      const session: Session = {
        ...op.session, clientName, createdAt: old?.createdAt || op.session.createdAt || '',
        nextSteps: op.suggestions.length ? op.suggestions.map((s) => s.text) : op.session.nextSteps,
      };
      const suggestions: Suggestion[] = op.suggestions.map((s) => {
        const prev = d.suggestions.find((x) => x.suggestionId === s.suggestionId);
        return {
          suggestionId: s.suggestionId, text: s.text, sessionId: session.sessionId, clientId: session.clientId,
          clientName, date: session.date, outcome: prev?.outcome ?? '', outcomeAt: prev?.outcomeAt ?? '',
        };
      });
      return withSession(d, session, suggestions);
    }
    case 'setSuggestionOutcome':
      return {
        ...d,
        suggestions: d.suggestions.map((s) =>
          s.suggestionId === op.suggestionId
            ? { ...s, outcome: op.outcome, outcomeAt: op.outcome ? s.outcomeAt || new Date().toISOString() : '' }
            : s),
      };
    case 'upsertMentor': {
      const old = d.mentors.find((m) => m.mentorId === op.mentor.mentorId);
      return withMentor(d, { ...op.mentor, createdAt: old?.createdAt || op.mentor.createdAt || '' });
    }
    case 'upsertMentorLink': {
      const mentorName = d.mentors.find((m) => m.mentorId === op.link.mentorId)?.name ?? '';
      return withLink(d, { ...op.link, mentorName, clientName: nameOf(d, op.link.clientId), createdAt: op.link.createdAt || '' });
    }
    case 'deleteMentorLink':
      return { ...d, mentorLinks: d.mentorLinks.filter((l) => l.linkId !== op.linkId) };
  }
}

/** Puts what the sheet sent back into the confirmed copy. */
export function applyResult(d: AllData, r: OpResult): AllData {
  switch (r.action) {
    case 'upsertClient': return withClient(d, r.client);
    case 'upsertPlanned': return { ...d, planned: upsertBy(d.planned, 'plannedId', r.planned) };
    case 'cancelPlanned': return applyOp(d, { action: 'cancelPlanned', plannedId: r.plannedId });
    case 'logSession': return withSession(d, r.session, r.suggestions);
    case 'setSuggestionOutcome': return { ...d, suggestions: upsertBy(d.suggestions, 'suggestionId', r.suggestion) };
    case 'upsertMentor': return withMentor(d, r.mentor);
    case 'upsertMentorLink': return withLink(d, r.link);
    case 'deleteMentorLink': return applyOp(d, { action: 'deleteMentorLink', linkId: r.linkId });
  }
}

/** Sends one op to the sheet. */
export async function sendOp(api: Api, op: Op): Promise<OpResult> {
  switch (op.action) {
    case 'upsertClient': return { action: op.action, client: await api.upsertClient(op.client) };
    case 'upsertPlanned': return { action: op.action, planned: await api.upsertPlanned(op.planned) };
    case 'cancelPlanned': await api.cancelPlanned(op.plannedId); return { action: op.action, plannedId: op.plannedId };
    case 'logSession': return { action: op.action, ...(await api.logSession(op.session, op.suggestions)) };
    case 'setSuggestionOutcome':
      return { action: op.action, suggestion: await api.setSuggestionOutcome(op.suggestionId, op.outcome) };
    case 'upsertMentor': return { action: op.action, mentor: await api.upsertMentor(op.mentor) };
    case 'upsertMentorLink': return { action: op.action, link: await api.upsertMentorLink(op.link) };
    case 'deleteMentorLink': await api.deleteMentorLink(op.linkId); return { action: op.action, linkId: op.linkId };
  }
}
