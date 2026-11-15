// Generates data-driven test questions with expectations computed straight from the app's data (not from scripts-plus).
const out=[]; let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;}; const pick=a=>a[Math.floor(rnd()*a.length)];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const add=(topic,q,expect,oracle,extra)=>out.push(Object.assign({topic,q,expect:expect.map(String),oracle},extra||{}));
const S=TA.SOC, F='20263', SP='20271';
// ---- courses
const codes=['CSCI 104','CSCI 201','MATH 226','WRIT 150','PSYC 100','ECON 203','PHYS 151','CHEM 105A','BISC 120','ITP 115','CSCI 270','MATH 125','AHIS 120','COMM 200','ACCT 410','BUAD 280','EE 109','CTCS 190','LING 115','PHIL 140','HIST 266','DSO 211','SOCI 200','POSC 130','ARLT 100'];
const lc=c=>c.code.toLowerCase();
for (const code of codes) {
  const c=S.course(F,code)||S.course(SP,code); if(!c) continue; const term=S.course(F,code)?F:SP;
  const L=c.sections.filter(s=>!s.cancelled&&/lec/i.test(s.type)); const s0=L[0]||c.sections[0]; const m=(s0.meets||[])[0];
  const instr=(L.map(s=>s.instr).filter(Boolean)[0]||'').split(',')[0].trim().split(' ').pop();
  const v=pick([lc(c), c.code, c.code.replace(' ','')]);
  if(instr) add('course', pick(['who teaches '+v, 'whos the prof for '+v, v+' professor?', 'who is teaching '+v+' this semester']), [esc(instr)], {cmd:'course.who',args:{course:c.code}});
  if(m&&m.days) add('course', pick(['when does '+v+' meet','what time is '+v,v+' class times','what days is '+v+' on']), [esc(TA.fmtDays(m.days).split('/')[0]), esc(TA.fmtTime(m.start).replace(/ (AM|PM)/,''))], {cmd:'course.when',args:{course:c.code}});
  add('course', pick(['how many units is '+v,'is '+v+' 4 units','units for '+v, v+' how many credits']), ['\\b'+esc(String(c.units))+'\\b.{0,12}unit|units?.{0,20}\\b'+esc(String(c.units))+'\\b'], {cmd:'course.units',args:{course:c.code}});
  const pre=(c.prereq||[]).length?c.prereq[0][0]:null;
  add('course', pick(['prereqs for '+v,'what do i need before '+v,'what are the prerequisites for '+v, v+' prereq?']), [pre?esc(pre):'(no|none|n.t have|not list)'], {cmd:'course.prereqs',args:{course:c.code}});
  if(m&&m.start){ const f=S.finalFor(term,c.code,m.days,m.start,m.end); if(f) add('course', pick(['when is the '+v+' final','final exam for '+v,v+' final date']), [esc(f.day.split(',')[1]?f.day.split(', ')[1]:f.day)], {cmd:'course.final',args:{course:c.code}}); }
  if(c.desc) { const w=c.desc.split(/\s+/).slice(2,5).join(' ').replace(/[.,;:]$/,''); add('course', pick(['what is '+v+' about','describe '+v,'whats '+v+' cover']), [esc(w)], {cmd:'course.about',args:{course:c.code}}); }
  add('course', pick(['how many seats are left in '+v,'is '+v+' full','any spots open in '+v]), ['seat|full|open'], {cmd:'course.seats',args:{course:c.code}});
  const inSp=!!S.course(SP,c.code);
  add('course', pick(['is '+v+' offered in spring','can i take '+v+' next semester','is '+v+' available spring 2027']), [inSp?'Spring 2027':'(isn.t|not|no).{0,40}Spring 2027|Spring 2027.{0,40}(isn.t|not)'], {cmd:'course.offered',args:{course:c.code}});
}
add('course','does ahis 120 count for ge',['GE-A'],{cmd:'course.ge',args:{course:'AHIS 120'}});
add('course','what ge category is psyc 100',['GE-'],{cmd:'course.ge',args:{course:'PSYC 100'}});
add('course','classes about machine learning in spring',['machine learning|Machine Learning'],{cmd:'course.find',args:{topic:'machine learning',term:'spring'}});
add('course','any film classes on fridays',['CTCS|CTPR|CTAN|film|Film|Cinema'],{cmd:'course.find',args:{topic:'film',days:'F'}});
add('course','what does professor redekopp teach',['CSCI|EE'],{cmd:'course.prof',args:{name:'redekopp'}});
add('course','whats the course code for data structures',['CSCI 104'],{cmd:'course.code',args:{name:'data structures'}});
add('course','compare csci 103 and csci 104',['CSCI 103','CSCI 104'],{cmd:'course.compare',args:{a:'CSCI 103',b:'CSCI 104'}});
add('course','what is ge-c',['Social Analysis'],{cmd:'course.gecat',args:{cat:'C'}});
add('course','which classes count for ge-a in spring',['GE-A'],{cmd:'course.gelist',args:{cat:'A',term:'spring'}});
add('course','2 unit classes in spring',['2-unit|2 unit'],{cmd:'course.byunits',args:{units:'2'}});
add('course','list the labs for phys 151',['Lab'],{cmd:'course.sections',args:{course:'PHYS 151',type:'lab'}});
add('course','what csci classes are offered in spring',['CSCI 1\\d\\d'],{cmd:'course.dept',args:{prefix:'CSCI',term:'spring'}});
// ---- places
const now=TA.now(), tom=TH.addDays(TH.dayStart(now),1); const sat=TH.addDays(TH.dayStart(now),(6-now.getDay()+7)%7);
const PL=[['evk','evk'],['parkside','parkside'],['villagedh','village dining hall'],['leavey','leavey'],['doheny','doheny library'],['sel','science library'],['lyon','lyon center'],['vfit','village gym'],['seeds','seeds marketplace'],['panda','panda express'],['trojangrounds','trojan grounds'],['bookstore','bookstore'],['career','career center'],['finaid','financial aid office'],['cgjuice','c&g juice'],['literatea','literatea'],['traderjoes','trader joes'],['uac','the pool'],['popovich','popovich cafe'],['cafeannenberg','cafe annenberg']];
const rt=(p,d)=>{const r=TH.hoursHelpers.dayRanges(p,d); return r==null?'not published|unknown':!r.length?'closed|Closed':esc(TH.rangesText(r));};
for (const [id,al] of PL) { const p=TH.PLACES.find(x=>x.id===id); if(!p) continue;
  if(p.hours){ add('places', pick(['is '+al+' open','is '+al+' open rn',''+al+' open right now?','is '+al+' still open']), [esc(p.name.split(' ')[0])+'[^\\n]{0,80}|open|closed','(open|closed|Open|Closed)'], {cmd:'place.hours',args:{place:id}});
    add('places', pick(['what time does '+al+' close tomorrow',al+' hours tomorrow','when does '+al+' open tomorrow']), [rt(p,tom)], {cmd:'place.hours',args:{place:id,day:'tomorrow'}});
    add('places', pick([al+' hours saturday','is '+al+' open on saturday','what are '+al+' hours this saturday']), [rt(p,sat)], {cmd:'place.hours',args:{place:id,day:'saturday'}}); }
  if(p.address) add('places', pick(['where is '+al,'where is the '+al,'how do i get to '+al]), [esc(p.address.split(',')[0])], {cmd:'place.where',args:{place:id}});
  if(p.phone) add('places', pick(['phone number for '+al,'how do i contact '+al,al+' phone number']), [esc(p.phone.replace(/\D/g,'').slice(-4))], {cmd:'place.contact',args:{place:id}});
}
const openDining=TH.PLACES.filter(p=>p.cat==='dining'&&p.hours&&TH.openFor(p,now,0)===true).map(p=>p.name);
add('open', "what's open right now for food", openDining.length?[esc(openDining[0])]:['No '], {cmd:'open.now',args:{cat:'food'}});
add('open', 'anywhere to eat open rn', openDining.length?[esc(openDining[0])]:['No '], {cmd:'open.now',args:{cat:'food'}});
const openStudy=TH.PLACES.filter(p=>p.cat==='study'&&p.hours&&TH.openFor(p,now,0)===true).map(p=>p.name);
add('open', 'which libraries are open now', openStudy.length?[esc(openStudy[0])]:['No '], {cmd:'open.now',args:{cat:'study'}});
add('open', 'any gyms open right now', ['Lyon|Village Fitness|No '], {cmd:'open.now',args:{cat:'gym'}});
add('open', 'is there any coffee open', ['Coffee|Grounds|Literatea|caf|Café|No '], {cmd:'open.now',args:{cat:'coffee'}});
add('open', 'what food is open at 11pm', ['11 PM|No '], {cmd:'open.now',args:{cat:'food',at:'11pm'}});
add('open', 'what is open latest tonight for food', ['until'], {cmd:'open.late',args:{cat:'food'}});
add('open', 'which dining halls are open', ['EVK|Everybody'], {cmd:'dining.halls',args:{}});
add('open', 'are the dining halls open tomorrow', ['EVK|Everybody'], {cmd:'dining.halls',args:{day:'tomorrow'}});
add('open', 'closest bathroom', ['Restroom|restroom'], {cmd:'place.nearest',args:{cat:'restroom'}});
add('open', 'nearest place to eat', ['min walk'], {cmd:'place.nearest',args:{cat:'food'}});
add('open', 'where can i get boba', ['boba|Boba|tea|Tea|None'], {cmd:'place.search',args:{what:'boba'}});
add('open', 'how busy is evk right now', ['Est'], {cmd:'place.crowd',args:{place:'evk'}});
add('open', 'is evk open on thanksgiving', ['not published|Not published|not posted|unknown'], {cmd:'place.hours',args:{place:'evk',day:'thanksgiving'}});
add('open', 'lyon center hours this week', ['Mon','Sun'], {cmd:'place.week',args:{place:'lyon'}});
add('open', 'all gender bathrooms', ['All-gender|Gender-neutral'], {cmd:'restroom.allgender',args:{}});
// ---- dining
add('dining','when is breakfast at evk',['open and close times|7 AM'],{cmd:'dining.meals',args:{meal:'breakfast',place:'evk'}});
add('dining','what meal plans are there',['Cardinal','Flex120'],{cmd:'dining.plans',args:{}});
add('dining','how much is the cardinal plan',['4,219'],{cmd:'dining.plans',args:{plan:'cardinal'}});
add('dining','where can i use meal swipes',['EVK|Everybody'],{cmd:'dining.swipes',args:{}});
add('dining','does seeds take swipes',['Seeds'],{cmd:'dining.swipes',args:{place:'seeds'}});
add('dining','whats on the menu at parkside',['hospitality.usc.edu'],{cmd:'dining.menu',args:{place:'parkside'}});
add('dining','how long is the wait at panda',['Est'],{cmd:'dining.order',args:{place:'panda'}});
add('dining','can i use my uscard at the village',['City Tacos'],{cmd:'dining.village',args:{}});
add('dining','game day dining hours',['Lyft|game'],{cmd:'dining.gameday',args:{}});
// ---- offices
for (const [q,e,a] of [['financial aid office hours','9 AM|9:00 AM','financial aid'],['career center phone number','740-9111','career center'],['where is osas','3601 Watt','osas'],['its help desk number','740-5555','its'],['lost and found','740-9759','lost and found'],['housing office phone','740-2546','housing office'],['when does the bookstore close','8 PM|8:00 PM','bookstore'],['mail stop hours','Mail Stop','mail stop'],['transportation office phone','740-3575','transportation office'],['pharmacy phone number','821-6100','pharmacy']]) add('offices',q,[e],{cmd:'office.info',args:{office:a}});
// ---- transport
add('transport','when is the next bus to union station',['Union Station'],{cmd:'bus.next',args:{route:'union station'}});
add('transport','next shuttle to hsc',['HSC|Intercampus'],{cmd:'bus.next',args:{route:'hsc'}});
add('transport','is usc lyft running',['7 PM'],{cmd:'lyft.status',args:{}});
add('transport','what time does free lyft start',['7 PM'],{cmd:'lyft.status',args:{}});
add('transport','where can i take usc lyft',['Normandie'],{cmd:'lyft.rules',args:{}});
add('transport','can i take usc lyft to lax',['not covered|outside|does not go'],{cmd:'lyft.zone',args:{to:'lax'}});
add('transport','how do i get a u-pass',['U-Pass'],{cmd:'upass.info',args:{}});
add('transport','is the upass free',['No additional cost|Transportation Fee'],{cmd:'upass.info',args:{}});
add('transport','zipcar at usc',['\\$35'],{cmd:'zipcar.info',args:{}});
add('transport','closest metro station',['Expo Park|Jefferson/USC'],{cmd:'metro.info',args:{}});
add('transport','how do i get to lax',['LAX'],{cmd:'transport.lax',args:{}});
add('transport','how much is a parking permit',['612'],{cmd:'parking.info',args:{}});
add('transport','where can my parents park',['\\$20'],{cmd:'parking.visitor',args:{}});
add('transport','do i need to register my bike',['DPS'],{cmd:'bike.info',args:{}});
add('transport','what is the transportation fee',['151'],{cmd:'transport.fee',args:{}});
add('transport','metrolink student discount',['50%'],{cmd:'metrolink.info',args:{}});
add('transport','do the buses run on thanksgiving',['holiday|no USC bus|No USC bus'],{cmd:'bus.holidays',args:{day:'thanksgiving'}});
add('transport','is campus cruiser still a thing',['uspended'],{cmd:'transport.cruiser',args:{}});
add('transport','how do i get to hsc',['Intercampus|ICS'],{cmd:'transport.hsc',args:{}});
add('transport','union station shuttle schedule',['Union Station'],{cmd:'bus.schedule',args:{route:'union station'}});
// ---- safety
add('safety','dps phone number',['740-4321'],{cmd:'safety.contacts',args:{}});
add('safety','dps non emergency number',['740-6000'],{cmd:'safety.contacts',args:{topic:'non-emergency'}});
add('safety','when does campus close',['9 PM'],{cmd:'campus.access',args:{}});
add('safety','which gates are open after 9',['McCarthy'],{cmd:'campus.access',args:{}});
add('safety','safe walk',['LiveSafe|escort'],{cmd:'safety.escort',args:{}});
add('safety','can dps walk me home',['escort'],{cmd:'safety.escort',args:{}});
add('safety','what are blue light phones',['300'],{cmd:'safety.bluelight',args:{}});
add('safety','who are the yellow jackets',['Security Ambassadors|Allied'],{cmd:'safety.ambassadors',args:{}});
add('safety','any recent dps alerts',['DPS|Timely'],{cmd:'safety.alerts',args:{}});
add('safety','what is livesafe',['LiveSafe'],{cmd:'safety.livesafe',args:{}});
add('safety','how do i get usc emergency alerts',['TrojansAlert'],{cmd:'safety.trojansalert',args:{}});
add('safety','where is the dps station',['McClintock'],{cmd:'safety.dps',args:{}});
add('safety','clear bag policy',['12'],{cmd:'safety.gameday',args:{}});
add('safety','i lost my wallet on campus',['740-9759|Lost'],{cmd:'safety.lostfound',args:{}});
add('safety','noise complaint number',['740-6000'],{cmd:'safety.report',args:{}});
// ---- calendar
add('calendar','when is the last day to drop a class',['Nov 13|Oct 9'],{cmd:'cal.deadlines',args:{which:'drop'}});
add('calendar','last day to withdraw',['Nov 13'],{cmd:'cal.deadlines',args:{which:'withdraw'}});
add('calendar','spring 2027 add deadline',['Jan 29'],{cmd:'cal.deadlines',args:{term:'spring',which:'add'}});
add('calendar','when does spring semester start',['Jan 11'],{cmd:'cal.term',args:{term:'spring'}});
add('calendar','when is the last day of classes',['Dec 4'],{cmd:'cal.term',args:{}});
add('calendar','is there class on veterans day',['Veterans Day'],{cmd:'cal.holidays',args:{day:'veterans day'}});
add('calendar','when is thanksgiving break',['Nov 25'],{cmd:'cal.holidays',args:{}});
add('calendar','when are finals',['Dec 9|December 9'],{cmd:'cal.finals',args:{}});
add('calendar','how many days until thanksgiving',['16 days'],{cmd:'cal.countdown',args:{what:'thanksgiving'}});
add('calendar','when does registration open for spring',['Oct 26'],{cmd:'cal.registration',args:{}});
add('calendar','how much is tuition',['37,692'],{cmd:'cal.tuition',args:{}});
add('calendar','how much is an official transcript',['\\$12|\\$15'],{cmd:'cal.transcript',args:{}});
add('calendar','what deadlines are coming up',['Nov 13'],{cmd:'cal.upcoming',args:{}});
add('calendar','whats todays date',['November 9'],{cmd:'time.today',args:{}});
add('calendar','how much to replace my uscard',['\\$25'],{cmd:'uscard.info',args:{}});
// ---- clubs
for (const c of TH.CLUBS.filter(c=>c.meeting).slice(0,4)) add('clubs', pick(['when does '+c.name+' meet','when does '+c.name.toLowerCase()+' meet','what time does '+c.name+' meet']), [esc((c.meeting.days||[''])[0])], {cmd:'club.meets',args:{club:c.name}});
add('clubs','clubs about chess',['Trojan Chess Club'],{cmd:'club.find',args:{topic:'chess'}});
add('clubs','are there any kpop dance clubs',['K-?[Pp]op|KPOP|kpop'],{cmd:'club.find',args:{topic:'kpop dance'}});
add('clubs','pre law organizations',['[Ll]aw'],{cmd:'club.find',args:{topic:'pre law'}});
add('clubs','how do i join the trojan chess club',['engage.usc.edu'],{cmd:'club.join',args:{club:'trojan chess club'}});
add('clubs','what is the whine and cheese club',['unwind'],{cmd:'club.about',args:{club:'whine and cheese club'}});
add('clubs','how many clubs are there',['2000|2,000|800'],{cmd:'club.category',args:{}});
add('clubs','most active clubs',['events'],{cmd:'club.active',args:{}});
const withEv=TH.CLUBS.filter(c=>c.events>0)[0]; if(withEv) add('clubs','what events does '+withEv.name+' have',[esc(withEv.name.split(' ')[0])],{cmd:'club.events',args:{club:withEv.name}});
add('clubs','what clubs should i join',['match|Association|club|Club'],{cmd:'club.recommend',args:{}});
// ---- events
const d0=TH.dkey(now); const evToday=TH.events().filter(e=>!e.multiDay&&e.dkey===d0&&e.e>=now); const evFood=evToday.filter(e=>e.food);
add('events','events today',[evToday.length?esc(evToday[0].title.slice(0,25)):'No '],{cmd:'events.day',args:{day:'today'}});
add('events','whats going on tonight',['tonight|No |PM'],{cmd:'events.day',args:{day:'tonight'}});
add('events','anything happening on campus tomorrow',['Nov 10|tomorrow|Tomorrow'],{cmd:'events.day',args:{day:'tomorrow'}});
add('events','events this weekend',['Nov 14|weekend'],{cmd:'events.day',args:{day:'weekend'}});
add('events','free food today',[evFood.length?esc(evFood[0].title.slice(0,25)):'No '],{cmd:'events.food',args:{day:'today'}});
add('events','where can i get free food this week',['food'],{cmd:'events.food',args:{}});
add('events','career events this week',['[Cc]areer|No public'],{cmd:'events.search',args:{q:'career',days:'7'}});
add('events','whats happening right now',['now|Happening|No public events are happening'],{cmd:'events.now',args:{}});
add('events','whats happening this week',['public events'],{cmd:'events.week',args:{which:'this'}});
add('events','arts events this week',['Arts|arts'],{cmd:'events.cat',args:{cat:'arts'}});
add('events','tell me about the world food day market',['World Food Day'],{cmd:'event.info',args:{title:'world food day market'}});
// ---- account
const d=TA.State.d;
for (const [q,e,c] of [['how many swipes do i have left','47','my.dining'],['dining dollars balance','63\\.40','my.dining'],['how much is on my uscard','42\\.50','my.uscard'],['what do i owe','1,250','my.balance'],['when is my bill due','Nov 13','my.balance'],['where do i live','Cowlings','my.housing'],['when are my library books due','Nov 12','my.library'],['when is my registration appointment','Nov 3','my.registration'],['do i have any holds','none|no holds','my.registration'],['what classes am i taking','CSCI 104','my.classes'],['when is my next class','PHYS|MATH|CSCI|PSYC','my.next_class'],['when are my finals','December','my.finals'],['who is my advisor','Taylor Morgan','my.advisor'],['how many units am i taking','16','my.units'],['who are my professors','Slocum','my.profs'],['what classes do i have tomorrow','PHYS 151','my.classes_on'],['my orders','order','my.orders'],['my bookings','booking|reservation','my.bookings'],['what clubs am i in','club','my.clubs'],['whats my usc id','1234','my.profile'],['what is my major','Computer Science','my.profile'],['when am i free tomorrow','Free|free','my.free'],['how many guest swipes do i have','5','my.guestswipes'],['what does my week look like','Today|Tomorrow','my.week'],['any notifications','Welcome|otification','my.notifications'],['do i have a parking permit','permit','my.parking'],['my prescriptions','Cetirizine','my.health'],['what are my deadlines','Nov 1','my.deadlines'],['do any of my finals conflict','finals','my.final_conflicts'],['what did i save to my calendar','saved|calendar','my.calendar']]) add('account',q,[e],{cmd:c,args:{}});
// ---- misc
add('misc','tell me a fun fact about usc',['USC|Trojan|Tommy|Traveler'],{cmd:'usc.facts',args:{}});
add('misc','who is traveler',['Traveler'],{cmd:'usc.facts',args:{topic:'traveler'}});
add('misc','tell me about tommy trojan',['1930'],{cmd:'landmark.facts',args:{place:'tommy'}});
add('misc','does the ai see my grades',['only your words|never'],{cmd:'tommy.privacy',args:{}});
add('misc','where do you get your info',['Schedule of Classes|USC pages'],{cmd:'tommy.sources',args:{}});
return out;
