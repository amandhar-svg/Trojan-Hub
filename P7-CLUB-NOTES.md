# Part 7: Club view redesign (branch `p7-club`)

Files: `js/p7-club.js`, `css/p7-club.css`; `template.html` loads them right after `p6-order.css` / `p6-order.js`.
No existing file was edited besides template.html.

## Structure
Tab bar (club side): **Today · Plan · People · Promote · Money**. Club menu via the ☰ button in the club header (`orgmore`).

| Job | Main route | Sub-tabs (older screens, re-dressed, unchanged logic) |
|---|---|---|
| Today | `org` (replaced) | 3 decisions with their next action, pipeline counts, next event |
| Plan | `orgplan` (new) | Events pipeline · Requests (`orgreq`) · Rooms (`orgspace`) · Insights (`orginsights`) |
| People | `orgpeople` (new) | Roster · Chat (`orgchat`) · Inbox (`orginbox`, USC office only) |
| Promote | `orgpromote` (new) | Announce + Luma · Newsletter (`orgnews`) |
| Money | `orgmoney` (new) | Overview · Dues ledger (`orgmem`, Part 6, intact) · Budget (`orgbudget`) |

- `orgtools` is deleted from `TH.screens`; `TH.go('orgtools')` lands on `org`.
- `orgtommy` stays as the follow-up chat behind inline Tommy buttons ("Ask a follow-up"); it is no longer a tab.
- Older screens are wrapped at render time (`reshell`): their `.x-modebar` is replaced by the new club header + sub-tabs. Their own `mount` still runs. If hub2b.js renames a screen or drops `.x-modebar`, the wrapper still works (it only looks for `.screen`, `.topbar`, `.screen-body`).
- The tab bar is the same `nav.tabbar.x-org` hub2b.js inserts (its show/hide logic is kept); its buttons are replaced with `data-p7tab` buttons.

## Data (all in `TH.H().x.orgs[id]`, so Undo / Reset demo account cover it)
- Events: the same `o.events` hub2b's Schedule writes. New optional fields: `room` (booking id), `annAt`, `doneAt`, `att`, `cost`, `rating`, `fbNote`, `askFb`, `rsvp`, `luma`, `from`.
- Announcements go into `o.sent` (the newsletter's store), with `ev` set, so they show in #announcements and students' Club Newsletters.
- `o.p7`: `{ luma: {url, at}, msgs: [], venmoFeed: {} }`.
- Roster actions write the same maps as Part 6 (`paid, paidAt, paidAmt, via, added, removed, role`).
- Dues ledger "Check now" (hub2b) is rebound to "Match all", which uses the same simulated Venmo feed as People.

## Truthfulness
- Luma: link only, status "Linked", with "Links only: events don't sync" shown. "Add to Luma" opens luma.com/create and copies the details. No `luma.mjs` function: Luma's public ICS URL needs a `cal-…` id (`api.lu.ma/ics/get?entity=calendar&id=cal-…`, seen only in third-party examples, not Luma docs), and lu.ma was unreachable from the build container to confirm it.
- RSVPs and costs on app-scheduled events are labeled Est.; the cost estimate comes from the sample ledger's "cost per attendee". EngageSC events show no RSVP counts.
- Venmo matches, reminders, messages, attendance lists are labeled Simulated.

## Tests
`python3 scripts/build.py /tmp/th.html; node scripts/smoke.cjs /tmp/th.html` → NO ERRORS (new routes are picked up automatically from `TH.screens`). `node scripts/safety-suite.cjs /tmp/th.html SAFETY-PHRASES.json` → FAILS: 0.

## Part 7b: real AI drafting + "Tommy is learning"
- `aiDraft(kind, payload)` calls `TA.AI.draft` (guarded: undefined, a throw, a rejection, empty text, or a 25 s timeout all count as `null`).
  - `'announcement'`: `{club, title, when, where, desc, rsvpUrl?}` (rsvpUrl = the event's or club's Luma link). Used by "Draft the announcement" (event card, Promote) and "Draft with Claude" in the Announce sheet.
  - `'members-summary'`: `{club, requests:[{title, votes, type, preferred}]}` (open requests, at most 12). Used by "What do members want?" (Today) and "Summarize what members want" (Plan).
  - Payloads never include member names, emails, dues or paid status (verified with a stub that records payloads).
- The draft sheet shows "Claude is writing…", then an editable box tagged `Written by Claude Haiku · from your event details` / `· from N member requests` (the model name comes from `res.model`; it says "Claude" if the id isn't recognized). Actions: Regenerate / Use this / Send (Simulated). On null the template is shown and tagged `Template · AI writing works on the live site`. `res.sources` is shown if present.
  - Announcement: Use this → Announce sheet prefilled; Send → posts the announcement (simulated).
  - Members summary: Use this → pins it above Plan › Requested; Send → shares it with officers (simulated, on device).
- "Who hasn't paid?" and the budget answers stay on the device: the old "Rewrite with AI" button was removed from those sheets.
- `TA.AI.learning()` feeds the "Tommy is learning" card on the USC-office Today screen and a "Tommy is learning" row in the club ☰ menu. Rows show name, why, up to 2 examples (labeled AI paraphrase), "Asked N times · last …", Approve / Dismiss (simulated, saved in `TH.H().x.p7learn`, with Undo). On null: "Proposals appear here on the live site when Tommy can't answer something."
- Exposed for tests: `TH.p7.aiDraft`, `TH.p7.aiLearning`, `TH.p7.announcePayload`, `TH.p7.summaryPayload`.
