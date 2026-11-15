#!/usr/bin/env python3
"""Build Ask Tommy's FAQ bank (js/ta/faq-data.js) from data/kb.json.gz.

Every entry comes from a real USC page in the knowledge base:
  - curated docs (t == "c"): title, 7 question paraphrases, answer, source URLs
  - askUSC FAQ docs (t == "f"): the question, the answer, its URL; extra paraphrases from
    data/faq-paraphrases.json (question rewordings only, no facts)
Answers are the source text itself, cut at a paragraph/sentence/bullet boundary to <= 90 words
(cut answers say so and point to the source). Topics the command families already answer
(hours, bus schedules) and personal/sensitive topics (handled on device by Trojan Assist's own
support flows) are left out.

  python3 scripts/build_faq.py            -> writes js/ta/faq-data.js and prints stats
  python3 scripts/build_faq.py --candidates out.json  -> askUSC questions that need paraphrases
"""
import gzip, json, re, sys, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB = os.path.join(ROOT, 'data', 'kb.json.gz')
PARA = os.path.join(ROOT, 'data', 'faq-paraphrases.json')
OUT = os.path.join(ROOT, 'js', 'ta', 'faq-data.js')
MAXW = 90

# families already cover these (hours, schedules), or they are personal/sensitive (on-device support flows)
SKIP_CATS = {'Dining Locations & Hours', 'Library Hours & Locations', 'Buses & Shuttles',
             'Counseling & Mental Health', 'Sexual Violence Support', 'Discrimination & Title IX', 'Sexual & Reproductive Health',
             'Undocumented & DACA', 'Food Insecurity Support', 'Basic Needs', 'Emergency Funding', 'Support Resources',
             'Health Leave', 'Medications', 'Emergency & Safety', 'Emergency Procedures', 'Personal Safety', 'Wellbeing Programs'}
SENSITIVE = re.compile(r"\b(pregnan\w*|abortion|contracepti\w*|plan b|birth control|stds?|stis?|hiv|sexual\w*|rape|assault\w*|abus\w*|harass\w*|"
                       r"diagnos\w*|depress\w*|anxi\w*|panic|adhd|autis\w*|bipolar|ptsd|therap\w*|counsel\w*|psychiatr\w*|medicat\w*|prescription\w*|"
                       r"eating disorder|self.?harm|suicid\w*|overdos\w*|addict\w*|drunk|drugs?|alcohol|immigra\w*|undocumented|daca|deport\w*|"
                       r"lgbt\w*|gay|lesbian|transgender|title ix|discriminat\w*|stalk\w*|violence|crisis|emergency|homeless|food insecur\w*|"
                       r"died|death|deceased|grief|weapon|gun|police|no money|afford|hungry|starv\w*|basic needs|emergency meal|food pantry|broke|evict\w*)\b", re.I)
STALE = re.compile(r"\b20(0\d|1\d|2[0-4])\b")


def words(s):
    return re.findall(r"\S+", s)


def trim(a):
    """Cut the answer at a block/sentence boundary so it has <= MAXW words. Returns (text, cut?)."""
    a = a.replace(' ', ' ').strip()
    a = re.sub(r'\n{3,}', '\n\n', a)
    if len(words(a)) <= MAXW:
        return a, False
    blocks = re.split(r'(?<=\n)', a)  # keep newlines; each line is a paragraph or bullet
    out, n = '', 0
    for b in blocks:
        w = len(words(b))
        if n + w <= MAXW:
            out += b; n += w; continue
        if n < 25:  # first block is long: cut it at a sentence end
            sents = re.split(r'(?<=[.!?])\s+', b)
            for s in sents:
                sw = len(words(s))
                if n + sw > MAXW: break
                out += s + ' '; n += sw
        break
    out = out.strip()
    if len(words(out)) < 12:
        return None, True
    out = re.sub(r'[:,;]\s*$', '.', out)
    if out.count('**') % 2: out = out.rsplit('**', 1)[0] + out.rsplit('**', 1)[1]
    return out, True


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r"[^a-z0-9 ]+", ' ', s.lower().replace("’", "").replace("'", ""))).strip()


PFX = {}


def prefix(cat):
    w = [x for x in re.findall(r'[A-Za-z]+', cat) if x.lower() not in ('and', 'the', 'of', 'for')]
    p = (w[0][:2] + (w[1][0] if len(w) > 1 else w[0][2:3])).lower() if w else 'x'
    return p


def short_title(t, n=40):
    t = re.sub(r'\s*\(.*?\)\s*', ' ', t).strip()
    t = re.sub(r'\s+', ' ', t)
    if len(t) <= n: return t.rstrip('?')
    cut = t[:n].rsplit(' ', 1)[0]
    return cut.rstrip(',:;-–')


def main():
    kb = json.load(gzip.open(KB))
    docs, U = kb['docs'], kb['urls']
    para = json.load(open(PARA)) if os.path.exists(PARA) else {}
    cands, entries, seen, skipped = [], [], set(), collections.Counter()
    counters = collections.Counter()
    for d in docs:
        if d['t'] not in ('c', 'f'): continue
        cat = d.get('cat') or ''
        q = [x for x in (d.get('q') or []) if x and x.strip()]
        text_for_check = d.get('ti', '') + ' ' + ' '.join(q)
        if cat in SKIP_CATS: skipped['cat'] += 1; continue
        if SENSITIVE.search(text_for_check): skipped['sensitive'] += 1; continue
        a = d.get('a') or ''
        if d['t'] == 'f' and STALE.search(a): skipped['stale'] += 1; continue
        if len(words(a)) < 8: skipped['short'] += 1; continue
        key = norm(d.get('ti') or q[0])
        if key in seen: skipped['dup'] += 1; continue
        seen.add(key)
        ans, cut = trim(a)
        if not ans: skipped['untrimmable'] += 1; continue
        if d['t'] == 'f':
            urls = [U[d['u']]] if isinstance(d.get('u'), int) and d['u'] < len(U) else []
            pid = 'u%d' % d['u']
            extra = [p for p in para.get(pid, []) if isinstance(p, str)]
            if not extra:
                cands.append({'pid': pid, 'q': d['ti'], 'a': ans[:400], 'cat': cat})
            qs = [d['ti']] + extra
        else:
            urls = [U[i] for i in (d.get('s') or [d.get('u')]) if isinstance(i, int) and i < len(U)][:2]
            qs = q
        qs = list(dict.fromkeys([x.strip() for x in qs if x.strip()]))[:8]
        if len(qs) < 3: skipped['few_paraphrases'] += 1; continue
        if not urls: skipped['nourl'] += 1; continue
        p = prefix(cat); counters[p] += 1
        entries.append({'id': p + str(counters[p]), 't': short_title(d.get('ti') or qs[0]), 'q': qs, 'a': ans + ('\n\n_Shortened from the source page; see it for the full answer._' if cut else ''),
                        'k': [k for k in (d.get('k') or []) if isinstance(k, str)][:10], 's': [{'url': u[0], 'title': u[1]} for u in urls], 'c': cat})
    if '--candidates' in sys.argv:
        json.dump(cands, open(sys.argv[sys.argv.index('--candidates') + 1], 'w'), indent=0, ensure_ascii=False)
        print('candidates needing paraphrases:', len(cands)); return
    js = ('/* js/ta/faq-data.js — GENERATED by scripts/build_faq.py from data/kb.json.gz (USC pages). Do not edit by hand.\n'
          ' * ' + str(len(entries)) + ' FAQ entries: id, t (short title), q (3-8 paraphrases), a (answer <= 90 words, source text), k (keywords), s (sources), c (category). */\n'
          'window.TA_FAQ = ' + json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(OUT, 'w').write(js)
    print('entries', len(entries), 'skipped', dict(skipped), 'bytes', len(js))


if __name__ == '__main__':
    main()
