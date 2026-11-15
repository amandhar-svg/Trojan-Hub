const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/visual.html'); await p.waitForFunction(() => TA.Search.ready, null, { timeout: 120000 });
    await p.evaluate(() => { TA.Embed.mount(document.getElementById('ta-screen')); TA.State.signIn(); });
    for (const t of ['join the Black Student Assembly', 'how much is the trojan meal plan?']) { await p.evaluate(t => TA.Embed.ask(t), t); await p.waitForFunction(() => !TA.UI.busy); }
    await p.waitForTimeout(400);
    await p.locator('.device').screenshot({ path: 'visual-' + scheme + '.png' });
    const r = await p.evaluate(() => { const q = s => document.querySelector(s); const box = e => e && e.getBoundingClientRect(); return { panel: box(q('.ta-panel')), log: box(q('.ta-log')), compose: box(q('.ta-compose')), device: box(q('.device')), btnShadowTH: getComputedStyle(document.body).getPropertyValue('--shadow').slice(0, 40), bodyFont: getComputedStyle(q('.ta-msg .ta-md')).fontFamily.slice(0, 30) }; });
    console.log(scheme, JSON.stringify(r), errs);
  }
  await b.close();
})();
