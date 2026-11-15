const {chromium}=require('playwright');const fs=require('fs');
const Q=JSON.parse(fs.readFileSync('/home/user/Trojan-Hub/data/eval/questions.json')).items;
const OUT='raw.jsonl';const done=new Set(fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).id):[]);
const _t=Q.filter(q=>!done.has(q.id));const _g={};_t.forEach(q=>(_g[q.topic]=_g[q.topic]||[]).push(q));const todo=[];for(let i=0;todo.length<_t.length;i++)for(const k of Object.keys(_g))if(_g[k][i])todo.push(_g[k][i]);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();let ctx,p,net,count=0,last=0,ver=0;const STOP=Date.parse('2026-11-15T04:00:00Z');
async function fresh(){if(ctx)await ctx.close().catch(()=>{});ctx=await b.newContext({viewport:{width:402,height:874}});p=await ctx.newPage();net=[];
 p.on('request',r=>{if(r.url().includes('/api/tommy'))net.push({t:Date.now(),method:r.method(),body:(r.postData()||'').slice(0,800)})});
 p.on('response',r=>{if(r.url().includes('/api/tommy'))net.push({t:Date.now(),status:r.status()})});
 await p.goto('https://trojanhub.netlify.app',{timeout:180000});
 await p.waitForFunction(()=>document.documentElement.getAttribute('data-kb')==='ready',null,{timeout:240000});
 await p.evaluate(()=>TH.go('assistant'));await sleep(800);ver=await p.evaluate(()=>Object.keys(TA.Script.cmds).length);console.error('cmds',ver);}
async function ask(text){await p.evaluate(()=>{try{if(TA.Brain.pending){TA.Brain.pending=null;TA.Brain.persist&&TA.Brain.persist()}}catch(e){}});const n0=await p.evaluate(()=>TA.UI.msgs.length);const k0=net.length;const t0=Date.now();
 await p.evaluate(q=>TA.UI.send(q),text);await sleep(600);
 await p.waitForFunction(()=>!TA.UI.busy,null,{timeout:90000}).catch(()=>{});await sleep(400);
 const msgs=await p.evaluate(n0=>JSON.parse(JSON.stringify(TA.UI.msgs.slice(n0),(k,v)=>typeof v==='string'&&v.length>4000?v.slice(0,4000)+'…':v)),n0);
 const scr=await p.evaluate(()=>location.hash);
 return {msgs,net:net.slice(k0),ms:Date.now()-t0,hash:scr};}
for(const q of todo){
 if(Date.now()>=STOP){console.log('STOP 04:00 UTC reached');break}
 if(count%25===0){for(let i=0;i<3;i++){try{await fresh();break}catch(e){console.error('fresh fail',e.message);await sleep(20000)}}}
 count++;const wait=15000-(Date.now()-last);if(wait>0)await sleep(wait);last=Date.now();
 let r;try{r=await ask(q.text)}catch(e){r={err:e.message,msgs:[],net:[]};try{await fresh()}catch(e2){}}
 if(r.net.some(x=>x.status===429)){console.error('429 on',q.id,'waiting 90s');await sleep(90000);last=Date.now();try{r=await ask(q.text);r.retried=true}catch(e){r.err=e.message}}
 const bots=r.msgs.filter(m=>m.role!=='user');
 const rec={id:q.id,text:q.text,kind:q.kind,topic:q.topic,good_answer:q.good_answer,
  reply:bots.map(m=>m.md||'').join('\n---\n'),
  script:bots.map(m=>m.script).filter(Boolean),
  sources:[].concat(...bots.map(m=>(m.sources||[]).map(s=>s.url))),
  chips:[].concat(...bots.map(m=>(m.chips||[]).map(c=>c.label))),
  kinds:bots.map(m=>m.kind||''),cards:bots.map(m=>m.card?JSON.stringify(m.card).slice(0,600):null).filter(Boolean),
  extra:bots.map(m=>{const o={};for(const k of Object.keys(m))if(!['md','script','sources','chips','role','ts','id','kind','covers','card'].includes(k))o[k]=m[k];return o}),
  ai_post:r.net.some(x=>x.method==='POST'),ai_status:r.net.filter(x=>x.status).map(x=>x.status),ai_body:(r.net.find(x=>x.method)||{}).body||null,
  ms:r.ms,site_cmds:ver,hash:r.hash,err:r.err||null,retried:!!r.retried,at:new Date().toISOString()};
 fs.appendFileSync(OUT,JSON.stringify(rec)+'\n');
 console.log(count,q.id,rec.ai_post?'AI':'--',(rec.script[0]||{}).line||'-',JSON.stringify(rec.reply.slice(0,90)));
}
await b.close();console.log('DONE');})();
