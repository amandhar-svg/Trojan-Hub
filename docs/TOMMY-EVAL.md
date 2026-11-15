# Ask Tommy — live evaluation

Live site https://trojanhub.netlify.app, run 2026-11-15T02:46Z → 2026-11-15T03:31Z (site version with 178 script commands). Raw data: `data/eval/results-20261115-checkpoint180.json`. Test set: `data/eval/questions.json`.

**180 messages graded · pass rate 132/180 = 73%** · 19 messages (11%) went to the AI translator (`POST /api/tommy`), 11 of those ended GOOD.

Method: Playwright 402×874, one message every 15 s, a fresh page every 25 messages, `TA.UI.send(text)` then wait for `!TA.UI.busy`. Any pending action prompt (`TA.Brain.pending`) was cleared before each message so every message is graded on its own (see finding R1). No crisis or self-harm messages were sent. Each answer was graded by hand: does it answer exactly what was asked, every constraint included?

## Results by category

| Category | Count | Share |
|---|---|---|
| GOOD | 132 | 73% |
| MISSED_DETAILS | 26 | 14% |
| WRONG_SCRIPT | 12 | 7% |
| NOT_FOUND | 2 | 1% |
| OFF_TOPIC_REFUSAL | 1 | 1% |
| BAD_ACTION | 4 | 2% |
| OTHER | 3 | 2% |

## Pass rate by kind

| Kind | Pass | Rate |
|---|---|---|
| A · questions | 86/124 | 69% |
| B · actions | 38/45 | 84% |
| Greetings / off-topic | 8/11 | 73% |

## Pass rate by topic

| Topic | Pass | Rate |
|---|---|---|
| multi | 1/6 | 17% |
| access | 2/6 | 33% |
| email | 2/6 | 33% |
| study | 3/7 | 43% |
| clubs | 3/6 | 50% |
| life | 3/6 | 50% |
| libraries | 5/8 | 62% |
| safety | 4/6 | 67% |
| housing | 4/6 | 67% |
| events | 4/6 | 67% |
| offtopic | 4/6 | 67% |
| dining | 5/7 | 71% |
| guest | 4/5 | 80% |
| greet | 4/5 | 80% |
| gyms | 5/6 | 83% |
| transport | 5/6 | 83% |
| courses | 5/6 | 83% |
| deadlines | 5/6 | 83% |
| finaid | 5/6 | 83% |
| health | 5/6 | 83% |
| careers | 5/6 | 83% |
| typos | 5/6 | 83% |
| grades | 5/6 | 83% |
| order | 5/6 | 83% |
| registration | 6/6 | 100% |
| places | 6/6 | 100% |
| book_room | 6/6 | 100% |
| academics | 6/6 | 100% |
| payments | 5/5 | 100% |
| services | 5/5 | 100% |

## Top 48 failures

Ordered by severity (wrong script first), then questions before actions.

1. **WRONG_SCRIPT** · A008 [libraries] **“hoose library of philosophy hours”**  
   Script: `hours.check place="hoose library of philosophy hours"` (script)  
   Tommy: _Here are the libraries with posted hours, open or closed right now: - 🟢 **Leavey Library**: Open 24 hours - 🟡 **Doheny Memorial Library**: Closing soon · Closes 8 PM - 🟡 **Science & Engineering Library**: Closing soon · …_  
   Why: hours.check lists 7 libraries without Hoose; Hoose hours (Mon–Fri 9–5) exist in data/research/facts/places.json

2. **WRONG_SCRIPT** · A046 [dining] **“where can i get halal food”**  
   Script: `place.search what="halal food"` (script)  
   Tommy: _None of the campus places I carry mention **halal food**._  
   Why: place.search "halal food" → "None of the campus places I carry mention halal food" although the KB has a curated "Halal-friendly food on campus" answer (all 3 dining halls label halal-friendly dishes)

3. **WRONG_SCRIPT** · A087 [access] **“is the gate by the village open at night”**  
   Script: `hours.check place="is the gate by the village open at night"` (script)  
   Tommy: _I couldn’t match **is the gate by the village open at night** to a place with posted hours. The app has hours for libraries, dining halls and cafés, gyms and student offices._  
   Why: hours.check got a gate question; "couldn't match … to a place with posted hours" — should be gates.status for the Village-side (McClintock) entrance at night

4. **WRONG_SCRIPT** · A090 [access] **“can visitors walk around campus”**  
   Script: `ask q="can visitors walk around campus"` (script)  
   Tommy: _From **Campus Safety - USC** — _Safety Resources Around Campus_: - More info about Residential Safety - During campus events, home football games, or special periods such as finals week, the program hours may vary. - Liv…_  
   Why: KB snippet about LiveSafe/residential safety; campus.access (which answers this) not used

5. **WRONG_SCRIPT** · A091 [access] **“is campus open on weekends”**  
   Script: `gates.status` (script)  
   Tommy: _Right now, **10 of 10** campus entrances are open. - **Open:** McCarthy Way Entrance, McClintock Ave. Entrance, Watt Way Entrance, Pardee Way Entrance, Royal Street Entrance, Downey Way Entrance, Jefferson Blvd. Entrance…_  
   Why: gates.status for right now (Monday) instead of the weekend access policy (most gates closed weekends; McCarthy/McClintock 24/7)

6. **WRONG_SCRIPT** · A100 [transport] **“how do i get to downtown la from usc”**  
   Script: `ask q="how do i get to downtown la from usc"` (script)  
   Tommy: _From **Downtown F/S Permits - USC Transportation**: - Submit search-form-6af15d37dfb54 - Downtown F/S Permits - October 8, 2025 - Submit search-form-6af15d37e6b5d_  
   Why: KB hit on "Downtown F/S Permits" page (parking permits) with scraped search-form junk; no Metro E Line directions

7. **WRONG_SCRIPT** · A172 [deadlines] **“whats the next deadline”**  
   Script: `ask q="whats the next deadline"` (script)  
   Tommy: _**Spring 2027 tuition and fees are due Friday, January 8, 2027, by 5 p.m. Pacific time** (the settlement deadline). Fall 2026's was August 21, 2026. By then you must be registered and have your charges **paid or deferred…_  
   Why: "next deadline" → Spring tuition due Jan 8; the withdrawal deadline Fri Nov 13 (and the student's own HW) come first; cal.deadlines / my.deadlines exist

8. **WRONG_SCRIPT** · A220 [clubs] **“clubs for people who like hiking”**  
   Script: `club.find topic="people who like hiking"` (script)  
   Tommy: _EngageSC groups for **people who like hiking** (3): - **Reproductive Healthcare for People of Color** · Pre-Professional, Academic · joining closed - **Girls Who Lead** · Pre-Professional, Academic - **Trojans Who Read**…_  
   Why: club.find topic="people who like hiking" returned Reproductive Healthcare for People of Color, Girls Who Lead, Trojans Who Read (matched "people/who"); real hiking clubs exist (e.g. Hike for Habitats)

9. **WRONG_SCRIPT** · A292 [life] **“whats the conquest week”**  
   Script: `ask q="What is Conquest Week at USC?"` (ai) · AI call  
   Tommy: _From **Hands-only CPR: Trojan “Heart Heroes” – ONE USC Safety** — _Conquest Week_: **Conquest Week** - 11/16: Activities To Be Confirmed_  
   Why: AI→ask; KB hit is a CPR "Heart Heroes" page snippet "11/16: Activities To Be Confirmed"; doesn't explain Conquest/rivalry week

10. **WRONG_SCRIPT** · A318 [multi] **“vegetarian food open now near leavey”**  
   Script: `hours.check place="vegetarian food open now near leavey"` (script)  
   Tommy: _🟢 **Leavey Library**: Open 24 hours **This week:** - Sun: 9 AM – 12 AM - Mon: Open 24 hours - Tue: Open 24 hours - Wed: Open 24 hours - Thu: Open 24 hours - Fri: Open 24 hours - Sat: 9 AM – 9 PM _Day-by-day hours copied …_  
   Why: hours.check matched "leavey" and returned Leavey Library hours; asked for vegetarian food open now near Leavey

11. **WRONG_SCRIPT** · B393 [email] **“ask my professor for an extension on the essay”**  
   Script: `course.who course="ask an extension on essay"` (script)  
   Tommy: _**ISE 536 · Linear Programming and Extensions** (Fall 2026) is taught by **Niloufar Izadinia**. - Lecture 31536 · Tue/Thu 4:00 PM–5:50 PM · **Niloufar Izadinia** · 10 of 30 seats open **Also matches:** - ENGL 300 · The A…_  
   Why: course.who course="ask an extension on essay" → "ISE 536 Linear Programming and Extensions is taught by…" instead of an extension email draft

12. **WRONG_SCRIPT** · other459 [greet] **“yo tommy whats up”**  
   Script: `landmark.facts place=tommy` (script)  
   Tommy: _**Tommy Trojan** Unveiled in 1930 at USC's 50th jubilee, sculpted by Roger Noble Burnham. The pedestal reads "Faithful, Scholarly, Skillful, Courageous, Ambitious." - Unveiled in 1930 at USC's 50th jubilee - Sculpted by …_  
   Why: "yo tommy whats up" → landmark.facts for the Tommy Trojan statue instead of a greeting

13. **OFF_TOPIC_REFUSAL** · other468 [offtopic] **“is ucla better than usc”**  
   Script: — (no script tag) · AI call  
   Tommy: _I can only help with questions about USC, and I answer using information from USC’s official websites. Try asking me something about classes, deadlines, financial aid, housing, dining, health services or campus life._  
   Why: "is ucla better than usc" refused as not about USC — it is about USC; a playful rivalry answer expected

14. **BAD_ACTION** · B368 [guest] **“guest my friend in tonight”**  
   Script: — (no script tag)  
   Tommy: _I can only act on **your own** account, so I can’t do that for someone else. They’ll need to sign in and do it themselves._  
   Why: Refuses: "I can only act on your own account" — guesting a friend IS the student's own action (guest.list exists, no guest.add)

15. **BAD_ACTION** · B391 [email] **“write an email to my advisor asking for a meeting”**  
   Script: `my.advisor` (script)  
   Tommy: _- Advisor: **Taylor Morgan** · Viterbi Academic Services - No advising appointments booked_  
   Why: my.advisor shows advisor info; no email draft was offered

16. **BAD_ACTION** · B392 [email] **“email my ta about the homework”**  
   Script: `hw.due range=week` (script)  
   Tommy: _**6 things due in the next 7 days**: - **PHYS 151** Lab report 10 · Tomorrow, 8 AM - **MATH 226** Discussion quiz 6 · Thu, Nov 12, 10 AM - **MATH 226** WebAssign HW 12: §16.1–16.2 Vector fields & line integrals · Thu, No…_  
   Why: "email my ta about the homework" ran hw.due (homework list); no email draft

17. **BAD_ACTION** · B394 [email] **“request an extension on my csci 104 homework”**  
   Script: `hw.due range=week course="CSCI 104"` (script)  
   Tommy: _**1 thing due in the next 7 days** for CSCI 104: - **CSCI 104** Lab check-off 11 · Mon, Nov 16, 12 PM _Homework is sample data on the demo account.__  
   Why: hw.due for CSCI 104 instead of drafting an extension request to the instructor

18. **NOT_FOUND** · A206 [health] **“is engemann open on weekends”**  
   Script: `hours.check place=engemann` (script)  
   Tommy: _I couldn’t match **engemann** to a place with posted hours. The app has hours for libraries, dining halls and cafés, gyms and student offices._  
   Why: hours.check can't match "engemann" ("couldn't match engemann to a place with posted hours") though place.where knows Engemann; no weekend hours

19. **NOT_FOUND** · A240 [events] **“any career fairs coming up”**  
   Script: `events.search q="career fair" days=30` (script)  
   Tommy: _No public events match **career fair** in the next 30 days._  
   Why: "No public events match career fair in the next 30 days" — honest, but no pointer to Career Center/Handshake career fairs

20. **MISSED_DETAILS** · A004 [libraries] **“what libraries are open 24 hours”**  
   Script: `hours.check place="what libraries are open 24 hours"` (script)  
   Tommy: _Here are the libraries with posted hours, open or closed right now: - 🟢 **Leavey Library**: Open 24 hours - 🟢 **Doheny Memorial Library**: Open · Until 8 PM - 🟢 **Science & Engineering Library**: Open · Until 8 PM - 🔴 **…_  
   Why: Lists all libraries open now instead of answering which are open 24 hours (Leavey) and on which days

21. **MISSED_DETAILS** · A005 [libraries] **“which library is open latest on saturday”**  
   Script: `place.hours place=library day=saturday` (script)  
   Tommy: _**Leavey Library** · Saturday (Sat, Nov 14): **9 AM – 9 PM** **Doheny Memorial Library** · Saturday (Sat, Nov 14): **closed** **Science & Engineering Library** · Saturday (Sat, Nov 14): **closed** _Posted USC hours; holi…_  
   Why: Compares only 3 libraries (Leavey, Doheny, SEL) and doesn't state the answer; others not checked

22. **MISSED_DETAILS** · A026 [study] **“quiet place to study open late near the village”**  
   Script: `place.find kind=study attrs=quiet open=late` (script)  
   Tommy: _**Study spots matching quiet, late:** - **Doheny Memorial Library** · ~3 min walk · listed as a quiet space · open now (until 8 pm) - **Leavey Library** · ~5 min walk · open 24 hours today · open now _No single place in …_  
   Why: Ignored "near the village": distances are from the demo location (TCC), not the Village; also says no place is both quiet and late although Leavey is 24h with quiet floors

23. **MISSED_DETAILS** · A027 [study] **“best place to study for finals”**  
   Script: `ask q="best place to study for finals"` (script)  
   Tommy: _From **Where are the best places to study in the library? - LibAnswers**: - Each library has a variety of spaces for individual and group study and the best place to study is going to depend on your personal preference. …_  
   Why: Generic LibAnswers text ("depends on your preference") instead of naming spots with hours

24. **MISSED_DETAILS** · A028 [study] **“where can i study at 2am”**  
   Script: `ask q="where can i study at 2am"` (script)  
   Tommy: _From **9 p.m. to 7 a.m.**, only **USC students, faculty, staff, alumni and sponsored guests** may be in any USC library that's open, Leavey included. - **ID check:** during those hours everyone is asked for a **physical …_  
   Why: Answers the ID-check policy but never says "Leavey is open 24 hours" — the actual answer

25. **MISSED_DETAILS** · A029 [study] **“study spot with natural light and outlets”**  
   Script: `place.find kind="study spot" attrs="natural light, outlets"` (ai) · AI call  
   Tommy: _**Study spots matching greenery, outlets:** - **Doheny Memorial Library** · ~3 min walk · next to **Alumni Park** (park / green, ~55 m on the map) · laptop outlets listed · open now (until 8 pm) - **East Asian Library** …_  
   Why: AI mapped "natural light" to "greenery"; header says "matching greenery, outlets"

26. **MISSED_DETAILS** · A043 [dining] **“what's for lunch at village dining”**  
   Script: `ask q="what's for lunch at village dining"` (script)  
   Tommy: _**USC Village Dining Hall** · Dining - **Now:** Open · Until 10 PM - **Hours today:** 7 AM – 10 PM - **Address:** 3096 S. McClintock Avenue, Los Angeles, CA 90089 - **Walk:** about 10 min from You (Tutor Campus Center) -…_  
   Why: Venue card with hours; no menu or menu link (asked what's for lunch)

27. **MISSED_DETAILS** · A075 [gyms] **“does lyon center have a climbing wall”**  
   Script: `place.about place="Lyon Center"` (ai) · AI call  
   Tommy: _**Lyon Center** Rec Sports' main hub: cardio and strength floor, Main Gym with three courts (open rec, first-come first-served), a reservable racquetball court, F45 studio, Recovery Room, locker rooms and Pro Shop. Free …_  
   Why: AI → place.about Lyon Center; facility list never says whether there is a climbing wall

28. **MISSED_DETAILS** · A088 [access] **“how do i get my friend onto campus at night”**  
   Script: `ask q="how do i get my friend onto campus at night"` (script)  
   Tommy: _**Open 24/7 (staffed):** **McCarthy Way Entrance** (Figueroa St at McCarthy Way) and **McClintock Ave. Entrance** (Jefferson Blvd at McClintock). **Weekdays 6 AM–8 PM, closed weekends/holidays:** Watt Way (off Exposition…_  
   Why: Lists gate hours only; no guest registration / Trojan Check guest process

29. **MISSED_DETAILS** · A118 [safety] **“where are the blue light phones”**  
   Script: `safety.bluelight` (script)  
   Tommy: _**Blue light phones** - About nearly 300, Around UPC and HSC, in many buildings, and on each level of every parking structure. - Connects directly to DPS 24-hour communications center and identifies the phone location ev…_  
   Why: Garbled copy ("About nearly 300, Around UPC…"); no locations/nearest shown in text (chip only)

30. **MISSED_DETAILS** · A131 [courses] **“is there a section of math 226 on tuesday thursday”**  
   Script: `course.sections course="MATH 226"` (script)  
   Tommy: _**MATH 226 · Calculus III** (Fall 2026) · 18 sections: - Lecture 39553 · Mon/Wed/Fri 9:00 AM–9:50 AM · Christian Geske · 1/52 open · D-clearance - Discussion 39554 · Tue 10:00 AM–10:50 AM · instructor TBA · 1/26 open · D…_  
   Why: Dumps all 18 sections; never answers that MATH 226 lectures are MWF only (TTh = discussions)

31. **MISSED_DETAILS** · A184 [finaid] **“my aid hasnt come in yet who do i talk to”**  
   Script: `ask q="my aid hasnt come in yet who do i talk to"` (script)  
   Tommy: _Your Fall 2026 bill shows **$38,120** in financial aid applied (Fri, Aug 14, 2026, demo account). **FAST** (Financial Aid Summary and Tasks) shows the award-by-award breakdown. For Spring 2027, USC scholarships and grant…_  
   Why: Shows demo aid totals but not who to contact (Financial Aid office phone/email/FAST)

32. **MISSED_DETAILS** · A196 [housing] **“where do i pick up packages”**  
   Script: `ask q="where do i pick up packages"` (script)  
   Tommy: _**Address format:** your full name (as registered with USC Housing/USCard), "USC" + building name, your complete room assignment, street address and zip. Example: Tommy Trojan / USC Pardee Tower / PTD-901 / 614 Hellman W…_  
   Why: Explains mailing-address format, not where to pick up packages

33. **MISSED_DETAILS** · A197 [housing] **“best freshman dorms”**  
   Script: `ask q="best freshman dorms"` (script)  
   Tommy: _Yes—if you're a new **fall** first-year student and USC Housing receives your application **on or before May 1**. USC Housing defines first-year freshmen as recent high school graduates with no college credits. - The gua…_  
   Why: Answers the housing guarantee; nothing about freshman buildings/options

34. **MISSED_DETAILS** · A218 [clubs] **“what clubs are there for cs”**  
   Script: `ask q="what clubs are there for cs"` (script)  
   Tommy: _From **CS Student Organizations - USC Viterbi | Thomas Lord Department of Computer Science**: - The Makers of Entertaining Games Association is a student-run organization which strives to promote and facilitate the art o…_  
   Why: Shows one club (MEGA) scraped from a Viterbi web page instead of listing CS clubs from TH.CLUBS

35. **MISSED_DETAILS** · A222 [clubs] **“best clubs for premed”**  
   Script: `ask q="best clubs for premed"` (script)  
   Tommy: _EngageSC groups matching **premed**: - **American Medical Women's Association Premedical Branch** · Pre-Professional · 0 upcoming events American Medical Women's Association Premedical Branch Pre-Med Chapter aims to fost…_  
   Why: Only one pre-med club found for "best clubs for premed"

36. **MISSED_DETAILS** · A242 [events] **“usc football game this weekend”**  
   Script: `ask q="usc football game this weekend"` (script)  
   Tommy: _**On USC home football game days at UPC:** - **Parking is cashless:** same-day parking is paid with **Text2Park** once you park, and payment is required on entering (prepaying through Text2Park doesn't guarantee a space)…_  
   Why: Game-day parking info; never says whether there is a game this weekend or when the next one is

37. **MISSED_DETAILS** · A255 [careers] **“internship search usc”**  
   Script: `ask q="internship search usc"` (script)  
   Tommy: _From **Internship/Fellowship Programs at USC – Career Center** — _Search by School_: - Internships - Global Fellows Internship Program - Internships - Gateway Internship Program_  
   Why: Scraped nav list ("Internships, Global Fellows…, Internships") — no Handshake / how to search

38. **MISSED_DETAILS** · A291 [life] **“what does fight on mean”**  
   Script: `ask q="what does fight on mean"` (script)  
   Tommy: _- **Fight song:** "Fight On" ("Fight On for ol' SC..."). - **Alma mater:** "All Hail," written by Alfred F. Wesson ('24) in the early 1920s. It replaced the earlier "University Hymn." - **Motto:** *Palmam Qui Meruit Fera…_  
   Why: Dumps a traditions list (fight song, alma mater, motto) instead of explaining the phrase "Fight On"

39. **MISSED_DETAILS** · A293 [life] **“how do i get football tickets as a student”**  
   Script: `ask q="how do i get football tickets as a student"` (script)  
   Tommy: _Your **USCard** is your university ID for access to campus facilities and **athletic and cultural events**. Details on student season tickets (prices and how to buy) are on USC Athletics' ticketing site, which isn't cove…_  
   Why: Says ticket details are "not covered here" then pivots to ticket scams; no how-to for student season tickets

40. **MISSED_DETAILS** · A317 [multi] **“i need coffee and a quiet place to study near viterbi open past 10”**  
   Script: `place.find kind=study attrs="quiet,coffee"` (script)  
   Tommy: _**Study spots matching quiet, coffee:** - **Doheny Memorial Library** · ~3 min walk · listed as a quiet space · café inside or listed · open now (until 8 pm) - **Law School Cafe** · ~4 min walk · café inside or listed · …_  
   Why: Ignored "open past 10" (Doheny closes 8 PM, Law School Cafe closed) and "near Viterbi"

41. **MISSED_DETAILS** · A320 [multi] **“library near the village with group rooms open late”**  
   Script: `place.find kind=library open=late` (script)  
   Tommy: _**Libraries matching late:** - **Leavey Library** · ~5 min walk · open 24 hours today · open now_  
   Why: Only "late" kept: ignores "near the village" and "group rooms"

42. **MISSED_DETAILS** · A321 [multi] **“cheap lunch near kap under $10”**  
   Script: `place.nearest cat=food` (ai) · AI call  
   Tommy: _Nearest to you (TCC, Trousdale side): - **Seeds Marketplace** · ~1 min walk · closed now - **Slice Shop** · ~1 min walk · closed now - **Bowls** · ~1 min walk · closed now _Walking times are estimates from the campus map…_  
   Why: AI → place.nearest food from TCC (not KAP), all three closed, nothing about price

43. **MISSED_DETAILS** · A322 [multi] **“outdoor place to eat lunch with shade near doheny”**  
   Script: `place.find kind="outdoor space" attrs="outdoor seating, shade" open=now` (ai) · AI call  
   Tommy: _**Study spots matching outdoor, shade:** - **Law School Cafe** · ~4 min walk · next to **Exposition Park** (park / green, ~75 m on the map) · Indoor and shaded outdoor seating · closed now **Green spaces to sit or work o…_  
   Why: "Study spots matching outdoor, shade" from TCC; Law School Cafe (closed) first; not centered on Doheny, no lunch angle

44. **MISSED_DETAILS** · B364 [grades] **“am i failing anything”**  
   Script: `grades.show` (ai) · AI call  
   Tommy: _Your Fall 2026 grades so far: - **CSCI 104** Data Structures: **B** (86.6%) - **MATH 226** Calculus III: **A-** (91.7%) - **PHYS 151** Fundamentals of Physics I: Mechanics, Oscillations and Waves: **B-** (80.8%) - **PSYC…_  
   Why: Shows grades list but never answers the question ("no, nothing below a B-")

45. **MISSED_DETAILS** · B378 [order] **“order lunch for pickup at 12:30”**  
   Script: `do action=hub_order_food request="order lunch for pickup at 12:30"` (script)  
   Tommy: _Where should I order your **lunch** from? These take mobile orders and are open now:_  
   Why: Asks where to order but drops the 12:30 pickup time constraint (lists places "open now")

46. **OTHER** · A120 [safety] **“how do i get a safety escort”**  
   Script: `safety.escort` (script)  
   Tommy: _🚨 **In danger now: call 911 or DPS (213) 740-4321.** - Free USC Lyft Shared rides 7 PM-2 AM daily inside the UPC geofence (HSC 5 PM-2 AM Mon-Fri). See transport.json lyft. - From 2 AM to 6 AM DPS may be able to provide a…_  
   Why: Good content but leaks an internal note "See transport.json lyft." into the answer; also opens with an "In danger now" banner for a routine question

47. **OTHER** · A342 [typos] **“whos teachin csci104”**  
   Script: `ask q="whos teachin csci104"` (script)  
   Tommy: _**CSCI 104 — Data Structures** (4 units) in Spring 2027:_  
   Why: Empty answer: header "CSCI 104 — Data Structures (4 units) in Spring 2027:" with nothing under it; typo "teachin" not routed to course.who

48. **OTHER** · other467 [offtopic] **“tell me a joke”**  
   Script: — (no script tag) · AI call  
   Tommy: _I can only help with questions about USC, and I answer using information from USC’s official websites. Try asking me something about classes, deadlines, financial aid, housing, dining, health services or campus life._  
   Why: "Tell me a joke" → stiff USC-only refusal; a friendly Trojan joke would fit the demo

