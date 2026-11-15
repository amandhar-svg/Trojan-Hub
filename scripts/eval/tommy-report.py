import json,collections,datetime,os,sys
SP=os.path.dirname(os.path.abspath(__file__));REPO='/home/user/Trojan-Hub'
R={}
for l in open(f'{SP}/raw.jsonl'):
    r=json.loads(l);R[r['id']]=r
G={}
for l in open(f'{SP}/grades.txt'):
    l=l.rstrip('\n')
    if not l.strip():continue
    i,c,n=l.split('|',2);G[i]=(c,n)
rows=[dict(R[i],grade=G[i][0],grade_note=G[i][1]) for i in R if i in G]
ungraded=[i for i in R if i not in G]
stamp=sys.argv[1] if len(sys.argv)>1 else datetime.datetime.utcnow().strftime('%Y%m%dT%H%MZ')
json.dump({'site':'https://trojanhub.netlify.app','note':'One full paced run (1 msg / 15 s, fresh page every 25). Pending action prompts cleared between messages. Grades by hand.','count':len(rows),'ungraded':ungraded,'results':rows},open(f'{REPO}/data/eval/results-{stamp}.json','w'),indent=1)
N=len(rows);good=sum(r['grade']=='GOOD' for r in rows)
cats=collections.Counter(r['grade'] for r in rows)
bytopic=collections.defaultdict(lambda:[0,0]);bykind=collections.defaultdict(lambda:[0,0])
for r in rows:
    bytopic[r['topic']][1]+=1;bykind[r['kind']][1]+=1
    if r['grade']=='GOOD':bytopic[r['topic']][0]+=1;bykind[r['kind']][0]+=1
ai=sum(r['ai_post'] for r in rows);aigood=sum(r['ai_post'] and r['grade']=='GOOD' for r in rows)
sev={'WRONG_SCRIPT':0,'OFF_TOPIC_REFUSAL':1,'BAD_ACTION':2,'NOT_FOUND':3,'MISSED_DETAILS':4,'OTHER':5}
fails=[r for r in rows if r['grade']!='GOOD']
fails.sort(key=lambda r:(sev.get(r['grade'],9),r['kind']!='A',r['id']))
def line(r):
    s=r['script'][0] if r['script'] else None
    return f"`{s['line']}` ({s['via']})" if s else '— (no script tag)'
def say(r,n=220):
    t=' '.join(r['reply'].split());return (t[:n]+'…') if len(t)>n else t
out=[]
out.append('# Ask Tommy — live evaluation\n')
first=min(r['at'] for r in rows);last=max(r['at'] for r in rows)
out.append(f"Live site https://trojanhub.netlify.app, run {first[:16]}Z → {last[:16]}Z (site version with {rows[-1].get('site_cmds','?')} script commands). Raw data: `data/eval/results-{stamp}.json`. Test set: `data/eval/questions.json`.\n")
out.append(f"**{N} messages graded · pass rate {good}/{N} = {100*good/N:.0f}%** · {ai} messages ({100*ai/N:.0f}%) went to the AI translator (`POST /api/tommy`), {aigood} of those ended GOOD.\n")
untested=397-N
out.append(f'Coverage: the run was capped at 04:00 UTC to keep AI credits low, so {N} of the 397 messages in the test set ran. The order was interleaved across topics, so every topic is sampled; {untested} messages (mostly later items in each topic) were not sent. 14 earlier results from the pre-02:45 site version were discarded.\n')
out.append('Method: Playwright 402×874, one message every 15 s, a fresh page every 25 messages, `TA.UI.send(text)` then wait for `!TA.UI.busy`. Any pending action prompt (`TA.Brain.pending`) was cleared before each message so every message is graded on its own (see finding R1). No crisis or self-harm messages were sent. Each answer was graded by hand: does it answer exactly what was asked, every constraint included?\n')
out.append('## Results by category\n\n| Category | Count | Share |\n|---|---|---|')
for c in ['GOOD','MISSED_DETAILS','WRONG_SCRIPT','NOT_FOUND','OFF_TOPIC_REFUSAL','BAD_ACTION','OTHER']:
    out.append(f"| {c} | {cats.get(c,0)} | {100*cats.get(c,0)/N:.0f}% |")
out.append('\n## Pass rate by kind\n\n| Kind | Pass | Rate |\n|---|---|---|')
for k,(g,n) in sorted(bykind.items()):
    out.append(f"| {dict(A='A · questions',B='B · actions',other='Greetings / off-topic').get(k,k)} | {g}/{n} | {100*g/n:.0f}% |")
out.append('\n## Pass rate by topic\n\n| Topic | Pass | Rate |\n|---|---|---|')
for t,(g,n) in sorted(bytopic.items(),key=lambda x:x[1][0]/x[1][1]):
    out.append(f"| {t} | {g}/{n} | {100*g/n:.0f}% |")
out.append(f'\n## Top {min(50,len(fails))} failures\n\nOrdered by severity (wrong script first), then questions before actions.\n')
for i,r in enumerate(fails[:50],1):
    out.append(f"{i}. **{r['grade']}** · {r['id']} [{r['topic']}] **“{r['text']}”**  \n   Script: {line(r)}{' · AI call' if r['ai_post'] else ''}  \n   Tommy: _{say(r)}_  \n   Why: {r['grade_note']}\n")
if len(fails)>50:
    out.append('### Other failures (short)\n')
    for r in fails[50:]:
        out.append(f"- {r['grade']} · {r['id']} “{r['text']}” → {line(r)} — {r['grade_note']}")
rec=f'{SP}/recs.md'
if os.path.exists(rec): out.append('\n'+open(rec).read())
open(f'{REPO}/docs/TOMMY-EVAL.md','w').write('\n'.join(out)+'\n')
print(N,good,dict(cats),'ungraded',len(ungraded))
