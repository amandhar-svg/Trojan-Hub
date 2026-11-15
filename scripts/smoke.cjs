const { chromium } = require('playwright');
(async () => {
  const f = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 402, height: 874 } }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + f); await p.waitForFunction(() => document.documentElement.getAttribute('data-kb') === 'ready', null, { timeout: 60000 }).catch(() => errs.push('kb not ready'));
  const routes = await p.evaluate(() => Object.keys(TH.screens));
  for (const r of routes) { try { await p.evaluate(n => TH.go(n), r); await p.waitForTimeout(150); } catch (e) { errs.push(r + ': ' + e.message); } }
  console.log(routes.length + ' routes: ' + routes.join(' ')); console.log(errs.length ? errs.slice(0, 20).join('\n') : 'NO ERRORS'); await b.close();
})();
