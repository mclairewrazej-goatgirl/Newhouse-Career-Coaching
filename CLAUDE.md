# CLAUDE.md — Coaching Tracker

Context for Claude Code. Read README.md too (CHANGELOG.md for connector versions).

## What this is
A mobile-first web app (PWA) for one career coach to plan sessions, time them, take bullet notes, total time per client, keep a mentor contact list (tracking who was suggested/introduced to whom so mentors aren't overused), print a per-client coaching summary as PDF, and review suggestions by week/month marking what helped. Tabs: Schedule, Clients, Mentors, Review, Account. Data lives in the coach's own Google Sheet via an Apps Script "connector" in that sheet. The front end is hosted on GitHub Pages and holds no data server-side.

## Non-negotiables
- No data in the developer's Google account. Each coach copies the template sheet and deploys their own connector.
- Every connector action except `login` and `ping` requires a valid token. No token → `{ok:false, error:{code:"AUTH"}}`.
- Passwords: salted, iterated SHA-256 in Script Properties. Never in the sheet, never logged, never returned.
- User-facing text avoids jargon (no "web app", "endpoint", "Apps Script", "URL" in the app UI; use "your sheet", "your app link").
- Timer is timestamp-based and persisted; never tick-counting.
- Accessible: real buttons/inputs/labels, 44px touch targets, WCAG AA contrast.

## Stack
- Front end: React 18 + Vite + TypeScript, vite-plugin-pwa, Vitest. Plain CSS with tokens (no UI framework). Ask before adding other dependencies.
- Backend: Google Apps Script (V8), bound to the sheet. Optional clasp.
- Hosting: GitHub Pages via Actions, base path `/Newhouse-Professional-Coaching/`.

## Design tokens (from the approved demo)
```css
:root{
  --bg:#F5F4EF; --surface:#FFFFFF; --ink:#1B1F1E; --ink-2:#3E4441; --muted:#5C625F;
  --line:#E2E0D8; --field-line:#CFCCC2;
  --accent:#1F5E57; --accent-soft:#E3EEEC; --accent-on:#FFFFFF;
  --warn:#9A4F12; --warn-soft:#FBEFE3; --warn-ink:#7A3D0C; --error:#A3261B;
  --prep-bg:#FBF7EE; --prep-line:#EADFC6; --logged-dot:#A9A79E;
  --radius-card:16px; --radius-field:12px;
  --font-body:Inter,system-ui,sans-serif; --font-display:"Space Grotesk",sans-serif;
}
```

## Sheet schema (header rows, exact)
- **Clients:** client_id, name, focus, active, created_at
- **Planned:** planned_id, client_id, client_name, date, start_time, booked_min, meet_link, status, created_at
- **Sessions:** session_id, client_id, client_name, date, booked_min, actual_min, timed, covered, next_steps, planned_id, created_at
- **Suggestions:** suggestion_id, session_id, client_id, client_name, date, text, outcome, outcome_at
- **Mentors:** mentor_id, name, role, organization, email, phone, notes, active, created_at
- **MentorLinks:** link_id, mentor_id, mentor_name, client_id, client_name, status, date, created_at
- Dates `YYYY-MM-DD`, times `HH:mm`, timestamps ISO 8601 with offset. Bullets stored as `• item` lines joined by `\n`.
- Planned `status` ∈ booked | logged | cancelled. Suggestion `outcome` ∈ "" | helpful | not. MentorLink `status` ∈ suggested | introduced (the `date` is when the status was last set).
- ids are client-generated: `c_`, `p_`, `s_`, `g_`, `m_`, `l_` + random.
- Sessions.next_steps is a readable copy; the **Suggestions** tab (one row per next step) is the source of truth for outcomes.
- *_name columns are denormalised for readability in the sheet; update them when a name changes.

## Derived rules
- Mentor "recent use" = MentorLinks rows for that mentor with `date` in the last 90 days. ≥3 → show the "give them a break" warning (threshold in one constant).
- Review periods: week = Monday–Sunday in device time; month = calendar month.
- Coaching summary PDF: generated in the browser from a print-only layout + `window.print()` (user picks "Save as PDF"). No server PDF generation in v1.

## API contract
`POST <connector>/exec`, `Content-Type: text/plain`, body `{"action": string, "token"?: string, "payload"?: object}`.
Response: `{ok:true, data}` or `{ok:false, error:{code:"AUTH"|"LOCKED"|"BAD_INPUT"|"NOT_FOUND"|"SERVER", message}}`.

| action | payload | data |
|---|---|---|
| ping | – | `{version}` |
| login | `{email, password}` | `{token, email, expiresAt}` |
| logout | – | `{}` |
| getAll | – | `{clients[], planned[], sessions[], suggestions[], mentors[], mentorLinks[], sheetUrl, sheetName}` |
| upsertClient | `{client}` | `{client}` |
| upsertPlanned | `{planned}` | `{planned}` |
| cancelPlanned | `{planned_id}` | `{}` |
| logSession | `{session, suggestions[]}` (may include planned_id) | `{session, suggestions[]}` |
| setSuggestionOutcome | `{suggestion_id, outcome}` | `{suggestion}` |
| upsertMentor | `{mentor}` | `{mentor}` |
| upsertMentorLink | `{link}` (one row per mentor+client; upsert by that pair) | `{link}` |
| deleteMentorLink | `{link_id}` | `{}` |

On the wire, records use the sheet's snake_case column names; bullet columns (`covered`, `next_steps`) are string arrays. Upserts send the whole record. The connector fills `*_name` columns, `created_at` if missing, and on Suggestions `session_id`/`client_id`/`client_name`/`date`/`outcome`/`outcome_at`; use the record it returns (e.g. `upsertMentorLink` returns the existing `link_id` for that mentor+client pair).

Front-end types use camelCase; map to snake_case columns in one place (`src/api/`).

Connector pure logic lives in `apps-script/Shared.gs` and is mirrored in `app/src/shared/connector.ts`; `connector.test.ts` runs the same tests against both, so change them together.

## Demo sample data (for VITE_DEMO=1)
Clients: Jordan Reyes (Moving from teaching into UX research), Priya Nair (Negotiating a promotion to team lead), Sam Okafor (Returning to work after a career break), plus one archived client. A few planned sessions this week and 2–3 logged sessions with bullets and some rated suggestions. Mentors: Dana Lee (UX Research Lead, Northfield Digital — 3 connections in 90 days, to show the warning), Marcus Chen (Director of Operations, Bow Valley Health), Aisha Rahman (HR Business Partner, Calder & Ruiz), all with example.com emails and 555 phone numbers. Mirror the Design demo.

## Conventions
- `app/src/` folders: `api/`, `state/`, `screens/`, `components/`, `shared/` (pure, tested helpers mirrored in Apps Script), `styles/`.
- Run `npm run check` before saying a phase is done.
- Small commits per phase; conventional commit messages.
