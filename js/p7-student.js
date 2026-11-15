/* js/p7-student.js — Part 7, student side.
 *
 * 1. More (student view), decluttered: account and profile, the switch to the club view, shortcuts (All features,
 *    Customize), settings (Connections & Alerts, Notifications, Appearance, Accessibility, Privacy & data, Tommy),
 *    help and about, account (Account & permissions, Sign out), demo controls (time, Reset demo account).
 *    Everything the old rows opened is still on Home, in the + menu, on the tab bar, or in More → All features.
 * 4. Customizable Home shortcuts and + menu: TH.p7.features (catalogue), TH.p7.items(kind), TH.p7.customize(kind).
 *    The choice lives in TH.H().x.p7 = {home:[ids], plus:[ids]} (Trojan Assist's store), so Tommy's Undo and
 *    "Reset demo account" cover it. Missing/invalid → today's defaults.
 * 5. Dining Dollars pace on the Wallet (TH.ddPace from js/ta/wallet-dining.js) + a detail sheet.
 * 6. Club images on Home: real EngageSC logo/photo or the generated cover, through TH.clubCover / TH.clubThumb /
 *    TH.clubPhotos (js/p6-clubs.js), added after Home renders.
 * Items 2 (desktop left side scrolls) and 3 (visible "Skip for now") are CSS only, in css/p7-student.css.
 *
 * Loads after js/p6-order.js and wraps the FINAL TH.screens.more / home / wallet and the + button.
 */
(function (TH) {
  'use strict';
  if (!TH || !TH.screens) return;
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasTA = () => !!(window.TA && TA.State && TA.State.d);
  const money = n => TH.money(n);

  // =====================================================================
  // FEATURE CATALOGUE (every place a shortcut can go)
  // =====================================================================
  const F = [
    // get around
    { id: 'lyft', l: 'Free Lyft', ic: 'car', go: 'rides:lyft', s: 'USC Lyft rides and hours', g: 'Get around' },
    { id: 'bus', l: 'Next Bus', ic: 'bus', go: 'rides', s: 'USC buses, Metro, Zipcar, parking', g: 'Get around' },
    { id: 'ride', l: 'Get a Ride', ic: 'car', go: 'rides', s: 'Lyft, buses, Metro, parking', g: 'Get around' },
    { id: 'map', l: 'Campus Map', ic: 'map', go: 'map', s: 'Buildings, hours, wait times', g: 'Get around' },
    { id: 'restroom', l: 'Find a Restroom', ic: 'wc', go: 'map:restroom', s: 'All-gender and nearest restrooms', g: 'Get around' },
    { id: 'upass', l: 'Metro U-Pass', ic: 'train', go: 'upass', s: 'Free Metro pass for USC students', g: 'Get around' },
    // food & money
    { id: 'order', l: 'Order Food', ic: 'bag', go: 'food:order', s: 'Mobile order ahead (simulated)', g: 'Food & money' },
    { id: 'dining', l: 'Dining Halls', ic: 'fork', go: 'food', s: 'Real hours and menus', g: 'Food & money' },
    { id: 'wallet', l: 'Wallet', ic: 'wallet', go: 'wallet', s: 'USCard, Dining Dollars, U-Pass, parking', g: 'Food & money' },
    // classes & plans
    { id: 'grades', l: 'Grades', ic: 'grad', go: 'grades', s: 'Courses, scores, term GPA', g: 'Classes & plans' },
    { id: 'plan', l: 'Plan my Day', ic: 'compass', go: 'plan', s: 'Tommy plans your day or week', g: 'Classes & plans' },
    { id: 'room', l: 'Book a Room', ic: 'ticket', go: 'book:room', s: 'Study rooms and spaces', g: 'Classes & plans' },
    { id: 'pass', l: 'Trojan Pass', ic: 'ticket', go: 'pass', s: 'Rooms, racquetball, advising, Writing Center', g: 'Classes & plans' },
    { id: 'queue', l: 'Virtual Line', ic: 'queue', go: 'queue', s: 'Career Center, Financial Aid, U-Pass pickup', g: 'Classes & plans' },
    // campus life
    { id: 'clubs', l: 'Clubs', ic: 'users', go: 'clubs', s: '2,000 real EngageSC groups', g: 'Campus life' },
    { id: 'events', l: 'Events', ic: 'calendar', go: 'events', s: 'Public EngageSC events, free food', g: 'Campus life' },
    { id: 'chats', l: 'Club Messages', ic: 'chat', go: 'chats', s: 'Club chats and announcements', g: 'Campus life' },
    { id: 'news', l: 'Newsletters', ic: 'mail', go: 'news', s: 'This week from the clubs you follow', g: 'Campus life' },
    { id: 'gameday', l: 'Game Day', ic: 'football', go: 'gameday', s: 'Coliseum, clear-bag rules, shuttles', g: 'Campus life' },
    { id: 'guests', l: 'Guest Pass', ic: 'idcard', go: 'guests', s: 'Register a visitor', g: 'Campus life' },
    // help & safety
    { id: 'tommy', l: 'Ask Tommy', ic: 'sparkle', go: 'assistant', s: 'Answers from USC sources; acts for you', g: 'Help & safety' },
    { id: 'safewalk', l: 'Safe Walk', ic: 'walk', go: 'safety', s: 'Safety map, safe walk, DPS numbers', g: 'Help & safety' },
    { id: 'report', l: 'Report', ic: 'flag', go: 'report', s: 'Report something, track it', g: 'Help & safety' },
    { id: 'watches', l: 'Watch List', ic: 'eye', go: 'watches', s: 'Tell Tommy what to look out for', g: 'Help & safety' },
    { id: 'alerts', l: 'Alerts', ic: 'bell', go: 'alerts', s: 'Your notifications', g: 'Help & safety' },
    { id: 'access', l: 'Accessibility', ic: 'access', go: 'access', s: 'Step-free routes, all-gender restrooms, OSAS', g: 'Help & safety' },
  ];
  const BY = Object.fromEntries(F.map(f => [f.id, f]));
  const DEF = {
    home: ['grades', 'lyft', 'bus', 'order', 'guests', 'safewalk', 'room', 'tommy'],
    plus: ['ride', 'order', 'pass', 'queue', 'safewalk', 'clubs', 'events', 'restroom', 'tommy'],
  };
  const MAX = { home: 12, plus: 12 }, MIN = 1;
  const NAME = { home: 'Home shortcuts', plus: '+ menu' };
  const xs = () => { const h = TH.H(); return h.x || (h.x = {}); };
  function ids(kind) {
    let a = null;
    try { const p = hasTA() ? xs().p7 : null; a = p && Array.isArray(p[kind]) ? p[kind] : null; } catch (e) { a = null; }
    a = (a || DEF[kind]).filter((id, i, all) => BY[id] && all.indexOf(id) === i).slice(0, MAX[kind]);
    return a.length ? a : DEF[kind].slice();
  }
  const items = kind => ids(kind).map(id => BY[id]);
  const isDefault = (kind, list) => (list || ids(kind)).join() === DEF[kind].join();

  // Save with Tommy's Undo (TA.Brain.lastUndo) + an Undo toast
  function saveChoice(next, label) {
    if (!hasTA()) return false;
    const x = xs(), prev = x.p7 ? JSON.parse(JSON.stringify(x.p7)) : null, snap = TA.State.snapshot();
    const clean = {};
    ['home', 'plus'].forEach(k => { if (next[k] && !isDefault(k, next[k])) clean[k] = next[k].slice(); });
    if (Object.keys(clean).length) x.p7 = clean; else delete x.p7;
    let entry = null;
    try { entry = TA.State.log({ action: label, system: 'Trojan Hub', conf: TA.confNo ? TA.confNo('TH') : null }); } catch (e) { entry = null; }
    TA.State.save();
    if (TA.Brain && entry) TA.Brain.lastUndo = { snap, logId: entry.id, title: 'Shortcuts updated', label };
    undoToast(label.replace(/^Customized/, 'Saved:'), () => {
      const x2 = xs(); if (prev) x2.p7 = prev; else delete x2.p7;
      try { const L = TA.State.d.log; if (entry && L && L[0] && L[0].id === entry.id) L.shift(); } catch (e) { /* log is cosmetic */ }
      if (TA.Brain && TA.Brain.lastUndo && entry && TA.Brain.lastUndo.logId === entry.id) TA.Brain.lastUndo = null;
      TA.State.save(); TH.render(true); TH.toast('Undone. Your shortcuts are back.', 'refresh');
    });
    return true;
  }
  let undoT = null;
  function undoToast(msg, fn) {
    const dev = $('.device'); if (!dev) return;
    $$('.toast, .p6-undo', dev).forEach(n => n.remove()); clearTimeout(undoT);
    dev.insertAdjacentHTML('beforeend', `<div class="p6-undo p7-undo" role="status">${icon('check')}<span>${esc(msg)}</span><button type="button">Undo</button></div>`);
    const t = $('.p7-undo', dev);
    t.querySelector('button').onclick = () => { clearTimeout(undoT); t.remove(); fn(); };
    undoT = setTimeout(() => t.remove(), 6500);
  }

  // =====================================================================
  // CUSTOMIZE SHEET (tap to add/remove, drag or arrows to reorder, live preview, Reset to default, Done)
  // =====================================================================
  function openCustomize(kind) {
    kind = kind === 'plus' ? 'plus' : 'home';
    TH.closePlus && TH.closePlus();
    const draft = { home: ids('home'), plus: ids('plus') }, start = JSON.stringify(draft);
    let k = kind, flash = null;
    const tile = f => `<span class="p7-pv-t"><span class="qi">${icon(f.ic)}</span><span>${esc(f.l)}</span></span>`;
    function preview() {
      const list = draft[k].map(id => BY[id]);
      return k === 'home'
        ? `<div class="p7-pv home" aria-hidden="true"><div class="p7-pv-cap">${icon('home')} Home</div><div class="p7-pv-grid">${list.map(tile).join('')}</div></div>`
        : `<div class="p7-pv plus" aria-hidden="true"><div class="p7-pv-cap">${icon('plus')} What do you want to do?</div><div class="p7-pv-grid">${list.map(tile).join('')}</div></div>`;
    }
    function rowOn(f, i, n) {
      return `<li class="p7-row${flash === f.id ? ' flash' : ''}" data-id="${f.id}">
        <span class="p7-grip" aria-hidden="true" title="Drag to reorder">${icon('menu')}</span>
        <span class="p7-ric">${icon(f.ic)}</span><span class="p7-rl"><b>${esc(f.l)}</b></span>
        <button class="p7-ar" data-mv="-1" data-id="${f.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(f.l)} up">${icon('down', 'p7-flip')}</button>
        <button class="p7-ar" data-mv="1" data-id="${f.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Move ${esc(f.l)} down">${icon('down')}</button>
        <button class="p7-rm" data-rm="${f.id}" ${n <= MIN ? 'disabled' : ''} aria-label="Remove ${esc(f.l)}">${icon('minus')}</button></li>`;
    }
    function rowOff(f, full) {
      return `<li class="p7-row off"><span class="p7-ric">${icon(f.ic)}</span><span class="p7-rl"><b>${esc(f.l)}</b><small>${esc(f.s)}</small></span>
        <button class="p7-add" data-addf="${f.id}" ${full ? 'disabled' : ''} aria-label="Add ${esc(f.l)}">${icon('plus')}</button></li>`;
    }
    function body() {
      const on = draft[k], full = on.length >= MAX[k], off = F.filter(f => !on.includes(f.id));
      return `${preview()}
        <div class="p7-lh"><h3>${k === 'home' ? 'On Home' : 'In the + menu'}</h3><span class="muted tiny">${on.length} of ${MAX[k]} · drag ${icon('menu')} or use the arrows</span></div>
        <ol class="p7-list" id="p7-on">${on.map((id, i) => rowOn(BY[id], i, on.length)).join('')}</ol>
        <div class="p7-lh"><h3>Add more</h3><span class="muted tiny">${full ? `Full. Remove one to add another.` : 'Tap + to add'}</span></div>
        <ul class="p7-list">${off.map(f => rowOff(f, full)).join('')}</ul>
        <p class="muted tiny p7-note">${icon('info')} Anything you hide stays one tap away in More → All features, and Tommy can open it.</p>`;
    }
    const html = `<div class="p7-cz">
      <div class="sheet-head"><div><span class="eyebrow">Make it yours</span><h2>Customize</h2></div><button class="iconbtn flat" data-close aria-label="Close without saving">${icon('x')}</button></div>
      <div class="seg p7-seg" role="tablist">${['home', 'plus'].map(x => `<button role="tab" data-k="${x}" aria-selected="${x === k}">${x === 'home' ? `${icon('home')} Home` : `${icon('grid')} + menu`}</button>`).join('')}</div>
      <div id="p7-cz-body"></div>
      <div class="p7-cz-foot"><button class="btn line" id="p7-reset">${icon('refresh')} Reset to default</button><button class="btn" id="p7-done">Done</button></div>
    </div>`;
    TH.sheet(html, w => {
      const sh = $('.sheet', w); sh.classList.add('p7-czsheet');
      const host = $('#p7-cz-body', w);
      function paint(focusSel) {
        host.innerHTML = body();
        $$('.p7-seg [data-k]', w).forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k)));
        $('#p7-reset', w).disabled = isDefault(k, draft[k]);
        if (focusSel) { const f = $(focusSel, w); if (f && !f.disabled) f.focus({ preventScroll: true }); }
        flash = null;
      }
      paint();
      setTimeout(() => { const t = $(`.p7-seg [data-k="${k}"]`, w); if (t) t.focus({ preventScroll: true }); }, 70);
      $$('.p7-seg [data-k]', w).forEach(b => b.onclick = () => { k = b.dataset.k; paint(); });
      host.addEventListener('click', e => {
        const mv = e.target.closest('[data-mv]'), rm = e.target.closest('[data-rm]'), ad = e.target.closest('[data-addf]');
        const a = draft[k];
        if (mv) { const id = mv.dataset.id, i = a.indexOf(id), j = i + (+mv.dataset.mv); if (j < 0 || j >= a.length) return; a.splice(i, 1); a.splice(j, 0, id); flash = id; paint(`[data-mv="${mv.dataset.mv}"][data-id="${id}"]`); }
        else if (rm) { if (a.length <= MIN) return; a.splice(a.indexOf(rm.dataset.rm), 1); paint(); }
        else if (ad) { if (a.length >= MAX[k]) return; a.push(ad.dataset.addf); flash = ad.dataset.addf; paint(); const r = $(`#p7-on [data-id="${ad.dataset.addf}"]`, w); if (r) r.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
      });
      // drag to reorder (pointer events; the arrows do the same for keyboard and screen readers)
      host.addEventListener('pointerdown', e => {
        const g = e.target.closest('.p7-grip'); if (!g) return;
        const list = $('#p7-on', w), row = g.closest('.p7-row'); if (!list || !row) return;
        e.preventDefault(); row.classList.add('drag');
        const move = ev => {
          const y = ev.clientY;
          for (const r of $$('.p7-row', list)) { if (r === row) continue; const b = r.getBoundingClientRect(); if (y < b.top + b.height / 2) { if (row.nextElementSibling !== r) list.insertBefore(row, r); return; } }
          if (list.lastElementChild !== row) list.appendChild(row);
        };
        // listen on window: moving the row in the DOM drops pointer capture
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); row.classList.remove('drag'); draft[k] = $$('.p7-row', list).map(r => r.dataset.id); flash = row.dataset.id; paint(); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      });
      $('#p7-reset', w).onclick = () => { draft[k] = DEF[k].slice(); paint(); TH.toast(`${NAME[k]} back to the default. Tap Done to keep it.`, 'refresh'); };
      $('#p7-done', w).onclick = () => {
        TH.closeSheet();
        if (JSON.stringify(draft) === start) return;
        const changed = ['home', 'plus'].filter(x => draft[x].join() !== JSON.parse(start)[x].join());
        const both = changed.length > 1, allDef = changed.every(x => isDefault(x, draft[x]));
        saveChoice(draft, allDef ? `Reset ${both ? 'Home shortcuts and the + menu' : NAME[changed[0]]} to default` : `Customized ${both ? 'Home shortcuts and the + menu' : NAME[changed[0]]}`);
        TH.render(true);
      };
    });
  }

  // a directory of every feature (More → All features)
  function openAll() {
    const groups = [...new Set(F.map(f => f.g))];
    const body = q => {
      const t = String(q || '').toLowerCase().trim();
      const hit = f => !t || (f.l + ' ' + f.s + ' ' + f.g).toLowerCase().includes(t);
      const out = groups.map(g => { const l = F.filter(f => f.g === g && hit(f)); return l.length ? `<h3 class="p7-ag">${esc(g)}</h3><div class="p7-agrid">${l.map(f => `<button data-go="${esc(f.go)}"><span class="qi">${icon(f.ic)}</span><b>${esc(f.l)}</b><small>${esc(f.s)}</small></button>`).join('')}</div>` : ''; }).join('');
      return out || `<p class="muted" style="padding:12px 0">Nothing called “${esc(q)}”. Try Tommy: he can open any screen.</p>`;
    };
    TH.sheet(`<div class="stack p7-all">
      <div class="sheet-head"><div><span class="eyebrow">Everything in Trojan Hub</span><h2>All features</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <label class="p7-search">${icon('search')}<span class="sr">Search features</span><input id="p7-aq" type="search" placeholder="Search: rides, grades, guests…" autocomplete="off"></label>
      <div id="p7-al">${body('')}</div>
      <button class="btn line block" data-p7cust="home">${icon('pencil')} Choose what’s on Home and in the + menu</button></div>`, w => {
      const i = $('#p7-aq', w); i.oninput = () => { $('#p7-al', w).innerHTML = body(i.value); };
      $('.sheet', w).addEventListener('click', e => { if (e.target.closest('[data-go]')) TH.closeSheet(); });
    });
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-p7cust]'); if (c) { e.preventDefault(); e.stopPropagation(); openCustomize(c.dataset.p7cust); return; }
    const a = e.target.closest('[data-p7all]'); if (a) { e.preventDefault(); openAll(); }
  }, true);
  TH.p7 = { features: F, defaults: DEF, items, customize: openCustomize, allFeatures: openAll };

  // =====================================================================
  // HOME: customizable shortcuts + club images
  // =====================================================================
  const homeR0 = TH.screens.home.render, homeM0 = TH.screens.home.mount;
  TH.screens.home.render = function () {
    let h = homeR0.apply(this, arguments);
    h = h.replace(/<nav class="quick"([^>]*)>[\s\S]*?<\/nav>/, (m, attrs) => `<div class="p7-qh"><span>Your shortcuts</span><button class="p7-edit" data-p7cust="home" aria-label="Edit Home shortcuts">${icon('pencil')}Edit</button></div><nav class="quick"${attrs}>${items('home').map(f => `<button data-go="${esc(f.go)}"><span class="qi">${icon(f.ic)}</span>${esc(f.l)}</button>`).join('')}</nav>`);
    return h;
  };
  TH.screens.home.mount = function (host) {
    homeM0 && homeM0.apply(this, arguments);
    try { clubImages(host); } catch (e) { console.error(e); }
  };

  // ---------- club images (same helpers as the Clubs screen) ----------
  const clubOf = id => (TH.clubById ? TH.clubById(id) : null);
  const eventClub = id => { const ev = TH.eventById ? TH.eventById(id) : null; return ev ? clubOf(ev.orgId) : null; };
  const photoOf = c => (TH.clubPhotos ? TH.clubPhotos(c) : []).find(x => x.kind === 'photo');
  const thumb = (c, size) => (TH.clubThumb ? TH.clubThumb(c, size || 'sm') : '');
  let byName = null;
  const clubByName = n => { if (!byName) { byName = new Map(); (TH.CLUBS || []).forEach(c => byName.set(String(c.name).toLowerCase(), c)); } return byName.get(String(n || '').toLowerCase().trim()) || null; };
  function clubImages(host) {
    if (!TH.clubCover) return;
    // "Clubs like …" posters: the cover (photo → logo → generated graphic)
    $$('.x-post.club[data-club]', host).forEach(b => {
      if (b.dataset.p7) return; const c = clubOf(b.dataset.club); if (!c) return; b.dataset.p7 = '1';
      b.classList.add('p7-cl'); b.insertAdjacentHTML('afterbegin', `<span class="p7-bg">${TH.clubCover(c, { size: 'md' })}</span>`);
      const big = $('.big', b); if (big) big.remove();
      // a photo cover also gets the club's logo (as on the Clubs screen); logo and generated covers already show it
      const pb = $('.pb', b); if (pb && photoOf(c)) pb.insertAdjacentHTML('afterbegin', thumb(c, 'sm'));
    });
    // event posters, the billboard and spotlights: the host club's photo behind, its logo next to the name
    $$('.x-post[data-event]', host).forEach(b => {
      if (b.dataset.p7) return; const c = eventClub(b.dataset.event); if (!c) return; b.dataset.p7 = '1';
      const ph = photoOf(c); if (ph) { b.classList.add('p7-ph'); b.insertAdjacentHTML('afterbegin', `<span class="p7-bg"><img src="${ph.src}" alt="" loading="lazy" decoding="async"></span>`); }
      const po = $('.po', b); if (po) { po.classList.add('p7-po'); po.insertAdjacentHTML('afterbegin', thumb(c, 'sm')); }
    });
    $$('.x-bill, .x-spot', host).forEach(b => {
      if (b.dataset.p7) return; const ev = b.matches('[data-event]') ? b : $('[data-event]', b); const c = ev && eventClub(ev.dataset.event); if (!c) return; b.dataset.p7 = '1';
      const ph = photoOf(c); if (ph) { b.classList.add('p7-ph'); b.insertAdjacentHTML('afterbegin', `<span class="p7-bg"><img src="${ph.src}" alt="" loading="lazy" decoding="async"></span>`); }
      const m = $('.m', b); if (m) { m.classList.add('p7-po'); m.insertAdjacentHTML('afterbegin', thumb(c, 'sm')); }
    });
    // "Your clubs this week" cards and anything else with an event and an org line
    $$('.card.clubev[data-event]', host).forEach(b => { if (b.dataset.p7) return; const c = eventClub(b.dataset.event); if (!c) return; b.dataset.p7 = '1'; b.classList.add('p7-withlogo'); b.insertAdjacentHTML('afterbegin', thumb(c, 'md')); });
    // newsletters from clubs (officer newsletters and weekly digests)
    $$('.x-nlc[data-xnews]', host).forEach(b => {
      if (b.dataset.p7) return; const k = $('.mono', b), name = k ? k.textContent.split(' officers')[0] : ''; const c = clubByName(name); if (!c) return; b.dataset.p7 = '1';
      b.classList.add('p7-withlogo'); b.insertAdjacentHTML('afterbegin', thumb(c, 'md'));
    });
    $$('.newscard[data-issue]', host).forEach(b => { if (b.dataset.p7) return; const c = clubOf(b.dataset.issue); if (!c) return; b.dataset.p7 = '1'; b.classList.add('p7-withlogo'); b.insertAdjacentHTML('afterbegin', thumb(c, 'md')); });
    // the "Find your people" promo: a few real club logos
    const promo = $('.card.promo[data-go="clubs"]', host);
    if (promo && !promo.dataset.p7) {
      const P = TH.CLUB_PHOTOS || {}, picks = (TH.CLUBS || []).filter(c => c.registered && (P[c.id] || []).some(x => x.kind === 'logo')).slice(0, 3);
      if (picks.length) { promo.dataset.p7 = '1'; const qi = $('.qi', promo); if (qi) qi.outerHTML = `<span class="p7-stack" aria-hidden="true">${picks.map(c => thumb(c, 'sm')).join('')}</span>`; }
    }
    $$('.cthumb img, .p7-bg img', host).forEach(img => { img.onerror = () => img.remove(); });
  }
  TH.p7.clubImages = clubImages;

  // =====================================================================
  // + MENU from the student's choice (same look as before + Customize)
  // =====================================================================
  function openPlus() {
    const dev = $('.device'); if (!dev) return;
    if ($('.plusmenu', dev)) { TH.closePlus(); return; }
    dev.insertAdjacentHTML('beforeend', `<div class="plusmenu pad"><div style="width:100%"><div class="p7-ph-h"><h2>What do you want to do?</h2><button class="p7-edit" data-p7cust="plus" aria-label="Customize the + menu">${icon('pencil')}Customize</button></div><div class="grid">${items('plus').map((f, i) => `<button data-go="${esc(f.go)}" style="animation-delay:${i * 25}ms">${icon(f.ic)}${esc(f.l)}</button>`).join('')}</div></div></div>`);
    const m = $('.plusmenu', dev); TH.bindCommon(m); m.addEventListener('click', e => { if (e.target === m) TH.closePlus(); });
    const f = $('.fab'); if (f) { f.classList.add('open'); f.setAttribute('aria-expanded', 'true'); }
  }
  TH.openPlus = openPlus;
  const boot0 = TH.boot;
  TH.boot = function () {
    const r = boot0.apply(this, arguments);
    const f = $('.tabbar .fab'); if (f) f.onclick = openPlus;
    return r;
  };

  // Desktop: the wheel anywhere on the page outside the phone scrolls the left side (css makes .pitch scrollable)
  document.addEventListener('wheel', e => {
    const p = $('.pitch'); if (!p || e.defaultPrevented || e.target.closest('.device, .pitch') || p.scrollHeight <= p.clientHeight) return;
    if (getComputedStyle(p).display === 'none') return;
    p.scrollBy({ top: e.deltaY * (e.deltaMode === 1 ? 32 : 1), behavior: 'auto' });
  }, { passive: true });

  // =====================================================================
  // MORE (student view)
  // =====================================================================
  const DEMO_TIMES = [[480, 'Today at 8 AM'], [720, 'Today at noon'], [900, 'Today at 3 PM'], [1080, 'Today at 6 PM'], [1260, 'Today at 9 PM'], [1380, 'Today at 11 PM'], [90, 'Today at 1:30 AM']];
  const moreM0 = TH.screens.more.mount;
  const R = (attrs, ic, t, sub, color, side) => `<button class="row" ${attrs} style="--rc:${color || 'var(--cardinal)'}"><span class="rico">${icon(ic)}</span><span class="rmain"><span class="rtitle">${t}</span>${sub ? `<span class="rsub">${sub}</span>` : ''}</span>${side || icon('chev', 'chev')}</button>`;
  // Trojan Hub acts as the demo student everywhere; Tommy signs in on its own unless the student signed out (embed.js)
  const signedIn = () => hasTA() && (!!TA.State.d.signedIn || !(TA.store && TA.store.get && TA.store.get('hubSignedOut', false)));
  TH.screens.more.render = function () {
    const st = TH.student(), c = TH.profileCompleteness ? TH.profileCompleteness() : null, h = TH.H();
    const unread = (TH.notes ? TH.notes() : []).filter(n => !n.read).length;
    const S = TH.state, cur = TH.clock.overridden ? TH.minOfDay(TH.clock.now()) : 'live';
    const sel = DEMO_TIMES.some(([m]) => m === cur) ? cur : (TH.clock.overridden ? 'custom' : 'live');
    const conn = (() => { try { const x = h.x && h.x.conn; return x ? Object.values(x).filter(v => v === true).length : 0; } catch (e) { return 0; } })();
    const ini = esc((st.first || 'S')[0]) + esc((st.last || '')[0] || '');
    const custom = ['home', 'plus'].filter(k => !isDefault(k)).length;
    return `<div class="screen p7-more">${TH.ui && TH.ui.topbar ? TH.ui.topbar('More', false) : `<div class="topbar pad"><h1>More</h1></div>`}
      <div class="pad screen-body stack">
        <button class="card profile p7-prof" data-go="profile"><span class="avatar">${ini}</span><span style="flex:1;min-width:0"><b style="font-size:16px">${esc(st.full)}</b><br><span class="muted" style="font-size:13px">${esc(st.standing)} · ${esc(st.major)}</span><br><span class="p7-pct">${c ? `${c.pct}% set up · ` : ''}Edit profile</span></span>${icon('chev')}</button>
        <div class="x-modebar"><span class="x-mb-main"><b>Student side</b><span style="font-size:13px">Run a club or a USC office? Switch to the club view any time.</span></span><button class="btn sm gold" data-go="org">${icon('swap')} Club view</button></div>

        <h2 class="p7-mh">Make it yours</h2>
        <div class="rows">
          ${R('data-p7all', 'grid', 'All features', 'Everything in Trojan Hub in one place', 'var(--cardinal)')}
          ${R('data-p7cust="home"', 'pencil', 'Customize Home and + menu', custom ? 'Your own picks are on' : 'Choose your shortcuts and their order', 'var(--gold-ink)')}
        </div>

        <h2 class="p7-mh">Settings</h2>
        <div class="rows">
          ${R('data-go="connect"', 'link', 'Connections & Alerts', `${conn ? conn + ' connected · ' : ''}Gmail, calendars, Slack; app or email per alert`, 'var(--c-transit)')}
          ${R('data-go="alerts"', 'bell', 'Notifications', unread ? `${unread} unread` : 'All caught up', 'var(--c-service)', unread ? `<span class="p7-badge">${unread}</span>${icon('chev', 'chev')}` : '')}
          <div class="row p7-rowsel" style="--rc:var(--c-study)"><span class="rico">${icon(S.theme === 'dark' ? 'moon' : 'sun')}</span><span class="rmain"><label class="rtitle" for="demo-theme">Appearance</label><span class="rsub">Light, dark, or match your device</span></span><select id="demo-theme">${['system', 'light', 'dark'].map(t => `<option value="${t}" ${S.theme === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>
          ${R('data-go="access"', 'access', 'Accessibility', 'Step-free routes, all-gender restrooms, OSAS', 'var(--c-restroom)')}
          ${R('data-p7priv', 'lock', 'Privacy & data', 'Your data stays on this device', 'var(--c-gate)')}
          ${R('data-p7tommy="settings"', 'sparkle', 'Tommy settings', 'Claude AI mode, activity log', 'var(--gold-ink)')}
        </div>

        <h2 class="p7-mh">Help</h2>
        <div class="rows">
          ${R('data-p7help', 'chat', 'Help & feedback', 'Ask or call Tommy, send feedback, safety numbers', 'var(--c-health)')}
          ${R('data-go="about"', 'info', 'About this prototype', 'What’s real, what’s simulated, sources', 'var(--c-service)')}
        </div>

        <h2 class="p7-mh">Account</h2>
        <div class="rows">
          ${R('data-p7tommy="account"', 'verified', 'Account & permissions', 'What Tommy may see and do for you', 'var(--cardinal)')}
          ${R('data-p7sign', signedIn() ? 'unlock' : 'lock', signedIn() ? 'Sign out' : 'Sign in (demo)', signedIn() ? `Signed in as ${esc(st.first)} (demo). Tommy stops acting for you.` : 'Let Tommy see and change your demo account', 'var(--c-gate)')}
        </div>

        <details class="card flat p7-demo">
          <summary><b>Demo controls</b><span class="muted tiny">Demo time · Reset demo account</span>${icon('down')}</summary>
          <div class="stack" style="margin-top:12px">
            <div class="field"><label for="demo-time">Demo time (the date stays Mon, Nov 9, 2026)</label>
              <select id="demo-time"><option value="live" ${sel === 'live' ? 'selected' : ''}>Live clock</option>${sel === 'custom' ? `<option value="custom" selected>Custom: ${TH.fmtTime(TH.clock.now())}</option>` : ''}${DEMO_TIMES.map(([m, l]) => `<option value="${m}" ${sel === m ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <span class="muted tiny">Try 9 PM: controlled campus access, USC Lyft hours and the safety map change.</span></div>
            <button class="btn line sm" id="demo-reset">${icon('refresh')} Reset demo account</button>
            <span class="muted tiny">Resets Jordan’s account (clubs, calendar, orders, passes, shortcuts, Tommy’s activity log) and the app’s settings.</span>
          </div>
        </details>
        <p class="muted tiny" style="text-align:center;padding:4px 0 70px">Trojan Hub · student prototype · account actions are simulated</p>
      </div></div>`;
  };
  TH.screens.more.mount = function (host) {
    moreM0 && moreM0.apply(this, arguments); // demo time, appearance, reset (app.js)
    const d = $('.p7-demo', host); if (d && TH.state.p7demoOpen) d.open = true;
    if (d) d.addEventListener('toggle', () => { TH.state.p7demoOpen = d.open; });
    host.addEventListener('click', e => {
      const t = e.target.closest('[data-p7priv],[data-p7help],[data-p7tommy],[data-p7sign]'); if (!t) return;
      if (t.dataset.p7priv !== undefined) return openPrivacy();
      if (t.dataset.p7help !== undefined) return openHelp();
      if (t.dataset.p7tommy) return openTommySheet(t.dataset.p7tommy);
      if (t.dataset.p7sign !== undefined) return toggleSign();
    });
  };
  function openTommySheet(kind) {
    TH.go('assistant');
    let n = 0; const t = setInterval(() => { n++; try { if (window.TA && TA.UI && document.getElementById('ta-log')) { clearInterval(t); TA.UI.sheet(kind); } } catch (e) { clearInterval(t); } if (n > 30) clearInterval(t); }, 60);
  }
  function toggleSign() {
    if (!hasTA()) return;
    if (signedIn()) {
      TH.sheet(`<div class="stack"><div class="sheet-head"><h2>Sign out of the demo account?</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div><p class="muted">Tommy can still answer questions, but he won’t see or change your classes, orders, passes or Dining Dollars until you sign in again. Your settings stay on this device.</p><div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="p7-so">Sign out</button></div></div>`, w => {
        $('#p7-so', w).onclick = () => { TA.State.signOut(); TA.State.save(); TH.closeSheet(); TH.toast('Signed out. Sign in again from More.', 'lock'); TH.render(true); };
      });
    } else { TA.State.signIn(); TH.toast(`Signed in as ${TH.student().first} (demo)`, 'unlock'); TH.render(true); }
  }
  function openPrivacy() {
    TH.sheet(`<div class="stack p7-info">
      <div class="sheet-head"><div><span class="eyebrow">Settings</span><h2>Privacy & data</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p7-callout">${icon('lock')}<div><b>Your data stays on this device.</b><span>Your profile, preferences, shortcuts, reports and their photos, and Tommy’s conversation are saved in this browser’s storage. Trojan Hub doesn’t send them to USC or anyone else.</span></div></div>
      <ul class="p7-bul">
        <li><b>Tommy’s AI mode:</b> when Tommy’s own scripts can’t understand a question, the words of that question (never your account data) may go to the AI translator on this site’s server. Crisis, safety and personal topics never leave the device. Turn it off in Tommy settings.</li>
        <li><b>Connections</b> (Gmail, calendars, Slack…) are simulated in this prototype; nothing is really linked.</li>
        <li><b>Account actions</b> (orders, passes, Dining Dollars, reports) are simulated on a demo student.</li>
        <li><b>Delete everything:</b> More → Demo controls → Reset demo account clears it all from this device.</li>
      </ul>
      <div class="btn-row"><button class="btn line" data-go="connect">Connections & Alerts</button><button class="btn" data-close>Got it</button></div></div>`);
  }
  function openHelp() {
    TH.sheet(`<div class="stack p7-info">
      <div class="sheet-head"><div><span class="eyebrow">Help</span><h2>How can we help?</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="rows">
        ${R('data-go="assistant"', 'sparkle', 'Ask Tommy', 'Questions about USC or this app, answered from USC sources', 'var(--gold-ink)')}
        ${R('data-xcall', 'phone', 'Call Tommy', 'Talk and hear the answer', 'var(--c-health)')}
        ${R('data-p7fb', 'mail', 'Send feedback', 'Ideas, bugs, dining hall suggestions', 'var(--c-transit)')}
        ${R('data-go="about"', 'info', 'What’s real and what’s simulated', 'Sources for hours, clubs, events and DPS data', 'var(--c-service)')}
      </div>
      <div class="p7-callout warn">${icon('shield')}<div><b>Emergency? Call 911.</b><span>USC DPS (24/7): <a href="tel:2137404321">213-740-4321</a> · Counseling (24/7): <a href="tel:2137409355">213-740-9355</a> · Crisis line: <a href="tel:988">988</a></span></div></div></div>`, w => {
      $('.sheet', w).addEventListener('click', e => {
        if (e.target.closest('[data-p7fb]')) { TH.closeSheet(); if (TH.openReportSheet) TH.openReportSheet('feedback'); else TH.go('report'); }
        else if (e.target.closest('[data-go],[data-xcall]')) TH.closeSheet();
      });
    });
  }

  // =====================================================================
  // WALLET: Dining Dollars pace
  // =====================================================================
  const W = TH.screens.wallet;
  if (W && TH.ddPace) {
    const wR0 = W.render, wM0 = W.mount;
    const fmtD = d => (d ? TH.fmtDate(d) : '—');
    function ddCard(p) {
      const status = p.onTrack ? `On track to use it all by ${fmtD(p.deadline)}` : `At this pace about ${money(p.projectedLeft)} would go unused`;
      return `<button class="p7-dd ${p.onTrack ? 'ok' : 'warn'}" id="p7-dd" aria-label="Dining Dollars ${money(p.balance)}. Spending about ${money(p.pacePerDay)} per day, estimate. ${money(p.needPerDay)} per day uses it all by ${fmtD(p.deadline)}. Details">
        <span class="p7-dd-top"><span><span class="p7-dd-k">Dining Dollars</span><span class="p7-dd-bal">${money(p.balance)}</span><span class="p7-dd-sub">${esc(p.planName)} · forfeited after ${fmtD(p.deadline)}</span></span><span class="p7-dd-days"><b>${p.daysLeft}</b><small>days left</small></span></span>
        <span class="p7-dd-bar" aria-hidden="true"><i style="width:${p.usedPct || 0}%"></i><em style="left:${p.semesterPct || 0}%"></em></span>
        <span class="p7-dd-leg" aria-hidden="true"><span>${p.usedPct}% of ${money(p.included + p.blocks)} spent</span><span>${p.semesterPct}% of the semester gone</span></span>
        <span class="p7-dd-stats">
          <span class="p7-dd-st"><small>Spending now <i class="p7-est">Est.</i></small><b>${money(p.pacePerDay)}<em>/day</em></b><span>last ${p.recentDays} days</span></span>
          <span class="p7-dd-st need"><small>To use it all</small><b>${money(p.needPerDay)}<em>/day</em></b><span>through ${fmtD(p.deadline)}</span></span>
        </span>
        <span class="p7-dd-status">${icon(p.onTrack ? 'check' : 'alert')}${esc(status)}<span class="p7-dd-more">Details ${icon('chev')}</span></span>
      </button>`;
    }
    W.render = function () {
      let h = wR0.apply(this, arguments);
      let p = null; try { p = TH.ddPace(); } catch (e) { console.error(e); }
      if (!p || p.deadline == null) return h;
      const st = TH.student(), i = h.indexOf('<div class="grid2">');
      if (i < 0) return h;
      // the grid2 block holds two cards (Dining Dollars, Meal swipes); replace it with the pace card + a swipes row
      const j = h.indexOf('</div></div></div>', i); const end = j < 0 ? -1 : j + '</div></div></div>'.length;
      const swipes = `<div class="row flatrow p7-swipes"><span class="rico" style="--rc:var(--c-dining)">${icon('fork')}</span><span class="rmain"><span class="rtitle">Meal swipes</span><span class="rsub">${st.dining.guestLeft != null ? `${st.dining.guestLeft} guest swipes left · ` : ''}reset at the end of the semester</span></span><span class="rside"><b class="mono">${st.dining.swipesLeft ?? '—'}</b><span class="muted" style="font-size:12px"> of ${st.dining.swipesTotal ?? '—'}</span></span></div>`;
      return end < 0 ? h : h.slice(0, i) + ddCard(p) + swipes + h.slice(end);
    };
    W.mount = function (host) {
      wM0 && wM0.apply(this, arguments);
      const b = $('#p7-dd', host); if (b) b.onclick = openDD;
      if (TH.state.params && TH.state.params.arg === 'dd') { TH.state.params = {}; setTimeout(openDD, 80); }
    };
    function openDD() {
      const p = TH.ddPace();
      const tx = p.recent.map(x => `<li><span class="p7-tx-d">${esc(TH.DAYS3 ? TH.DAYS3[x.at.getDay()] : '')}<b>${esc(TH.MONTHS[x.at.getMonth()].slice(0, 3))} ${x.at.getDate()}</b></span><span class="p7-tx-w"><b>${esc(x.where)}</b><small>${x.sim ? `${esc((x.items || []).join(' + '))} · <i class="p7-sim">Simulated</i>` : `Mobile order ${esc(x.order || '')}`}</small></span><span class="p7-tx-a mono">−${money(x.amount)}</span></li>`).join('');
      const verdict = p.onTrack
        ? `You’re on track. At ${money(p.pacePerDay)} a day you’d use it all${p.runOutDate && p.runOutDate < p.deadline ? ` around ${fmtD(p.runOutDate)}` : ''}.`
        : `At ${money(p.pacePerDay)} a day about ${money(p.projectedLeft)} would be left on ${fmtD(p.deadline)}. Spend about ${money(Math.max(0, p.needPerDay - p.pacePerDay))} more a day, or donate what you won’t use.`;
      TH.sheet(`<div class="stack p7-ddsheet">
        <div class="sheet-head"><div><span class="eyebrow">Trojan Wallet</span><h2>Dining Dollars</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="p7-dd-hero"><span class="p7-dd-bal">${money(p.balance)}</span><span class="muted">left on your ${esc(p.planName)} (${money(p.included)}${p.blocks ? ` + ${money(p.blocks)} in blocks` : ''} this semester)</span></div>
        <div class="p7-dd-stats big">
          <span class="p7-dd-st"><small>Spending now <i class="p7-est">Est.</i></small><b>${money(p.pacePerDay)}<em>/day</em></b><span>${money(p.recentSum)} over the last ${p.recentDays} days</span></span>
          <span class="p7-dd-st need"><small>Needed to use it all</small><b>${money(p.needPerDay)}<em>/day</em></b><span>${p.daysLeft} days through ${fmtD(p.deadline)}</span></span>
        </div>
        <div class="p7-callout ${p.onTrack ? '' : 'warn'}">${icon(p.onTrack ? 'check' : 'alert')}<div><b>${p.onTrack ? 'On track' : 'Heads up'}</b><span>${esc(verdict)}</span></div></div>
        ${p.needByClassesEnd ? `<p class="muted tiny">Classes and regular dining hall hours end ${fmtD(p.classesEnd)}. To finish by then: ${money(p.needByClassesEnd)}/day.</p>` : ''}
        <h3 class="p7-ag">Recent purchases</h3>
        ${tx ? `<ul class="p7-tx">${tx}</ul>` : `<p class="muted">No purchases in the last ${p.recentDays} days.</p>`}
        <p class="muted tiny">The demo account keeps no card history, so the purchases marked Simulated use sample menu prices; the daily pace is an estimate. Picked-up mobile orders are your real (simulated) orders. Your balance is from the demo account.</p>
        <h3 class="p7-ag">The rules</h3>
        <ul class="p7-bul">${p.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <p class="tiny p7-src">Sources: ${p.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join(' · ')}</p>
        <div class="btn-row"><button class="btn line" id="p7-dd-ask">${icon('sparkle')} Ask Tommy</button><button class="btn" data-go="food:order">${icon('bag')} Order food</button></div>
      </div>`, w => {
        $('#p7-dd-ask', w).onclick = () => { TH.closeSheet(); TH.go('assistant', { arg: 'how much should I spend on dining dollars per day' }); };
        $('.sheet', w).addEventListener('click', e => { if (e.target.closest('[data-go]')) TH.closeSheet(); });
      });
    }
    TH.p7.openDiningDollars = openDD;
  }
})(window.TH);
