#!/usr/bin/env python3
"""Re-pack Tommy's gzip+base64 blobs (js/ta/blob-kb.js, js/ta/blob-soc.js) with Zopfli.

Zopfli writes ordinary gzip (the browser's DecompressionStream('gzip') reads it exactly as before), just
~4% smaller than `gzip -9`. The decoded bytes are checked to be identical before a file is replaced, so the
knowledge base content does not change; only the single-file build gets smaller.

Usage: python3 scripts/recompress_blobs.py [--iterations 15]      (needs: pip install zopfli)
"""
import base64, gzip, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['js/ta/blob-kb.js', 'js/ta/blob-soc.js']
ITER = int(sys.argv[sys.argv.index('--iterations') + 1]) if '--iterations' in sys.argv else 15

try:
    import zopfli.gzip as zg
except ImportError:
    sys.exit('needs Zopfli: pip install zopfli')

for rel in FILES:
    path = os.path.join(ROOT, rel)
    src = open(path, encoding='utf-8').read()
    m = re.search(r'(\]\s*=\s*")([A-Za-z0-9+/=]+)(";)', src)
    if not m:
        print('skip (no base64 payload):', rel); continue
    old = base64.b64decode(m.group(2))
    raw = gzip.decompress(old)
    new = zg.compress(raw, numiterations=ITER)
    if gzip.decompress(new) != raw:
        sys.exit('round-trip mismatch for ' + rel)
    if len(new) >= len(old):
        print('kept (no gain):', rel); continue
    b64 = base64.b64encode(new).decode()
    out = src[:m.start(2)] + b64 + src[m.end(2):]
    open(path, 'w', encoding='utf-8').write(out)
    print(f'{rel}: gzip {len(old):,} -> {len(new):,} bytes; file {len(src):,} -> {len(out):,} bytes (content identical)')
