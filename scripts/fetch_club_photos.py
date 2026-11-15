#!/usr/bin/env python3
"""Collect REAL public club images from EngageSC and write js/club-photos.js.

Sources (public, no login, no keys):
  * Club logos: the `logo` path of each club in js/clubs-data.js (engage.usc.edu/upload/usc/...,
    which redirects to static-prod-us-east-1.campusgroups.com).
  * Club photos: event cover photos / flyers that the club itself posted on EngageSC, taken from the
    public events RSS feed (https://engage.usc.edu/rss_events, fields eventPhotoFullUrl / eventFlyerFullUrl).
    EngageSC's per-club page API (mobile_club_layout / mobile_club_about) returns 401 without a sign-in,
    so club "about" galleries are NOT used.

Filtering: images that EngageSC uses for more than one group (e.g. its default "permits and reservations"
event picture) are dropped, and so are byte-identical images shared by several clubs (default logos).

Politeness: one request at a time, ~0.35 s between requests, a disk cache ($PHOTO_CACHE or ~/.cache/trojan-hub-club-photos; re-runs do
not re-download), and a hard cap on total downloads.

Output: js/club-photos.js →
  TH.CLUB_PHOTOS = { "<clubId>": [{src:"data:image/webp;base64,…", kind:"logo"|"photo", from:"<source url>"}] }
  TH.CLUB_PHOTOS_META = {asOf, source, counts…}
Images are resized with Pillow (photos fit inside 480 x 480 at their own aspect ratio, never cropped; logos 128 px
square) and stored as WebP (about 11 KB per photo, under 25 KB). The whole file is kept under BUDGET bytes.
Coverage is limited by what clubs post publicly: real photos exist only for clubs that put an image on a public
EngageSC event; everything else shows its EngageSC logo or a generated graphic (labelled as a graphic in the app).

Usage: python3 scripts/fetch_club_photos.py [--budget 4000000] [--max-downloads 900]
"""
import base64, hashlib, io, json, os, re, subprocess, sys, time, urllib.parse, urllib.request, html, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('PHOTO_CACHE') or os.path.expanduser('~/.cache/trojan-hub-club-photos')
OUT = os.path.join(ROOT, 'js', 'club-photos.js')
RSS = 'https://engage.usc.edu/rss_events'
UA = 'TrojanHubPrototype/1.0 (student project; low-volume image fetch)'
DELAY = 0.35

args = sys.argv[1:]
def opt(name, default):
    if name in args:
        return type(default)(args[args.index(name) + 1])
    return default
BUDGET = opt('--budget', 3_950_000)
MAX_DL = opt('--max-downloads', 900)
PHOTOS_PER_CLUB = 3

try:
    from PIL import Image
except ImportError:
    sys.exit('needs Pillow: pip install pillow')

downloads = 0
def fetch(url, binary=True):
    """GET with a disk cache. Returns bytes or None."""
    global downloads
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(key):
        data = open(key, 'rb').read()
        return data or None
    if downloads >= MAX_DL:
        return None
    downloads += 1
    time.sleep(DELAY)
    try:
        req = urllib.request.Request(urllib.parse.quote(url, safe=':/?&=%#+,;@'), headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=25) as r:
            if r.status != 200:
                data = b''
            else:
                data = r.read(6_000_000)
    except Exception as e:  # noqa: BLE001 - record the miss, keep going
        print('  miss', url, e)
        data = b''
    open(key, 'wb').write(data)
    return data or None

def load_data():
    js = r"""
      global.window = global; require(process.argv[1]);
      const now = new Date('2026-11-09T08:00:00-08:00');
      const up = {}; (TH.CLUB_EVENTS||[]).forEach(e => { if (new Date(e.end||e.start) >= now) up[e.orgId] = (up[e.orgId]||0)+1; });
      process.stdout.write(JSON.stringify(TH.CLUBS.map(c => ({id:c.id, name:c.name, logo:c.logo, registered:c.registered, up: up[c.id]||0}))));
    """
    out = subprocess.run(['node', '-e', js, os.path.join(ROOT, 'js', 'clubs-data.js')], capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def to_webp(data, kind):
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception:  # noqa: BLE001 - not an image (PDF flyer, HTML error page…)
        return None
    if getattr(im, 'n_frames', 1) > 1:
        im.seek(0)
    im = im.convert('RGBA')
    w, h = im.size
    if w < 48 or h < 48:
        return None
    if kind == 'logo':
        # pad to a square on white so transparent logos read on both themes
        side = max(w, h)
        bg = Image.new('RGBA', (side, side), (255, 255, 255, 255))
        bg.paste(im, ((side - w) // 2, (side - h) // 2), im)
        im = bg.convert('RGB').resize((128, 128), Image.LANCZOS)
        q = 62
    else:
        if w < 200:
            return None
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.paste(im, (0, 0), im); im = bg.convert('RGB')
        # keep the source aspect ratio and never crop: fit inside 480 x 480 (EngageSC event covers are 1280 x 427,
        # i.e. 480 x 160 here; a tall flyer becomes at most 480 px tall). The club sheet shows photos whole
        # (object-fit: contain over a blurred copy) and opens them full screen on tap, so nothing is cut off.
        scale = min(480 / w, 480 / h, 1.0)
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        q = 55
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def ahash(data_uri):
    im = Image.open(io.BytesIO(base64.b64decode(data_uri.split(',', 1)[1]))).convert('L').resize((12, 8))
    px = list(im.tobytes()); avg = sum(px) / len(px)
    return sum(1 << i for i, v in enumerate(px) if v > avg)

def near_dup(a, b):
    return bin(a ^ b).count('1') <= 10

def main():
    clubs = load_data()
    byid = {str(c['id']): c for c in clubs}
    print('clubs', len(clubs), 'with logo', sum(1 for c in clubs if c['logo']))

    # ---- event photos per group from the public RSS feed ----
    rss = fetch(RSS)
    rss = rss.decode('utf-8', 'replace') if rss else ''
    photos = {}
    for it in re.findall(r'<item>(.*?)</item>', rss, re.S):
        g = re.search(r'<groupId>(\d+)</groupId>', it)
        if not g or g.group(1) not in byid:
            continue
        for tag in ('eventPhotoFullUrl', 'eventFlyerFullUrl'):
            m = re.search(r'<%s>([^<]*)</%s>' % (tag, tag), it)
            u = html.unescape(m.group(1).strip()) if m else ''
            if u and re.search(r'\.(jpe?g|png|webp|gif)$', u, re.I):
                photos.setdefault(g.group(1), [])
                if u not in photos[g.group(1)]:
                    photos[g.group(1)].append(u)
    users = {}
    for g, us in photos.items():
        for u in us:
            users.setdefault(u, set()).add(g)
    photos = {g: [u for u in us if len(users[u]) == 1] for g, us in photos.items()}
    photos = {g: us for g, us in photos.items() if us}
    print('groups with own event photos', len(photos))

    # priority: registered + upcoming events, then registered, then the rest
    def prio(c):
        return (-(c['registered'] and c['up'] > 0), -(str(c['id']) in photos), -bool(c['registered']), -c['up'], c['name'].lower())
    order = sorted(clubs, key=prio)

    out, size, seen_hash = {}, 200, {}
    stats = {'photos': 0, 'logos': 0, 'clubsWithPhoto': 0, 'clubsWithLogo': 0, 'skippedDefault': 0, 'failed': 0}

    def add(cid, src, kind, frm):
        nonlocal size
        h = hashlib.sha1(src.encode()).hexdigest()
        if h in seen_hash and seen_hash[h] != cid:
            stats['skippedDefault'] += 1
            # a byte-identical image on two clubs is a default; remove it from the first one too
            other = seen_hash[h]
            if other in out:
                before = len(out[other]); out[other] = [x for x in out[other] if hashlib.sha1(x['src'].encode()).hexdigest() != h]
                size -= (before - len(out[other])) * (len(src) + len(frm) + 40)
                if not out[other]: del out[other]
            return False
        seen_hash[h] = cid
        cost = len(src) + len(frm) + 40
        if size + cost > BUDGET:
            return False
        out.setdefault(cid, []).append({'src': src, 'kind': kind, 'from': frm})
        size += cost
        return True

    # pass 1: real photos (they are what the club sheet gallery needs)
    hashes = {}
    for c in order:
        cid = str(c['id'])
        for u in photos.get(cid, [])[:PHOTOS_PER_CLUB + 2]:
            if sum(1 for x in out.get(cid, []) if x['kind'] == 'photo') >= PHOTOS_PER_CLUB:
                break
            if size > BUDGET * 0.62:
                break
            d = fetch(u)
            src = to_webp(d, 'photo') if d else None
            if not src:
                stats['failed'] += 1; continue
            h = ahash(src)
            if any(near_dup(h, x) for x in hashes.get(cid, [])):
                stats['nearDuplicate'] = stats.get('nearDuplicate', 0) + 1; continue  # the same flyer posted for several dates
            if add(cid, src, 'photo', u):
                hashes.setdefault(cid, []).append(h)
    # pass 2: logos for as many clubs as the budget allows
    for c in order:
        if not c['logo'] or size > BUDGET - 6000:
            continue
        cid = str(c['id'])
        d = fetch(c['logo'])
        src = to_webp(d, 'logo') if d else None
        if not src:
            stats['failed'] += 1; continue
        if add(cid, src, 'logo', c['logo']):
            out[cid].sort(key=lambda x: x['kind'] != 'logo')  # logo first, then photos
        if downloads >= MAX_DL:
            break

    for v in out.values():
        stats['photos'] += sum(1 for x in v if x['kind'] == 'photo')
        stats['logos'] += sum(1 for x in v if x['kind'] == 'logo')
        stats['clubsWithPhoto'] += any(x['kind'] == 'photo' for x in v)
        stats['clubsWithLogo'] += any(x['kind'] == 'logo' for x in v)
    stats['clubs'] = len(out)
    meta = dict(stats, asOf=datetime.date.today().isoformat(), logoSource='EngageSC group logos (engage.usc.edu/upload → static-prod-us-east-1.campusgroups.com)',
                photoSource='Event photos the group posted on EngageSC (public events feed ' + RSS + ')')
    body = ('/* js/club-photos.js — GENERATED by scripts/fetch_club_photos.py; do not edit.\n'
            ' * Real public images from EngageSC only: group logos, and event photos/flyers each group posted on its public\n'
            ' * EngageSC events. `from` is the original URL. Clubs without an entry get a generated graphic cover (TH.clubCover). */\n'
            'window.TH = window.TH || {};\n'
            'TH.CLUB_PHOTOS_META = ' + json.dumps(meta) + ';\n'
            'TH.CLUB_PHOTOS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    open(OUT, 'w', encoding='utf-8').write(body)
    print(json.dumps(stats), 'downloads this run', downloads, 'file', round(len(body.encode()) / 1e6, 2), 'MB')

if __name__ == '__main__':
    main()
