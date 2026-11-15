# Ask Tommy — live evaluation

Live site https://trojanhub.netlify.app, run 2026-11-15T02:46Z → 2026-11-15T03:11Z (site version with 177 script commands). Raw data: `data/eval/results-20261115-first100.json`. Test set: `data/eval/questions.json`.

**99 messages graded · pass rate 72/99 = 73%** · 9 messages (9%) went to the AI translator (`POST /api/tommy`), 7 of those ended GOOD.

Method: Playwright 402×874, one message every 15 s, a fresh page every 25 messages, `TA.UI.send(text)` then wait for `!TA.UI.busy`. Any pending action prompt (`TA.Brain.pending`) was cleared before each message so every message is graded on its own (see finding R1). No crisis or self-harm messages were sent. Each answer was graded by hand: does it answer exactly what was asked, every constraint included?

## Results by category

| Category | Count | Share |
|---|---|---|
| GOOD | 72 | 73% |
| MISSED_DETAILS | 15 | 15% |
| WRONG_SCRIPT | 6 | 6% |
| NOT_FOUND | 2 | 2% |
| OFF_TOPIC_REFUSAL | 0 | 0% |
| BAD_ACTION | 3 | 3% |
| OTHER | 1 | 1% |

## Pass rate by kind

| Kind | Pass | Rate |
|---|---|---|
| A · questions | 47/70 | 67% |
| B · actions | 20/23 | 87% |
| Greetings / off-topic | 5/6 | 83% |

## Pass rate by topic

| Topic | Pass | Rate |
|---|---|---|
| study | 0/4 | 0% |
| life | 0/3 | 0% |
| clubs | 1/3 | 33% |
| multi | 1/3 | 33% |
| email | 1/3 | 33% |
| libraries | 2/4 | 50% |
| access | 2/4 | 50% |
| safety | 2/4 | 50% |
| health | 2/3 | 67% |
| events | 2/3 | 67% |
| careers | 2/3 | 67% |
| guest | 2/3 | 67% |
| greet | 2/3 | 67% |
| dining | 3/4 | 75% |
| transport | 3/4 | 75% |
| courses | 3/4 | 75% |
| gyms | 4/4 | 100% |
| registration | 4/4 | 100% |
| deadlines | 4/4 | 100% |
| finaid | 3/3 | 100% |
| housing | 3/3 | 100% |
| places | 3/3 | 100% |
| typos | 3/3 | 100% |
| book_room | 3/3 | 100% |
| grades | 3/3 | 100% |
| order | 3/3 | 100% |
| academics | 3/3 | 100% |
| payments | 3/3 | 100% |
| offtopic | 3/3 | 100% |
| services | 2/2 | 100% |

## Top 27 failures

Ordered by severity (wrong script first), then questions before actions.

1. **WRONG_SCRIPT** · A087 [access] **“is the gate by the village open at night”**  
   Script: `hours.check place="is the gate by the village open at night"` (script)  
   Tommy: _I couldn’t match **is the gate by the village open at night** to a place with posted hours. The app has hours for libraries, dining halls and cafés, gyms and student offices._  
   Why: hours.check got a gate question; "couldn't match … to a place with posted hours" — should be gates.status for the Village-side (McClintock) entrance at night

2. **WRONG_SCRIPT** · A100 [transport] **“how do i get to downtown la from usc”**  
   Script: `ask q="how do i get to downtown la from usc"` (script)  
   Tommy: _From **Downtown F/S Permits - USC Transportation**: - Submit search-form-6af15d37dfb54 - Downtown F/S Permits - October 8, 2025 - Submit search-form-6af15d37e6b5d_  
   Why: KB hit on "Downtown F/S Permits" page (parking permits) with scraped search-form junk; no Metro E Line directions

3. **WRONG_SCRIPT** · A220 [clubs] **“clubs for people who like hiking”**  
   Script: `club.find topic="people who like hiking"` (script)  
   Tommy: _EngageSC groups for **people who like hiking** (3): - **Reproductive Healthcare for People of Color** · Pre-Professional, Academic · joining closed - **Girls Who Lead** · Pre-Professional, Academic - **Trojans Who Read**…_  
   Why: club.find topic="people who like hiking" returned Reproductive Healthcare for People of Color, Girls Who Lead, Trojans Who Read (matched "people/who"); real hiking clubs exist (e.g. Hike for Habitats)

4. **WRONG_SCRIPT** · A292 [life] **“whats the conquest week”**  
   Script: `ask q="What is Conquest Week at USC?"` (ai) · AI call  
   Tommy: _From **Hands-only CPR: Trojan “Heart Heroes” – ONE USC Safety** — _Conquest Week_: **Conquest Week** - 11/16: Activities To Be Confirmed_  
   Why: AI→ask; KB hit is a CPR "Heart Heroes" page snippet "11/16: Activities To Be Confirmed"; doesn't explain Conquest/rivalry week

5. **WRONG_SCRIPT** · A318 [multi] **“vegetarian food open now near leavey”**  
   Script: `hours.check place="vegetarian food open now near leavey"` (script)  
   Tommy: _🟢 **Leavey Library**: Open 24 hours **This week:** - Sun: 9 AM – 12 AM - Mon: Open 24 hours - Tue: Open 24 hours - Wed: Open 24 hours - Thu: Open 24 hours - Fri: Open 24 hours - Sat: 9 AM – 9 PM _Day-by-day hours copied …_  
   Why: hours.check matched "leavey" and returned Leavey Library hours; asked for vegetarian food open now near Leavey

6. **WRONG_SCRIPT** · other459 [greet] **“yo tommy whats up”**  
   Script: `landmark.facts place=tommy` (script)  
   Tommy: _**Tommy Trojan** Unveiled in 1930 at USC's 50th jubilee, sculpted by Roger Noble Burnham. The pedestal reads "Faithful, Scholarly, Skillful, Courageous, Ambitious." - Unveiled in 1930 at USC's 50th jubilee - Sculpted by …_  
   Why: "yo tommy whats up" → landmark.facts for the Tommy Trojan statue instead of a greeting

7. **BAD_ACTION** · B368 [guest] **“guest my friend in tonight”**  
   Script: — (no script tag)  
   Tommy: _I can only act on **your own** account, so I can’t do that for someone else. They’ll need to sign in and do it themselves._  
   Why: Refuses: "I can only act on your own account" — guesting a friend IS the student's own action (guest.list exists, no guest.add)

8. **BAD_ACTION** · B391 [email] **“write an email to my advisor asking for a meeting”**  
   Script: `my.advisor` (script)  
   Tommy: _- Advisor: **Taylor Morgan** · Viterbi Academic Services - No advising appointments booked_  
   Why: my.advisor shows advisor info; no email draft was offered

9. **BAD_ACTION** · B392 [email] **“email my ta about the homework”**  
   Script: `hw.due range=week` (script)  
   Tommy: _**6 things due in the next 7 days**: - **PHYS 151** Lab report 10 · Tomorrow, 8 AM - **MATH 226** Discussion quiz 6 · Thu, Nov 12, 10 AM - **MATH 226** WebAssign HW 12: §16.1–16.2 Vector fields & line integrals · Thu, No…_  
   Why: "email my ta about the homework" ran hw.due (homework list); no email draft

10. **NOT_FOUND** · A206 [health] **“is engemann open on weekends”**  
   Script: `hours.check place=engemann` (script)  
   Tommy: _I couldn’t match **engemann** to a place with posted hours. The app has hours for libraries, dining halls and cafés, gyms and student offices._  
   Why: hours.check can't match "engemann" ("couldn't match engemann to a place with posted hours") though place.where knows Engemann; no weekend hours

11. **NOT_FOUND** · A240 [events] **“any career fairs coming up”**  
   Script: `events.search q="career fair" days=30` (script)  
   Tommy: _No public events match **career fair** in the next 30 days._  
   Why: "No public events match career fair in the next 30 days" — honest, but no pointer to Career Center/Handshake career fairs

12. **MISSED_DETAILS** · A004 [libraries] **“what libraries are open 24 hours”**  
   Script: `hours.check place="what libraries are open 24 hours"` (script)  
   Tommy: _Here are the libraries with posted hours, open or closed right now: - 🟢 **Leavey Library**: Open 24 hours - 🟢 **Doheny Memorial Library**: Open · Until 8 PM - 🟢 **Science & Engineering Library**: Open · Until 8 PM - 🔴 **…_  
   Why: Lists all libraries open now instead of answering which are open 24 hours (Leavey) and on which days

13. **MISSED_DETAILS** · A005 [libraries] **“which library is open latest on saturday”**  
   Script: `place.hours place=library day=saturday` (script)  
   Tommy: _**Leavey Library** · Saturday (Sat, Nov 14): **9 AM – 9 PM** **Doheny Memorial Library** · Saturday (Sat, Nov 14): **closed** **Science & Engineering Library** · Saturday (Sat, Nov 14): **closed** _Posted USC hours; holi…_  
   Why: Compares only 3 libraries (Leavey, Doheny, SEL) and doesn't state the answer; others not checked

14. **MISSED_DETAILS** · A026 [study] **“quiet place to study open late near the village”**  
   Script: `place.find kind=study attrs=quiet open=late` (script)  
   Tommy: _**Study spots matching quiet, late:** - **Doheny Memorial Library** · ~3 min walk · listed as a quiet space · open now (until 8 pm) - **Leavey Library** · ~5 min walk · open 24 hours today · open now _No single place in …_  
   Why: Ignored "near the village": distances are from the demo location (TCC), not the Village; also says no place is both quiet and late although Leavey is 24h with quiet floors

15. **MISSED_DETAILS** · A027 [study] **“best place to study for finals”**  
   Script: `ask q="best place to study for finals"` (script)  
   Tommy: _From **Where are the best places to study in the library? - LibAnswers**: - Each library has a variety of spaces for individual and group study and the best place to study is going to depend on your personal preference. …_  
   Why: Generic LibAnswers text ("depends on your preference") instead of naming spots with hours

16. **MISSED_DETAILS** · A028 [study] **“where can i study at 2am”**  
   Script: `ask q="where can i study at 2am"` (script)  
   Tommy: _From **9 p.m. to 7 a.m.**, only **USC students, faculty, staff, alumni and sponsored guests** may be in any USC library that's open, Leavey included. - **ID check:** during those hours everyone is asked for a **physical …_  
   Why: Answers the ID-check policy but never says "Leavey is open 24 hours" — the actual answer

17. **MISSED_DETAILS** · A029 [study] **“study spot with natural light and outlets”**  
   Script: `place.find kind="study spot" attrs="natural light, outlets"` (ai) · AI call  
   Tommy: _**Study spots matching greenery, outlets:** - **Doheny Memorial Library** · ~3 min walk · next to **Alumni Park** (park / green, ~55 m on the map) · laptop outlets listed · open now (until 8 pm) - **East Asian Library** …_  
   Why: AI mapped "natural light" to "greenery"; header says "matching greenery, outlets"

18. **MISSED_DETAILS** · A043 [dining] **“what's for lunch at village dining”**  
   Script: `ask q="what's for lunch at village dining"` (script)  
   Tommy: _**USC Village Dining Hall** · Dining - **Now:** Open · Until 10 PM - **Hours today:** 7 AM – 10 PM - **Address:** 3096 S. McClintock Avenue, Los Angeles, CA 90089 - **Walk:** about 10 min from You (Tutor Campus Center) -…_  
   Why: Venue card with hours; no menu or menu link (asked what's for lunch)

19. **MISSED_DETAILS** · A088 [access] **“how do i get my friend onto campus at night”**  
   Script: `ask q="how do i get my friend onto campus at night"` (script)  
   Tommy: _**Open 24/7 (staffed):** **McCarthy Way Entrance** (Figueroa St at McCarthy Way) and **McClintock Ave. Entrance** (Jefferson Blvd at McClintock). **Weekdays 6 AM–8 PM, closed weekends/holidays:** Watt Way (off Exposition…_  
   Why: Lists gate hours only; no guest registration / Trojan Check guest process

20. **MISSED_DETAILS** · A118 [safety] **“where are the blue light phones”**  
   Script: `safety.bluelight` (script)  
   Tommy: _**Blue light phones** - About nearly 300, Around UPC and HSC, in many buildings, and on each level of every parking structure. - Connects directly to DPS 24-hour communications center and identifies the phone location ev…_  
   Why: Garbled copy ("About nearly 300, Around UPC…"); no locations/nearest shown in text (chip only)

21. **MISSED_DETAILS** · A131 [courses] **“is there a section of math 226 on tuesday thursday”**  
   Script: `course.sections course="MATH 226"` (script)  
   Tommy: _**MATH 226 · Calculus III** (Fall 2026) · 18 sections: - Lecture 39553 · Mon/Wed/Fri 9:00 AM–9:50 AM · Christian Geske · 1/52 open · D-clearance - Discussion 39554 · Tue 10:00 AM–10:50 AM · instructor TBA · 1/26 open · D…_  
   Why: Dumps all 18 sections; never answers that MATH 226 lectures are MWF only (TTh = discussions)

22. **MISSED_DETAILS** · A218 [clubs] **“what clubs are there for cs”**  
   Script: `ask q="what clubs are there for cs"` (script)  
   Tommy: _From **CS Student Organizations - USC Viterbi | Thomas Lord Department of Computer Science**: - The Makers of Entertaining Games Association is a student-run organization which strives to promote and facilitate the art o…_  
   Why: Shows one club (MEGA) scraped from a Viterbi web page instead of listing CS clubs from TH.CLUBS

23. **MISSED_DETAILS** · A255 [careers] **“internship search usc”**  
   Script: `ask q="internship search usc"` (script)  
   Tommy: _From **Internship/Fellowship Programs at USC – Career Center** — _Search by School_: - Internships - Global Fellows Internship Program - Internships - Gateway Internship Program_  
   Why: Scraped nav list ("Internships, Global Fellows…, Internships") — no Handshake / how to search

24. **MISSED_DETAILS** · A291 [life] **“what does fight on mean”**  
   Script: `ask q="what does fight on mean"` (script)  
   Tommy: _- **Fight song:** "Fight On" ("Fight On for ol' SC..."). - **Alma mater:** "All Hail," written by Alfred F. Wesson ('24) in the early 1920s. It replaced the earlier "University Hymn." - **Motto:** *Palmam Qui Meruit Fera…_  
   Why: Dumps a traditions list (fight song, alma mater, motto) instead of explaining the phrase "Fight On"

25. **MISSED_DETAILS** · A293 [life] **“how do i get football tickets as a student”**  
   Script: `ask q="how do i get football tickets as a student"` (script)  
   Tommy: _Your **USCard** is your university ID for access to campus facilities and **athletic and cultural events**. Details on student season tickets (prices and how to buy) are on USC Athletics' ticketing site, which isn't cove…_  
   Why: Says ticket details are "not covered here" then pivots to ticket scams; no how-to for student season tickets

26. **MISSED_DETAILS** · A317 [multi] **“i need coffee and a quiet place to study near viterbi open past 10”**  
   Script: `place.find kind=study attrs="quiet,coffee"` (script)  
   Tommy: _**Study spots matching quiet, coffee:** - **Doheny Memorial Library** · ~3 min walk · listed as a quiet space · café inside or listed · open now (until 8 pm) - **Law School Cafe** · ~4 min walk · café inside or listed · …_  
   Why: Ignored "open past 10" (Doheny closes 8 PM, Law School Cafe closed) and "near Viterbi"

27. **OTHER** · A120 [safety] **“how do i get a safety escort”**  
   Script: `safety.escort` (script)  
   Tommy: _🚨 **In danger now: call 911 or DPS (213) 740-4321.** - Free USC Lyft Shared rides 7 PM-2 AM daily inside the UPC geofence (HSC 5 PM-2 AM Mon-Fri). See transport.json lyft. - From 2 AM to 6 AM DPS may be able to provide a…_  
   Why: Good content but leaks an internal note "See transport.json lyft." into the answer; also opens with an "In danger now" banner for a routine question

