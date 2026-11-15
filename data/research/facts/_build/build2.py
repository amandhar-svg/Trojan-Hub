#!/usr/bin/env python3
"""transport.json, safety.json, facts_daily.json for Trojan Hub (sources: KB pages collected Nov 9 2026 + live allowed USC pages)."""
import json, os
OUT = '/home/user/trojan-hub/research/facts'
KB = 'kb'; LIVE = 'live (fetched 2026-11-09)'
def src(url, kind=KB, note=None):
    s = {'url': url, 'type': kind}
    if note: s['note'] = note
    return s
BUS = 'https://transnet.usc.edu/index.php/bus-map-schedules/'
LYFT = 'https://transnet.usc.edu/index.php/how-to-use-lyft/'
UPASS = 'https://transnet.usc.edu/index.php/student-u-pass/'

def times(s):  # "7:00 AM|7:40 AM" -> ["07:00","07:40"]
    out = []
    for t in s.split('|'):
        t = t.strip(); hm, ap = t.split(' ')
        h, m = map(int, hm.split(':'))
        if ap == 'PM' and h != 12: h += 12
        if ap == 'AM' and h == 12: h = 0
        out.append(f'{h:02d}:{m:02d}')
    return out

transport = {'_meta': {'generated': '2026-11-09', 'timezone': 'America/Los_Angeles',
    'note': 'USC bus schedules below are the Fall 2026 schedule (began Mon Aug 24, 2026). All USC bus services are closed on university holidays (Nov 11, Nov 26-27, 2026). Live positions: ETA SPOT app or uscbuses.etaspot.net (not on allowlist; not integrated).'}}

transport['funding'] = {'text': 'Mandatory Student Transportation Fee: $151 per semester (Fall 2026, Spring 2027; $146 Summer 2026). Funds the Lyft program, USC buses (including LAX shuttles in some breaks) and the Metro U-Pass. Only waiver: active USC employees by primary Workday classification.',
    'sources': [src('https://arr.usc.edu/tuition-and-fees/'), src('https://transnet.usc.edu/index.php/student-transportation-fee/')], 'verified': True}

transport['lyft'] = {
    'name': 'USC Lyft Rides Program', 'cost_to_student': 'Free if the ride qualifies (fare quote shows FREE; $0.00 receipt)',
    'eligibility': 'Current USC students, faculty and staff',
    'hours': {'UPC': {'days': 'daily', 'start': '19:00', 'end': '02:00'},
              'HSC': {'days': 'Mon-Fri only', 'start': '17:00', 'end': '02:00', 'note': 'includes service to/from Union Station'},
              'game_day_UPC': 'Fall home football game days: starts 5 hours after scheduled kickoff or at normal hours, whichever is later (e.g. Sept 26, 4:30 PM kickoff -> 9:30 PM).',
              'other_changes': 'Hours can change for holidays and periods such as finals week (specific Nov-Dec 2026 changes not posted).'},
    'boundary_UPC': {'east_of': 'Normandie Ave', 'south_of': 'Washington Blvd', 'west_of': 'Main St', 'north_of': 'Martin Luther King Jr. Blvd',
                     'rule': 'Ride must START and END inside the geofence; rides between UPC and HSC are not covered. Geofence polygon itself is not published as data.'},
    'ride_limits': {'per_ride_or_per_month_count': 'NONE PUBLISHED. The program "runs on limited credits that automatically renew every month"; footnote: "Maximum monthly benefit is $1,000." No per-student ride count is stated.',
                    'ride_type': 'Must choose Shared. Not covered: LUX, priority pickups, scheduled rides, added stops, tips, PrimeTime, cancellation fees. Lyft Business users must ride in PERSONAL mode.',
                    'unsafe_cancel': 'Lyft charges $5 to cancel but waives it if you request through in-app support saying you canceled because you felt unsafe.'},
    'how_to_enroll': ['Open the Lyft app Payment section and look for "USC Lyft Rides" ("HSC USC Rides" at HSC)', 'If missing, submit the Lyft Invite form on the USC Transportation Lyft page (invites go out the week before each semester)', 'Do not share the invite; it is single-use', 'Changed phone number: update it in your existing Lyft account, do not create a new one'],
    'pickup_zones_UPC': {'06:00-20:00': ['Parkside Apartments', 'Uytengsu Aquatics Center', 'Kennedy Field', 'Lot L', 'Lot V', 'Lot M', 'TRF Research', 'EVK', 'USC Hotel', 'Watt Way'],
                         '20:00-06:00 (McCarthy/Figueroa)': ['EVK (inside McCarthy Way Entrance)', 'USC Hotel'],
                         'University Village area': ['Cardinal Gardens Apartments (near the Metro stop at McClintock)', 'Hebrew Union College on 32nd Street']},
    'accessibility': "Lyft's WAV Rides program for non-collapsible or motorized wheelchairs.",
    'contact': 'auxtrans@usc.edu',
    'sources': [src(LYFT, LIVE), src('https://transnet.usc.edu/index.php/gameday/'), src('https://dps.usc.edu/2025/11/06/community-safety-advisory-21/')], 'verified': True}

transport['campus_cruiser'] = {'status': 'Suspended (listed by USC Transportation as suspended). The free Lyft program replaces it.', 'sources': [src('https://transnet.usc.edu/')], 'verified': True}

transport['usc_buses'] = [
    {'id': 'ics', 'name': 'Intercampus Shuttle (ICS) UPC - Union Station - HSC', 'days': 'Mon-Fri',
     'stops': ['Jefferson bus turnout (Jefferson Blvd just east of Hoover St)', 'Union Station, Patsaouras Plaza Berth #6', 'HSC: Eastlake Ave just south of Biggy St (does not serve Soto)'],
     'departures_from_UPC': times('7:00 AM|7:40 AM|8:20 AM|9:00 AM|9:30 AM|10:00 AM|10:30 AM|11:00 AM|11:30 AM|12:00 PM|12:30 PM|1:00 PM|1:30 PM|2:00 PM|2:20 PM|2:30 PM|2:50 PM|3:05 PM|3:20 PM|3:45 PM|4:20 PM|4:45 PM|5:10 PM|6:05 PM|6:55 PM|7:35 PM|8:00 PM|8:40 PM|9:20 PM'),
     'departures_from_HSC': times('7:00 AM|7:40 AM|8:20 AM|9:00 AM|9:30 AM|10:00 AM|10:30 AM|11:00 AM|11:30 AM|12:00 PM|12:30 PM|1:00 PM|1:30 PM|2:00 PM|2:45 PM|3:00 PM|4:05 PM|4:15 PM|4:30 PM|5:05 PM|5:30 PM|6:05 PM|6:15 PM|6:55 PM|7:30 PM|8:00 PM|8:40 PM|9:20 PM|10:05 PM'),
     'sources': [src(BUS, LIVE), src('https://transnet.usc.edu/index.php/tramroutes/intercampus-ics-upc-to-hsc/')], 'verified': True},
    {'id': 'upc-us', 'name': 'UPC to Union Station', 'days': 'Mon-Fri', 'span': ['07:00', '22:05'],
     'stops': ['Jefferson bus turnout (just east of Hoover)', 'Union Station Berth #6'],
     'departures': times('7:00 AM|7:40 AM|8:20 AM|9:00 AM|9:30 AM|10:00 AM|10:30 AM|11:00 AM|11:30 AM|12:00 PM|12:30 PM|1:00 PM|1:30 PM|2:00 PM|2:20 PM|2:30 PM|2:50 PM|3:05 PM|3:20 PM|3:45 PM|3:55 PM|4:10 PM|4:20 PM|4:30 PM|4:45 PM|5:00 PM|5:10 PM|5:20 PM|5:30 PM|5:40 PM|6:05 PM|6:55 PM|7:35 PM|8:00 PM|8:40 PM|9:20 PM|10:05 PM'),
     'note': 'Before 3:55 PM and 6:05-9:25 PM all service is the ICS. Useful for Amtrak/Metrolink and the LAX FlyAway ($9.75, not covered by U-Pass).',
     'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'us-upc', 'name': 'Union Station to UPC', 'days': 'Mon-Fri', 'span': ['06:33', '22:15'], 'stops': ['Union Station Berth #6', 'Jefferson bus turnout (Jefferson at Hoover); all UPC stops discharge only'],
     'departures': times('6:33 AM|6:48 AM|7:03 AM|7:12 AM|7:24 AM|7:34 AM|7:41 AM|7:58 AM|8:15 AM|8:26 AM|8:31 AM|8:35 AM|8:42 AM|8:54 AM|9:12 AM|9:26 AM|9:33 AM|9:40 AM|9:48 AM|10:10 AM|10:40 AM|11:10 AM|11:40 AM|12:10 PM|12:40 PM|1:10 PM|1:40 PM|2:10 PM|7:40 PM|8:10 PM|8:50 PM|9:30 PM|10:15 PM'),
     'afternoon_estimated_windows': ['15:06-15:12', '16:14-16:20', '16:36-16:42', '17:26-17:32', '18:11-18:17', '18:21-18:27', '19:01-19:07'],
     'note': 'Page lists "933 AM" which is read here as 9:33 AM.', 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'weekend-ics', 'name': 'Weekend Intercampus Shuttle', 'days': 'Sat-Sun', 'span': ['08:30', '16:40'],
     'not_running': ['USC home football game days (next: 2026-11-21)', '2026-11-28', '2026-11-29', 'Winter break', 'Summer'],
     'trips': ['08:30 UPC-US', '08:45 US-HSC', '09:05 HSC-US', '09:15 US-UPC', '09:55 UPC-US', '10:10 US-HSC', '10:30 HSC-US', '10:40 US-UPC', '12:20 UPC-US', '12:35 US-HSC', '12:55 HSC-US', '13:05 US-UPC', '13:25 UPC-US', '13:40 US-HSC', '14:00 HSC-US', '14:10 US-UPC', '14:50 UPC-US', '15:05 US-HSC', '15:25 HSC-US', '15:35 US-UPC', '15:55 UPC-US', '16:10 US-HSC', '16:30 HSC-US', '16:40 US-UPC'],
     'stops': {'UPC': 'Jefferson bus turnout on Jefferson at Hoover', 'US': 'Union Station', 'HSC': 'Eastlake at Biggy'}, 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'c-route', 'name': 'C Route (north neighborhood loop)', 'days': 'Mon-Fri', 'headway_min': 20, 'span': ['06:30', '19:00'],
     'departures_from_leavey': times('6:30 AM|7:00 AM|7:20 AM|7:40 AM|8:00 AM|8:20 AM|8:40 AM|9:00 AM|9:20 AM|9:40 AM|10:00 AM|10:20 AM|10:40 AM|11:00 AM|11:20 AM|11:40 AM|12:00 PM|12:20 PM|12:40 PM|1:00 PM|1:20 PM|1:40 PM|2:00 PM|2:20 PM|2:30 PM|3:00 PM|3:20 PM|3:40 PM|4:00 PM|4:20 PM|4:40 PM|5:00 PM|5:20 PM|5:40 PM|6:00 PM|6:30 PM|7:00 PM'),
     'stops': ['Leavey Library', 'JEP House', 'Ostrow Dental School', '34th & McClintock', 'University Village', 'University Regents Apts', '28th & Orchard', '29th & Orchard', '2726 Menlo', '2658 Menlo', 'Adams & Menlo', '2632 Ellendale', '2700 Ellendale', '1358 W. 24th', '24th and Ellendale', '24th & Magnolia', '24th Street Theater', '23rd & Portland', '2341 Portland', 'Centennial Apts', 'Sierra Apts', 'Founders Apts', 'Hillview Apts', 'Pacific Apts', '28th & University', 'Troy East'],
     'note': 'Daytime weekday only. There is NO USC evening/overnight neighborhood loop; evening rides are the free Lyft program.', 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'parking-center', 'name': 'Parking Center route', 'days': 'Mon-Fri', 'headway_min': 30, 'span': ['09:00', '15:00'],
     'departures': times('9:00 AM|9:30 AM|10:00 AM|10:30 AM|11:00 AM|11:30 AM|12:00 PM|12:30 PM|1:00 PM|1:30 PM|2:00 PM|2:30 PM|3:00 PM'),
     'stops': ['Grand Structure', 'Carol Little Building (CAL) - North', 'Leavey Library', 'JEP House', 'Ostrow Dental School', '34th & McClintock', 'Michelson (MCB)', 'Vivian Hall', 'Pardee Way Entrance', 'Transit Center', 'Carol Little Building (CAL) - South (drop-only)'],
     'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'cal-us', 'name': 'CAL to Union Station', 'days': 'Mon-Fri', 'departures': times('1:50 PM|2:10 PM|2:20 PM|2:40 PM|2:55 PM|4:00 PM'), 'stops': ['CAL', 'Jefferson bus turnout', 'Union Station'], 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'sct', 'name': 'UPC <-> SC Tower (SCT, Olive St between 11th and 12th, downtown)', 'days': 'Mon-Fri', 'headway_min': 30,
     'from_UPC': {'stop': 'DASH stop on Jefferson (just east of Royal Entrance)', 'span': ['08:00', '17:30']}, 'from_SCT': {'span': ['08:15', '17:45']}, 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'mdr', 'name': 'Marina del Rey shuttle (UPC - ICT Playa Vista - ISI)', 'days': 'Mon-Fri', 'departures_from_UPC_vivian_hall': ['08:05', '10:00', '12:00', '15:40', '17:45'],
     'stops': ['Vivian Hall', 'ICT, 12015 Waterfront Dr, Playa Vista', 'ISI, Mindanao Way just west of Admiralty Way'], 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'hsc-circuit', 'name': 'Circuit Tram (HSC)', 'days': 'Mon-Fri', 'span': ['07:00', '16:40'], 'headway': 'every 30 min 7:00-9:00 AM, every 20 min 9:00 AM-4:40 PM',
     'stops': ['Biggy & Eastlake', 'Keck Hospital', 'Outpatient (OPD)', 'Busway', 'HRA', 'New County Hospital (State Street)'], 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'hsc-soto', 'name': 'Soto Route (HSC, serves Valley Lot)', 'days': 'Mon-Fri', 'span': ['06:40', '18:00'], 'headway_min': 20,
     'stops': ['Soto 1', 'Valley Lot', 'Keck bus turnout (San Pablo)', 'CSC (Alcazar)', 'Soto 2'], 'sources': [src(BUS, LIVE)], 'verified': True},
    {'id': 'gameday-shuttle', 'name': 'Game day shuttle (Grand Ave Structure -> Pardee Way)', 'days': 'Home football game days', 'span': 'Starts 3 hours before kickoff; return trips begin at the start of the 4th quarter',
     'sources': [src('https://transnet.usc.edu/index.php/gameday/')], 'verified': True},
    {'id': 'lax-break', 'name': 'LAX shuttles before academic breaks', 'text': 'Limited, reservation-based shuttles from Widney Alumni House (Fall Break 2026: Oct 7-8, hourly 8 AM-5 PM). Thanksgiving/winter 2026 dates had not been posted as of Nov 9.',
     'sources': [src('https://transnet.usc.edu/index.php/news-announcements/')], 'verified': True},
]
transport['usc_buses_rules'] = {'id': 'Carry your USC ID; drivers may ask to see it.', 'tracking': 'ETA SPOT app', 'holidays': 'No service on university holidays',
    'sources': [src('https://orientation.usc.edu/undergraduate/resources/'), src(BUS, LIVE)], 'verified': True}

transport['metro'] = {
    'stations_near_UPC': [
        {'name': 'Jefferson/USC', 'line': 'E Line'}, {'name': 'Expo Park/USC', 'line': 'E Line'}, {'name': 'Expo/Vermont', 'line': 'E Line'},
        {'name': '37th Street/USC', 'line': 'J Line (bus rapid transit)'}],
    'to_LAX': 'E Line westbound to Expo/Crenshaw, K Line southbound to LAX/Metro Transit Center, then free LAX Metro Connector shuttle (every 10-15 min, 4 AM-1 AM). Or J Line south to Harbor Fwy, then C Line west.',
    'directions_and_headways': {'verified': False,
        'note': 'E Line terminals, train frequency and first/last train times are NOT on any allowed USC page (metro.net is not on the allowlist). The current Trojan Hub labels ("Downtown LA (7th St/Metro)" / "Downtown Santa Monica", every 8/12/20 min) are unverified; since the 2023 Regional Connector the eastbound E Line is generally understood to continue through downtown to East LA (Atlantic) - unverified here, check metro.net.'},
    'sources': [src(UPASS), src('https://transnet.usc.edu/index.php/getting-to-lax/')], 'verified': True}

transport['u_pass'] = {
    'name': 'Metro U-Pass', 'eligibility': 'ALL current USC students (graduate and undergraduate)', 'cost': 'No additional cost (paid by the Transportation Fee)',
    'term': 'Fall 2026 program began Aug 17, 2026 and runs through the beginning of January. Must re-register every semester; keep the same card ("RENEWAL").',
    'valid_on': ['All LA Metro buses and trains (incl. Metro Rapid)', 'LADOT DASH (not Commuter Express)', 'Santa Monica Big Blue Bus', 'Culver City Bus', 'Norwalk Transit', 'Torrance Transit', 'Gardena Transit', 'Long Beach Transit', 'Foothill Transit (except commuter express 490, 493, 495, 498, 499, 699)'],
    'not_valid_on': ['Metrolink', 'Amtrak', 'LAX FlyAway'],
    'card': 'A PHYSICAL card issued by USC is required to begin. Pick up at USC Transportation, McCarthy Structure (Mon-Fri 8:30-3:00) at UPC, or KAM-120 (Mon-Fri 7:30-4:00) at HSC. No phone/mobile wallet version is mentioned.',
    'steps': ['Have a physical USC-issued U-Pass card (pick one up if you do not)', 'Complete the online U-Pass form on USC Transportation\'s U-Pass page', 'Open the LA Metro link in the automatic confirmation email', 'Enter your 20-digit card number and the activation code shown on the page/email, check the acknowledgement box, click Submit', 'Wait 24 hours', 'Tap the card at any Metro station or on a bus within 14 days to lock in the activation (hold until the kiosk beeps)'],
    'common_failure': 'Almost every U-Pass issue comes from not tapping within 14 days to lock in activation.',
    'contact': 'tsubsidy@usc.edu (Rideshare Coordinator)',
    'sources': [src(UPASS, LIVE), src('https://orientation.usc.edu/undergraduate/resources/')], 'verified': True,
    'note': 'The per-semester activation code is printed on the public page; it is intentionally not copied here. Show users the official page instead.'}

transport['metrolink'] = {'text': 'Active students get 50% off Metrolink: download the Metrolink app, register with your school email, choose "Student/Youth" rider type, carry a valid student ID. U-Pass is not valid on Metrolink.',
    'sources': [src('https://transnet.usc.edu/index.php/metrolink-student-pass/')], 'verified': True}

transport['zipcar'] = {
    'program': 'USC partners with Zipcar for self-service car sharing. Students join FREE for the first year, then $35/year ($55 off standard). 24/7 access; discounted hourly rates for USC faculty, staff and students 18+; gas, insurance and maintenance included. Reserve online/by phone, unlock with the phone (Bluetooth), return to the same spot.',
    'locations': None, 'locations_note': 'USC does not list Zipcar pick-up locations on its pages; zipcar.com is not on the allowlist. Current Trojan Hub locations ("Village Structure", "Structure X") and named cars/rates are unverified. USC parking rules confirm marked Zipcar spaces exist ($80 fine for parking in one).',
    'vehicles_and_rates': None,
    'enterprise': 'Enterprise is USC\'s preferred rental provider, with a dedicated link for USC students 21+.',
    'sources': [src('https://transnet.usc.edu/index.php/zipcar/', LIVE), src('https://transnet.usc.edu/index.php/parking-violations/')], 'verified': True, 'locations_verified': False}

transport['bikes'] = {
    'metro_bike_share': {'stations_near_UPC': ['Expo & Vermont', 'Figueroa & McCarthy', 'Jefferson & Figueroa', 'University & Hoover'], 'note': 'At least four stations; discounted student pass available; return to any station (listen for three beeps).'},
    'registration': 'Free DPS registration is required by USC policy if you ride or park a bike on campus (also scooters/skateboards): submit the online form, then pick up the decal at DPS in Parking Structure A (PSA). Questions: (213) 740-5519.',
    'parking': 'Use racks (two locks or a U-lock through frame and rear wheel). USC Village has secure indoor bike parking (built for 1,500+ bikes). USC Transportation publishes an interactive map of racks, repair stations and bike share.',
    'housing_rule': 'E-scooters and hoverboards may not be used or kept in university-owned housing.',
    'nearby_shops': ['3 Brother\'s Bike Shop, 3008 Vermont Ave', "Lux's Bicycle Shop, 1305 W Jefferson Blvd"],
    'sources': [src('https://transnet.usc.edu/index.php/usc-bike-program/'), src('https://dps.usc.edu/services/bikes/'), src('https://safety.usc.edu/tips/mobility-speed/'), src('https://dps.usc.edu/safety-tips/bicycle-scooter-and-skateboard-safety-guide/'), src('https://village.usc.edu/newsroom/')], 'verified': True}

transport['parking'] = {
    'visitor_rates': {'daily': '$20/day (Text2Park +$0.50 one-time fee; Pay-by-Plate no fee), e.g. McCarthy Way Structure',
                      'hourly': '$4/hour at Figueroa and USC Shrine structures and Jefferson Structure (after 12 PM); Text2Park up to 4 h, 5+ h charged $20',
                      'cheapest': 'Grand Ave Structure $2/hour or $14/day', 'game_day': '$50 per home football game (all entrances), plus Text2Park fees; cashless',
                      'free_parking': 'None; USC Transportation FAQ says there is no free parking at USC. Pay-by-Plate/Text2Park areas are enforced 24 h.'},
    'student_permits_per_semester_FY27': [
        {'name': 'UPC Gold', 'price': 612, 'where': 'Downey, Jefferson, Royal, McCarthy, Flower, Figueroa or USC Shrine structures; Lots C, Z, 21, 27, 28, 33, RAN'},
        {'name': 'UPC Cardinal', 'price': 477, 'where': 'Grand Ave. Structure; Lots 29A and 29B'},
        {'name': 'Student Evening', 'price': 306, 'where': 'Valid 5:00 PM - 7:00 AM only; not valid on game days'},
        {'name': 'Motorcycle', 'price': 108},
        {'name': 'UPC Off-Campus Student Housing', 'price': 432, 'note': 'not valid on game days'},
        {'name': 'HSC Gold', 'price': 612, 'where': 'San Pablo, Biggy structures; Lots 70, 71, Eastlake, CSPL, O\'Neal, Soto, Consolidated'},
        {'name': 'HSC Cardinal', 'price': 477, 'where': 'Valley Lot, HRA'},
        {'name': 'HSC Carpool Gold', 'price': 477, 'where': 'Gold locations; separate application'}],
    'permit_notes': 'Rates effective July 1, 2026; include the 10% City of LA Parking Occupancy Tax. Online orders add a $5 transaction fee. Carpool permits: every member has their own registered vehicle and lives 2+ miles away; passengers get 3 free passes a month.',
    'fines': {'no_permit_or_unpaid_T2P': 65, 'unpaid_T2P_game_day': 80, 'zipcar_space': 80, 'village_garage_unpaid': 80, 'red_zone_fire_lane_hydrant': 100, 'improper_display': 25, 'boot': '100 + outstanding'},
    'structures': 'See places.json parking[] for each structure with address and hours.',
    'sources': [src('https://transnet.usc.edu/index.php/parking-rates/'), src('https://transnet.usc.edu/index.php/daily-and-hourly-parking/'), src('https://transnet.usc.edu/index.php/parking-violations/'), src('https://transnet.usc.edu/index.php/gameday/'), src('https://transnet.usc.edu/index.php/student-u-pass/')], 'verified': True}

json.dump(transport, open(os.path.join(OUT, 'transport.json'), 'w'), indent=1, ensure_ascii=False)

# =================================================================== safety
DPSC = 'https://dps.usc.edu/contact/'
safety = {'_meta': {'generated': '2026-11-09'},
 'phones': [
    {'label': 'DPS emergency (UPC and USC Village)', 'number': '(213) 740-4321', 'hours': '24/7/365'},
    {'label': 'DPS non-emergency (UPC and USC Village)', 'number': '(213) 740-6000', 'hours': '24/7'},
    {'label': 'DPS emergency (HSC)', 'number': '(323) 442-1000', 'hours': '24/7'},
    {'label': 'DPS non-emergency (HSC)', 'number': '(323) 442-1200', 'hours': '24/7'},
    {'label': 'DPS USC Village sub-station', 'number': '(213) 821-6677'},
    {'label': 'DPS Lost and Found (UPC)', 'number': '(213) 740-9759', 'email': 'lostandfound@dps.usc.edu'},
    {'label': 'DPS bike registration questions', 'number': '(213) 740-5519'},
    {'label': 'DPS Watch Commanders\' Office', 'number': '(213) 740-5523'},
    {'label': 'Off-campus emergency', 'number': '911'},
    {'label': 'USC Student Health 24/7 (nurse, counselor, confidential advocate)', 'number': '(213) 740-9355 (WELL)'},
    {'label': 'Crisis Text Line', 'number': 'Text TROJAN to 741741'},
    {'label': '988 Suicide & Crisis Lifeline', 'number': '988'},
    {'label': 'USC emergency info line (campus-wide emergencies)', 'number': '(213) 740-9233'},
    {'label': 'Housing Maintenance (24/7)', 'number': '(213) 740-4646'},
    {'label': 'USC Report & Response', 'number': '(213) 740-2500'},
    {'label': 'Office of Civil Rights Compliance (OCRC)', 'number': '(213) 740-5086'},
 ],
 'phones_sources': [src(DPSC), src('https://dps.usc.edu/services/lost-and-found/'), src('https://dps.usc.edu/services/bikes/'), src('https://dps.usc.edu/about-dps/frequently-asked-questions/'),
                    src('https://studenthealth.usc.edu/emergencies/'), src('https://studenthealth.usc.edu/mental-health-and-well-being/'), src('https://safety.usc.edu/resources/emergency-preparedness/'), src('https://housing.usc.edu/index.php/csc/')],
 'dps': {'operates': '24 hours a day, 365 days a year; patrols ~2.5 sq mi around UPC and ~1 sq mi around HSC, including off-campus neighborhoods.',
         'stations': [{'name': 'UPC station', 'address': '3667 McClintock Ave, Los Angeles, CA 90089 (Parking Structure A, PSA)'}, {'name': 'USC Village sub-station', 'address': '3131 South Hoover Street, Suite 1300'}, {'name': 'HSC station', 'address': '2001 Soto Street, Los Angeles, CA 90032'}],
         'community_service_officers': 'Patrol USC Housing facilities from 8 PM until dawn (24 h during semester and spring breaks).',
         'sources': [src(DPSC), src('https://ask.usc.edu/s/article/000002171')], 'verified': True},
 'campus_access': {'rule': 'From 9 PM to 6 AM UPC operates with controlled access: only McCarthy (Figueroa at McCarthy Way) and McClintock (Jefferson at McClintock) gates are open and the campus is closed to unregistered guests. Guests must be pre-registered and show photo ID; event guests bring ID and ticket. During the day campus is open to the public, but officials may ask for USCard/photo ID at any time.',
         'id_check_hours': {'start': '21:00', 'end': '06:00'}, 'guest_registration': 'DPS After Hours Visitor Registration form (visitor.usc.edu)',
         'sources': [src('https://dps.usc.edu/services/visitor-registration/', LIVE), src('https://www.usc.edu/how-to-access-campus/'), src('https://transnet.usc.edu/index.php/about-us/entrance-hours/', LIVE)], 'verified': True},
 'night_rides_and_escorts': {
    'lyft': 'Free USC Lyft Shared rides 7 PM-2 AM daily inside the UPC geofence (HSC 5 PM-2 AM Mon-Fri). See transport.json lyft.',
    'after_lyft_hours': 'From 2 AM to 6 AM DPS may be able to provide an escort within the designated boundaries (call (213) 740-6000).',
    'blue_light_escort': 'Blue light phones can be used to request an escort; USC Safety says "an escort will meet you within minutes."',
    'livesafe_safewalk': 'LiveSafe SafeWalk lets friends or family virtually escort you.',
    'campus_cruiser': 'Suspended.',
    'sources': [src('https://transnet.usc.edu/'), src('https://safety.usc.edu/services/'), src('https://dps.usc.edu/services/blue-light-phones/', LIVE), src('https://transnet.usc.edu/index.php/how-to-use-lyft/', LIVE)], 'verified': True},
 'security_ambassadors': {
    'name': 'Security Ambassadors ("Yellow Jackets")', 'who': 'Unarmed security officers from Allied Universal Security, contracted by USC; bright yellow jackets.',
    'what': 'Posted on street corners in neighborhoods around campus, especially near USC-owned housing; eyes and ears of DPS with a direct line to DPS.',
    'posts_and_hours': None, 'posts_note': 'DPS does not publish post locations or shift hours ("routinely evaluates where Yellow Jackets are posted"). The current Trojan Hub posts and "6 PM-3 AM" hours are unverified.',
    'sources': [src('https://dps.usc.edu/safety-tips/getting-around/'), src('https://dps.usc.edu/contact/report/')], 'verified': True},
 'blue_light_phones': {
    'count': 'nearly 300', 'where': 'Around UPC and HSC, in many buildings, and on each level of every parking structure',
    'how_it_works': 'Connects directly to DPS 24-hour communications center and identifies the phone location even if you cannot speak. Use to request help or an escort, report suspicious activity or a crime. Emergencies only.',
    'locations': None, 'official_maps': ['https://web-app.usc.edu/maps/emergency-phones.pdf', 'https://maps.usc.edu/?id=1928 (Concept3D category linked from the DPS page)'],
    'locations_note': 'Exact coordinates not obtained: the PDF host is not on the allowlist and the OSM Overpass mirror timed out. The map research task may supply them from Concept3D.',
    'sources': [src('https://dps.usc.edu/services/blue-light-phones/', LIVE)], 'verified': True},
 'trojans_alert': {
    'name': 'TrojansAlert', 'what': 'USC emergency notification system: real-time texts and emails from authorized officials with instructions.',
    'students': 'Automatically enrolled; keep contact info current in Experience USC. usc.edu addresses cannot opt out of legally required alerts.',
    'others': 'Parents, alumni, community: text "TrojansAlert" to 888777 (Nixle). List resets every Aug 15; re-subscribe yearly.',
    'other_official_channels': ['emergency.usc.edu', 'Emergency infoline (213) 740-9233', 'twitter.com/USC'],
    'related_alerts': 'Campus safety alerts include TrojansAlerts, Timely Warnings/crime alerts and Community Safety Advisories.',
    'sources': [src('https://dps.usc.edu/services/trojans-alerts/'), src('https://safety.usc.edu/resources/emergency-preparedness/'), src('https://dps.usc.edu/alerts/clery-faqs/')], 'verified': True},
 'livesafe': {
    'name': 'LiveSafe', 'what': 'Free USC safety app managed by DPS and USC Emergency Planning.', 'features': ['One-touch calls to DPS or 911', 'Anonymous messaging (suspicious activity, crimes in progress)', 'SafeWalk virtual escort by friends/family'],
    'setup': ['Download "LiveSafe" from the App Store or Google Play', 'Create a profile', 'Select "University of Southern California"'],
    'sources': [src('https://dps.usc.edu/services/safety-app/'), src('https://safety.usc.edu/resources/livesafe/')], 'verified': True},
 'reporting': {'ways': ['Call DPS 24/7', 'LiveSafe app (incl. anonymous)', 'Blue light phones', 'Campus Security Authorities', 'Crime Stoppers (completely anonymous)'], 'noise_complaints': 'DPS non-emergency (213) 740-6000',
    'sources': [src('https://dps.usc.edu/contact/report/'), src('https://dps.usc.edu/loud-or-unruly-gathering-ordinance/')], 'verified': True},
 'crime_data_for_safety_map': {'status': 'not obtained', 'note': 'The DPS Daily Crime & Fire Log was not collected here. The Trojan Hub safety map uses synthetic incidents and must keep saying so until a real feed is connected.', 'verified': False},
 'game_day': {
    'clear_bag': 'Coliseum and Galen Center: one clear plastic/vinyl/PVC bag up to 12" x 6" x 12" or a one-gallon clear storage bag, plus one small clutch; medically necessary items after inspection. (Stated on the USC Commencement clear-bag page as "similar to the one used at USC Athletics events"; the Athletics page itself is not on the allowlist.)',
    'student_gates_and_tailgate_rules': None, 'student_gates_note': 'Student gate locations, gate-opening times and tailgate zones/times are published by USC Athletics (usctrojans.com), which is not on the allowlist. Current Trojan Hub claims ("student gates open 2 hours before kickoff", "enter from Exposition Park", "tailgates on Exposition Park lawns and McCarthy Quad at 9 AM") are unverified.',
    'next_home_game': '2026-11-21 (vs. Maryland per USC Hospitality "Beat the Terrapins"); kickoff time not found',
    'game_day_changes': ['Lyft starts 5 h after kickoff', 'Weekend ICS does not run', 'Cashless parking, $50; Evening and Off-campus Housing permits not valid', 'Free shuttle Grand Ave Structure -> Pardee Way from 3 h before kickoff', 'Lyon Center 9am-2pm and Village Fitness 1-11pm on Nov 21'],
    'ticket_scams': 'DPS warns of football ticket scams on GroupMe; buy from trusted sources and never share a photo of your USCard.',
    'sources': [src('https://commencement.usc.edu/clear-bag-policy/'), src('https://commencement.usc.edu/faq/'), src('https://transnet.usc.edu/index.php/gameday/'), src('https://hospitality.usc.edu/game-day/'), src('https://recsports.usc.edu/rec-facilities/operating-hours/'), src('https://mycard.usc.edu/'), src('https://dps.usc.edu/2024/09/27/community-safety-advisory-11/')], 'verified': 'partial'},
}
json.dump(safety, open(os.path.join(OUT, 'safety.json'), 'w'), indent=1, ensure_ascii=False)

# =================================================================== facts
HIST = 'https://www.usc.edu/we-are-usc/the-university/our-history/'
TL = HIST + 'historical-timeline/'
OLY = HIST + 'olympic-heritage/'
TRAD = 'https://www.usc.edu/usc-traditions/'
facts = {'_meta': {'generated': '2026-11-09', 'rule': 'Only facts confirmed on an official USC page are in "facts". Original Trojan Hub facts are reviewed in "review".'},
 'review': [
    {'original': 'USC was founded in 1880, which makes it the oldest private research university in California.', 'verdict': 'partly verified',
     'finding': 'Founding year 1880 is confirmed. "Oldest private research university in California" is not stated on any page in the KB; USC Housing only says "one of the oldest private universities in the west".', 'action': 'rewrite', 'sources': [src(HIST), src('https://housing.usc.edu/index.php/conference-video/')]},
    {'original': 'The first USC class had 53 students and 10 teachers.', 'verdict': 'verified', 'finding': 'USC opened its doors to 53 students and 10 teachers in 1880.', 'action': 'keep (reword slightly)', 'sources': [src(HIST)]},
    {'original': 'Tommy Trojan was dedicated in 1930. Students wrap him in duct tape during rivalry week to protect him from paint.', 'verdict': 'partly verified',
     'finding': 'Unveiled in 1930 at USC\'s 50th jubilee: confirmed. The duct-tape rivalry-week tradition is not on any official page in the KB.', 'action': 'keep year, drop duct-tape clause', 'sources': [src(TL)]},
    {'original': 'Traveler, the white horse that gallops around the Coliseum after Trojan touchdowns, has been part of game days since 1961.', 'verdict': 'verified (small fix)',
     'finding': 'First appeared in 1961 (home opener vs. Georgia Tech). Official wording: "whenever USC scores", not only touchdowns.', 'action': 'keep, say "whenever USC scores"', 'sources': [src(TRAD)]},
    {'original': 'The Trojan Marching Band played on Fleetwood Mac’s 1979 single “Tusk,” recorded at Dodger Stadium.', 'verdict': 'partly verified',
     'finding': 'USC says the band recorded the title track of the 1979 album Tusk with Fleetwood Mac and it went platinum. "Recorded at Dodger Stadium" is not on any official page in the KB.', 'action': 'drop Dodger Stadium', 'sources': [src(TRAD)]},
    {'original': 'The fanfare “Conquest” comes from the 1947 film Captain from Castile.', 'verdict': 'unverified',
     'finding': 'USC pages confirm the band plays "Conquest" when USC scores, but none in the KB give its origin.', 'action': 'drop (or replace with the verified Conquest/Traveler fact)', 'sources': [src(TRAD)]},
    {'original': 'Doheny Memorial Library opened in 1932 and was built as a memorial to Edward L. Doheny Jr.', 'verdict': 'verified',
     'finding': 'Doors opened Sept 12, 1932 (timeline). The building is formally the "Edward L. Doheny Jr. Memorial Library" (USC Libraries).', 'action': 'keep', 'sources': [src(TL), src('https://libraries.usc.edu/supporting-usc-libraries')]},
    {'original': 'The LA Memorial Coliseum hosted the Olympic Games in 1932 and 1984, and is scheduled to host again in 2028.', 'verdict': 'verified', 'finding': 'Confirmed by the Olympic Heritage page and the timeline.', 'action': 'keep', 'sources': [src(OLY), src(TL)]},
    {'original': 'USC Village opened in 2017. The bronze statue at its center is Hecuba, queen of Troy.', 'verdict': 'verified', 'finding': 'Opened 2017 (Aug 17); Hecuba unveiled at the grand opening.', 'action': 'keep', 'sources': [src('https://village.usc.edu/'), src('https://village.usc.edu/about-hecuba/')]},
    {'original': 'Leavey Library opened in 1994 and is open around the clock during the semester.', 'verdict': 'wrong / unverified',
     'finding': 'Opening year is not on any page in the KB. Hours are wrong: Leavey is 24 hours Mon-Thu (continuous Sun 9am - Fri midnight), Sat 9am-9pm, and 24/7 only during finals.', 'action': 'replace', 'sources': [src('https://libraries.usc.edu/hours', LIVE), src('https://libraries.usc.edu/locations/leavey-library')]},
    {'original': 'The Bovard Administration Building is named for Marion Bovard, USC’s first president.', 'verdict': 'unverified',
     'finding': 'Marion McKinley Bovard was USC\'s first president (1880): confirmed. Which Bovard the building is named for is not stated in the KB (George F. Bovard was the fourth president).', 'action': 'replace with the verified first-president fact', 'sources': [src(TL)]},
    {'original': 'Trojans have won more Olympic medals than athletes from any other American university.', 'verdict': 'verified (reworded)',
     'finding': 'USC says it "has produced more Olympians and overall medalists than any other university in the United States."', 'action': 'keep with official wording', 'sources': [src(OLY)]},
 ],
 'facts': [
    {'text': 'USC opened in 1880 with 53 students and 10 teachers, when Los Angeles still had no paved streets or electric lights.', 'sources': [src(HIST)]},
    {'text': 'Marion McKinley Bovard became USC’s first president in 1880.', 'sources': [src(TL)]},
    {'text': 'Tommy Trojan was unveiled in 1930, at USC’s 50th jubilee.', 'sources': [src(TL)]},
    {'text': 'Tommy Trojan was sculpted by Roger Noble Burnham, who modeled him on several USC football players.', 'sources': [src(TRAD)]},
    {'text': 'Tommy Trojan’s pedestal lists the ideal Trojan’s qualities: faithful, scholarly, skillful, courageous, ambitious.', 'sources': [src(TRAD)]},
    {'text': 'Traveler first appeared at USC’s 1961 home opener against Georgia Tech. Whenever USC scores, the band plays “Conquest” and Traveler gallops around the Coliseum.', 'sources': [src(TRAD)]},
    {'text': 'Traveler, not Tommy Trojan, is USC’s official mascot.', 'sources': [src('https://admission.usc.edu/prospective-students/live-learn-belong/find-your-people/')]},
    {'text': 'The Traveler statue facing Tommy Trojan in Hahn Plaza was unveiled on May 4, 2010.', 'sources': [src(TRAD)]},
    {'text': 'In 1979 the Trojan Marching Band recorded the title track of Fleetwood Mac’s album Tusk, which went platinum.', 'sources': [src(TRAD)]},
    {'text': 'USC’s motto, Palmam Qui Meruit Ferat (“let whoever earns the palm bear it”), was adopted in 1908.', 'sources': [src(TRAD)]},
    {'text': 'The alma mater “All Hail” was written by Alfred F. Wesson ’24 for a 1923 student show called Campus Frolics.', 'sources': [src(TRAD)]},
    {'text': 'The California poppy, USC’s official flower, joined the university seal in 1908.', 'sources': [src(TRAD)]},
    {'text': 'USC’s teams were called the Cardinals and the Methodists before becoming the Trojans in 1912.', 'sources': [src(TL)]},
    {'text': 'Doheny Memorial Library opened on September 12, 1932. Its full name is the Edward L. Doheny Jr. Memorial Library.', 'sources': [src(TL), src('https://libraries.usc.edu/supporting-usc-libraries')]},
    {'text': 'In 1960 John F. Kennedy spoke from the steps of Doheny Library to a first-time voter convocation.', 'sources': [src(TL)]},
    {'text': 'The Fisher Gallery, opened in 1939, was the first museum in Los Angeles devoted only to fine art.', 'sources': [src(TL)]},
    {'text': 'The LA Memorial Coliseum, across the street from campus, was the center of the 1932 and 1984 Olympics, and the Games return in 2028.', 'sources': [src(OLY), src(TL)]},
    {'text': 'During the 1984 Olympics, the University Park Campus became Los Angeles’ largest Olympic Village.', 'sources': [src(TL)]},
    {'text': 'USC has produced more Olympians and overall medalists than any other university in the United States.', 'sources': [src(OLY)]},
    {'text': 'In 1904 Emil Breitkreutz became the first USC student to compete in the Olympics, winning bronze in the 800 meters.', 'sources': [src(OLY)]},
    {'text': 'Forty-four Trojans competed at the 2016 Rio Olympics, more than from any other American university.', 'sources': [src(TL)]},
    {'text': 'USC Village opened in 2017 on 15 acres. It is the largest development in the history of South Los Angeles.', 'sources': [src('https://village.usc.edu/'), src(TL)]},
    {'text': 'Hecuba, queen of Troy, was unveiled in the USC Village piazza at the Village’s grand opening in fall 2017.', 'sources': [src('https://village.usc.edu/about-hecuba/')]},
    {'text': 'Leavey Library stays open 24 hours from Sunday morning to Friday night during the semester, and around the clock during finals.', 'sources': [src('https://libraries.usc.edu/hours', LIVE)]},
    {'text': 'USC has nearly 300 blue light emergency phones, including one on every level of every parking structure.', 'sources': [src('https://dps.usc.edu/services/blue-light-phones/', LIVE)]},
 ]}
for f in facts['facts']: f['verified'] = True
json.dump(facts, open(os.path.join(OUT, 'facts_daily.json'), 'w'), indent=1, ensure_ascii=False)
print('transport, safety, facts written;', len(facts['facts']), 'facts')
