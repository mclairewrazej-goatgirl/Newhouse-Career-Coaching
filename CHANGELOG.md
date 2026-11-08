# Changelog

Changes to the **connector** (the script inside each coach's Google Sheet).
The app itself updates automatically; the connector only changes when a
coach pastes in new code (see README › *Updating the app later*).

The version is `CONNECTOR_VERSION` in `apps-script/Config.gs`, and the app
can read it with the `ping` action.

## 1.1.1 — 2026-11-08

- The app moved to `https://mclairewrazej-goatgirl.github.io/Newhouse-Professional-Coaching/`.
  `APP_URL` in `Config.gs` now points there, so **Show my app link** and
  **Finish setup** give links to the new address. Only `Config.gs` changed.

## 1.1.0 — 2026-11-08

Security review before hand-off.

- **Fixed:** sign-in tries are now counted before the password is checked,
  while holding the script lock. Before, many tries sent at the same moment
  could all be checked before any of them was counted, getting more than
  5 guesses per 15 minutes.
- Checked and unchanged (already correct):
  - Every action except `ping` and `login` needs a valid sign-in token,
    including unknown actions and `logout`. `doGet` returns no data.
  - Tokens are 64 random hex characters, stored only as a SHA-256 hash with
    an expiry, and all are invalidated when the password changes.
  - Passwords are salted and hashed 10,000 times, compared in constant time,
    and never written to the sheet, logged or returned.
  - Errors from Google are replaced with a plain "Something went wrong"
    message; only the action name and error text are logged, never the
    request body.
  - Text starting with `=`, `+`, `-` or `@` is stored with a leading `'`
    (formula injection). Bullet lists always start with `• `. Text columns are
    formatted as plain text.
  - Limits: 200,000 characters per request, 200 characters for names, 1,000
    for a focus or a bullet point, 5,000 for mentor notes, 100 points per
    list, 500 for a Meet link, which must start with `https://`.
  - The setup panel shows messages as text, never as HTML.
- **Known trade-off:** the 15-minute pause covers sign-in as a whole, so
  someone with the app link could keep sign-in paused by guessing. Changing
  the password from the sheet clears the pause.

## 1.0.0 — 2026-11-08

First release: `ping`, `login`, `logout`, `getAll`, and the upsert, cancel,
log, outcome and mentor-link actions from the API contract in CLAUDE.md.
