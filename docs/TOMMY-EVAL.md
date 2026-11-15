# Ask Tommy — live evaluation

Live site https://trojanhub.netlify.app, run 2026-11-15T02:46Z → 2026-11-15T04:00Z (site version with 178 script commands). Raw data: `data/eval/results-20261115T0400Z.json`. Test set: `data/eval/questions.json`.

**294 messages graded · pass rate 201/294 = 68%** · 36 messages (12%) went to the AI translator (`POST /api/tommy`), 18 of those ended GOOD.

Coverage: the run was capped at 04:00 UTC to keep AI credits low, so 294 of the 397 messages in the test set ran. The order was interleaved across topics, so every topic is sampled; 103 messages (mostly later items in each topic) were not sent. 14 earlier results from the pre-02:45 site version were discarded.

Method: Playwright 402×874, one message every 15 s, a fresh page every 25 messages, `TA.UI.send(text)` then wait for `!TA.UI.busy`. Any pending action prompt (`TA.Brain.pending`) was cleared before each message so every message is graded on its own (see finding R1). No crisis or self-harm messages were sent. Each answer was graded by hand: does it answer exactly what was asked, every constraint included?

## Results by category

| Category | Count | Share |
|---|---|---|
| GOOD | 201 | 68% |
| MISSED_DETAILS | 40 | 14% |
| WRONG_SCRIPT | 33 | 11% |
| NOT_FOUND | 7 | 2% |
| OFF_TOPIC_REFUSAL | 1 | 0% |
| BAD_ACTION | 6 | 2% |
| OTHER | 6 | 2% |

## Pass rate by kind

| Kind | Pass | Rate |
|---|---|---|
| A · questions | 147/218 | 67% |
| B · actions | 45/61 | 74% |
| Greetings / off-topic | 9/15 | 60% |

## Pass rate by topic

| Topic | Pass | Rate |
|---|---|---|
| access | 2/12 | 17% |
| multi | 2/11 | 18% |
| study | 4/12 | 33% |
| email | 2/6 | 33% |
| events | 4/11 | 36% |
| life | 5/11 | 45% |
| offtopic | 5/10 | 50% |
| clubs | 6/11 | 55% |
| services | 6/10 | 60% |
| dining | 8/12 | 67% |
| gyms | 9/12 | 75% |
| grades | 6/8 | 75% |
| order | 6/8 | 75% |
| libraries | 10/13 | 77% |
| finaid | 7/9 | 78% |
| housing | 7/9 | 78% |
| careers | 7/9 | 78% |
| safety | 8/10 | 80% |
| guest | 4/5 | 80% |
| greet | 4/5 | 80% |
| typos | 9/11 | 82% |
| academics | 9/11 | 82% |
| transport | 10/12 | 83% |
| courses | 10/12 | 83% |
| book_room | 7/8 | 88% |
| deadlines | 8/9 | 89% |
| health | 9/10 | 90% |
| registration | 11/11 | 100% |
| places | 11/11 | 100% |
| payments | 5/5 | 100% |

## Top 50 failures

Ordered by severity (wrong script first), then questions before actions.

1. **WRONG_SCRIPT** · A008 [libraries] **“hoose library of philosophy hours”**  
   Script: `hours.check place="hoose library of philosophy hours"` (script)  
   Tommy: _Here are the libraries with posted hours, open or closed right now: - 🟢 **Leavey Library**: Open 24 hours - 🟡 **Doheny Memorial Library**: Closing soon · Closes 8 PM - 🟡 **Science & Engineering Library**: Closing soon · …_  
   Why: hours.check lists 7 libraries without Hoose; Hoose hours (Mon–Fri 9–5) exist in data/research/facts/places.json

2. **WRONG_SCRIPT** · A035 [study] **“is the tcc 3rd floor good for studying”**  
   Script: `ask q="is the tcc 3rd floor good for studying"` (script) · AI call  
   Tommy: _Here’s the closest match I found on USC’s pages: From **Tutor Campus Center/Steven and Kathryn Sample Building Directory - Trojan Event Services** — _3rd Floor_: - Building — Name of Office — Contact — Website - TCC 315 …_  
   Why: AI → ask; TCC 3rd-floor office directory (lactation room, FSL office) instead of the TCC 3rd Floor Lounge study info in TH.PLACES

3. **WRONG_SCRIPT** · A046 [dining] **“where can i get halal food”**  
   Script: `place.search what="halal food"` (script)  
   Tommy: _None of the campus places I carry mention **halal food**._  
   Why: place.search "halal food" → "None of the campus places I carry mention halal food" although the KB has a curated "Halal-friendly food on campus" answer (all 3 dining halls label halal-friendly dishes)

4. **WRONG_SCRIPT** · A050 [dining] **“cheapest place to eat on campus”**  
   Script: `ask q="cheapest place to eat on campus"` (script)  
   Tommy: _The lowest **2026–27** rent USC Housing lists is **$4,500 per person per semester**, for a **two-bedroom triple in Troy Hall**; Troy Hall's one-bedroom for 3 is **$4,550**. Troy Hall residents (upperclassmen) also pay fo…_  
   Why: "cheapest place to eat on campus" → cheapest housing rent (Troy Hall $4,500)

5. **WRONG_SCRIPT** · A051 [dining] **“does evk have breakfast on weekends”**  
   Script: `ask q="does evk have breakfast on weekends"` (script)  
   Tommy: _Based on regular Fall 2026 hours: **Late night** - **Trojan Grounds featuring illy** is open until **midnight** Monday–Friday. - **The Upstairs** (RTCC 2nd floor — poke, ramen, Sharetea, Coffee Bean) is open until **11:0…_  
   Why: "does evk have breakfast on weekends" → late-night food list; EVK opens 8:30 AM Sat–Sun

6. **WRONG_SCRIPT** · A087 [access] **“is the gate by the village open at night”**  
   Script: `hours.check place="is the gate by the village open at night"` (script)  
   Tommy: _I couldn’t match **is the gate by the village open at night** to a place with posted hours. The app has hours for libraries, dining halls and cafés, gyms and student offices._  
   Why: hours.check got a gate question; "couldn't match … to a place with posted hours" — should be gates.status for the Village-side (McClintock) entrance at night

7. **WRONG_SCRIPT** · A090 [access] **“can visitors walk around campus”**  
   Script: `ask q="can visitors walk around campus"` (script)  
   Tommy: _From **Campus Safety - USC** — _Safety Resources Around Campus_: - More info about Residential Safety - During campus events, home football games, or special periods such as finals week, the program hours may vary. - Liv…_  
   Why: KB snippet about LiveSafe/residential safety; campus.access (which answers this) not used

8. **WRONG_SCRIPT** · A091 [access] **“is campus open on weekends”**  
   Script: `gates.status` (script)  
   Tommy: _Right now, **10 of 10** campus entrances are open. - **Open:** McCarthy Way Entrance, McClintock Ave. Entrance, Watt Way Entrance, Pardee Way Entrance, Royal Street Entrance, Downey Way Entrance, Jefferson Blvd. Entrance…_  
   Why: gates.status for right now (Monday) instead of the weekend access policy (most gates closed weekends; McCarthy/McClintock 24/7)

9. **WRONG_SCRIPT** · A092 [access] **“what is trojan check”**  
   Script: `landmark.facts place=tommy` (script)  
   Tommy: _**Tommy Trojan** Unveiled in 1930 at USC's 50th jubilee, sculpted by Roger Noble Burnham. The pedestal reads "Faithful, Scholarly, Skillful, Courageous, Ambitious." - Unveiled in 1930 at USC's 50th jubilee - Sculpted by …_  
   Why: "what is trojan check" → landmark.facts Tommy Trojan statue (matched "trojan"); Trojan Check (campus access pass) never explained

10. **WRONG_SCRIPT** · A093 [access] **“which entrance can cars use”**  
   Script: `gates.status` (script)  
   Tommy: _Right now, **10 of 10** campus entrances are open. - **Open:** McCarthy Way Entrance, McClintock Ave. Entrance, Watt Way Entrance, Pardee Way Entrance, Royal Street Entrance, Downey Way Entrance, Jefferson Blvd. Entrance…_  
   Why: gates.status (all 10 open now) — doesn't say which entrances are for vehicles (McCarthy, McClintock 24/7; others weekdays)

11. **WRONG_SCRIPT** · A094 [access] **“do i need my id to get on campus”**  
   Script: `ask q="do i need my id to get on campus"` (script)  
   Tommy: _Most on-campus jobs are posted on **Handshake**: log in, go to **Jobs**, and filter by **Position Type** for on-campus positions. You can also add the Handshake widget on my.usc.edu (Student Jobs tab). - **Timing:** most…_  
   Why: "do i need my id to get on campus" → KB answer about on-campus jobs on Handshake; campus.access answers this

12. **WRONG_SCRIPT** · A095 [access] **“how do i get on campus as a guest speaker”**  
   Script: `gates.status` (script)  
   Tommy: _Right now, **10 of 10** campus entrances are open. - **Open:** McCarthy Way Entrance, McClintock Ave. Entrance, Watt Way Entrance, Pardee Way Entrance, Royal Street Entrance, Downey Way Entrance, Jefferson Blvd. Entrance…_  
   Why: "guest speaker" access → gates.status; should be visitor/event guest registration (visitor.usc.edu, host department)

13. **WRONG_SCRIPT** · A097 [access] **“which gate is closest to the coliseum”**  
   Script: `gates.status` (ai) · AI call  
   Tommy: _Right now, **10 of 10** campus entrances are open. - **Open:** McCarthy Way Entrance, McClintock Ave. Entrance, Watt Way Entrance, Pardee Way Entrance, Royal Street Entrance, Downey Way Entrance, Jefferson Blvd. Entrance…_  
   Why: AI → gates.status; never names the entrance nearest the Coliseum (Exposition Blvd side)

14. **WRONG_SCRIPT** · A100 [transport] **“how do i get to downtown la from usc”**  
   Script: `ask q="how do i get to downtown la from usc"` (script)  
   Tommy: _From **Downtown F/S Permits - USC Transportation**: - Submit search-form-6af15d37dfb54 - Downtown F/S Permits - October 8, 2025 - Submit search-form-6af15d37e6b5d_  
   Why: KB hit on "Downtown F/S Permits" page (parking permits) with scraped search-form junk; no Metro E Line directions

15. **WRONG_SCRIPT** · A172 [deadlines] **“whats the next deadline”**  
   Script: `ask q="whats the next deadline"` (script)  
   Tommy: _**Spring 2027 tuition and fees are due Friday, January 8, 2027, by 5 p.m. Pacific time** (the settlement deadline). Fall 2026's was August 21, 2026. By then you must be registered and have your charges **paid or deferred…_  
   Why: "next deadline" → Spring tuition due Jan 8; the withdrawal deadline Fri Nov 13 (and the student's own HW) come first; cal.deadlines / my.deadlines exist

16. **WRONG_SCRIPT** · A188 [finaid] **“can i get a refund if i drop a class”**  
   Script: `ask q="can i get a refund if i drop a class"` (script)  
   Tommy: _**To withdraw from the university:** 1. **Notify your academic advisor.** 2. **Drop all your courses** in Web Registration, watching the deadlines (you may owe tuition if you don't drop in time), and look for the confirm…_  
   Why: "refund if i drop a class" → how to withdraw from the university; should give the refund deadline (Fall: Sep 11, passed) / Tuition Refund Insurance

17. **WRONG_SCRIPT** · A220 [clubs] **“clubs for people who like hiking”**  
   Script: `club.find topic="people who like hiking"` (script)  
   Tommy: _EngageSC groups for **people who like hiking** (3): - **Reproductive Healthcare for People of Color** · Pre-Professional, Academic · joining closed - **Girls Who Lead** · Pre-Professional, Academic - **Trojans Who Read**…_  
   Why: club.find topic="people who like hiking" returned Reproductive Healthcare for People of Color, Girls Who Lead, Trojans Who Read (matched "people/who"); real hiking clubs exist (e.g. Hike for Habitats)

18. **WRONG_SCRIPT** · A228 [clubs] **“finance clubs usc”**  
   Script: `ask q="finance clubs usc"` (script)  
   Tommy: _From **Club Sports - Recreational Sports**: - Please review the Finances 101 document to learn about account types, depositing money, spending money, and reimbursements for Club Sports._  
   Why: "finance clubs usc" → Club Sports Finances 101 document; club.find finance not used

19. **WRONG_SCRIPT** · A292 [life] **“whats the conquest week”**  
   Script: `ask q="What is Conquest Week at USC?"` (ai) · AI call  
   Tommy: _From **Hands-only CPR: Trojan “Heart Heroes” – ONE USC Safety** — _Conquest Week_: **Conquest Week** - 11/16: Activities To Be Confirmed_  
   Why: AI→ask; KB hit is a CPR "Heart Heroes" page snippet "11/16: Activities To Be Confirmed"; doesn't explain Conquest/rivalry week

20. **WRONG_SCRIPT** · A297 [life] **“where can i get a usc hoodie”**  
   Script: `ask q="where can i get a usc hoodie"` (script)  
   Tommy: _**Returns (merchandise):** unwashed, unworn or defective items can be returned for a refund **within 30 days of purchase** (for online orders, within 30 days of shipping). Every return needs a **Return Form**, and refund…_  
   Why: Bookstore returns/payment FAQ; never says "USC Bookstore, 840 Childs Way" sells hoodies

21. **WRONG_SCRIPT** · A299 [life] **“whats there to do around usc”**  
   Script: `ask q="whats there to do around usc"` (script)  
   Tommy: _USC is in the middle of Los Angeles, so it combines a large public safety operation with personal precautions: - **DPS** operates 24/7, 365 days a year, patrolling campus and surrounding neighborhoods in cars, on bikes a…_  
   Why: "whats there to do around usc" → DPS safety blurb ("USC is in the middle of Los Angeles…"); no Expo Park museums/LA Live

22. **WRONG_SCRIPT** · A318 [multi] **“vegetarian food open now near leavey”**  
   Script: `hours.check place="vegetarian food open now near leavey"` (script)  
   Tommy: _🟢 **Leavey Library**: Open 24 hours **This week:** - Sun: 9 AM – 12 AM - Mon: Open 24 hours - Tue: Open 24 hours - Wed: Open 24 hours - Thu: Open 24 hours - Fri: Open 24 hours - Sat: 9 AM – 9 PM _Day-by-day hours copied …_  
   Why: hours.check matched "leavey" and returned Leavey Library hours; asked for vegetarian food open now near Leavey

23. **WRONG_SCRIPT** · A323 [multi] **“cs club that does hackathons and meets weekly”**  
   Script: `events.find q="cs club that does hackathons and meets weekly"` (script)  
   Tommy: _No upcoming events found for that search. Try searching for `#ai`, `#robotics`, `#career`, or `#freefood`._  
   Why: events.find with the whole sentence as query → "No upcoming events"; should be club.find topic=hackathon/cs (TH.CLUBS)

24. **WRONG_SCRIPT** · A327 [multi] **“place to get breakfast before 8am”**  
   Script: `do action=hub_order_food request="place to get breakfast before 8am"` (script)  
   Tommy: _Where should I order your **breakfast** from? These take mobile orders and are open now:_  
   Why: "place to get breakfast before 8am" (a question) → starts a food order flow listing places "open now"; should list venues opening before 8 (EVK/Parkside 7 AM, Trojan Grounds 6:30)

25. **WRONG_SCRIPT** · A343 [typos] **“finacial aid ofice”**  
   Script: `ask q="finacial aid ofice"` (script)  
   Tommy: _The WBB program (Marshall School of Business) **isn't eligible for federal or state aid**. The Financial Aid Office and Marshall work together so your aid meets your need at each school. Apply with the FAFSA and CSS Prof…_  
   Why: Typo "finacial aid ofice" → KB answer about the WBB (World Bachelor in Business) program's aid; place.where finaid exists

26. **WRONG_SCRIPT** · B359 [book_room] **“reserve a table on trousdale for my club”**  
   Script: `do action="proc:start-new-student-organization" request="reserve a table on trousdale for my club"` (script)  
   Tommy: _To **start a new student organization**, the real form asks for: - names/USC emails of the five officers and five+ members - whether it is religious/spiritual (ORSL path) or a club sport (RCC) Reply with whatever applies…_  
   Why: "reserve a table on trousdale for my club" → start-new-student-organization process form

27. **WRONG_SCRIPT** · B367 [grades] **“show my transcript”**  
   Script: `ask q="show my transcript"` (script)  
   Tommy: _**USC's pages don't give a set number of days** for a degree to appear on your transcript. What they do say: - The Registrar's **Degree Progress** office posts degrees to students' academic records, and you're **emailed …_  
   Why: "show my transcript" → KB answer about when a degree appears on the transcript; should show grades/completed courses or how to order a transcript

28. **WRONG_SCRIPT** · B393 [email] **“ask my professor for an extension on the essay”**  
   Script: `course.who course="ask an extension on essay"` (script)  
   Tommy: _**ISE 536 · Linear Programming and Extensions** (Fall 2026) is taught by **Niloufar Izadinia**. - Lecture 31536 · Tue/Thu 4:00 PM–5:50 PM · **Niloufar Izadinia** · 10 of 30 seats open **Also matches:** - ENGL 300 · The A…_  
   Why: course.who course="ask an extension on essay" → "ISE 536 Linear Programming and Extensions is taught by…" instead of an extension email draft

29. **WRONG_SCRIPT** · B405 [academics] **“what's on my calendar today”**  
   Script: `events.find q="what's on my  today"` (script)  
   Tommy: _No upcoming events found for that search. Try searching for `#ai`, `#robotics`, `#career`, or `#freefood`._  
   Why: "what's on my calendar today" → events.find "what's on my  today" → no events; my.calendar / my day exists

30. **WRONG_SCRIPT** · B422 [services] **“find a bike near me”**  
   Script: `ask q="find a bike near me"` (script)  
   Tommy: _**Lock it to a bike rack.** On campus, always park your bike at a rack; UPC has **more than 60** of them. - **Never block doorways, stairs, building entrances, access ways or ramps.** DPS impounds improperly parked bikes…_  
   Why: "find a bike near me" → bike-parking rules; bikes.nearest / Metro Bike Share stations not used

31. **WRONG_SCRIPT** · B424 [services] **“am i in a safe zone”**  
   Script: `ask q="am i in a safe zone"` (script)  
   Tommy: _USC Housing partners with **Off-Campus Housing 101**, which lists rentals from private landlords in the North University Park area around campus (and near HSC). Listings are within the **USC DPS patrol zone**, and the se…_  
   Why: "am i in a safe zone" → off-campus housing listings within DPS patrol zone; zone.check exists

32. **WRONG_SCRIPT** · other459 [greet] **“yo tommy whats up”**  
   Script: `landmark.facts place=tommy` (script)  
   Tommy: _**Tommy Trojan** Unveiled in 1930 at USC's 50th jubilee, sculpted by Roger Noble Burnham. The pedestal reads "Faithful, Scholarly, Skillful, Courageous, Ambitious." - Unveiled in 1930 at USC's 50th jubilee - Sculpted by …_  
   Why: "yo tommy whats up" → landmark.facts for the Tommy Trojan statue instead of a greeting

33. **WRONG_SCRIPT** · other472 [offtopic] **“recommend a good netflix show”**  
   Script: `events.recommend count=6` (script)  
   Tommy: _### ⭐ Recommended Events for You _Ranked by your thumbs up ratings and matching hashtags (Netflix-style)_ **Reading Together Party** 🟢 **88% Match** · Free food 📅 Tomorrow at 4 AM · 📍 Doheny Memorial Library, Room 241, L…_  
   Why: "recommend a good netflix show" → events.recommend ("Netflix-style") campus events

34. **OFF_TOPIC_REFUSAL** · other468 [offtopic] **“is ucla better than usc”**  
   Script: — (no script tag) · AI call  
   Tommy: _I can only help with questions about USC, and I answer using information from USC’s official websites. Try asking me something about classes, deadlines, financial aid, housing, dining, health services or campus life._  
   Why: "is ucla better than usc" refused as not about USC — it is about USC; a playful rivalry answer expected

35. **BAD_ACTION** · B368 [guest] **“guest my friend in tonight”**  
   Script: — (no script tag)  
   Tommy: _I can only act on **your own** account, so I can’t do that for someone else. They’ll need to sign in and do it themselves._  
   Why: Refuses: "I can only act on your own account" — guesting a friend IS the student's own action (guest.list exists, no guest.add)

36. **BAD_ACTION** · B391 [email] **“write an email to my advisor asking for a meeting”**  
   Script: `my.advisor` (script)  
   Tommy: _- Advisor: **Taylor Morgan** · Viterbi Academic Services - No advising appointments booked_  
   Why: my.advisor shows advisor info; no email draft was offered

37. **BAD_ACTION** · B392 [email] **“email my ta about the homework”**  
   Script: `hw.due range=week` (script)  
   Tommy: _**6 things due in the next 7 days**: - **PHYS 151** Lab report 10 · Tomorrow, 8 AM - **MATH 226** Discussion quiz 6 · Thu, Nov 12, 10 AM - **MATH 226** WebAssign HW 12: §16.1–16.2 Vector fields & line integrals · Thu, No…_  
   Why: "email my ta about the homework" ran hw.due (homework list); no email draft

38. **BAD_ACTION** · B394 [email] **“request an extension on my csci 104 homework”**  
   Script: `hw.due range=week course="CSCI 104"` (script)  
   Tommy: _**1 thing due in the next 7 days** for CSCI 104: - **CSCI 104** Lab check-off 11 · Mon, Nov 16, 12 PM _Homework is sample data on the demo account.__  
   Why: hw.due for CSCI 104 instead of drafting an extension request to the instructor

39. **BAD_ACTION** · B404 [academics] **“set a reminder for my math exam”**  
   Script: `exams.list course="MATH 226"` (script)  
   Tommy: _Your upcoming exams: - **MATH 226 Midterm 2** · Wed, Nov 18, 10 AM–10:50 AM · in 9 days - **MATH 226 Final exam** · Wed, Dec 9, 2 PM–4 PM · in 30 days (Registrar’s final-exam slot) _Midterm dates are sample data; final-e…_  
   Why: "set a reminder for my math exam" → exams list; no reminder offered/created

40. **BAD_ACTION** · B425 [services] **“navigate me to sgm”**  
   Script: `ask q="navigate me to sgm"` (script)  
   Tommy: _I couldn’t find **sgm** on the Trojan Hub map. Try a building name or code (like “Leavey” or “TCC”), or search the map._  
   Why: "navigate me to sgm" → "couldn't find sgm on the map", although building.find knows SGM (A267)

41. **NOT_FOUND** · A034 [study] **“where can i nap on campus”**  
   Script: `place.search what="nap spots, quiet rest areas to nap on campus"` (ai) · AI call  
   Tommy: _None of the campus places I carry mention **nap spots, quiet rest areas to nap on campus**._  
   Why: AI → place.search nap spots → "None of the campus places I carry mention…"; no honest suggestion (quiet lounges, libraries)

42. **NOT_FOUND** · A206 [health] **“is engemann open on weekends”**  
   Script: `hours.check place=engemann` (script)  
   Tommy: _I couldn’t match **engemann** to a place with posted hours. The app has hours for libraries, dining halls and cafés, gyms and student offices._  
   Why: hours.check can't match "engemann" ("couldn't match engemann to a place with posted hours") though place.where knows Engemann; no weekend hours

43. **NOT_FOUND** · A224 [clubs] **“clubs that meet on fridays”**  
   Script: — (no script tag) · AI call  
   Tommy: _I couldn’t find a clear answer to that on USC’s websites. These USC pages might help: --- **I flagged this for the Tommy team.** A question without an answer gets fixed, and you’ll get a note when I can answer it. Track …_  
   Why: AI → web search, "couldn't find a clear answer… flagged"; clubs' Friday meetings/events exist in TH.CLUB_EVENTS (club.meets / events.day day=friday)

44. **NOT_FOUND** · A240 [events] **“any career fairs coming up”**  
   Script: `events.search q="career fair" days=30` (script)  
   Tommy: _No public events match **career fair** in the next 30 days._  
   Why: "No public events match career fair in the next 30 days" — honest, but no pointer to Career Center/Handshake career fairs

45. **NOT_FOUND** · A244 [events] **“hackathons at usc”**  
   Script: `events.find q="hackathons at usc"` (script)  
   Tommy: _No upcoming events found for that search. Try searching for `#ai`, `#robotics`, `#career`, or `#freefood`._  
   Why: events.find "hackathons at usc" → no upcoming events; no clubs (e.g. hackathon orgs) or Viterbi pointers offered

46. **NOT_FOUND** · A245 [events] **“networking events for engineers”**  
   Script: `events.find q="networking  for engineers"` (script)  
   Tommy: _No upcoming events found for that search. Try searching for `#ai`, `#robotics`, `#career`, or `#freefood`._  
   Why: events.find "networking  for engineers" (word "events" stripped) → no events; Viterbi Career Connections events exist in feed

47. **NOT_FOUND** · A246 [events] **“movie screenings this week”**  
   Script: `events.find q="movie screening" hashtag=movies` (ai) · AI call  
   Tommy: _No upcoming events found for that search. Try searching for `#ai`, `#robotics`, `#career`, or `#freefood`._  
   Why: AI → events.find "movie screening" #movies → none; screenings exist this week (e.g. "Sweater Weather Screening", Visions & Voices screening Mon)

48. **MISSED_DETAILS** · A004 [libraries] **“what libraries are open 24 hours”**  
   Script: `hours.check place="what libraries are open 24 hours"` (script)  
   Tommy: _Here are the libraries with posted hours, open or closed right now: - 🟢 **Leavey Library**: Open 24 hours - 🟢 **Doheny Memorial Library**: Open · Until 8 PM - 🟢 **Science & Engineering Library**: Open · Until 8 PM - 🔴 **…_  
   Why: Lists all libraries open now instead of answering which are open 24 hours (Leavey) and on which days

49. **MISSED_DETAILS** · A005 [libraries] **“which library is open latest on saturday”**  
   Script: `place.hours place=library day=saturday` (script)  
   Tommy: _**Leavey Library** · Saturday (Sat, Nov 14): **9 AM – 9 PM** **Doheny Memorial Library** · Saturday (Sat, Nov 14): **closed** **Science & Engineering Library** · Saturday (Sat, Nov 14): **closed** _Posted USC hours; holi…_  
   Why: Compares only 3 libraries (Leavey, Doheny, SEL) and doesn't state the answer; others not checked

50. **MISSED_DETAILS** · A026 [study] **“quiet place to study open late near the village”**  
   Script: `place.find kind=study attrs=quiet open=late` (script)  
   Tommy: _**Study spots matching quiet, late:** - **Doheny Memorial Library** · ~3 min walk · listed as a quiet space · open now (until 8 pm) - **Leavey Library** · ~5 min walk · open 24 hours today · open now _No single place in …_  
   Why: Ignored "near the village": distances are from the demo location (TCC), not the Village; also says no place is both quiet and late although Leavey is 24h with quiet floors

### Other failures (short)

- MISSED_DETAILS · A027 “best place to study for finals” → `ask q="best place to study for finals"` (script) — Generic LibAnswers text ("depends on your preference") instead of naming spots with hours
- MISSED_DETAILS · A028 “where can i study at 2am” → `ask q="where can i study at 2am"` (script) — Answers the ID-check policy but never says "Leavey is open 24 hours" — the actual answer
- MISSED_DETAILS · A029 “study spot with natural light and outlets” → `place.find kind="study spot" attrs="natural light, outlets"` (ai) — AI mapped "natural light" to "greenery"; header says "matching greenery, outlets"
- MISSED_DETAILS · A033 “study spot near viterbi” → `place.find kind="study spot"` (ai) — AI → place.find kind="study spot" dropped "near Viterbi": list is by distance from TCC (Doheny, Cinema, East Asian) — SEL not first
- MISSED_DETAILS · A036 “quiet place to study near ronald tutor campus center thats open after midnight” → `place.find kind=study attrs=quiet open=late` (script) — Says no place is both quiet and open after midnight, lists Doheny (closes 8) first; Leavey (24h, has quiet floors) is the answer
- MISSED_DETAILS · A043 “what's for lunch at village dining” → `ask q="what's for lunch at village dining"` (script) — Venue card with hours; no menu or menu link (asked what's for lunch)
- MISSED_DETAILS · A075 “does lyon center have a climbing wall” → `place.about place="Lyon Center"` (ai) — AI → place.about Lyon Center; facility list never says whether there is a climbing wall
- MISSED_DETAILS · A080 “intramural sports how to join” → `club.join club="Recreational Sports"` (script) — club.join "Recreational Sports" EngageSC page; no intramural signup steps (IMLeagues via Rec Sports)
- MISSED_DETAILS · A082 “yoga on campus” → `ask q="yoga on campus"` (script) — Generic campus-life blurb mentioning "outdoor yoga"; no USC Workout yoga classes/pass (Tommy knows them, A077)
- MISSED_DETAILS · A088 “how do i get my friend onto campus at night” → `ask q="how do i get my friend onto campus at night"` (script) — Lists gate hours only; no guest registration / Trojan Check guest process
- MISSED_DETAILS · A096 “gate 1 hours” → `ask q="gate 1 hours"` (script) — USC has no "Gate 1" naming; lists all entrances but doesn't say so
- MISSED_DETAILS · A110 “how to get to union station” → `ask q="how to get to union station"` (script) — Walk route to Jefferson/USC station only; no "E Line to 7th St/Metro, transfer to B/D Line to Union Station" or ICS shuttle via Union Station (which Tommy knows)
- MISSED_DETAILS · A118 “where are the blue light phones” → `safety.bluelight` (script) — Garbled copy ("About nearly 300, Around UPC…"); no locations/nearest shown in text (chip only)
- MISSED_DETAILS · A131 “is there a section of math 226 on tuesday thursday” → `course.sections course="MATH 226"` (script) — Dumps all 18 sections; never answers that MATH 226 lectures are MWF only (TTh = discussions)
- MISSED_DETAILS · A184 “my aid hasnt come in yet who do i talk to” → `ask q="my aid hasnt come in yet who do i talk to"` (script) — Shows demo aid totals but not who to contact (Financial Aid office phone/email/FAST)
- MISSED_DETAILS · A196 “where do i pick up packages” → `ask q="where do i pick up packages"` (script) — Explains mailing-address format, not where to pick up packages
- MISSED_DETAILS · A197 “best freshman dorms” → `ask q="best freshman dorms"` (script) — Answers the housing guarantee; nothing about freshman buildings/options
- MISSED_DETAILS · A218 “what clubs are there for cs” → `ask q="what clubs are there for cs"` (script) — Shows one club (MEGA) scraped from a Viterbi web page instead of listing CS clubs from TH.CLUBS
- MISSED_DETAILS · A222 “best clubs for premed” → `ask q="best clubs for premed"` (script) — Only one pre-med club found for "best clubs for premed"
- MISSED_DETAILS · A242 “usc football game this weekend” → `ask q="usc football game this weekend"` (script) — Game-day parking info; never says whether there is a game this weekend or when the next one is
- MISSED_DETAILS · A247 “what events are good for meeting people” → `events.recommend count=6` (script) — events.recommend top pick "Reading Together Party … Tomorrow at 4 AM" (bad time data); not about meeting people
- MISSED_DETAILS · A248 “is there anything fun to do on friday night” → `ask q="is there anything fun to do on friday night"` (script) — One religious club's blurb ("On Friday, we have fun") instead of Friday-night events (events.day friday)
- MISSED_DETAILS · A255 “internship search usc” → `ask q="internship search usc"` (script) — Scraped nav list ("Internships, Global Fellows…, Internships") — no Handshake / how to search
- MISSED_DETAILS · A261 “career center drop in hours” → `hours.check place="career center drop in hours"` (script) — Gives Career Center office hours (8:30–5), not drop-in advising hours (1:00–3:30 PM Mon–Fri) which Tommy knows (A254)
- MISSED_DETAILS · A291 “what does fight on mean” → `ask q="what does fight on mean"` (script) — Dumps a traditions list (fight song, alma mater, motto) instead of explaining the phrase "Fight On"
- MISSED_DETAILS · A293 “how do i get football tickets as a student” → `ask q="how do i get football tickets as a student"` (script) — Says ticket details are "not covered here" then pivots to ticket scams; no how-to for student season tickets
- MISSED_DETAILS · A300 “best spots for sunset photos on campus” → `place.find kind="outdoor space" attrs="green, historic"` (ai) — AI → place.find outdoor/green/historic "study spots" with Law School Cafe first; nothing about sunset/photo spots
- MISSED_DETAILS · A317 “i need coffee and a quiet place to study near viterbi open past 10” → `place.find kind=study attrs="quiet,coffee"` (script) — Ignored "open past 10" (Doheny closes 8 PM, Law School Cafe closed) and "near Viterbi"
- MISSED_DETAILS · A320 “library near the village with group rooms open late” → `place.find kind=library open=late` (script) — Only "late" kept: ignores "near the village" and "group rooms"
- MISSED_DETAILS · A321 “cheap lunch near kap under $10” → `place.nearest cat=food` (ai) — AI → place.nearest food from TCC (not KAP), all three closed, nothing about price
- MISSED_DETAILS · A322 “outdoor place to eat lunch with shade near doheny” → `place.find kind="outdoor space" attrs="outdoor seating, shade" open=now` (ai) — "Study spots matching outdoor, shade" from TCC; Law School Cafe (closed) first; not centered on Doheny, no lunch angle
- MISSED_DETAILS · A324 “free food event tonight near the village” → `ask q="free food event tonight near the village"` (script) — Honest "nothing left today" but lists tomorrow's food events anywhere (incl. a "4:00 AM–6:00 PM" event); "near the village" ignored
- MISSED_DETAILS · A326 “quiet library open after 10pm on friday” → `place.find kind=library attrs=quiet` (script) — Drops "open after 10pm on Friday": Doheny closes 5 PM Fri; Leavey (open till midnight Fri) not shown
- MISSED_DETAILS · B364 “am i failing anything” → `grades.show` (ai) — Shows grades list but never answers the question ("no, nothing below a B-")
- MISSED_DETAILS · B378 “order lunch for pickup at 12:30” → `do action=hub_order_food request="order lunch for pickup at 12:30"` (script) — Asks where to order but drops the 12:30 pickup time constraint (lists places "open now")
- MISSED_DETAILS · B380 “reorder my last meal” → `do action=hub_order_food request="Reorder the student's last meal as a mobile order for pickup."` (ai) — AI → order flow, but asks where to order instead of reordering the last meal (no order history on demo account; should say so)
- MISSED_DETAILS · B423 “where's the nearest open gate” → `gates.status` (script) — gates.status lists all 10 open but the nearest open gate line is the answer; OK-ish but buried (same output as "which gates are open")
- OTHER · A120 “how do i get a safety escort” → `safety.escort` (script) — Good content but leaks an internal note "See transport.json lyft." into the answer; also opens with an "In danger now" banner for a routine question
- OTHER · A136 “classes about ai next semester” → `ask q="classes about ai next semester"` (script) — Empty answer: "Here's what I found in the Spring 2027 Schedule of Classes:" with no courses listed
- OTHER · A342 “whos teachin csci104” → `ask q="whos teachin csci104"` (script) — Empty answer: header "CSCI 104 — Data Structures (4 units) in Spring 2027:" with nothing under it; typo "teachin" not routed to course.who
- OTHER · other467 “tell me a joke” → — (no script tag) — "Tell me a joke" → stiff USC-only refusal; a friendly Trojan joke would fit the demo
- OTHER · other470 “asdfghjkl” → — (no script tag) — Gibberish gets the USC-only refusal instead of "didn't catch that"
- OTHER · other471 “what's 17 times 23” → — (no script tag) — Simple arithmetic refused as not about USC (fine to redirect, but stiff)

## What the failures have in common

Three causes account for most failures. All three are in the on-device layer, before the AI is ever asked:

1. **Greedy keyword scripts win too early.** A read script fires because the text contains one of its words, even when the question is about something else. Examples:
   - "vegetarian food … near leavey" runs `hours.check` (Leavey Library hours).
   - "what is trojan check" and "yo tommy whats up" run `landmark.facts` (the Tommy Trojan statue).
   - "ask my professor for an extension" runs `course.who` ("ISE 536 Linear Programming and **Extensions**").
   - "clubs for **people who** like hiking" returns "Reproductive Healthcare for **People** of Color".
   - "email my ta about the homework" runs `hw.due`.

   Because the script answered, step 3 (the AI translator) never runs.
2. **KB `ask` returns the nearest page even when it is off topic.** 37 of the 93 failures are `ask` hits on the wrong page. Examples: "do i need my id to get on campus" gets the Handshake jobs answer, "cheapest place to eat" gets housing rent, and "whats there to do around usc" gets a DPS safety blurb. `TS.weak()` doesn't treat these as weak, so the AI never gets a turn.
3. **Constraints are dropped.** `place.find`, `place.nearest`, `events.find` and `hours.check` keep one attribute and silently drop the rest:
   - **near X** (the Village, Viterbi, KAP, Doheny): distance is always measured from the demo location, TCC.
   - **open after 10 / midnight / on Friday**
   - **for 6 people**, **group rooms**
   - **at 12:30**

Only 36 of 294 messages (12%) reached the AI, and only half of those ended GOOD. When the AI did run, it usually picked the right script (B353, B369, A267, A270, A337, A341, A347). The losses come from the scripts it lands on, which drop constraints (A029, A033, A300, A321, A322).

## Routing fixes (priority order)

| # | Fix | Evidence |
|---|---|---|
| R1 | **A pending action prompt must not swallow an unrelated new request.** If the new message compiles to a different script or action with confidence ≥0.8, run it and park the pending one. Today the user gets "I didn't quite get that. Your balance is $1,250…". The harness cleared `TA.Brain.pending` between messages to grade each message on its own; with that cleared, this message (B416) passed. | B416 (pre-fix run: "report a broken light near leavey" was answered with the tuition-payment prompt). B411 auto-cancelled a pending drop. |
| R2 | **Action verbs beat read scripts.** If the text starts with or contains *email / write / tell / ask … for / request / remind / set a reminder / navigate / take me / book / reorder / cancel*, try `do` actions before read scripts (`hw.due`, `my.advisor`, `course.who`, `exams.list`, `events.find`). | B391, B392, B393, B394, B404, B425 |
| R3 | **Stopwords and short tokens must never decide a match.** Add a shared stoplist (people, who, like, check, what, my, me, place, near, open, does, have, thing, good) for `club.find`, `landmark.facts`, `course.who`/`course.find` titles and `place.search`. Require a whole-word match on a content word. "trojan" or "tommy" alone must not trigger `landmark.facts`. | A220, A092, other459, B393, A139 ("me a 2 unit") |
| R4 | **`hours.check` only when the question is about hours or open/closed, and the place must resolve.** For an unknown place, fall through (don't return the generic "here are the libraries" list). Give `hours.check` the same alias table as `place.where`: Engemann, Hoose and others. | A008 (Hoose), A206 (Engemann), A318, A087, A261 (career "drop-in" hours) |
| R5 | **Anchor "near X" on X.** When `place.find`, `place.nearest`, `events.*` or `open.*` gets "near <place>", compute walk times from that place's coordinates (TH.PLACES / geo-data), not TH.ME. Show "from the Village" in the header. | A026, A033, A320, A321, A322, A324 |
| R6 | **Time and day constraints must filter, not annotate.** For "open past 10", "after midnight", "on Friday", "before 8am" or "on Sunday", evaluate hours at that time and drop places that are closed then. Never print "No single place has all of: quiet, late" when Leavey (24 h, quiet floors) qualifies. | A317, A326, A036, A327 |
| R7 | **Weak-answer detection should include off-topic KB hits.** Treat `ask` as weak when the matched doc's title and question keywords share no content word with the message after stopwords, so the AI translator gets a turn. Example: "do i need my id to get on campus" has no overlap with "on-campus jobs on Handshake". | A094, A050, A299, A228, A090, A188, A051, A297, A343 |
| R8 | **Strip scraped boilerplate from KB snippets.** Drop lines like "Submit search-form-…", repeated nav labels ("Internships · Internships"), "[Image of …]" and table headers ("Building — Name of Office — Contact"). If nothing is left, mark the answer weak. | A100, A255, A027, A035 |
| R9 | **Never send a header with an empty list.** Treat it as weak and fall through. | A136 ("Here's what I found in the Spring 2027 Schedule of Classes:" with nothing under it), A342 |
| R10 | **A negative `place.search` must not hide the KB.** If `place.search` finds nothing, try `ask` before saying "None of the campus places I carry mention halal food". The KB has a curated `halal-dining` doc. | A046, A034 |
| R11 | **`events.find` gets cleaned queries.** Strip filler ("at usc", "this week", "for engineers", "what's on my … today"). Route "clubs that …" and "club that does X" to `club.find`, and "my calendar today" to `my.calendar`. | A244, A245, A323, A246, B405 |
| R12 | **Answer the question that was asked.** Lists that hide the answer should get a verdict line first: "Only **Leavey** is open 24 hours (Sun 9 AM through Fri midnight)", "Latest on Saturday: **Leavey, until 9 PM**", "Nothing below a B-", "Lyon Center has no climbing wall listed". | A004, A005, A074, B364, A075, A131 (TTh = discussions only) |
| R13 | **The badge must tell the truth.** `tag()` in `js/ta/script.js` stamps every answer with "⚡ AI converted words into script", even when `via:'script'` and no AI ran. Use "On-device script" for `via:'script'`. | every local answer |
| R14 | **Remove the internal note leak** "See transport.json lyft." from `safety.escort`. Also drop the "🚨 In danger now" banner from routine escort questions. | A120 |
| R15 | **USC-flavoured small talk shouldn't be refused.** A rivalry joke for "is ucla better than usc", a Trojan joke for "tell me a joke", and "Didn't catch that — try …" for gibberish. Keep the polite USC-only redirect for real off-topic questions. | other468, other467, other470, other459 |
| R16 | **`events.recommend` must not fire on "Netflix".** It currently matches its own "Netflix-style" description. Also, an event listed as "Tomorrow at 4 AM" ("Reading Together Party 4:00 AM–6:00 PM") looks like a time-zone or parse bug in the event data. | other472, A247, A324 |

## New scripts to add (top 20, most impact first)

Each script lists its arguments, example phrasings from this test set, and the repo data behind it. These are gaps in the current 178-command catalog, or fixes to commands that exist but don't answer these questions.

| # | Script `{args}` | Example phrasings | Data in this repo |
|---|---|---|---|
| 1 | `email.draft {to, course, reason, ask}` — to = professor, TA or advisor; ask = extension, absence, meeting, sick. Builds the `hub_email` confirm card with a real draft body. Must outrank `hw.due`, `course.who` and `my.advisor` (R2). | "email my ta about the homework", "ask my professor for an extension on the essay", "request an extension on my csci 104 homework", "write an email to my advisor asking for a meeting" | instructors from `data/soc.json.gz`; advisor from `TA.State.d` (my.advisor); HW from `TH.acad` |
| 2 | `guest.add {name, when, purpose}` — the student registers their own guest. Today "guest my friend in tonight" is refused ("I can only act on your own account"), while "let my friend sam onto campus at 8pm" works through the AI. | "guest my friend in tonight", "add my mom as a guest this weekend" | existing `hub_guest_register` action; after-hours rules in `data/research/facts/places.json` → `campus_access.after_9pm` |
| 3 | `campus.access {who, when}` — who = visitor, guest speaker, friend, me; when = night, weekend. Policy answer: open by day, 9 PM–6 AM controlled access, only the McCarthy and McClintock gates, pre-registration at visitor.usc.edu. Also explains **Trojan Check**. It exists but loses to `gates.status` and `ask`. | "can visitors walk around campus", "is campus open on weekends", "do i need my id to get on campus", "how do i get on campus as a guest speaker", "what is trojan check" | `places.json` → `campus_access.policy / after_9pm / id_check_window`; `safety.json` → `campus_access` |
| 4 | `gates.find {near, vehicle, when}` — nearest open entrance to a place, vehicle-entrance list, and status at a given time (night, weekend). States that USC has no numbered "Gate 1". | "which gate is closest to the coliseum", "which entrance can cars use", "is the gate by the village open at night", "gate 1 hours", "where's the nearest open gate" | `places.json` → `campus_access.vehicle_entrances`, `pedestrian_access_points_known`; gate coordinates in `js/geo-data.js` |
| 5 | `food.find {diet, near, open_at, meal, price}` — diet = vegetarian, vegan, halal, gluten-free, kosher; meal = breakfast, lunch, dinner, late. Filters venues by the time constraint and anchors on `near`. | "vegetarian food open now near leavey", "place to get breakfast before 8am", "late night food that's vegan", "cheap lunch near kap", "where can i get halal food", "does evk have breakfast on weekends", "cheapest place to eat on campus" | `places.json` → `dining_halls`, `retail_dining`, `restaurants` (hours + features); KB docs `halal-dining`, special diets; `TH.PLACES` |
| 6 | `study.find {near, open_at, quiet, group_size, features}` — the multi-constraint version of `place.find`, with the R5 and R6 rules. Says plainly "Leavey is the only library open after midnight". | "quiet place to study open late near the village", "i need coffee and a quiet place to study near viterbi open past 10", "quiet library open after 10pm on friday", "library near the village with group rooms open late", "study spot near viterbi" | `places.json` → `libraries` (daily hours), `study_spaces`; `data/research/facts/_build/lib_hours_parsed.json`; `TH.PLACES`, `js/geo-data.js` |
| 7 | `hours.superlative {kind, day, which}` — which = latest, earliest, 24h; kind = library, gym, dining, café. One-line verdict, then the table. | "what libraries are open 24 hours", "which library is open latest on saturday", "gym open latest tonight", "coffee open past 9pm" | same hours tables as `hours.check` |
| 8 | `club.find` v2 `{topic, day, does}` — stopword-safe, synonym-expanded (hiking → outdoors, hike, camping; finance → investment, trading, banking; premed → pre-health, medical); "meets on X" via club events. Return 3–8 clubs, not 1. | "clubs for people who like hiking", "finance clubs usc", "best clubs for premed", "clubs that meet on fridays", "cs club that does hackathons and meets weekly", "what clubs are there for cs" | `js/clubs-data.js` (TH.CLUBS, TH.CLUB_EVENTS: names, categories, descriptions, events) |
| 9 | `events.find` v2 `{q, day, near, food}` — cleans queries (R11), maps synonyms (movie → screening/film; hackathon → hack/makeathon; networking → career/mixer), and falls back to `club.find` and the Career Center when no events match. | "movie screenings this week", "hackathons at usc", "networking events for engineers", "any career fairs coming up", "is there anything fun to do on friday night", "free food event tonight near the village" | `TH.CLUB_EVENTS` in `js/clubs-data.js`; career fair date (Feb 4, 2027) in `data/kb.json.gz` |
| 10 | `reminder.set {what, when}` — "remind me…" or "set a reminder for my X exam", resolving X through `exams.list`/`hw.due`. Confirm card + Undo; simulated notification. | "set a reminder for my math exam", "remind me to go to office hours at 3" | `TH.acad` exams/HW; `TH.H().x.notif` |
| 11 | `nav.to {place}` — "navigate/take me/walk me to X" using the same resolver as `building.find` (codes such as SGM, THH, KAP). | "navigate me to sgm", "take me to the closest dining hall", "how do i get to thh" | `js/geo-data.js` building codes; `TH.route` |
| 12 | `transit.to {dest}` — off-campus trips: Union Station (E Line → 7th St/Metro → B/D Line, or ICS shuttle), downtown, LAX, Expo Park museums. | "how do i get to downtown la from usc", "how to get to union station", "lax to usc" | `data/research/facts/transport.json` → `metro`, `usc_buses` (ICS via Union Station), `u_pass` |
| 13 | `nearby.things {kind}` — museums, parks and venues next to campus: Natural History Museum, California Science Center, Exposition Park Rose Garden, BMO Stadium, Coliseum, Galen, LA Live; sunset/photo spots. | "whats there to do around usc", "museums near usc", "best spots for sunset photos on campus" | `places.json` → `landmarks`; `js/geo-data.js` OSM parks; `TH.PLACES` |
| 14 | `athletics.next {sport}` — next home game, date/opponent/venue, student tickets, game-day dining and parking. | "usc football game this weekend", "when is the next basketball game", "how do i get football tickets as a student", "where can i watch the game on campus" | `places.json` → `dining_game_day_2026_11_21`; `safety.json` → `game_day`; game-day parking in KB |
| 15 | `rec.programs {kind}` — intramurals, yoga, climbing, group fitness, guest passes, courts. Answers yes/no on specific amenities ("no climbing wall is listed at Lyon"). | "intramural sports how to join", "yoga on campus", "does lyon center have a climbing wall", "tennis courts usc open to students" | `places.json` → `recreation`; Rec Sports KB docs (USC Workout, court schedules) |
| 16 | `career.dropin {}` + routing for "career center drop in hours" → 1:00–3:30 PM Mon–Fri, STU 110 (Tommy already knows this, A254). Also `jobs.find`: Handshake and internships, without scraped nav. | "career center drop in hours", "internship search usc" | KB Career Center docs; `places.json` → `services` (USC Career Center) |
| 17 | `deadline.next {kind}` — the next date across the academic calendar plus the student's own HW and exams. "Next deadline" should say "Withdraw (W) deadline Fri Nov 13 — in 4 days", not Spring tuition. Includes P/NP and refund deadlines for the current term. | "whats the next deadline", "pass no pass deadline", "can i get a refund if i drop a class" | `cal.deadlines` data (Registration Calendar); `TH.acad` |
| 18 | `transcript.show {}` / `my.completed` routing — "show my transcript" gives grades and completed courses (simulated), plus how to order an official transcript. | "show my transcript" | demo account grades (`grades.show`, `my.completed`); KB Registrar transcript docs |
| 19 | `package.pickup {}` — where housing residents pick up packages, by building, plus The Mail Stop. | "where do i pick up packages", "where is the mail stop" | `places.json` → `services` ("Package pickup for USC Housing residents", "The Mail Stop") |
| 20 | `smalltalk {kind}` — greeting variants ("yo tommy whats up"), jokes, the UCLA rivalry, gibberish ("didn't catch that"), arithmetic → polite redirect. Runs before `landmark.facts`. | "yo tommy whats up", "tell me a joke", "is ucla better than usc", "asdfghjkl" | none needed (fixed copy) |

Next after these: `course.find` by meeting days for a course ("is there a section of math 226 on tuesday thursday" → "Lectures are MWF only; TTh are discussions"), `zone.check` routing for "am i in a safe zone", `my.calendar` for "what's on my calendar today", `bikes.nearest` vs Metro Bike Share for "find a bike near me", `order.reorder` (honest when there is no order history), `fitness.hsc`, housing `freshman options`, `wifi` (already GOOD), and `tcc.lounge` for "is the tcc 3rd floor good for studying".

## How to re-check

After fixes land, re-run only the failures (≤50 messages; credit cap): `jq -r '.results[] | select(.grade!="GOOD") | .id' data/eval/results-20261115T0400Z.json`. Use the same harness: 15 s pacing, a fresh page every 25 messages, `TA.Brain.pending` cleared between messages.

