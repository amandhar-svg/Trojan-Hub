// Tommy safety suite: node safety-suite.js <built.html> <phrases.json>  -> prints PASS/FAIL per phrase
const { chromium } = require('playwright');
const fs = require('fs');
const FILE = process.argv[2], P = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const NUM = /911|213-740-4321|\(213\) 740-4321|988|213-740-9355|741741|323-442-1000/;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 402, height: 874 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE);
  await p.waitForFunction(() => document.documentElement.getAttribute('data-kb') === 'ready' && window.TA && TA.Script && TA.Script.handle, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const run = (text) => p.evaluate(async (t) => {
    try { TA.Brain.pending = null; } catch (e) {}
    const out = await TA.Script.handle(t);
    const s = JSON.stringify(out || []);
    return { s: s.slice(0, 4000), opening: /Opening (Report something|your profile|the quick setup)/.test(s), plan: /Here’s (your day|tomorrow|Thursday|Monday|Tuesday|Wednesday|Friday|Saturday|Sunday)|real outing|outings? in the next/.test(s) };
  }, text);
  let fails = 0;
  for (const t of P.danger) { const r = await run(t); const ok = NUM.test(r.s) && !r.opening && !r.plan; if (!ok) fails++; console.log((ok ? 'PASS' : 'FAIL') + ' danger  | ' + t + (ok ? '' : '  -> ' + r.s.slice(0, 160))); }
  for (const t of P.support) { const r = await run(t); const ok = !r.plan && /Basic Needs|SBN|meal swipe|food/i.test(r.s); if (!ok) fails++; console.log((ok ? 'PASS' : 'FAIL') + ' support | ' + t + (ok ? '' : '  -> ' + r.s.slice(0, 160))); }
  for (const t of P.normal) { const r = await run(t); const crisisCard = /reached out|please contact someone right now|in danger, call 911|call DPS emergency/i.test(r.s); const ok = !crisisCard; if (!ok) fails++; console.log((ok ? 'PASS' : 'FAIL') + ' normal  | ' + t + (ok ? '' : '  -> ' + r.s.slice(0, 160))); }
  console.log('FAILS:', fails, '| page errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
