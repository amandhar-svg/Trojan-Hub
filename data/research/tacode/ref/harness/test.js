const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+': ' + m.text()); });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8765/test.html', { waitUntil: 'load', timeout: 120000 });
  const loadMs = Date.now() - t0;
  await page.waitForFunction(() => window.__kb, null, { timeout: 120000 });
  const kb = await page.evaluate(() => window.__kb);
  const heap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize/1e6) : null);
  console.log('load event ms', loadMs, 'kb', JSON.stringify(kb), 'main heap MB', heap);
  const cdp = await page.context().newCDPSession(page);
  // mount
  await page.evaluate(() => TA.Embed.mount(document.getElementById('screen')));
  const say = async (t) => {
    await page.evaluate(t => TA.Embed.ask(t), t);
    await page.waitForFunction(() => !TA.UI.busy, null, { timeout: 60000 });
    const last = await page.evaluate(() => { const ms = TA.UI.msgs.slice(-3); return ms.map(m => (m.role) + ': ' + (m.md || '').slice(0, 160).replace(/\n/g,' ') + (m.card ? ' [card ' + m.card.type + ': ' + (m.card.title||'') + ' ' + JSON.stringify(m.card.rows||[]).slice(0,300) + ']' : '') + (m.chips ? ' chips=' + m.chips.map(c => c.label).join('|') : '')).join('\n   '); });
    console.log('> ' + t + '\n   ' + last + '\n   pending=' + JSON.stringify(await page.evaluate(() => TA.Brain.pending && { aid: TA.Brain.pending.aid, stage: TA.Brain.pending.stage })));
  };
  await say('rsvp to an event');
  await page.evaluate(() => { TA.State.signIn(); });
  await say('rsvp to an event');
  const opt = await page.evaluate(() => { const b = document.querySelector('#ta-log .ta-opt'); return b && [b.getAttribute('data-send'), b.getAttribute('data-label')]; });
  console.log('first option', opt);
  await page.click('#ta-log .ta-opt');
  await page.waitForFunction(() => !TA.UI.busy);
  console.log('after option click pending', JSON.stringify(await page.evaluate(() => TA.Brain.pending && { aid: TA.Brain.pending.aid, stage: TA.Brain.pending.stage })));
  let calls = 0; await page.evaluate(() => { window.__on = 0; TA.State.on(() => window.__on++); });
  await page.click('#ta-log button[data-confirm]:not([disabled])');
  await page.waitForFunction(() => !TA.UI.busy);
  console.log('calendar', JSON.stringify(await page.evaluate(() => TA.hub().calendar)), 'State.on fired', await page.evaluate(() => window.__on), 'log0', await page.evaluate(() => TA.State.d.log[0].action + ' ' + TA.State.d.log[0].conf));
  await page.click('#ta-log .ta-chip[data-send="@go:plans"]').catch(e => console.log('no go chip', e.message));
  console.log('went', await page.evaluate(() => window.__went));
  await say('undo');
  console.log('calendar after undo', await page.evaluate(() => TA.hub ? (TA.State.d.hub ? TA.State.d.hub.calendar.length : 'no hub') : '?'));
  const evTitle = await page.evaluate(() => TH.CLUB_EVENTS.filter(e => new Date(e.start) > TA.now() && !(e.multi_day_span_days > 1))[5].title);
  await say('rsvp to ' + evTitle);
  await say('cancel');
  await say('join the Black Student Assembly');
  await say('yes');
  console.log('clubs', JSON.stringify(await page.evaluate(() => TA.State.d.hub && TA.State.d.hub.clubs)), 'cal n', await page.evaluate(() => TA.State.d.hub && TA.State.d.hub.calendar.length), 'orgs', JSON.stringify(await page.evaluate(() => TA.State.d.life.orgs)));
  await say('join Totally Fake Club Name Here');
  await say('order me a coffee');
  await page.evaluate(() => TA.registerHubAction({ id: 'hub_order_food', title: 'Order food for pickup', scope: 'dining', icon: 'meal', system: 'Trojan Hub mobile order',
    detect: n => /\b(order|get me|buy me)\b.{0,30}\b(coffee|latte|food|lunch|dinner|breakfast|boba|sandwich)\b/.test(n.t) && !n.isQuestion ? 0.9 : 0,
    init: n => ({ item: /\blatte\b/.test(n.t) ? 'Latte' : null }), next: s => s.item ? null : { slot: 'item', md: 'What should I order?', options: [{ label: 'Latte', value: 'latte' }] },
    fill: (k, n, s, t) => { if (/latte/i.test(t)) { s.item = 'Latte'; return true; } return false; }, check: () => ({ block: [], warn: [] }),
    preview: s => ({ title: 'Order ' + s.item, rows: [['Item', s.item]] }), run: s => { TA.hub().orders.push({ id: TA.uid(), item: s.item }); return { title: 'Order placed', rows: [['Item', s.item]], log: 'Ordered ' + s.item }; } }));
  await say('order me a latte');
  await say('cancel');
  await say("i want to kill myself");
  await say('how do i rsvp to an event on engage?');
  // remount mid-flight
  await page.evaluate(() => { TA.Embed.ask('when does spring 2027 registration start?'); TA.Embed.unmount(); document.getElementById('screen').innerHTML = ''; });
  await page.waitForFunction(() => !TA.UI.busy);
  await page.evaluate(() => TA.Embed.mount(document.getElementById('screen')));
  console.log('after remount log children', await page.evaluate(() => document.querySelectorAll('#ta-log .ta-msg').length), 'msgs', await page.evaluate(() => TA.UI.msgs.length), 'last', await page.evaluate(() => (TA.UI.msgs[TA.UI.msgs.length-1].md||'').slice(0,120)));
  // Claude start_action path (tool runner only, no network)
  const tool = await page.evaluate(async () => { const side = []; const r = await TA.AI.runTool('start_action', { action: 'hub_rsvp_event', request: 'RSVP to ' + TH.CLUB_EVENTS.filter(e => new Date(e.start) > TA.now())[3].title }, side, []); return r + ' | side cards: ' + side.map(m => m.card && m.card.type).join(','); });
  console.log('start_action ->', tool.slice(0, 400));
  const ids = await page.evaluate(() => ({ actions: TA.Actions.list.length, procs: TA.Process.list.length, rsvpProc: !!TA.Process.byId['rsvp-campus-event'], joinProc: !!TA.Process.byId['join-student-organization'], lyftProc: !!TA.Process.byId['request-lyft-ride-or-safety-escort'], upassProc: !!TA.Process.byId['activate-metro-u-pass'] }));
  console.log('registry', JSON.stringify(ids));
  const sizes = await page.evaluate(() => { const enumIds = TA.Actions.list.map(a => a.id).concat(TA.Process.list.map(i => 'proc:' + i.pa.id)); const desc = TA.Actions.list.map(a => a.id + ' = ' + a.title).join('; ') + '; ' + TA.Process.list.map(i => 'proc:' + i.pa.id + ' = ' + i.pa.name).join('; '); return { enumBytes: JSON.stringify(enumIds).length, descBytes: desc.length, n: enumIds.length }; });
  console.log('start_action schema sizes', JSON.stringify(sizes));
  const m2 = await cdp.send('Performance.getMetrics').catch(()=>null);
  await page.screenshot({ path: 'embed.png' });
  console.log('errors:', errs.slice(0, 20).join('\n'));
  await browser.close();
})();
