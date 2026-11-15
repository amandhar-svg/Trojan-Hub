#!/usr/bin/env python3
"""Rebuild the three test pages next to this script (run from ref/harness):
   test.html   = original TA page CSS + data + app + hub-actions + embed (functional test, test.js)
   test2.html  = test.html + mocked window.claude sample + ai-sample.js (test2.js)
   visual.html = Trojan Hub css/app.css + ta.css + embed (visual.js screenshots, light and dark)
Serve with:  python3 -m http.server 8765   then  node test.js / node test2.js / node visual.js"""
import os
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(H)
SRC = '/home/user/ta-src/'; CL = '/home/user/trojan-hub/research/clubs/'
rd = lambda p: open(p, encoding='utf-8').read()
app = rd(SRC + 'app.html').rstrip(); app = app[:app.rindex('</body>')]
data = ''.join(rd(SRC + f) + '\n' for f in ['kb.html', 'soc.html', 'acts.html', 'meta.html'])
th = '<script>window.TH={CLUBS:' + rd(CL + 'clubs.min.json') + ',CLUB_EVENTS:' + rd(CL + 'events.json') + '};window.__t0=performance.now();</script>\n'
js = lambda f: '<script>' + rd(os.path.join(R, f)) + '</script>\n'
hooks = '<script>TA.Embed.onGo=function(s,a){window.__went=s;};TA.on("kb-ready",function(st){window.__kb={ms:performance.now()-window.__t0,build:TA.Search.buildMs,stats:st};});</script>\n'
head = rd(SRC + 'head.html'); head = head[:head.index('<body>')]
body = '<body><div id="screen" style="position:fixed;inset:0;max-width:402px"></div>\n'
open(os.path.join(H, 'test.html'), 'w').write(head + body + data + th + app + js('hub-actions.js') + js('embed.js') + hooks + '</body></html>')
open(os.path.join(H, 'test2.html'), 'w').write(head + body + data + js('harness/mock.js') + th + app + js('hub-actions.js') + js('embed.js') + js('ai-sample.js') + hooks + '</body></html>')
vis = ('<!doctype html><html><head><meta charset="utf-8"><style>' + rd('/home/user/trojan-hub/css/app.css') + '</style><style>' + rd(os.path.join(R, 'ta.css')) +
       '</style></head><body><div class="stage"><main class="device"><div id="screen-host"><div class="screen ta-screen" id="ta-screen"></div></div></main></div>\n')
open(os.path.join(H, 'visual.html'), 'w').write(vis + data + th + app + js('hub-actions.js') + js('embed.js') + '</body></html>')
print('ok')
