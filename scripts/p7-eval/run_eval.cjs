// node run_eval.cjs <html> <tests.json> <out.json> [oracle]  -- runs each test through TS.handle (fresh state), checks expectations
const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const [html, tf, of, mode] = process.argv.slice(2); const tests=JSON.parse(fs.readFileSync(tf,'utf8'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, timezoneId: 'America/Los_Angeles' }); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + html);
  await p.waitForFunction(() => document.documentElement.getAttribute('data-kb') === 'ready' && window.TA && TA.Script && TA.Script.handle && TA.SOC && TA.SOC.ready, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const res = await p.evaluate(async ({tests, mode}) => { TA.State.d.signedIn=true; if (mode==='nostrict' && TA.FAQ) TA.FAQ.strict=false; const snap=TA.State.snapshot(); const out=[];
    for (const t of tests) { try { TA.Brain.pending=null; TA.Brain.ctx={}; TA.State.restore(snap); TA.State.d.signedIn=true; } catch(e){}
      let o, line=null, ms=0;
      try {
        if (mode==='oracle') { if (!t.oracle || !TA.Script.cmds[t.oracle.cmd]) { out.push({skip:1}); continue; } o = TA.Script.run(t.oracle); line=t.oracle.cmd; }
        else { const t0=performance.now(); TA.Script.compile(t.q); ms=performance.now()-t0; o = await TA.Script.handle(t.q); const m=(o||[]).find(x=>x&&x.role==='bot')||{}; line=m.script?m.script.line:null; }
      } catch(e) { o=[{md:'ERR '+e.message}]; }
      const md=(o||[]).map(x=>(x.md||'')+(x.card?' [CARD '+JSON.stringify(x.card).slice(0,1500)+']':'')).join(' || ');
      const ok = t.expect.every(r => new RegExp(r,'i').test(md)) && !(t.not && new RegExp(t.not,'i').test(md));
      out.push({q:t.q, topic:t.topic, ok, line, ms:+ms.toFixed(2), md: md.slice(0,600), src: ((o||[]).find(x=>x&&x.sources)||{}).sources ? ((o||[]).find(x=>x&&x.sources).sources.length) : 0});
    } return out; }, {tests, mode});
  fs.writeFileSync(of, JSON.stringify(res,null,1)); const by={}; res.forEach(r=>{ if(r.skip) return; const k=r.topic; by[k]=by[k]||[0,0]; by[k][1]++; if(r.ok) by[k][0]++; });
  const tot=res.filter(r=>!r.skip), ok=tot.filter(r=>r.ok).length; console.log('TOTAL', ok+'/'+tot.length, (100*ok/tot.length).toFixed(1)+'%'); for (const k in by) console.log(k.padEnd(10), by[k][0]+'/'+by[k][1]);
  const ms=tot.map(r=>r.ms).sort((a,b)=>a-b); if(ms.length) console.log('compile ms p50',ms[Math.floor(ms.length/2)],'p99',ms[Math.floor(ms.length*0.99)],'max',ms[ms.length-1]);
  if(errs.length) console.log('PAGE ERRORS', errs.slice(0,5)); await b.close();
})();
