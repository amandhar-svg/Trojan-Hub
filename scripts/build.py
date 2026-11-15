#!/usr/bin/env python3
"""Rebuild dist/trojan-hub.html from template.html + the source files.
template.html holds the page with each inline <script>/<style> body replaced by @@FILE:<path>@@.

  python3 scripts/build.py [out.html]
      The single self-contained file (everything inline, works offline). Default: dist/trojan-hub.html.
  python3 scripts/build.py --artifact [dir]
      Also writes a claude.ai artifact version to dir (default dist/artifact): index.html with the club images
      (js/club-photos.js) as a separate supporting file, so the page stays under the 16 MB artifact limit.
      Publish index.html with files = {"js/club-photos.js": "<dir>/js/club-photos.js"}. If that file is missing,
      clubs fall back to their generated covers.
  python3 scripts/build.py --max-bytes 16000000 [out.html]
      A single file that fits a byte limit: club images are re-encoded smaller and the lowest-priority ones are
      left out (generated covers instead) until the page fits. Needs Pillow.
"""
import base64, io, json, os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = 'js/club-photos.js'
TAG = '<script>@@FILE:' + PHOTOS + '@@</script>'

def read(rel):
    body = open(os.path.join(ROOT, rel), encoding='utf-8').read()
    if re.search(r'</(script|style)', body, re.I):
        sys.exit('unescaped closing tag inside ' + rel)
    return body

def render(t, photos_body=None):
    def sub(m):
        if photos_body is not None and m.group(1) == PHOTOS:
            return photos_body
        return read(m.group(1))
    return re.sub(r'@@FILE:([^@]+)@@', sub, t)

def write(p, out):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(out)
    n = len(out.encode())
    print('built', p, f'{n:,} bytes ({n / 1e6:.2f} MB)')
    return n

# ---------- --max-bytes: fit the club images into what is left under the limit ----------
def fit_photos(t, limit):
    try:
        from PIL import Image
    except ImportError:
        sys.exit('--max-bytes needs Pillow: pip install pillow')
    src = read(PHOTOS)
    head, data = src.split('TH.CLUB_PHOTOS = ', 1)
    photos = json.loads(data.strip().rstrip(';'))
    base = len(render(t, '').encode())
    budget = limit - base - len(head.encode()) - 8000  # a little headroom under the limit
    if budget <= 0:
        sys.exit(f'the page without club images is already {base:,} bytes; nothing fits under {limit:,}')

    def shrink(uri, kind):
        im = Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1]))).convert('RGB')
        if kind == 'logo':
            im = im.resize((88, 88), Image.LANCZOS); q = 58
        else:
            w, h = im.size; nw = min(w, 420); im = im.resize((nw, round(h * nw / w)), Image.LANCZOS); q = 50
        buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=6)
        return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

    out, used = {}, 2
    def take(cid, item):
        nonlocal used
        rec = {'src': shrink(item['src'], item['kind']), 'kind': item['kind']}
        if item['kind'] == 'photo' and item.get('from'):
            rec['from'] = item['from']  # logo sources are the club's own EngageSC logo field (TH.CLUBS)
        cost = len(json.dumps(rec, separators=(',', ':'))) + len(cid) + 6
        if used + cost > budget:
            return False
        out.setdefault(cid, []).append(rec); used += cost
        return True
    # priority = the generator's order (registered clubs with upcoming events and real photos first).
    # Half the budget goes to each club's first real photo (the club-sheet hero), then logos (they make the list
    # scroll look right), then any extra photos.
    order = list(photos)
    first = lambda cid, kind: next((x for x in photos[cid] if x['kind'] == kind), None)
    def fill(items, stop_at):
        for cid, it in items:
            if used >= stop_at:
                return
            take(cid, it)
    fill([(c, first(c, 'photo')) for c in order if first(c, 'photo')], budget * 0.5)
    fill([(c, first(c, 'logo')) for c in order if first(c, 'logo')], budget)
    fill([(c, x) for c in order for x in [y for y in photos[c] if y['kind'] == 'photo'][1:]], budget)
    for v in out.values():
        v.sort(key=lambda x: x['kind'] != 'logo')
    meta = json.loads(re.search(r'TH\.CLUB_PHOTOS_META = (\{.*?\});', head).group(1))
    meta.update(photos=sum(1 for v in out.values() for x in v if x['kind'] == 'photo'), logos=sum(1 for v in out.values() for x in v if x['kind'] == 'logo'),
                clubsWithPhoto=sum(1 for v in out.values() if any(x['kind'] == 'photo' for x in v)), clubsWithLogo=sum(1 for v in out.values() if any(x['kind'] == 'logo' for x in v)),
                clubs=len(out), trimmedFor=f'{limit:,}-byte single file')
    head = re.sub(r'TH\.CLUB_PHOTOS_META = \{.*?\};', lambda m: 'TH.CLUB_PHOTOS_META = ' + json.dumps(meta) + ';', head)
    body = head + 'TH.CLUB_PHOTOS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    print(f'club images for {limit:,} bytes: {meta["clubs"]} clubs, {meta["logos"]} logos, {meta["photos"]} photos '
          f'(full set: {len(photos)} clubs, {sum(1 for v in photos.values() for x in v if x["kind"] == "photo")} photos)')
    return body

def main():
    args = sys.argv[1:]
    t = open(os.path.join(ROOT, 'template.html'), encoding='utf-8').read()
    limit = None
    if '--max-bytes' in args:
        i = args.index('--max-bytes'); limit = int(args[i + 1]); del args[i:i + 2]
    art = None
    if '--artifact' in args:
        i = args.index('--artifact'); del args[i]
        art = os.path.abspath(args.pop(i)) if i < len(args) and not args[i].startswith('--') else os.path.join(ROOT, 'dist', 'artifact')
    p = os.path.abspath(args[0]) if args else os.path.join(ROOT, 'dist', 'trojan-hub.html')
    body = fit_photos(t, limit) if limit else None
    n = write(p, render(t, body))
    if limit and n > limit:
        sys.exit(f'still {n - limit:,} bytes over {limit:,}')
    if art:
        if TAG not in t:
            sys.exit('template.html has no ' + TAG)
        page = render(t.replace(TAG, '<script src="' + PHOTOS + '"></script>'))
        write(os.path.join(art, 'index.html'), page)
        os.makedirs(os.path.join(art, 'js'), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, PHOTOS), os.path.join(art, PHOTOS))
        print('  + supporting file', os.path.join(art, PHOTOS), f'{os.path.getsize(os.path.join(art, PHOTOS)):,} bytes')
main()
