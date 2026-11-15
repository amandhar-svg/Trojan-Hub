/* js/app.js */
/* Trojan Hub — app shell: routing, tab bar, plus menu, sheets, toasts, notifications, confirm flow
 * for TH.act.*, simulations, and the Home / Map / My Day (+ Week/Month calendar) / More screens.
 *
 * State: TH.state is UI-only (route, params, filters, map view, theme, demo time, calendar view).
 * Every piece of account data lives in Trojan Assist's store: TH.H() (= TA.State.d.hub) and TA.State.d.
 * Side-effect free at load; TH.boot() (called after TA.boot()) wires the DOM and timers.
 */
(function (TH) {
  'use strict';
  const { esc, icon, store, fmtMin, fmtTime } = TH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasTA = () => !!(window.TA && TA.State && TA.State.d);
  const hub = () => (hasTA() ? TH.H() : { calendar: [], clubs: [], orders: [], passes: [], lines: [], ride: null, zips: [], upass: null, parking: null, lyftUsedUSD: 0, notes: [] });

  // ---------- UI state (persisted: theme, calendar view, game-day toggle) ----------
  const prefs = store.get('ui', {}) || {};
  const S = TH.state = {
    route: 'home', params: {},
    theme: prefs.theme || 'system', gameday: !!prefs.gameday,
    map: { cat: 'all', openNow: false, safety: false, fence: false, dps: false, lyft: false, bikes: false, hour: null, list: false, query: '', view: null, area: null, accessible: false },
    chat: [], food: 'halls', plansDay: 0, plansView: prefs.plansView || 'day', calMonth: null, eventsDay: 0, eventsCat: null,
    pendingRoute: null, activeRoute: null,
  };
  // demo time is kept as minutes of the day (the date is always the demo day), so it survives a reload
  const saveUI = () => store.set('ui', { theme: S.theme, gameday: S.gameday, plansView: S.plansView, demoMin: TH.clock.minutes });
  TH.saveUI = saveUI;
  // v1 compatibility: TH.save() persists UI prefs and the account store.
  TH.save = function () { saveUI(); if (hasTA()) TA.State.save(); };
  // v1 compatibility: read-only profile view of TA's demo student (no separate Hub profile).
  if (!Object.getOwnPropertyDescriptor(TH, 'PROFILE')) Object.defineProperty(TH, 'PROFILE', { configurable: true, get() { const s = TH.student(); return { name: s.first, full: s.full, year: s.standing, major: s.major, uscid: s.uscid, school: s.school, diningDollars: s.dining.diningDollars, swipes: s.dining.swipesLeft, classes: [] }; } });

  // ---------- helpers (TH.ui) ----------
  const H = TH.ui = {};
  H.pill = st => `<span class="pill ${st.tone}">${esc(st.label)}</span>`;
  H.walkMin = p => Math.max(1, Math.round(Math.hypot(p.x - TH.ME.x, p.y - TH.ME.y) * 1.3 / 80));
  H.liveStr = lv => !lv ? '' : (lv.kind === 'wait' ? `${lv.value} min ${lv.label}` : lv.kind === 'busy' ? `${lv.value}% full` : `${lv.value} ${lv.unit} ${lv.label}`) + ' (est.)';
  H.toneFor = lv => !lv ? '' : (lv.kind === 'seats' || lv.kind === 'spaces') ? (lv.pct > 85 ? 'bad' : lv.pct > 65 ? 'warn' : '') : (lv.pct > 80 ? 'bad' : lv.pct > 55 ? 'warn' : '');
  H.dkey = d => TH.dkey(d);
  H.today = () => TH.dayStart(TH.clock.now());
  H.dayAt = off => TH.addDays(H.today(), off);
  H.nowMin = () => TH.minOfDay(TH.clock.now());
  H.est = (extra = '') => `<span class="est" title="Estimated: USC publishes no live data">Est.${extra}</span>`;
  H.sim = (url, label) => `<p class="simnote">${icon('info')}<span>Simulated on the demo account. Nothing is sent to USC.${url ? ` <a href="${esc(url)}" target="_blank" rel="noopener">${esc(label || 'Do it for real')} ↗</a>` : ''}</span></p>`;
  H.host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } };
  const cap = w => w ? w[0].toUpperCase() + w.slice(1) : w;
  H.srcName = url => {
    let u; try { u = new URL(url); } catch (e) { return 'source'; }
    const h = u.hostname.replace(/^www\./, ''), sub = h.replace(/\.?usc\.edu$/, '');
    const site = /usc\.edu$/.test(h) ? (sub ? `USC ${cap(sub.split('.').pop())}` : 'USC') : h;
    const seg = u.pathname.split('/').filter(s => s && !/^(index\.php|\d{4}|\d{2})$/.test(s)).pop();
    const page = seg ? cap(decodeURIComponent(seg).replace(/\.(html?|php)$/, '').replace(/[-_]+/g, ' ')).slice(0, 38) : '';
    return page ? `${site} · ${page}` : site;
  };
  H.src = (url, label) => url ? `<a class="src" href="${esc(url)}" target="_blank" rel="noopener">${icon('link')}Source: ${esc(label || H.srcName(url))}</a>` : '';
  H.placeRow = (p, extra = '') => {
    const c = TH.CATS[p.cat] || TH.CATS.service, st = TH.status(p), lv = TH.live(p);
    return `<button class="row" data-place="${esc(p.id)}" style="--rc:${c.color}"><span class="rico">${icon(c.icon)}</span>
      <span class="rmain"><span class="rtitle">${esc(p.name)}</span><span class="rsub">${st.open === false && st.detail ? esc(st.detail) + ' · ' : st.open == null ? 'Hours not published · ' : ''}${H.walkMin(p)} min walk${extra}</span></span>
      <span class="rside">${lv ? `<span class="big">${lv.value}<small>${esc(lv.unit === '%' ? 'full' : lv.unit + ' ' + lv.label)} · est.</small></span>` : H.pill(st)}</span></button>`;
  };
  H.topbar = (title, back = true, right = '') => `<div class="topbar pad">${back ? `<button class="iconbtn" data-back aria-label="Back">${icon('back')}</button>` : ''}<h1>${esc(title)}</h1>${right}</div>`;
  H.bars = (curve, nowH) => `<div class="bars" role="img" aria-label="Typical busyness by hour (estimate)">${curve.slice(6, 24).map((v, i) => `<i class="${i + 6 === nowH ? 'now' : ''}" style="height:${Math.max(3, v)}%"></i>`).join('')}</div><div class="bars-x"><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>`;
  H.eta = x => x.inMin <= 0 ? `Now<small>boarding</small>` : x.inMin <= 90 ? `${x.inMin}<small>min</small>` : `<span style="font-size:15px">${fmtMin(x.at)}</span><small>next</small>`;
  H.timeRange = (a, b) => `${fmtMin(a)} – ${fmtMin(b)}`;
  H.dayLabel = d => { const o = Math.round((TH.dayStart(d) - H.today()) / 864e5); return o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : o === -1 ? 'Yesterday' : TH.fmtDate(d); };
  const fmtDelta = TH.fmtDelta;

  // ---------- toast & notifications (notes live in TH.H().notes) ----------
  let toastT;
  TH.toast = function (msg, ic = 'check') {
    const dev = $('.device'); if (!dev) return; $('.toast', dev)?.remove(); clearTimeout(toastT);
    dev.insertAdjacentHTML('beforeend', `<div class="toast${$('.tommy-fab', dev) ? ' above-fab' : ''}" role="status">${icon(ic)}<span>${esc(msg)}</span></div>`);
    toastT = setTimeout(() => $('.toast', dev)?.remove(), 3200);
  };
  function notes() { const h = hub(); if (!Array.isArray(h.notes)) h.notes = seedNotes(); return h.notes; }
  function seedNotes() {
    const out = [], n = TH.clock.now();
    const al = latestAlert(24 * 14);
    if (al) out.push({ id: 'n-dps-' + al.id, title: `DPS ${al.kind || 'alert'}: ${al.title}`, body: (al.where ? al.where + '. ' : '') + 'Tap for the safety map and the full DPS post.', at: TH.laDate(al.date).getTime(), go: 'safety', read: true });
    out.push({ id: 'n-welcome', title: 'Welcome to Trojan Hub', body: 'Your classes, clubs and plans are in My Day. Tap + for rides, food, passes and Ask Tommy.', at: n.getTime(), go: 'plans' });
    return out;
  }
  TH.notes = notes;
  TH.notify = function (title, body, go, place) {
    notes().unshift({ id: 'n' + Date.now(), title, body, at: Date.now(), go: go || null, place: place || null, read: false });
    if (notes().length > 40) notes().length = 40;
    if (hasTA()) TA.State.save();
    TH.toast(title, 'bell'); updateBadge();
  };
  function updateBadge() { const dot = $('#bell-dot'); if (dot) dot.hidden = !notes().some(n => !n.read); }
  TH.updateBadge = updateBadge;

  // ---------- sheets ----------
  TH.sheet = function (html, onMount) {
    TH.closeSheet();
    const dev = $('.device');
    dev.insertAdjacentHTML('beforeend', `<div class="sheet-wrap" role="dialog" aria-modal="true"><div class="sheet-backdrop" data-close></div><div class="sheet pad"><div class="grab"></div>${html}</div></div>`);
    const w = $('.sheet-wrap', dev);
    w.addEventListener('click', e => { if (e.target.closest('[data-close]')) TH.closeSheet(); });
    bindCommon(w);
    onMount && onMount(w);
    setTimeout(() => { const f = w.querySelector('.sheet button:not([data-close]), .sheet input, .sheet select'); f && f.focus({ preventScroll: true }); }, 50);
    return w;
  };
  TH.closeSheet = function () { $$('.sheet-wrap').forEach(n => n.remove()); };

  // ---------- confirm flow for TH.act.* (native UI) ----------
  // TH.confirmAct('bookPass', ['room', 900], {title, rows, ok, url, urlLabel, done})
  TH.confirmAct = function (name, args = [], o = {}) {
    const ck = TH.act.check[name](...args);
    const html = `<div class="stack">
      <div class="sheet-head"><h2>${esc(o.title || 'Confirm')}</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${o.rows && o.rows.length ? `<dl class="kv">${o.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      ${o.html || ''}
      ${ck.block.map(b => `<div class="banner">${icon('alert')}<div><b>Can’t do that</b><span>${esc(b)}</span></div></div>`).join('')}
      ${ck.warn.map(w => `<div class="banner info">${icon('info')}<div><span>${esc(w)}</span></div></div>`).join('')}
      <div class="err" hidden></div>
      <div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="act-ok" ${ck.block.length ? 'disabled' : ''}>${esc(o.ok || 'Confirm')}</button></div>
      ${H.sim(o.url, o.urlLabel)}
    </div>`;
    TH.sheet(html, w => {
      $('#act-ok', w).onclick = () => {
        try {
          const res = TH.act[name](...args);
          TH.commit(res.log);
          TH.closeSheet(); TH.toast(o.toast || res.title);
          o.done && o.done(res);
          TH.render(true);
        } catch (e) { const er = $('.err', w); er.hidden = false; er.textContent = e.message; }
      };
    });
  };
  // Run without a sheet (small reversible things like removing a saved event). Returns result or null.
  TH.runAct = function (name, args = [], toastMsg) {
    try { const res = TH.act[name](...args); TH.commit(res.log); TH.toast(toastMsg || res.title); TH.render(true); return res; }
    catch (e) { TH.toast(e.message, 'alert'); return null; }
  };

  // ---------- routing ----------
  const screens = TH.screens = TH.screens || {};
  const history = [];
  let suppressHash = false;
  TH.go = function (name, params) {
    if (!screens[name]) name = 'home';
    TH.closeSheet(); closePlus();
    S.params = params || {};
    if (S.route !== name) history.push(S.route);
    S.route = name;
    const h = '#' + name; if (location.hash !== h) { suppressHash = true; try { location.hash = h; } catch (e) { suppressHash = false; } }
    render();
  };
  TH.back = () => { const prev = history.pop() || 'home'; S.route = prev; S.params = {}; suppressHash = true; try { location.hash = '#' + prev; } catch (e) { suppressHash = false; } render(); };

  const TABS = { home: 'home', map: 'map', plans: 'plans', more: 'more' };
  const TAB_OF = { grades: 'more', news: 'more', watches: 'more', guests: 'more', rides: 'more', food: 'more', pass: 'more', queue: 'more', safety: 'more', events: 'plans', clubs: 'more', wallet: 'more', upass: 'more', alerts: 'home', gameday: 'more', access: 'more', about: 'more', assistant: 'more' };
  let lastRoute = null, originTab = null;
  function render(keepScroll) {
    const host = $('#screen-host'); if (!host) return;
    let scr = screens[S.route]; if (!scr) { S.route = 'home'; scr = screens.home; }
    if (lastRoute === 'assistant' && S.route !== 'assistant' && window.TA && TA.Embed && TA.Embed.unmount) { try { TA.Embed.unmount(); } catch (e) { console.warn(e); } }
    if (S.route === 'assistant' && lastRoute === 'assistant' && keepScroll) return; // never re-render a live chat
    if (S.route === 'map' && lastRoute === 'map' && keepScroll && TH._map) { try { TH._map.renderPins(); } catch (e) { } updateBadge(); return; } // keep the live map
    const old = $('.screen, .mapscreen', host); const top = keepScroll && old ? old.scrollTop : 0;
    if (TH._map) { if (S.route === 'map' || lastRoute === 'map') try { S.map.view = { ...TH._map.view }; } catch (e) { } try { TH._map.destroy(); } catch (e) { } TH._map = null; }
    if (TH._smap) { try { TH._smap.destroy(); } catch (e) { } TH._smap = null; }
    try { host.innerHTML = scr.render(); }
    catch (e) { console.error(e); host.innerHTML = `<div class="screen">${H.topbar('Something went wrong')}<div class="pad empty">${icon('alert')}<b>This screen couldn’t load.</b><span>${esc(e.message)}</span><button class="btn sm" data-go="home">Go home</button></div></div>`; }
    const el = host.firstElementChild; if (el && top) el.scrollTop = top;
    if (el) bindCommon(el);
    try { scr.mount && el && scr.mount(el); } catch (e) { console.error(e); }
    lastRoute = S.route;
    // pushed screens (Tommy, Clubs, Events, Alerts…) keep the tab the student came from highlighted
    if (TABS[S.route]) originTab = S.route; else if (!originTab) originTab = TAB_OF[S.route] || 'home';
    const cur = originTab;
    $$('.tabbar [data-tab]').forEach(b => b.dataset.tab === cur ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
    tommyFab();
    updateBadge();
  }
  TH.render = render;

  function bindCommon(root) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-go],[data-place],[data-back],[data-event],[data-club],[data-copy]');
      if (!t || !root.contains(t)) return;
      if (t.dataset.back !== undefined) { TH.back(); return; }
      if (t.dataset.place) { TH.openPlace(t.dataset.place); return; }
      if (t.dataset.event) { TH.openEvent(t.dataset.event); return; }
      if (t.dataset.club) { if (TH.openClub) TH.openClub(t.dataset.club); else TH.go('clubs', { arg: t.dataset.club }); return; }
      if (t.dataset.copy !== undefined) { copyText(t.dataset.copy || '', t); return; }
      if (t.dataset.go) { const g = t.dataset.go, i = g.indexOf(':'); TH.go(i < 0 ? g : g.slice(0, i), i < 0 ? null : { arg: g.slice(i + 1) }); }
    });
  }
  TH.bindCommon = bindCommon;
  function copyText(text, btn) {
    const done = () => TH.toast('Copied', 'copy');
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => fallback()); return; } } catch (e) { }
    fallback();
    function fallback() { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px'; (btn || document.body).appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); ok ? done() : TH.toast('Select the text and copy it', 'copy'); }
  }
  TH.copyText = copyText;

  // ---------- floating "Ask Tommy" (Home only, Disney-app chat bubble) ----------
  function tommyFab() {
    const dev = $('.device'); if (!dev) return;
    $$('.tommy-fab', dev).forEach(n => n.remove());
    if (S.route !== 'home') return;
    dev.insertAdjacentHTML('beforeend', `<button class="tommy-fab" data-go="assistant" aria-label="Ask Tommy, your USC assistant">${icon('chat')}<span>Ask Tommy</span></button>`);
    const b = $('.tommy-fab', dev); b.onclick = () => TH.go('assistant');
    // shrink to a round chat button once the student scrolls, so it covers less of Home
    const sc = $('#home-screen'); if (sc) sc.addEventListener('scroll', () => b.classList.toggle('mini', sc.scrollTop > 40), { passive: true });
  }

  // ---------- plus menu ----------
  const PLUS = [
    ['Get a Ride', 'car', 'rides'], ['Order Food', 'bag', 'food:order'], ['Trojan Pass', 'ticket', 'pass'],
    ['Virtual Line', 'queue', 'queue'], ['Safe Walk', 'walk', 'safety'], ['Clubs', 'users', 'clubs'],
    ['Events', 'calendar', 'events'], ['Find a Restroom', 'wc', 'map:restroom'], ['Ask Tommy', 'sparkle', 'assistant'],
  ];
  function openPlus() {
    const dev = $('.device'); if ($('.plusmenu', dev)) return closePlus();
    dev.insertAdjacentHTML('beforeend', `<div class="plusmenu pad"><div style="width:100%"><h2>What do you want to do?</h2><div class="grid">${PLUS.map(([l, ic, g], i) => `<button data-go="${g}" style="animation-delay:${i * 25}ms">${icon(ic)}${l}</button>`).join('')}</div></div></div>`);
    const m = $('.plusmenu', dev); bindCommon(m); m.addEventListener('click', e => { if (e.target === m) closePlus(); });
    const f = $('.fab'); if (f) { f.classList.add('open'); f.setAttribute('aria-expanded', 'true'); }
  }
  function closePlus() { $$('.plusmenu').forEach(n => n.remove()); const f = $('.fab'); if (f) { f.classList.remove('open'); f.setAttribute('aria-expanded', 'false'); } }
  TH.closePlus = closePlus;

  // ---------- place sheet ----------
  TH.openPlace = function (id) {
    const p = TH.byId[id]; if (!p) return;
    const c = TH.CATS[p.cat] || TH.CATS.service, now = TH.clock.now(), st = TH.status(p, now), lv = TH.live(p, now), d = now.getDay();
    const hours = TH.hoursText(p), special = TH.specialHours(p, now, 21);
    const acts = [];
    acts.push(`<button class="btn" data-walk="${esc(p.id)}">${icon('walk')} Walk here · ${H.walkMin(p)} min</button>`);
    if (p.order) acts.push(`<button class="btn gold" data-order="${esc(p.id)}">${icon('bag')} Order ahead</button>`);
    const menuUrl = (TH.MENU_URLS || {})[p.id];
    if (p.hall) acts.push(`<button class="btn ghost" data-go="food">${icon('fork')} Dining halls &amp; menus</button>`);
    (TH.QUEUES || []).filter(q => q.where === p.id).forEach(q => acts.push(`<button class="btn gold" data-go="queue:${esc(q.id)}">${icon('queue')} Virtual line: ${esc(q.name)}</button>`));
    (TH.PASSES || []).filter(x => x.where === p.id).forEach(ps => acts.push(`<button class="btn ghost" data-go="pass:${esc(ps.id)}">${icon('ticket')} Reserve: ${esc(ps.name)}</button>`));
    if (p.cat === 'parking') acts.push(`<button class="btn ghost" data-park="${esc(p.id)}">${icon('parking')} I parked here</button>`);
    if (p.bluelight || p.id === 'dps' || p.cat === 'safety') acts.push(`<button class="btn ghost" data-go="safety">${icon('shield')} Safety tools</button>`);
    acts.push(`<button class="btn ghost" data-go="assistant:${esc('Tell me about ' + p.name)}">${icon('sparkle')} Ask Tommy about this place</button>`);
    let extra = '';
    if (p.stop && TH.nextBuses) {
      const nb = TH.nextBuses(p.id, now, TH.minOfDay(now), 4);
      extra += `<div class="section"><div class="section-head"><h2>Next USC buses</h2><span class="muted" style="font-size:12px">Published schedule</span></div>${nb.length ? `<div class="rows">${nb.map(b => `<div class="row"><span class="rico" style="--rc:${esc(b.color || 'var(--c-transit)')}">${icon('bus')}</span><span class="rmain"><span class="rtitle">${esc(b.name)}</span><span class="rsub">${esc(TH.busDepText ? TH.busDepText(b) : fmtMin(b.at))}${b.est ? ' · window estimated by USC' : ''}</span></span><span class="rside"><span class="big">${H.eta(b)}</span></span></div>`).join('')}</div>` : `<p class="muted">No more scheduled departures today.</p>`}</div>`;
    }
    if (p.metro || /^st-/.test(p.id)) extra += `<div class="card flat"><b>${icon('train')} Metro</b><p class="muted" style="margin-top:4px">${esc((TH.TRANSPORT.metro || {}).note || 'Check metro.net for train times.')}</p></div>`;
    if (p.cat === 'gate' || p.access) extra += `<div class="card flat"><b>${icon('gate')} Access</b><p class="muted" style="margin-top:4px">${esc(p.access || (TH.SAFETY.access || {}).text || '')}${p.staffed ? ' · Staffed by DPS' : ''}${p.accessible ? ' · Step-free entrance' : ''}</p></div>`;
    if (p.inferred) extra += `<div class="banner info">${icon('info')}<div><span>Restrooms inside this building; USC doesn’t publish an exact restroom map.</span></div></div>`;
    if (p.features && p.features.length) extra += `<div class="tags">${p.features.map(f => `<span class="tag">${esc(f)}</span>`).join('')}</div>`;
    if (p.crowd) extra += `<div class="section"><div class="section-head"><h2>Usually busy</h2><span class="muted" style="font-size:12px">Typical ${TH.DAYS[d]} · estimate</span></div>${H.bars(p.crowd, now.getHours())}</div>`;
    const hoursBlock = `<div class="section"><div class="section-head"><h2>Hours</h2>${p.verified ? `<span class="verified">${icon('verified')}Verified</span>` : ''}</div>
      ${hours.length ? `<dl class="kv hours">${hours.map(([dn, h], i) => `<dt class="${i === d ? 'today' : ''}">${dn}</dt><dd class="${i === d ? 'today' : ''}">${esc(h)}</dd>`).join('')}</dl>` : `<p class="muted">Hours not published by USC.</p>`}
      ${special.length ? `<div class="special"><b>Special dates</b><dl class="kv">${special.map(s => `<dt>${esc(s.label)}</dt><dd>${esc(s.text)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</dd>`).join('')}</dl></div>` : ''}
      ${p.hoursNote ? `<p class="muted" style="font-size:12.5px">${esc(p.hoursNote)}</p>` : ''}</div>`;
    const info = [p.address ? `<span>${icon('pin')}${esc(p.address)}</span>` : '', p.phone ? `<span>${icon('phone')}${esc(p.phone)}</span>` : ''].filter(Boolean).join('');
    const sources = (p.sources || []).slice(0, 3);
    const html = `<div class="stack">
      <div class="sheet-head place-head"><span class="pico" style="--rc:${c.color}">${icon(c.icon)}</span>
        <div style="flex:1;min-width:0;display:grid;gap:5px"><h2>${esc(p.name)}</h2><div class="tags">${H.pill(st)}${st.detail ? `<span class="pill mute">${esc(st.detail)}</span>` : ''}${st.note ? `<span class="pill gold">${esc(st.note)}</span>` : ''}${TH.AREAS[p.area] ? `<span class="pill mute">${esc(TH.AREAS[p.area].name)}</span>` : ''}</div></div>
        <button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${lv ? `<div class="card flat livecard"><span class="big-num">${lv.value}</span><div><b>${esc(lv.unit === '%' ? 'percent full' : lv.unit + ' ' + lv.label)} ${H.est()}</b><p class="muted" style="font-size:12.5px">Estimated from typical patterns. USC publishes no live counts.</p></div></div>` : ''}
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      ${info ? `<div class="infoline">${info}</div>` : ''}
      ${extra}
      <div class="stack">${acts.join('')}</div>
      ${menuUrl ? `<a class="btn line" href="${esc(menuUrl)}" target="_blank" rel="noopener">${icon('external')} See the real menu (USC Hospitality)</a>` : ''}
      ${hoursBlock}
      <div class="sources">${sources.map(u => H.src(u)).join('')}${p.url && !sources.includes(p.url) ? H.src(p.url, 'Official page') : ''}<span class="muted">Map position © OpenStreetMap contributors</span></div>
    </div>`;
    TH.sheet(html, w => {
      w.addEventListener('click', e => {
        const wk = e.target.closest('[data-walk]'); if (wk) { S.pendingRoute = { to: wk.dataset.walk }; TH.go('map'); return; }
        const od = e.target.closest('[data-order]'); if (od) { TH.closeSheet(); if (TH.openOrder) TH.openOrder(od.dataset.order); else TH.go('food', { arg: od.dataset.order }); return; }
        const pk = e.target.closest('[data-park]'); if (pk) parkSheet(pk.dataset.park);
      });
    });
    if (TH._map && TH._map.select) TH._map.select(id);
  };
  function parkSheet(pid) {
    const p = TH.byId[pid];
    TH.confirmAct('saveParking', [pid, ''], {
      title: 'Save your parking spot', ok: 'Save spot', rows: [['Structure', p.name]],
      html: `<div class="field"><label for="park-level">Level or spot (optional)</label><input id="park-level" maxlength="40" placeholder="e.g. Level 3, near elevator"></div>`,
      url: (TH.TRANSPORT.parking || {}).permitsUrl, urlLabel: 'USC parking permits',
    });
    const btn = $('#act-ok'); if (!btn) return;
    btn.onclick = () => {
      const lvl = ($('#park-level') || {}).value || '';
      try { const res = TH.act.saveParking(pid, lvl); TH.commit(res.log); TH.closeSheet(); TH.toast('Saved. Your spot is on Home and in Wallet.', 'parking'); TH.render(true); }
      catch (e) { const er = $('.sheet .err'); if (er) { er.hidden = false; er.textContent = e.message; } }
    };
  }
  TH.parkSheet = parkSheet;

  // (The event sheet, TH.openEvent, lives in screens.js.)

  // ---------- "Add to phone calendar" ----------
  // In the claude.ai artifact the downloads capability can't save .ics (not on its extension allowlist), so there the
  // sheet offers per-event "Add to Google Calendar" links, EngageSC's own per-event .ics links and copyable iCalendar
  // text. Only the standalone file (no window.claude) gets a real .ics download, through a Blob + <a download>.
  const isArtifact = () => !!window.claude;
  // any start/end (ISO with offset, offset-less campus ISO, or Date in campus wall-clock) -> real instant
  function calInstant(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return new Date(TH.laISO(v));
    if (typeof v === 'string' && /[zZ]|[+-]\d\d:?\d\d$/.test(v)) return new Date(v);
    const d = TH.laDate(v); return d ? new Date(TH.laISO(d)) : null;
  }
  const gUTC = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const gDay = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  TH.gcalUrl = function (x) {
    const sv = x.startISO || x.start, ev = x.endISO || x.end || sv;
    let dates;
    if (x.allDay) { const sd = TH.laDate(sv), ed = TH.addDays(TH.laDate(ev), 1); if (!sd) return null; dates = gDay(sd) + '/' + gDay(ed); }
    else { const s = calInstant(sv); if (!s || isNaN(s)) return null; let e = calInstant(ev); if (!e || isNaN(e) || e <= s) e = new Date(s.getTime() + 3600000); dates = gUTC(s) + '/' + gUTC(e); }
    const details = `${x.org ? 'Hosted by ' + x.org + '. ' : ''}${x.url ? 'Details and RSVP: ' + x.url + ' ' : ''}(Added from Trojan Hub, a student prototype.)`;
    const enc = encodeURIComponent, where = x.where || x.location;
    // dates holds only digits, T, Z and one '/', so it goes in unencoded, exactly as Google's template expects
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(x.title || 'Event')}&dates=${dates}&details=${enc(details)}${where ? '&location=' + enc(where) : ''}&ctz=America%2FLos_Angeles`;
  };
  function downloadIcs(ics, base) {
    try {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = base + '.ics'; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      TH.toast('Calendar file downloaded. Open it to add the events.', 'calendar'); return true;
    } catch (e) { TH.toast('Couldn’t download here. Copy the calendar text instead.', 'alert'); return false; }
  }
  TH.exportCalendar = function (items, base = 'trojan-hub-calendar') {
    items = (items || []).filter(Boolean);
    if (!items.length) { TH.toast('Nothing to export yet', 'calendar'); return; }
    icsSheet(items, TH.ics(items, { name: 'Trojan Hub' }), base);
  };
  function icsSheet(items, ics, base) {
    const standalone = !isArtifact(), list = items.slice(0, 20);
    const when = x => { const s = TH.laDate(x.startISO || x.start); return s ? `${H.dayLabel(s)}${x.allDay ? '' : ' · ' + fmtTime(s)}` : ''; };
    TH.sheet(`<div class="stack">
      <div class="sheet-head"><h2>Add to phone calendar</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${standalone ? `<button class="btn block" id="ics-dl">${icon('calendar-plus')} Download calendar file (${items.length} event${items.length === 1 ? '' : 's'})</button>
        <p class="muted tiny">Saves <b>${esc(base)}.ics</b>. Open it and your phone or computer adds the events. Or add them one at a time:</p>`
        : `<p class="muted">Add each event to Google Calendar, or open EngageSC’s calendar file for it.</p>`}
      <div class="rows cal-export">${list.map(x => { const g = TH.gcalUrl(x); return `<div class="row cal-x"><span class="rico">${icon('calendar-plus')}</span><span class="rmain"><span class="rtitle">${esc(x.title)}</span><span class="rsub">${esc(when(x))}</span>
        <span class="cal-x-links">${g ? `<a class="btn sm line" href="${esc(g)}" target="_blank" rel="noopener">Add to Google Calendar</a>` : ''}${x.ical ? `<a class="btn sm ghost" href="${esc(x.ical)}" target="_blank" rel="noopener">EngageSC .ics</a>` : x.url ? `<a class="btn sm ghost" href="${esc(x.url)}" target="_blank" rel="noopener">EngageSC page</a>` : ''}</span></span></div>`; }).join('')}</div>
      ${items.length > list.length ? `<p class="muted tiny">Showing the first ${list.length}. The calendar text below has all ${items.length}.</p>` : ''}
      <details class="more"><summary>Copy calendar file (all ${items.length === 1 ? 'of it' : items.length + ' events'} as text)</summary><div class="stack" style="margin-top:8px">
        <p class="muted tiny">Copy the text, paste it into a file named <b>${esc(base)}.ics</b> and open that file (Apple Calendar, Outlook and Google Calendar import it).</p>
        <textarea class="ics-text" readonly rows="7" aria-label="Calendar file (iCalendar)">${esc(ics)}</textarea>
        <button class="btn line" data-copy="${esc(ics)}">${icon('copy')} Copy calendar file</button></div></details>
    </div>`, root => { const b = $('#ics-dl', root || document); if (b) b.onclick = () => downloadIcs(ics, base); });
  }

  // ---------- simulations (lines, orders, rides, reminders) on TH.H() ----------
  function tickSims() {
    if (!hasTA()) return;
    const h = hub(); let changed = false;
    h.lines.forEach(l => {
      if (l.state !== 'waiting') return;
      const def = (TH.QUEUES || []).find(x => x.id === l.id); if (!def) return;
      if (Date.now() - l.lastStep > 15000) {
        l.pos = Math.max(0, l.pos - 1); l.lastStep = Date.now(); changed = true;
        if (l.pos === 0) { l.state = 'called'; TH.notify(`It’s your turn: ${def.name}`, `Head to ${TH.byId[def.where]?.name || 'the desk'} within 10 minutes. (Simulated line)`, 'queue'); }
      }
    });
    h.orders.forEach(o => { if (o.state === 'preparing' && Date.now() - o.hereAt > 25000) { o.state = 'ready'; changed = true; TH.notify(`Order ready at ${TH.byId[o.at]?.name || 'pickup'}`, `Pickup code ${o.code}. Grab it from the mobile order shelf.`, 'food:order'); } });
    const r = h.ride;
    if (r && r.state === 'arriving') { const left = Math.max(0, r.eta - Math.floor((Date.now() - r.t0) / 6000)); if (left !== r.left) { r.left = left; changed = true; } if (left === 0) { r.state = 'here'; changed = true; TH.notify('Your Lyft is here', `${r.car} · ${r.plate} (simulated)`, 'rides'); } }
    // event reminders 30 minutes ahead
    const n = TH.clock.now();
    h.calendar.forEach(x => { if (x.reminded) return; const s = TH.laDate(x.start); const dm = (s - n) / 60000; if (dm > 0 && dm <= 30) { x.reminded = true; changed = true; TH.notify(`Starting soon: ${x.title}`, `${TH.fmtTime(s)}${x.where ? ' · ' + x.where : ''}`, 'plans'); } });
    if (changed) { TA.State.save(); if (!$('.sheet-wrap') && ['home', 'queue', 'food', 'plans', 'rides'].includes(S.route) && !isTyping()) render(true); }
  }
  TH.tickSims = tickSims;
  const isTyping = () => { const a = document.activeElement; return a && /INPUT|SELECT|TEXTAREA/.test(a.tagName); };

  // ---------- My Day items ----------
  const COLORS = { Class: 'var(--c-study)', Appointment: 'var(--c-health)', 'Study room': 'var(--c-study)', 'Club event': 'var(--c-fitness)', Event: 'var(--c-dining)', 'Trojan Pass': 'var(--c-landmark)', Zipcar: '#3d9b35', 'Virtual line': 'var(--c-health)', 'Mobile order': 'var(--c-dining)', 'USC Lyft': '#ff00bf' };
  // Trojan Assist stores its own times as toISOString() of a campus wall-clock Date (TA.now() follows TH.clock),
  // so reading them back with new Date() restores the same wall-clock fields; offset-less strings are wall clock too.
  const taDate = s => !s ? null : (/[zZ]|[+-]\d\d:?\d\d$/.test(String(s)) ? new Date(s) : TH.laDate(String(s)));
  TH.taDate = taDate;
  TH.dayItems = function (off) {
    const day = H.dayAt(off), key = TH.dkey(day), items = [], d = hasTA() ? TA.State.d : null, h = hub();
    const push = o => items.push(Object.assign({ color: COLORS[o.kind] || 'var(--cardinal)' }, o));
    TH.classesOn(day).forEach(c => push({ start: c.start, end: c.end, kind: 'Class', title: `${c.code} ${c.type}`, sub: `${c.title}${c.instructor ? ' · ' + c.instructor : ''}`, go: null }));
    if (d) {
      ['health', 'advising', 'careers'].forEach(k => ((d[k] && d[k].appointments) || []).forEach(a => { const t = taDate(a.at); if (t && TH.dkey(t) === key) push({ start: TH.minOfDay(t), end: TH.minOfDay(t) + (a.dur || 30), kind: 'Appointment', title: a.type || a.kind || 'Appointment', sub: a.where || a.kind || (k === 'health' ? 'Student Health' : k === 'careers' ? 'Career Center' : 'Advising') }); }));
      ((d.library && d.library.reservations) || []).forEach(r => { const t = taDate(r.at); if (t && TH.dkey(t) === key) push({ start: TH.minOfDay(t), end: TH.minOfDay(t) + (r.dur || 60), kind: 'Study room', title: r.lib || 'Library room', sub: r.room || 'Library reservation' }); });
    }
    h.calendar.forEach(x => {
      const s = TH.laDate(x.start), en = TH.laDate(x.end || x.start); if (!s) return;
      const sk = TH.dkey(s), ek = TH.dkey(en);
      if (key < sk || key > ek) return;
      const a = sk === key ? TH.minOfDay(s) : 0, b = ek === key ? Math.max(a + 15, TH.minOfDay(en)) : 1440;
      push({ start: a, end: b, kind: x.kind === 'club' ? 'Club event' : 'Event', title: x.title, sub: [x.org, x.where].filter(Boolean).join(' · ') || 'EngageSC event', event: x.ref, color: x.kind === 'club' ? COLORS['Club event'] : COLORS.Event });
    });
    h.passes.filter(b => b.day === key).forEach(b => { const ps = (TH.PASSES || []).find(p => p.id === b.id) || { name: b.id, len: 60 }; push({ start: b.start, end: b.start + (ps.len || 60), kind: 'Trojan Pass', title: ps.name, sub: `${b.checked ? 'Checked in · ' : ''}Return time ${H.timeRange(b.start, b.start + (ps.len || 60))} · ${TH.byId[ps.where]?.name || ''}`, go: 'pass' }); });
    h.zips.filter(z => z.day === key).forEach(z => push({ start: z.start, end: z.start + z.hours * 60, kind: 'Zipcar', title: 'Zipcar at USC', sub: `${z.hours} h · pick a car in the Zipcar app`, go: 'rides:zipcar' }));
    h.orders.filter(o => o.day === key && o.state !== 'picked').forEach(o => push({ start: o.window, end: o.window + 10, kind: 'Mobile order', title: TH.byId[o.at]?.name || 'Mobile order', sub: o.state === 'ready' ? `Ready · code ${o.code}` : o.state === 'preparing' ? 'Being made now' : `Pickup ${H.timeRange(o.window, o.window + 10)} · tap I’m here`, go: 'food:order', live: true }));
    if (off === 0) {
      const nm = H.nowMin();
      h.lines.filter(l => l.state !== 'done').forEach(l => { const def = (TH.QUEUES || []).find(x => x.id === l.id) || { name: l.id, per: 10 }; push({ start: nm, end: nm + Math.max(5, l.pos * (def.per || 10)), kind: 'Virtual line', title: def.name, sub: l.state === 'called' ? 'Your turn now! Head over.' : `#${l.pos} in line · ~${l.pos * (def.per || 10)} min (est.)`, go: 'queue', live: true }); });
      if (h.ride && h.ride.state !== 'done') push({ start: nm, end: nm + 15, kind: 'USC Lyft', title: `To ${h.ride.to}`, sub: h.ride.state === 'here' ? 'Driver is here' : `Arriving in ${h.ride.left ?? h.ride.eta} min (simulated)`, go: 'rides', live: true });
    }
    if (TH.acad) {
      TH.acad.examsOn(key).forEach(x => push({ start: x.start, end: x.end, kind: x.kind === 'final' ? 'Final exam' : 'Midterm', title: `${x.course} ${x.title}`, sub: x.where, go: 'grades:' + x.course, color: 'var(--cardinal)', exam: true }));
      TH.acad.dueOn(key).forEach(i => push({ start: i.min, end: i.min, kind: 'Due · ' + TH.acad.typeLabel(i.type), title: i.title, sub: `${i.course} · due ${TH.acad.dueLabel(i)}${TH.acad.isDone(i) ? ' · done' : ''}`, color: i.color, due: i.id, done: TH.acad.isDone(i) }));
    }
    return items.sort((a, b) => a.start - b.start || a.end - b.end);
  };

  // =====================================================================
  // HOME
  // =====================================================================
  const SKYLINE = `<svg class="skyline" viewBox="0 0 230 150" fill="currentColor" aria-hidden="true"><path d="M0 150V112h22v-14h16v14h12V92l14-10 14 10v20h10V70h8V44l7-14 7 14v26h8v80zM112 150V96h46V84l23-18 23 18v12h26v54z"/><rect x="128" y="104" width="6" height="12" fill="#7a0a0e"/><rect x="142" y="104" width="6" height="12" fill="#7a0a0e"/><rect x="176" y="98" width="10" height="20" rx="5" fill="#7a0a0e"/><rect x="104" y="50" width="5" height="10" fill="#7a0a0e"/></svg>`;
  function latestAlert(withinH) {
    const n = TH.clock.now();
    return (TH.DPS_ALERTS || []).filter(a => !a.sensitive && a.level === 'alert').map(a => [a, (n - TH.laDate(a.date)) / 36e5]).filter(([, h]) => h >= 0 && h <= withinH).sort((a, b) => a[1] - b[1]).map(([a, h]) => Object.assign({ hoursAgo: Math.round(h) }, a))[0] || null;
  }
  TH.latestAlert = latestAlert;
  function campusStatus(now) {
    const A = TH.SAFETY.access || {}, t = s => TH.hoursHelpers.t(s), m = TH.minOfDay(now);
    const a = t(A.start || '21:00'), b = t(A.end || '06:00'), controlled = a > b ? (m >= a || m < b) : (m >= a && m < b);
    const gates = TH.PLACES.filter(p => p.cat === 'gate'), known = gates.filter(g => TH.status(g, now).open != null), open = known.filter(g => TH.status(g, now).open);
    const after = (A.after9 || []).map(id => (TH.byId[id] ? TH.byId[id].name.replace(/ (Entrance|Gate).*$/, '') : id));
    return { controlled, open: open.length, known: known.length, after, idCheck: A.idCheck || '9 PM – 6 AM' };
  }
  TH.campusStatus = campusStatus;
  function factOfDay(now) { const doy = Math.floor((TH.dayStart(now) - new Date(now.getFullYear(), 0, 0)) / 864e5); const F = TH.FACTS || []; return F.length ? F[doy % F.length] : null; }
  const EV_COLORS = { 'Free food': ['#c4501b', '#8a2a07'], Social: ['#c2185b', '#6d0f35'], Community: ['#138a72', '#08473a'], Academics: ['#445a77', '#1f2a3a'], 'Student Life': ['#990000', '#4a0507'], 'Health and Community Well-Being': ['#2e9a5a', '#14502c'], Sustainability: ['#4f8a1f', '#25450c'], Spiritual: ['#6a3fb0', '#33175e'], Arts: ['#8e3fb0', '#43175e'], 'Undergraduate Student Government': ['#1e66c9', '#0c2f66'], 'RA Floor Program': ['#b48300', '#5c4300'] };
  const DEFAULT_EV = ['#990000', '#4a0507'];
  function evCard(e) {
    const tag = e.food ? 'Free food' : (e.cats || []).find(c => EV_COLORS[c]) || (e.cats || [])[0];
    const [a, b] = EV_COLORS[tag] || DEFAULT_EV;
    const when = e.allDay ? 'All day' : `${fmtMin(e.start)}${e.end && e.end !== e.start && e.end < 1440 ? ' – ' + fmtMin(e.end) : ''}`;
    return `<button class="card evcard" data-event="${esc(e.id)}"><span class="evart" style="background:linear-gradient(135deg, ${a}, ${b})">${e.food ? '★ Free food' : esc(tag || 'Event')}</span>
      <span class="evbody"><span class="mono muted" style="font-size:12px">${e.off ? esc(H.dayLabel(e.date)) + ' · ' : ''}${esc(when)}</span><h3>${esc(e.title)}</h3><span class="muted" style="font-size:12.5px">${esc(e.org || '')}</span></span></button>`;
  }
  TH.evCard = evCard; TH.EV_COLORS = EV_COLORS;
  const homeWaitIds = () => TH.PLACES.filter(p => p.crowd || p.seats).sort((a, b) => (b.hall ? 2 : b.seats ? 1 : 0) - (a.hall ? 2 : a.seats ? 1 : 0) || (a.cat === 'parking') - (b.cat === 'parking')).slice(0, 10);

  // Disney-app "Your plans now": the student's live plans plus the current/next class, most urgent first.
  // Urgency tiers: 0 = needs you now (I'm here / pick up / your turn / driver here / check-in open),
  // 1 = happening now (being made, waiting in line, driver on the way, class in progress), 2 = later today (by start time).
  const LIVE_KINDS = ['Mobile order', 'Virtual line', 'Trojan Pass', 'USC Lyft'];
  function plansNow(nm) {
    const h = hub(), key = TH.dkey(TH.clock.now()), out = [];
    const row = (go, ic, color, kind, title, sub, act) => `<div class="row rn-row" style="--rc:${color}"><button class="rn-main" data-go="${esc(go)}"><span class="rico">${icon(ic)}</span><span class="rmain"><span class="mono muted kindline">${esc(kind)}</span><span class="rtitle">${esc(title)}</span><span class="rsub">${esc(sub)}</span></span></button>${act ? `<span class="rside">${act}</span>` : ''}</div>`;
    const add = (tier, t, html) => out.push({ tier, t, html });
    h.orders.filter(o => o.day === key && o.state !== 'picked').forEach(o => {
      const nm2 = (TH.byId[o.at] || {}).name || 'Mobile order', win = H.timeRange(o.window, o.window + 10), canHere = nm >= o.window - 30;
      const act = o.state === 'placed' ? (canHere ? `<button class="btn sm gold" data-rn-here="${esc(o.code)}">I’m here</button>` : `<span class="muted tiny">“I’m here” from ${fmtMin(o.window - 30)}</span>`)
        : o.state === 'ready' ? `<button class="btn sm" data-rn-picked="${esc(o.code)}">Picked up</button>` : '';
      const tier = o.state === 'ready' || (o.state === 'placed' && canHere) ? 0 : o.state === 'preparing' ? 1 : 2;
      add(tier, o.window, row('food:order', 'bag', COLORS['Mobile order'], 'Mobile order · ' + (o.state === 'ready' ? 'ready' : o.state === 'preparing' ? 'being made' : 'placed'), nm2, o.state === 'ready' ? `Ready · code ${o.code}` : `Pickup ${win}`, act));
    });
    h.lines.filter(l => l.state !== 'done').forEach(l => {
      const def = (TH.QUEUES || []).find(x => x.id === l.id) || { name: l.id, per: 10 };
      add(l.state === 'called' ? 0 : 1, nm, row('queue', 'users', COLORS['Virtual line'], 'Virtual line · simulated', def.name, l.state === 'called' ? 'Your turn now! Head over.' : `#${l.pos} in line · ~${Math.max(1, Math.round(l.pos * (def.per || 10)))} min est.`, l.state === 'called' ? `<span class="pill gold">Go now</span>` : ''));
    });
    const ride = h.ride && h.ride.state !== 'done' ? h.ride : null;
    if (ride) add(ride.state === 'here' ? 0 : 1, nm, row('rides', 'car', COLORS['USC Lyft'], 'USC Lyft · simulated', ride.state === 'here' ? 'Your driver is here' : `Driver arriving in ${ride.left ?? ride.eta} min`, `To ${ride.to}${ride.car ? ' · ' + ride.car : ''}`, ''));
    h.passes.filter(b => b.day === key && !b.checked).forEach(b => {
      const ps = (TH.PASSES || []).find(p => p.id === b.id) || { name: b.id, len: 60 }, end = b.start + (ps.len || 60);
      if (end <= nm) return;
      const open = nm >= b.start - 15;
      const act = open ? `<button class="btn sm gold" data-rn-checkin="${esc(b.bid)}">Check in</button>` : `<span class="muted tiny">in ${fmtDelta(b.start - nm)}</span>`;
      add(open ? 0 : 2, b.start, row('pass', 'ticket', COLORS['Trojan Pass'], 'Trojan Pass · return time', ps.name, H.timeRange(b.start, end), act));
    });
    // the current class (or next thing on My Day that isn't one of the live plans above)
    const nx = TH.dayItems(0).find(i => i.end > nm && !i.due && !LIVE_KINDS.includes(i.kind));
    if (nx) {
      const go = nx.go ? `data-go="${esc(nx.go)}"` : nx.event ? `data-event="${esc(nx.event)}"` : nx.place ? `data-place="${esc(nx.place)}"` : 'data-go="plans"';
      add(nx.start <= nm ? 1.5 : 2, nx.start, // a class in progress sits after live plans that are happening now
         `<div class="row rn-row" style="--rc:${nx.color}"><button class="rn-main" ${go}><span class="rico">${icon(nx.kind === 'Class' ? 'book' : 'calendar')}</span><span class="rmain"><span class="mono muted kindline">${esc(nx.kind)} · ${nx.start <= nm ? 'Now' : 'in ' + fmtDelta(nx.start - nm)}</span><span class="rtitle">${esc(nx.title)}</span><span class="rsub">${H.timeRange(nx.start, nx.end)}${nx.sub ? ' · ' + esc(nx.sub) : ''}</span></span></button></div>`);
    }
    return out.sort((a, b) => a.tier - b.tier || a.t - b.t).map(x => x.html);
  }
  TH.plansNow = plansNow;

  screens.home = {
    render() {
      const now = TH.clock.now(), h = now.getHours(), st = TH.student(), H2 = hub();
      const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      const cs = campusStatus(now);
      const alert = latestAlert(72), lastAl = alert ? null : latestAlert(24 * 21);
      const nm = H.nowMin();
      // Disney-app style: live plans first (mobile orders, virtual lines, return times in the next 2 h), then the next class/event
      const plans = plansNow(nm), shownPlans = plans.slice(0, 3);
      const waits = homeWaitIds();
      const all = TH.events();
      const today = all.filter(e => e.off === 0 && !e.multiDay && !e.allDay && e.end > nm).slice(0, 12);
      const soon = today.length ? [] : all.filter(e => e.off >= 1 && e.off <= 3 && !e.multiDay && !e.allDay).slice(0, 8);
      const fact = factOfDay(now);
      const game = S.gameday;
      const parked = H2.parking && TH.byId[H2.parking.at];
      const weekEnd = TH.addDays(now, 7);
      const clubEv = H2.calendar.filter(x => x.kind === 'club').map(x => [x, TH.laDate(x.start)]).filter(([, s]) => s >= now && s <= weekEnd).sort((a, b) => a[1] - b[1]).slice(0, 8);
      return `<div class="screen" id="home-screen">
        <header class="hero pad ${game ? 'game' : ''}">${SKYLINE}
          <div class="row1"><span class="brand"><span class="mark">T</span>TROJAN HUB</span>
            <span class="hero-btns"><button data-go="alerts" aria-label="Alerts">${icon('bell')}<span class="dot" id="bell-dot" hidden></span></button><button data-go="wallet" aria-label="Wallet">${icon('wallet')}</button></span></div>
          <h1>${greet},<br><em>${esc(st.first)}</em></h1>
          <p class="sub">${TH.DAYS[now.getDay()]}, ${TH.MONTHS[now.getMonth()]} ${now.getDate()} · ${fmtTime(now)}${TH.clock.overridden ? ' (demo time)' : ''}</p>
          <div class="status-row">${cs.controlled
            ? `<span class="hpill"><span class="led amber"></span>Controlled access · ${esc(cs.idCheck)}</span><span class="hpill">${icon('gate')}Open: ${esc(cs.after.join(' & ') || 'McCarthy & McClintock')}</span>`
            : `<span class="hpill"><span class="led"></span>Campus open${cs.known ? ` · ${cs.open}/${cs.known} entrances` : ''}</span><span class="hpill">${icon('shield')}ID check ${esc(cs.idCheck)}</span>`}
            ${game ? `<span class="hpill" style="background:var(--gold);color:#4a3500">${icon('football')}Game day</span>` : ''}</div>
        </header>
        <div class="pad screen-body stack" style="padding-top:16px">
          ${TH.feed ? TH.feed.top() : ''}
          ${alert ? `<button class="banner" data-go="safety">${icon('shield')}<div><b>DPS ${esc(alert.kind || 'alert')}: ${esc(alert.title)}</b><span>${alert.hoursAgo < 1 ? 'Just now' : alert.hoursAgo + 'h ago'}${alert.where ? ' · ' + esc(alert.where) : ''} · Tap for the safety map</span></div></button>` : ''}
          <nav class="quick" aria-label="Quick actions">
            ${[['Grades', 'grad', 'grades'], ['Free Lyft', 'car', 'rides:lyft'], ['Next Bus', 'bus', 'rides'], ['Order Food', 'bag', 'food:order'], ['Guest Pass', 'idcard', 'guests'], ['Safe Walk', 'walk', 'safety'], ['Book a Room', 'ticket', 'pass:room'], ['Ask Tommy', 'sparkle', 'assistant']].map(([l, ic, g]) => `<button data-go="${g}"><span class="qi">${icon(ic)}</span>${l}</button>`).join('')}
          </nav>
          <div class="section plans-now"><div class="section-head"><h2>Your plans now</h2><button data-go="plans">My Day${plans.length > 3 ? ` (+${plans.length - 3})` : ''}</button></div>
            ${shownPlans.length ? `<div class="rows rightnow">${shownPlans.join('')}</div>` : `<p class="muted">Nothing else on your plans today. ${today.length ? 'See what’s happening below.' : ''}</p>`}</div>
          ${TH.feed ? TH.feed.sections() : ''}
          ${H2.clubs.length ? `<div class="section"><div class="section-head"><h2>Your clubs this week</h2><button data-go="plans:week">Calendar</button></div>
            ${clubEv.length ? `<div class="carousel">${clubEv.map(([x, s]) => `<button class="card clubev" data-event="${esc(x.ref)}"><span class="mono muted" style="font-size:12px">${esc(H.dayLabel(s))} · ${fmtTime(s)}</span><b>${esc(x.title)}</b><span class="muted" style="font-size:12.5px">${esc(x.org || '')}</span></button>`).join('')}</div>` : `<p class="muted">No events from your ${H2.clubs.length} club${H2.clubs.length === 1 ? '' : 's'} in the next 7 days. <button class="linkbtn" data-go="clubs">Find more clubs</button></p>`}</div>` : ''}
          <div class="section"><div class="section-head"><h2>Wait times ${H.est()}</h2><button data-go="map">See map</button></div>
            <div class="carousel">${waits.filter(p => TH.live(p, now) || TH.status(p, now).open === false).map(p => { const lv = TH.live(p, now), s2 = TH.status(p, now); return `<button class="card wait" data-place="${esc(p.id)}"><span class="wname">${esc(p.name.replace(/ \(.*\)/, ''))}</span>${lv ? `<span class="wn">${lv.value}<small>${lv.kind === 'wait' ? 'min' : lv.kind === 'busy' ? '% full' : lv.unit}</small></span><span class="meter"><i class="${H.toneFor(lv)}" style="width:${Math.min(100, lv.pct)}%"></i></span><span class="muted estline">Est. ${lv.kind === 'wait' ? lv.label : lv.kind === 'seats' ? 'open seats' : 'busyness'}</span>` : `<span class="wn closed">${s2.open == null ? 'Hours n/a' : 'Closed'}</span><span class="muted" style="font-size:12px">${esc(s2.detail || '')}</span>`}</button>`; }).join('')}</div></div>
          ${parked ? `<button class="card flat parkcard" data-place="${esc(parked.id)}">${icon('parking')}<span style="flex:1"><b>You parked at ${esc(parked.name)}</b><br><span class="muted" style="font-size:13px">${esc(H2.parking.level || 'No level saved')} · saved ${fmtDelta(Math.round((Date.now() - H2.parking.t) / 60000))} ago</span></span>${icon('chev')}</button>` : ''}
          ${H2.clubs.length ? '' : `<button class="card promo" data-go="clubs"><span class="qi">${icon('users')}</span><span style="flex:1"><b>Find your people</b><br><span class="muted" style="font-size:13px">Browse ${(TH.CLUBS || []).length.toLocaleString()} real EngageSC groups. Join one and its events land on your calendar.</span></span>${icon('chev')}</button>`}
          <div class="section"><div class="section-head"><h2>${today.length ? 'Happening today' : 'Coming up'}</h2><button data-go="events">All events</button></div>
            ${(today.length ? today : soon).length ? `<div class="carousel">${(today.length ? today : soon).map(evCard).join('')}</div>` : `<p class="muted">No public events listed in the next few days.</p>`}
            <span class="muted tiny">Public events from EngageSC (engage.usc.edu), collected Nov 9, 2026.</span></div>
          ${!alert && lastAl ? `<button class="row flatrow" data-go="safety"><span class="rico" style="--rc:var(--c-safety)">${icon('shield')}</span><span class="rmain"><span class="rtitle">Latest DPS alert: ${esc(lastAl.title)}</span><span class="rsub">${esc(TH.fmtDate(TH.laDate(lastAl.date)))} · Safety map and tips</span></span>${icon('chev', 'chev')}</button>` : ''}
          ${fact ? `<div class="fact"><span class="eyebrow">USC fact of the day</span><p>${esc(fact.text)}</p>${fact.url ? `<a href="${esc(fact.url)}" target="_blank" rel="noopener">Source: ${esc(H.srcName(fact.url))} ↗</a>` : ''}</div>` : ''}
          <div class="section"><div class="section-head"><h2>Explore by area</h2></div>
            <div class="chips">${Object.entries(TH.AREAS).map(([k, a]) => `<button class="chip" data-area="${esc(k)}">${icon('pin')}${esc(a.name)}</button>`).join('')}</div></div>
          <p class="muted tiny" style="text-align:center;padding:6px 0 60px">Student prototype · real USC hours, map, events and DPS data; account actions are simulated${TH.clock.overridden ? ' · demo time ' + fmtTime(now) : ''}</p>
        </div></div>`;
    },
    mount(host) {
      host.addEventListener('click', e => {
        const b = e.target.closest('[data-rn-here],[data-rn-picked],[data-rn-checkin]'); if (!b) return;
        e.stopPropagation();
        if (b.dataset.rnHere) TH.runAct('orderHere', [b.dataset.rnHere], 'Got it. The kitchen is starting your order.');
        else if (b.dataset.rnPicked) TH.runAct('orderPicked', [b.dataset.rnPicked]);
        else if (b.dataset.rnCheckin) TH.runAct('checkInPass', [b.dataset.rnCheckin], 'Checked in. Enjoy!');
      }, true);
      if (TH.feed) TH.feed.mount(host);
      host.addEventListener('click', e => { const a = e.target.closest('[data-area]'); if (a) { S.map.area = a.dataset.area; S.map.list = false; TH.go('map'); } });
    },
  };

  // =====================================================================
  // MAP
  // =====================================================================
  screens.map = {
    render() {
      const M = S.map, arg = S.params.arg;
      if (arg && TH.CATS[arg]) { M.cat = arg; M.list = false; }
      if (arg === 'safety-layer' || arg === 'safety') M.safety = true;
      if (arg && TH.byId[arg]) { M.focus = arg; }
      if (arg === 'gates' || arg === 'fence') { M.fence = true; M.list = false; M.fit = 'fence'; }
      if (arg === 'lyft-zone') { M.lyft = true; M.list = false; M.fit = 'lyft'; }
      if (arg === 'dps-zone') { M.dps = true; M.list = false; M.fit = 'dps'; }
      if (arg === 'bikes') { M.bikes = true; M.list = false; }
      if (arg && /^bldg-/.test(arg)) { M.query = arg.slice(5); M.list = false; M.goBldg = true; }
      if (M.hour == null) M.hour = TH.clock.now().getHours();
      const chips = [['all', 'All', 'layers'], ...Object.entries(TH.CATS).map(([k, c]) => [k, c.label, c.icon])];
      return `<div class="mapscreen">
        <div class="map-wrap" id="mapwrap"></div>
        ${M.list ? `<div class="maplist pad" id="maplist"></div>` : ''}
        <div class="map-head pad">
          <div class="searchbar"><label class="searchbox">${icon('search')}<span class="sr">Search places</span><input id="map-q" type="search" placeholder="Search places or a building code (THH 201)" value="${esc(M.query)}" autocomplete="off"></label>
            <button class="iconbtn" id="map-listtoggle" aria-label="${M.list ? 'Show map' : 'Show list'}">${icon(M.list ? 'map' : 'list')}</button></div>
          <div class="chips" role="toolbar" aria-label="Filter places">
            <button class="chip" id="chip-safety" aria-pressed="${M.safety}" style="--chip-c:var(--risk-high)">${icon('shield')}Safety layer</button>
            <button class="chip" id="chip-fence" aria-pressed="${!!M.fence}" style="--chip-c:var(--c-gate)">${icon('fence')}Gates &amp; fence</button>
            <button class="chip" id="chip-dps" aria-pressed="${!!M.dps}" style="--chip-c:var(--c-safety)">${icon('shield')}DPS zone</button>
            <button class="chip" id="chip-lyft" aria-pressed="${!!M.lyft}" style="--chip-c:#ff00bf">${icon('car')}Free Lyft zone</button>
            <button class="chip" id="chip-bikes" aria-pressed="${!!M.bikes}" style="--chip-c:#2f7d32">${icon('bike')}Bike parking</button>
            <button class="chip" id="chip-open" aria-pressed="${M.openNow}" style="--chip-c:var(--ok)">${icon('clock')}Open now</button>
            ${chips.map(([k, l, ic]) => `<button class="chip" data-cat="${k}" aria-pressed="${M.cat === k}" style="--chip-c:${TH.CATS[k]?.color || 'var(--ink)'}">${icon(ic)}${esc(l)}</button>`).join('')}
          </div>
          <div id="map-bres"></div>
        </div>
        ${M.list ? '' : `<div class="map-ctrls"><button class="iconbtn" id="z-in" aria-label="Zoom in">${icon('plus')}</button><button class="iconbtn" id="z-out" aria-label="Zoom out">${icon('minus')}</button><button class="iconbtn" id="z-me" aria-label="Center on me">${icon('locate')}</button></div>`}
        <div id="map-bottom"></div>
      </div>`;
    },
    mount(host) {
      const M = S.map;
      const q = s => (s || '').toLowerCase();
      const filt = p => !p.hidden && !(M.fence && !M.list && p.cat === 'gate') && (M.cat === 'all' || p.cat === M.cat) && (!M.openNow || TH.status(p).open === true) && (!M.query || q(p.name + ' ' + (p.tags || []).join(' ') + ' ' + (p.features || []).join(' ') + ' ' + (p.bldg || '') + ' ' + (TH.CATS[p.cat] || {}).label).includes(q(M.query)));
      // search relevance: exact / prefix name > word-prefix in name > name contains > building, tags, features > walk time
      const rel = p => {
        const Q = q(M.query).trim(); if (!Q) return 0;
        const nm = q(p.name), base = nm.replace(/\s*\(.*\)\s*/g, ' ').trim();
        if (nm === Q || base === Q) return 6;
        if (nm.startsWith(Q) || base.startsWith(Q)) return p.inferred ? 4.5 : 5;
        if (new RegExp('\\b' + Q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(nm)) return p.inferred ? 3.5 : 4;
        if (nm.includes(Q)) return 3;
        if (q(p.bldg).includes(Q)) return 2;
        return 1;
      };
      const ranked = () => TH.PLACES.filter(filt).sort((a, b) => rel(b) - rel(a) || H.walkMin(a) - H.walkMin(b));
      let mv = null;
      try { mv = TH._map = new TH.MapView($('#mapwrap', host), { filter: filt, safety: M.safety, hour: M.hour, onSelect: p => TH.openPlace(p.id), view: M.view }); }
      catch (e) { console.error(e); $('#mapwrap', host).innerHTML = `<div class="empty">${icon('map')}<b>The map couldn’t load</b><span>${esc(e.message)}</span></div>`; }
      const setView = () => { if (mv) M.view = { ...mv.view }; };
      if (mv && M.area && TH.AREAS[M.area]) { const a = TH.AREAS[M.area]; mv.centerOn(a.x, a.y, a.zoom || 520); M.area = null; }
      if (mv && M.focus && TH.byId[M.focus]) { const p = TH.byId[M.focus]; mv.centerOn(p.x, p.y, 380); mv.select(p.id); M.focus = null; }
      const renderList = () => { const L = $('#maplist', host); if (!L) return; const items = ranked(); L.innerHTML = items.length ? `<p class="muted tiny" style="margin:0 0 8px">${items.length} place${items.length === 1 ? '' : 's'} · nearest first · wait numbers are estimates</p><div class="rows">${items.map(p => H.placeRow(p)).join('')}</div>` : `<div class="empty">${icon('search')}<b>No matches</b><span>Try another filter or turn off Open now.</span></div>`; };
      renderList();
      const computeRoute = () => {
        const R0 = S.activeRoute; const o = { hour: R0.hour, accessible: M.accessible };
        R0.safe = TH.route(R0.from, R0.to, { ...o, mode: 'safe' }); R0.fast = TH.route(R0.from, R0.to, { ...o, mode: 'fast' });
        R0.same = R0.safe.pts.join() === R0.fast.pts.join();
      };
      const drawRoute = () => { if (!mv || !S.activeRoute) return; const R0 = S.activeRoute; const r = R0.mode === 'fast' ? R0.fast : R0.safe, alt = R0.same ? null : (R0.mode === 'fast' ? R0.safe : R0.fast); mv.showRoute(r, alt); };
      const bottom = () => {
        const B = $('#map-bottom', host); if (!B) return;
        if (S.activeRoute) {
          const R0 = S.activeRoute, r = R0.mode === 'fast' ? R0.fast : R0.safe, lv = TH.riskLevel(r.risk);
          const night = TH.isNight ? TH.isNight(R0.hour) : (R0.hour >= 19 || R0.hour < 6);
          B.innerHTML = `<div class="map-legend routecard">
            <div class="rc-head"><b>${icon('walk')} To ${esc(R0.to.label || R0.to.name)}</b><button class="iconbtn flat" id="route-x" aria-label="End route">${icon('x')}</button></div>
            <div class="seg"><button data-rmode="safe" aria-pressed="${R0.mode !== 'fast'}">Fewer reports · ${R0.safe.minutes} min</button><button data-rmode="fast" aria-pressed="${R0.mode === 'fast'}">Fastest · ${R0.fast.minutes} min</button></div>
            <div class="rc-row"><span class="pill ${lv === 'low' ? 'ok' : lv === 'med' ? 'warn' : 'bad'}">${esc(TH.riskLabel[lv])}</span><span class="muted rc-via">${Math.round(r.meters)} m · via ${esc(r.streets.slice(0, 3).join(', '))}</span></div>
            <label class="check small"><input type="checkbox" id="rc-acc" ${M.accessible ? 'checked' : ''}> Step-free route (avoid stairs)</label>
            ${night && lv !== 'low' && TH.lyftOpen && TH.lyftOpen(TH.clock.now()) ? `<button class="btn sm" data-go="rides:lyft" style="background:#ff00bf;color:#fff">${icon('car')} Take a free USC Lyft instead</button>` : ''}
            <span class="muted tiny">${esc(TH.riskCaption || '')}</span>
          </div>`;
          $('#route-x', B).onclick = () => { S.activeRoute = null; mv && mv.clearRoute(); bottom(); };
          $$('[data-rmode]', B).forEach(b => b.onclick = () => { S.activeRoute.mode = b.dataset.rmode; drawRoute(); bottom(); });
          $('#rc-acc', B).onchange = e => { M.accessible = e.target.checked; computeRoute(); drawRoute(); bottom(); };
          bindCommon(B);
          return;
        }
        if (M.safety && !M.list) {
          const ctl = TH.isControlledHour ? TH.isControlledHour(M.hour) : false;
          B.innerHTML = `<div class="map-legend"><div class="rc-head"><b>Street safety at <span class="mono" id="hr-lbl">${fmtMin(M.hour * 60)}</span></b><button data-go="safety" class="linkbtn">Details</button></div>
            <label class="sr" for="hr">Hour of day</label><input id="hr" type="range" min="0" max="23" step="1" value="${M.hour}">
            <div class="legend-row"><span><i style="background:var(--risk-low)"></i>${esc(TH.riskLabel.low)}</span><span><i style="background:var(--risk-med)"></i>${esc(TH.riskLabel.med)}</span><span><i style="background:var(--risk-high)"></i>${esc(TH.riskLabel.high)}</span></div>
            <span class="muted tiny" id="hr-ctl">${ctl ? 'Controlled access now: only McCarthy and McClintock entrances are open. ' : ''}</span>
            <span class="muted tiny">From real USC DPS log entries. ${esc(TH.riskCaption || '')}</span></div>`;
          bindCommon(B);
          const hr = $('#hr', B); hr.oninput = () => { M.hour = +hr.value; $('#hr-lbl', B).textContent = fmtMin(M.hour * 60); const c2 = TH.isControlledHour ? TH.isControlledHour(M.hour) : false; $('#hr-ctl', B).textContent = c2 ? 'Controlled access now: only McCarthy and McClintock entrances are open. ' : ''; mv && mv.setSafety(true, M.hour); };
        } else if ((M.fence || M.dps || M.lyft || M.bikes) && !M.list) {
          const date = TH.dateAtHour(M.hour), G = TH.gatesAt(date), me = TH.ME || { x: 0, y: 0 }, near = TH.nearestOpenGate(me, date);
          const CTL = 'Controlled access (9 PM – 6 AM): only McCarthy Way and McClintock Ave are open, with an ID check.', DAY = 'Daytime: campus is open. Vehicle gates follow their posted hours.';
          const zrow = id => { const z = TH.ZONES[id], inside = TH.inZone(id, me.x, me.y); return `<div class="zrow"><i style="background:${z.color}"></i><span><b>${esc(z.name)}</b><small>${esc(z.note)}${id === 'lyft' ? ` ${TH.lyftOpen && TH.lyftOpen(TH.clock.now()) ? 'Running now.' : 'Not running right now.'}` : ''} You’re ${inside ? 'inside' : 'outside'} it.</small></span><button class="linkbtn" data-zfit="${id}">Show all</button></div>`; };
          const bk = M.bikes && TH.bikeRacks ? TH.bikeRacks() : [], nb = bk.length ? TH.nearestBike(me) : null;
          B.innerHTML = `<div class="map-legend">
            ${M.fence ? `<div class="rc-head"><b>Gates at <span class="mono" id="hr-lbl">${fmtMin(M.hour * 60)}</span></b><span class="pill ${G.controlled ? 'warn' : 'ok'}" id="g-pill">${G.open.length} of ${G.all.length} open</span></div>
              <label class="sr" for="hr">Hour of day</label><input id="hr" type="range" min="0" max="23" step="1" value="${M.hour}">
              <div class="legend-row"><span><i style="background:var(--ok)"></i>Open</span><span><i style="background:var(--bad)"></i>Closed</span><span><i class="fence-key"></i>Fence</span></div>
              <span class="muted tiny" id="g-note">${G.controlled ? CTL : DAY}</span>
              ${near ? `<button class="btn sm" id="g-near">${icon('walk')} Nearest open gate: ${esc(near.name.replace(' (pedestrian)', ''))}</button>` : ''}` : ''}
            ${M.dps ? zrow('dps') : ''}${M.lyft ? zrow('lyft') : ''}
            ${M.bikes ? `<div class="zrow"><i style="background:#2f7d32"></i><span><b>Bike parking</b><small>${bk.filter(r => r.kind === 'rack').length} rack spots beside major buildings (approximate) and ${bk.filter(r => r.kind === 'share').length} Metro Bike Share docks${nb ? ` · nearest is ${nb.walk} min away${nb.near ? ', by ' + esc(nb.near) : ''}` : ''}. Lock to a rack: bikes on railings can be impounded.</small></span>${nb ? `<button class="linkbtn" id="bk-near">Nearest</button>` : ''}</div>` : ''}
            ${M.dps || M.lyft ? `<span class="muted tiny">Zone outlines are approximate, drawn from the published boundary streets.</span>` : ''}</div>`;
          bindCommon(B);
          const hr = $('#hr', B); if (hr) hr.oninput = () => { M.hour = +hr.value; const G2 = TH.gatesAt(TH.dateAtHour(M.hour)); $('#hr-lbl', B).textContent = fmtMin(M.hour * 60); const pl = $('#g-pill', B); pl.textContent = `${G2.open.length} of ${G2.all.length} open`; pl.className = 'pill ' + (G2.controlled ? 'warn' : 'ok'); $('#g-note', B).textContent = G2.controlled ? CTL : DAY; mv && mv.setOverlay({ hour: M.hour }); };
          if (hr) hr.onchange = () => bottom();
          const gn = $('#g-near', B); if (gn) gn.onclick = () => { S.pendingRoute = { to: near.id }; render(); };
          const bn = $('#bk-near', B); if (bn) bn.onclick = () => { S.pendingRoute = { toPoint: { id: null, name: 'Bike rack' + (nb.near ? ' by ' + nb.near : ''), label: 'bike rack' + (nb.near ? ' by ' + nb.near : ''), x: nb.x, y: nb.y } }; render(); };
          $$('[data-zfit]', B).forEach(b => b.onclick = () => mv && mv.fitZone(b.dataset.zfit));
        } else B.innerHTML = '';
      };
      const overlay = () => { if (mv && mv.setOverlay) mv.setOverlay({ fence: !!M.fence, dps: !!M.dps, lyft: !!M.lyft, bikes: !!M.bikes, hour: M.hour }); };
      overlay();
      if (mv && M.fit) { const f = M.fit; M.fit = null; setTimeout(() => f === 'fence' ? mv.fitFence() : mv.fitZone(f), 80); }
      const bres = () => {
        const el = $('#map-bres', host); if (!el) return [];
        const hits = TH.searchBuildings ? TH.searchBuildings(M.query) : [];
        el.innerHTML = hits.map((h, i) => `<button class="bres" data-bres="${i}">${icon('pin')}<span>${esc(TH.bldgLabel(h))}</span>${icon('chev')}</button>`).join('');
        $$('[data-bres]', el).forEach(b => b.onclick = () => { if (M.list) { M.list = false; M.goBldg = true; render(); return; } mv && mv.showBuilding(hits[+b.dataset.bres]); });
        return hits;
      };
      bres();
      if (mv && M.goBldg) { M.goBldg = false; const h0 = TH.searchBuildings(M.query)[0]; if (h0) mv.showBuilding(h0); }
      const layerChip = (id, key, msg) => { const c = $(id, host); if (c) c.onclick = e => { M[key] = !M[key]; e.currentTarget.setAttribute('aria-pressed', String(!!M[key])); overlay(); if (mv) { mv.renderPins(); if (M[key] && key !== 'bikes') key === 'fence' ? mv.fitFence() : mv.fitZone(key); } bottom(); if (M[key]) TH.toast(msg, key === 'fence' ? 'fence' : key === 'dps' ? 'shield' : key === 'bikes' ? 'bike' : 'car'); }; };
      layerChip('#chip-fence', 'fence', 'Fence and gates on. Drag the slider to see other hours.');
      layerChip('#chip-dps', 'dps', 'DPS patrol zone on (approximate outline).');
      layerChip('#chip-lyft', 'lyft', 'Free Lyft zone on. Rides must start and end inside.');
      layerChip('#chip-bikes', 'bikes', 'Bike parking on.');
      // pending route (from "Walk here", Tommy, the safety planner)
      if (S.pendingRoute && mv) {
        const pr = S.pendingRoute; S.pendingRoute = null;
        const toP = pr.toPoint || TH.byId[pr.to]; const from = pr.fromPoint || (pr.from && TH.byId[pr.from]) || TH.ME;
        if (toP) {
          const hour = pr.hour ?? (TH.minOfDay(TH.clock.now()) / 60);
          if (pr.hour != null) M.hour = Math.floor(pr.hour);
          S.activeRoute = { to: toP, from, hour, mode: 'safe' }; computeRoute();
          if (pr.safety) { M.safety = true; mv.setSafety(true, M.hour); $('#chip-safety', host).setAttribute('aria-pressed', 'true'); }
          if (toP.id) mv.select(toP.id);
          setTimeout(drawRoute, 60);
        }
      } else if (S.activeRoute) setTimeout(drawRoute, 60);
      bottom();
      const refresh = () => { if (mv) { mv.renderPins(); mv.applyScale(); } renderList(); };
      $$('[data-cat]', host).forEach(b => b.onclick = () => { M.cat = b.dataset.cat; $$('[data-cat]', host).forEach(x => x.setAttribute('aria-pressed', String(x === b))); refresh(); });
      $('#chip-open', host).onclick = e => { M.openNow = !M.openNow; e.currentTarget.setAttribute('aria-pressed', String(M.openNow)); refresh(); };
      $('#chip-safety', host).onclick = e => { M.safety = !M.safety; e.currentTarget.setAttribute('aria-pressed', String(M.safety)); if (mv) { mv.setSafety(M.safety, M.hour); mv.applyScale(); } bottom(); if (M.safety) TH.toast('Safety layer on. Drag the slider to see other hours.', 'shield'); };
      $('#map-listtoggle', host).onclick = () => { setView(); M.list = !M.list; render(); };
      const qi = $('#map-q', host); qi.oninput = () => { M.query = qi.value; refresh(); bres(); };
      qi.onkeydown = e => { if (e.key === 'Enter') { const bh = TH.findBuilding && TH.findBuilding(M.query); if (bh && mv && !M.list) { mv.showBuilding(bh); qi.blur(); return; } const f = ranked()[0]; if (f) { if (mv && !M.list) mv.centerOn(f.x, f.y, 380); TH.openPlace(f.id); } } };
      $('#z-in', host) && ($('#z-in', host).onclick = () => mv && mv.zoom(0.7));
      $('#z-out', host) && ($('#z-out', host).onclick = () => mv && mv.zoom(1.4));
      $('#z-me', host) && ($('#z-me', host).onclick = () => mv && mv.centerOn(TH.ME.x, TH.ME.y, 420));
      host.addEventListener('pointerup', setView);
      host.addEventListener('wheel', () => setTimeout(setView, 300), { passive: true });
    },
  };

  // =====================================================================
  // MY DAY (Day timeline + Week / Month calendar)
  // =====================================================================
  function calItemsByDay() { // hub.calendar grouped by local day key
    const m = {};
    hub().calendar.forEach(x => { const s = TH.laDate(x.start); if (!s) return; const k = TH.dkey(s); (m[k] || (m[k] = [])).push([x, s]); });
    Object.values(m).forEach(a => a.sort((p, q) => p[1] - q[1]));
    return m;
  }
  const dots = (list, classes, key) => { const A = key && TH.acad, ex = A ? A.examsOn(key).length : 0, hw = A ? A.dueOn(key).length : 0; return `<span class="cdots">${ex ? '<i class="exam"></i>' : ''}${hw ? '<i class="hw"></i>' : ''}${list.slice(0, ex || hw ? 1 : 3).map(([x]) => `<i class="${x.kind === 'club' ? 'club' : 'saved'}"></i>`).join('')}${classes ? '<i class="cls"></i>' : ''}</span>`; };
  function agendaRows(entries) {
    return `<div class="rows">${entries.map(([x, s]) => `<div class="row agenda" style="--rc:${x.kind === 'club' ? 'var(--c-fitness)' : 'var(--c-dining)'}">
      <button class="rico" data-event="${esc(x.ref)}" aria-label="Details">${icon(x.kind === 'club' ? 'users' : 'calendar')}</button>
      <button class="rmain" data-event="${esc(x.ref)}"><span class="rtitle">${esc(x.title)}</span><span class="rsub">${esc(H.dayLabel(s))} · ${fmtTime(s)}${x.org ? ' · ' + esc(x.org) : ''}</span></button>
      ${x.kind === 'club' ? `<span class="pill mute">Club</span>` : `<button class="iconbtn flat sm" data-unsave="${esc(x.ref)}" aria-label="Remove ${esc(x.title)}">${icon('trash')}</button>`}</div>`).join('')}</div>`;
  }
  function upcomingCal() { const n = TH.clock.now(); return hub().calendar.map(x => [x, TH.laDate(x.start), TH.laDate(x.end || x.start)]).filter(([, , e]) => e >= n).sort((a, b) => a[1] - b[1]).map(([x, s]) => [x, s]); }

  screens.plans = {
    render() {
      const arg = S.params.arg; if (arg === 'week' || arg === 'month' || arg === 'day') { S.plansView = arg; saveUI(); }
      const v = S.plansView;
      const seg = `<div class="seg" role="group" aria-label="Calendar view"><button data-pview="day" aria-pressed="${v === 'day'}">Day</button><button data-pview="week" aria-pressed="${v === 'week'}">Week</button><button data-pview="month" aria-pressed="${v === 'month'}">Month</button></div>`;
      const up = upcomingCal();
      const exportBtn = `<button class="btn ghost" id="cal-export" ${up.length ? '' : 'disabled'}>${icon('calendar-plus')} Add ${up.length ? up.length + ' ' : ''}event${up.length === 1 ? '' : 's'} to phone calendar</button>`;
      let body = '';
      if (v === 'day') body = dayView();
      else if (v === 'week') body = weekView() + exportBtn;
      else body = monthView();
      return `<div class="screen">${H.topbar('My Day', false, `<button class="iconbtn" data-go="events" aria-label="Add from events">${icon('plus')}</button>`)}
        <div class="pad screen-body stack">${seg}${body}</div></div>`;
    },
    mount(host) {
      $$('[data-pview]', host).forEach(b => b.onclick = () => { S.plansView = b.dataset.pview; saveUI(); S.params = {}; render(); });
      $$('[data-pday]', host).forEach(b => b.onclick = () => { S.plansDay = +b.dataset.pday; S.plansView = 'day'; saveUI(); S.params = {}; render(); });
      $$('[data-month]', host).forEach(b => b.onclick = () => { const c = S.calMonth || TH.dayStart(TH.clock.now()); S.calMonth = new Date(c.getFullYear(), c.getMonth() + (+b.dataset.month), 1); render(); });
      $$('[data-wk]', host).forEach(b => b.onclick = () => { S.plansDay += 7 * (+b.dataset.wk); render(); });
      $$('[data-unsave]', host).forEach(b => b.onclick = e => { e.stopPropagation(); TH.runAct('unsaveEvent', [b.dataset.unsave]); });
      $$('[data-hw]', host).forEach(c => c.onchange = () => { const on = TH.acad.toggleDone(c.dataset.hw); TH.toast(on ? 'Marked done' : 'Marked not done', on ? 'check' : 'refresh'); render(true); });
      const ex = $('#cal-export', host); if (ex) ex.onclick = () => TH.exportCalendar(upcomingCal().map(([x]) => x));
    },
  };
  function dayView() {
    const off = S.plansDay, items = TH.dayItems(off), now = H.nowMin(), day = H.dayAt(off), byDay = calItemsByDay();
    let nowPlaced = off !== 0;
    const tl = items.map(it => {
      let pre = '';
      if (!nowPlaced && it.start > now) { pre = `<div class="nowline" aria-label="Now"><span>${fmtMin(now).replace(' ', '')}</span></div>`; nowPlaced = true; }
      const past = off < 0 || (off === 0 && it.end < now);
      if (it.due) return pre + `<label class="tl-item tl-due ${it.done ? 'done' : ''}" style="--tc:${it.color}"><span class="tl-time">${fmtMin(it.start).replace(' ', '<br>')}</span>
        <span class="card"><span class="kind">${esc(it.kind)}</span><span class="due-line"><input type="checkbox" data-hw="${esc(it.due)}" ${it.done ? 'checked' : ''} ${off < 0 || (off === 0 && it.start < now) ? 'disabled' : ''} aria-label="Mark ${esc(it.title)} done"><b>${esc(it.title)}</b></span><span class="muted" style="font-size:13px">${esc(it.sub || '')}</span></span></label>`;
      const attrs = it.go ? `data-go="${esc(it.go)}"` : it.event ? `data-event="${esc(it.event)}"` : it.place ? `data-place="${esc(it.place)}"` : '';
      return pre + `<${attrs ? 'button' : 'div'} class="tl-item ${past ? 'past' : ''}" style="--tc:${it.color}" ${attrs}><span class="tl-time">${fmtMin(it.start).replace(' ', '<br>')}</span>
        <span class="card"><span class="kind">${esc(it.kind)}${it.live ? ' · live' : ''}</span><b>${esc(it.title)}</b><span class="muted" style="font-size:13px">${esc(it.sub || '')}${it.end > it.start ? ` · until ${fmtMin(it.end)}` : ''}</span></span></${attrs ? 'button' : 'div'}>`;
    }).join('') + (!nowPlaced ? `<div class="nowline"><span>${fmtMin(now).replace(' ', '')}</span></div>` : '');
    const base = Math.min(0, off) > -7 && off < 7 ? 0 : off; // strip: today + 6 days (or around a far-away date)
    const strip = Array.from({ length: 7 }, (_, i) => base + i);
    const holiday = window.TA && TA.POLICY && TA.POLICY.holidays ? TA.POLICY.holidays[TH.dkey(day)] : null;
    const brk = TH.acad ? TH.acad.breakOn(TH.dkey(day)) : null, dueN = items.filter(i => i.due), dueOpen = dueN.filter(i => !i.done).length;
    return `<div class="week" role="group" aria-label="Pick a day">${strip.map(o => { const d = H.dayAt(o), k = TH.dkey(d), ev = byDay[k] || []; return `<button data-pday="${o}" aria-pressed="${o === off}"><span>${o === 0 ? 'Today' : TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b>${dots(ev, TH.classesOn(d).length, k)}</button>`; }).join('')}</div>
      ${brk && !holiday ? `<div class="banner info brk">${icon('sun')}<div><b>${esc(brk.name)}</b><span>${esc(TH.acad.breakRange(brk))}${brk.note ? ' · ' + esc(brk.note) : ''}</span></div></div>` : ''}
      ${dueN.length ? `<div class="due-sum"><span class="pill ${dueOpen ? 'warn' : 'ok'}">${icon(dueOpen ? 'pencil' : 'check')}${dueOpen ? `${dueOpen} thing${dueOpen === 1 ? '' : 's'} due` : 'All homework done'}</span><span class="muted tiny">Check items off as you finish them.</span></div>` : ''}
      ${off < 0 || off > 6 ? `<button class="linkbtn" data-pday="0">${icon('back')} Back to today</button>` : ''}
      <p class="muted" style="font-size:13px">${TH.DAYS[day.getDay()]}, ${TH.MONTHS[day.getMonth()]} ${day.getDate()}${holiday ? ` · <b>${esc(holiday)}</b> (no classes)` : ''} · ${items.length} item${items.length === 1 ? '' : 's'}: classes (Fall 2026 sections), homework due, exams, appointments, bookings and calendar events.</p>
      ${items.length ? `<div class="timeline">${tl}</div>` : `<div class="empty">${icon('calendar')}<b>Nothing planned</b><span>Join a club, save an event, book a Trojan Pass or order food and it shows up here.</span><div class="btn-row"><button class="btn sm" data-go="clubs">Browse clubs</button><button class="btn sm ghost" data-go="events">Events</button></div></div>`}
      <div class="grid2"><button class="btn ghost" data-go="grades">${icon('grad')} Grades</button><button class="btn ghost" data-go="pass">${icon('ticket')} Book a pass</button></div>`;
  }
  // WEEK = homework due (by day) + exams, then club / saved events
  function weekView() {
    const off = S.plansDay, anchor = H.dayAt(off), start = TH.addDays(anchor, -anchor.getDay()), byDay = calItemsByDay(), A = TH.acad;
    const days = Array.from({ length: 7 }, (_, i) => TH.addDays(start, i));
    const todayK = TH.dkey(H.today()), nowT = TH.clock.now();
    const entries = days.flatMap(d => byDay[TH.dkey(d)] || []);
    const due = A ? A.dueBetween(start, TH.addDays(start, 7)) : [], open = due.filter(i => !A.isDone(i)).length;
    const hwDay = d => {
      const k = TH.dkey(d), list = A ? A.dueOn(k) : [], ex = A ? A.examsOn(k) : [], brk = A ? A.breakOn(k) : null;
      if (!list.length && !ex.length && !brk) return '';
      return `<div class="hw-day ${k === todayK ? 'is-today' : ''}"><div class="hw-day-h"><b>${k === todayK ? 'Today' : TH.DAYS[d.getDay()]}</b><span class="muted">${TH.MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}</span>${brk ? `<span class="pill mute">${esc(brk.name)}</span>` : ''}</div>
        ${ex.map(x => `<button class="hw-row exam" data-go="grades:${esc(x.course)}" style="--hc:${x.color}"><span class="hw-tag">${x.kind === 'final' ? 'FINAL' : 'MIDTERM'}</span><span class="hw-main"><b>${esc(x.course)} ${esc(x.title)}</b><small>${fmtMin(x.start)} – ${fmtMin(x.end)} · ${esc(x.where)}</small></span></button>`).join('')}
        ${list.map(i => { const done = A.isDone(i); return `<label class="hw-row ${done ? 'done' : ''}" style="--hc:${i.color}"><input type="checkbox" data-hw="${esc(i.id)}" ${done ? 'checked' : ''} ${i.at < nowT ? 'disabled' : ''} aria-label="Mark ${esc(i.title)} done"><span class="hw-main"><b>${esc(i.title)}</b><small>${esc(i.course)} · ${esc(A.typeLabel(i.type))} · due ${esc(A.dueLabel(i))}${i.score != null ? ` · ${i.score}/${i.pts}` : i.pending ? ' · being graded' : ''}</small></span></label>`; }).join('')}</div>`;
    };
    const hwHtml = days.map(hwDay).join('');
    return `<div class="cal-nav"><button class="iconbtn flat" data-wk="-1" aria-label="Previous week">${icon('back')}</button><b>${TH.MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${TH.MONTHS[days[6].getMonth()].slice(0, 3)} ${days[6].getDate()}</b><button class="iconbtn flat" data-wk="1" aria-label="Next week">${icon('chev')}</button></div>
      <div class="week cal-week">${days.map(d => { const k = TH.dkey(d), ev = byDay[k] || [], o = Math.round((d - H.today()) / 864e5), n = A ? A.dueOn(k).length : 0; return `<button data-pday="${o}" class="${k === todayK ? 'is-today' : ''} ${A && A.breakOn(k) ? 'is-break' : ''}" aria-label="${esc(TH.fmtDate(d, true))}: ${n} due, ${ev.length} event${ev.length === 1 ? '' : 's'}"><span>${TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b>${dots(ev, TH.classesOn(d).length, k)}</button>`; }).join('')}</div>
      ${legend()}
      <div class="section"><div class="section-head"><h2>Homework due this week</h2><span class="muted tiny">${due.length ? `${due.length - open} of ${due.length} done` : ''}</span></div>
        ${hwHtml || `<p class="muted">Nothing due this week.</p>`}</div>
      ${entries.length ? `<div class="section"><div class="section-head"><h2>Club &amp; saved events</h2></div>${agendaRows(entries)}</div>` : ''}`;
  }
  // MONTH = midterms / finals + breaks (the big-picture view); tap a day for its timeline
  function monthView() {
    const cur = S.calMonth || new Date(H.today().getFullYear(), H.today().getMonth(), 1), A = TH.acad;
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1), start = TH.addDays(first, -first.getDay()), todayK = TH.dkey(H.today());
    const cells = Array.from({ length: 42 }, (_, i) => TH.addDays(start, i));
    const weeks = cells[35].getMonth() !== cur.getMonth() ? 5 : 6;
    const mk = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`, mFirst = mk + '-01', mLast = TH.dkey(new Date(cur.getFullYear(), cur.getMonth() + 1, 0));
    const exams = A ? A.exams().filter(x => x.date.startsWith(mk)) : [];
    const breaks = A ? A.breaks().filter(b => b.from <= mLast && b.to >= mFirst) : [];
    const cell = d => {
      const k = TH.dkey(d), o = Math.round((d - H.today()) / 864e5), ex = A ? A.examsOn(k) : [], brk = A ? A.breakOn(k) : null;
      const lab = ex.length ? ex.map(x => `${x.course} ${x.title}`).join(', ') : brk ? brk.name : 'nothing scheduled';
      return `<button class="cal-day ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${k === todayK ? 'is-today' : ''} ${brk ? 'brk brk-' + brk.kind : ''} ${ex.length ? 'has-exam' : ''}" data-pday="${o}" aria-label="${esc(TH.fmtDate(d, true))}: ${esc(lab)}"><b>${d.getDate()}</b>${ex.length ? `<span class="cal-ex">${ex.slice(0, 2).map(x => `<i style="background:${x.color}">${esc(x.course.split(' ')[0].slice(0, 4))}</i>`).join('')}</span>` : brk ? `<span class="cal-brk">${esc(brk.kind === 'finals' ? 'Finals' : brk.kind === 'study' ? 'Study' : 'Off')}</span>` : ''}</button>`;
    };
    return `<div class="cal-nav"><button class="iconbtn flat" data-month="-1" aria-label="Previous month">${icon('back')}</button><b>${TH.MONTHS[cur.getMonth()]} ${cur.getFullYear()}</b><button class="iconbtn flat" data-month="1" aria-label="Next month">${icon('chev')}</button></div>
      <div class="cal-grid cal-month" role="grid"><div class="cal-dow">${TH.DAYS3.map(d => `<span>${d[0]}</span>`).join('')}</div>
      ${cells.slice(0, weeks * 7).map(cell).join('')}</div>
      <div class="cal-legend"><span><i class="exam"></i>Midterm / final</span><span><i class="brk"></i>Break or holiday</span><span><i class="fin"></i>Study days &amp; finals</span></div>
      <div class="section"><div class="section-head"><h2>Midterms &amp; finals</h2><button data-go="grades">Grades</button></div>
        ${exams.length ? `<div class="rows">${exams.map(x => `<button class="row" data-go="grades:${esc(x.course)}" style="--rc:${x.color}"><span class="rico">${icon('pencil')}</span><span class="rmain"><span class="rtitle">${esc(x.course)} ${esc(x.title)}</span><span class="rsub">${esc(TH.fmtDate(x.day))} · ${fmtMin(x.start)} – ${fmtMin(x.end)} · ${esc(x.where)}</span></span><span class="rside">${x.past ? (x.score != null ? `<b class="mono">${x.score}%</b>` : `<span class="pill mute">Done</span>`) : `<span class="pill ${x.kind === 'final' ? 'gold' : 'warn'}">in ${Math.max(0, Math.round((x.day - H.today()) / 864e5))} d</span>`}</span></button>`).join('')}</div>` : `<p class="muted">No exams this month.</p>`}</div>
      <div class="section"><div class="section-head"><h2>Breaks &amp; holidays</h2></div>
        ${breaks.length ? `<div class="rows">${breaks.map(b => `<div class="row" style="--rc:${b.kind === 'finals' || b.kind === 'study' ? 'var(--gold-ink)' : 'var(--ok)'}"><span class="rico">${icon(b.kind === 'finals' ? 'pencil' : b.kind === 'study' ? 'book' : 'sun')}</span><span class="rmain"><span class="rtitle">${esc(b.name)}</span><span class="rsub">${esc(A.breakRange(b))}${b.note ? ' · ' + esc(b.note) : b.kind === 'holiday' ? ' · no classes' : ''}</span></span></div>`).join('')}</div>` : `<p class="muted">No breaks this month.</p>`}</div>
      <p class="muted tiny">Breaks, study days and finals week come from the USC Academic Calendar; final-exam slots from the Registrar’s grid. Midterm dates are sample data for the demo student.</p>`;
  }
  const legend = () => `<div class="cal-legend"><span><i class="hw"></i>Homework due</span><span><i class="exam"></i>Exam</span><span><i class="club"></i>Club</span><span><i class="saved"></i>Saved</span><span><i class="cls"></i>Classes</span></div>`;

  // =====================================================================
  // MORE
  // =====================================================================
  const DEMO_TIMES = [[480, 'Today at 8 AM'], [720, 'Today at noon'], [900, 'Today at 3 PM'], [1080, 'Today at 6 PM'], [1260, 'Today at 9 PM'], [1380, 'Today at 11 PM'], [90, 'Today at 1:30 AM']];
  screens.more = {
    render() {
      const R = (go, ic, t, sub, color) => `<button class="row" data-go="${go}" style="--rc:${color || 'var(--cardinal)'}"><span class="rico">${icon(ic)}</span><span class="rmain"><span class="rtitle">${t}</span><span class="rsub">${sub}</span></span>${icon('chev', 'chev')}</button>`;
      const st = TH.student(), h = hub(), cur = TH.clock.overridden ? TH.minOfDay(TH.clock.now()) : 'live';
      const sel = DEMO_TIMES.some(([m]) => m === cur) ? cur : (TH.clock.overridden ? 'custom' : 'live');
      return `<div class="screen">${H.topbar('More', false)}
        <div class="pad screen-body stack">
          <button class="card profile" data-go="wallet"><span class="avatar">${esc((st.first || 'S')[0])}${esc((st.last || '')[0] || '')}</span><span style="flex:1;min-width:0"><b style="font-size:16px">${esc(st.full)}</b><br><span class="muted" style="font-size:13px">${esc(st.standing)} · ${esc(st.major)} · USC ID ${esc(st.uscid)}</span></span>${icon('chev')}</button>
          <div class="rows">
            ${R('rides', 'car', 'Getting Around', 'USC Lyft, USC buses, Metro, Zipcar, parking', 'var(--c-transit)')}
            ${R('upass', 'train', 'Metro U-Pass', h.upass ? (h.upass.status === 'active' ? 'Active · in your Wallet' : 'Requested · activate your card') : 'Free for USC students · sign up', '#e2711d')}
            ${R('food', 'fork', 'Dining & Mobile Order', 'Real hours, dining halls, order ahead', 'var(--c-dining)')}
            ${R('pass', 'ticket', 'Trojan Pass', 'Study rooms, racquetball, advising, Writing Center', 'var(--c-landmark)')}
            ${R('queue', 'queue', 'Virtual Lines', 'Career Center drop-ins, Financial Aid walk-ins, U-Pass pickup', 'var(--c-health)')}
            ${R('clubs', 'users', 'Clubs', h.clubs.length ? `${h.clubs.length} joined · ${(TH.CLUBS || []).length.toLocaleString()} on EngageSC` : `${(TH.CLUBS || []).length.toLocaleString()} real EngageSC groups`, 'var(--c-fitness)')}
            ${R('events', 'calendar', 'Events', 'Public EngageSC events, free food', 'var(--c-study)')}
            ${R('safety', 'shield', 'Safety', 'Safety map, safe walk, DPS alerts, phone numbers', 'var(--c-safety)')}
            ${R('wallet', 'wallet', 'Trojan Wallet', 'USCard in Apple Wallet, Dining Dollars, U-Pass, parking', 'var(--cardinal)')}
          </div>
          <div class="rows">
            ${R('grades', 'grad', 'Grades', TH.acad && TH.acad.termGPA() != null ? `Fall 2026 · ${TH.acad.termGPA().toFixed(2)} term GPA so far` : 'Your courses and scores', 'var(--c-study)')}
            ${R('news', 'mail', 'Club Newsletters', TH.news ? TH.news.summary() : 'This week from the clubs you follow', 'var(--c-fitness)')}
            ${R('watches', 'eye', 'Tommy’s Watch List', TH.watch ? TH.watch.summary() : 'Tell Tommy what to look out for', 'var(--gold-ink)')}
            ${R('guests', 'idcard', 'Guests', TH.guests ? TH.guests.summary() : 'Register a visitor for campus or your building', 'var(--c-gate)')}
          </div>
          <div class="rows">
            ${R('assistant', 'sparkle', 'Ask Tommy', 'Trojan Assist: answers from USC sources and acts for you', 'var(--gold-ink)')}
            ${R('gameday', 'football', 'Game Day', S.gameday ? 'Game Day mode is on' : 'Coliseum, clear-bag rules, shuttles', 'var(--cardinal)')}
            ${R('access', 'access', 'Accessibility', 'All-gender restrooms, step-free routes, OSAS', 'var(--c-restroom)')}
            ${R('alerts', 'bell', 'Alerts', `${notes().filter(n => !n.read).length} unread`, 'var(--c-service)')}
            ${R('about', 'info', 'About this prototype', 'What’s real, what’s simulated, sources', 'var(--c-service)')}
          </div>
          <div class="card flat stack">
            <b>Demo controls</b>
            <div class="field"><label for="demo-time">Demo time (the date stays Mon, Nov 9, 2026)</label>
              <select id="demo-time"><option value="live" ${sel === 'live' ? 'selected' : ''}>Live clock</option>${sel === 'custom' ? `<option value="custom" selected>Custom: ${fmtTime(TH.clock.now())}</option>` : ''}${DEMO_TIMES.map(([m, l]) => `<option value="${m}" ${sel === m ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <span class="muted tiny">Try 9 PM: controlled campus access, USC Lyft hours and the safety map change.</span></div>
            <div class="field"><label for="demo-theme">Appearance</label><select id="demo-theme">${['system', 'light', 'dark'].map(t => `<option value="${t}" ${S.theme === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>
            <button class="btn line sm" id="demo-reset">${icon('refresh')} Reset demo account</button>
            <span class="muted tiny">Resets Jordan’s account (clubs, calendar, orders, passes, Tommy’s activity log) and the app’s settings.</span>
          </div>
        </div></div>`;
    },
    mount(host) {
      $('#demo-time', host).onchange = e => {
        const v = e.target.value; if (v === 'custom') return;
        if (v === 'live') TH.clock.clear(); else TH.clock.setMinutes(+v);
        saveUI(); S.map.hour = null; TH.toast(v === 'live' ? 'Back to the live clock' : `Demo time set to ${fmtMin(+v)}`, 'clock'); render(true);
      };
      $('#demo-theme', host).onchange = e => { S.theme = e.target.value; saveUI(); applyTheme(); };
      $('#demo-reset', host).onclick = () => {
        TH.sheet(`<div class="stack"><h2>Reset the demo account?</h2><p class="muted">This clears joined clubs, calendar events, orders, passes, lines, rides, Tommy’s conversation and activity log, and app settings.</p><div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="reset-ok">Reset</button></div></div>`, w => {
          $('#reset-ok', w).onclick = () => {
            TH.clock.clear(); store.clear();
            Object.assign(S, { theme: 'system', gameday: false, plansView: 'day', plansDay: 0, calMonth: null, activeRoute: null, pendingRoute: null, map: { cat: 'all', openNow: false, safety: false, fence: false, dps: false, lyft: false, bikes: false, hour: null, list: false, query: '', view: null, area: null, accessible: false } });
            try { localStorage.removeItem('ta:convo'); } catch (e) { }
            try { if (window.TA && TA.UI && Array.isArray(TA.UI.msgs)) TA.UI.msgs.length = 0; } catch (e) { }
            if (hasTA()) { TA.State.reset(); if (TA.State.d.log) TA.State.d.log.length = 0; TA.State.save(); }
            try { localStorage.removeItem('ta:hubSignedOut'); } catch (e) { }
            if (window.TA && TA.Brain) { TA.Brain.pending = null; TA.Brain.lastUndo = null; }
            applyTheme(); TH.closeSheet(); TH.toast('Demo account reset'); render();
          };
        });
      };
    },
  };
  function applyTheme() { const r = document.documentElement; if (S.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme); }
  TH.applyTheme = applyTheme;

  // =====================================================================
  // BOOT (after TA.boot())
  // =====================================================================
  let booted = false;
  TH.boot = function () {
    if (booted) return; booted = true;
    // one clock for both apps: Tommy follows Trojan Hub's demo time
    if (window.TA) {
      if (TA.settings && TA.settings.realDate) TH.clock.realDate = true;
      if (!TH.loadTommyKB) TA.now = function () { return TH.clock.now(); }; // js/ta/bridge.js normally does this
    }
    if (prefs.demoMin != null && isFinite(prefs.demoMin)) TH.clock.setMinutes(+prefs.demoMin);
    applyTheme();
    document.body.insertAdjacentHTML('afterbegin', TH.iconSprite());
    const dev = $('.device');
    dev.insertAdjacentHTML('beforeend', `<nav class="tabbar" aria-label="Main">
      <button data-tab="home" aria-current="page">${icon('home')}Home</button>
      <button data-tab="map">${icon('map')}Map</button>
      <button class="fab" aria-label="Quick actions" aria-expanded="false">${icon('plus')}</button>
      <button data-tab="plans">${icon('calendar')}My Day</button>
      <button data-tab="more">${icon('menu')}More</button></nav>`);
    $$('.tabbar [data-tab]').forEach(b => b.onclick = () => TH.go(b.dataset.tab));
    $('.fab').onclick = openPlus;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented) { TH.closeSheet(); closePlus(); } });
    window.addEventListener('hashchange', () => { if (suppressHash) { suppressHash = false; return; } const n = location.hash.slice(1); if (n && n !== S.route && screens[n]) { TH.closeSheet(); closePlus(); history.push(S.route); S.route = n; S.params = {}; render(); } });
    if (hasTA()) { notes(); }
    const start = location.hash.slice(1); S.route = screens[start] ? start : 'home';
    render();
    setInterval(tickSims, 3000);
    setInterval(() => {
      if ($('.sheet-wrap') || isTyping() || $('.plusmenu')) return;
      if (S.route === 'map' && TH._map) TH._map.renderPins();
      else if (['home', 'rides', 'food', 'queue', 'plans', 'pass'].includes(S.route)) render(true);
      if (TH.watch) TH.watch.tick();
    }, 30000);
    // splash: verified USC fact of the day (Disney-style loading screen)
    const fact = factOfDay(TH.clock.now());
    dev.insertAdjacentHTML('beforeend', `<div class="splash" role="presentation"><div class="logo">T</div><h1>TROJAN HUB</h1>${fact ? `<div class="factbox"><span class="eyebrow">Did you know?</span><p>${esc(fact.text)}</p>${fact.url ? `<span class="src-note">Source: ${esc(H.srcName(fact.url))}</span>` : ''}</div>` : ''}<div class="loader"><i></i></div><span class="tap">Tap to skip</span></div>`);
    const sp = $('.splash', dev); const hide = () => { if (!sp.isConnected) return; sp.classList.add('out'); setTimeout(() => sp.remove(), 500); };
    sp.onclick = hide; setTimeout(hide, 3000);
  };
})(window.TH = window.TH || {});

