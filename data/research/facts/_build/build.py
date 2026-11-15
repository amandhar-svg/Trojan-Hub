#!/usr/bin/env python3
"""Builds research/facts/{places,transport,safety,facts_daily}.json for Trojan Hub.
Every value below was read from the USC KB (/home/user/ta-src/kb.json, pages collected Nov 9 2026)
or from a live page on an allowed USC host on Nov 9 2026. Anything not confirmed is marked verified:false.
"""
import json, re, os, datetime

SCR = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/user/trojan-hub/research/facts'
os.makedirs(OUT, exist_ok=True)

DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

def to24(s):
    s = s.strip().lower().replace('.', '')
    if s in ('noon',): return '12:00'
    if s in ('midnight',): return '00:00'
    m = re.match(r'^(\d{1,2})(?::(\d\d))?\s*(am|pm)$', s)
    if not m: raise ValueError(s)
    h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ap == 'am' and h == 12: h = 0
    if ap == 'pm' and h != 12: h += 12
    return f'{h:02d}:{mi:02d}'

def rng(spec):
    """'7:00AM-10:00PM' or '7am-10pm,11am-2pm' or 'closed' or '24h' -> [[open,close],...]
    A close of 00:00 or 12:00AM is written as 24:00 (end of day)."""
    if spec is None: return None
    spec = spec.strip()
    if spec.lower() == 'closed': return []
    if spec.lower() == '24h': return [['00:00', '24:00']]
    out = []
    for part in spec.split(','):
        a, b = re.split(r'\s*[-–]\s*', part.strip())
        o, c = to24(a), to24(b)
        if c == '00:00': c = '24:00'
        out.append([o, c])
    return out

def week(mon=None, tue=None, wed=None, thu=None, fri=None, sat=None, sun=None, wd=None, we=None):
    """Weekly hours. wd fills Mon-Fri, we fills Sat-Sun, explicit days override."""
    d = {}
    for k in DAYS:
        v = locals()[k]
        if v is None: v = wd if k in DAYS[:5] else we
        d[k] = rng(v)
    return d

KB = 'kb'   # source type markers
LIVE = 'live (fetched 2026-11-09)'
def src(url, kind=KB, note=None):
    s = {'url': url, 'type': kind}
    if note: s['note'] = note
    return s

H_HOURS = 'https://hospitality.usc.edu/hours-of-operation/'
H_LOC = 'https://hospitality.usc.edu/dining-locations/'
H_UPC = 'https://hospitality.usc.edu/dining-locations-upc/'
H_MEAL = 'https://hospitality.usc.edu/meal-plan-options/'
H_GAME = 'https://hospitality.usc.edu/game-day/'

DINING_NOTE = ('Regular hours posted for Aug 24 - Dec 4, 2026. USC Hospitality had NOT posted Thanksgiving (Nov 25-29) '
               'or finals-week (Dec 7-16) hours as of Nov 9, 2026; treat those days as unknown and re-check the Hours of Operation page.')

def dining(id_, name, cat, building, address, phone, hours, nov11, oct31=None, features=None, loc_slug=None, extra_src=None, notes=None, campus='UPC'):
    p = {
        'id': id_, 'name': name, 'category': cat, 'campus': campus,
        'building': building, 'address': address, 'phone': phone,
        'hours': {'weekly': hours, 'valid_from': '2026-08-24', 'valid_to': '2026-12-04', 'timezone': 'America/Los_Angeles',
                  'special_dates': {'2026-11-11': {'label': 'Veterans Day holiday', 'ranges': nov11}},
                  'unpublished_periods': ['2026-11-25..2026-11-29 (Thanksgiving)', '2026-12-05..2026-12-16 (study days and finals)'],
                  'note': DINING_NOTE},
        'features': features or [],
        'sources': [src(H_HOURS, LIVE, 'hours verified identical in KB and on the live page'), src(H_LOC + (loc_slug or '') + '/', KB, 'address/phone/description')] + (extra_src or []),
        'verified': True,
    }
    if oct31 is not None:
        p['hours']['past_special_dates'] = {'2026-10-31': {'label': 'Game Day: USC vs. Ohio State', 'ranges': oct31}}
    if notes: p['notes'] = notes
    return p

places = {'_meta': {
    'generated': '2026-11-09', 'timezone': 'America/Los_Angeles',
    'hours_format': 'weekly.{mon..sun} = list of [open, close] 24h "HH:MM"; [] = closed; null = unknown/unverified; close "24:00" = midnight; a range may run past midnight only where stated (e.g. Leavey).',
    'coordinates': 'Not included here. Positions/footprints come from the map research task (OSM / Concept3D). Join on name or address.',
    'university_holidays_fall_2026': {'2026-11-11': 'Veterans Day', '2026-11-25': 'Thanksgiving recess (no classes)', '2026-11-26': 'Thanksgiving', '2026-11-27': 'Thanksgiving'},
    'academic_dates': {'classes_end': '2026-12-04', 'finals': '2026-12-09..2026-12-16', 'source': 'https://arr.usc.edu/registration-calendar/ (via Trojan Assist data.js, verified Nov 9 2026)'},
}}

# ------------------------------------------------------------------ dining halls
places['dining_halls'] = [
    dining('evk', "Everybody's Kitchen (EVK)", 'dining_hall', 'New North Residential College area (EVK)', '635 W. 35th Street, Los Angeles, CA 90089', '(213) 740-0259',
           week(mon='7:00AM-10:00PM', tue='7:00AM-10:00PM', wed='7:00AM-10:00PM', thu='7:00AM-8:00PM', fri='7:00AM-10:00PM', sat='8:30AM-10:00PM', sun='8:30AM-10:00PM'),
           rng('7:00AM-10:00PM'), rng('8:30AM-10:00PM'),
           ['All-you-care-to-eat', 'Meal swipes', 'Made-to-order egg station at breakfast', 'Pizza, grill, salad and deli bar, rotating action station', 'Gluten Awareness Zone'],
           'everybodys-kitchen', notes='Hospitality posts only open/close times; separate breakfast/lunch/dinner periods are not published on the hours page.'),
    dining('parkside', 'Parkside Residential Dining Hall', 'dining_hall', 'Parkside (IRC / Arts & Humanities)', '3771 South McClintock Avenue, Los Angeles, CA 90089', '(213) 821-5859',
           week(wd='7:00AM-10:00PM', sat='8:30AM-8:00PM', sun='8:30AM-10:00PM'),
           rng('7:00AM-10:00PM'), rng('8:30AM-8:00PM'),
           ['All-you-care-to-eat', 'Meal swipes', 'Made-to-order action station (pho, taco, Mongolian bars)', 'Plant-forward options', 'Surprise pop-ups'],
           'parkside-restaurant-grill', notes='Official name is "Parkside Residential Dining Hall" (URL slug still says parkside-restaurant-grill).'),
    dining('villagedh', 'USC Village Dining Hall', 'dining_hall', 'USC Village', '3096 S. McClintock Avenue, Los Angeles, CA 90089', '(213) 764-7925',
           week(mon='7:00AM-10:00PM', tue='7:00AM-10:00PM', wed='7:00AM-10:00PM', thu='7:00AM-10:00PM', fri='7:00AM-8:00PM', sat='8:30AM-10:00PM', sun='11:00AM-10:00PM'),
           rng('7:00AM-10:00PM'), rng('8:30AM-10:00PM'),
           ['All-you-care-to-eat', 'Meal swipes', 'Salad bar and made-to-order deli', 'Rotating themed Expo station', "USC's first fully self-contained vegan station"],
           'usc-village-dining-hall'),
]

# ------------------------------------------------------------------ retail dining / cafes (UPC)
RTCC = 'Ronald Tutor Campus Center (RTCC/TCC)'
RTCC_ADDR = '3607 Trousdale Pkwy, Los Angeles, CA 90089'
CC_SWIPE = 'Campus Center Meal Swipe eligible (Cardinal Plan: 2 per week, 1 per meal period)'
places['retail_dining'] = [
    dining('seeds', 'Seeds Marketplace', 'retail_dining', RTCC, RTCC_ADDR, '(213) 821-3491',
           week(wd='7:00AM-6:00PM', fri='7:00AM-5:00PM', we='9:00AM-3:00PM'), rng('8:00AM-4:00PM'), rng('8:00AM-4:00PM'),
           ['Grab-and-go breakfast burritos, salads, sandwiches, sushi, wraps', CC_SWIPE, 'Catering2Go'], 'seeds-marketplace', [src(H_MEAL)]),
    dining('bowls', 'Bowls', 'retail_dining', RTCC, RTCC_ADDR, None,
           week(wd='11:00AM-7:00PM', fri='11:00AM-5:00PM', we='closed'), [], [],
           ['Rotating scratch-made bowls (Cajun, teriyaki, pasta)', CC_SWIPE], 'new-bowl-concept', [src(H_MEAL)]),
    dining('burgercrush', 'Burger Crush', 'retail_dining', RTCC + ' food court', RTCC_ADDR, '(213) 821-3482',
           week(wd='11:00AM-7:00PM', fri='11:00AM-4:00PM', we='closed'), rng('11:00AM-5:00PM'), [],
           ['Smash burgers, chicken tenders, fries', CC_SWIPE], 'burger-crush', [src(H_MEAL)]),
    dining('tacotaco', 'Taco-Taco', 'retail_dining', RTCC, RTCC_ADDR, '(213) 821-3482',
           week(wd='11:00AM-6:30PM', fri='11:00AM-4:30PM', we='closed'), [], [],
           ['Build-your-own burritos, bowls, tacos', CC_SWIPE, 'Catering2Go'], 'taco-taco', [src(H_MEAL)]),
    dining('slice', 'Slice Shop', 'retail_dining', RTCC, RTCC_ADDR, '(213) 821-3482',
           week(wd='11:00AM-5:00PM', fri='11:00AM-4:00PM', we='closed'), [], [],
           ['Thin-crust pizza, lasagna, salads', CC_SWIPE], 'slice-shop', [src(H_MEAL)]),
    dining('cgjuice', 'C&G Juice Co.', 'retail_dining', RTCC + ' food court', RTCC_ADDR, '(213) 821-3482',
           week(wd='10:00AM-6:00PM', we='closed'), rng('11:00AM-4:00PM'), [],
           ['Juices, smoothies, protein blends, acai bowls', CC_SWIPE], 'cg-juice-co', [src(H_MEAL)]),
    dining('panda', 'Panda Express (UPC)', 'retail_dining', RTCC, RTCC_ADDR, '(213) 821-3481',
           week(wd='10:30AM-6:00PM', fri='10:30AM-5:00PM', we='closed'), [], rng('10:30AM-4:00PM'),
           ['Chinese-American quick service', 'Catering2Go'], 'panda-express'),
    dining('upstairs', 'The Upstairs', 'retail_dining', RTCC + ', 2nd floor', RTCC_ADDR, '(213) 821-3482',
           week(mon='11:00AM-7:00PM', tue='11:00AM-7:00PM', wed='11:00AM-7:00PM', thu='11:00AM-11:00PM', fri='11:00AM-5:00PM', we='closed'), [], [],
           ['Poke and ramen (meal swipe eligible)', 'Sharetea boba', 'The Coffee Bean & Tea Leaf', 'Late night Thursdays'], 'theupstairs'),
    dining('trojangrounds', 'Trojan Grounds featuring illy', 'cafe', 'Birnkrant Residential College (BSR), next to Leavey Library', '642 West 34th St, Los Angeles, CA 90089', '(213) 740-7848',
           week(wd='6:30AM-12:00AM', we='8:00AM-6:00PM'), rng('8:00AM-5:00PM'), rng('8:00AM-6:00PM'),
           ['illy espresso, lattes, matcha, teas', 'Grab-and-go food and pastries', 'Meal swipes for select grab-and-go items', CC_SWIPE, '$0.10 off with a clean reusable mug', 'Open until midnight Mon-Fri'],
           'trojan-grounds-featuring-illy', [src(H_UPC), src('https://housing.usc.edu/index.php/buildings/birnkrant-residential-college/', KB, 'Birnkrant "is home to the popular Trojan Grounds coffeehouse"'), src(H_MEAL)]),
    dining('literatea', 'Literatea', 'cafe', 'Doheny Memorial Library (DML)', '3550 Trousdale Pkwy, Los Angeles, CA 90089', '(213) 821-4261',
           week(wd='8:00AM-3:00PM', fri='8:00AM-1:30PM', we='closed'), [], [],
           ['Equator Coffee and loose-leaf teas', 'Toasted cheese melts, sandwiches, soups', '$0.10 off with a reusable mug'], 'literatea'),
    dining('popovich', 'Popovich Café', 'cafe', 'Popovich Hall (JKP)', '630 Childs Way, Los Angeles, CA 90089', '(213) 821-1166',
           week(wd='7:30AM-5:30PM', fri='7:30AM-2:00PM', we='closed'), [], [],
           ['Equator coffee, espresso and matcha', 'Breakfast sandwiches and burritos', 'Acai smoothies'], 'popovich-cafe'),
    dining('cafeannenberg', 'Café Annenberg', 'cafe', 'Wallis Annenberg Hall (ANN)', '3630 Watt Way, Los Angeles, CA 90089', '(213) 740-9743',
           week(wd='7:30AM-6:30PM', fri='7:30AM-3:00PM', we='closed'), rng('8:00AM-3:00PM'), [],
           ['illy coffee', 'Italian-style sandwiches and salads'], 'cafe-annenberg'),
    dining('coffeebean_sca', 'Coffee Bean & Tea Leaf (SCA)', 'cafe', 'School of Cinematic Arts (SCA)', '900 W 34th St, Los Angeles, CA 90089', '(213) 821-0044',
           week(wd='7:00AM-6:00PM', fri='7:00AM-5:00PM', we='closed'), rng('7:00AM-3:00PM'), [],
           ['Coffee, tea, blended drinks, pastries'], 'coffee-bean-tea-leaf'),
    dining('tutorhall', 'Tutor Hall Café', 'cafe', 'Ronald Tutor Hall (RTH)', '3710 McClintock Ave, Los Angeles, CA 90089', '(213) 740-2365',
           week(wd='8:00AM-4:00PM', fri='8:00AM-3:00PM', we='closed'), [], [],
           ['Monsoon Kitchen Indian bowls', 'Sandwich and salad bar', 'Pastries'], 'tutor-hall-cafe'),
    dining('lawcafe', 'Law School Cafe', 'cafe', 'Gould School of Law', '699 W Exposition Blvd, Los Angeles, CA 90089', '(213) 740-4632',
           week(wd='8:00AM-3:30PM', fri='8:00AM-2:00PM', we='closed'), rng('8:00AM-1:00PM'), [],
           ['Salmon rice bowl', 'Indoor and shaded outdoor seating'], 'law-school-cafe'),
    dining('chadtons', 'Chad Tons Family Cafe', 'cafe', 'Fertitta Hall (JFF)', '610 Childs Way, Los Angeles, CA 90089', '(213) 821-8894',
           week(mon='11:00AM-6:00PM', tue='11:00AM-6:00PM', wed='11:00AM-6:00PM', thu='11:00AM-6:00PM', fri='closed', we='closed'), [], [],
           ['Asian-inspired: bao, banh mi, sushi, dumplings, rice and noodle bowls'], 'chad-tons-family-cafe'),
]
places['restaurants'] = [
    dining('thelab', 'The Lab', 'restaurant', 'University Gardens', '3500 S. Figueroa St., Los Angeles, CA 90007', '(213) 740-5956',
           week(mon='closed', tue='3:00PM-10:00PM', wed='3:00PM-10:00PM', thu='3:00PM-10:00PM', fri='3:00PM-10:00PM', sat='3:00PM-10:00PM', sun='closed'),
           rng('3:00PM-10:00PM'), rng('12:00PM-10:00PM'),
           ['Gastropub', 'Under-21 guests welcome (not at the bar top)', 'Credit cards except Discover; Dining Dollars not listed', '$2/hr validated parking at Figueroa structure'], 'the-lab'),
    dining('rossooros', "Rosso Oro's Pizzeria", 'restaurant', 'USC Hotel', '3500 South Figueroa St, Los Angeles, CA 90007', '(213) 743-2077',
           week(wd='11:00AM-7:00PM', we='11:00AM-7:00PM'), rng('11:00AM-7:00PM'), rng('11:00AM-7:00PM'),
           ['Thin-crust pizza', 'Delivers to campus area and The Row', 'Dining Dollars NOT accepted'], 'rosso-oros'),
    dining('mckays', "McKay's", 'restaurant', 'USC Hotel', '3540 South Figueroa St., Los Angeles, CA 90007', '(213) 743-4111',
           week(wd='6:00AM-11:00AM', we='6:00AM-11:00AM'), rng('6:00AM-11:00AM'), rng('6:00AM-11:00AM,12:30PM-4:30PM'),
           ['Breakfast', 'Game day buffet'], 'mckays'),
    dining('uclub', 'Amy King Dundon-Berchtold University Club', 'restaurant', 'University Club', '705 W. 34th St., Los Angeles, CA 90089', '(213) 740-2030',
           week(wd='11:00AM-8:00PM', we='closed'), rng('11:00AM-2:30PM'), rng('12:30PM-4:30PM'),
           ['Members-only club and restaurant'], 'university-club'),
    dining('moretonfig', 'MoretonFig (Special & Private Events Venue)', 'event_venue', RTCC, RTCC_ADDR, '(213) 740-5956',
           week(wd='closed', we='closed'), [], rng('12:30PM-4:30PM'),
           ['Open only for special university events and private bookings', 'Game day menu with reservations'], 'moreton-fig-cafe-serving-equator-coffees', [src(H_GAME)],
           notes='Not a regular restaurant: closed every regular day; opens for game days/events. Building per the Game Day page ("Moreton Fig (Ronald Tutor Campus Center)").'),
]
places['dining_game_day_2026_11_21'] = {
    'date': '2026-11-21', 'label': 'Home football game ("Beat the Terrapins")',
    'venues': [
        {'name': 'Moreton Fig (RTCC)', 'hours': [['12:30', '16:30']], 'note': 'game day menu, reservations online'},
        {'name': "McKay's (USC Hotel)", 'hours': [['06:00', '16:30']]},
        {'name': 'USC Hotel Breezeway', 'hours': [['11:00', '16:00']], 'note': 'games and activations'},
        {'name': 'The Lab', 'hours': [['12:00', '22:00']]},
        {'name': 'University Club of USC', 'hours': [['12:30', '16:30']]},
        {'name': "Rosso Oro's Pizzeria", 'hours': [['11:00', '19:00']]},
    ],
    'other_venues': 'Game Day page refers to the Hours of Operation page for cafes; those had not posted Nov 21 hours as of Nov 9.',
    'sources': [src(H_GAME)], 'verified': True,
}
places['usc_village_retail_note'] = {
    'text': ('USC Village (Jefferson Blvd between Hoover St and McClintock Ave) has Trader Joe\'s, Target, a FedEx Office Mail Center '
             '(929 W Jefferson Blvd Suite 1670), an Amazon hub with lockers, and other restaurants. Of the Village restaurants, USCard discretionary '
             'is accepted at City Tacos and Rock & Reilly\'s. Store hours for these private tenants were NOT found on allowed hosts.'),
    'sources': [src('https://village.usc.edu/about/facts/'), src('https://mycard.usc.edu/accepted-locations/'), src('https://libanswers.usc.edu/faq/21435'), src('https://families.usc.edu/sending-mail-to-my-trojan/')],
    'verified': True, 'hours_verified': False,
}

# ------------------------------------------------------------------ libraries (live day-by-day table)
lib = json.load(open(os.path.join(SCR, 'lib_hours_parsed.json')))
MON = {m: i for i, m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 1)}
def libday(label):
    _, mon, dd = label.split()
    y = 2026 if MON[mon] >= 8 else 2027
    return f'{y}-{MON[mon]:02d}-{int(dd):02d}'
def libparse(txt):
    t = txt.strip().lower()
    if t == 'closed': return {'ranges': []}
    if t == '24 hours': return {'ranges': [['00:00', '24:00']]}
    if t in ('online', 'by appointment', 'schedule pending'): return {'ranges': None, 'text': txt}
    if t == 'closes at midnight': return {'ranges': [['00:00', '24:00']], 'text': 'open from previous day; closes at midnight'}
    m = re.match(r'^(.+?) to 24 hours$', t)
    if m: return {'ranges': [[to24(m.group(1)), '24:00']], 'text': f'opens {m.group(1)}, then open overnight'}
    a, b = t.split(' to ')
    o, c = to24(a), to24(b)
    if c == '00:00': c = '24:00'
    return {'ranges': [[o, c]]}

LIB_META = {
    'Leavey Library': dict(id='leavey', building='Leavey Library (LVL)', address='651 W. 35th St., Los Angeles, CA 90089', phone='(213) 740-4350',
        features=['24 hours Mon-Thu (continuous Sun 9am - Fri midnight) during fall/spring', 'Continuous 24 hours during finals (Dec 5 8am - Dec 16 8pm)',
                  'Photo ID required to enter at all times', 'After 9 PM and before 7 AM: USC students/faculty/staff only, physical USCard required',
                  'Computing and printing help 24 hours on 1st and 2nd floors', 'ITS Ahmanson Information Commons (lower level)',
                  'Study pods (2nd/3rd floor lobbies) reservable up to 7 days ahead at libcal, max 2 h/person/day', 'Windows laptops lent 24 h at Circulation',
                  'Free cable locks lent at 1st-floor circulation desk', 'Services stop 15 minutes before closing'],
        extra=[src('https://libraries.usc.edu/locations/leavey-library'), src('https://libanswers.usc.edu/faq/21402'), src('https://libanswers.usc.edu/faq/21367'), src('https://dps.usc.edu/services/laptops/')]),
    'Doheny Memorial Library': dict(id='doheny', building='Doheny Memorial Library (DML)', address='3550 Trousdale Pkwy, Los Angeles, CA 90089', phone='(213) 740-2924',
        features=['Houses East Asian Library, Cinematic Arts and Music libraries (ground floor) and Special Collections (2nd floor)', 'Literatea cafe inside',
                  'Laptop outlets in LA Times Reference Room, Faculty Hall, East Asian Library', 'Extended to 9am-10pm Dec 7-10 and Dec 14-15 for finals'],
        extra=[src('https://libraries.usc.edu/locations/doheny-memorial-library'), src('https://libanswers.usc.edu/faq/21402')]),
    'Science and Engineering Library': dict(id='sel', building='Seaver Science Library (SSL) 201', address='910 Bloom Walk, Los Angeles, CA 90089', phone='(213) 740-8507',
        features=['PC laptops for in-library use (due at closing)', 'OSAS Testing Center is in SSL 301 (same building)'],
        extra=[src('https://libraries.usc.edu/locations/doheny-memorial-library'), src('https://libanswers.usc.edu/faq/21367')]),
    'Library for International and Public Affairs': dict(id='lipa', building='Von KleinSmid Center (VKC) - building per data.js; NOT confirmed on an allowed page', address=None, phone=None,
        features=[], extra=[], building_verified=False),
    'Norris Medical Library': dict(id='norris', building='Norris Medical Library (NML), Health Sciences Campus', address='2003 Zonal Ave., Los Angeles, CA 90033', phone='(323) 442-1116',
        features=['Six group study rooms, book 1 day ahead, held 15 minutes'], extra=[src('https://libraries.usc.edu/locations/norris-medical-library')], campus='HSC'),
}
places['libraries'] = []
for libname, days in lib.items():
    meta = LIB_META.get(libname, {})
    daily = {}
    for lab, txt in days.items():
        d = libparse(txt); d['text'] = d.get('text', txt); daily[libday(lab)] = d
    # derive a "typical week" from the week of Nov 9-15 (no holidays except Nov 11, which matches regular hours in this table)
    typical = {}
    for lab, txt in days.items():
        dt = libday(lab)
        if '2026-11-09' <= dt <= '2026-11-15':
            wd = DAYS[datetime.date.fromisoformat(dt).weekday()]
            typical[wd] = libparse(txt)['ranges']
    entry = {'id': meta.get('id', re.sub(r'[^a-z]+', '-', libname.lower()).strip('-')), 'name': libname, 'category': 'library',
             'campus': meta.get('campus', 'UPC'), 'building': meta.get('building'), 'address': meta.get('address'), 'phone': meta.get('phone'),
             'hours': {'typical_week_fall_2026': typical, 'daily': daily, 'daily_range': '2026-11-09..2027-01-18', 'timezone': 'America/Los_Angeles',
                       'note': 'Day-by-day hours copied from the live libraries.usc.edu/hours table. Leavey "24 Hours" days chain together, so it is open continuously Sun 9am through Fri midnight.'},
             'features': meta.get('features', []),
             'sources': [src('https://libraries.usc.edu/hours', LIVE, 'day-by-day hours table')] + meta.get('extra', []),
             'verified': True}
    if meta.get('building_verified') is False:
        entry['building_verified'] = False
    places['libraries'].append(entry)

# ------------------------------------------------------------------ study spaces (beyond libraries)
places['study_spaces'] = [
    {'id': 'its-labs', 'name': 'ITS computing centers (KOH 206, WPH B34, Leavey Ahmanson Information Commons)', 'category': 'study',
     'hours': {'weekly': week(wd='9am-9pm', sat='9am-5pm', sun='12pm-8pm')},
     'features': ['Collaborative study space, first-come first-served', 'Wireless printing', 'Borrowable adapters and mice', 'Laptop loaner program (enrolled students)', 'Mac software in KOH labs; Windows in WPH B36/B38'],
     'phone': '(213) 821-6601', 'sources': [src('https://itservices.usc.edu/its-computing-centers/')], 'verified': True},
    {'id': 'tcc-lounge', 'name': 'TCC 3rd Floor Lounge (from current Trojan Hub data)', 'category': 'study', 'hours': None,
     'sources': [], 'verified': False, 'note': 'Trojan Event Services has a "Studying at TCC/Building Hours" page but its contents were not in the KB and trojanevents.usc.edu is not on the allowlist. Hours unknown.'},
]

# ------------------------------------------------------------------ recreation
REC = 'https://recsports.usc.edu/rec-facilities/operating-hours/'
REC_TG = 'https://recsports.usc.edu/facility-updates/modified-facility-hours-11-24-11-29/'
REC_WB = 'https://recsports.usc.edu/facility-updates/modified-facility-hours-12-6-1-10/'
def span(a, b, val):
    d0, d1 = datetime.date.fromisoformat(a), datetime.date.fromisoformat(b)
    out = {}
    while d0 <= d1:
        out[d0.isoformat()] = val; d0 += datetime.timedelta(days=1)
    return out
lyon_sp = {'2026-11-21': rng('9:00am-2:00pm')}
lyon_sp.update({'2026-11-24': rng('6am-10pm'), '2026-11-25': rng('9am-4pm'), '2026-11-26': [], '2026-11-27': [], '2026-11-28': [], '2026-11-29': rng('10am-11:30pm')})
lyon_sp.update({'2026-12-06': rng('9am-7pm')}); lyon_sp.update(span('2026-12-07', '2026-12-11', rng('6am-10pm')))
lyon_sp.update(span('2026-12-12', '2026-12-13', rng('9am-7pm'))); lyon_sp.update(span('2026-12-14', '2026-12-18', rng('6am-7pm')))
lyon_sp.update(span('2026-12-19', '2026-12-20', rng('9am-7pm'))); lyon_sp.update(span('2026-12-21', '2026-12-24', rng('6am-7pm')))
lyon_sp.update(span('2026-12-25', '2026-12-27', [])); lyon_sp.update(span('2026-12-28', '2026-12-29', rng('6am-7pm')))
lyon_sp.update(span('2026-12-30', '2027-01-01', [])); lyon_sp.update(span('2027-01-02', '2027-01-03', rng('9am-7pm')))
lyon_sp.update(span('2027-01-04', '2027-01-08', rng('6am-7pm'))); lyon_sp.update({'2027-01-09': rng('9am-7pm'), '2027-01-10': rng('9am-11:30pm'), '2027-01-18': rng('9am-11pm')})
vfc_sp = {'2026-11-21': rng('1pm-11pm'), '2026-11-24': rng('1pm-6pm')}
vfc_sp.update(span('2026-11-25', '2026-11-28', [])); vfc_sp['2026-11-29'] = rng('2pm-11pm')
vfc_sp.update(span('2026-12-09', '2026-12-11', rng('1pm-11pm'))); vfc_sp.update(span('2026-12-12', '2026-12-13', rng('11am-8pm')))
vfc_sp.update(span('2026-12-14', '2026-12-18', rng('1pm-11pm'))); vfc_sp.update(span('2026-12-19', '2027-01-03', []))
vfc_sp.update(span('2027-01-04', '2027-01-08', rng('1pm-11pm'))); vfc_sp.update(span('2027-01-09', '2027-01-10', rng('11am-10pm'))); vfc_sp['2027-01-18'] = rng('1pm-11pm')
hsc_sp = {'2026-11-24': rng('6am-8:30pm'), '2026-11-25': rng('6am-1pm')}
hsc_sp.update(span('2026-11-26', '2026-11-29', [])); hsc_sp.update(span('2026-12-25', '2026-12-27', []))
hsc_sp.update(span('2026-12-28', '2026-12-29', rng('6am-8:30pm'))); hsc_sp.update(span('2026-12-30', '2027-01-01', [])); hsc_sp['2027-01-18'] = rng('6am-1pm')

places['recreation'] = [
    {'id': 'lyon', 'name': 'Lyon Center', 'category': 'recreation', 'campus': 'UPC', 'address': '1026 W. 34th Street, Los Angeles, CA 90089-2500', 'phone': '(213) 740-5127',
     'hours': {'weekly': week(mon='6:00am-11:30pm', tue='6:00am-11:30pm', wed='6:00am-11:30pm', thu='6:00am-11:30pm', fri='6:00am-10:00pm', sat='9:00am-7:00pm', sun='9:00am-11:30pm'),
               'special_dates': lyon_sp, 'note': 'Exterior lights shut off 30 minutes before closing. Spaces shared with Athletics/PE can close for practice/competition.'},
     'features': ['Cardio and strength floor', 'Main Gym with three multipurpose courts', 'Racquetball court (book 2 days ahead)', 'Robinson Room studio', 'Cross-training room', 'F45 studio',
                  'Recovery Room ($20/session, $100 for 5)', 'Locker rooms', 'Pro Shop (equipment checkout)'],
     'open_rec_courts': {
         'basketball_courts_A_B': week(mon='6:00am-11:15pm', tue='6:00am-11:15pm', wed='6:00am-11:15pm', thu='6:00am-11:15pm', fri='6:00am-9:45pm', sat='9:00am-6:45pm', sun='9:00am-11:15pm'),
         'court_C_pickleball': week(mon='11am-2pm', tue='11am-2pm', wed='11am-2pm', thu='11am-2pm', fri='12pm-2pm', sat='4pm-7pm', sun='closed'),
         'court_C_badminton': week(mon='2pm-5pm', tue='closed', wed='2pm-7pm', thu='5pm-11:15pm', fri='5:30pm-8:30pm', sat='9am-12pm', sun='closed'),
         'court_C_volleyball': week(mon='closed', tue='2pm-5pm', wed='7pm-11:15pm', thu='2pm-5pm', fri='2pm-5pm', sat='12pm-4pm', sun='closed'),
         'note': 'First-come, first-served; users set up and take down Court C equipment. Not reservable time slots.'},
     'access': 'Active Rec Sports membership; enrolled students get complimentary access.',
     'sources': [src(REC, LIVE), src(REC_TG, LIVE), src(REC_WB, LIVE), src('https://recsports.usc.edu/rec-facilities/lyon-center/'), src('https://recsports.usc.edu/programs-and-classes/recovery-room/')], 'verified': True},
    {'id': 'vfit', 'name': 'USC Village Fitness Center', 'category': 'recreation', 'campus': 'UPC', 'building': 'Cale and Irani (USC Village)',
     'address': '929 W. Jefferson Blvd, Ste 1665, Los Angeles, CA 90089 (page lists ZIP 90087)', 'phone': '(213) 740-0233',
     'hours': {'weekly': week(wd='8:00am-11:00pm', we='11:00am-11:00pm'), 'special_dates': vfc_sp},
     'features': ['30,000 sq ft', 'Three studios (multipurpose, cycling, aerial/boxing)', 'Weight room with Hammer Strength racks', 'Cardio machines', 'Gender-neutral restrooms and showers', 'Village Turf outside'],
     'sources': [src(REC, LIVE), src(REC_TG, LIVE), src(REC_WB, LIVE), src('https://recsports.usc.edu/rec-facilities/lyon-center/'), src('https://village.usc.edu/about/facts/')], 'verified': True},
    {'id': 'uac', 'name': 'Uytengsu Aquatics Center (Rec Swim)', 'category': 'recreation', 'campus': 'UPC', 'address': 'Next to the Lyon Center, 1026 W. 34th St.',
     'hours': {'weekly': None,
               'week_of_2026_11_08': {
                   'competition_pool': {'2026-11-08': rng('11am-2pm'), '2026-11-09': rng('12pm-2pm'), '2026-11-10': rng('12pm-2pm'), '2026-11-11': rng('12pm-2pm'),
                                        '2026-11-12': rng('12pm-2pm'), '2026-11-13': rng('12pm-2pm'), '2026-11-14': rng('12pm-2pm'), '2026-11-15': rng('11am-2pm')},
                   'dive_pool': {'2026-11-08': [], '2026-11-09': rng('6am-8am,11am-12pm,4pm-6pm'), '2026-11-10': rng('6am-8am,11am-12pm,4pm-6pm'), '2026-11-11': rng('6am-8am,11am-12pm,4pm-6pm'),
                                 '2026-11-12': rng('6am-8am,4pm-6pm'), '2026-11-13': rng('6am-8am,4pm-6pm'), '2026-11-14': [], '2026-11-15': []}},
               'note': 'Rec Swim is posted week by week (updated 10/18/26) and changes around home meets (dive meets Nov 12-14). No standing weekly schedule exists.'},
     'features': ['Competition pool: 8 lanes, 50 yards, ~78-80F', 'Dive pool: 25 yards, 17-ft deep end, ~83-85F', 'Lifeguards may give a swim test (50 m non-stop)', 'Lap lanes first-come, first-served'],
     'sources': [src(REC, LIVE), src('https://recsports.usc.edu/rec-facilities/uytengsu-aquatics-center/')], 'verified': True},
    {'id': 'hscfit', 'name': 'HSC Fitness Center', 'category': 'recreation', 'campus': 'HSC', 'building': 'Soto St. Building (SSB)', 'address': '1845 N. Soto Street, Los Angeles, CA 90032', 'phone': '(323) 442-7210',
     'hours': {'weekly': week(wd='6:00am-8:30pm', we='10:00am-2:00pm'), 'special_dates': hsc_sp},
     'features': ['10,000 sq ft', 'Cardio and strength', 'Group exercise rooms', 'Lighted outdoor basketball court'],
     'sources': [src(REC, LIVE), src(REC_TG, LIVE), src(REC_WB, LIVE)], 'verified': True},
]

# ------------------------------------------------------------------ health
SH = 'https://studenthealth.usc.edu/hours/'
places['health'] = [
    {'id': 'engemann', 'name': 'Engemann Student Health Center', 'category': 'health', 'campus': 'UPC', 'address': '1031 West 34th Street, Los Angeles, CA 90089', 'phone': '(213) 740-9355 (WELL), answers 24/7',
     'hours': {'weekly': None,
               'typical_closing_times_fall_spring': {'mon': '19:00', 'tue': '19:00', 'wed': '19:00', 'thu': '19:00', 'fri': '17:00', 'sat': '13:00 (half day)', 'sun': 'not listed'},
               'opening_time': 'NOT PUBLISHED on the Student Health hours page (it lists only closing times for UPC)',
               'note': 'USC says hours may change; check MySHR for open appointments or call 213-740-9355. Thanksgiving/finals hours not found.'},
     'services': ['Primary care (illness/injury, chronic conditions, screenings, sexual and reproductive health, travel immunizations)', 'Counseling and Mental Health (CMH)',
                  'Same-day and next-day illness/injury appointments held each day (book in MySHR or by phone)', 'Telehealth (medical: Mon-Thu 7am-7pm, Fri 9am-5pm, Sat-Sun 8:30am-5pm)',
                  'Flu shots: walk-in at Engemann Plaza or by appointment', 'Physical therapy (Engemann 4th floor)', 'Psychiatry and Behavioral Health Services (insurance-based, Engemann 5th floor)',
                  'RSVP/CARE-SC confidential advocates', 'After hours: 213-740-9355 reaches a nurse, counselor or advocate 24/7'],
     'booking': 'MySHR (usc.edu/myshr). Arriving 10+ minutes late cancels the appointment. No general walk-in queue is described (walk-in is listed only for flu shots).',
     'sources': [src(SH), src('https://studenthealth.usc.edu/myshr/'), src('https://studenthealth.usc.edu/emergencies/'), src('https://studenthealth.usc.edu/flu-and-u/'),
                 src('https://studenthealth.usc.edu/partner-in-health-usc-physical-therapy/'), src('https://sites.usc.edu/counselingandmentalhealth/services/care-coordination/')],
     'verified': True, 'hours_verified': 'partial (closing times only)'},
    {'id': 'pharmacy', 'name': 'USC Pharmacy (UPC)', 'category': 'health', 'campus': 'UPC', 'building': 'King Hall (KOH), Suite 105', 'address': '1025 West 34th Street, Suite 105, Los Angeles, CA 90089', 'phone': '(213) 821-6100',
     'hours': {'weekly': week(wd='9am-6pm', we='closed'), 'valid_from': '2026-08-31', 'note': 'Fall semester hours; holiday hours vary.'},
     'services': ['Prescriptions (refills ready ~30 min after request)', 'Transfers from home pharmacies', 'Accepts USCard discretionary'],
     'sources': [src('https://pharmacies.usc.edu/locations/'), src('https://pharmacies.usc.edu/prescriptions/'), src('https://mycard.usc.edu/accepted-locations/')], 'verified': True},
    {'id': 'ericcohen', 'name': 'Eric Cohen Student Health Center (HSC)', 'category': 'health', 'campus': 'HSC', 'address': '1510 San Pablo Street, Suite 104 (HC1), Los Angeles, CA 90033', 'phone': '(213) 740-9355',
     'hours': {'weekly': None, 'typical': 'Mon & Tue open early at 7 AM; Thu closes late at 7 PM; Wed & Fri 9 AM-5 PM (fall/spring)'},
     'sources': [src(SH)], 'verified': True, 'hours_verified': 'partial'},
    {'id': 'hscpharmacy', 'name': 'USC Medical Plaza Pharmacy (HSC)', 'category': 'health', 'campus': 'HSC', 'address': '1510 San Pablo St. #144, Los Angeles, CA 90033', 'phone': '(323) 442-5770',
     'hours': {'weekly': week(wd='8:30am-6pm', sat='9am-12pm,12:40pm-3pm', sun='closed')}, 'sources': [src('https://pharmacies.usc.edu/locations/')], 'verified': True},
]

# ------------------------------------------------------------------ services
places['services'] = [
    {'id': 'bookstore', 'name': 'USC Bookstore (UPC)', 'category': 'service', 'address': '840 Childs Way, Los Angeles, CA 90089', 'phone': '(800) 447-8620',
     'hours': {'weekly': week(wd='7:45am-8:00pm', sat='9:00am-5:00pm', sun='10:00am-5:00pm'),
               'special_dates': {'2026-11-11': rng('8am-6pm'), '2026-11-20': rng('7:45am-9pm'), '2026-11-21': None, '2026-11-25': rng('8am-6pm'), '2026-11-26': [], '2026-11-27': []},
               'note': 'Nov 21 (game day) hours "to be announced". Call to verify.'},
     'features': ['Textbooks (Follett)', 'Trojan gear', 'CAMPUSCONNECT tech store and repair desk, 3rd level, Mon-Fri 8:00am-4:30pm, (213) 740-7692'],
     'sources': [src('https://www.uscbookstore.com/usc-store-locations'), src('https://software.usc.edu/free-to-campus/')], 'verified': True,
     'note': 'It is on Childs Way in the campus core, not in USC Village.'},
    {'id': 'career', 'name': 'USC Career Center', 'category': 'service', 'building': 'Student Union (STU) 110 and B1', 'address': '3601 Trousdale Parkway, Los Angeles, CA 90089', 'phone': '(213) 740-9111',
     'hours': {'weekly': week(wd='8:30am-5:00pm', we='closed')},
     'drop_in': {'what': 'Resume/cover letter critiques and quick questions, 10-15 min, first-come first-served; Handshake account required', 'where': 'STU 110', 'weekly': week(wd='1:00pm-3:30pm', we='closed'), 'season': 'fall and spring'},
     'appointments': '30-minute advising appointments booked in Handshake (phone, Zoom or in person). Resume critiques are drop-in only. Limit one advising contact per day.',
     'features': ['Iris Photo Booth headshots, walk-in Mon-Fri 9am-4pm', 'Spring 2027 Career Fair: Thu Feb 4, 2027, 11am-3pm, Trousdale Parkway'],
     'sources': [src('https://careers.usc.edu/front-page/learn-about-the-career-center/'), src('https://careers.usc.edu/channels/appointments'), src('https://careers.usc.edu/iris/'), src('https://careers.usc.edu/employers-spring-career-fair/')], 'verified': True},
    {'id': 'finaid', 'name': 'Financial Aid Office', 'category': 'service', 'building': 'John Hubbard Hall (JHH) Lobby', 'address': '700 Childs Way, Los Angeles, CA 90089-0914', 'phone': '(213) 740-4444',
     'hours': {'weekly': week(wd='9:00am-5:00pm', we='closed'), 'note': 'Phone Mon-Fri 9-5 PT; in-person advising is walk-in only, usually Mon-Fri 9-5. Scheduled in-person appointments are not offered.'},
     'contact': 'Email only through the askUSC "Email Us" form. HSC office: 1975 Zonal Ave., Building KAM.',
     'sources': [src('https://financialaid.usc.edu/help-contact/'), src('https://ask.usc.edu/s/article/000001461')], 'verified': True},
    {'id': 'osas', 'name': 'Office of Student Accessibility Services (OSAS)', 'category': 'service', 'building': 'Grace Ford Salvatori Hall (GFS) 120', 'address': '3601 Watt Way, Los Angeles, CA 90089', 'phone': '(213) 740-0776',
     'email': 'OSASFrontDesk@usc.edu', 'hours': {'weekly': week(wd='8:30am-5:00pm', we='closed')},
     'related': {'name': 'OSAS Testing Center', 'building': 'Seaver Science Library (SSL) 301, 910 Bloom Walk', 'phone': '(213) 821-9620', 'office_hours': 'Mon-Fri 8:30am-5pm', 'exam_proctoring': 'Mon-Fri 9am-5pm; 8am-6pm during finals'},
     'sources': [src('https://osas.usc.edu/about/contact-location-hours/')], 'verified': True},
    {'id': 'its', 'name': 'ITS Service Desk (Customer Support Center)', 'category': 'service', 'phone': '(213) 740-5555, option 2 (Brightspace: option 1)', 'email': 'consult@usc.edu',
     'hours': {'weekly': week(wd='24h', we='24h'), 'note': 'Phone/online support 24 hours a day, 365 days a year. Walk-in help: see ITS computing centers (study_spaces).'},
     'sources': [src('https://itservices.usc.edu/about/contact/'), src('https://itservices.usc.edu/its-computing-centers/')], 'verified': True},
    {'id': 'mailstop', 'name': 'The Mail Stop (send mail and packages)', 'category': 'service', 'building': 'McCarthy Way Parking Structure (PSX)', 'address': '620 McCarthy Way, Los Angeles, CA 90089', 'phone': '(213) 740-2467',
     'hours': None, 'features': ['Accepts USCard discretionary'],
     'sources': [src('https://housing.usc.edu/index.php/publication/resident-information-for-2026-2027/'), src('https://mycard.usc.edu/accepted-locations/')], 'verified': True, 'hours_verified': False},
    {'id': 'packages', 'name': 'Package pickup for USC Housing residents', 'category': 'service',
     'text': 'Residents receive packages at their residence hall address; each building\'s Customer Service Center (CSC) handles packages. There is no single campus "Mail & Package Center" in the sources.',
     'csc_hours': {
         'New North / Pardee / Arts & Humanities / IRC at Parkside': 'Mon-Fri 8am-8pm, Sat 12-4pm, closed Sun',
         'McCarthy Honors': 'Mon-Fri 8:30am-7pm, Sat 10am-2pm (also serves all USC Village buildings 5-7pm weekdays)',
         'Cale and Irani; Cowlings and Ilium': 'Mon-Fri 8:30am-5pm, Sat 10am-2pm',
         'Cardinal Gardens / Century / Sierra / Troy': 'Mon-Fri 10am-6pm, Sat 10am-2pm'},
     'also': 'USC Village has an Amazon hub with lockers (free same-day pickup, free returns of most orders).',
     'sources': [src('https://housing.usc.edu/index.php/csc/'), src('https://families.usc.edu/sending-mail-to-my-trojan/')], 'verified': True},
    {'id': 'housing', 'name': 'USC Housing Services Office', 'category': 'service', 'building': 'McCarthy Way Parking Structure (PSX) 137', 'address': '620 McCarthy Way, Los Angeles, CA 90089', 'phone': '(213) 740-2546',
     'hours': {'weekly': week(wd='8:30am-5:00pm', we='closed')}, 'features': ['Housing Maintenance 24/7: (213) 740-4646'],
     'sources': [src('https://housing.usc.edu/index.php/csc/')], 'verified': True},
    {'id': 'transportation_office', 'name': 'USC Transportation office', 'category': 'service', 'building': 'McCarthy Way Parking Structure', 'address': '620 McCarthy Way, Los Angeles, CA 90089', 'phone': '(213) 740-3575',
     'hours': {'u_pass_card_pickup': week(wd='8:30am-3:00pm', we='closed')}, 'email': 'auxtrans@usc.edu',
     'sources': [src('https://transnet.usc.edu/index.php/student-u-pass/', LIVE), src('https://transnet.usc.edu/index.php/contact-us/')], 'verified': True},
    {'id': 'lostfound', 'name': 'DPS Lost and Found', 'category': 'service', 'phone': '(213) 740-9759', 'email': 'lostandfound@dps.usc.edu', 'address': '3667 McClintock Ave (DPS station, Parking Structure A)',
     'sources': [src('https://dps.usc.edu/services/lost-and-found/')], 'verified': True},
]

# ------------------------------------------------------------------ gates / campus access
TE = 'https://transnet.usc.edu/index.php/about-us/entrance-hours/'
def gate(id_, name, addr, wk, we_, hol, staffed, phone, how, extra=None):
    g = {'id': id_, 'name': name, 'type': 'vehicle_entrance', 'address': addr, 'phone': phone, 'enter_from': how,
         'hours': {'weekly': week(wd=wk, we=we_), 'holidays': rng(hol) if hol not in (None,) else None}, 'staffed': staffed,
         'sources': [src(TE, LIVE)], 'verified': True}
    if extra: g.update(extra)
    return g
places['campus_access'] = {
    'policy': {
        'daytime': 'University Park Campus is open to the public but is private property. Government photo ID is not required to enter, but university officials may ask for a USCard or photo ID at any time.',
        'after_9pm': 'From 9 PM to 6 AM UPC operates with controlled access: only two gates, McCarthy and McClintock, are open, and the campus is closed to unregistered guests. Guests must be pre-registered (DPS visitor registration form / visitor.usc.edu), check in with security, and show photo ID; event guests bring ID and ticket.',
        'id_check_window': {'start': '21:00', 'end': '06:00', 'where': ['McCarthy Way entrance', 'McClintock Ave entrance']},
        'prohibited': ['Camping or structures for sleeping', 'Events/demonstrations without an approved UEPA', 'Amplified sound without Trojan Event Services approval', 'Unauthorized postings', 'Sticks, rods or other dangerous items'],
        'sources': [src('https://dps.usc.edu/services/visitor-registration/', LIVE), src('https://www.usc.edu/how-to-access-campus/')], 'verified': True},
    'vehicle_entrances': [
        gate('g-mccarthy', 'McCarthy Way Entrance', '620 W McCarthy Way, Los Angeles CA 90089', '24h', '24h', '24h', '24 hours', '(213) 740-5584', 'Figueroa St at McCarthy Way', {'after_hours_pedestrian_gate': True}),
        gate('g-mcclintock', 'McClintock Ave. Entrance', '3425 McClintock Ave, Los Angeles CA 90089', '24h', '24h', '24h', '24 hours', '(213) 740-5468', 'Jefferson Blvd at McClintock Ave', {'after_hours_pedestrian_gate': True}),
        gate('g-watt', 'Watt Way Entrance', '3780 Watt Way, Los Angeles CA 90089', '6am-8pm', 'closed', 'closed', 'weekdays 6am-8pm', '(213) 740-5581', 'Exposition Blvd and Watt Way (east of Vermont Ave)'),
        gate('g-pardee', 'Pardee Way Entrance', '3572 Pardee Way, Los Angeles CA 90089', '6am-8pm', 'closed', 'closed', 'weekdays 6am-8pm', '(213) 740-5567', 'Exposition Blvd (west of Figueroa St); reservation-only lot'),
        gate('g-royal', 'Royal Street Entrance', '700 W Jefferson Blvd, Los Angeles CA 90089', '6am-8pm', 'closed', 'closed', 'weekdays 6am-8pm', '(213) 740-5589', 'Jefferson Blvd at Royal St (east of Hoover St)'),
        gate('g-downey', 'Downey Way Entrance', '1042 W 36th Pl, Los Angeles CA 90089', '6am-8pm', 'closed', 'closed', 'weekdays 6am-8pm', '(213) 740-5477', 'Vermont Ave at 36th Pl'),
        gate('g-jefferson', 'Jefferson Blvd. Entrance', '1198 W Jefferson Blvd, Los Angeles CA 90089', '6am-8pm', '7:00am-3:30pm', 'closed', 'weekdays 6am-8pm, weekends 7am-3:30pm', '(213) 740-5484', 'Jefferson Blvd (east of Vermont Ave)'),
    ],
    'pedestrian_access_points_known': {
        'names': ['McCarthy Way entrance', 'McClintock Ave entrance', 'Watt Way and Jefferson (north end of Watt Way)', 'Downey Way and Vermont Ave', 'Exposition Blvd and Trousdale Parkway', 'Jefferson Blvd and Trousdale Parkway'],
        'interior_points': ['Watt Way and 34th Street', 'McClintock Ave and Childs Way', '34th Street and Trousdale Parkway'],
        'hours': 'Daytime hours for individual pedestrian gates are NOT published on allowed pages. Only the rule "after 9 PM only McCarthy and McClintock are open" is verified.',
        'sources': [src('https://dps.usc.edu/2024/05/07/usc-faculty-and-staff-access-and-visitor-registration-guidelines-for-university-park-campus-upc/', KB, '2024 commencement access plan; proves these access points exist, not their regular hours'),
                    src('https://dps.usc.edu/services/visitor-registration/', LIVE)],
        'verified': 'partial'},
    'hsc_structures': [
        {'name': 'Biggy Structure (P8)', 'address': '1334 Biggy St, Los Angeles CA 90033', 'hours': {'weekdays': '6am-8pm (staffed 7am-3pm)', 'weekends': '7am-3pm', 'holidays': '7am-3pm'}, 'phone': '(323) 442-1208', 'sources': [src(TE, LIVE)], 'verified': True},
        {'name': 'San Pablo Structure (P1)', 'address': '2201 Trojan Way, Los Angeles, CA 90033', 'hours': {'weekdays': '6am-8pm', 'weekends': '7am-3pm', 'holidays': '7am-3pm'}, 'phone': '(323) 442-1785', 'sources': [src(TE, LIVE)], 'verified': True},
    ],
}

# ------------------------------------------------------------------ parking structures (UPC)
places['parking'] = [
    {'id': 'p-mccarthy', 'name': 'McCarthy Way Parking Structure (PSX)', 'address': '620 McCarthy Way, Los Angeles, CA 90089', 'access': 'Via McCarthy Way Entrance (24/7, staffed)',
     'public_parking': '$20/day (Text2Park adds one-time $0.50; Pay-by-Plate station in NW corner charges no fee)', 'permits': ['UPC Gold'],
     'also_houses': ['USC Transportation office', 'USC Housing Services (PSX 137)', 'The Mail Stop'],
     'sources': [src('https://transnet.usc.edu/index.php/contact-us/'), src('https://transnet.usc.edu/index.php/daily-and-hourly-parking/'), src('https://transnet.usc.edu/index.php/parking-rates/')], 'verified': True},
    {'id': 'p-figueroa', 'name': 'Figueroa St. Structure', 'address': '3520 S Figueroa St, Los Angeles CA 90007', 'phone': '(213) 740-5373',
     'hours': 'Weekdays 6am-8pm staffed (24 h with USC ID at entrances); weekends/holidays 24 h USC ID access only', 'public_parking': '$4/hour (up to 4 h on Text2Park; 5+ h = $20 daily)', 'permits': ['UPC Gold'],
     'sources': [src(TE, LIVE), src('https://transnet.usc.edu/index.php/daily-and-hourly-parking/')], 'verified': True},
    {'id': 'p-shrine', 'name': 'USC Shrine Structure', 'address': '686 W 32nd St, Los Angeles CA 90007 (alt. entrance, USCard required: 645 W Jefferson Blvd)', 'phone': '(213) 740-1925',
     'hours': 'Weekdays 6am-6pm; after hours/weekends/holidays 24 h with USC ID at the Jefferson entrance', 'public_parking': '$4/hour', 'permits': ['UPC Gold', 'USC Village residents park here by permit'],
     'sources': [src(TE, LIVE), src('https://transnet.usc.edu/index.php/daily-and-hourly-parking/'), src('https://village.usc.edu/about/facts/')], 'verified': True},
    {'id': 'p-grand', 'name': 'Grand Ave. Structure (formerly USC Parking Center / UPX)', 'address': '357 W 35th St, Los Angeles CA 90007 (corner of Jefferson Blvd and Grand Ave)', 'phone': '(213) 821-1073',
     'hours': 'Weekdays 6am-6pm; after hours/weekends/holidays 24 h USC ID access only', 'public_parking': 'Cheapest: $2/hour or $14/day', 'permits': ['UPC Cardinal ($477/semester)'],
     'shuttle': 'Parking Center bus route, every 30 min 9am-3pm weekdays; game-day shuttle to Pardee Way',
     'sources': [src(TE, LIVE), src('https://transnet.usc.edu/index.php/daily-and-hourly-parking/'), src('https://commencement.usc.edu/faq/')], 'verified': True},
    {'id': 'p-flower', 'name': 'Flower St. Structure', 'address': '3701 Flower St, Los Angeles CA 90007', 'hours': '24 h, USC ID access only (USCard required)', 'public_parking': 'No general public parking (game days included)', 'permits': ['UPC Gold'],
     'sources': [src(TE, LIVE), src('https://transnet.usc.edu/index.php/gameday/')], 'verified': True},
    {'id': 'p-jefferson', 'name': 'Jefferson Structure', 'address': None, 'public_parking': '$4/hour after 12 PM', 'permits': ['UPC Gold'], 'sources': [src('https://transnet.usc.edu/index.php/daily-and-hourly-parking/'), src('https://transnet.usc.edu/index.php/parking-rates/')], 'verified': True, 'address_verified': False},
    {'id': 'p-downey', 'name': 'Downey Structure', 'address': None, 'access': 'Downey Way Entrance (Vermont at 36th Pl) per entrance list; not confirmed which entrance serves the structure', 'permits': ['UPC Gold'], 'sources': [src('https://transnet.usc.edu/index.php/parking-rates/')], 'verified': True, 'address_verified': False},
    {'id': 'p-royal', 'name': 'Royal Street Structure', 'address': None, 'permits': ['UPC Gold'], 'sources': [src('https://transnet.usc.edu/index.php/parking-rates/')], 'verified': True, 'address_verified': False},
    {'id': 'p-psa', 'name': 'Parking Structure A (PSA)', 'address': '3667 McClintock Ave, Los Angeles, CA 90089', 'note': 'Houses the DPS UPC station. Public parking rates not found.', 'sources': [src('https://dps.usc.edu/contact/')], 'verified': True},
    {'id': 'p-village', 'name': 'USC Village underground garage', 'address': 'Navigate to 3215 South Hoover Street', 'public_parking': 'Hourly; validated parking available for shoppers. Unpaid/unvalidated parking is an $80 violation. "First 30 minutes free" is NOT stated in any source.',
     'sources': [src('https://village.usc.edu/map-and-directions/'), src('https://transnet.usc.edu/index.php/parking-violations/')], 'verified': True},
]

# ------------------------------------------------------------------ transit stops (summary; details in transport.json)
places['transit_stops'] = [
    {'id': 'stop-jeff-turnout', 'name': 'Jefferson bus turnout (Jefferson Blvd just east of Hoover St)', 'serves': ['Intercampus Shuttle (ICS) UPC-Union Station-HSC', 'UPC to Union Station', 'Weekend Intercampus Shuttle'], 'sources': [src('https://transnet.usc.edu/index.php/bus-map-schedules/', LIVE)], 'verified': True},
    {'id': 'stop-dash-royal', 'name': 'DASH stop on Jefferson Blvd (just east of Royal Entrance)', 'serves': ['UPC to SC Tower', 'SC Tower to UPC'], 'sources': [src('https://transnet.usc.edu/index.php/bus-map-schedules/', LIVE)], 'verified': True},
    {'id': 'stop-leavey', 'name': 'Leavey Library bus stop', 'serves': ['C Route (start)', 'Parking Center route'], 'sources': [src('https://transnet.usc.edu/index.php/bus-map-schedules/', LIVE)], 'verified': True},
    {'id': 'stop-vivian', 'name': 'Vivian Hall bus stop', 'serves': ['Marina del Rey shuttle', 'Parking Center route'], 'sources': [src('https://transnet.usc.edu/index.php/bus-map-schedules/', LIVE)], 'verified': True},
    {'id': 'st-jeffusc', 'name': 'Jefferson/USC Station (Metro E Line)', 'sources': [src('https://transnet.usc.edu/index.php/student-u-pass/'), src('https://transnet.usc.edu/index.php/getting-to-lax/')], 'verified': True},
    {'id': 'st-expopark', 'name': 'Expo Park/USC Station (Metro E Line)', 'sources': [src('https://transnet.usc.edu/index.php/student-u-pass/')], 'verified': True},
    {'id': 'st-expoverm', 'name': 'Expo/Vermont Station (Metro E Line)', 'sources': [src('https://transnet.usc.edu/index.php/student-u-pass/')], 'verified': True},
    {'id': 'st-37th', 'name': '37th Street/USC (Metro J Line bus station)', 'sources': [src('https://transnet.usc.edu/index.php/getting-to-lax/')], 'verified': True},
    {'id': 'bike-share', 'name': 'Metro Bike Share stations', 'stations': ['Expo & Vermont', 'Figueroa & McCarthy', 'Jefferson & Figueroa', 'University & Hoover'], 'sources': [src('https://transnet.usc.edu/index.php/usc-bike-program/')], 'verified': True},
]

# ------------------------------------------------------------------ safety locations
places['safety'] = [
    {'id': 'dps-upc', 'name': 'DPS University Park station', 'building': 'Parking Structure A (PSA)', 'address': '3667 McClintock Ave, Los Angeles, CA 90089', 'phone': 'Emergency (213) 740-4321; non-emergency (213) 740-6000',
     'hours': {'weekly': week(wd='24h', we='24h')}, 'services': ['Report a crime', 'Lost and found', 'Bike/scooter/skateboard registration decals', 'CCTV video requests ($150)', 'Safe exchange spot for online sales'],
     'sources': [src('https://dps.usc.edu/contact/'), src('https://dps.usc.edu/services/bikes/'), src('https://dps.usc.edu/services/cctv-video-request/'), src('https://dps.usc.edu/2025/02/27/community-safety-advisory-16/')], 'verified': True},
    {'id': 'dps-village', 'name': 'DPS USC Village sub-station', 'address': '3131 South Hoover Street, Suite 1300, Los Angeles, CA 90089', 'phone': '(213) 821-6677', 'sources': [src('https://dps.usc.edu/contact/')], 'verified': True},
    {'id': 'dps-hsc', 'name': 'DPS Health Sciences station', 'address': '2001 Soto Street, Los Angeles, CA 90032', 'phone': 'Emergency (323) 442-1000; non-emergency (323) 442-1200', 'sources': [src('https://dps.usc.edu/contact/')], 'verified': True},
    {'id': 'bluelights', 'name': 'Blue light emergency phones', 'count': 'nearly 300 across UPC and HSC, in many buildings and on each level of every parking structure',
     'locations': None, 'official_map': 'https://web-app.usc.edu/maps/emergency-phones.pdf (printable) and maps.usc.edu/?id=1928 (interactive); neither host is on the allowlist for this task',
     'sources': [src('https://dps.usc.edu/services/blue-light-phones/', LIVE)], 'verified': True, 'locations_verified': False},
]

# ------------------------------------------------------------------ landmarks (fact-checked descriptions only)
places['landmarks'] = [
    {'id': 'tommy', 'name': 'Tommy Trojan (Trojan Shrine)', 'facts': ['Unveiled in 1930 at USC\'s 50th jubilee', 'Sculpted by Roger Noble Burnham, modeled after several USC football players', 'Pedestal reads "FAITHFUL, SCHOLARLY, SKILLFUL, COURAGEOUS, AMBITIOUS"', 'Stands on Trousdale Parkway in Hahn Central Plaza, across from the Traveler statue'],
     'sources': [src('https://www.usc.edu/we-are-usc/the-university/our-history/historical-timeline/'), src('https://www.usc.edu/usc-traditions/'), src('https://admission.usc.edu/prospective-students/live-learn-belong/find-your-people/')], 'verified': True},
    {'id': 'traveler-statue', 'name': 'Traveler statue (Hahn Plaza)', 'facts': ['Unveiled May 4, 2010; gift of Steven and Kathryn Sample'], 'sources': [src('https://www.usc.edu/usc-traditions/')], 'verified': True},
    {'id': 'hecuba', 'name': 'Hecuba statue (USC Village piazza)', 'facts': ['Unveiled by President Nikias at the USC Village grand opening in fall 2017'], 'sources': [src('https://village.usc.edu/about-hecuba/')], 'verified': True},
    {'id': 'coliseum', 'name': 'Los Angeles Memorial Coliseum', 'facts': ['Center of the 1932 and 1984 Olympic Games', 'Olympics return to LA and the Coliseum in 2028', 'Next USC home football game: Sat Nov 21, 2026 (vs. Maryland, "Beat the Terrapins"); kickoff time not found'],
     'sources': [src('https://www.usc.edu/we-are-usc/the-university/our-history/olympic-heritage/'), src('https://www.usc.edu/we-are-usc/the-university/our-history/historical-timeline/'), src(H_GAME)], 'verified': True},
    {'id': 'galen', 'name': 'Galen Center', 'address': '3400 S Figueroa St, Los Angeles, CA 90089', 'facts': ['Clear bag policy: one clear bag up to 12" x 6" x 12"; metal detectors at entry'], 'sources': [src('https://viterbiundergrad.usc.edu/commencement/')], 'verified': True},
]

json.dump(places, open(os.path.join(OUT, 'places.json'), 'w'), indent=1, ensure_ascii=False)
print('places.json written')
