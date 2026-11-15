# Trojan Hub v4 — Part 6 build contract (binding; read fully)

Project: `/home/user/trojan-hub-v4` — the user's friend's version of Trojan Hub (a USC student app modeled on the Disneyland app), split into sources:
- `template.html` = the page; every inline `<script>`/`<style>` body is `@@FILE:<path>@@`.
- `python3 scripts/build.py` → `dist/trojan-hub.html` (single self-contained file). `original-v4.html` = the friend's untouched file (baseline).
- Load order = order in template.html. Later files often **wrap or override** earlier `TH.screens.*` / `TH.open*` (e.g. `TH.openClub` is defined in clubs.js, re-wrapped in feed.js and hub2a.js; `TH.openOrder` in screens.js then hub2c.js). Respect that chain: when you change behavior, change it at the layer that actually runs last, or wrap the final version in your Part 6 file.
- Baseline: 40 screens render with 0 errors (`node /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/v4smoke.js /home/user/trojan-hub-v4/dist/trojan-hub.html`). Keep it that way.

Demo: the date is pinned to Mon Nov 9, 2026 (campus time). Student = Jordan Rivera (TA.State.d), CS major, Viterbi sophomore. All account state lives in Trojan Assist's store (`TH.H()`, i.e. `TA.State.d.hub`; the friend's extras are under `TH.H().x`), so Tommy's Undo and "Reset demo account" cover it. UI-only state in `TH.state`.

## The user's Part 6 requests (verbatim intent)
1. **Order food**: make the wait time for order-ahead much clearer and fun.
2. **Clubs list**: looks good while scrolling; too much text now. Keep all 2,000 clubs but make each item precise and fun to scroll.
3. **Club detail**: add photos.
4. **Tommy plans my day / my week**: uses what you already have (classes, homework/exams, reservations, orders, passes…), your clubs, and things relevant to you (interests, career goals, major); "plan my week" for events, can include field trips/outings. Very good and fun to use.
5. **Club filters personal**: tapping "Career" filters to clubs matching YOUR career goals/interests; same for a "Major" filter matching your major/intended minor.
6. **Onboarding + profile**: when you create an account it first asks interests, career interests, club types you like, snacks, food, allergies, career goals, intended minor (major prefilled), etc. Editable later in Profile; Profile easier to reach. More info → more tailored suggestions; thumbs up/down further tune recommendations.
7. **Organizer side (club app)**: add/remove participants (members) and mark each paid/unpaid.
8. **Report on the HOME page**: submit photo + description + location. Report kinds: Emergency, Non-emergency, then type (e.g. recommendations for dining halls, any feedback…).
9. **SOS**: after pressing SOS, let the student explain what's happening, add a photo, etc.

Keep it **easy and fun**, Disney-app feel (big friendly cards, one primary action per sheet, playful but clear copy, small delightful animations that respect prefers-reduced-motion). Light + dark themes. 402×874 phone frame. Don't add clutter elsewhere.

## Truthfulness rules (unchanged from the project)
- Never invent real-world facts. Real data: EngageSC clubs/events (TH.CLUBS, TH.CLUB_EVENTS), places/hours (TH.PLACES), DPS data, classes (TA).
- Anything simulated (orders, prep times/queues, SOS dispatch, reports routed to offices, member rosters/dues, Tommy's plan actions) must be labeled "Simulated"/"Est." in the UI as the codebase already does. **SOS never claims DPS was really contacted**; always show the real numbers (DPS 213-740-4321, 911) prominently.
- Club photos: only real images obtained from EngageSC (engage.usc.edu pages / static-prod-us-east-1.campusgroups.com, now allowlisted). No stock photos presented as a club's. Where a club has no real image, use a tasteful generated cover (category color + initials/pattern) that is obviously a graphic, not a photo.
- Personal data (profile, photos attached to reports/SOS) stays on the device (localStorage via TA store); say so.

## Shared data contract
**Preferences** (owner: profile agent; others read only via these functions):
- `TH.prefs()` → `{ interests:[], careerInterests:[], careerGoals:[], clubTypes:[], foods:[], snacks:[], drinks:[], diet:[], allergies:[], major:string, minor:string, year:string, onboarded:boolean }` — backed by the friend's `TH.H().x.profile` (keep existing keys `snacks, drinks, diet, hobbies (= interests), goals (= careerGoals), share*`; add the new ones lazily, never wipe existing data). `major` defaults from `TA.State.d.profile.major`.
- `TH.prefsChanged()` → bumps a counter; consumers recompute lazily. `TH.prefTokens()` → lowercase keyword set (interests + career + clubTypes + major/minor + synonyms) for matching.
- `TH.feedback(id)` / existing thumbs store in `TH.H().x.fb` — keep using the friend's functions; expose `TH.likeScore(item)` (−1..+1 from thumbs on similar tags/orgs) for ranking.
- `TH.openOnboarding()` opens the onboarding flow; it runs automatically the first time the student signs in / first opens the app when `!prefs.onboarded` (skippable, resumable).

**Club helpers** (owner: clubs agent): `TH.clubMatch(club)` → `{score, career:boolean, major:boolean, why:[strings]}` using `TH.prefTokens()` + thumbs; `TH.CLUB_PHOTOS` (js/club-photos.js) → `{ [clubId]: [dataURI, ...] }` (compressed WebP/JPEG ≤ ~25 KB each; total file ≤ 4 MB); `TH.clubCover(club)` → HTML for the cover (photo or generated graphic).

**Planner** (owner: planner agent): `TH.plan.day(dateKey, opts)` / `TH.plan.week(startKey, opts)` → plan objects `{blocks:[{start,end,kind,title,place?,eventId?,why,fixed:boolean}], picks:[...], swaps:{}}` built from TH.dayItems, academics (TH.acad), joined clubs' events, recommended events (TH.clubMatch / prefs / thumbs), meals (dining hall hours + diet/allergy notes), travel time (TH.route), and free time. Screen `plan` (TH.screens.plan) + Tommy commands ("plan my day", "plan my week", "plan tomorrow", "find me a field trip/outing this week") that open/produce the plan; "Add all to My Day" goes through TH.act.saveEvent etc. (confirm + Undo). Field trips/outings = real EngageSC events that are off-campus/outings/tours/hikes/trips (location or title/desc), labeled as such; if none exist in a week, say so honestly.

**Reports & SOS** (owner: profile agent): Home gets a "Report something" card → sheet: kind (Emergency → routes to SOS/911/DPS immediately; Non-emergency; Feedback/Suggestion) → type (e.g. Dining hall recommendation, Facilities/maintenance, Safety concern, Accessibility, Transportation, Housing, Other) → description, photo (file input → downscaled data URI ≤ 300 KB), location (current position TH.ME / pick a place / building search) → review → submit (simulated routing to the right office with confirmation number). SOS: after the alert, a details sheet (what's happening — quick chips like "Someone following me", "Medical", "Fire", "Assault", "Other" + free text, optional photo, "I'm safe now" / cancel) appended to the alert record; real phone numbers always visible.

**Order wait time** (owner: order agent): clear, fun pickup ETA in the order sheet and the active-order card: "Ready in ~X min" big number, a stage tracker (Placed → Being made → Ready) with a playful animation, kitchen busyness meter (Est.), "Leave now" timing based on walk time from TH.ME (TH.route), notify-when-ready.

**Organizer members & dues** (owner: order+org agent): in `orgmem` (hub2b.js): add member (name/email), remove member (confirm + undo), toggle paid/unpaid per member, totals update, filters (All / Paid / Unpaid), all simulated & persisted in TH.H().x.

## File ownership (edit ONLY your files; read anything)
| Agent | Owns |
|---|---|
| **clubs** | js/clubs.js, js/feed.js (only its openClub/club parts), js/club-photos.js, js/p6-clubs.js, css/p6-clubs.css, scripts/fetch_club_photos.py |
| **profile** | js/hub2a.js, js/hub2c.js, js/app.js, js/core.js, js/p6-profile.js, css/p6-profile.css |
| **planner** | js/planner.js, css/p6-plan.css, js/ta/script.js, js/ta/act-anything.js, js/ta/hub-actions.js, js/ta/hub-tools.js, js/ta/ai-sample.js |
| **order** | js/screens.js, js/hub2b.js, js/p6-order.js, css/p6-order.css |
If you need a change in someone else's file, wrap/override from your own p6 file (loaded after hub2c.js) or report it under needs_from_others. Do not edit template.html, data files (data.js, clubs-data.js, geo-data.js, safety-data.js) or js/ta/app.js / blobs.

## Testing
- Build your own test copy (agents run in parallel): `python3 scripts/build.py /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/p6/<agent>/th.html`, then Playwright on that file (402×874, light + dark). Smoke script above must stay at 0 errors. `node --check` every JS file you touch.
- Never regress Tommy's crisis/emergency handling (local brain first; DPS 213-740-4321 / 911 / 213-740-9355 / 988).
- Scratch: /tmp/claude-0/-home-user/be3b6c8f-ab79-560b-ad3e-b16af1176ed0/scratchpad/p6/<agent>/
