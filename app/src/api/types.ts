/** The app's own (camelCase) view of the sheet. Mapped from the connector's snake_case in mapping.ts. */

export interface Client {
  clientId: string;
  name: string;
  focus: string;
  active: boolean;
  createdAt: string;
}

export type PlannedStatus = 'booked' | 'logged' | 'cancelled';
export interface Planned {
  plannedId: string;
  clientId: string;
  clientName: string;
  date: string;
  startTime: string;
  bookedMin: number;
  meetLink: string;
  status: PlannedStatus;
  createdAt: string;
}

export interface Session {
  sessionId: string;
  clientId: string;
  clientName: string;
  date: string;
  bookedMin: number;
  actualMin: number;
  timed: boolean;
  covered: string[];
  nextSteps: string[];
  plannedId: string;
  createdAt: string;
}

export type Outcome = '' | 'helpful' | 'not';
/** Did it happen? "" = not asked yet. Used for next steps (did the client do it?) and mentor links (did they make contact?). */
export type YesNo = '' | 'yes' | 'no';
export interface Suggestion {
  suggestionId: string;
  sessionId: string;
  clientId: string;
  clientName: string;
  date: string;
  text: string;
  outcome: Outcome;
  outcomeAt: string;
  done: YesNo;
  doneAt: string;
}

export interface Mentor {
  mentorId: string;
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  createdAt: string;
}

export type MentorLinkStatus = 'suggested' | 'introduced';
export interface MentorLink {
  linkId: string;
  mentorId: string;
  mentorName: string;
  clientId: string;
  clientName: string;
  status: MentorLinkStatus;
  date: string;
  createdAt: string;
  /** Did the client make contact with the mentor? */
  contacted: YesNo;
  /** When they made contact (YYYY-MM-DD), or '' if not recorded. */
  contactedOn: string;
}

export interface AllData {
  clients: Client[];
  planned: Planned[];
  sessions: Session[];
  suggestions: Suggestion[];
  mentors: Mentor[];
  mentorLinks: MentorLink[];
  sheetUrl: string;
  sheetName: string;
}

export interface LoginResult {
  token: string;
  email: string;
  expiresAt: string;
}

/** Server error codes, plus NETWORK for "couldn't reach the sheet". */
export type ApiErrorCode = 'AUTH' | 'LOCKED' | 'BAD_INPUT' | 'NOT_FOUND' | 'SERVER' | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** Fields the connector fills in itself; the app may leave them out. */
type ServerFilled = 'clientName' | 'createdAt';

export type ClientInput = Omit<Client, 'createdAt'> & { createdAt?: string };
export type PlannedInput = Omit<Planned, ServerFilled> & { createdAt?: string };
export type SessionInput = Omit<Session, ServerFilled> & { createdAt?: string };
export type SuggestionInput = Pick<Suggestion, 'suggestionId' | 'text'>;
export type MentorInput = Omit<Mentor, 'createdAt'> & { createdAt?: string };
export type MentorLinkInput = Omit<MentorLink, 'mentorName' | 'clientName' | 'createdAt'> & { createdAt?: string };

/** Everything the app can ask of a sheet (the real connector or the demo). */
export interface Api {
  ping(): Promise<{ version: string }>;
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  getAll(): Promise<AllData>;
  upsertClient(client: ClientInput): Promise<Client>;
  upsertPlanned(planned: PlannedInput): Promise<Planned>;
  cancelPlanned(plannedId: string): Promise<void>;
  logSession(session: SessionInput, suggestions: SuggestionInput[]): Promise<{ session: Session; suggestions: Suggestion[] }>;
  setSuggestionOutcome(suggestionId: string, outcome: Outcome): Promise<Suggestion>;
  setSuggestionDone(suggestionId: string, done: YesNo): Promise<Suggestion>;
  upsertMentor(mentor: MentorInput): Promise<Mentor>;
  upsertMentorLink(link: MentorLinkInput): Promise<MentorLink>;
  deleteMentorLink(linkId: string): Promise<void>;
}
