# Trojan Hub fact check: corrections

Checked on Mon Nov 9, 2026 against the Trojan Assist knowledge base (official USC pages collected Nov 9, 2026) and live pages on transnet.usc.edu, dps.usc.edu, hospitality.usc.edu, recsports.usc.edu and libraries.usc.edu. The corrected values are in `places.json`, `transport.json`, `safety.json` and `facts_daily.json` in this folder.

Status key:
- **Wrong**: an official source says something different.
- **Unverified**: no allowed source confirms it. Remove it or label it as demo data.
- **Fictional**: the place or service does not exist under that name.

Line numbers refer to `js/data.js` unless another file is named.

## 1. Campus access and gates

| Claim in Trojan Hub | Status | Correct value | Source |
|---|---|---|---|
| "USC ID check (6 PM–6 AM)" (README, `app.js:234`, `assistant.js:165`, gates `access: 'ID check 6 PM – 6 AM'` / `'ID tap after 6 PM'`) | **Wrong** | Controlled access runs **9 PM–6 AM**. During that time only the **McCarthy** and **McClintock** gates are open, and the campus is closed to unregistered guests. Before 9 PM the campus is open to the public, but officials may ask for a USCard or photo ID at any time. | https://dps.usc.edu/services/visitor-registration/ (live), https://www.usc.edu/how-to-access-campus/ |
| Staffed 24/7 gates at Trousdale/Jefferson, Figueroa/Downey and Trousdale/Exposition (`assistant.js:165`, data.js gates) | **Wrong** | The only 24-hour staffed entrances are **McCarthy Way** (Figueroa at McCarthy Way, 620 W McCarthy Way) and **McClintock Ave** (Jefferson at McClintock, 3425 McClintock Ave). | https://transnet.usc.edu/index.php/about-us/entrance-hours/ (live) |
| `g-watt-jeff` Watt Way at Jefferson, 6:30–21:00 weekdays, 8–18 Sat | **Wrong** | The **Watt Way Entrance** is off **Exposition** (3780 Watt Way). It is open weekdays 6 AM–8 PM and closed on weekends and holidays. A pedestrian point at "Watt Way and Jefferson" exists, but its hours are not published. | transnet entrance-hours (live); https://dps.usc.edu/2024/05/07/usc-faculty-and-staff-access-and-visitor-registration-guidelines-for-university-park-campus-upc/ |
| `g-mcc-jeff` McClintock at Jefferson, 6:00–22:00 | **Wrong** | Open **24 hours** every day and staffed 24 hours. It is one of the two gates open after 9 PM. | transnet entrance-hours (live) |
| `g-verm-36` Vermont at 36th Pl, 6:00–24:00 | **Wrong** | The **Downey Way Entrance** (1042 W 36th Pl) is open weekdays 6 AM–8 PM and closed on weekends and holidays. | transnet entrance-hours (live) |
| `g-hoover-jeff`, `g-fig-childs`, `g-fig-downey`, `g-mcc-expo`, `g-verm-35`, `g-trous-jeff`, `g-trous-expo` hours and "accessible" flags | **Unverified** | USC does not publish hours for pedestrian gates. The real vehicle entrances missing from the app are **Pardee Way** (off Exposition, weekdays 6–8), **Royal Street** (Jefferson at Royal, weekdays 6–8) and **Jefferson Blvd** (east of Vermont, weekdays 6 AM–8 PM, weekends 7 AM–3:30 PM). The step-free/accessible flags have no source. | transnet entrance-hours (live) |

## 2. Free Lyft

| Claim | Status | Correct value | Source |
|---|---|---|---|
| "Free USC Lyft (6 PM–3 AM)" (README; `TH.LYFT.span ['18:00','27:00']`; `screens.js:26`; `assistant.js:21,41,159`) | **Wrong** | **UPC: 7 PM–2 AM, every day.** HSC: 5 PM–2 AM, Mon–Fri only, including Union Station. On fall home football game days it starts 5 hours after kickoff or at the normal time, whichever is later. | https://transnet.usc.edu/index.php/how-to-use-lyft/ (live) |
| `ridesPerMonth: 12`, "12 free rides a month" (`screens.js:26`, `assistant.js:21,159`) | **Unverified** | USC publishes no per-student ride count. The page says the program "runs on limited credits that automatically renew every month," and a footnote says "Maximum monthly benefit is $1,000." | same |
| `zone: 'USC Lyft service area (demo boundary: the full map)'` | **Wrong** | The ride must start **and** end inside this area: east of Normandie Ave, south of Washington Blvd, west of Main St, north of MLK Jr. Blvd. Rides between campuses are not covered. | same |
| Ride type not mentioned | Missing | Riders must choose **Shared**. LUX, scheduled rides, priority pickup, added stops, tips and PrimeTime are not covered. | same |

## 3. Shuttles, Metro, U-Pass, Zipcar

| Claim | Status | Correct value | Source |
|---|---|---|---|
| `TH.SHUTTLES` "Campus Circulator" every 12 min, 7–23, weekdays | **Fictional** | USC runs no campus circulator. The real weekday routes are the **C Route** (from Leavey Library every 20 min, 6:30 AM–7 PM, through the north neighborhood) and the **Parking Center** route (every 30 min, 9 AM–3 PM). | https://transnet.usc.edu/index.php/bus-map-schedules/ (live) |
| "HSC Intercampus" every 20 min, 6:30–21:30 | **Wrong** | The **Intercampus Shuttle (ICS)** goes UPC → Union Station → HSC. It runs Mon–Fri with UPC departures 7:00 AM–9:20 PM (29 fixed times, not a fixed headway) from the **Jefferson bus turnout just east of Hoover**. The **Weekend ICS** runs Sat–Sun 8:30 AM–4:40 PM, but not on home game days or Nov 28–29. | same |
| "Union Station Express" every 30 min, 6–20, from Figueroa & Childs | **Wrong** | The route is **UPC to Union Station**, Mon–Fri 7:00 AM–10:05 PM, leaving from the Jefferson bus turnout. Return trips run 6:33 AM–10:15 PM. | same |
| "North Neighborhood Night Loop" 18:00–03:00 daily | **Fictional** | USC has no evening bus loop. Campus Cruiser is **suspended**, and night rides are the free Lyft program. | same; https://transnet.usc.edu/ |
| Shuttle stops "Jefferson & Trousdale", "USC Village", "Figueroa & Childs", "Parkside" (`stop-*`) | **Unverified / wrong** | The real stops are the **Jefferson bus turnout (east of Hoover)**, the **DASH stop on Jefferson east of Royal**, **Leavey Library**, **Vivian Hall**, **Grand Structure**, **Pardee Way Entrance**, **34th & McClintock**, **University Village** and others. See `transport.json`. | same |
| "USC shuttles with live departures" | Note | Real-time data comes from **ETA SPOT** (uscbuses.etaspot.net). It is not integrated. USC buses do not run on university holidays. | same |
| `TH.METRO.dirs ['Downtown LA (7th St/Metro)', 'Downtown Santa Monica']`; headways 8/12/20 min; station hours 4:30–1:30 | **Unverified** | No allowed USC page gives E Line terminals, frequency or hours. The eastbound label is likely outdated, because the E Line has run through downtown since the 2023 Regional Connector. Check metro.net, which is not on the allowlist. The three stations are correct. | https://transnet.usc.edu/index.php/student-u-pass/ |
| "Jefferson/USC Station (E Line) on Flower St, short walk from Galen" | Partly verified | The station name is correct. The street and Galen details have no source. | same |
| "3-tap U-Pass sign-up", "lands in Wallet", "tap your phone at the gate" (README, `screens.js:33,112`, `assistant.js:21`) | **Wrong** | You need a **physical USC-issued card**, picked up at McCarthy Structure Mon–Fri 8:30–3:00. Then fill out the U-Pass form, follow the LA Metro link in the confirmation email, enter the 20-digit card number and activation code, submit, wait 24 hours, and **tap the card within 14 days** to lock in the activation. Re-register every semester. USC mentions no phone or mobile-wallet version. | https://transnet.usc.edu/index.php/student-u-pass/ (live) |
| Zipcar locations "Village Structure" and "Structure X"; cars "Traveler", "Conquest", "Fight On", "Spirit"; $11–15/hr | **Unverified / fictional** | USC does not list Zipcar locations, cars or rates. The verified details are membership terms: **free first year, then $35/yr**, 18+, with gas and insurance included. | https://transnet.usc.edu/index.php/zipcar/ (live) |

## 4. Parking

| Claim | Status | Correct value | Source |
|---|---|---|---|
| "Parking Structure X (PSX)… off Exposition", capacity 1400, west campus | **Wrong** | **PSX is the McCarthy Way Parking Structure** at 620 McCarthy Way, entered from Figueroa. It houses USC Transportation, Housing Services and The Mail Stop. Visitors pay $20/day. Capacity is not published. | https://housing.usc.edu/index.php/csc/, https://transnet.usc.edu/index.php/contact-us/ |
| "Village Structure… First 30 minutes free", capacity 2000 | **Unverified** | The USC Village garage entrance is at **3215 S Hoover St**. Shoppers can get validated parking, and unpaid parking is an $80 fine. No source mentions "30 minutes free" or a capacity. | https://village.usc.edu/map-and-directions/, https://transnet.usc.edu/index.php/parking-violations/ |
| "Figueroa Structure… Closest to Marshall and Viterbi", capacity 1200 | Partly wrong | The **Figueroa St. Structure** is at 3520 S Figueroa St, north of Exposition. Visitors pay **$4/hour**. The "closest to" claim and the capacity have no source. | transnet entrance-hours (live), https://transnet.usc.edu/index.php/daily-and-hourly-parking/ |
| "Jefferson Lot… Surface lot near Galen", 6:00–23:00 | **Unverified** | USC lists a **Jefferson Structure** ($4/hr after 12 PM, Gold permit), not a surface lot. No address or hours were found. | daily-and-hourly-parking, parking-rates |
| Live "free parking spots" counts | **Unverified** | No public occupancy feed was found. USC has **no free parking**. | daily-and-hourly-parking |
| Missing real structures | Missing | Grand Ave ($2/hr, $14/day), USC Shrine, Flower (USCard only), Downey, Royal, Parking Structure A (DPS). Student permits: Gold $612, Cardinal $477, Evening $306 per semester. | `places.json` parking, `transport.json` parking |

## 5. Dining

| Claim | Status | Correct value | Source |
|---|---|---|---|
| EVK hours "7:00-10:30, 11:00-15:00, 16:30-21:00" weekdays; "9:00-14:00, 16:30-20:00" weekends | **Wrong** | **Mon–Wed and Fri 7 AM–10 PM, Thu 7 AM–8 PM, Sat–Sun 8:30 AM–10 PM.** Nov 11: 7 AM–10 PM. No meal-period gaps are published. | https://hospitality.usc.edu/hours-of-operation/ (live) |
| Parkside, same mock hours; name "Parkside Restaurant & Grill" | **Wrong** | **Parkside Residential Dining Hall**: Mon–Fri 7 AM–10 PM, Sat 8:30 AM–8 PM, Sun 8:30 AM–10 PM. | same |
| Village Dining Hall "7–10:30, 11–15, 16:30–22"; "Pizza oven, rotisserie and a Mongolian grill", "Kosher-style" | **Wrong** | **Mon–Thu 7 AM–10 PM, Fri 7 AM–8 PM, Sat 8:30 AM–10 PM, Sun 11 AM–10 PM.** Its features are a salad bar, deli, the rotating Expo station and USC's first fully self-contained vegan station. The Mongolian bar is at **Parkside**. | same; https://hospitality.usc.edu/dining-locations/usc-village-dining-hall/ |
| Seeds Marketplace 7:30–21:00 weekdays, 10–18 Sat, closed Sun | **Wrong** | **Mon–Thu 7 AM–6 PM, Fri 7 AM–5 PM, Sat–Sun 9 AM–3 PM.** | hours-of-operation (live) |
| Panda Express (TCC) 10:30–20:00, Sat 11–17 | **Wrong** | **Mon–Thu 10:30 AM–6 PM, Fri 10:30 AM–5 PM, closed weekends**, and closed Nov 11. | same |
| Moreton Fig "Sit-down restaurant and bar", 11–21 weekdays | **Wrong** | **MoretonFig is now a special and private events venue.** It is closed every regular day and opens for game days and events, for example 12:30–4:30 PM on Nov 21. | same; https://hospitality.usc.edu/game-day/ |
| Trojan Grounds "Coffee at Leavey Library", 7:00–02:00 weekdays, 9–24 Sat, 10–02 Sun | **Wrong** | It is **in Birnkrant Residential College (BSR), 642 W 34th St**, next to Leavey, not inside it. Hours are **Mon–Fri 6:30 AM–midnight, Sat–Sun 8 AM–6 PM**. | same; https://housing.usc.edu/index.php/buildings/birnkrant-residential-college/ |
| Literatea 8:00–17:00 weekdays | **Wrong** | **Mon–Thu 8 AM–3 PM, Fri 8 AM–1:30 PM**, closed weekends. It is closed Nov 11. | hours-of-operation (live) |
| "Village Bowls & Wraps" (`cava`), "Village Café & Bakery" (`dulce`) | **Fictional** | No such USC venues exist. Real Hospitality venues missing from the app: Bowls, Burger Crush, Taco-Taco, Slice Shop, C&G Juice Co., The Upstairs (RTCC), Popovich Café, Café Annenberg, Coffee Bean (SCA), Tutor Hall Café, Law School Cafe, Chad Tons, The Lab, Rosso Oro's, McKay's. | hours-of-operation; https://hospitality.usc.edu/dining-locations-upc/ |
| "Village Grocery… Full grocery store", 8–22 | **Fictional name** | USC Village has **Trader Joe's** and **Target**. Their hours are not on allowed hosts. | https://village.usc.edu/about/facts/ |
| `TH.MENUS` and `TH.ORDER_MENUS` items and prices | **Unverified / fictional** | No menus or prices were collected. Mark these as demo data. | — |
| Mobile order, "I'm here" and Dining Dollars ordering at these venues | **Unverified** | No USC mobile-order system was found in the sources. Some venues take meal swipes: Campus Center swipes work at Seeds, Bowls, Slice Shop, Taco-Taco, Burger Crush, C&G and Trojan Grounds. | https://hospitality.usc.edu/meal-plan-options/ |
| `crowd` arrays and dining "live waits" | **Unverified** | No public data. Mark these as simulated. | — |
| Thanksgiving and finals dining hours | Gap | USC Hospitality had **not posted** Nov 25–29 or Dec 5–16 hours as of Nov 9. Regular hours end Dec 4. | hours-of-operation (live) |

## 6. Libraries and study

| Claim | Status | Correct value | Source |
|---|---|---|---|
| Leavey `W('24h')`: "Open 24/7 during the semester with a USC ID after 10 PM" | **Wrong** | Leavey is open **24 hours Mon–Thu** (continuously from Sun 9 AM to Fri midnight), Fri until midnight, Sat 9 AM–9 PM, and Sun from 9 AM. It is 24/7 only during finals (Sat Dec 5 8 AM through Wed Dec 16 8 PM). Photo ID is required at all times. **After 9 PM** (not 10 PM) and before 7 AM, only USC people may enter, with a **physical USCard**. Thanksgiving: Nov 25 closes 5 PM, closed Nov 26–27, Nov 28 9–5. | https://libraries.usc.edu/hours (live), https://libraries.usc.edu/locations/leavey-library |
| "Group study rooms on the 2nd floor" | **Unverified** | Study pods (2nd and 3rd floor lobbies) are verified. Group-room floors are not. | https://libanswers.usc.edu/faq/21402 |
| Doheny 8–22 weekdays, 10–18 Sat, 12–22 Sun | **Wrong** | **Mon–Thu 9 AM–8 PM, Fri 9 AM–5 PM, Sat closed, Sun noon–8 PM.** Finals: 9 AM–10 PM on Dec 7–10 and 14–15. | libraries.usc.edu/hours (live) |
| "VKC Library" 8–23 | **Wrong name and hours** | The **Library for International and Public Affairs (LIPA)** is open Mon–Thu 9 AM–7 PM, Fri 9 AM–5 PM, closed weekends. Its building (VKC) was not confirmed on an allowed page. | same |
| Science & Engineering Library 8–24 weekdays, open weekends | **Wrong** | It is in **SSL 201, 910 Bloom Walk**. Hours are **Mon–Thu 9 AM–8 PM, Fri 9 AM–5 PM, closed Sat–Sun**. | same; https://libraries.usc.edu/locations/doheny-memorial-library |
| Seat counts (640/420/180/260/90) and "open seats" | **Unverified** | No public data. | — |
| "TCC 3rd Floor Lounge" 7–24 | **Unverified** | Not confirmed. A TCC building-hours page exists, but its host is not allowed. | — |

## 7. Recreation

| Claim | Status | Correct value | Source |
|---|---|---|---|
| Lyon Center 6:00–24:00 weekdays, 8–22 weekends | **Wrong** | **Mon–Thu 6 AM–11:30 PM, Fri 6 AM–10 PM, Sat 9 AM–7 PM, Sun 9 AM–11:30 PM.** Special hours: Nov 21 9 AM–2 PM; Thanksgiving Nov 24 6 AM–10 PM, Nov 25 9 AM–4 PM, closed Nov 26–28; winter hours from Dec 6. | https://recsports.usc.edu/rec-facilities/operating-hours/ (live) and modified-hours pages |
| Lyon "rock wall" | **Unverified** | The official facility list has no rock wall. It lists 3 courts, a racquetball court, F45, the Recovery Room and the Pro Shop. | https://recsports.usc.edu/rec-facilities/lyon-center/ |
| Village Fitness Center 6–23 weekdays, 8–21 weekends; "above the Village" | **Wrong** | **Mon–Fri 8 AM–11 PM, Sat–Sun 11 AM–11 PM**, at 929 W Jefferson Blvd Ste 1665 in Cale and Irani. Closed Dec 19–Jan 3. | operating-hours (live) |
| Uytengsu rec swim "6–9, 11–14, 17–20 weekdays; 10–16 Sat" | **Wrong** | Rec Swim is posted week by week. For the week of Nov 9: Competition Pool weekdays 12–2 PM, Sun 11–2; Dive Pool Mon–Wed 6–8, 11–12 and 4–6, with less time during dive meets Nov 12–14. | same |
| Trojan Pass "Lyon Center court time" bookings for basketball, badminton or pickleball | **Wrong model** | Lyon courts are **first-come, first-served open rec** on a fixed weekly schedule. Only the **racquetball** court can be reserved, 2 days ahead in Rec Reservations. | same; https://recsports.usc.edu/rec-facilities/lyon-center/ |
| Gym crowd and capacity numbers | **Unverified** | No public data. | — |

## 8. Health

| Claim | Status | Correct value | Source |
|---|---|---|---|
| Engemann 8:00–18:00 weekdays, 9–13 Sat | **Wrong / partly unverified** | Engemann (1031 W 34th St) typically closes at **7 PM Mon–Thu, 5 PM Fri, 1 PM Sat** during fall and spring. **Opening time is not published.** | https://studenthealth.usc.edu/hours/ |
| "Walk-in queue" at Engemann; virtual line "Engemann walk-in" | **Wrong** | Care is by **appointment**. Same-day and next-day illness or injury slots are held each day in MySHR or by phone at 213-740-9355. Walk-in is listed only for flu shots at Engemann Plaza. | https://studenthealth.usc.edu/myshr/, https://studenthealth.usc.edu/flu-and-u/ |
| "After hours: call the 24/7 nurse line" (no number given) | Incomplete | The number is **213-740-9355 (WELL)**, 24/7. It reaches a nurse, counselor or confidential advocate. | https://studenthealth.usc.edu/emergencies/ |
| "Student Health Pharmacy" 9:00–17:30, "free condoms", "pickup lockers" | **Wrong / unverified** | **USC Pharmacy, King Hall (KOH) Suite 105, 1025 W 34th St**, open **Mon–Fri 9 AM–6 PM** and closed weekends. The free condoms and lockers have no source. | https://pharmacies.usc.edu/locations/ |

## 9. Services

| Claim | Status | Correct value | Source |
|---|---|---|---|
| "Campus Store (Village)" 9–20, 10–18 weekends | **Wrong** | The **USC Bookstore is at 840 Childs Way** in the campus core. Hours: Mon–Fri 7:45 AM–8 PM, Sat 9–5, Sun 10–5. Closed Nov 26–27. | https://www.uscbookstore.com/usc-store-locations |
| "Mail & Package Center" in the Village, 9–19 | **Fictional** | Residents get packages at their building's **Customer Service Center** (hours vary by CSC). **The Mail Stop** for sending is in the McCarthy Way Structure (PSX), (213) 740-2467. USC Village has a FedEx Office and an Amazon hub with lockers. | https://housing.usc.edu/index.php/csc/, https://families.usc.edu/sending-mail-to-my-trojan/ |
| Career Center 8:30–17:00, "Drop-in resume reviews" | Partly verified | Hours are correct. It is in the **Student Union (STU) 110**, 3601 Trousdale Pkwy, (213) 740-9111. Drop-ins run **1:00–3:30 PM** weekdays, are 10–15 minutes and need a Handshake account. A virtual-line feature has no USC equivalent. | https://careers.usc.edu/front-page/learn-about-the-career-center/ |
| Financial Aid 8:30–17:00 "walk-in with a virtual line" | **Wrong hours** | Walk-in is in the **John Hubbard Hall (JHH) Lobby**, usually **Mon–Fri 9 AM–5 PM**. Phone: (213) 740-4444. No appointments. | https://financialaid.usc.edu/help-contact/ |
| OSAS 8:30–17:00 | Verified (add location) | **GFS 120, 3601 Watt Way**, (213) 740-0776. The Testing Center is in SSL 301. | https://osas.usc.edu/about/contact-location-hours/ |
| ITS Help Desk 8–22 weekdays, 10–18 Sat, 12–20 Sun; "Laptop loans" | **Wrong** | The **ITS Service Desk** answers 24/7 at **(213) 740-5555, option 2**, or consult@usc.edu. Walk-in ITS computing centers (KOH 206, WPH B34, Leavey lower level) are open Mon–Fri 9–9, Sat 9–5, Sun 12–8, and the laptop loaner program runs there. | https://itservices.usc.edu/about/contact/, https://itservices.usc.edu/its-computing-centers/ |
| Restrooms (all 10 entries: hours, all-gender, changing tables, showers) | **Unverified** | No allowed source lists campus restrooms. Only the "gender-neutral restrooms and showers" at the Village Fitness Center are confirmed. | https://recsports.usc.edu/rec-facilities/lyon-center/ |

## 10. Safety

| Claim | Status | Correct value | Source |
|---|---|---|---|
| DPS emergency (213) 740-4321, non-emergency (213) 740-6000 | **Verified** | HSC numbers should be added: (323) 442-1000 and (323) 442-1200. | https://dps.usc.edu/contact/ |
| "DPS Headquarters" placed near PSX/Exposition, "LiveScan" | **Wrong location / unverified** | The **UPC station is at 3667 McClintock Ave, in Parking Structure A (PSA)**. There is also a Village sub-station at 3131 S Hoover St, Suite 1300. LiveScan service has no source. | same |
| Safety Ambassador posts (28th & Ellendale, Menlo & Jefferson, 30th & Severance) and hours 18:00–03:00 | **Unverified** | DPS does not publish post locations or hours. The ambassadors ("Yellow Jackets") are unarmed Allied Universal officers posted near USC housing. | https://dps.usc.edu/safety-tips/getting-around/ |
| Blue light phones (5 invented positions) | **Unverified positions** | There are **nearly 300**, including one on every level of every parking structure. The official map is at web-app.usc.edu (not on the allowlist). | https://dps.usc.edu/services/blue-light-phones/ (live) |
| `TH.DPS_ALERTS` (robbery at 28th & Ellendale, Leavey bike thefts, street-light outage) and `TH.INCIDENTS` | **Fictional** | These are generated demo data. The Safety screen must keep saying so. The DPS Daily Crime & Fire Log was not collected. | — |
| "Trojans Alert" | Name fix | The official name is **TrojansAlert**, one word. Students are enrolled automatically, and others text "TrojansAlert" to 888777. | https://dps.usc.edu/services/trojans-alerts/ |

## 11. Game Day

| Claim | Status | Correct value | Source |
|---|---|---|---|
| Game on Saturday Nov 14 (event seed day 5) | **Wrong date** | The next home game is **Saturday Nov 21, 2026** (vs. Maryland, "Beat the Terrapins"). Kickoff time was not found. | https://hospitality.usc.edu/game-day/ |
| "Student gates open 2 hours before kickoff", "enter from Exposition Park", "Tailgate zones: Exposition Park lawns and McCarthy Quad open at 9 AM" (`screens.js:358,413,414`; event seed) | **Unverified** | These come from USC Athletics (usctrojans.com), which is not on the allowlist. | — |
| Clear bag 12" × 6" × 12" or a small clutch | **Verified** | One clear bag up to 12×6×12 or a one-gallon clear bag, plus one small clutch. The source is USC Commencement, which calls it "similar to the one used at USC Athletics events." | https://commencement.usc.edu/clear-bag-policy/ |
| "Extra DPS patrols on game day… 3 PM to 1 AM" alert | **Fictional** | Verified game-day changes: Lyft starts 5 hours after kickoff, the Weekend ICS does not run, parking costs $50 and is cashless, and a shuttle runs from Grand Ave to Pardee Way. | https://transnet.usc.edu/index.php/gameday/ |

## 12. Daily facts (`TH.FACTS`)

| Fact | Status | Correct value / action | Source |
|---|---|---|---|
| Founded 1880, "oldest private research university in California" | Partly verified | 1880 is confirmed. The "oldest… in California" claim has no source, so remove it. | https://www.usc.edu/we-are-usc/the-university/our-history/ |
| First class: 53 students, 10 teachers | Verified | Keep. | same |
| Tommy Trojan dedicated 1930; duct tape during rivalry week | Partly verified | 1930 is confirmed (unveiled at the 50th jubilee). The duct-tape claim has no source, so drop it. | …/historical-timeline/ |
| Traveler since 1961, "after touchdowns" | Verified (wording) | Official wording is "whenever USC scores." | https://www.usc.edu/usc-traditions/ |
| Tusk 1979 "recorded at Dodger Stadium" | Partly verified | The recording is confirmed and the album went platinum. Dodger Stadium has no source, so drop it. | same |
| "Conquest" from Captain from Castile (1947) | **Unverified** | Drop it. | — |
| Doheny 1932, memorial to Edward L. Doheny Jr. | Verified | It opened Sept 12, 1932. The formal name is the Edward L. Doheny Jr. Memorial Library. | timeline; https://libraries.usc.edu/supporting-usc-libraries |
| Coliseum Olympics 1932, 1984, 2028 | Verified | Keep. | …/olympic-heritage/ |
| Village 2017, Hecuba | Verified | Keep. | https://village.usc.edu/about-hecuba/ |
| Leavey opened 1994, "open around the clock" | **Wrong / unverified** | The year has no source. Leavey is 24 hours Sun 9 AM–Fri midnight and 24/7 only during finals. | libraries.usc.edu/hours |
| Bovard Administration Building named for Marion Bovard | **Unverified** | Marion McKinley Bovard was the first president (1880). The building's namesake has no source. | timeline |
| "More Olympic medals than any other American university" | Verified (reword) | Official wording: "more Olympians and overall medalists than any other university in the United States." | olympic-heritage |

## 13. README and other wording

- README "Live badges… free parking spots", "open library seats", "Engemann walk-in wait": there is no public data behind any of these. Label them as simulated.
- README "Safety Ambassador posts": DPS does not publish post locations.
- README "Before the demo, check… gate names and hours, Lyft program hours and ride limits, shuttle routes, the U-Pass process and the fun facts": all of these are now checked. Use the files in this folder.
- `TH.AREAS.north` "Off-campus housing, the Row and the Shrine": no source was checked for this. It is a map label, so leave it to the map task.
- Events (`TH.EVENT_SEED`): every event is invented. Real events should come from the clubs and events research in `research/clubs/events.json`.
