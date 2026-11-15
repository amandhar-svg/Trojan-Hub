/* js/feed.js */
/* Trojan Hub — the scrolling "For you" feed on Home, Tommy's watch list ("notify me when…"), weekly club
 * newsletters, guest passes and the USCard in Apple Wallet.
 *
 * Real data: EngageSC events (free food, major-specific picks, watch-list matches), club listings, the next home
 * game, campus access rules. Sample data (labeled in the UI): the "campus drops" (free gear) and every account
 * action, which runs on the demo student only. State lives in TH.H() (inside TA.State.d, so Tommy's Undo works).
 *
 * API: TH.watch.{add,remove,list,tick,hits,parse,summary}  TH.feed.{top,sections,mount}
 *      TH.news.{following,isFollowing,toggle,issues,issue,summary}  TH.guests.{list,active,summary}
 *      TH.act.{addWatch,removeWatch,scheduleWatch,followNews,unfollowNews,registerGuest,cancelGuest,addWalletPass,removeWalletPass}
 * Screens: watches, news, guests (+ the Wallet screen gets the Apple Wallet card).
 */
(function (TH) {
  'use strict';
  const esc = TH.esc, icon = (n, c) => TH.icon(n, c), fmtMin = m => TH.fmtMin(m);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const now = () => TH.clock.now(), today = () => TH.dayStart(now()), nowMin = () => TH.minOfDay(now());
  const uid = () => (window.TA && TA.uid) ? TA.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function hub() {
    const h = TH.H();
    ['watches', 'guests', 'newsSubs'].forEach(k => { if (!Array.isArray(h[k])) h[k] = []; });
    if (!h.newsRead || typeof h.newsRead !== 'object') h.newsRead = {};
    if (!h.newsMuted || typeof h.newsMuted !== 'object') h.newsMuted = {};
    if (h.walletPass === undefined) h.walletPass = null;
    return h;
  }
  const safeHub = () => { try { return hub(); } catch (e) { return { watches: [], guests: [], newsSubs: [], newsRead: {}, newsMuted: {}, walletPass: null, clubs: [], calendar: [] }; } };
  const R = () => ({ block: [], warn: [] });
  function reg(name, spec) { // same contract as js/actions.js
    TH.act.check[name] = (...a) => { try { const r = spec.check(...a); return { block: r.block, warn: r.warn }; } catch (e) { return { block: [e.message], warn: [] }; } };
    TH.act[name] = (...a) => { const r = spec.check(...a); if (r.block.length) throw new Error(r.block[0]); const out = spec.run(r.ctx, ...a); out.warn = r.warn; return out; };
  }
  const save = () => { if (window.TA && TA.State) TA.State.save(); };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const evWhen = e => `${TH.ui.dayLabel(e.date)}${e.allDay ? '' : ' · ' + fmtMin(e.start)}`;

  // =====================================================================
  // CAMPUS DROPS (sample): free gear and one-off perks that "arrive" at a time on the demo calendar
  // =====================================================================
  const NEXT_GAME = { date: '2026-11-21', opp: 'Maryland' };
  // off = days from the demo day, at = minute of day the drop opens, until = minute it closes
  const DROPS = [
    { id: 'd-towel', cat: 'gear', title: 'Free rally towel for the Maryland game', blurb: 'Show your USCard at the Trojan Athletics table. One per student while they last.', where: 'tcc', whereText: 'Tutor Campus Center, ground floor', off: 0, at: 720, until: 1020, tags: 'gear merch swag towel rally football game free usc giveaway' },
    { id: 'd-volley', cat: 'gear', title: 'Free Fight On bucket hat at Women’s Volleyball', blurb: 'First 300 students through the student entrance. Doors open one hour before first serve.', where: null, whereText: 'Galen Center, student entrance', off: 1, at: 1080, until: 1200, tags: 'gear merch swag hat volleyball game free usc giveaway galen' },
    { id: 'd-shirt', cat: 'gear', title: 'Student section T-shirt: USC vs. Maryland', blurb: 'Free shirt for the first 2,000 students at the student gate on game day.', where: null, whereText: 'Coliseum student gate', date: NEXT_GAME.date, at: 600, until: 900, tags: 'gear merch swag shirt tshirt t-shirt tee football game free usc giveaway coliseum student section' },
    { id: 'd-zip', cat: 'major', major: /computer science|engineering/i, title: 'Viterbi quarter-zip for CS majors', blurb: 'Fill out the 3-minute advising survey and pick one up. Viterbi undergrads only.', where: null, whereText: 'Ronald Tutor Hall lobby', off: 2, at: 660, until: 960, tags: 'gear merch swag viterbi quarter zip sweater jacket engineering computer science free giveaway' },
    { id: 'd-bike', cat: 'perk', title: 'Free bike tune-up and U-lock', blurb: 'Register your bike with DPS on the spot and get a free tune-up; U-locks for the first 100 registrations.', where: null, whereText: 'Trousdale Parkway, near Tommy Trojan', off: 3, at: 600, until: 840, tags: 'bike bicycle tune up tuneup lock ulock u-lock registration dps free' },
    { id: 'd-flu', cat: 'perk', title: 'Free flu shots, no appointment', blurb: 'Walk-up clinic for students with a USCard.', where: null, whereText: 'Engemann Student Health Center plaza', off: 1, at: 600, until: 900, tags: 'flu shot shots vaccine vaccination health free clinic' },
  ];
  function dropTimes(d) {
    const day = d.date ? TH.parseKey(d.date) : TH.addDays(TH.parseKey('2026-11-09'), d.off || 0);
    const a = new Date(day); a.setMinutes(d.at); const b = new Date(day); b.setMinutes(d.until);
    return { day, opens: a, closes: b };
  }
  // a drop is announced the morning it happens (8 AM); game-day drops are announced two days ahead
  function dropState(d, t = now()) {
    const { day, opens, closes } = dropTimes(d), announce = new Date(day); announce.setMinutes(480); if (d.date) announce.setDate(announce.getDate() - 2);
    return { day, opens, closes, announced: t >= announce, live: t >= opens && t < closes, over: t >= closes };
  }
  const dropWhen = d => { const s = dropState(d); return `${TH.ui.dayLabel(s.day)} · ${fmtMin(d.at)} – ${fmtMin(d.until)}`; };
  TH.DROPS = DROPS;
  const myMajor = () => { const s = TH.student(); return `${s.major || ''} ${s.school || ''}`; };
  const visibleDrops = () => DROPS.filter(d => { const s = dropState(d); return s.announced && !s.over && (!d.major || d.major.test(myMajor())); });

  // =====================================================================
  // WATCH LIST: "notify me when I can get my professional headshot taken for free"
  // =====================================================================
  const STOP = new Set(('a an the i me my we you your it is are be can could get got have has when if once soon as there theres there’s to for of on in at with and or any some that this be been do does ' +
    'notify tell let know ping alert text remind message email please want need would like able available arrives arrive arrived opens open happen happening happens comes come here ' +
    'taken take done free usc campus event events next new one time day today').split(' '));
  const SYN = {
    headshot: ['headshot', 'head shot', 'linkedin photo'], photo: ['headshot', 'photo booth', 'photoshoot', 'photo shoot'], picture: ['headshot', 'photo booth', 'photoshoot'],
    gear: ['gear', 'merch', 'swag', 'shirt', 'tee', 'hat', 'towel', 'giveaway'], merch: ['gear', 'merch', 'swag', 'shirt', 'hat', 'towel', 'giveaway'], swag: ['gear', 'merch', 'swag', 'shirt', 'hat', 'giveaway'],
    shirt: ['shirt', 'tee', 't-shirt', 'tshirt'], tshirt: ['shirt', 'tee', 't-shirt', 'tshirt'], tee: ['shirt', 'tee', 't-shirt'],
    food: ['food', 'pizza', 'lunch', 'dinner', 'snack', 'boba', 'taco', 'breakfast', 'refreshment'], boba: ['boba', 'bubble tea', 'milk tea', 'heytea'], coffee: ['coffee', 'latte', 'espresso', 'cafe'],
    resume: ['resume', 'résumé', 'cv'], internship: ['internship', 'intern', 'recruit'], career: ['career', 'recruit', 'employer', 'job'],
    flu: ['flu'], vaccine: ['vaccine', 'vaccination', 'flu shot', 'immuniz'], bike: ['bike', 'bicycle'], hackathon: ['hackathon', 'hack night', 'hack day'], puppy: ['puppy', 'puppies', 'dog', 'therapy dog'], dog: ['dog', 'puppy', 'puppies'],
    yoga: ['yoga'], meditation: ['meditat', 'mindful'], concert: ['concert', 'live music', 'performance'], movie: ['movie', 'film', 'screening'],
  };
  const WEAK = new Set(['professional', 'student', 'students', 'club', 'good', 'best', 'cheap', 'ticket', 'tickets']);
  const stemw = w => w.replace(/’s$|'s$/, '').replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1');
  function parse(text) {
    let t = String(text || '').toLowerCase().replace(/[“”"]/g, '').trim();
    t = t.replace(/^(hey |hi |ok |okay )?(tommy[, ]+)?(can you |could you |will you |please |pls )*/, '')
      .replace(/^(notify|tell|ping|alert|text|remind|message|email|let) me( know)?\s*(when(ever)?|if|once|as soon as|the moment|about)?\s*/, '')
      .replace(/^(watch (out )?for|look out for|keep an eye out for|keep an eye on|add a watch for|watch)\s*/, '')
      .replace(/^(i can|i could|we can|there is|there’s|there's|there are|they have|they are|theres|someone is|usc has|usc is)\s*/, '')
      .replace(/^(get|find|grab|have|score|do|sign up for|go to|attend)\s+/, '').replace(/^(my|a|an|the|some|any)\s+/, '')
      .replace(/\s+(is|are|becomes?|gets?) (available|here|open|announced|posted|back|happening)\b.*$/, '').replace(/\s+(arrives?|opens?|drops?|happens?|comes? (up|out|back))\b.*$/, '')
      .replace(/[.?!]+$/, '').trim();
    const wantsFree = /\bfree\b/.test(String(text).toLowerCase());
    const words = t.replace(/[^a-z0-9’' -]+/g, ' ').split(/\s+/).map(stemw).filter(w => w && w.length > 1 && !STOP.has(w));
    const strong = words.filter(w => !WEAK.has(w));
    let label = t.replace(/\b(taken|done)\b/g, '').replace(/\bfor free\b/, '').replace(/\s+/g, ' ').trim();
    if (wantsFree && !/^free\b/.test(label)) label = 'free ' + label;
    const foodOnly = !strong.length && /\bfood\b/.test(t) || (strong.length === 1 && strong[0] === 'food');
    return { label: cap(label || 'something new'), terms: strong.length ? strong : words, free: wantsFree, food: foodOnly };
  }
  const variants = w => (SYN[w] || [w]);
  const wordIn = (hay, v) => new RegExp('(^|[^a-z0-9])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?([^a-z0-9]|$)').test(hay);
  function matches(terms, hay) { return terms.length > 0 && terms.every(w => variants(w).some(v => wordIn(hay, v))); }
  function findHit(w) {
    const t = now(), terms = w.terms || [];
    // 1) real EngageSC events that have not ended
    const evs = TH.events().filter(e => { const end = new Date(e.date); end.setMinutes(e.allDay ? 1439 : Math.min(e.end, 1439)); return end >= t && !e.multiDay; });
    const ev = evs.find(e => w.food ? e.food : matches(terms, `${e.title} ${e.desc} ${(e.cats || []).join(' ')} ${e.type}`.toLowerCase()));
    // 2) sample campus drops that have been announced
    const dr = visibleDrops().find(d => matches(terms, `${d.title} ${d.blurb} ${d.tags}`.toLowerCase()));
    const evAt = ev ? ev.s : null, drAt = dr ? dropTimes(dr).opens : null;
    if (ev && (!dr || evAt <= drAt)) return { kind: 'event', id: ev.id, title: ev.title, when: evWhen(ev), where: ev.location ? TH.shortLoc(ev.location) : (ev.org || ''), org: ev.org || '', food: !!ev.food };
    if (dr) return { kind: 'drop', id: dr.id, title: dr.title, when: dropWhen(dr), where: dr.whereText, place: dr.where || null, sample: true };
    return null;
  }
  const W = TH.watch = {};
  W.parse = parse;
  W.list = () => safeHub().watches;
  W.hits = () => W.list().filter(w => w.hit && !w.dismissed);
  W.waiting = () => W.list().filter(w => !w.hit);
  W.summary = () => { const n = W.list().length, h = W.hits().filter(w => !w.scheduled).length; return n ? `${n} watching${h ? ` · ${h} ready now` : ''}` : 'Tell Tommy what to look out for'; };
  // check every waiting watch against today's listings; a match becomes a notification and pins to Home
  W.tick = function (quiet) {
    let changed = false, h; try { h = hub(); } catch (e) { return false; }
    h.watches.forEach(w => {
      if (w.hit) return;
      const hit = findHit(w); if (!hit) return;
      w.hit = hit; w.hitAt = now().getTime(); changed = true;
      if (!quiet) TH.notify(`It’s here: ${w.label}`, `${hit.title} · ${hit.when}${hit.where ? ' · ' + hit.where : ''}`, 'watches');
    });
    if (changed) { save(); if (!quiet && TH.state && TH.state.route === 'home' && !$('.sheet-wrap')) TH.render(true); }
    return changed;
  };
  reg('addWatch', {
    check(text) {
      const r = R(), p = parse(text);
      if (!String(text || '').trim() || !p.terms.length) { r.block.push('Tell me what to watch for, like “free professional headshots” or “free USC gear”.'); return r; }
      if (hub().watches.some(w => w.label.toLowerCase() === p.label.toLowerCase())) r.block.push(`I’m already watching for “${p.label}”.`);
      if (hub().watches.length >= 12) r.block.push('Your watch list is full (12). Remove one first.');
      r.ctx = { p };
      return r;
    },
    run({ p }, text) {
      const w = { id: 'w' + uid(), label: p.label, terms: p.terms, food: p.food, text: String(text).slice(0, 200), at: now().getTime(), hit: null };
      const hit = findHit(w);
      if (hit) { w.hit = hit; w.hitAt = w.at; }
      hub().watches.unshift(w);
      return {
        title: hit ? `Good news: I already found “${p.label}”` : `Watching for “${p.label}”`,
        rows: hit ? [['Found', hit.title], ['When', hit.when], ...(hit.where ? [['Where', hit.where]] : []), ['Pinned', 'Top of Home until you dismiss it']] : [['Watching for', p.label], ['I check', 'EngageSC events and campus drops, every time the app refreshes'], ['When it shows up', 'A notification, and it becomes the first thing on Home']],
        log: hit ? `Added a watch for “${p.label}” and matched it to ${hit.title}` : `Added a watch for “${p.label}”`,
        item: w,
      };
    },
  });
  reg('removeWatch', {
    check(id) { const r = R(), w = hub().watches.find(x => x.id === id); if (!w) r.block.push('That watch isn’t on your list.'); r.ctx = { w }; return r; },
    run({ w }) { const h = hub(); h.watches = h.watches.filter(x => x.id !== w.id); return { title: `Stopped watching for “${w.label}”`, rows: [['Removed', w.label]], log: `Removed the watch for “${w.label}”`, item: w }; },
  });
  // "Have Tommy schedule it": a matched EngageSC event goes on the calendar (same rules as Save event)
  reg('scheduleWatch', {
    check(id) {
      const r = R(), w = hub().watches.find(x => x.id === id);
      if (!w || !w.hit) { r.block.push('Nothing has arrived for that watch yet.'); return r; }
      if (w.hit.kind === 'event') { const c = TH.act.check.saveEvent(w.hit.id); if (c.block.length && !/already/i.test(c.block[0])) r.block.push(...c.block); r.warn.push(...c.warn); r.already = c.block.some(b => /already/i.test(b)); }
      r.ctx = { w, already: r.already };
      return r;
    },
    run({ w, already }) {
      let rows = [['What', w.hit.title], ['When', w.hit.when]];
      if (w.hit.kind === 'event' && !already) { const res = TH.act.saveEvent(w.hit.id); rows = res.rows || rows; }
      w.scheduled = true;
      return { title: `Scheduled: ${w.hit.title}`, rows, log: `Scheduled ${w.hit.title} from the watch “${w.label}”`, item: w };
    },
  });

  function hitCard(w) {
    const h = w.hit, isEv = h.kind === 'event';
    return `<div class="card hitcard ${w.scheduled ? 'done' : ''}">
      <span class="hit-eyebrow">${icon('sparkle')} You asked Tommy · ${esc(w.label)}</span>
      <b class="hit-title">${esc(h.title)}</b>
      <span class="hit-meta">${icon('clock')}${esc(h.when)}${h.where ? ` &nbsp;${icon('pin')}${esc(h.where)}` : ''}</span>
      ${h.sample ? `<span class="pill mute">Sample drop</span>` : ''}
      <div class="btn-row">${w.scheduled ? `<span class="pill ok">${icon('check')}On your calendar</span>` : isEv ? `<button class="btn sm gold" data-w-sched="${esc(w.id)}">${icon('calendar-plus')} Have Tommy schedule it</button>` : (h.place ? `<button class="btn sm gold" data-place="${esc(h.place)}">${icon('walk')} Walk there</button>` : '')}
        ${isEv ? `<button class="btn sm ghost" data-event="${esc(h.id)}">Details</button>` : ''}<button class="btn sm line" data-w-dismiss="${esc(w.id)}">${w.scheduled ? 'Done' : 'Dismiss'}</button></div></div>`;
  }
  function bindWatch(root) {
    root.addEventListener('click', e => {
      const s = e.target.closest('[data-w-sched]'), d = e.target.closest('[data-w-dismiss]'), x = e.target.closest('[data-w-remove]'), q = e.target.closest('[data-w-ask]');
      if (s) { e.stopPropagation(); TH.runAct('scheduleWatch', [s.dataset.wSched], 'On your calendar'); }
      else if (d) { e.stopPropagation(); const w = hub().watches.find(v => v.id === d.dataset.wDismiss); if (w) { w.dismissed = true; save(); TH.render(true); } }
      else if (x) { e.stopPropagation(); TH.runAct('removeWatch', [x.dataset.wRemove]); }
      else if (q) { e.stopPropagation(); addFromInput(q.dataset.wAsk); }
    });
    const f = $('#watch-form', root);
    if (f) f.addEventListener('submit', e => { e.preventDefault(); const i = $('#watch-q', f); addFromInput(i.value); });
  }
  function addFromInput(text) {
    const res = TH.runAct('addWatch', [text], null);
    if (res && res.item && res.item.hit) TH.toast('Found one already. It’s pinned at the top.', 'sparkle');
  }
  const SUGGEST = ['Free professional headshots', 'Free USC gear', 'Free boba', 'Resume reviews', 'Free flu shots'];
  function watchBox(compact) {
    const list = W.list(), have = new Set(list.map(w => w.label.toLowerCase()));
    return `<div class="card watchbox">
      <span class="hit-eyebrow">${icon('eye')} Tell Tommy what you want</span>
      <b>“Notify me when…”</b>
      <form id="watch-form" class="watch-form"><label class="sr" for="watch-q">What should Tommy watch for?</label><input id="watch-q" type="text" placeholder="I can get a free professional headshot" autocomplete="off" maxlength="120"><button class="btn sm" type="submit">${icon('plus')} Watch</button></form>
      <div class="chips">${SUGGEST.filter(s => !have.has(s.toLowerCase())).slice(0, compact ? 3 : 5).map(s => `<button type="button" class="chip" data-w-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      ${compact && list.length ? `<button class="linkbtn" data-go="watches">${icon('eye')} ${list.length} on your watch list</button>` : ''}
      <span class="muted tiny">Tommy checks EngageSC events and campus drops for you. When one shows up you get a notification and it’s the first thing on Home.</span></div>`;
  }

  TH.screens = TH.screens || {};
  TH.screens.watches = {
    render() {
      W.tick(true);
      const list = W.list(), hits = list.filter(w => w.hit), waiting = list.filter(w => !w.hit);
      const row = w => `<div class="row" style="--rc:${w.hit ? 'var(--ok)' : 'var(--gold-ink)'}"><span class="rico">${icon(w.hit ? 'check' : 'eye')}</span><span class="rmain"><span class="rtitle wrap">${esc(w.label)}</span><span class="rsub wrap">${w.hit ? `${esc(w.hit.title)} · ${esc(w.hit.when)}${w.scheduled ? ' · on your calendar' : ''}` : 'Still watching · nothing listed yet'}</span></span><button class="iconbtn flat sm" data-w-remove="${esc(w.id)}" aria-label="Stop watching for ${esc(w.label)}">${icon('trash')}</button></div>`;
      return `<div class="screen">${TH.ui.topbar('Tommy’s Watch List')}<div class="pad screen-body stack">
        ${watchBox(false)}
        ${hits.filter(w => !w.dismissed).map(hitCard).join('')}
        ${list.length ? `<div class="section"><div class="section-head"><h2>Watching</h2><span class="muted tiny">${waiting.length} waiting · ${hits.length} found</span></div><div class="rows">${waiting.concat(hits).map(row).join('')}</div></div>`
          : `<div class="empty">${icon('eye')}<b>Nothing on your watch list</b><span>Type what you’re waiting for above, or tell Tommy “notify me when I can get free USC gear”.</span></div>`}
        <button class="btn ghost block" data-go="assistant:${esc('Notify me when I can get a free professional headshot')}">${icon('sparkle')} Ask Tommy to watch for something</button>
      </div></div>`;
    },
    mount(host) { bindWatch(host); },
  };

  // =====================================================================
  // HOME FEED
  // =====================================================================
  const MAJOR_RE = () => {
    const m = myMajor().toLowerCase();
    if (/computer science|engineering|viterbi/.test(m)) return /viterbi|engineer|computer science|\bcs\b|coding|software|hack|data science|machine learning|\bai\b|robot|cyber|startup|tech\b/i;
    if (/business|marshall|account/.test(m)) return /marshall|business|finance|consult|account|entrepreneur|marketing/i;
    if (/cinema|film/.test(m)) return /cinema|film|screen|sca\b/i;
    return /career|research|workshop/i;
  };
  const F = TH.feed = {};
  // first thing on Home: everything on the watch list that has arrived
  F.top = function () {
    W.tick(true);
    const hits = W.hits().filter(w => !(w.scheduled && w.hitAt && now().getTime() - w.hitAt > 864e5));
    return hits.length ? `<div class="feed-top">${hits.map(hitCard).join('')}</div>` : '';
  };
  const band = (cls, ic, title, sub, go, goLabel) => `<div class="feed-band ${cls}"><span class="fb-ic">${icon(ic)}</span><span class="fb-t"><b>${esc(title)}</b><small>${esc(sub)}</small></span>${go ? `<button data-go="${esc(go)}">${esc(goLabel || 'See all')}</button>` : ''}</div>`;
  F.sections = function () {
    const t = now(), nm = nowMin(), all = TH.events(), A = TH.acad, st = TH.student(), out = [];
    // ---- due soon (homework)
    if (A) {
      const due = A.upcoming(3).filter(i => !A.isDone(i)).slice(0, 8), ex = A.nextExams(1)[0];
      if (due.length || ex) out.push(`<section class="feed-sec">${band('study', 'pencil', 'Due soon', due.length ? `${due.length} thing${due.length === 1 ? '' : 's'} in the next 3 days` : 'You’re caught up', 'plans:week', 'Week')}
        <div class="carousel">${ex && (ex.day - today()) / 864e5 <= 14 ? `<button class="card duecard exam" data-go="plans:month" style="--dc:var(--cardinal)"><span class="mono">${esc(ex.kind === 'final' ? 'FINAL' : 'MIDTERM')} · in ${Math.max(0, Math.round((ex.day - today()) / 864e5))} d</span><b>${esc(ex.course)} ${esc(ex.title)}</b><span class="muted">${esc(TH.fmtDate(ex.day))} · ${fmtMin(ex.start)}</span></button>` : ''}
          ${due.map(i => `<button class="card duecard" data-go="plans:week" style="--dc:${i.color}"><span class="mono">${esc(i.course)} · ${esc(TH.ui.dayLabel(i.date))}</span><b>${esc(i.title)}</b><span class="muted">Due ${esc(A.dueLabel(i))}</span></button>`).join('')}</div></section>`);
    }
    // ---- free food today (real EngageSC listings flagged as serving food)
    let food = all.filter(e => e.food && e.off === 0 && !e.multiDay && (e.allDay || e.end > nm)), foodDay = 'today';
    if (!food.length) { food = all.filter(e => e.food && e.off === 1 && !e.multiDay); foodDay = 'tomorrow'; }
    if (!food.length) { food = all.filter(e => e.food && e.off > 1 && e.off <= 6 && !e.multiDay).slice(0, 8); foodDay = 'this week'; }
    out.push(`<section class="feed-sec">${band('food', 'fork', `Free food ${foodDay}`, food.length ? `${food.length} event${food.length === 1 ? '' : 's'} with food on EngageSC` : 'Nothing listed right now', 'events:food', 'All')}
      ${food.length ? `<div class="carousel">${food.slice(0, 10).map(TH.evCard).join('')}</div>` : `<p class="muted">No free-food events are listed for the next few days. <button class="linkbtn" data-w-ask="Free food">Have Tommy watch for it</button></p>`}</section>`);
    // ---- for your major
    const re = MAJOR_RE(), mj = all.filter(e => e.off >= 0 && e.off <= 14 && !e.multiDay && (e.off > 0 || e.allDay || e.end > nm) && re.test(`${e.title} ${e.org} ${e.desc}`)).slice(0, 10);
    const majorName = (st.major || 'your major').replace(/\s*\(.*\)$/, '');
    const mdrops = visibleDrops().filter(d => d.cat === 'major');
    if (mj.length || mdrops.length) out.push(`<section class="feed-sec">${band('major', 'grad', `For ${majorName} majors`, `${esc(st.school || 'Your school')} · next two weeks`, 'events', 'Events')}
      <div class="carousel">${mdrops.map(dropCard).join('')}${mj.map(TH.evCard).join('')}</div></section>`);
    // ---- free USC gear & game days (sample drops + the real next home game)
    const gear = visibleDrops().filter(d => d.cat === 'gear'), perks = visibleDrops().filter(d => d.cat === 'perk');
    const gd = TH.parseKey(NEXT_GAME.date), gOff = Math.round((gd - today()) / 864e5);
    out.push(`<section class="feed-sec">${band('gear', 'shirt', 'Free USC gear', gOff >= 0 ? `Next home game: vs. ${NEXT_GAME.opp}, ${TH.fmtDate(gd)}` : 'Giveaways at games and on Trousdale', 'gameday', 'Game day')}
      ${gear.length ? `<div class="carousel">${gear.map(dropCard).join('')}</div>` : `<p class="muted">No gear drops announced right now. <button class="linkbtn" data-w-ask="Free USC gear">Have Tommy watch for it</button></p>`}</section>`);
    if (perks.length) out.push(`<section class="feed-sec">${band('perk', 'gift', 'Free on campus', 'One-off perks worth the walk', null)}<div class="carousel">${perks.map(dropCard).join('')}</div></section>`);
    // ---- tell Tommy what you want
    out.push(`<section class="feed-sec">${watchBox(true)}</section>`);
    // ---- newsletters
    const iss = N.issues().slice(0, 6);
    out.push(`<section class="feed-sec">${band('news', 'mail', 'This week from your clubs', iss.length ? `${iss.filter(i => !i.read).length} unread newsletter${iss.filter(i => !i.read).length === 1 ? '' : 's'}` : 'Follow any club to get its weekly digest', 'news', 'Inbox')}
      ${iss.length ? `<div class="carousel">${iss.map(issueCard).join('')}</div>` : `<button class="card promo" data-go="clubs"><span class="qi">${icon('mail')}</span><span style="flex:1"><b>Pick clubs to follow</b><br><span class="muted" style="font-size:13px">You don’t have to join. Follow any club and its week lands here every Monday.</span></span>${icon('chev')}</button>`}</section>`);
    return out.join('');
  };
  function dropCard(d) {
    const s = dropState(d);
    return `<button class="card dropcard ${s.live ? 'live' : ''}" data-drop="${esc(d.id)}"><span class="drop-art ${esc(d.cat)}">${icon(d.cat === 'gear' ? 'shirt' : d.cat === 'major' ? 'grad' : 'gift')}<i>${s.live ? 'On now' : esc(TH.ui.dayLabel(s.day))}</i></span>
      <span class="evbody"><span class="mono muted" style="font-size:12px">${esc(dropWhen(d))}</span><h3>${esc(d.title)}</h3><span class="muted" style="font-size:12.5px">${esc(d.whereText)}</span></span></button>`;
  }
  function openDrop(id) {
    const d = DROPS.find(x => x.id === id); if (!d) return;
    const s = dropState(d), p = d.where && TH.byId[d.where];
    TH.sheet(`<div class="stack"><div class="sheet-head"><h2>${esc(d.title)}</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="tags"><span class="pill ${s.live ? 'ok' : 'mute'}">${s.live ? 'On now' : 'Coming up'}</span><span class="pill mute">Sample drop</span></div>
      <p>${esc(d.blurb)}</p>
      <dl class="kv"><dt>When</dt><dd>${esc(dropWhen(d))}</dd><dt>Where</dt><dd>${esc(d.whereText)}</dd></dl>
      <div class="btn-row">${p ? `<button class="btn" data-walk-to="${esc(p.id)}">${icon('walk')} Walk there</button>` : ''}<button class="btn ghost" data-w-ask="${esc(d.cat === 'gear' ? 'Free USC gear' : d.title)}">${icon('eye')} Watch for more like this</button></div>
      <p class="simnote">${icon('info')}<span>Campus drops are sample content that shows how giveaways would appear. USC doesn’t publish a feed of them yet.</span></p></div>`, w => {
      bindWatch(w);
      const b = $('[data-walk-to]', w); if (b) b.onclick = () => { TH.state.pendingRoute = { to: b.dataset.walkTo }; TH.closeSheet(); TH.go('map'); };
    });
  }
  F.mount = function (host) {
    bindWatch(host);
    host.addEventListener('click', e => { const d = e.target.closest('[data-drop]'); if (d) return openDrop(d.dataset.drop); const n = e.target.closest('[data-issue]'); if (n) openIssue(n.dataset.issue); });
  };

  // =====================================================================
  // WEEKLY CLUB NEWSLETTERS (compiled from each club's public EngageSC listing)
  // =====================================================================
  const N = TH.news = {};
  const weekStart = () => { const t = today(); return TH.addDays(t, -((t.getDay() + 6) % 7)); };      // Monday
  const weekKey = () => TH.dkey(weekStart());
  N.following = function () { // joined clubs are followed automatically unless muted; plus anything the student follows
    const h = safeHub(), ids = [];
    (h.clubs || []).forEach(c => { if (!h.newsMuted[c.id]) ids.push(String(c.id)); });
    h.newsSubs.forEach(id => { if (!ids.includes(String(id))) ids.push(String(id)); });
    return ids;
  };
  N.isFollowing = id => N.following().includes(String(id));
  N.issue = function (clubId) {
    const c = TH.clubById(clubId); if (!c) return null;
    const ws = weekStart(), we = TH.addDays(ws, 7), next = TH.addDays(ws, 14), h = safeHub();
    const evs = (TH.CLUB_EVENTS || []).filter(e => String(e.orgId) === String(c.id) && e.start).map(e => [e, TH.laDate(e.start), TH.laDate(e.end || e.start)]).filter(([e, s, en]) => en >= ws && s < next && !e.multiDay).sort((a, b) => a[1] - b[1]);
    const thisWk = evs.filter(([, s]) => s < we).map(x => x[0]), nextWk = evs.filter(([, s]) => s >= we).map(x => x[0]);
    const ongoing = (TH.CLUB_EVENTS || []).filter(e => String(e.orgId) === String(c.id) && e.multiDay && TH.laDate(e.end || e.start) >= today()).slice(0, 2);
    const id = `${c.id}@${weekKey()}`;
    return { id, club: c, week: ws, thisWk, nextWk, ongoing, read: !!h.newsRead[id], joined: (h.clubs || []).some(x => String(x.id) === String(c.id)), headline: thisWk[0] ? thisWk[0].title : nextWk[0] ? `Next week: ${nextWk[0].title}` : c.meeting ? 'Meeting as usual this week' : 'A quiet week' };
  };
  N.issues = () => N.following().map(N.issue).filter(Boolean).sort((a, b) => (a.read - b.read) || (b.thisWk.length - a.thisWk.length));
  N.summary = () => { const i = N.issues(), u = i.filter(x => !x.read).length; return i.length ? `${i.length} club${i.length === 1 ? '' : 's'} followed${u ? ` · ${u} unread` : ''}` : 'Follow any club for its weekly digest'; };
  reg('followNews', {
    check(clubId) { const r = R(), c = TH.clubById(clubId); if (!c) { r.block.push('That group isn’t in the EngageSC directory.'); return r; } if (N.isFollowing(c.id)) r.block.push(`You already get ${c.name}’s weekly newsletter.`); r.ctx = { c }; return r; },
    run({ c }) { const h = hub(); delete h.newsMuted[c.id]; if (!h.newsSubs.map(String).includes(String(c.id)) && !(h.clubs || []).some(x => String(x.id) === String(c.id))) h.newsSubs.push(c.id); const is = N.issue(c.id); return { title: `Following ${c.name}`, rows: [['Newsletter', `${c.name} Weekly`], ['Arrives', 'Every Monday, in Club Newsletters and on Home'], ['This week', is.headline]], log: `Followed ${c.name}’s weekly newsletter`, item: c }; },
  });
  reg('unfollowNews', {
    check(clubId) { const r = R(), c = TH.clubById(clubId); if (!c) { r.block.push('That group isn’t in the EngageSC directory.'); return r; } if (!N.isFollowing(c.id)) r.block.push(`You don’t follow ${c.name}’s newsletter.`); r.ctx = { c }; return r; },
    run({ c }) { const h = hub(); h.newsSubs = h.newsSubs.filter(x => String(x) !== String(c.id)); if ((h.clubs || []).some(x => String(x.id) === String(c.id))) h.newsMuted[c.id] = true; return { title: `Unfollowed ${c.name}`, rows: [['Newsletter', `${c.name} Weekly`], ['Status', 'Stopped']], log: `Unfollowed ${c.name}’s weekly newsletter`, item: c }; },
  });
  const wkLabel = d => `Week of ${TH.MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  function issueCard(i) {
    return `<button class="card newscard ${i.read ? 'read' : ''}" data-issue="${esc(i.club.id)}"><span class="mono muted" style="font-size:11.5px">${esc(wkLabel(i.week))}${i.read ? '' : ' · <b class="unread">NEW</b>'}</span><b>${esc(i.club.name)}</b><span class="nc-head">${esc(i.headline)}</span><span class="muted" style="font-size:12px">${i.thisWk.length} this week · ${i.nextWk.length} next</span></button>`;
  }
  function openIssue(clubId) {
    const i = N.issue(clubId); if (!i) return;
    const c = i.club, m = c.meeting, h = hub();
    if (!h.newsRead[i.id]) { h.newsRead[i.id] = now().getTime(); save(); }
    const ev = e => `<button class="nl-ev" data-event="${esc(e.id)}"><b>${esc(e.title)}</b><span>${esc(TH.when(e))}${e.location ? ' · ' + esc(TH.shortLoc(e.location)) : ''}</span>${e.food ? `<span class="pill gold">★ Free food</span>` : ''}</button>`;
    TH.sheet(`<div class="stack newsletter">
      <div class="sheet-head"><div><span class="eyebrow">${esc(wkLabel(i.week))} · Weekly newsletter</span><h2>${esc(c.name)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="nl-sec"><h3>This week</h3>${i.thisWk.length ? i.thisWk.map(ev).join('') : `<p class="muted">No public events this week.</p>`}</div>
      ${m ? `<div class="nl-sec"><h3>When they meet</h3><p>${esc([(m.days || []).join(' & '), m.time, m.place].filter(Boolean).join(' · '))}</p></div>` : ''}
      ${i.nextWk.length ? `<div class="nl-sec"><h3>Coming up next week</h3>${i.nextWk.map(ev).join('')}</div>` : ''}
      ${i.ongoing.length ? `<div class="nl-sec"><h3>All semester</h3>${i.ongoing.map(ev).join('')}</div>` : ''}
      ${c.desc ? `<div class="nl-sec"><h3>About</h3><p>${esc(c.desc.length > 320 ? c.desc.slice(0, 317) + '…' : c.desc)}</p></div>` : ''}
      <div class="btn-row"><button class="btn ghost" data-club="${esc(c.id)}">${icon('users')} Club page</button><button class="btn line" id="nl-unf">${icon('x')} Unfollow</button></div>
      <p class="simnote">${icon('info')}<span>Put together automatically each Monday from this club’s public EngageSC listing. It isn’t written by the club’s officers.</span></p></div>`, w => {
      $('#nl-unf', w).onclick = () => { TH.closeSheet(); TH.runAct('unfollowNews', [c.id]); };
    });
  }
  N.open = openIssue;
  TH.screens.news = {
    render() {
      const iss = N.issues(), h = safeHub();
      // suggestions: clubs with something on this week that the student does not follow yet
      const ws = weekStart(), we = TH.addDays(ws, 7), seen = new Set(N.following());
      const counts = {}; (TH.CLUB_EVENTS || []).forEach(e => { if (!e.start || e.multiDay) return; const s = TH.laDate(e.start); if (s >= ws && s < we && !seen.has(String(e.orgId))) counts[e.orgId] = (counts[e.orgId] || 0) + 1; });
      const sug = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => [TH.clubById(id), n]).filter(x => x[0]);
      return `<div class="screen">${TH.ui.topbar('Club Newsletters')}<div class="pad screen-body stack">
        <p class="muted" style="font-size:13.5px">${esc(wkLabel(ws))}. One digest per club, every Monday. Follow any club you’re curious about; you don’t have to join.</p>
        ${iss.length ? `<div class="rows">${iss.map(i => `<button class="row" data-issue="${esc(i.club.id)}" style="--rc:var(--c-fitness)"><span class="rico">${icon('mail')}</span><span class="rmain"><span class="rtitle wrap">${esc(i.club.name)}${i.read ? '' : ' <span class="pill gold">New</span>'}</span><span class="rsub wrap">${esc(i.headline)} · ${i.thisWk.length} this week${i.joined ? ' · member' : ''}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div>`
          : `<div class="empty">${icon('mail')}<b>No newsletters yet</b><span>Follow a club below, or open any club and tap “Get the weekly newsletter”.</span></div>`}
        ${sug.length ? `<div class="section"><div class="section-head"><h2>Busy this week</h2><button data-go="clubs">All clubs</button></div><div class="rows">${sug.map(([c, n]) => `<div class="row" style="--rc:var(--c-study)"><button class="rico" data-club="${esc(c.id)}" aria-label="Open ${esc(c.name)}">${icon('users')}</button><button class="rmain" data-club="${esc(c.id)}"><span class="rtitle wrap">${esc(c.name)}</span><span class="rsub">${n} event${n === 1 ? '' : 's'} this week · ${esc(TH.clubCatLabel ? TH.clubCatLabel(c.cat) : c.cat)}</span></button><button class="btn sm ghost" data-follow="${esc(c.id)}">Follow</button></div>`).join('')}</div></div>` : ''}
        <button class="btn ghost block" data-go="clubs">${icon('search')} Find a club to follow</button>
      </div></div>`;
    },
    mount(host) {
      host.addEventListener('click', e => { const f = e.target.closest('[data-follow]'); if (f) { e.stopPropagation(); return TH.runAct('followNews', [f.dataset.follow]); } const n = e.target.closest('[data-issue]'); if (n) openIssue(n.dataset.issue); });
    },
  };
  // the club sheet gets a "weekly newsletter" switch
  const openClub0 = TH.openClub;
  TH.openClub = function (id) {
    openClub0.apply(this, arguments);
    const c = TH.clubById(id), sheet = $('.sheet .club-sheet'); if (!c || !sheet) return;
    const on = N.isFollowing(c.id), anchor = $('#club-join, #club-leave', sheet);
    const div = document.createElement('div'); div.className = 'card flat nl-toggle';
    div.innerHTML = `${icon('mail')}<span style="flex:1"><b>Weekly newsletter</b><br><span class="muted" style="font-size:12.5px">${on ? 'You get this club’s week every Monday.' : 'Get this club’s week every Monday. No need to join.'}</span></span>${on ? `<button class="btn sm ghost" id="nl-read">Read</button><button class="btn sm line" id="nl-off">Unfollow</button>` : `<button class="btn sm" id="nl-on">Follow</button>`}`;
    if (anchor) anchor.insertAdjacentElement('afterend', div); else sheet.appendChild(div);
    const on1 = $('#nl-on', div), off1 = $('#nl-off', div), rd = $('#nl-read', div);
    if (on1) on1.onclick = () => { if (TH.runAct('followNews', [c.id])) TH.openClub(c.id); };
    if (off1) off1.onclick = () => { if (TH.runAct('unfollowNews', [c.id])) TH.openClub(c.id); };
    if (rd) rd.onclick = () => openIssue(c.id);
  };

  // =====================================================================
  // GUESTS: campus after-hours visitors and residence guests
  // =====================================================================
  const G = TH.guests = {};
  const KINDS = { campus: { label: 'Campus visitor (9 PM – 6 AM)', short: 'Campus visitor', sys: 'DPS After Hours Visitor Registration' }, housing: { label: 'Guest in my building', short: 'Residence guest', sys: 'USC Housing guest sign-in' } };
  G.KINDS = KINDS;
  const PURPOSES = G.PURPOSES = ['Visiting / hanging out', 'Studying together', 'Event or game', 'Staying overnight', 'Family visit'];
  G.list = () => safeHub().guests;
  G.active = () => { const k = TH.dkey(today()); return G.list().filter(g => g.day >= k); };
  G.summary = () => { const a = G.active(); return a.length ? `${a.length} guest pass${a.length === 1 ? '' : 'es'} active` : 'Register a visitor for campus or your building'; };
  const cleanName = s => String(s || '').replace(/[^\p{L}\p{M}' .-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  reg('registerGuest', {
    check(name, day, kind, purpose, arrive) {
      const r = R(), nm = cleanName(name), d = day == null || day === '' ? today() : (typeof day === 'number' ? TH.addDays(today(), day) : TH.parseKey(day)), k = TH.dkey(d);
      const off = Math.round((d - today()) / 864e5), kd = KINDS[kind] ? kind : 'campus';
      if (nm.length < 2) { r.block.push('I need your guest’s first and last name, as it appears on their photo ID.'); return r; }
      if (!/\s/.test(nm)) r.warn.push('Add a last name if you can. The name has to match their photo ID.');
      if (off < 0) r.block.push('That date has already passed.');
      if (off > 30) r.block.push('Guests can be registered up to 30 days ahead in this demo.');
      if (hub().guests.some(g => g.day === k && g.kind === kd && g.name.toLowerCase() === nm.toLowerCase())) r.block.push(`${nm} is already registered for ${TH.ui.dayLabel(d)}.`);
      if (kd === 'campus') r.warn.push('From 9 PM to 6 AM only the McCarthy Way and McClintock Ave entrances are open, and your guest must show a photo ID.');
      if (kd === 'housing') r.warn.push('You’re responsible for your guest while they’re in the building, and they need a photo ID at the desk.');
      r.ctx = { nm, d, k, kd };
      return r;
    },
    run({ nm, d, k, kd }, _n, _d, _k, purpose, arrive) {
      const st = TH.student(), g = { id: 'g' + uid(), name: nm, day: k, kind: kd, purpose: String(purpose || '').slice(0, 80) || null, arrive: String(arrive || '').slice(0, 30) || null, code: 'G' + String(Math.abs(hashStr(nm + k + kd)) % 1e6).padStart(6, '0'), at: now().getTime(), where: kd === 'housing' ? (st.housing || 'your residence') : 'University Park Campus' };
      hub().guests.unshift(g);
      return { title: `${nm} is registered`, rows: [['Guest', nm], ['Type', KINDS[kd].short], ['Date', TH.ui.dayLabel(d) + (g.arrive ? ' · arriving ' + g.arrive : '')], ...(g.purpose ? [['Purpose', g.purpose]] : []), ['Where', g.where], ['Pass code', g.code], ['Bring', 'Government photo ID']], log: `Registered ${nm} as a ${KINDS[kd].short.toLowerCase()} for ${TH.fmtDate(d)} (simulated ${KINDS[kd].sys})`, item: g };
    },
  });
  reg('cancelGuest', {
    check(id) { const r = R(), g = hub().guests.find(x => x.id === id); if (!g) r.block.push('That guest pass isn’t on your account.'); r.ctx = { g }; return r; },
    run({ g }) { const h = hub(); h.guests = h.guests.filter(x => x.id !== g.id); return { title: `Guest pass cancelled`, rows: [['Guest', g.name], ['Date', TH.fmtDate(TH.parseKey(g.day))]], log: `Cancelled the guest pass for ${g.name}`, item: g }; },
  });
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
  // a QR-style matrix from the pass code (decorative: a demo pass is not scannable anywhere)
  function matrix(code, n = 21) {
    let seed = Math.abs(hashStr(code)) || 1; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    const fOn = (x, y) => { const fx = x >= n - 7 ? x - (n - 7) : x, fy = y >= n - 7 ? y - (n - 7) : y; return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); };
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const on = finder(x, y) ? fOn(x, y) : rnd() > 0.52; if (on) d += `M${x} ${y}h1v1h-1z`; }
    return `<svg class="qr" viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="Demo pass code ${esc(code)}"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
  }
  G.matrix = matrix;
  function guestCard(g) {
    const d = TH.parseKey(g.day);
    return `<div class="card guestpass"><div class="gp-top"><div><span class="mono muted" style="font-size:11.5px">${esc(KINDS[g.kind].short.toUpperCase())}</span><h3>${esc(g.name)}</h3><span class="muted" style="font-size:13px">${esc(TH.ui.dayLabel(d))}${g.arrive ? ' · ' + esc(g.arrive) : ''} · ${esc(g.where)}${g.purpose ? ' · ' + esc(g.purpose) : ''}</span></div>${matrix(g.code)}</div>
      <div class="gp-bot"><span class="mono">${esc(g.code)}</span><span class="btn-row"><button class="btn sm ghost" data-copy="${esc(`${st0().first} registered you as a guest at USC for ${TH.fmtDate(d)}. Pass code ${g.code}. Bring a photo ID.`)}">${icon('copy')} Text to guest</button><button class="btn sm line" data-g-cancel="${esc(g.id)}">Cancel</button></span></div></div>`;
  }
  const st0 = () => TH.student();
  TH.screens.guests = {
    render() {
      const act = G.active(), S = TH.state, f = S.guestForm || (S.guestForm = { kind: 'campus', day: 0 }), A = (TH.SAFETY || {}).access || {};
      const arg = S.params && S.params.arg; if (arg && KINDS[arg]) f.kind = arg;
      const days = Array.from({ length: 7 }, (_, i) => TH.addDays(today(), i));
      return `<div class="screen">${TH.ui.topbar('Guests')}<div class="pad screen-body stack">
        <div class="card stack"><b>Guest someone in</b>
          <div class="seg" role="group" aria-label="Guest type">${Object.entries(KINDS).map(([k, v]) => `<button data-gkind="${k}" aria-pressed="${f.kind === k}">${esc(v.short)}</button>`).join('')}</div>
          <div class="field"><label for="g-name">Guest’s name (as on their photo ID)</label><input id="g-name" type="text" autocomplete="off" maxlength="60" placeholder="Alex Kim" value="${esc(f.name || '')}"></div>
          <div class="field"><label for="g-day">Date</label><select id="g-day">${days.map((d, i) => `<option value="${i}" ${+f.day === i ? 'selected' : ''}>${esc(i === 0 ? 'Tonight / today' : i === 1 ? 'Tomorrow' : TH.fmtDate(d, true))}</option>`).join('')}</select></div>
          <div class="field"><label for="g-purpose">Purpose of visit</label><select id="g-purpose">${PURPOSES.map(p => `<option ${f.purpose === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
          <button class="btn block" id="g-go">${icon('idcard')} Register guest</button>
          <span class="muted tiny">${f.kind === 'campus' ? esc(A.text ? 'From 9 PM to 6 AM campus is open only to registered guests with photo ID, through the McCarthy Way and McClintock Ave entrances.' : 'Guests need to be registered after hours.') : `Guests are signed in at your building’s front desk${st0().housing ? ` (${esc(st0().housing)})` : ''} and need a photo ID.`}</span>
        </div>
        ${act.length ? `<div class="section"><div class="section-head"><h2>Active passes</h2><span class="muted tiny">${act.length}</span></div>${act.map(guestCard).join('')}</div>` : `<div class="empty">${icon('idcard')}<b>No guests registered</b><span>Add one above, or tell Tommy “guest Alex Kim in tonight”.</span></div>`}
        <button class="btn ghost block" data-go="assistant:${esc('Guest my friend in tonight')}">${icon('sparkle')} Have Tommy do it</button>
        ${TH.ui.sim(A.url || 'https://dps.usc.edu/services/visitor-registration/', 'Register a real visitor with DPS')}
      </div></div>`;
    },
    mount(host) {
      const S = TH.state, f = S.guestForm;
      const nameI = $('#g-name', host), dayS = $('#g-day', host);
      nameI.oninput = () => { f.name = nameI.value; }; dayS.onchange = () => { f.day = +dayS.value; };
      const purS = $('#g-purpose', host); f.purpose = f.purpose || PURPOSES[0]; purS.onchange = () => { f.purpose = purS.value; };
      $$('[data-gkind]', host).forEach(b => b.onclick = () => { f.kind = b.dataset.gkind; S.params = {}; TH.render(true); });
      $('#g-go', host).onclick = () => {
        const d = TH.addDays(today(), +f.day || 0);
        TH.confirmAct('registerGuest', [f.name || '', TH.dkey(d), f.kind, f.purpose], { title: 'Register this guest?', rows: [['Guest', cleanName(f.name) || '—'], ['Type', KINDS[f.kind].label], ['Date', TH.ui.dayLabel(d)], ['Purpose', f.purpose]], ok: 'Register', url: ((TH.SAFETY || {}).access || {}).url, urlLabel: 'Register for real with DPS', done: () => { f.name = ''; } });
      };
      host.addEventListener('click', e => { const c = e.target.closest('[data-g-cancel]'); if (c) TH.runAct('cancelGuest', [c.dataset.gCancel]); });
    },
  };

  // =====================================================================
  // USCARD IN APPLE WALLET (simulated: a real pass has to be issued and signed by USCard Services)
  // =====================================================================
  reg('addWalletPass', {
    check() { const r = R(), st = TH.student(); if (hub().walletPass) r.block.push('Your USCard is already in Apple Wallet.'); if (st.uscard && st.uscard.status === 'frozen') r.block.push('Your USCard is frozen. Unfreeze it before adding it to Apple Wallet.'); return r; },
    run() { const st = TH.student(); hub().walletPass = { at: now().getTime(), express: true, device: 'iPhone' }; return { title: 'USCard added to Apple Wallet', rows: [['Card', `USCard · ${st.full}`], ['USC ID', st.uscid], ['Express Mode', 'On: hold your phone near a reader, no unlock needed'], ['Works at', 'Door readers, dining halls, libraries, the Lyon Center']], log: 'Added the USCard to Apple Wallet (simulated)', item: hub().walletPass }; },
  });
  reg('removeWalletPass', {
    check() { const r = R(); if (!hub().walletPass) r.block.push('Your USCard isn’t in Apple Wallet.'); return r; },
    run() { hub().walletPass = null; return { title: 'USCard removed from Apple Wallet', rows: [['Status', 'Removed from this iPhone']], log: 'Removed the USCard from Apple Wallet (simulated)', item: null }; },
  });
  const APPLE = '<svg viewBox="0 0 24 24" class="apple" aria-hidden="true"><path fill="currentColor" d="M16.4 12.700c0-2.400 2-3.500 2.100-3.600-1.100-1.700-2.900-1.900-3.500-1.900-1.500-.2-2.900.9-3.700.9-.800 0-1.900-.9-3.200-.8-1.600 0-3.100 1-4 2.400-1.700 3-.4 7.300 1.200 9.700.8 1.200 1.800 2.500 3 2.400 1.200 0 1.700-.8 3.100-.8 1.500 0 1.900.8 3.200.8 1.300 0 2.100-1.200 2.900-2.400.9-1.300 1.300-2.600 1.300-2.700-.000 0-2.400-.900-2.400-3.700zM14 5.400c.7-.800 1.100-1.900 1-3-.9 0-2.100.6-2.800 1.400-.6.7-1.100 1.800-1 2.900 1.100.1 2.100-.5 2.800-1.300z"/></svg>';
  function passPreview() {
    const st = TH.student();
    return `<div class="applepass"><div class="ap-top"><span class="ap-brand"><span class="mark">T</span>USCard</span><span class="ap-kind">STUDENT</span></div>
      <div class="ap-name">${esc(st.full)}</div><div class="ap-rows"><span><small>USC ID</small>${esc(st.uscid)}</span><span><small>CLASS</small>${esc(st.standing || '—')}</span><span><small>VALID THRU</small>${esc((st.gradTerm || 'Spring 2029').replace('Spring ', '05/').replace('Fall ', '12/'))}</span></div>
      <div class="ap-nfc">${icon('bolt')} Hold near reader</div></div>`;
  }
  function openWalletSheet() {
    const added = !!safeHub().walletPass;
    TH.sheet(`<div class="stack"><div class="sheet-head"><h2>${added ? 'USCard in Apple Wallet' : 'Add USCard to Apple Wallet'}</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${passPreview()}
      <ul class="ap-list"><li>${icon('check')} Tap into buildings, dining halls and the gym with your iPhone or Apple Watch</li><li>${icon('check')} Express Mode: works without unlocking, and for a while after your battery runs out</li><li>${icon('check')} Lost your phone? Freeze the card from here or ask Tommy</li></ul>
      ${added ? `<div class="btn-row"><button class="btn line" id="ap-remove">Remove from Wallet</button><button class="btn" data-close>Done</button></div>` : `<button class="applebtn" id="ap-add">${APPLE}<span><small>Add to</small>Apple Wallet</span></button>`}
      <p class="simnote">${icon('info')}<span>Simulated on the demo account. A working pass has to be issued and signed by USCard Services, so this button shows the flow rather than adding a real card to your phone.</span></p></div>`, w => {
      const a = $('#ap-add', w), r = $('#ap-remove', w);
      if (a) a.onclick = () => { TH.closeSheet(); if (TH.runAct('addWalletPass', [], 'USCard added to Apple Wallet')) setTimeout(openWalletSheet, 250); };
      if (r) r.onclick = () => { TH.closeSheet(); TH.runAct('removeWalletPass', []); };
    });
  }
  TH.openWalletPass = openWalletSheet;
  // inject the Apple Wallet row under the USCard on the Wallet screen
  const wallet = TH.screens.wallet;
  if (wallet) {
    const r0 = wallet.render, m0 = wallet.mount;
    wallet.render = function () {
      const html = r0.apply(this, arguments), added = !!safeHub().walletPass;
      const row = added ? `<button class="card flat aw-row added" id="aw-open">${APPLE}<span style="flex:1"><b>In Apple Wallet</b><br><span class="muted" style="font-size:13px">Express Mode on · tap your iPhone at any USCard reader</span></span><span class="pill ok">${icon('check')}Added</span></button>`
        : `<button class="applebtn" id="aw-open">${APPLE}<span><small>Add to</small>Apple Wallet</span></button>`;
      const i = html.indexOf('<div class="grid2">');
      return i < 0 ? html : html.slice(0, i) + row + html.slice(i);
    };
    wallet.mount = function (host) { m0 && m0.apply(this, arguments); const b = $('#aw-open', host); if (b) b.onclick = openWalletSheet; if (TH.state.params && TH.state.params.arg === 'apple') { TH.state.params = {}; setTimeout(openWalletSheet, 80); } };
  }
})(window.TH = window.TH || {});
