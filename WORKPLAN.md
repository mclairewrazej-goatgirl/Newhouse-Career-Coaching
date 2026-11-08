# Coaching Tracker — Work Plan for Claude Code

This plan builds the app in small phases. Each phase has a **prompt to paste into Claude Code**, what "done" looks like, and how to test it yourself before moving on.

**How to use it**
1. Create the GitHub repo, clone it, and add `README.md`, `WORKPLAN.md` and `CLAUDE.md` from this package.
2. Open Claude Code in the repo folder.
3. Paste the **Kick-off prompt** below once.
4. Then paste each phase prompt in order. Finish the phase's checks before starting the next. Commit after each phase.
5. If a phase goes sideways, tell Claude Code what you saw and ask it to fix it *within that phase* before moving on.

---

## Kick-off prompt (paste once)

```
Read CLAUDE.md, README.md and WORKPLAN.md in full before doing anything.
We'll build this app phase by phase following WORKPLAN.md. Don't start
a phase until I paste its prompt. For each phase: make a short plan,
implement it, run the build/tests, then summarise what changed and list
anything I need to do by hand (e.g. steps in Google Sheets). Ask me
before adding any dependency not named in CLAUDE.md. Reply "ready" when
you've read everything.
```

---

## Phase 0 — Repo skeleton and deployment

**Prompt**
```
Phase 0 from WORKPLAN.md. Set up the repo skeleton:
- app/ : Vite + React + TypeScript. Add vite-plugin-pwa (manifest with
  name "Coaching Tracker", theme colour #1F5E57, simple placeholder icon).
  Set the Vite base path to /coaching-tracker/.
- apps-script/ : empty files appsscript.json, Config.gs, Api.gs, Auth.gs,
  Data.gs, Menu.gs, Setup.html with a header comment explaining each.
- .github/workflows/deploy.yml that builds app/ and deploys to GitHub
  Pages on push to main.
- Design tokens in app/src/styles/tokens.css copied from CLAUDE.md.
- A placeholder home screen that says "Coaching Tracker" so we can see
  the deploy works.
- Add Vitest with one passing sample test, and an npm script "check"
  that runs typecheck + lint + tests.
```

**Done when**
- `npm run check` passes in `app/`.
- After pushing, the Actions tab shows a green deploy and the GitHub Pages address shows the placeholder.

**You do by hand:** GitHub › Settings › Pages › Source: **GitHub Actions**.

---

## Phase 1 — The connector (Apps Script backend)

**Prompt**
```
Phase 1 from WORKPLAN.md: write the Apps Script connector in apps-script/
following the API contract and sheet schema in CLAUDE.md.

1. Menu.gs: onOpen() adds a "Coaching Tracker" menu with:
   "1. Prepare my sheet", "2. Finish setup", "Show my app link",
   "Change email or password".
   - Prepare my sheet: creates the Clients, Planned, Sessions, Suggestions,
     Mentors and MentorLinks tabs with exact header rows from CLAUDE.md
     (bold, frozen), skips tabs that already exist,
     sets the spreadsheet time zone check, and shows a confirmation.
   - Finish setup / Change email or password: open Setup.html as a sidebar.
   - Show my app link: shows the saved personal app link in a dialog
     with a copy button, or explains that setup isn't finished.
2. Setup.html: a friendly sidebar form with three fields (connector
   address, email, password + confirm). Try to pre-fill the address with
   ScriptApp.getService().getUrl() but only if it ends in /exec. Validate:
   address matches ^https://script\.google\.com/macros/s/[^/]+/exec$,
   password >= 10 chars and both entries match. On save show the personal
   app link = APP_URL + "?connect=" + base64url(connector address), with
   "Open the app" and "Copy" buttons. Plain, reassuring wording.
3. Auth.gs: salted SHA-256 hashing with 10,000 iterations using
   Utilities.computeDigest; store {email, salt, hash, tokenVersion} in
   PropertiesService.getScriptProperties(). Login issues a random token
   (two Utilities.getUuid() joined), stores sha256(token) -> {exp,
   tokenVersion} with 30-day expiry. Lockout: 5 failed logins -> 15 min
   via CacheService. Changing credentials increments tokenVersion so all
   old tokens fail. Constant-time compare for hashes.
4. Api.gs: doPost(e) parses e.postData.contents as JSON
   {action, token, payload}; doGet returns {ok:true, app:"coaching-tracker"}
   for a health check only. Every action except "login" and "ping"
   requires a valid token. Always return JSON via ContentService. Never
   return stack traces; return {ok:false, error:{code, message}}.
5. Data.gs: implement every action in the API contract. Use LockService
   for writes. Use client-generated ids so a retried write with the same
   id updates instead of duplicating. Store bullet lists as "• " lines
   joined with "\n". logSession also sets the linked Planned row's
   status to "logged" and writes one Suggestions row per next step.
   upsertMentorLink upserts by (mentor_id, client_id). Keep *_name
   columns in sync when a client or mentor is renamed.
6. Put pure helpers (validation, row<->object mapping, bullets
   join/split, id checks) in a section with no Google APIs, and mirror
   them in app/src/shared/ with Vitest tests so the logic is tested.
Finally, write apps-script/TESTING.md: a checklist I can follow in a
real test copy of the sheet, including curl commands for ping, a failed
login, a successful login and getAll.
```

**Done when**
- All files exist, `npm run check` passes (helper tests).
- You can follow `apps-script/TESTING.md` end to end on a test copy.

**You do by hand (≈15 min):**
1. Make a test Google Sheet in your account, paste the `apps-script/` files in (README Part A2).
2. Run README Part B on it yourself, as if you were the coach.
3. Run the curl checks in `TESTING.md`. A request with no token must be refused.

> Tip: you'll reuse this test sheet for the rest of the build. Keep its personal app link handy.

---

## Phase 2 — App shell, connection and sign-in

**Prompt**
```
Phase 2 from WORKPLAN.md. Build the front-end foundation:
1. Connection: on load, if ?connect=<base64url> is in the URL, decode
   and validate it as a connector address, save it to localStorage, then
   remove the query string from the address bar. If no connector is
   saved, show a "This app isn't linked to a sheet yet" screen that
   explains in one sentence to open the personal link from the sheet's
   Coaching Tracker › Show my app link menu.
2. API client (src/api/client.ts): POST with Content-Type text/plain
   (avoids CORS preflight with Apps Script), JSON body {action, token,
   payload}, 20s timeout, typed responses per CLAUDE.md. On
   error.code === "AUTH" clear the token and go to sign-in.
3. Sign-in screen matching the demo's style: email, password (show/hide
   toggle), "Sign in" button, clear errors for wrong password, lockout
   and "can't reach your sheet". Store the token in localStorage.
4. App shell with bottom tabs: Schedule, Clients, Account. Simple
   state-based routing (no router library needed unless you think it's
   worth it; ask first).
5. Demo mode: if import.meta.env.VITE_DEMO === "1", use an in-memory fake
   API with the sample data from CLAUDE.md so the UI can be built and
   tested without a sheet.
6. Tests for: connect-param decoding/validation, API client error
   mapping, auth redirect on AUTH error.
```

**Done when**
- Opening your test sheet's personal link → sign-in → empty tab shell works on your phone.
- A wrong password shows a friendly error; 5 wrong tries show the lockout message.
- `VITE_DEMO=1 npm run dev` works with no sheet.

---

## Phase 3 — Data store and sync

**Prompt**
```
Phase 3 from WORKPLAN.md. Add the local data layer:
1. A small store (React context + reducer, or Zustand if you prefer;
   ask first) holding clients, planned, sessions, plus sync status.
2. On sign-in and on app focus, call getAll and replace local data.
   Cache the last result in localStorage so the app opens instantly and
   works offline (clear it on sign-out).
3. Writes are optimistic: update the store immediately, add the call to
   an outbox in localStorage, and flush the outbox in order. Retry with
   backoff when offline; flush on the "online" event and when the app
   regains focus. Because ids are client-generated, retries are safe.
4. Expose syncStatus: "synced" | "pending (n)" | "offline" | "error".
5. Tests: outbox ordering, retry, and no duplicate on retry.
```

**Done when**
- Turn on airplane mode, add a client, turn it off: the client appears in the sheet within a few seconds.
- Editing a row in the sheet by hand shows up in the app after switching away and back.

---

## Phase 4 — Clients

**Prompt**
```
Phase 4 from WORKPLAN.md. Build the Clients tab and client detail screen
as in the demo:
- List with name, focus, total coached time, and next booking line.
- "+ Add client" inline form (name required, focus optional).
- Edit name/focus and an "Archive client" option (sets active=false;
  archived clients are hidden from pickers but keep their history).
- Client detail: total time in coaching block (sum of actual time),
  sessions count and booked total, next session card (Open session or
  + Plan a session), and full session history with planned vs actual,
  covered bullets and next-step bullets.
```

**Done when** you can add, edit and archive clients on your phone, and the sheet matches.

---

## Phase 5 — Schedule and planning

**Prompt**
```
Phase 5 from WORKPLAN.md. Build the Schedule tab as in the demo:
- "Next up" card (soonest booked session from now): name, when, booked
  length, Open session, Join Meet (if a link exists).
- Month calendar with previous/next month, today outlined, selected day
  filled, teal dot for booked and grey dot for logged sessions.
  Accessible: each day is a button with a full aria-label.
- Selected-day list of planned (Open session, Join Meet) and logged
  sessions (tap -> client detail).
- Plan-a-session form: client dropdown (active clients), date, start
  time, booked-for pills 30/45/60/90 plus "custom" minutes, optional Meet
  link (must start with https://; warn but allow non-Meet links).
- Edit and cancel a planned session (cancel sets status=cancelled).
- Times shown in the device's local time; stored as date + HH:mm text.
```

**Done when** planned sessions you create appear on the calendar and in the **Planned** tab of the sheet; cancelling removes them from the calendar.

---

## Phase 6 — Live session, timer and logging

**Prompt**
```
Phase 6 from WORKPLAN.md. Build the live session screen as in the demo:
1. Header: client, date/time, booked length; Join Google Meet button.
2. Prep card: "Goals for today" = the Suggestions from this client's most
   recent logged session, each with "Helped" / "Didn't help" toggle
   buttons (setSuggestionOutcome; tapping the selected one clears it);
   "Last time you covered" = its covered list. First-session message
   when there's no history.
3. Timer that survives refreshes, app switching and screen lock: store
   {startedAt, accumulatedMs, running} for the active session in
   localStorage and compute elapsed from timestamps, never by counting
   ticks. Begin / Pause / Resume / Reset. Progress bar against booked
   length, turning amber when over. Request a Screen Wake Lock while
   running where supported (fail silently).
4. Bullet editors for "What you covered" and "Next steps": Enter or +
   adds, x removes, tap a bullet to edit it, drag or up/down to reorder.
   Autosave the draft to localStorage so nothing is lost if the phone
   dies mid-call.
5. Persistent "Session in progress" bar on other tabs while running.
5b. (Build after Phase 7, or stub until then.) "Mentor connections" card
   on the live screen, below the notes: this client's current mentor
   connections with role · organization, "since <date>", Email / Call
   buttons, and the suggested/introduced status dropdown. A
   "+ Add mentor connection" button opens the same connect form as the
   client page (mentor dropdown with recent-use counts, overuse warning,
   the chosen mentor's notes, status dropdown). Reuse one shared
   component for both places.
6. Unplanned session entry (pick client and booked length on the spot).
7. "End, save & log": stop timer, logSession (actual_min to 1 decimal,
   timed=false if timer never started, using booked length), mark the
   planned row logged, then show "Book the next session?" pre-filled to
   +7 days, same time, same length, same Meet link; "Not now" goes to
   the client.
8. Guard against starting a second live session while one is running.
```

**Done when** you can run a fake 2-minute session on your phone, lock the screen for a minute, come back to a correct timer, save it, book the next one, and see both in the sheet.

---

## Phase 7 — Mentors

**Prompt**
```
Phase 7 from WORKPLAN.md. Build mentor contacts as in the demo:
1. Mentors tab: list with name, role · organization, a usage tag
   ("Not used lately" / "n in 90 days" / amber "n in 90 days · rest"
   when n >= 3, threshold in one constant), and "Last introduced to
   Jordan, Nov 3"-style line. "+ Add mentor" form: name (required),
   role, organization, email, phone, notes. Light validation on email
   and phone; never block saving over formatting.
2. Mentor detail: tap-to-email (mailto:) and tap-to-call (tel:) rows,
   organization, notes (keep line breaks), amber overuse banner, list of
   connected clients with status tag and date (archived clients marked
   "past client"). Edit and archive mentor.
3. Client detail: "Mentor connections" card. "+ Connect" opens: mentor
   dropdown (labels include "(n recent)"), the amber warning if the
   chosen mentor is at the threshold, and a status dropdown with
   "Suggested they get in touch" / "I reached out and introduced them".
   Each existing connection has the same status dropdown (changing it
   updates the date), a remove button, and tapping the name opens the
   mentor. Connecting a mentor who's already linked updates that row
   instead of adding a duplicate.
   Make this card a shared component and also place it on the live
   session screen (see Phase 6, item 5b), adding Email / Call buttons
   and showing the chosen mentor's notes in the connect form.
4. Tests for recent-use counting and the 90-day window.
```

**Done when** you can add a mentor, connect them to two clients with different statuses, switch one from suggested to introduced, and see all of it in the **Mentors** and **MentorLinks** tabs of the sheet.

---

## Phase 8 — Review (weekly and monthly summaries)

**Prompt**
```
Phase 8 from WORKPLAN.md. Build the Review tab as in the demo:
- Week | Month segmented control; previous/next arrows; label
  ("Nov 2 – Nov 8" or "November 2026"). Weeks run Monday to Sunday.
- Stat tiles: sessions (with "n clients"), time coached, suggestions
  given, mentor connections, all for the period.
- "Suggestions you gave": every Suggestions row from sessions in the
  period, newest first, showing text, client and date, with Helped /
  Didn't help toggles. Filter chips with counts: All, Helped, Didn't
  help, No feedback.
- "Mentor connections": MentorLinks rows whose date is in the period,
  "Mentor → Client", status tag, date.
- All computed in the front end from data already loaded; pure helpers
  in src/shared/ with tests (period boundaries, filtering, counts),
  including a week that spans two months and a month with no sessions.
```

**Done when** marking a suggestion "Helped" in Review shows the same state in the next session's prep card (and vice versa), and the **Suggestions** tab in the sheet updates.

---

## Phase 9 — Coaching summary PDF

**Prompt**
```
Phase 9 from WORKPLAN.md. Add the per-client coaching summary:
1. "Coaching summary (PDF)" button on the client detail screen opens a
   preview screen: back link, one checkbox "Include mentor contact
   details", and the document itself.
2. Document content: "Coaching summary", client name and focus, date
   range of the block, session count and total time; then each session
   oldest to newest (date, actual time, What we covered, Next steps);
   then optional "People to connect with" (mentor name, role,
   organization, email, phone); footer "Prepared <date>". No internal
   ids, sync status, or Helped/Didn't-help ratings.
3. "Save as PDF or print" calls window.print(). Add an @media print
   stylesheet that hides the app chrome (tabs, buttons, banners), uses
   A4/Letter-friendly margins, black-on-white text, avoids breaking a
   session across pages where possible, and sets document.title to
   "Coaching summary – <Client name> – <date>" so the saved file gets a
   sensible name.
4. Check it in Safari on iPhone (Share › Print › pinch-out to get a
   PDF) and Chrome desktop (Save as PDF), and note those steps in the
   README if they differ from what's written.
```

**Done when** you can save a tidy, readable PDF of a client with 3+ sessions from both your phone and your laptop.

---

## Phase 10 — Account tab and polish

**Prompt**
```
Phase 10 from WORKPLAN.md. Build the Account tab and finish polish:
- Signed-in email, sync status with "Sync now", count of items waiting,
  "Open my Google Sheet" (getAll returns the spreadsheet URL), and
  "Sign out" (calls logout, clears token, cache and outbox after
  confirming if items are still waiting).
- "How this works" card in plain words: your notes are saved in your own
  Google Sheet; this app only shows and edits them; you need your
  password to see anything. Plus "Forgot password?" text pointing to
  the sheet menu (no technical terms like web app, URL or Apps Script).
- Empty states, loading skeletons, friendly error toasts.
- Accessibility pass: labels, focus order, 44px targets, contrast.
- Check layouts at 360px and 430px widths and on a laptop.
```

---

## Phase 11 — Real-world test and hand-off

**Prompt**
```
Phase 11 from WORKPLAN.md. Prepare for hand-off:
1. Review all apps-script/ code for security issues: unauthenticated
   access, token handling, error leakage, formula injection (prefix
   cells starting with = + - @ with a single quote), input length limits.
   Fix anything you find and list it.
2. Write docs/COACH-QUICKSTART.md: a one-page version of README Part B
   and Part C, with placeholders like [screenshot: Deploy button] where
   I should add screenshots.
3. Update README.md so it matches what we actually built.
4. Bump the connector version constant and add a CHANGELOG.md.
```

**You do by hand:**
1. Build the real template sheet (README Part A2–A3).
2. Do README Part B fresh in a second Google account (or with the coach, on a call) and note anything confusing.
3. Add screenshots to `docs/COACH-QUICKSTART.md`.
4. Send the coach the `/copy` link and the quick start.

---

## Later ideas (not in v1)

- Create the Google Calendar event and Meet link automatically when booking (needs Calendar permission in the connector).
- Email reminder the morning of a session.
- Save the coaching summary PDF straight to the coach's Google Drive (needs Drive permission in the connector).
- "Suggest a mentor" shortcut inside the live session screen.
- Mentor-side view: which clients actually followed up, and whether the intro went well.
- Multiple coaches sharing one sheet with separate logins.
