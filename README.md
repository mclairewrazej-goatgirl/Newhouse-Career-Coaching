# Coaching Tracker

A simple app for professional coaches to plan sessions, run a session timer, take point-form notes, keep a running total of time spent with each client, track which mentors have been suggested to whom, print a coaching summary for each client, and look back at what advice actually helped. Everything is saved in a **Google Sheet that belongs to the coach**, not to the person who built the app.

The app is protected by an **email and password** that the coach chooses. Anyone can open the web address, but without the password they only see a sign-in screen and can't read or change anything.

---

## Contents

1. [How it works (plain language)](#1-how-it-works-plain-language)
2. [Words used in this guide](#2-words-used-in-this-guide)
3. [Part A — One-time setup by the developer](#part-a--one-time-setup-by-the-developer)
4. [Part B — Setup for the coach (about 10 minutes)](#part-b--setup-for-the-coach-about-10-minutes)
5. [Part C — Using the app day to day](#part-c--using-the-app-day-to-day)
6. [Changing or resetting the password](#changing-or-resetting-the-password)
7. [Updating the app later](#updating-the-app-later)
8. [Troubleshooting](#troubleshooting)
9. [Security: what's protected and what isn't](#security-whats-protected-and-what-isnt)
10. [What's in the Google Sheet](#whats-in-the-google-sheet)
11. [Repository layout and local development](#repository-layout-and-local-development)
12. [Ideas for later](#ideas-for-later-not-in-v1)

---

## 1. How it works (plain language)

There are three pieces:

| Piece | What it is | Who owns it |
|---|---|---|
| **The app** | The screens you tap on: schedule, clients, timer, notes. A website hosted free on GitHub Pages. | The developer (Maddy). Holds **no** client data. |
| **The Google Sheet** | Where every client, planned session and logged session is stored, in plain rows and columns. | The coach, in the coach's own Google Drive. |
| **The sheet's "connector"** | A small script attached to the Google Sheet. It's the only thing allowed to read or write the sheet, and it checks the password on every request. | The coach. It comes along automatically when the coach copies the template sheet. |

When the coach logs a session, the app sends it to the connector, the connector checks the coach is signed in, and then adds a row to the coach's sheet.

```
 Phone / laptop                     Coach's Google account
┌──────────────┐   signed-in   ┌──────────────────┐     ┌──────────────┐
│   The app    │ ───request──▶ │  Sheet connector │ ──▶ │ Google Sheet │
│ (GitHub page)│ ◀──────────── │ (checks password)│ ◀── │ (your data)  │
└──────────────┘               └──────────────────┘     └──────────────┘
```

Because each coach copies the template into their **own** Google account, the data never touches the developer's account. Several coaches can use the same app, each with their own sheet and password.

---

## 2. Words used in this guide

- **Template sheet** — the blank starting Google Sheet the developer prepares. Coaches make their own copy of it.
- **Connector** — the script inside the sheet (Google calls it *Apps Script*). You never need to edit it.
- **Deploy** — Google's word for "switch the connector on so the app can talk to it." You do this once.
- **Connector address** — after deploying, Google gives you a long web address ending in `/exec`. It is how the app finds your sheet. You'll copy it once, during setup, and never need to look at it again.
- **Personal app link** — the link the setup screen gives you at the end. It opens the app already pointed at *your* sheet. Bookmark it or add it to your phone's home screen.

---

## Part A — One-time setup by the developer

You only do this once, no matter how many coaches use the app.

### A1. Publish the app on GitHub Pages

1. Push this repository to GitHub (e.g. `mclairewrazej-goatgirl/Newhouse-Professional-Coaching`).
2. On GitHub: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds the app and publishes it.
4. Your app will be at `https://mclairewrazej-goatgirl.github.io/Newhouse-Professional-Coaching/`. Open it. You should see the "This app isn't linked to a sheet yet" screen. That's correct.

### A2. Build the template sheet

1. Create a new Google Sheet in your account named **Coaching Tracker (template)**. Leave it empty; the connector creates the tabs.
2. In the sheet: **Extensions › Apps Script**. A code editor opens in a new tab.
3. Delete the sample code in `Code.gs`. Copy each file from this repo's `apps-script/` folder (all `.gs` and `.html` files, including `Shared.gs`) into the editor, using **+ › Script** for `.gs` files and **+ › HTML** for `.html` files, with the same names.
4. Click the gear icon (**Project Settings**) and tick **Show "appsscript.json" manifest file in editor**. Replace its contents with `apps-script/appsscript.json`.
5. In `Config.gs`, set `APP_URL` to your GitHub Pages address from step A1.
6. Click **Save** (disk icon). Close the editor.
7. **Do not deploy the template yourself.** Each coach deploys their own copy.

### A3. Make the "copy" link to send to coaches

1. In the template sheet: **Share › General access › Anyone with the link › Viewer**.
2. Copy the sheet's address. It looks like:
   `https://docs.google.com/spreadsheets/d/LONG_ID/edit#gid=0`
3. Replace everything after `LONG_ID` with `/copy`:
   `https://docs.google.com/spreadsheets/d/LONG_ID/copy`
4. That `/copy` link is what you send to a coach. Opening it shows a "Make a copy" button, and the copy includes the connector.

> Viewers of the template can't see anyone's data. The template is empty, and each coach's copy is private to them.

### A4. Hand off to a coach

1. Do Part B yourself in a second Google account (or with the coach on a call) and note anything confusing.
2. Add screenshots to [docs/COACH-QUICKSTART.md](docs/COACH-QUICKSTART.md) where it says `[screenshot: …]`.
3. Send the coach the `/copy` link and the quick start.

---

## Part B — Setup for the coach (about 10 minutes)

Do this on a **laptop or desktop computer** (Google's script screens are hard to use on a phone). You'll need the `/copy` link from the developer.

> A one-page version of Parts B and C, with screenshots, is in [docs/COACH-QUICKSTART.md](docs/COACH-QUICKSTART.md). Send that to the coach with the `/copy` link.

### B1. Make your own copy of the sheet

1. Make sure you're signed in to **your own** Google account in the browser.
2. Open the `/copy` link you were sent.
3. Click **Make a copy**. Your own copy opens, named something like *Copy of Coaching Tracker (template)*. Rename it if you like (e.g. *Coaching Tracker*).
4. Wait about 10 seconds. A new menu called **Coaching Tracker** appears at the top, to the right of *Help*. If it doesn't, refresh the page.

### B2. Give the connector permission

1. Click **Coaching Tracker › 1. Prepare my sheet**.
2. Google asks you to authorise. Click **Continue** and choose your account.
3. You'll probably see **"Google hasn't verified this app."** This is normal for small private tools. The "app" is the script now inside *your own* sheet. Click **Advanced**, then **Go to Coaching Tracker (unsafe)**, then **Allow**.
4. Click **Coaching Tracker › 1. Prepare my sheet** again. Six tabs appear: **Clients**, **Planned**, **Sessions**, **Suggestions**, **Mentors** and **MentorLinks**. A message says the sheet is ready.

### B3. Switch the connector on (deploy)

This is the step that tends to confuse people. You're telling Google: "let my app talk to this sheet."

1. In your sheet: **Extensions › Apps Script**. The code editor opens. Don't change anything in it.
2. Top right, click the blue **Deploy** button › **New deployment**.
3. Next to *Select type*, click the **gear icon** › **Web app**.
4. Fill in:
   - **Description:** `Coaching Tracker`
   - **Execute as:** **Me (your email)**. The connector writes to *your* sheet as you.
   - **Who has access:** **Anyone**. This doesn't make your data public: the connector refuses every request that doesn't carry your password. "Anyone" just lets the app reach the connector without a second Google sign-in.
5. Click **Deploy**. If asked to authorise again, repeat step B2.3.
6. Google shows a box with a **Web app URL** ending in `/exec`. Click **Copy**. This is your *connector address*.
7. Click **Done**. Close the code editor tab.

### B4. Finish setup and choose your password

1. Back in your sheet: **Coaching Tracker › 2. Finish setup**. A panel opens on the right.
2. **Connector address:** paste what you copied in B3.6. (If the panel already filled it in for you, just check it ends in `/exec`.)
3. **Email** and **Password:** choose what you'll use to sign in to the app. Use at least 10 characters for the password. These are stored only in your copy, and the password is stored scrambled (hashed), never as plain text.
4. Click **Save and get my app link**.
5. The panel shows your **Personal app link**. Click **Open the app**, or copy the link and send it to yourself.

### B5. Put the app on your phone

1. Open your personal app link on your phone.
2. Sign in with the email and password from B4.
3. Add it to your home screen so it opens like an app:
   - **iPhone (Safari):** Share button › **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu › **Add to Home screen** (or **Install app**).
4. Do the same on any laptop you'll use. You only need the personal link once per device; after that the app remembers which sheet it belongs to.

You're done. 🎉

---

## Part C — Using the app day to day

**Schedule tab**
- Dots on the calendar show **planned** sessions (teal) and **logged** sessions (grey). Tap a day to see them.
- **+ Plan a session**: pick the client, date, start time, how long it's booked for, and (optionally) paste the Google Meet link. If you already have someone booked that day, the form lists them so you can avoid a clash (you can still book).
- **Start unbooked session** (next to *+ Plan a session*): for a session that wasn't planned. Pick the client and length and it starts straight away.

**Running a session**
- Tap **Start session** on one of today's planned sessions (on the *Next up* card, in the day list, or on the client's page). At the top you'll see the **Join Google Meet** button, the **goals for today** (the next steps agreed last time), and **what you covered last time**.
- For each goal, answer **Did they do it?** (**Done** / **Not yet**). If it's done, mark whether it **helped**. If it's not done yet, tap **Carry over to next session** to add it to today's next steps, so it comes up again next time.
- Tap **Begin** to start the timer, and **Pause** / **Resume** as needed. It keeps counting if you switch apps or your screen locks, and the bar turns orange if you go over the booked time.
- Add points under **What you covered** and **Next steps**: type a point, press Enter or **+**. Tap a point to change it, use **↑ ↓** to reorder, and **×** to remove one. Notes are kept on the device as you type, so a refresh or flat battery doesn't lose them.
- You can leave the session screen to look something up. A green **Session in progress** bar above the tabs brings you back. Only one session can run at a time.
- **Mentor connections** sits below the notes. It shows the mentors this client is already connected with (with Email and Call buttons) and lets you change *suggested* to *introduced*. Tap **+ Add mentor connection** to connect someone new mid-conversation; you'll see the mentor's notes and a warning if they've been asked a lot lately.
- Tap **End, save & log**. The session is saved to your sheet, shows on the calendar, and adds to the client's total time.
- The app then offers to **book the next session**, pre-filled a week later at the same time with the same Meet link. Change anything, or tap **Not now**.
- Started one by mistake? **Discard session** at the bottom deletes it without saving anything.

**Clients tab**
- **+ Add client**: name and an optional coaching focus.
- Tap a client to see total time in their coaching block, their next booking, their mentor connections, and every past session's notes.
- **Mentor connections** on a client's page: tap **+ Connect**, pick a mentor, and choose either *Suggested they get in touch* or *I reached out and introduced them*. You can change it later from the same drop-down (for example, from suggested to introduced). Once you hear back, answer **Did they make contact?** (**Yes** / **Not yet**) on the same card. If a mentor has already been connected with 3 or more clients in the last 90 days, you'll see a gentle "give them a break" warning.
- **Coaching summary (PDF)** at the top of a client's page shows a clean document of every session: date, time, what you covered and next steps, plus the mentors you connected them with. Tick **Include mentor contact details** to add their email and phone. Tap **Save as PDF or print**, then:
  - **iPhone:** in the print screen, tap the **share** button at the top and choose **Save to Files** (or **Mail** to send it). On older iPhones, pinch outwards on the page preview to open the PDF, then share it.
  - **Android:** choose **Save as PDF** as the printer, then tap the download button.
  - **Computer (Chrome, Edge or Safari):** set the printer/destination to **Save as PDF** and click **Save**.

  The file is named *Coaching summary – Client name – date*. Ratings (Helped / Didn't help) are never included.

**Mentors tab**
- Your list of people you send clients to: name, role, organization, email, phone and notes (e.g. "prefers email intros").
- Each mentor shows how many clients they've been connected with in the last 90 days, so you can spread the asks around.
- Tap a mentor to email or call them in one tap and see every client you've connected them with.

**Review tab**
- Switch between **Week** and **Month**, and use the arrows to go back in time.
- See sessions held, time coached, suggestions given and mentor connections for that period.
- **Suggestions you gave** lists every next step from those sessions. Mark whether the client did it, then whether it **Helped** or **Didn't help**, and filter to see only what helped (or didn't). You can also mark these during the next session: the *Goals for today* card has the same buttons.

**Account tab**
- Shows who's signed in, whether everything is saved to your sheet (and how many changes are waiting), and buttons to **Open my Google Sheet**, **Sync now** and **Sign out**.
- **How this works** explains, in plain words, where your notes live, and how to reset a forgotten password from the sheet.
- If your sheet ever refuses a change (for example, a client was deleted in the sheet by hand), a short message pops up and the details show here.

**No internet?** Sessions you log are kept on the device and sent to your sheet automatically when you're back online. The Account tab shows how many are waiting.

---

## Changing or resetting the password

Only someone who can open your Google Sheet can do this. That's the point: your Google account protects the password reset.

1. Open your Google Sheet on a computer.
2. **Coaching Tracker › Change email or password**.
3. Enter the new details and save. Every device is signed out and needs the new password.

Forgot your password? Same steps. You don't need the old one.

---

## Updating the app later

**The screens (front end):** the developer pushes to GitHub and the app updates for everyone automatically. Coaches don't need to do anything.

**The connector (script in the sheet):** when the developer releases a new connector version, each coach needs to update their copy:

1. Developer sends the updated files from `apps-script/` (see [CHANGELOG.md](CHANGELOG.md) for what changed).
2. In your sheet: **Extensions › Apps Script**. Paste the new code over the old files and click **Save**.
3. **Deploy › Manage deployments**. Select your *Coaching Tracker* deployment and click the **pencil (edit)** icon.
4. Under **Version**, choose **New version**. Click **Deploy**.

> ⚠️ Always use **Manage deployments › edit › New version**. Don't make a **New deployment**: that creates a *different* connector address and the app would stop finding your sheet.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| No **Coaching Tracker** menu in the sheet | Refresh the page and wait 10 seconds. Make sure you're in *your copy*, not the template. |
| "Google hasn't verified this app" | Expected. **Advanced › Go to Coaching Tracker (unsafe) › Allow**. It's your own script in your own sheet. |
| Finish setup says the address is wrong | It must start with `https://script.google.com/macros/s/` and end with `/exec`. If it ends in `/dev`, you copied the test address: redo B3. |
| App says "This app isn't linked to a sheet yet" | Open your **personal app link** once on that device (from the sheet: **Coaching Tracker › Show my app link**). |
| "Wrong email or password" | Check for typos and capital letters. After 5 wrong tries, sign-in pauses for 15 minutes. Reset it from the sheet if needed. |
| "Your sheet needs an update before this can be saved" (or "Unknown action") | The sheet's script is older than the app. Follow [Updating the app later](#updating-the-app-later), then tap **OK** on the Account tab to clear the message. |
| "Can't reach your sheet" | Check your internet. If it continues, open **Extensions › Apps Script › Deploy › Manage deployments** and make sure the deployment exists and "Who has access" is **Anyone**. |
| Sessions stuck as "waiting to sync" | Open the Account tab and tap **Sync now**. If it fails, sign out and back in. |
| App stopped working after a connector update | You probably made a *New deployment*. Go back to **Manage deployments**, edit the original one, and choose **New version**. Or run **Finish setup** again with the new address and re-open the new personal link on each device. |
| Deleted rows by hand in the sheet | That's fine. The app reloads from the sheet. Don't rename the tabs or the header row. |

---

## Security: what's protected and what isn't

**Protected**
- The data lives only in the coach's Google Sheet, which is private to the coach unless *they* share it.
- Every request to the connector must include a sign-in token. Without one it returns nothing. Tokens come only from signing in with the correct email and password.
- Passwords are stored salted and hashed in the script's private settings, not in the sheet, and never in plain text.
- Five wrong passwords in a row pause sign-in for 15 minutes. Tries are counted before the password is checked, so sending many at once doesn't get around the limit. (The flip side: someone who knows your app link could keep sign-in paused by guessing. If that ever happens, change your password from the sheet, which also clears the pause.)
- Text that starts with `=`, `+`, `-` or `@` is saved with a leading `'` so the sheet never treats it as a formula.
- Every request has a size limit, and every field has a length limit.
- Sign-ins expire after 30 days, and changing the password signs out every device.
- The app (GitHub Pages) holds no client data and has no access to anyone's Google account.

**Good to know**
- The app web address and the connector address are not secret. They're like a building's street address; the password is the key.
- Signed-in devices keep a copy of recent data so the app works offline. Use **Sign out** on shared computers.
- Anyone with edit access to the Google Sheet can see everything in it. Don't share the sheet with people who shouldn't see client notes.
- This is a personal tool, not a certified health-records system. Avoid putting sensitive personal details in notes that you wouldn't put in a regular Google Doc.

---

## What's in the Google Sheet

Created automatically by **Prepare my sheet**. You can read, sort and filter it like any sheet. Don't rename tabs or header cells. When an update adds new columns, they're added to the end of the tab automatically.

**Clients**

| Column | Example |
|---|---|
| `client_id` | `c_8f2a…` (made by the app) |
| `name` | Jordan Reyes |
| `focus` | Moving from teaching into UX research |
| `active` | TRUE |
| `created_at` | 2026-11-08T10:05:00-06:00 |

**Planned**

| Column | Example |
|---|---|
| `planned_id` | `p_31c9…` |
| `client_id` | `c_8f2a…` |
| `client_name` | Jordan Reyes (for easy reading) |
| `date` | 2026-11-10 |
| `start_time` | 10:00 |
| `booked_min` | 60 |
| `meet_link` | https://meet.google.com/abc-defg-hij |
| `status` | booked / logged / cancelled |
| `created_at` | … |

**Sessions**

| Column | Example |
|---|---|
| `session_id` | `s_77de…` |
| `client_id` | `c_8f2a…` |
| `client_name` | Jordan Reyes |
| `date` | 2026-11-10 |
| `booked_min` | 60 |
| `actual_min` | 47.5 |
| `timed` | TRUE (FALSE = timer not used; booked length recorded) |
| `covered` | • Case study structure is solid<br>• Findings need evidence |
| `next_steps` | • Add two quotes<br>• Send draft by Friday |
| `planned_id` | `p_31c9…` (blank if unplanned) |
| `created_at` | … |

Bullet lists are stored one point per line inside the cell, so they stay readable in the sheet.

**Suggestions** (one row per next step, so you can rate what helped)

| Column | Example |
|---|---|
| `suggestion_id` | `g_5b10…` |
| `session_id` | `s_77de…` |
| `client_id` / `client_name` | `c_8f2a…` / Jordan Reyes |
| `date` | 2026-11-10 |
| `text` | Add two quotes from interview notes |
| `outcome` | helpful / not / (blank = no feedback yet) |
| `outcome_at` | when it was marked |
| `done` | yes / no / (blank) — did the client do it? |
| `done_at` | when that was marked |

**Mentors**

| Column | Example |
|---|---|
| `mentor_id` | `m_a41c…` |
| `name` | Dana Lee |
| `role` | UX Research Lead |
| `organization` | Northfield Digital |
| `email` | dana.lee@example.com |
| `phone` | 403-555-0142 |
| `notes` | Happy to do 30-min coffee chats |
| `active` | TRUE |
| `created_at` | … |

**MentorLinks** (who you connected with whom)

| Column | Example |
|---|---|
| `link_id` | `l_0c7e…` |
| `mentor_id` / `mentor_name` | `m_a41c…` / Dana Lee |
| `client_id` / `client_name` | `c_8f2a…` / Jordan Reyes |
| `status` | suggested / introduced |
| `date` | 2026-11-03 (when the status was last set) |
| `created_at` | … |
| `contacted` | yes / no / (blank) — did the client make contact with the mentor? |
| `contacted_on` | date they made contact (blank if not recorded) |

> Mentor contact details are about people who aren't your clients. Only store what they've agreed to share, and keep the sheet private.

---

## Repository layout and local development

```
Newhouse-Professional-Coaching/
├── app/                    # The front end (React + Vite + TypeScript, PWA)
│   ├── src/
│   └── vite.config.ts
├── apps-script/            # The connector — pasted into the template sheet
│   ├── appsscript.json
│   ├── Config.gs           # APP_URL, token lifetime, lockout settings
│   ├── Api.gs              # doGet/doPost router
│   ├── Auth.gs             # password hashing, tokens, lockout
│   ├── Data.gs             # read/write all six tabs
│   ├── Shared.gs           # pure helpers: schema, validation, row mapping (mirrored in app/src/shared)
│   ├── Menu.gs             # sheet menu: Prepare, Finish setup, Change password
│   ├── Setup.html          # the "Finish setup" side panel
│   └── TESTING.md          # checklist + PowerShell/curl commands for a test copy
├── .github/workflows/deploy.yml
├── docs/COACH-QUICKSTART.md  # one-page setup and daily-use guide for the coach
├── CHANGELOG.md            # what changed in each connector version
├── CLAUDE.md               # context for Claude Code
└── README.md
```

**Run the app locally**

```bash
cd app
npm install
npm run dev
```

Open the printed local address with your personal-link suffix (`?connect=…`) to point the local app at a real test sheet, or set `VITE_DEMO=1` in `app/.env.local` to use built-in sample data with no sheet at all. In demo mode, sign in with any email and the password `demo-password`.

**Optional: edit the connector from this repo with clasp**

```bash
npm install -g @google/clasp
clasp login
cd apps-script
clasp clone <SCRIPT_ID_OF_YOUR_TEST_COPY>   # Script ID: Apps Script › Project Settings
clasp push
```

Use clasp only against **your own test copy**, never a coach's sheet.

---

## Ideas for later (not in v1)

- Create the Google Calendar event and Meet link automatically when booking (needs Calendar permission in the connector).
- Email reminder the morning of a session.
- Save the coaching summary PDF straight to the coach's Google Drive (needs Drive permission in the connector).
- "Suggest a mentor" shortcut inside the live session screen.
- Mentor-side view: which clients actually followed up, and whether the intro went well.
- Multiple coaches sharing one sheet with separate logins.
