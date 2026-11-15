const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/build/index.html'); await p.waitForFunction(() => window.__kbReady, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => ({ boot: Math.round(__boot), kbScriptLoaded: Math.round(__kbLoaded), kbReady: Math.round(__kbReady), soc: TA.SOC.ready, procs: TA.Process.list.length, actions: TA.Actions.list.length, heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6) }))));
  await p.evaluate(() => { TA.Embed.mount(document.getElementById('ta-screen')); TA.State.signIn(); }); await p.evaluate(() => TA.Embed.ask('when does spring 2027 registration start?')); await p.waitForFunction(() => !TA.UI.busy);
  console.log(await p.evaluate(() => TA.UI.msgs.slice(-1)[0].md.slice(0, 160)), errs); await b.close(); })();
