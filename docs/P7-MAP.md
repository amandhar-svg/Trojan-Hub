TROJAN HUB, PART 7 MAP (read-only; no project file was edited)

I built a test copy with /home/user/trojan-hub-v4/scripts/build.py. It is /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/p7/map/th.html, 19.43 MB. I drove it with Playwright at 402x874 and 1440x900 in light mode and looked at every screenshot. No console or page errors appeared in any run.

How line references work:
- "M" means /home/user/trojan-hub-v4.
- "F" means /home/user/trojan-hub-v4-fix. Other fixers are editing F right now, so F line numbers drift by a few lines; the function names are stable. Current F numbers as of about 01:50.
- Files that are the same in both copies get one number: app.js, data.js, ta/app.js, ta/ai-sample.js, ta/embed.js, css/app.css, css/hub2.css.
- To get fresh numbers, rerun: python3 /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/p7/map/anchors.py (about 150 anchors, M and F).

====================================================================
1. ORGANIZER / CLUB VIEW
====================================================================

**How you get in and out**
- The only way in is the student More screen. A maroon "STUDENT SIDE … Organizer" bar has a button with data-go="org".
  - It is injected by the More wrapper in hub2a.js (M:681-695, button at M:686; F:886-898, button at F:891).
- Ways out:
  - The "Student" button in the org header (`header`, hub2b M:63 / F:65).
  - "Back to the student side" on the Tools screen.
- On load, the hub2b TH.boot wrapper always rewrites any #org… hash to #home (M:747 / F:762).
- The org switcher is `<select id="x-org">` inside `header()`. It appears on every org screen except chat.
  - `orgs()` (M/F:16) returns two entries: primaryClub() with role 'Treasurer', and {id:'usc', 'USC Campus Activities', 'Staff'}.
  - `cur()` is at M/F:22. The choice lives in TH.state.xorg and is not saved.
  - primaryClub() (hub2a M:67 / F:77) is deterministic. It picks a registered club with the most upcoming EngageSC events and prefers academic/career/Viterbi clubs. Result: "Viterbi Career Connections" (id 36945).

**The 5-tab bar**
- Injected by the hub2b TH.boot wrapper (markup M:750-751 / F:765-766).
- Tabs: Dashboard (org, grid icon), Requests (orgreq, megaphone), Tommy (orgtommy, sparkle), Members (orgmem, users), Tools (orgtools, layers).
- `syncNav` (M:739 / F:754) runs from a MutationObserver on #screen-host. It hides the student tab bar whenever the route matches /^org/.
- The OTAB map (M:738 / F:753) decides which tab is highlighted:
  - orgchat highlights Members.
  - orgnews, orgbudget, orgspace, orginsights and orginbox all highlight Tools.
- CSS: hub2.css:2-3 (gold top border).
- There is no More tab, and no Inbox tab.
- Any new org route must start with "org" and be added to OTAB.

**The screens** (all in hub2b.js unless noted; `scr()` at M:66 wraps title + header)

a) **Dashboard** (`org`, M:71 / F:73)
- Club version:
  - 4 tiles. "Members" and "Dues paid 10/16 · $250 collected" go to orgmem. "Open event requests" and "Student votes on them" go to orgreq.
  - "Club calendar" shows the next 4 EngageSC events (`upcoming()`, M:62) plus every item in O(org).events.
  - Every O(org).events item gets a gold "Requested" pill, even ones made with "Create event".
  - "+ Create event" opens createClubEvent (M:145 / F:147). There is also a "Book a space" link.
  - Text line: "N space requests waiting for approval".
  - A "Most wanted: <top request>" promo goes to orgreq.
  - Rows: Ask Tommy, Send a newsletter, AI budget summary, Attendee insights.
- USC version:
  - Tiles: open problem reports and Tommy questions to answer go to orginbox; campus-wide requests and votes go to orgreq.
  - Bars of votes by request type.
  - Rows: Ask Tommy, Reports and flagged questions (orginbox), Space requests (orgspace).

b) **Requests** (`orgreq`, M:240 / F:242)
- Segmented control: This club / All of USC.
- Filter chips: Everyone, Our members, By major, By career goal, Similar clubs, with major and goal dropdowns.
- "Tommy's read" box (reqSummary, M:137) with two links: "Have Tommy write it up" (uses ai()) and "Ask Tommy a follow-up".
- Ranked rows show: vote count, type, preferred time, who it was sent to, and a "N of your members · mostly X majors · goal" breakdown. The breakdown comes from `bd()` (M:121) and is sample data.
- Each row has a "Schedule" button. After scheduling it becomes a "Scheduled" pill.

c) **Schedule sheet** (`schedule(org,r)`, M:195-238 / F:197-240). Screenshots: club-schedule-sheet.png, club-after-schedule.png, club-org-after-schedule.png.
- What gets prefilled:
  - The title appears only in the heading and cannot be edited.
  - Date is today + 7 days. It ignores the request's preferred time (for example "Weeknight evening"). Start is 18:00.
  - "Where" is an empty free-text field with the placeholder "book a space after this".
  - "Event details" is filled from r.desc, but the seeded requests have no desc, so it shows blank.
  - Hashtags are filled from r.hashtags (none). "AI Generate Hashtags" calls TH.ai.generateHashtags (core.js M:235 / F:272), which is keyword-based. For a boba study break it produced #Robotics and #Viterbi.
- What the "Schedule and tell requesters" button does:
  - Pushes {id, title, start, where, desc, hashtags, org, req: r.id, priority} into O(org).events and sets r.status = 'scheduled'.
  - Only if the demo student asked for or voted on the request, it adds the event to the student's calendar and sends them a note.
  - Shows a toast.
- What is missing:
  - No room field or booking link. Bookings do not store an event or request id.
  - No Announce step.
  - No RSVP list or count.
  - No cost.
  - No "duplicate".
- Downstream gaps:
  - Scheduled events never reach the newsletter: nlDraft only uses EngageSC `upcoming()`.
  - Attendee insights also uses EngageSC events only.
  - The sheet for an x- event always says "Scheduled from a student request", even for events made with Create event (hub2a TH.openEvent wrapper, M:479 / F:539).

d) **Create event sheet** (createClubEvent)
- Fields: title, date (today + 3), start 18:30, where, details, hashtags with AI.
- "Publish" writes to O(org).events and to TH.H().eventHashtags, and also pushes the event onto the student's own calendar (kind 'club').

e) **Tommy** (`orgtommy`, M:305 / F:307). Covered in the "Tommy in the org view" section below.

f) **Members & Dues** (`orgmem`, M:460 / F:475). This is the Part 6 rewrite, which lives inside hub2b. Another fixer (B6) is editing add/remove right now.
- Collected and Outstanding totals with a split bar.
- Dues per semester with an inline Edit form.
- "+ Add member" opens addSheet (M:370 / F:376): name, @usc.edu email check, role chips, year, an "already paid" box, and an Undo toast.
- "Remind N unpaid" opens remindSheet (M:443 / F:458). It shows the recipients and the message and sets o.reminded. This is simulated, and it is already a bulk action.
- Venmo row:
  - "Check now" (M:~497 / F:~512) marks exactly ONE unpaid member as paid per tap. I verified paid count going 10 → 11.
  - "Link" connects Venmo.
- A "Members chat" row.
- Search box that matches name, email, role and year text.
- Chips: All / Paid / Unpaid, with counts.
- Each member row: avatar, role chip, "year · email · via", a "Mark paid" / "Paid $25 · Oct 13" toggle (togglePaid, M:431 / F:446, with Undo), and a trash button (removeSheet, M:413 / F:422, with Undo).
- Missing: year filter, multi-select, bulk mark paid, "message all attendees", export.
- The roster is generated by `roster()` (M:38 / F:40): you (if you joined) + members you added + 12-18 sample NAMES hashed from the org id − removed members.

g) **Members chat** (`orgchat`)
- The hub2b version (M:506 / F:521) is dead code. hub2c.js replaces it (M:377 / F:486) with `thread()` (M:324 / F:433).
- Channels: #general, #events, #announcements. Only officers can post in #announcements, and sent newsletters show up there. Messages have likes and a composer.
- No org header on this screen.

h) **Tools** (`orgtools`, M:514 / F:529). This is the club view's "More" screen; see section 2.

i) **Newsletter** (`orgnews`, M:533 / F:548)
- Subject and message, prefilled by nlDraft (M:529) from EngageSC events, the top open request and dues.
- "Send to": all, paid, or unpaid members.
- "Draft with AI" uses window.claude 'sample', or a template if that isn't available.
- "Send" adds to O(org).sent.
- A real "Open this draft in Gmail" link.
- A "Sent" list.

j) **AI Budget Summary** (`orgbudget`, M:595 / F:610)
- A generated 3-semester ledger: budget() (M:572) and budgetFacts (M:583).
- "Write this up with AI", plus bars.
- No real expenses and no per-event cost.

k) **Book a Space** (`orgspace`)
- The hub2b form version (M:622 / F:637) is dead code. hub2c spScreen / TH.screens.orgspace replaces it (M:451, 474 / F:560, 583).
- Controls:
  - Classroom / Library room / Event space.
  - A 7-day strip, people expected, length.
  - Per-room hourly slot grids from ROOMS (M:439); availability is sample data.
- Selecting a room shows:
  - A "For a requested event" dropdown. It only raises the priority and is not saved on the booking.
  - "Request <room>", which writes to O(org).bookings: {id, type, place, room, dk, h, len, when, heads, pri, status:'pending', at, org}.
- hub2a tick() (M:719, 722 / F:927, 934) auto-approves pending bookings after 20 seconds and sends a notification.

l) **Attendee Insights** (`orginsights`, M:675 / F:690)
- Uses the next EngageSC event and a sample "N signed up".
- Tommy summary with "Rewrite with AI".
- Bars for snacks, drinks, dietary needs and career goals. These come from insights() (M:656): generated tallies plus your own shared profile.
- Feedback from feedback() (M:667): generated numbers plus your thumbs.
- A privacy banner.

m) **Inbox** (`orginbox`, M:712 / F:727)
- Problem reports: x.reports plus 2 SAMPLE_REPORTS, with Route / Start work / Resolve buttons.
- "Questions Tommy couldn't answer", with an Answer sheet (answerGap, M:703).
- Only linked from the USC dashboard and USC Tools. For a club it is reachable as a route but nothing links to it.

**Data model**
Everything lives in TH.H().x (= TA.State.d.hub.x). It is created and filled in by hub2a X() (M:48 / F:61); seeds are at M:62, 78 / F:72, 88.

- **x.orgs[orgId]**, accessed through `O(org)` (M/F:23):
  - dues: TH.clubDues amount or 20; Viterbi is $25.
  - paid {name: bool}, via {name}, paidAt {name: ms}, paidAmt {name: $}, role {name}.
  - added [{name, email, role, year, at}], removed [name].
  - venmo {on, handle, at}, reminded.
  - events [], bookings [].
  - sent [{id, subject, body, at, count, emailed, org, sample?}]. A sample newsletter is seeded by hub2c seedNews (M:382 / F:491).
- **x.evreqs** [{id, title, type, votes, clubId|null, clubIds?, when, note, mine, status:'open'|'scheduled', at}]:
  - 8 seeded.
  - `reqsFor` (M:61) uses TH.x.reqFor; a null clubId means the request goes to every club.
  - x.votes holds the student's votes.
  - Students create requests from the Home "Don't see what you want?" row (hub2c requestRow / requestSheet, M:260, 195 / F:369, 304). This auto-routes to up to 4 relevant clubs.
  - There is also an orphaned full-screen 'requests' route (hub2a M:372 / F:432) that nothing links to.
- **Other keys:** x.gaps (see section 8), x.reports, x.panic, x.chats {'club:<id>#<chan>': [...]}, x.likes, x.seen, x.fb, x.w, x.profile, x.conn, x.notif, x.mail.
- **Outside x:** TH.H().calendar entries with ref 'x-<id>', and TH.H().eventHashtags.
- **Not stored at all:** budget, insights, feedback, roster and request breakdowns are generated on every render. There is no RSVP model for org events.

**Which pieces wrap earlier layers**
- hub2b defines all org screens. It also:
  - exports TH.xo (M:744 / F:759): {cur, O, scr, header, bindHeader, priority, reqsFor, orgs, roster, duesTotals, money, upcoming};
  - wraps TH.toast to support Undo toasts (M:348);
  - wraps TH.boot to add the org tab bar, the syncNav observer, TH.x.wrapTommy / initVoice, and a 4-second TH.x.tick.
- hub2c loads after hub2b and replaces orgchat and orgspace wholesale, using TH.xo.
- hub2a supplies:
  - the TH.x helpers (X, save, note, ai, askTommy, primaryClub, member, NAMES, PF, STAT, RC);
  - the More entry button;
  - the x- event sheet;
  - tick(), which approves bookings and re-renders only the routes report, orgspace, org and orginbox.

**Tommy in the org view**
- Suggestion chips (SUGG, M:274).
  - Club: "What should we host next?", "What do our members want?", "What are CS majors asking for?", "Who hasn't paid dues?", "How is our budget?", "What food should I order?", "How do I reserve a table on Trousdale?".
  - USC: a different set of 4.
- tommyAsk (M:291) first tries orgFacts (M:275), a regex router. Topics: dues, budget, food/RSVP, feedback, newsletter/announce, reports/flagged (USC only), and requests (which also sets the Requests filters).
  - The newsletter/announce answer only says "open the newsletter, tap Draft with AI". Tested with "Draft the announcement": it drafts nothing.
  - If window.claude.use('sample') exists, the answer is optionally rewritten by it.
- Anything else falls through to student Tommy (hub2a askTommy, M:574 / F:644).
- Inline Tommy already exists in: Requests (write-up, follow-up), Budget, Insights, and Newsletter "Draft with AI". Members has none.
- All of this AI writing (hub2a ai() M:98 / F:108, newsletter drafting, org Tommy rewrite) uses only window.claude 'sample'. On a normal website it falls back to templates. ai-api.js does not cover any of it.

====================================================================
2. MORE SECTIONS
====================================================================

**Student More** is built in three layers (screenshots more-1..4.png):
- app.js screens.more (M=F:834-899).
- The hub2a wrapper (M:681-695 / F:886-898).
- The p6-profile wrapper (M:490-494 / F:606-610). It only rewrites the "My Profile" subtitle to show "% set up".

Rows in order, with where else each one already appears:
- **Profile card** (app.js:841). Originally data-go "wallet"; hub2a rewrites it to "profile".
- **Organizer switch bar** (hub2a).
- **hub2a rows:**
  - My Profile: duplicates the profile card and the Home avatar.
  - Reports: duplicates Home "Report something" / "My reports".
  - Club Messages: duplicates the Home news band's "Messages" link.
  - Call Tommy (data-xcall): duplicates the phone icon in the Tommy header.
  - Connections & Alerts: Gmail, calendars, Slack, GroupMe, Handshake; app-or-email setting per alert; phone calendar export; link to Tommy Everywhere. This is settings, so keep it.
- **app.js:843-851:**
  - Getting Around: duplicates Home Free Lyft / Next Bus and + Get a Ride.
  - Metro U-Pass: duplicates the Wallet card.
  - Dining & Mobile Order: duplicates Home and + Order Food.
  - Trojan Pass: duplicates + Trojan Pass and Home Book a Room.
  - Virtual Lines: duplicates +.
  - Clubs: duplicates +.
  - Events: duplicates + and My Day.
  - Safety: duplicates Home / + Safe Walk and SOS.
  - Trojan Wallet: duplicates the Home wallet icon (F also has a Wallet button on the profile).
- **app.js:854-857:**
  - Grades: duplicates the Home quick icon.
  - Club Newsletters: overlaps Club Messages "From clubs" and Home "This week from your clubs".
  - Tommy's Watch List: duplicates the Home "Notify me when…" box.
  - Guests: duplicates Home Guest Pass.
- **app.js:860-864:**
  - Ask Tommy: duplicates the Home icon, the + menu and the floating button.
  - Game Day: duplicates the Wallet game card.
  - Accessibility: unique.
  - Alerts: duplicates the Home bell.
  - About this prototype (screens.js M:890): unique.
- **Demo controls card** (app.js:866-874, handlers 877-898): Demo time, Appearance (theme), Reset demo account. The desktop pitch hint (template.html:42) says "Try More → Demo controls → 9 PM"; update it if this moves.

Missing from More:
- Sign out and Account & permissions. They exist only in Ask Tommy's ⋯ menu (ta/app.js:7442-7443): Account & permissions, Activity log, Claude AI mode & settings, About & sources, Clear conversation, Sign out (tommy-menu.png).
- Help, contact or feedback.

Essential set for the student More:
- one profile/account row
- Connections & Alerts (notifications)
- Appearance
- Accessibility
- Organizer switch
- Sign out and Account & permissions (moved out of Tommy)
- Tommy settings
- Help / About / feedback
- Demo controls, collapsed (demo only)

**Club-view "More" = Tools** (orgtools M:514-523 / F:529-538; club-orgtools-1.png, usc-orgtools.png)
- Club rows: Newsletter, AI budget summary, Book a space, Attendee insights, Members chat, Club profile (opens the student club sheet), plus a "Back to the student side" button.
  - Duplicates: Newsletter, Budget and Insights are also Dashboard rows; Book a space is also a Dashboard link; Members chat is also on the Members screen; Back to student duplicates the header's "Student" button.
- USC rows:
  - Problem reports and Flagged Tommy questions both open orginbox.
  - Event request data duplicates the Requests tab.
  - Space requests opens the booking form, not an approval queue.
- Missing: club settings (dues and Venmo only live in Members), an Inbox for clubs, and any external link. A search for luma / lu.ma / eventbrite found nothing anywhere.

====================================================================
3. DESKTOP LEFT SIDE (1440x900)
====================================================================

**What is there.** `<aside class="pitch">` (template.html:22-43):
- eyebrow "USC student app · Prototype"
- h1 "One app for all of USC."
- intro paragraph
- a 14-item feature list
- the hint paragraph

**Why it clips and won't scroll.** These rules in css/app.css combine:
- :34 `html, body {height:100%}`
- :36 `body {…; overflow:hidden}`
- :49 `.stage {height:100%; display:flex; align-items:center; justify-content:center; gap:56px}`
- :50 `.pitch {display:none; max-width:380px}`
- :52-55 `@media (min-width:900px) and (min-height:640px) { .stage{padding-block:20px…} .pitch{display:block} .device{width:402px; height:min(874px,100%)…} }`

.pitch has no max-height and no overflow. Flex centering pushes it out equally above and below the viewport, and body overflow:hidden cuts both ends. The top overflow could not be reached even if scrolling were allowed. No other CSS file touches .pitch or .stage.

**Measured**
- At 1440x900: the pitch is 941px tall. Its top is at y = -20, so the eyebrow (y -16 to -1) is fully hidden. Its bottom is at 920, so the hint is cut off.
- At 1280x720: the top is at y = -110. The h1's first line and the last 3 list items are cut.
- Mouse wheel over it moved nothing (document scrollTop 0, pitch scrollTop 0).
- Also: the "Club hashtag AI generator" item wraps to 4 lines because of the `1fr auto` grid at app.css:62.

**Where to fix.** Inside that media query, give .pitch `max-height:100%` (or `calc(100dvh - 40px)`), `overflow-y:auto` and `overscroll-behavior:contain`, and/or set `.stage{align-items:safe center}`.

====================================================================
4. ONBOARDING "Skip for now"
====================================================================
- **Where defined:** p6-profile.js obHeader() (M=F:95-100) renders `<button class="p6-ob-skip" data-ob="skip">`. The label is "Skip for now", or "Close" on the last step. It sits top-right of .p6-ob-top, next to the progress dots.
- **What it does:** obClose('skip') (M=F:169-175) sets P().obSkipped and toasts "No problem. Finish anytime from Home or your profile."
- **Related:**
  - TH.openOnboarding is at M=F:176.
  - It auto-opens 3.3 s after boot unless the user is onboarded, has skipped, or the browser is automated (M:543 / F:675).
- **Current look:** css/p6-profile.css M:67 / F:73: `.p6-ob-skip {font-size:13.5px; font-weight:700; color:var(--muted); padding:8px 4px; flex:none}`.
  - It renders as grey text, rgb(109,96,97), with no background or border, in an 87x36 px box (onboard-0.png, onboard-1.png).
  - The footer has no skip at all: the welcome step has only "Let's go"; question steps have a count plus Next / Finish.

====================================================================
5. HOME QUICK ICONS AND THE CENTER + MENU
====================================================================

**Home quick grid**
- Defined at app.js:517-519 inside screens.home.render (M=F:485) as an inline array:
  `[['Grades','grad','grades'],['Free Lyft','car','rides:lyft'],['Next Bus','bus','rides'],['Order Food','bag','food:order'],['Guest Pass','idcard','guests'],['Safe Walk','walk','safety'],['Book a Room','ticket','pass:room'],['Ask Tommy','sparkle','assistant']]`
- Rendered as `<nav class="quick">` buttons, each `data-go` with an icon tile.
- Two later wrappers depend on that element, so keep `<nav class="quick">` and its class when you make it customizable:
  - The hub2c home wrapper (M:271 / F:380) rewrites 'pass:room' to 'book:room' (M:274 / F:383) and uses the .quick node as the anchor for every Home row it inserts.
  - The p6-profile home wrapper (M:479 / F:595) uses a regex to insert the setup card and the "Plan my day / Report" pair right after that `<nav>`.
- CSS: app.css:106-109 (4 columns, 54px tiles).

**Center + menu**
- The `.fab` button lives in the student tab bar (app.js:918-923, onclick openPlus at 925).
- Items come from `PLUS` (app.js:216-220), which is private to its closure and not exported:
  `[['Get a Ride','car','rides'],['Order Food','bag','food:order'],['Trojan Pass','ticket','pass'],['Virtual Line','queue','queue'],['Safe Walk','walk','safety'],['Clubs','users','clubs'],['Events','calendar','events'],['Find a Restroom','wc','map:restroom'],['Ask Tommy','sparkle','assistant']]`
- openPlus (221-226) injects a `.plusmenu` overlay, "What do you want to do?", as a 3-column grid inside .device. closePlus is at 227 (TH.closePlus). CSS: app.css:178-185.
- Overlap with Home: Order Food, Safe Walk, Ask Tommy.

**Routing.** bindCommon (app.js:192) splits "route:arg" into TH.go(route, {arg}).

**Customization today.** None: no preferences, no edit UI, and PLUS is not exported.

**Where a preference could be stored**
- TH.store (core.js M:145): localStorage keys 'th:*'. UI prefs are saved through saveUI (app.js:27). "Reset demo" wipes it with store.clear().
- TH.H().x: part of the account, also cleared by Reset.

Screenshots: home-1.png / home-m.png, plus.png.

====================================================================
6. WALLET / DINING DOLLARS
====================================================================

**Data**
- ta/app.js:831: `dining:{plan:'flex120', planNext:null, swipesLeft:47, swipesTotal:120, guestLeft:5, diningDollars:63.4, ddBlocks:[]}`. USCard discretionary is $42.50.
- Exposed through TH.student().dining (core.js M:355 / F:392).
- Plan TA.POLICY.mealPlans flex120 (ta/app.js:768): "120 meal swipes + $150 Dining Dollars + 7 guest swipes per semester".
- TA.POLICY.cal (750-754) for Fall 2026:
  - classesBegin 2026-08-24
  - classesEnd 2026-12-04
  - finals "Dec 9–16, 2026"
- Regular dining-hall hours run 2026-08-24 to 2026-12-04 (759).
- Dining Dollar blocks are [250, 500] at 10% off (773).
- Demo date: Mon, Nov 9, 2026.

**Transactions: none are stored.** The balance changes in only two places:
- Mobile-order pickup debits it (actions.js:218-231, A.orderPicked; orders live in TH.H().orders).
- The TA add_dining_dollars action credits it (ta/app.js:2237-2259; pushes to ddBlocks).

There is no spend history, no per-day rate and no semester-end countdown anywhere.

**Where it is shown**
- Wallet (screens.js M:755 / F:757; cards at M:766; wallet-1.png, wallet-2.png).
- Dining screen (screens.js:273).
- Order sheets (screens.js:309, p6-order.js:281).
- Tommy.

**Tommy today**
- "how many dining dollars do I have" and "what is my meal plan" go to B.acct.dining (ta/app.js:4975-4977, routed at 4821). It answers with the plan, swipes, $63.40, discretionary, and "Unused swipes and Dining Dollars reset at the end of the semester."
- That router explicitly excludes "per day / a day" wording:
  - "how much should I spend per day on dining dollars" falls to the knowledge base and returns the Trojan Plan description, which is wrong.
  - "dining dollars per day" returns the Flex120 description.
- None of the Tommy script commands covers Dining Dollars.
- Account answers need Tommy to be signed in. TA signs in automatically when the Tommy screen mounts (embed.js:169/182). Calls made elsewhere before that get a sign-in card.

**Policy facts already in the app**
- **Knowledge-base answer to "do dining dollars roll over"** (also triggered by expire/refund wording; tommy-dd.png):
  > "Dining Dollars on the Trojan Plan, Flex120 Plan and Dining Dollar Blocks don't roll over and aren't refunded; block Dining Dollars are forfeited on the last day of the semester. Flex120 unused swipes and Dining Dollars are forfeited at the end of the semester. Cardinal Campus Center swipes reset every Sunday. Community 25/50 plans last until the last day of the school year. Summer 2026 Dining Dollar blocks did not roll into Fall 2026. Remaining meal plan funds can't be refunded, transferred or sold… donate unused Dining Dollars… (USCard discretionary does roll over.)"
  - Sources:
    - https://hospitality.usc.edu/frequently-asked-questions/
    - https://mycard.usc.edu/meal-plans/
    - https://hospitality.usc.edu/meal-plan-options/
    - https://mycard.usc.edu/deposit-funds/
- **Knowledge-base answer to "what are dining dollars":**
  - Flex120 includes $150 per semester; Community 25 has $50 and Community 50 has $100; the Trojan Plan is $4,840.
  - $250 / $500 blocks at 10% off.
  - Dining hall entry deducts $16.99 / $19.99 / $21.99.
  - Usable only at USC Hospitality venues that don't serve alcohol.
  - Same hospitality and mycard sources, plus https://mycard.usc.edu/.
- **Hard-coded TA notes:**
  - ta/app.js:2226: "Unused swipes and Dining Dollars on swipe plans reset at the end of each semester." Sources: meal-plan-options, mycard meal-plans.
  - ta/app.js:2255: block Dining Dollars are forfeited on the last day of the semester (Fall 2026 finals Dec 9–16).
  - r4After at 5981: the same fact, with the hospitality FAQ and meal-plan-options as sources.
- **Knowledge-base academic calendar:** Fall 2026 classes end Fri Dec 4; study days Dec 5–8; finals Wed Dec 9 – Wed Dec 16. Sources: https://www.usc.edu/academic-calendar/, https://arr.usc.edu/final-exam-schedule/.
- **js/data.js:90-91:** per-venue notes. The Lab: "Dining Dollars not listed". Rosso Oro's: "Dining Dollars NOT accepted".
- There is no research/ folder in M. The old /home/user/trojan-hub/research has only those same venue notes.

**Worked example with today's data**
- Spent so far: $150 − $63.40 = $86.60 over Aug 24 – Nov 9 (77 days), about $1.12 per day.
- Needed to use the rest by Dec 16 (37 days): about $1.71 per day.
- Needed to use the rest by Dec 4, when classes and regular dining-hall hours end (25 days): about $2.54 per day.

====================================================================
7. HOME CLUB ITEMS AND IMAGES
====================================================================

**Image helpers** (p6-clubs.js M:271-292 / F:493-520)
- TH.clubPhotos(c) returns [{src, kind:'logo'|'photo', from}] from TH.CLUB_PHOTOS (js/club-photos.js, generated).
  - Coverage: 967 of about 2,000 clubs have any image. 961 have a logo. Only 61 clubs have photos (120 photos total).
- TH.clubCover(c, {photo, size}) picks a photo, then a logo on a tinted card, then a generated initials/pattern cover (.ccv).
- TH.clubThumb(c, size) picks a logo, then a photo, then initials.
- F only: TH.clubImageStats.
- Already used by the Clubs list and club sheet (clubs.js:83, 96, 335, 349) and by onboarding/profile picks (p6-profile.js:114).

**Home items that show clubs but no image** (hub2c unless noted)
- **"Clubs like <club>" row.** clubPoster (M:230 / F:339) inside becauseClub (M:241 / F:350) draws hue + initials ("VS", "VD").
  - On the demo: 10 cards, 0 images. 5 of those clubs do have a photo or logo (USC Viterbi School of Engineering has 2 photos + logo; Career Center has 2 photos + logo). The other 5 have nothing and would need clubCover's generated art (home-4.png).
- **Event posters.** poster(e) (M:229 / F:338) is used in every Home row (section(), "Because you're part of…", becauseTaste), and billboard() (M:253 / F:362) and spot() follow the same pattern. All show category gradients only.
  - Of 50 event cards on Home, all 50 have a host club; 38 hosts have a photo and 41 have a logo; 0 are shown.
- **Officer newsletter cards:** clubCards (M:264 / F:373), text only.
- **"This week from your clubs" digests:** feed.js issueCard (M=F:339), text only.
- **"Your clubs this week"** (app.js:523-524): text only, and only appears after the student joins a club (the demo student has joined none).
- **Request cards:** requestRow (M:260 / F:369), text "to <club>".
- **"Find your people" promo** (app.js:528): icon only.

Poster CSS: hub2.css:184-191 (148x208 gradient tile).

====================================================================
8. TOMMY
====================================================================

**Commands in TA.Script.cmds** (22 in the M build; full "about" text is in data.json → "cmds")

Defined with def() in ta/script.js (M:54-474 / F:72-561):

| Command | Args |
|---|---|
| plan.day | day, focus |
| plan.week | start |
| plan.outings | range |
| events.rate | id, vote |
| events.recommend | hashtag, count |
| events.find | q, hashtag, cat |
| hours.check | place |
| grades.show | course |
| grades.need | course, target |
| hw.due | range, course |
| hw.done | course, kind |
| exams.list | course |
| breaks.next | which |
| building.find | code, room |
| gates.status | hour |
| zone.check | zone |
| bikes.nearest | none |
| watch.list | none |
| guest.list | none |
| news.list | none |

Defined elsewhere:

| Command | Args | Where |
|---|---|---|
| requests.list | none | ta/act-anything.js:273 |
| course.who | course, term | ta/course-info.js:44 (M only) |
| report.problem | what | F script.js:153 (F only, new) |

On top of these, the translator can use:
- `do {action, request}`: TA's actions plus Hub actions registered with TA.registerHubAction (for example hub_guest_register, hub_wallet_add, hub_watch_add, hub_watch_schedule, hub_news_follow).
- `ask {q}`: a knowledge-base question.

**Pipeline: TS.handle** (ta/script.js M:649-672 / F:736-760)
1. Things that always stay in Trojan Assist's own flow (B.handle, ta/app.js:3432): a pending request, anything flagged as safety or crisis, greetings, chips, undo, sign-in.
2. TS.compile (M:601 / F:688) tries each command's match() and runs the first hit through runCmd as 'script'.
3. Otherwise brain() (M:631 / F:718) runs B.handle and labels the result as `do` or `ask`.
4. The knowledge-base path is B.answer (ta/app.js:6810). It calls B.rewrite, then TA.Search.query in a Web Worker over js/ta/blob-kb.js (9 MB, loaded after first paint through TH.loadTommyKB, bridge.js:41). It returns a curated, askUSC or USC-page answer.
5. If nothing matches, B.notFound (7210) returns kind 'none': "I couldn't find a clear answer… These USC pages might help". Off-topic text returns kind 'off'.

**How missed() works** (M:625 / F:712):

```js
function missed(out) { return !out || !out.length || (out.some(m => m && (m.kind === 'none' || m.kind === 'off')) && !out.some(m => m && m.card)); }
```

**When the AI is called:** only if missed() is true, nothing is pending, AI.enabled() is true, and B.sensitive(n) is false. Then:
- `AI.translate(text, {commands: TS.catalog() + do/ask/none, actions: TS.actionCatalog(), earlier: TS.history (≤6 text→line pairs), now})`.
- A valid answer runs on the device as runCmd(…, 'ai').
- An `ask` identical to the original question is skipped.
- The AI never sees results.
- The UI.renderMsg wrapper (M:692 / F:781) shows the script line or the "AI → script" tag under each answer.

**Outer wrappers around TS.handle**
- hub2a wrapTommy (M:542 / F:604).
- p6-profile wrapTommyProfile: short phrases like "edit my profile", "retake quiz" or "report something" open screens.

**Flagged-question flow**
wrapTommy does three things:
- **Replay:** if a published answer's question exactly equals norm(text), it returns that answer. Never for risky text.
- **Flag:** after handling, if the message has 3+ words, isMiss is true (kind 'none' only, so off-topic is never flagged), nothing is pending, and it isn't risky:
  - it calls flagGap(text, 'Tommy had no answer') (M:535 / F:595);
  - it appends "**I flagged this for the Tommy team.** … Track it under Report a Problem." (M:549 / F:614).
- **Thumbs-down:** a "Not what I asked" button under answers that have a source or script calls flagGap(question, 'Student said: not what I asked', answer).

Storage: TH.H().x.gaps [{id, q, why, given, at, status:'open'|'answered', answer, answeredAt, sample?}]. The seeded gap "Which laundry rooms take Apple Pay?" is now actually answered by the knowledge base.

Where flagged questions show up:
- orginbox list, plus the answerGap sheet. The answer is free text with no source field, and publishing notifies the student via note('tommy').
- The USC dashboard tile and row, and the USC Tools row.
- orgFacts "flagged" answers.
- The student Reports screen, "Questions Tommy is getting fixed" (p6-profile report M:437 / F:552; report-gaps.png).
- Tommy Everywhere's open count (hub2a M:583 / F:662).

Limits:
- Replay is exact text only. I verified that "…right now please" was flagged again as a new gap.
- An answer never becomes a script command or a knowledge-base entry.
- Everything stays on the device.

**AI translator: client side**
- **ai-sample.js** (same in M and F)
  - Uses window.claude.use('sample'), the claude.ai artifact runtime on the viewer's own plan. The page has to be published with capabilities {sample:{}}.
  - Prompt: RULES (lines 31-40) + COMMANDS + ACTIONS + NOW + EARLIER + STUDENT MESSAGE. It expects one JSON line {"cmd","args"}, modelTier 'quick'. It switches itself off on not_granted and similar codes.
  - It replaces Tommy's Settings sheet with two toggles: use the translator, and show the script line.
  - TA's older bring-your-own-key "Claude AI mode" (ta/app.js:7697-7705, TA.AI at 7851+, needs a bundled #ta-sdk) is dead code in this build.
- **ai-api.js** (M only; on M template line 55, absent from the F template)
  - Activates only outside claude.ai and over http(s), or when window.TOMMY_API_URL is set.
  - Probes GET /api/tommy once (8 s timeout), also 1.2 s after load. If it gets {ok:true}, it wraps AI.translate.
  - The wrapped call POSTs {text ≤1000, now ≤80, earlier ≤6 [{text, line}]}. Earlier lines that are private or crisis are filtered out using TA.Script.PERSONAL. A 503 turns it off.
  - Adds AI.firstPass() and tweaks the Settings text.
  - On file:// it stays off. I verified enabled = false and firstPass = false.

**patch_ai_first.py** (M, updated 01:44)
- NOT applied to script.js in M or F. Neither contains AI.firstPass or TS.PERSONAL, and neither does the deploy repo.
- What it does: rewrites TS.handle to compile → AI first (when AI.firstPass) → brain → AI as last resort.
- It adds a TS.PERSONAL regex (health, sexual health, mental health, immigration, identity, SSN) whose matches never go to the AI.
- It is idempotent and anchors on the "// 1) the compiler" block, which still exists in F.
- The current README already claims "Tommy asks Claude first", which only becomes true once this patch is applied.

**Server: netlify/functions/tommy.mjs** (M; changed on disk at 01:52 by someone else while I worked)
- Contract:
  - GET returns {ok: Boolean(ANTHROPIC_API_KEY), model}.
  - POST {text, now, earlier} returns {cmd, args}, or {cmd:null} when nothing fits.
  - Errors: 405 for other methods; 503 when no key is set; 403 for a foreign Origin; 429 above 40 requests per 10 minutes per IP (in memory); 413 above 20 KB; 400 for bad JSON or missing text. API errors map to 429, 503 or 502.
- Request it sends:
  - Model: process.env.TOMMY_MODEL, defaulting to "claude-haiku-5-5". It was "claude-opus-5-5" with the server-side fallback beta until 01:52.
  - Plain client.messages.create, max_tokens 2000, output_config {effort:'low'}, system [{text: SYSTEM, cache_control: ephemeral}], and a user message containing NOW / EARLIER / STUDENT MESSAGE.
  - A refusal returns {cmd:null}.
- parseCommand keeps only commands listed in COMMANDS and only their listed argument names (strings up to 500 chars, numbers, booleans).
- I checked it against the claude-api reference and the installed @anthropic-ai/sdk 1.8.0 (/home/user/tommy-api/node_modules: the error classes and messages.create exist). The usage is valid. Two caveats:
  - stop_reason 'max_tokens' is not handled; it just produces {cmd:null}.
  - The header comment says scripts/build-netlify.mjs, but the file is .cjs.

**Prompt generation: scripts/build-netlify.cjs**
1. Runs build.py. If the build lacks ai-api.js, it injects it right after ai-sample.js.
2. Loads the page in Playwright and waits for data-kb='ready'.
3. Stubs AI.enabled and AI.translate, then calls TA.Script.handle('zxqv blorptastic …') to capture the exact {commands, actions} context. RULES are parsed from ai-sample.js.
4. Writes `<out>` (default `<project>/netlify-site`):
   - site/index.html
   - netlify/functions/tommy.mjs plus a generated tommy-prompt.mjs (SYSTEM = RULES + COMMANDS + ACTIONS; COMMANDS = {cmd: [args]} plus do and ask)
   - netlify.toml, package.json (@anthropic-ai/sdk 1.8.0), package-lock, README (set ANTHROPIC_API_KEY, redeploy, check /api/tommy), .gitignore

**Existing deploy repo is stale.** /home/user/Trojan-Hub-repo is a git repo with a GitHub origin and 2 commits.
- Its site has no AI.firstPass and no course.who.
- Its tommy-prompt.mjs COMMANDS lists 21 read commands plus do/ask, without course.who.
- Copies of the tooling also exist in /home/user/tommy-api.

**Two possible routes for "my free API":**
- (a) Publish as a claude.ai artifact. Then window.claude 'sample' powers both the translator and every AI-writing button. build.py --artifact produces dist/artifact; the copy there predates ai-api.js.
- (b) Deploy to Netlify with ANTHROPIC_API_KEY. This only powers the translator unless more server endpoints are added.

====================================================================
SCREENSHOTS AND DATA
====================================================================
All files are in /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/p7/map/. They are 402x874 light unless the name starts with "desk" or "home-d".

- **Home and menus:** home-m.png, home-1.png … home-9.png, plus.png
- **More, onboarding, profile:** more-1.png … more-4.png, onboard-0.png, onboard-1.png, onboard-skipped.png, profile-1.png, profile-end.png
- **Wallet, reports, Tommy:** wallet-1.png, wallet-2.png, report-gaps.png, tommy-dd.png, tommy-menu.png, tommy-account-sheet.png
- **Club organizer screens:**
  - Dashboard and requests: club-org-1.png, club-org-2.png, club-orgreq-1.png, club-orgreq-2.png
  - Tommy: club-orgtommy-1.png, club-orgtommy-asked-1.png, club-orgtommy-asked-2.png
  - Members: club-orgmem-1.png … club-orgmem-3.png, club-orgmem-after-venmo.png, club-remind-sheet.png
  - Chat and Tools: club-orgchat-1.png, club-orgchat-2.png, club-orgtools-1.png
  - Newsletter, budget, space: club-orgnews-1.png, club-orgnews-2.png, club-orgbudget-1.png, club-orgbudget-2.png, club-orgspace-1.png … club-orgspace-3.png
  - Insights and inbox: club-orginsights-1.png … club-orginsights-3.png, club-orginbox-1.png
  - Event flows: club-schedule-sheet.png, club-after-schedule.png, club-org-after-schedule.png, club-create-event-sheet.png
- **USC office screens:** usc-org.png, usc-orgreq.png, usc-orgtools.png, usc-orgmem.png, usc-orginbox.png, usc-orgtommy.png
- **Desktop:** home-d.png (1440x900), desk-org.png, desk-more.png, desk-after-wheel.png, desk-1280x720.png

Data dumps in the same folder:
- data.json: command list with "about" text, per-screen element dumps for org and More, Home section and club-image coverage, Venmo test.
- tommy.json, tommy2.json, kb-dd.json: Tommy answers with sources, and the desktop measurements.
- anchors.py: prints current M/F line numbers.
- shot1.js … shot5.js: the Playwright scripts.