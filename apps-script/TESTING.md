# Testing the connector on a test copy

Use a **test** Google Sheet in your own account, never a coach's sheet. This takes about 15 minutes the first time. Keep the test sheet: later phases reuse it.

## 1. Put the code in a test sheet

1. Create a new Google Sheet, e.g. **Coaching Tracker (test)**.
2. **Extensions › Apps Script**. Delete the sample `Code.gs`.
3. Add each file from this folder with the same name (**+ › Script** for `.gs`, **+ › HTML** for `.html`):
   `Config.gs`, `Shared.gs`, `Auth.gs`, `Data.gs`, `Api.gs`, `Menu.gs`, `Setup.html`.
   Apps Script adds `.gs` itself, so type just `Config`, `Shared`, and so on.
4. **Project Settings** (gear) › tick **Show "appsscript.json" manifest file in editor**, then paste `appsscript.json` over the one in the editor.
5. Check `APP_URL` in `Config.gs` is `https://mclairewrazej-goatgirl.github.io/Newhouse-Professional-Coaching/`.
6. Click **Save**. Go back to the sheet tab and refresh it.

## 2. Menu and Prepare my sheet

- [ ] After about 10 seconds a **Coaching Tracker** menu appears with: *1. Prepare my sheet*, *2. Finish setup*, *Show my app link*, *Change email or password*.
- [ ] **1. Prepare my sheet** asks for permission the first time (Advanced › Go to … (unsafe) › Allow), then run it again.
- [ ] Six tabs exist: Clients, Planned, Sessions, Suggestions, Mentors, MentorLinks. Each has a bold, frozen header row exactly as in `CLAUDE.md`. The empty *Sheet1* is gone.
- [ ] The message names your sheet's time zone. If it's wrong, fix it in **File › Settings**.
- [ ] Running **Prepare my sheet** again says nothing changed and doesn't touch existing rows.
- [ ] Rename a header cell (e.g. `name` → `Name`) and run it again: it warns about that tab. Put the header back.
- [ ] **Show my app link** says setup isn't finished yet.

## 3. Deploy and Finish setup

1. In Apps Script: **Deploy › New deployment › gear › Web app**. Execute as **Me**, Who has access **Anyone**. **Deploy**, then copy the address ending in `/exec`.
2. In the sheet: **Coaching Tracker › 2. Finish setup**.

- [ ] Pasting an address ending in `/dev` shows the "test address" message.
- [ ] A 9-character password, or two passwords that don't match, show plain-English problems and nothing is saved.
- [ ] With the `/exec` address, an email and a 10+ character password, **Save** shows your personal app link with **Open the app** and **Copy** buttons. **Copy** works.
- [ ] **Show my app link** now shows the same link.
- [ ] Note how long Save took. It hashes the password 10,000 times; a few seconds is fine. If it's over ~10 seconds, tell Claude so `HASH_ITERATIONS` can be tuned.
- [ ] **Extensions › Apps Script › Project Settings › Script Properties**: you see `auth` (with a hash and salt, **not** your password), `connector_address` and `spreadsheet_id`. The sheet itself contains no password.

## 4. Requests from a terminal (curl)

Set these first (macOS/Linux terminal, or Git Bash on Windows):

```bash
EXEC='https://script.google.com/macros/s/PASTE_YOUR_ID/exec'
EMAIL='you@example.com'
PASSWORD='your password'
```

Apps Script answers with a redirect, so always use `-L`. Requests are sent as `text/plain`, like the app does.

**On Windows**, use PowerShell's `Invoke-RestMethod` instead (it follows the redirect itself). For example, the no-token check:

```powershell
$EXEC = 'https://script.google.com/macros/s/PASTE_YOUR_ID/exec'
Invoke-RestMethod -Method Post -Uri $EXEC -ContentType 'text/plain' -Body '{"action":"getAll"}'
# ok    : False
# error : @{code=AUTH; message=Please sign in.}
```

**Health check (GET):**
```bash
curl -sL "$EXEC"
# {"ok":true,"app":"coaching-tracker"}
```

**ping (no sign-in needed):**
```bash
curl -sL "$EXEC" -H 'Content-Type: text/plain' -d '{"action":"ping"}'
# {"ok":true,"data":{"version":"1.0.0"}}
```

**No token is refused:**
```bash
curl -sL "$EXEC" -H 'Content-Type: text/plain' -d '{"action":"getAll"}'
# {"ok":false,"error":{"code":"AUTH","message":"Please sign in."}}
```

**Failed login:**
```bash
curl -sL "$EXEC" -H 'Content-Type: text/plain' \
  -d "{\"action\":\"login\",\"payload\":{\"email\":\"$EMAIL\",\"password\":\"wrong password\"}}"
# {"ok":false,"error":{"code":"AUTH","message":"Wrong email or password."}}
```

**Successful login** (copy the token from the answer):
```bash
curl -sL "$EXEC" -H 'Content-Type: text/plain' \
  -d "{\"action\":\"login\",\"payload\":{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}}"
# {"ok":true,"data":{"token":"…64 characters…","email":"you@example.com","expiresAt":"…"}}
TOKEN='paste the token here'
```

**getAll:**
```bash
curl -sL "$EXEC" -H 'Content-Type: text/plain' -d "{\"action\":\"getAll\",\"token\":\"$TOKEN\"}"
# {"ok":true,"data":{"clients":[],"planned":[],"sessions":[],"suggestions":[],"mentors":[],"mentorLinks":[],"sheetUrl":"…","sheetName":"…"}}
```

**Write a client, then a planned session, then log it** (watch the sheet as you go):
```bash
post() { curl -sL "$EXEC" -H 'Content-Type: text/plain' -d "$1"; echo; }

post "{\"action\":\"upsertClient\",\"token\":\"$TOKEN\",\"payload\":{\"client\":{\"client_id\":\"c_test0001\",\"name\":\"Jordan Reyes\",\"focus\":\"Moving from teaching into UX research\"}}}"

post "{\"action\":\"upsertPlanned\",\"token\":\"$TOKEN\",\"payload\":{\"planned\":{\"planned_id\":\"p_test0001\",\"client_id\":\"c_test0001\",\"date\":\"2026-11-10\",\"start_time\":\"10:00\",\"booked_min\":60,\"meet_link\":\"https://meet.google.com/abc-defg-hij\"}}}"

post "{\"action\":\"logSession\",\"token\":\"$TOKEN\",\"payload\":{\"session\":{\"session_id\":\"s_test0001\",\"client_id\":\"c_test0001\",\"date\":\"2026-11-10\",\"booked_min\":60,\"actual_min\":47.5,\"timed\":true,\"covered\":[\"Case study structure is solid\",\"Findings need evidence\"],\"planned_id\":\"p_test0001\"},\"suggestions\":[{\"suggestion_id\":\"g_test0001\",\"text\":\"Add two quotes\"},{\"suggestion_id\":\"g_test0002\",\"text\":\"Send draft by Friday\"}]}}"

post "{\"action\":\"setSuggestionOutcome\",\"token\":\"$TOKEN\",\"payload\":{\"suggestion_id\":\"g_test0001\",\"outcome\":\"helpful\"}}"

post "{\"action\":\"upsertMentor\",\"token\":\"$TOKEN\",\"payload\":{\"mentor\":{\"mentor_id\":\"m_test0001\",\"name\":\"Dana Lee\",\"role\":\"UX Research Lead\",\"organization\":\"Northfield Digital\",\"email\":\"dana.lee@example.com\",\"phone\":\"+1 403-555-0142\"}}}"

post "{\"action\":\"upsertMentorLink\",\"token\":\"$TOKEN\",\"payload\":{\"link\":{\"link_id\":\"l_test0001\",\"mentor_id\":\"m_test0001\",\"client_id\":\"c_test0001\",\"status\":\"suggested\",\"date\":\"2026-11-08\"}}}"
```

Check in the sheet:

- [ ] **Clients** has Jordan Reyes once. Running the same `upsertClient` again doesn't add a second row.
- [ ] **Planned** row for Jordan shows `status` = `logged` after `logSession`.
- [ ] **Sessions** row shows `covered` and `next_steps` as `• …` lines in one cell, and `actual_min` 47.5.
- [ ] **Suggestions** has two rows; the first has `outcome` = `helpful` and an `outcome_at` time.
- [ ] **Mentors** shows Dana's phone as `+1 403-555-0142` (not a formula error).
- [ ] Dates stay as `2026-11-10` text (not turned into another date format).
- [ ] Send `upsertMentorLink` again with `"status":"introduced"` and a **different** `link_id`: the existing row updates (still one row, original `link_id`), and the answer returns that original id.
- [ ] Rename the client (`upsertClient` with `"name":"Jordan R."`): `client_name` changes on Planned, Sessions, Suggestions and MentorLinks rows.
- [ ] `{"action":"cancelPlanned", …"payload":{"planned_id":"p_test0001"}}` sets the status to `cancelled`.
- [ ] `{"action":"deleteMentorLink", …"payload":{"link_id":"l_test0001"}}` removes the row; sending it again still answers `ok:true`.
- [ ] A bad value is refused with `BAD_INPUT` and a readable message, e.g. `"booked_min":0` or `"date":"2026-02-30"`.
- [ ] A name starting with `=` (e.g. `"name":"=1+1"`) is stored as text, not calculated.

## 5. Lockout, sign-out and password change

- [ ] Five wrong passwords in a row: the fifth answer is `{"code":"LOCKED", …"paused for 15 more minutes"}`. The right password is also refused until the pause ends (or until you run Change email or password).
- [ ] `{"action":"logout","token":"$TOKEN"}` answers `ok:true`; `getAll` with the same token then answers `AUTH`.
- [ ] Sign in again to get a new token. Run **Coaching Tracker › Change email or password** and save new details. `getAll` with the old token now answers `AUTH`, and the new password works.

## 6. What a stranger sees

- [ ] In a private browser window, open the `/exec` address: only `{"ok":true,"app":"coaching-tracker"}`.
- [ ] Any `POST` without a valid token (other than `ping` and `login`) answers `AUTH`, including made-up action names.
- [ ] In Apps Script, **Executions** shows errors only as short messages. No passwords, tokens or request bodies appear in the logs.

## Notes for the app (Phase 2+)

- Records go over the wire with the sheet's **snake_case** column names. Bullet columns (`covered`, `next_steps`) are **lists of strings**; the connector turns them into `• ` lines in the sheet.
- Each upsert sends the **whole record**: a field left out is saved as blank.
- The connector fills in `client_name`, `mentor_name`, and on Suggestions `session_id`, `client_id`, `client_name`, `date`, `outcome` and `outcome_at`. Use the record it sends back.
- `logSession` again with the same `session_id` replaces that session's list of next steps (keeping ratings on ones that stay).
