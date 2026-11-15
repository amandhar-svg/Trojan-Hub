/* js/p7-club.js — Part 7: the ORGANIZER / CLUB VIEW, redesigned around one officer running one club on repeat.
 * Before: 11 screens behind a 5-tab bar (org, orgreq, orgtommy, orgmem, orgchat, orgtools, orgnews, orgbudget,
 * orgspace, orginsights, orginbox). Now: "Today for <club>" plus 4 jobs, each with sub-tabs that keep every older
 * screen reachable:
 *   Today   org          the 3 things that need a decision, each with its next action
 *   Plan    orgplan      event pipeline (Requested → Scheduled → Announced → Done)  · Requests · Rooms · Insights
 *   People  orgpeople    Discord-style roster with filters + bulk actions             · Chat · Inbox (USC office)
 *   Promote orgpromote   announce events, Luma link                                   · Newsletter
 *   Money   orgmoney     dues + Venmo + event costs + budget read                     · Dues ledger · Budget
 *   orgmore              club settings, switch to student view, account, help
 *   orgtommy             kept as the follow-up chat behind the inline Tommy buttons (no longer a tab)
 * orgtools is removed (its links are inside the jobs; old links land on Today).
 * Reuses the data model in js/hub2b.js through TH.xo / TH.x (TH.H().x.orgs[id]); never edits hub2b.js.
 * Everything here is simulated on the demo account and labeled. Load after js/p6-order.js. */
(function (TH) {
  'use strict';
  if (!TH.xo || !TH.x) return;
  const { X, save, uid, hash, ago, sim, note, NAMES, member, ai } = TH.x;
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const XO = () => TH.xo;
  const money = n => XO().money(n);
  const plural = (n, w, pl) => `${n} ${n === 1 ? w : (pl || w + 's')}`;
  const clockMs = () => TH.clock.now().getTime();
  const est = () => TH.ui.est();
  const AVC = ['#990000', '#c4501b', '#138a72', '#1e66c9', '#7a4fc2', '#a87a00', '#d23d64', '#445a77'];
  const initials = nm => String(nm || '?').replace(/\s*\(you\)\s*/i, '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const bare = nm => String(nm).replace(/\s*\(you\)$/, '');

  // ---------- per-org Part 7 state (lives in TH.H().x.orgs[id].p7, so Undo / Reset demo account cover it) ----------
  function P(org) {
    const o = XO().O(org), p = o.p7 || (o.p7 = {});
    if (!Array.isArray(p.msgs)) p.msgs = [];
    if (!p.luma || typeof p.luma !== 'object') p.luma = { url: '', at: 0 };
    if (!p.venmoFeed || typeof p.venmoFeed !== 'object') p.venmoFeed = {};
    return p;
  }
  const isClub = org => org.kind !== 'usc';

  // ---------- events: requests from students + events this club scheduled in the app ----------
  const STAGES = [['requested', 'Requested', 'megaphone'], ['scheduled', 'Scheduled', 'calendar'], ['announced', 'Announced', 'send'], ['done', 'Done', 'check']];
  const stageOf = ev => ev.doneAt ? 'done' : ev.annAt ? 'announced' : 'scheduled';
  const evStart = ev => TH.laDate(ev.start);
  const reqOf = ev => ev.req ? X().evreqs.find(r => r.id === ev.req) : null;
  const myEvents = org => XO().O(isClub(org) ? org : XO().orgs()[0]).events.slice().sort((a, b) => evStart(a) - evStart(b));
  const openReqs = org => XO().reqsFor(org).filter(r => r.status === 'open');
  const isPast = ev => { const s = evStart(ev); return s && s < TH.clock.now(); };
  const fmtWhen = ev => { const s = evStart(ev); return s ? `${TH.fmtDate(s)} · ${TH.fmtTime(s)}` : 'Date to be set'; };
  const booking = (org, ev) => ev.room ? XO().O(org).bookings.find(b => b.id === ev.room) : null;
  function roomLabel(org, ev) {
    const b = booking(org, ev);
    if (b) return { text: b.place, pill: b.status === 'approved' ? ['ok', 'Room approved'] : ['warn', 'Room pending'] };
    return ev.where ? { text: ev.where, pill: null } : { text: 'No room yet', pill: ['mute', 'Needs a room'] };
  }
  // the friend's sample ledger says what one attendee cost last semester; reuse it for a clearly-labeled estimate
  function budgetFacts(org) {
    try {
      const t = document.createElement('template'); t.innerHTML = TH.screens.orgbudget.render();
      return $$('#bg-ai li', t.content).map(li => li.textContent.trim()).filter(Boolean);
    } catch (e) { return []; }
  }
  function perHead(org) { const m = /attendee cost about \$([\d,.]+)/.exec(budgetFacts(org).join(' ')); const v = m ? parseFloat(m[1].replace(/,/g, '')) : NaN; return isFinite(v) ? v : null; }
  const expected = (org, ev) => { const r = reqOf(ev); return ev.att != null ? ev.att : Math.max(8, Math.round((r ? r.votes : 12) * 0.8 + hash(ev.id) % 7)); };
  const rsvps = (org, ev) => { const r = reqOf(ev); return Math.max(3, Math.round((r ? r.votes : 10) * 0.6 + hash(ev.id + 'r') % 9)); };
  function estCost(org, ev) { const ph = perHead(org); return ph ? Math.round(ph * expected(org, ev) / 5) * 5 : null; }
  function textOf(route, sel, idx) {
    try { const t = document.createElement('template'); t.innerHTML = TH.screens[route].render(); const n = $$(sel, t.content)[idx || 0]; return n ? n.textContent.trim() : ''; } catch (e) { return ''; }
  }

  // ---------- roster helpers (same data model as js/hub2b.js orgmem) ----------
  const roster = org => XO().roster(org);
  const totals = org => XO().duesTotals(org);
  const YEARS = ['First-year', 'Sophomore', 'Junior', 'Senior', 'Grad student'];
  const ROLES = ['Member', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Social chair'];
  const USC_EMAIL = /^[a-z0-9._%+-]+@usc\.edu$/i;
  const avatar = m => `<span class="p7-av" style="--av:${AVC[hash(m.name) % AVC.length]}" aria-hidden="true">${esc(initials(m.name))}<i class="${m.paid ? 'paid' : 'unpaid'}"></i></span>`;
  // a sample feed of Venmo payments that arrived since the last check (simulated): some unpaid members paid there
  function venmoPending(org) {
    const o = XO().O(org), p = P(org);
    if (!o.venmo || !o.venmo.on) return [];
    return roster(org).filter(m => !m.paid && !m.you && !p.venmoFeed[m.name] && hash(m.name + org.id + 'vm') % 3 === 0);
  }
  // sample check-in list for an event (simulated): who showed up, drawn from the roster
  function attendees(org, ev) {
    const ms = roster(org).filter(m => !m.you); if (!ev) return [];
    const n = Math.min(ms.length, ev.att != null ? ev.att : Math.round(ms.length * 0.6));
    return ms.slice().sort((a, b) => hash(a.name + ev.id) - hash(b.name + ev.id)).slice(0, n);
  }
  const lastEvent = org => { const l = myEvents(org).filter(e => e.doneAt || e.annAt); return l.sort((a, b) => (b.doneAt || b.annAt) - (a.doneAt || a.annAt))[0] || null; };

  // ---------- undo toast (same look as Part 6's) ----------
  let undoT = null;
  function undoToast(msg, ic, fn) {
    const dev = $('.device'); if (!dev) return;
    $$('.toast, .p6-undo', dev).forEach(n => n.remove()); clearTimeout(undoT);
    dev.insertAdjacentHTML('beforeend', `<div class="p6-undo" role="status">${icon(ic || 'check')}<span>${esc(msg)}</span><button type="button">Undo</button></div>`);
    const t = $('.p6-undo', dev); t.querySelector('button').onclick = () => { clearTimeout(undoT); t.remove(); fn(); };
    undoT = setTimeout(() => t.remove(), 6000);
  }

  // =====================================================================
  // SHELL: club header, job sub-tabs, tab bar
  // =====================================================================
  const JOBS = {
    today: { title: 'Today', route: 'org', icon: 'grid', subs: [] },
    plan: { title: 'Plan', route: 'orgplan', icon: 'calendar', subs: [['orgplan', 'Events'], ['orgreq', 'Requests'], ['orgspace', 'Rooms'], ['orginsights', 'Insights']] },
    people: { title: 'People', route: 'orgpeople', icon: 'users', subs: [['orgpeople', 'Roster'], ['orgchat', 'Chat'], ['orginbox', 'Inbox']] },
    promote: { title: 'Promote', route: 'orgpromote', icon: 'megaphone', subs: [['orgpromote', 'Announce'], ['orgnews', 'Newsletter']] },
    money: { title: 'Money', route: 'orgmoney', icon: 'dollar', subs: [['orgmoney', 'Overview'], ['orgmem', 'Dues ledger'], ['orgbudget', 'Budget']] },
  };
  const JOB_OF = {};
  Object.entries(JOBS).forEach(([k, j]) => { JOB_OF[j.route] = k; j.subs.forEach(([r]) => { JOB_OF[r] = k; }); });
  // a club sees everything but the USC office inbox; the USC office sees requests, rooms and its inbox
  const USC_OK = new Set(['orgplan', 'orgreq', 'orgspace', 'orgpeople', 'orginbox']);
  const subsFor = (job, org) => JOBS[job].subs.filter(([r]) => isClub(org) ? r !== 'orginbox' : USC_OK.has(r));

  function head(org) {
    return `<div class="p7-head"><span class="p7-clubav" style="--av:${AVC[hash(org.id) % AVC.length]}" aria-hidden="true">${esc(initials(org.name))}</span>
      <span class="p7-id"><b>${esc(org.name)}</b><small>${esc(org.role)} · Club view</small></span>
      <button class="p7-hbtn" data-go="home" aria-label="Switch to the student view">${icon('swap')}<span>Student</span></button>
      <button class="p7-hbtn" data-go="orgmore" aria-label="Club menu: settings, account, help">${icon('menu')}</button></div>`;
  }
  function subtabs(job, route, org) {
    const s = subsFor(job, org); if (s.length < 2) return '';
    return `<nav class="p7-sub" aria-label="${esc(JOBS[job].title)} sections">${s.map(([r, l]) => `<button data-go="${r}" ${r === route ? 'aria-current="page"' : ''}>${esc(l)}</button>`).join('')}</nav>`;
  }
  function shell(route, body, opts) {
    opts = opts || {}; const org = XO().cur(), job = JOB_OF[route];
    const title = opts.title || (job ? (job === 'today' ? `Today` : JOBS[job].title) : 'Club');
    return `<div class="screen p7">${TH.ui.topbar(title, !!opts.back)}<div class="pad screen-body stack">${head(org)}${job ? subtabs(job, route, org) : ''}${body}</div></div>`;
  }
  // re-dress an older organizer screen as a sub-tab of its job (its own render + mount keep doing all the work)
  function reshell(html, route) {
    const t = document.createElement('template'); t.innerHTML = html;
    const sc = t.content.querySelector('.screen'); if (!sc) return html;
    const org = XO().cur(), job = JOB_OF[route]; sc.classList.add('p7');
    const mb = sc.querySelector('.x-modebar'); if (mb) mb.remove();
    const tb = sc.querySelector('.topbar');
    const title = job ? JOBS[job].title : (tb && tb.querySelector('h1') ? tb.querySelector('h1').textContent : 'Club');
    if (tb) tb.outerHTML = TH.ui.topbar(title, !job);
    const body = sc.querySelector('.screen-body');
    if (body) body.insertAdjacentHTML('afterbegin', head(org) + (job ? subtabs(job, route, org) : ''));
    return t.innerHTML;
  }
  ['orgreq', 'orgspace', 'orginsights', 'orgchat', 'orginbox', 'orgnews', 'orgmem', 'orgbudget', 'orgtommy'].forEach(r => {
    const s = TH.screens[r]; if (!s || s.p7) return; const r0 = s.render;
    s.render = function () { return reshell(r0.apply(this, arguments), r); }; s.p7 = true;
  });
  // Tools is gone as a screen; anything still pointing at it lands on Today
  delete TH.screens.orgtools;
  const go0 = TH.go;
  TH.go = function (name, params) { if (name === 'orgtools') name = 'org'; return go0.call(this, name, params); };

  // Money › Dues ledger: the older "Check now" matched one payment per tap; now it matches every payment it can
  (function () {
    const s = TH.screens.orgmem; if (!s) return; const m0 = s.mount;
    s.mount = function (host) { m0 && m0.apply(this, arguments); const b = $('#vm-sync', host); if (b) { b.textContent = 'Match all'; b.onclick = () => venmoCheck(XO().cur()); } };
  })();
  // tab bar: Today · Plan · People · Promote · Money
  function syncTabs() {
    const nav = $('.tabbar.x-org'); if (!nav) return; const r = TH.state.route;
    if (JOB_OF[r]) TH.state.p7job = JOB_OF[r];
    const job = JOB_OF[r] || TH.state.p7job || 'today';
    $$('[data-p7tab]', nav).forEach(b => b.dataset.p7tab === job ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  }
  const boot0 = TH.boot;
  TH.boot = function () {
    boot0.apply(this, arguments);
    const nav = $('.tabbar.x-org'); if (!nav || nav.dataset.p7) return; nav.dataset.p7 = '1'; nav.classList.add('p7-tabs');
    nav.innerHTML = Object.entries(JOBS).map(([k, j]) => `<button data-p7tab="${k}">${icon(j.icon)}${esc(j.title)}</button>`).join('');
    $$('[data-p7tab]', nav).forEach(b => b.onclick = () => TH.go(JOBS[b.dataset.p7tab].route));
    const host = $('#screen-host'); if (host) new MutationObserver(syncTabs).observe(host, { childList: true });
    syncTabs();
  };

  // =====================================================================
  // INLINE TOMMY: answers from the club's own (sample) numbers, right where the work is
  // =====================================================================
  function tommySheet(o) {
    TH.sheet(`<div class="stack p7-tommy"><div class="sheet-head"><div><span class="eyebrow">${icon('sparkle')} Tommy</span><h2>${esc(o.title)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="x-ai" id="p7-tm"><p style="white-space:pre-line">${esc(o.text)}</p></div>
      ${o.acts && o.acts.length ? `<div class="p7-acts">${o.acts.map((a, i) => `<button class="btn ${i ? 'line' : ''} block" data-p7ta="${i}">${icon(a.icon || 'chev')} ${esc(a.label)}</button>`).join('')}</div>` : ''}
      <div class="p7-tm-foot"><span class="muted tiny">${icon('lock')} Worked out on this device</span><button class="linkbtn" id="p7-tm-more">Ask a follow-up</button></div>
      ${sim(`Simulated. Tommy reads ${esc(XO().cur().name)}’s sample numbers in this demo, not the club’s real records.`)}</div>`, w => {
      $$('[data-p7ta]', w).forEach(b => b.onclick = () => { const a = o.acts[+b.dataset.p7ta]; TH.closeSheet(); a.fn(); });
      $('#p7-tm-more', w).onclick = () => { TH.closeSheet(); TH.go('orgtommy', { arg: o.q }); };
    });
  }
  // =====================================================================
  // REAL AI DRAFTING through TA.AI.draft(kind, payload) → Promise<{text, model, sources?} | null> (js/ta/ai-api.js).
  // Payloads carry ONLY club/event info and aggregate request titles + votes: never member names, emails, dues or paid status.
  // null / undefined / error / timeout → the on-device template, labeled as such.
  // =====================================================================
  function aiDraft(kind, payload) {
    let p;
    try { p = window.TA && TA.AI && typeof TA.AI.draft === 'function' ? TA.AI.draft(kind, payload) : null; } catch (e) { p = null; }
    if (!p || typeof p.then !== 'function') return Promise.resolve(null);
    return Promise.race([p.then(r => r && typeof r.text === 'string' && r.text.trim() ? r : null, () => null), new Promise(res => setTimeout(() => res(null), 25000))]);
  }
  const modelName = m => { const t = String(m || '').toLowerCase(); return /haiku/.test(t) ? 'Claude Haiku' : /sonnet/.test(t) ? 'Claude Sonnet' : /opus/.test(t) ? 'Claude Opus' : 'Claude'; };
  const TEMPLATE_TAG = 'Template · AI writing works on the live site';
  function announcePayload(org, ev) {
    const s = evStart(ev), p = P(org), lk = ev.luma || p.luma.url, out = { club: org.name, title: ev.title, when: s ? `${TH.fmtDate(s, true)} at ${TH.fmtTime(s)}` : '', where: ev.where || '', desc: ev.desc || '' };
    if (lk) out.rsvpUrl = lk; return out;
  }
  const summaryPayload = org => ({ club: org.name, requests: openReqs(org).slice(0, 12).map(r => ({ title: r.title, votes: r.votes, type: r.type, preferred: r.when })) });
  function summaryTemplate(org) {
    const txt = textOf('orgreq', '#rq-ai > span', 1), top = openReqs(org)[0];
    return txt || (top ? `The most wanted is “${top.title}” with ${top.votes} votes.` : 'No open requests yet.');
  }
  const srcHTML = res => res && Array.isArray(res.sources) && res.sources.length ? `<div class="p7-src">Sources: ${res.sources.slice(0, 4).map(x => typeof x === 'string' ? esc(x) : x && x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || TH.ui.srcName(x.url))}</a>` : esc((x && x.title) || '')).join(' · ')}</div>` : '';
  // one sheet for both kinds: "Claude is writing…" → editable text with its tag → Regenerate / Use this / Send (simulated)
  function draftSheet(o) {
    TH.sheet(`<div class="stack p7-form p7-draft"><div class="sheet-head"><div><span class="eyebrow">${icon('sparkle')} ${esc(o.eyebrow)}</span><h2>${esc(o.title)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p7-dbox" id="p7dr-box" aria-live="polite"></div>
      <div class="p7-dacts"><button class="btn line sm" id="p7dr-re">${icon('refresh')} Regenerate</button><button class="btn line sm" id="p7dr-use">${icon('check')} ${esc(o.useLabel || 'Use this')}</button><button class="btn sm" id="p7dr-send">${icon('send')} ${esc(o.sendLabel || 'Send')} <span class="p7-simtag">Simulated</span></button></div>
      ${o.extra || ''}
      ${sim(o.note)}</div>`, w => {
      const box = $('#p7dr-box', w), btns = ['#p7dr-re', '#p7dr-use', '#p7dr-send'].map(q => $(q, w));
      let cur = { text: '', tag: '' };
      const run = async () => {
        btns.forEach(b => { b.disabled = true; });
        box.innerHTML = `<div class="p7-writing"><span class="p7-dots" aria-hidden="true"><i></i><i></i><i></i></span>Claude is writing…</div>`;
        const res = await o.run();
        if (!w.isConnected) return;
        cur = res ? { text: res.text.trim(), tag: `Written by ${modelName(res.model)} · ${o.from}`, ai: true } : { text: o.template(), tag: TEMPLATE_TAG, ai: false };
        box.innerHTML = `<label class="sr" for="p7dr-txt">${esc(o.title)}</label><textarea id="p7dr-txt" rows="${o.rows || 8}" maxlength="3000">${esc(cur.text)}</textarea>
          <span class="p7-aitag ${cur.ai ? 'ai' : ''}">${icon(cur.ai ? 'sparkle' : 'info')}${esc(cur.tag)}</span>${srcHTML(res)}`;
        btns.forEach(b => { b.disabled = false; });
      };
      const text = () => { const t = $('#p7dr-txt', w); return t ? t.value.trim() : ''; };
      btns[0].onclick = run;
      btns[1].onclick = () => { const t = text(); if (t.length < 5) return TH.toast('Nothing to use yet', 'alert'); TH.closeSheet(); o.onUse(t, cur.tag); };
      btns[2].onclick = () => { const t = text(); if (t.length < 5) return TH.toast('Nothing to send yet', 'alert'); TH.closeSheet(); o.onSend(t, cur.tag); };
      run();
    });
  }
  function tommyWants(org) {
    const rq = openReqs(org), top = rq[0], n = rq.length;
    if (!n) return TH.toast('No open requests to summarize yet', 'megaphone');
    draftSheet({
      eyebrow: 'Tommy · members summary', title: 'What members want', from: `from ${plural(n, 'member request')}`, rows: 6,
      run: () => aiDraft('members-summary', summaryPayload(org)), template: () => summaryTemplate(org),
      useLabel: 'Pin to Plan', sendLabel: 'Send to officers',
      onUse: (t, tag) => { P(org).pinned = { text: t, tag, at: Date.now() }; TH.commit(`Pinned a members summary to ${org.name}’s Plan`); TH.state.p7stage = 'requested'; TH.go('orgplan'); TH.toast('Pinned above your requests', 'check'); },
      onSend: (t) => { const off = roster(org).filter(m => m.role && m.role !== 'Member' && !m.you); P(org).msgs.unshift({ to: off.map(m => m.name), text: t, at: Date.now(), kind: 'summary' }); TH.commit(`Shared a members summary with ${plural(off.length, 'officer')} of ${org.name} (simulated)`); TH.toast(`Sent to ${plural(off.length, 'officer')} (simulated)`, 'send'); if (TH.state.route === 'orgpeople') TH.render(true); },
      extra: top ? `<button class="btn ghost block sm" id="p7dr-x">${icon('calendar')} Schedule “${esc(top.title)}”</button>` : '',
      note: `Only request titles, types, preferred times and vote totals are sent to write this (${plural(n, 'request')}). No member names, emails or dues.`,
    });
    const x = $('#p7dr-x'); if (x) x.onclick = () => openSchedule(org, { req: top });
  }
  function announceDraftSheet(org, ev) {
    const d = announceDraft(org, ev);
    draftSheet({
      eyebrow: 'Tommy · announcement', title: ev.title, from: 'from your event details', rows: 8,
      run: () => aiDraft('announcement', announcePayload(org, ev)), template: () => d.body,
      useLabel: 'Use this', sendLabel: 'Send to members',
      onUse: (t, tag) => announceSheet(org, ev, { text: t, tag }),
      onSend: (t) => postAnnouncement(org, ev, d.subject, t, 'all'),
      note: 'Only the club name and this event’s title, date, place, details and RSVP link are sent to write this. Sending is simulated on this device.',
    });
  }

  // =====================================================================
  // "TOMMY IS LEARNING": AI-proposed tools from TA.AI.learning() → Promise<{items:[{name, why, examples, count, last}]} | null>
  // Examples are AI paraphrases, never raw student messages. Approve / Dismiss is simulated and saved in TH.H().x.p7learn.
  // =====================================================================
  const LV = () => { const x = X(); if (!x.p7learn || typeof x.p7learn !== 'object') x.p7learn = {}; return x.p7learn; };
  function aiLearning() {
    let p; try { p = window.TA && TA.AI && typeof TA.AI.learning === 'function' ? TA.AI.learning() : null; } catch (e) { p = null; }
    if (!p || typeof p.then !== 'function') return Promise.resolve(null);
    return Promise.race([p.then(r => r && Array.isArray(r.items) ? r : null, () => null), new Promise(res => setTimeout(() => res(null), 20000))]);
  }
  const lastTxt = v => { const t = typeof v === 'number' ? v : Date.parse(v); return isFinite(t) ? ago(t) : (v ? String(v) : ''); };
  function learnRow(it) {
    const st = LV()[it.name], ex = (Array.isArray(it.examples) ? it.examples : []).slice(0, 2);
    return `<div class="p7-lrn ${st ? 'st-' + st : ''}"><div class="p7-lrn-h"><span class="p7-lrn-ic">${icon('sparkle')}</span><span class="p7-lrn-m"><b>${esc(it.name)}</b><small>Asked ${plural(+it.count || 0, 'time')}${it.last ? ' · last ' + esc(lastTxt(it.last)) : ''}</small></span></div>
      ${it.why ? `<p>${esc(it.why)}</p>` : ''}
      ${ex.length ? `<div class="p7-lrn-ex"><span>Students ask things like <em>(AI paraphrase)</em></span>${ex.map(e => `<q>${esc(e)}</q>`).join('')}</div>` : ''}
      <div class="p7-lrn-a">${st ? `<span class="pill ${st === 'approved' ? 'ok' : 'mute'}">${st === 'approved' ? 'Approved' : 'Dismissed'}</span><button class="linkbtn" data-p7lu="${esc(it.name)}">Undo</button>` : `<button class="btn sm" data-p7la="${esc(it.name)}">${icon('check')} Approve</button><button class="btn sm line" data-p7ld="${esc(it.name)}">Dismiss</button>`}</div></div>`;
  }
  const learnShell = () => `<div class="p7-learn card" id="p7-learn"><div class="p7-learn-h"><span class="eyebrow">${icon('sparkle')} Tommy is learning</span><span class="muted tiny">Tools Tommy proposes from questions it couldn’t answer</span></div><div class="p7-learn-b"><div class="p7-writing"><span class="p7-dots" aria-hidden="true"><i></i><i></i><i></i></span>Checking for proposals…</div></div></div>`;
  function fillLearning(root) {
    const card = root && $('#p7-learn', root); if (!card) return;
    const body = $('.p7-learn-b', card);
    aiLearning().then(res => {
      if (!card.isConnected) return;
      const items = res ? res.items.filter(it => it && it.name) : null;
      body.innerHTML = !items ? `<p class="p7-learn-empty">${icon('info')}<span>Proposals appear here on the live site when Tommy can’t answer something.</span></p>`
        : !items.length ? `<p class="p7-learn-empty">${icon('check')}<span>No proposals right now. Tommy hasn’t hit a gap worth a new tool.</span></p>`
        : items.map(learnRow).join('') + `<span class="muted tiny">Approve and Dismiss are simulated on the demo account. Examples are AI paraphrases, never students’ own messages.</span>`;
      body.onclick = e => {
        const a = e.target.closest('[data-p7la]'), d = e.target.closest('[data-p7ld]'), u = e.target.closest('[data-p7lu]'); if (!a && !d && !u) return;
        const name = (a || d || u).dataset[a ? 'p7la' : d ? 'p7ld' : 'p7lu'], L = LV();
        if (u) delete L[name]; else L[name] = a ? 'approved' : 'dismissed';
        TH.commit(u ? `Reopened Tommy proposal “${name}”` : `${a ? 'Approved' : 'Dismissed'} Tommy proposal “${name}” (simulated)`);
        const it = items.find(x => x.name === name), row = (a || d || u).closest('.p7-lrn'); if (it && row) row.outerHTML = learnRow(it);
        if (!u) TH.toast(a ? `Approved “${name}” (simulated)` : `Dismissed “${name}”`, a ? 'check' : 'x');
      };
    });
  }
  function learningSheet() {
    const w = TH.sheet(`<div class="stack"><div class="sheet-head"><h2>Tommy is learning</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>${learnShell()}</div>`);
    fillLearning(w);
  }
  function tommyUnpaid(org) {
    const ms = roster(org), tt = totals(org), o = XO().O(org), un = tt.un, vp = venmoPending(org);
    const text = `${tt.paid} of ${ms.length} members have paid ${money(o.dues)} dues: ${money(tt.collected)} collected, ${money(tt.outstanding)} outstanding.\nUnpaid: ${(un.map(m => bare(m.name)).join(', ') || 'nobody').replace(/\.$/, '')}.${o.venmo && o.venmo.on ? `\n${vp.length ? `${plural(vp.length, 'Venmo payment')} ${vp.length === 1 ? 'is' : 'are'} waiting to be matched.` : 'No unmatched Venmo payments.'}` : ''}`;
    const acts = [];
    if (vp.length) acts.push({ label: `Match ${plural(vp.length, 'Venmo payment')}`, icon: 'dollar', fn: () => venmoCheck(org) });
    if (un.length) acts.push({ label: `Remind all ${un.length} unpaid`, icon: 'bell', fn: () => remindSheet(org, un) });
    tommySheet({ title: 'Who hasn’t paid?', q: 'Who hasn’t paid dues?', text, acts });
  }
  function tommyBudget(org) {
    const f = budgetFacts(org);
    tommySheet({ title: 'How is our budget?', q: 'How is our budget?', text: f.join('\n') || 'No budget data yet.', acts: [{ label: 'Open the budget', icon: 'dollar', fn: () => TH.go('orgbudget') }] });
  }

  // =====================================================================
  // DECISIONS on Today
  // =====================================================================
  function decisions(org) {
    const D = [];
    if (!isClub(org)) {
      const x = X(), reps = x.reports.filter(r => r.status < 3), gaps = x.gaps.filter(g => !g.answer), rq = openReqs(org);
      if (reps.length) D.push({ ic: 'flag', tone: 'bad', h: `${plural(reps.length, 'problem report')} waiting`, sub: reps.slice(0, 2).map(r => r.desc).join(' · '), act: 'Open inbox', go: 'orginbox' });
      if (gaps.length) D.push({ ic: 'sparkle', tone: 'gold', h: `${plural(gaps.length, 'question')} Tommy couldn’t answer`, sub: `“${gaps[0].q}”`, act: 'Answer', go: 'orginbox' });
      if (rq[0]) D.push({ ic: 'megaphone', tone: 'red', h: `“${rq[0].title}” leads with ${rq[0].votes} votes`, sub: `${rq.length} open requests across USC`, act: 'See requests', go: 'orgreq' });
      return D;
    }
    const o = XO().O(org), rq = openReqs(org), hot = rq.filter(r => r.votes >= 20), tt = totals(org), evs = myEvents(org);
    if (hot.length) D.push({ ic: 'megaphone', tone: 'red', h: `${plural(hot.length, 'request')} hit 20 votes — schedule one?`, sub: `Top: “${hot[0].title}” · ${hot[0].votes} votes · ${hot[0].when.toLowerCase()}`, act: 'Schedule it', fn: () => openSchedule(org, { req: hot[0] }), tm: { l: 'What do members want?', fn: () => tommyWants(org) } });
    const past = evs.filter(e => !e.doneAt && isPast(e));
    if (past[0]) D.push({ ic: 'check', tone: 'ok', h: `How did “${past[0].title}” go?`, sub: `${fmtWhen(past[0])} · log attendance, cost and feedback`, act: 'Mark done', fn: () => doneSheet(org, past[0]) });
    const unann = evs.filter(e => !e.annAt && !e.doneAt);
    if (unann[0]) D.push({ ic: 'send', tone: 'gold', h: `“${unann[0].title}” isn’t announced yet`, sub: `${fmtWhen(unann[0])} · ${roomLabel(org, unann[0]).text}`, act: 'Announce this', fn: () => announceSheet(org, unann[0]) });
    if (tt.unpaid) D.push({ ic: 'dollar', tone: 'warn', h: `${tt.unpaid} dues unpaid — remind them`, sub: `${money(tt.outstanding)} outstanding · ${o.reminded ? 'last nudged ' + ago(o.reminded) : 'no reminder sent yet'}`, act: 'Remind all', fn: () => remindSheet(org, tt.un), tm: { l: 'Who hasn’t paid?', fn: () => tommyUnpaid(org) } });
    const pend = o.bookings.filter(b => b.status === 'pending');
    if (pend.length) D.push({ ic: 'building', tone: 'study', h: `${plural(pend.length, 'room request')} pending`, sub: `${pend[0].place} · ${pend[0].when}`, act: 'See rooms', go: 'orgspace' });
    const vp = venmoPending(org);
    if (vp.length) D.push({ ic: 'dollar', tone: 'venmo', h: `${plural(vp.length, 'Venmo payment')} to match`, sub: 'Match them all to members in one go', act: 'Match all', fn: () => venmoCheck(org) });
    return D;
  }

  TH.screens.org = {
    render() {
      const org = XO().cur(), D = decisions(org), top3 = D.slice(0, 3), more = D.length - 3, wd = TH.clock.now();
      const club = isClub(org), evs = club ? myEvents(org) : [], rq = openReqs(org);
      const counts = { requested: rq.length, scheduled: evs.filter(e => stageOf(e) === 'scheduled').length, announced: evs.filter(e => stageOf(e) === 'announced').length, done: evs.filter(e => stageOf(e) === 'done').length };
      const next = evs.filter(e => !e.doneAt && !isPast(e))[0];
      TH.state.p7today = top3;
      return shell('org', `
        <div class="p7-hero"><span class="eyebrow">${esc(TH.fmtDate(wd, true))}</span><h2>Today for ${esc(org.name)}</h2><p>${top3.length ? `${plural(top3.length, 'thing needs', 'things need')} a decision.` : 'Nothing needs you right now. Nice work.'}</p></div>
        ${top3.length ? `<div class="p7-decide">${top3.map((d, i) => `<div class="p7-dcard tone-${d.tone}" style="animation-delay:${i * 60}ms"><span class="p7-dic">${icon(d.ic)}</span><div class="p7-dmain"><b>${esc(d.h)}</b><span>${esc(d.sub)}</span>
            <div class="p7-drow"><button class="btn sm" data-p7d="${i}">${esc(d.act)}</button>${d.tm ? `<button class="p7-tbtn" data-p7dt="${i}">${icon('sparkle')}${esc(d.tm.l)}</button>` : ''}</div></div></div>`).join('')}</div>` : `<div class="p7-clear">${icon('check')}<b>All caught up</b><span>New requests, payments and room approvals show up here.</span></div>`}
        ${more > 0 ? `<span class="muted tiny">${plural(more, 'more item')} after these: ${esc(D.slice(3).map(d => d.h).join(' · '))}</span>` : ''}
        ${club ? `<div class="section"><div class="section-head"><h2>Event pipeline</h2><button data-go="orgplan">Open Plan</button></div>
          <div class="p7-flow">${STAGES.map(([k, l, ic]) => `<button class="p7-fstep" data-p7stage="${k}">${icon(ic)}<b>${counts[k]}</b><span>${l}</span></button>`).join('<i aria-hidden="true"></i>')}</div></div>
        ${next ? `<div class="section"><div class="section-head"><h2>Next up</h2></div>${evCard(org, next)}</div>` : ''}` : ''}
        ${club ? '' : learnShell()}
        ${sim(club ? `You run ${esc(org.name)} in this demo. Requests, members, dues and costs are sample data and simulated actions on this device, not the club’s real records.` : 'Staff view on the demo account. Student data shown is what students chose to send.')}`);
    },
    mount(host) {
      const D = TH.state.p7today || [];
      host.addEventListener('click', e => {
        const d = e.target.closest('[data-p7d]'), t = e.target.closest('[data-p7dt]'), s = e.target.closest('[data-p7stage]');
        if (s) { TH.state.p7stage = s.dataset.p7stage; TH.go('orgplan'); }
        else if (d) { const it = D[+d.dataset.p7d]; if (it) it.go ? TH.go(it.go) : it.fn(); }
        else if (t) { const it = D[+t.dataset.p7dt]; if (it && it.tm) it.tm.fn(); }
      });
      bindEvCards(host);
      fillLearning(host);
    },
  };

  // =====================================================================
  // PLAN: the event pipeline
  // =====================================================================
  function tracker(stage) {
    const i = STAGES.findIndex(s => s[0] === stage);
    return `<div class="p7-track" aria-label="Stage: ${esc(STAGES[i][1])}">${STAGES.map(([k, l], j) => `<span class="${j < i ? 'past' : j === i ? 'now' : ''}"><i></i>${esc(l)}</span>`).join('')}</div>`;
  }
  function reqCard(org, r) {
    const hotv = r.votes >= 20;
    return `<div class="p7-ev"><div class="p7-evh"><span class="p7-votes ${hotv ? 'hot' : ''}"><b>${r.votes}</b><small>votes</small></span><span class="p7-evt"><b>${esc(r.title)}</b><span>${esc(r.type)} · ${esc(r.when.toLowerCase())}</span></span></div>
      ${tracker('requested')}
      ${isClub(org) ? `<div class="p7-evacts"><button class="btn sm" data-p7sched="${esc(r.id)}">${icon('calendar')} Schedule</button></div>` : `<span class="muted tiny">Sent ${esc(TH.x.reqTo(r))}</span>`}</div>`;
  }
  function evCard(org, ev) {
    const st = stageOf(ev), r = reqOf(ev), rm = roomLabel(org, ev), ec = estCost(org, ev), p = P(org);
    const facts = [
      ['Votes', r ? `${r.votes}` : '—'],
      ['Date', fmtWhen(ev)],
      ['Room', `${esc(rm.text)}${rm.pill && !(st === 'done' && !ev.room) ? ` <span class="pill ${rm.pill[0]}">${rm.pill[1]}</span>` : ''}`, true],
      [st === 'done' ? 'Came' : 'RSVPs', st === 'scheduled' ? (r ? `${r.votes} requesters get first RSVP` : 'Opens when announced') : st === 'done' ? `${ev.att} people` : `${rsvps(org, ev)} ${est()}`, true],
      ['Cost', ev.cost != null ? `${money(ev.cost)} spent` : ec != null ? `~${money(ec)} ${est()}` : '—', true],
    ];
    let acts = '';
    if (st === 'scheduled') acts = `<button class="btn sm" data-p7ann="${esc(ev.id)}">${icon('send')} Announce this</button>${!ev.room && !ev.where ? `<button class="btn sm line" data-p7room="${esc(ev.id)}">${icon('building')} Add a room</button>` : ''}<button class="p7-tbtn" data-p7draft="${esc(ev.id)}">${icon('sparkle')}Draft the announcement</button>`;
    else if (st === 'announced') acts = `<button class="btn sm ${isPast(ev) ? '' : 'line'}" data-p7done="${esc(ev.id)}">${icon('check')} Mark done</button>${!ev.room && !ev.where ? `<button class="btn sm line" data-p7room="${esc(ev.id)}">${icon('building')} Add a room</button>` : ''}${p.luma.url ? `<a class="btn sm ghost" href="${esc(ev.luma || p.luma.url)}" target="_blank" rel="noopener">${icon('external')} Open in Luma</a>` : ''}`;
    else acts = `<button class="btn sm line" data-p7dup="${esc(ev.id)}">${icon('copy')} Run it again</button>${ev.rating ? `<span class="pill ${ev.rating === 'Great' ? 'ok' : ev.rating === 'Good' ? 'gold' : 'mute'}">${esc(ev.rating)}</span>` : ''}`;
    return `<div class="p7-ev st-${st}"><div class="p7-evh"><span class="p7-date"><small>${esc(TH.MONTHS[evStart(ev).getMonth()].slice(0, 3))}</small><b>${evStart(ev).getDate()}</b></span><span class="p7-evt"><b>${esc(ev.title)}</b><span>${esc(STAGES.find(s => s[0] === st)[1])}${ev.doneAt ? ' ' + ago(ev.doneAt) : ev.annAt ? ' · announced ' + ago(ev.annAt) : ''}${st !== 'done' && isPast(ev) ? ' · happened' : ''}</span></span></div>
      ${tracker(st)}
      <dl class="p7-facts">${facts.map(([k, v, raw]) => `<dt>${k}</dt><dd>${raw ? v : esc(v)}</dd>`).join('')}</dl>
      ${ev.fbNote ? `<p class="p7-fb">“${esc(ev.fbNote)}”</p>` : ''}
      <div class="p7-evacts">${acts}</div></div>`;
  }
  function bindEvCards(host) {
    host.addEventListener('click', e => {
      const org = XO().cur(), find = id => XO().O(org).events.find(v => v.id === id);
      const s = e.target.closest('[data-p7sched]'), a = e.target.closest('[data-p7ann]'), d = e.target.closest('[data-p7done]'), u = e.target.closest('[data-p7dup]'), rm = e.target.closest('[data-p7room]'), dr = e.target.closest('[data-p7draft]');
      if (s) { const r = X().evreqs.find(q => q.id === s.dataset.p7sched); if (r) openSchedule(org, { req: r }); }
      else if (a) { const ev = find(a.dataset.p7ann); if (ev) announceSheet(org, ev); }
      else if (dr) { const ev = find(dr.dataset.p7draft); if (ev) announceDraftSheet(org, ev); }
      else if (d) { const ev = find(d.dataset.p7done); if (ev) doneSheet(org, ev); }
      else if (u) { const ev = find(u.dataset.p7dup); if (ev) openSchedule(org, { from: ev }); }
      else if (rm) { const ev = find(rm.dataset.p7room); if (ev) roomSheet(org, ev); }
    });
  }
  TH.screens.orgplan = {
    render() {
      const org = XO().cur();
      if (!isClub(org)) return shell('orgplan', `<div class="p7-evs">${openReqs(org).slice(0, 8).map(r => reqCard(org, r)).join('')}</div><span class="muted tiny">Campus-wide requests. Clubs schedule them from their own Plan.</span>`);
      const f = TH.state.p7stage || 'all', rq = openReqs(org), evs = myEvents(org), last = evs.slice().sort((a, b) => evStart(b) - evStart(a))[0];
      const by = k => k === 'requested' ? rq : evs.filter(e => stageOf(e) === k);
      const real = XO().upcoming(org).slice(0, 4);
      const sec = k => { const l = by(k), s = STAGES.find(x => x[0] === k); if (!l.length) return ''; return `<div class="section"><div class="section-head"><h2 class="p7-sh">${icon(s[2])} ${s[1]} <span class="muted">${l.length}</span></h2></div>${k === 'requested' ? `<button class="p7-tbtn" id="p7-wants">${icon('sparkle')}Summarize what members want</button>${P(org).pinned ? `<div class="p7-pin"><span class="p7-aitag ${/^Written by/.test(P(org).pinned.tag) ? 'ai' : ''}">${icon('star')}Pinned · ${esc(P(org).pinned.tag)}</span><p>${esc(P(org).pinned.text)}</p><button class="linkbtn" id="p7-unpin">Unpin</button></div>` : ''}` : ''}<div class="p7-evs">${(k === 'requested' ? l.slice(0, f === 'requested' ? 99 : 3) : l).map(x => k === 'requested' ? reqCard(org, x) : evCard(org, x)).join('')}</div>${k === 'requested' && l.length > 3 && f !== 'requested' ? `<button class="btn ghost block sm" data-p7f="requested">See all ${l.length} requests</button>` : ''}</div>`; };
      return shell('orgplan', `
        <div class="p7-chips scroll" role="group" aria-label="Show stage"><button data-p7f="all" aria-pressed="${f === 'all'}">All</button>${STAGES.map(([k, l]) => `<button data-p7f="${k}" aria-pressed="${f === k}">${l}<b>${by(k).length}</b></button>`).join('')}</div>
        <div class="p7-row2"><button class="btn block sm" id="p7-new">${icon('plus')} New event</button>${last ? `<button class="btn line block sm" id="p7-dup">${icon('copy')} Duplicate last event</button>` : ''}</div>
        ${(f === 'all' ? STAGES.map(s => s[0]) : [f]).map(sec).join('') || `<div class="p7-clear">${icon('calendar')}<b>Nothing in this stage</b><span>Schedule a request to start the pipeline.</span></div>`}
        ${real.length && (f === 'all' || f === 'announced') ? `<div class="section"><div class="section-head"><h2>Also public on EngageSC</h2></div><div class="rows">${real.map(e => TH.x.row(`data-event="${esc(e.id)}"`, 'calendar', esc(e.title), esc(TH.when(e)), 'var(--c-fitness)', `<span class="pill mute">EngageSC</span>`)).join('')}</div><span class="muted tiny">Real listings from engage.usc.edu. RSVP counts aren’t public, so none are shown.</span></div>` : ''}
        ${sim('Votes, RSVPs and costs on events you schedule here are simulated. RSVPs and costs marked Est. are estimates from the sample ledger.')}`);
    },
    mount(host) {
      const org = XO().cur();
      host.addEventListener('click', e => { const f = e.target.closest('[data-p7f]'); if (f) { TH.state.p7stage = f.dataset.p7f; TH.render(true); } });
      const n = $('#p7-new', host); if (n) n.onclick = () => openSchedule(org, {});
      const d = $('#p7-dup', host); if (d) d.onclick = () => { const l = myEvents(org).sort((a, b) => evStart(b) - evStart(a))[0]; if (l) openSchedule(org, { from: l }); };
      const w = $('#p7-wants', host); if (w) w.onclick = () => tommyWants(org);
      const up = $('#p7-unpin', host); if (up) up.onclick = () => { delete P(org).pinned; save(); TH.render(true); };
      bindEvCards(host);
    },
  };

  // ---------- Schedule sheet: prefilled from a request (or the event being duplicated), with a room from the Space data ----------
  function openSchedule(org, o) {
    const r = o.req || null, from = o.from || null, oo = XO().O(org);
    const books = oo.bookings.filter(b => b.dk && TH.dkey(TH.clock.now()) <= b.dk);
    const d0 = books[0] ? books[0].dk : TH.dkey(TH.addDays(TH.clock.now(), 7));
    const title = r ? r.title : from ? from.title : '', desc = r ? (r.desc || r.note || '') : from ? (from.desc || '') : '';
    const tags = r ? (r.hashtags || []) : from ? (from.hashtags || []) : [];
    const t0 = books[0] && books[0].h != null ? `${String(books[0].h).padStart(2, '0')}:00` : '18:00';
    TH.sheet(`<div class="stack p7-form"><div class="sheet-head"><div><span class="eyebrow">${r ? `${r.votes} students asked for this` : from ? 'Run it again' : esc(org.name)}</span><h2>${r ? 'Schedule it' : from ? 'Duplicate event' : 'New event'}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="p7s-title">Title</label><input id="p7s-title" maxlength="80" value="${esc(title)}" placeholder="e.g. Resume workshop with alumni"></div>
      <div class="field"><label for="p7s-room">Room</label><select id="p7s-room">${books.map(b => `<option value="${esc(b.id)}" data-dk="${esc(b.dk)}" data-h="${b.h}">${esc(b.place)} · ${esc(b.when)} · ${b.status === 'approved' ? 'approved' : 'pending'}</option>`).join('')}<option value="">${books.length ? 'Somewhere else (type it)' : 'Type a place'}</option></select>
        <span class="muted tiny">${books.length ? 'Your room requests from Plan › Rooms. Picking one sets the date and time.' : 'No room requests yet.'} <button type="button" class="linkbtn" id="p7s-book">Book a room</button></span></div>
      <div class="field" id="p7s-wf" ${books.length ? 'hidden' : ''}><label for="p7s-where">Where</label><input id="p7s-where" maxlength="60" value="${esc(from && !from.room ? from.where || '' : '')}" placeholder="e.g. Taper Hall 101"></div>
      <div class="grid2"><div class="field"><label for="p7s-date">Date</label><input id="p7s-date" type="date" value="${d0}" min="${TH.dkey(TH.clock.now())}"></div><div class="field"><label for="p7s-time">Start</label><input id="p7s-time" type="time" value="${t0}"></div></div>
      <div class="field"><label for="p7s-desc">Details</label><textarea id="p7s-desc" rows="2" placeholder="What happens, who is welcome, food…">${esc(desc)}</textarea></div>
      <div class="field"><div class="p7-lrow"><label for="p7s-tags">Hashtags (for recommendations)</label><button type="button" class="ai-gen-btn" id="p7s-ai">${icon('sparkle')} Generate</button></div><input id="p7s-tags" maxlength="120" value="${esc(tags.join(' '))}" placeholder="#career #freefood"></div>
      <div class="err" hidden></div>
      <button class="btn block" id="p7s-ok">${icon('calendar')} ${r ? `Schedule and tell ${plural(r.votes, 'requester')}` : 'Schedule event'}</button>
      ${sim(r ? 'Simulated. Requesters would be notified in the app or by email, whichever they chose.' : 'Simulated. Added to this club’s pipeline on this device.')}</div>`, w => {
      const sel = $('#p7s-room', w), wf = $('#p7s-wf', w);
      const syncRoom = () => { const op = sel.selectedOptions[0]; wf.hidden = !!sel.value; if (sel.value && op.dataset.dk) { $('#p7s-date', w).value = op.dataset.dk; if (op.dataset.h !== 'undefined') $('#p7s-time', w).value = `${String(op.dataset.h).padStart(2, '0')}:00`; } };
      sel.onchange = syncRoom; if (sel.value) syncRoom();
      $('#p7s-book', w).onclick = () => { TH.closeSheet(); TH.go('orgspace'); TH.toast('Pick a room and time, then schedule from Plan › Events', 'building'); };
      $('#p7s-ai', w).onclick = () => { const t = TH.ai.generateHashtags($('#p7s-title', w).value, $('#p7s-desc', w).value, org.name, r && r.type); $('#p7s-tags', w).value = t.join(' '); };
      $('#p7s-ok', w).onclick = () => {
        const er = $('.err', w), tt = $('#p7s-title', w).value.trim(), dv = $('#p7s-date', w).value, tv = $('#p7s-time', w).value || '18:00';
        if (!tt) { er.hidden = false; er.textContent = 'Add a title.'; return; }
        if (!dv) { er.hidden = false; er.textContent = 'Pick a date.'; return; }
        const b = sel.value ? oo.bookings.find(x => x.id === sel.value) : null;
        const raw = ($('#p7s-tags', w).value || '').match(/#[a-zA-Z0-9_-]+/g) || [], hashtags = raw.length ? raw : TH.ai.generateHashtags(tt, $('#p7s-desc', w).value, org.name);
        const mineReq = !!(r && (r.mine || X().votes[r.id]));
        const ev = { id: uid(), title: tt, start: `${dv}T${tv}:00`, where: b ? b.place : $('#p7s-where', w).value.trim(), room: b ? b.id : null, desc: $('#p7s-desc', w).value.trim(), hashtags, org: org.name, req: r ? r.id : null, priority: mineReq, from: from ? from.id : null };
        const end = TH.laDate(ev.start); end.setHours(end.getHours() + 2);
        oo.events.push(ev); if (r) r.status = 'scheduled';
        const H = TH.H(); H.eventHashtags = H.eventHashtags || {}; H.eventHashtags[ev.id] = hashtags;
        if (!r || mineReq) H.calendar.push({ ref: 'x-' + ev.id, title: ev.title, start: ev.start, end: TH.laISO(end), where: ev.where, org: org.name, kind: r ? 'event' : 'club' });
        TH.commit(`Scheduled ${tt} for ${org.name}${b ? ' in ' + b.place : ''}`); TH.closeSheet();
        if (mineReq) note('events', `It’s happening: ${tt}`, `${org.name} scheduled the event you asked for. You have first RSVP, and it’s on My Day.`, 'plans');
        TH.state.p7stage = 'scheduled';
        if (TH.state.route !== 'orgplan') TH.go('orgplan'); else TH.render(true);
        TH.toast(r ? `Scheduled. ${plural(r.votes, 'requester')} get first RSVP. Next: announce it.` : 'Scheduled. Next: announce it.', 'calendar');
      };
    });
  }
  function roomSheet(org, ev) {
    const books = XO().O(org).bookings;
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${esc(ev.title)}</span><h2>Add a room</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${books.length ? `<div class="rows">${books.map(b => `<button class="row" data-p7bk="${esc(b.id)}" style="--rc:var(--c-study)"><span class="rico">${icon('building')}</span><span class="rmain"><span class="rtitle wrap">${esc(b.place)}</span><span class="rsub wrap">${esc(b.when)}</span></span><span class="rside"><span class="pill ${b.status === 'approved' ? 'ok' : 'warn'}">${b.status === 'approved' ? 'Approved' : 'Pending'}</span></span></button>`).join('')}</div>` : `<p class="muted">No room requests yet.</p>`}
      <button class="btn block" data-go="orgspace">${icon('building')} Book a new room</button>${sim('Room availability and approvals are simulated.')}</div>`, w => {
      w.addEventListener('click', e => { const b = e.target.closest('[data-p7bk]'); if (!b) return; const bk = books.find(x => x.id === b.dataset.p7bk); ev.room = bk.id; ev.where = bk.place; if (bk.dk) ev.start = `${bk.dk}T${String(bk.h != null ? bk.h : 18).padStart(2, '0')}:00:00`; TH.commit(`Set ${bk.place} for ${ev.title}`); TH.closeSheet(); TH.render(true); TH.toast(`${bk.place} set for ${ev.title}`, 'building'); });
    });
  }

  // ---------- Announce: Tommy drafts it, one tap posts it (newsletter data model), optional Luma ----------
  function announceDraft(org, ev) {
    const r = reqOf(ev), s = evStart(ev), p = P(org), lk = ev.luma || p.luma.url;
    return { subject: `${ev.title} · ${TH.fmtDate(s)}`, body: `Hi everyone!\n\n${ev.title} is on ${TH.fmtDate(s, true)} at ${TH.fmtTime(s)}${ev.where ? `, ${ev.where}` : ''}.${ev.desc ? `\n\n${ev.desc}` : ''}${r ? `\n\n${r.votes} of you asked for this one, so requesters get first RSVP.` : ''}\n\nRSVP in Trojan Hub${lk ? ` or on Luma: ${lk}` : ''}.\n\nFight on,\n${TH.student().first}` };
  }
  function postAnnouncement(org, ev, subject, body, to) {
    const ms = roster(org), n = ms.filter(m => to === 'all' || m.paid).length, x = X();
    XO().O(org).sent.unshift({ id: uid(), subject: (subject || '').trim() || ev.title, body, at: Date.now(), count: n, emailed: x.conn.gmail, org: org.name, ev: ev.id });
    ev.annAt = Date.now(); if (ev.rsvp == null) ev.rsvp = rsvps(org, ev); if (TH.state.p7stage && TH.state.p7stage !== 'all') TH.state.p7stage = 'announced';
    TH.commit(`Announced ${ev.title} to ${plural(n, 'member')} of ${org.name} (simulated)`);
    note('news', `New from ${org.name}`, `${ev.title}: an announcement from the club’s officers.`, 'news');
    TH.closeSheet(); TH.render(true); TH.toast(`Announced to ${plural(n, 'member')} (simulated)`, 'send');
  }
  function announceSheet(org, ev, preset) {
    const ms = roster(org), d = announceDraft(org, ev), p = P(org);
    if (preset && preset.text) d.body = preset.text;
    TH.sheet(`<div class="stack p7-form"><div class="sheet-head"><div><span class="eyebrow">${icon('send')} Announce</span><h2>${esc(ev.title)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><div class="p7-lrow"><label for="p7a-sub">Subject</label><button type="button" class="p7-tbtn" id="p7a-ai">${icon('sparkle')}${preset && preset.text ? 'Draft again' : 'Draft with Claude'}</button></div><input id="p7a-sub" maxlength="90" value="${esc(d.subject)}"></div>
      <div class="field"><label for="p7a-body">Message</label><textarea id="p7a-body" rows="7" maxlength="3000">${esc(d.body)}</textarea><span class="p7-aitag ${preset && /^Written by/.test(preset.tag || '') ? 'ai' : ''}" id="p7a-src">${icon(preset && /^Written by/.test(preset.tag || '') ? 'sparkle' : 'info')}${esc(preset && preset.tag ? preset.tag : 'Template from the event card')}</span></div>
      <div class="field"><label for="p7a-to">Send to</label><select id="p7a-to"><option value="all">All ${ms.length} members</option><option value="paid">${ms.filter(m => m.paid).length} paid members</option></select></div>
      <button class="btn block" id="p7a-ok">${icon('send')} Post announcement</button>
      <div class="p7-row2"><button class="btn line block sm" id="p7a-nl">${icon('mail')} Edit in Newsletter</button>${p.luma.url ? `<button class="btn line block sm" id="p7a-luma">${icon('external')} Add to Luma</button>` : `<button class="btn line block sm" data-go="orgpromote">${icon('link')} Link Luma</button>`}</div>
      ${sim(`Simulated: posts to #announcements and members’ Club Newsletters on this device${X().conn.gmail ? ', and would email them through Gmail' : ''}. Nothing leaves this device.`)}</div>`, w => {
      const sub = $('#p7a-sub', w), body = $('#p7a-body', w);
      const drafted = async () => {
        const b = $('#p7a-ai', w), src = $('#p7a-src', w); b.disabled = true; body.disabled = true; src.className = 'p7-aitag'; src.innerHTML = `<span class="p7-dots" aria-hidden="true"><i></i><i></i><i></i></span>Claude is writing…`;
        const res = await aiDraft('announcement', announcePayload(org, ev));
        if (!w.isConnected) return; body.disabled = false; b.disabled = false; b.innerHTML = `${icon('sparkle')}Draft again`;
        if (res) { body.value = res.text.trim(); src.className = 'p7-aitag ai'; src.innerHTML = `${icon('sparkle')}${esc('Written by ' + modelName(res.model) + ' · from your event details')}`; }
        else { body.value = announceDraft(org, ev).body; src.innerHTML = `${icon('info')}${esc(TEMPLATE_TAG)}`; }
      };
      $('#p7a-ai', w).onclick = drafted;
      $('#p7a-nl', w).onclick = () => { const su = sub.value, bo = body.value; TH.state.p7annFor = { org: org.id, ev: ev.id }; TH.closeSheet(); TH.go('orgnews'); const s1 = $('#nl-sub'), b1 = $('#nl-body'); if (s1 && b1) { s1.value = su; b1.value = bo; s1.dispatchEvent(new Event('input')); b1.dispatchEvent(new Event('input')); } TH.toast('Draft moved to the newsletter. Sending it marks the event announced.', 'mail'); };
      const lb = $('#p7a-luma', w); if (lb) lb.onclick = () => addToLuma(org, ev, sub.value, body.value);
      $('#p7a-ok', w).onclick = () => {
        if (body.value.trim().length < 10) return TH.toast('Write a message first', 'alert');
        postAnnouncement(org, ev, sub.value, body.value, $('#p7a-to', w).value);
      };
    });
  }

  // ---------- Done: attendance, cost and feedback close the loop ----------
  function doneSheet(org, ev) {
    let rating = ev.rating || 'Great'; const ex = expected(org, ev), ec = estCost(org, ev);
    TH.sheet(`<div class="stack p7-form"><div class="sheet-head"><div><span class="eyebrow">${esc(fmtWhen(ev))}</span><h2>How did “${esc(ev.title)}” go?</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${!isPast(ev) ? `<div class="banner info">${icon('info')}<div><span>This event is still ahead (${esc(fmtWhen(ev))}). You can log it now for the demo.</span></div></div>` : ''}
      <div class="p7-rate" role="group" aria-label="How it went">${['Great', 'Good', 'Meh'].map(v => `<button type="button" data-p7r="${v}" aria-pressed="${v === rating}">${v === 'Great' ? '🎉' : v === 'Good' ? '🙂' : '😐'}<span>${v}</span></button>`).join('')}</div>
      <div class="grid2"><div class="field"><label for="p7d-att">People who came</label><input id="p7d-att" type="number" min="0" max="999" value="${ev.att != null ? ev.att : ex}"></div><div class="field"><label for="p7d-cost">Spent ($)</label><input id="p7d-cost" type="number" min="0" max="20000" step="1" value="${ev.cost != null ? ev.cost : ec != null ? ec : ''}"></div></div>
      ${ec != null ? `<span class="muted tiny">Est. ${money(ec)} from last semester’s sample cost per attendee. Change it to what you really spent.</span>` : ''}
      <div class="field"><label for="p7d-note">Notes for next time</label><textarea id="p7d-note" rows="2" maxlength="300" placeholder="e.g. Ran out of boba by 7:15. Order 20% more.">${esc(ev.fbNote || '')}</textarea></div>
      <label class="p7-check"><input type="checkbox" id="p7d-ask" checked><span><b>Ask attendees for a thumbs up or down</b><span>Their answers show in Plan › Insights</span></span></label>
      <button class="btn block" id="p7d-ok">${icon('check')} Mark done</button>
      ${sim('Simulated: logged on this device. Costs you enter show under Money.')}</div>`, w => {
      w.addEventListener('click', e => { const b = e.target.closest('[data-p7r]'); if (!b) return; rating = b.dataset.p7r; $$('[data-p7r]', w).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      $('#p7d-ok', w).onclick = () => {
        const prev = { doneAt: ev.doneAt, att: ev.att, cost: ev.cost, rating: ev.rating, fbNote: ev.fbNote, annAt: ev.annAt };
        ev.att = Math.max(0, Math.round(+$('#p7d-att', w).value || 0)); const c = $('#p7d-cost', w).value; ev.cost = c === '' ? null : Math.max(0, Math.round(+c));
        ev.rating = rating; ev.fbNote = $('#p7d-note', w).value.trim(); ev.doneAt = Date.now(); if (!ev.annAt) ev.annAt = ev.doneAt; ev.askFb = $('#p7d-ask', w).checked; if (TH.state.p7stage && TH.state.p7stage !== 'all') TH.state.p7stage = 'done';
        TH.commit(`Marked ${ev.title} done: ${ev.att} came${ev.cost != null ? ', ' + money(ev.cost) + ' spent' : ''} (simulated)`); TH.closeSheet(); TH.render(true);
        undoToast(`${ev.title} is done. ${ev.att} came${ev.cost != null ? ' · ' + money(ev.cost) : ''}.`, 'check', () => { Object.assign(ev, prev); save(); TH.render(true); });
      };
    });
  }

  // =====================================================================
  // LUMA: link a public calendar; "Open in Luma" / "Add to Luma" links. Linked, never "Synced".
  // =====================================================================
  const LUMA_RE = /^https?:\/\/(www\.)?(lu\.ma|luma\.com)\/[A-Za-z0-9][\w\-./?=&%]*$/i;
  const LUMA_CREATE = 'https://luma.com/create';
  function addToLuma(org, ev, subject, body) {
    const s = evStart(ev), txt = `${ev.title}\n${TH.fmtDate(s, true)} · ${TH.fmtTime(s)}${ev.where ? '\n' + ev.where : ''}\n\n${body || ev.desc || ''}`;
    const done = ok => TH.toast(ok ? 'Event details copied. Paste them into Luma’s new event page.' : 'Luma opened. Copy the details from the announcement.', 'external');
    try { navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); } catch (e) { done(false); }
    window.open(LUMA_CREATE, '_blank', 'noopener');
    ev.lumaAddAt = Date.now(); save();
  }
  function lumaSheet(org) {
    const p = P(org);
    TH.sheet(`<div class="stack p7-form"><div class="sheet-head"><div><span class="eyebrow">Luma</span><h2>${p.luma.url ? 'Your Luma calendar' : 'Link your Luma calendar'}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="p7l-url">Luma calendar link</label><input id="p7l-url" type="url" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="200" value="${esc(p.luma.url)}" placeholder="https://lu.ma/your-club"><span class="ferr" id="p7l-err" aria-live="polite"></span></div>
      <p class="muted" style="font-size:13px;margin:0">Paste the link to your club’s public Luma calendar (lu.ma or luma.com). Trojan Hub then shows “Open in Luma” and “Add to Luma” on each event.</p>
      <div class="banner info">${icon('info')}<div><b>Linked, not synced</b><span>Events don’t copy between Trojan Hub and Luma automatically. Real two-way sync needs a Luma Plus API key and a server, which this prototype doesn’t have.</span></div></div>
      <button class="btn block" id="p7l-ok">${icon('link')} ${p.luma.url ? 'Save link' : 'Link calendar'}</button>
      ${p.luma.url ? `<button class="btn line block" id="p7l-off">Unlink</button>` : ''}</div>`, w => {
      $('#p7l-ok', w).onclick = () => { const v = $('#p7l-url', w).value.trim(); if (!LUMA_RE.test(v)) { $('#p7l-err', w).textContent = 'Use a lu.ma or luma.com link, like https://lu.ma/your-club'; return; } p.luma = { url: v, at: Date.now() }; TH.commit(`Linked Luma calendar ${v} to ${org.name}`); TH.closeSheet(); TH.render(true); TH.toast('Luma calendar linked', 'link'); };
      const off = $('#p7l-off', w); if (off) off.onclick = () => { p.luma = { url: '', at: 0 }; save(); TH.closeSheet(); TH.render(true); TH.toast('Luma unlinked', 'link'); };
    });
  }
  function lumaEventSheet(org, ev) {
    TH.sheet(`<div class="stack p7-form"><div class="sheet-head"><div><span class="eyebrow">Luma</span><h2>${esc(ev.title)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="p7le-url">This event’s Luma page (optional)</label><input id="p7le-url" type="url" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="200" value="${esc(ev.luma || '')}" placeholder="https://lu.ma/abc123"><span class="ferr" id="p7le-err"></span></div>
      <span class="muted tiny">After you add it on Luma, paste its link so “Open in Luma” goes straight to it.</span>
      <button class="btn block" id="p7le-ok">Save</button></div>`, w => {
      $('#p7le-ok', w).onclick = () => { const v = $('#p7le-url', w).value.trim(); if (v && !LUMA_RE.test(v)) { $('#p7le-err', w).textContent = 'Use a lu.ma or luma.com link'; return; } ev.luma = v; save(); TH.closeSheet(); TH.render(true); TH.toast(v ? 'Luma page saved' : 'Luma page cleared', 'link'); };
    });
  }

  // =====================================================================
  // PROMOTE
  // =====================================================================
  TH.screens.orgpromote = {
    render() {
      const org = XO().cur();
      if (!isClub(org)) return shell('orgpromote', `<div class="empty">${icon('megaphone')}<b>Promote is for clubs</b><span>Switch to a club in the menu.</span></div>`);
      const o = XO().O(org), p = P(org), evs = myEvents(org), ready = evs.filter(e => stageOf(e) === 'scheduled'), live = evs.filter(e => stageOf(e) === 'announced');
      const lumaRow = ev => p.luma.url ? `<div class="p7-luma-acts"><a class="btn sm ghost" href="${esc(ev.luma || p.luma.url)}" target="_blank" rel="noopener">${icon('external')} Open in Luma</a><button class="btn sm ghost" data-p7lumaadd="${esc(ev.id)}">${icon('plus')} Add to Luma</button><button class="btn sm ghost" data-p7lumaev="${esc(ev.id)}">${icon('link')} ${ev.luma ? 'Edit link' : 'Paste link'}</button></div>` : '';
      return shell('orgpromote', `
        <div class="p7-luma card ${p.luma.url ? 'on' : ''}"><span class="p7-lumalogo" aria-hidden="true">L</span><span class="p7-lmain"><b>Luma calendar</b><span>${p.luma.url ? `<span class="pill ok">Linked</span> ${esc(p.luma.url.replace(/^https?:\/\//, ''))}` : 'Not linked. Paste your club’s lu.ma calendar link.'}</span><small>${p.luma.url ? 'Links only: events don’t sync automatically.' : 'Then each event gets “Open in Luma” and “Add to Luma”.'}</small></span>${p.luma.url ? `<a class="btn sm line" href="${esc(p.luma.url)}" target="_blank" rel="noopener">Open</a>` : ''}<button class="btn sm ${p.luma.url ? 'ghost' : ''}" id="p7-luma">${p.luma.url ? 'Edit' : 'Link'}</button></div>
        <div class="section"><div class="section-head"><h2>Ready to announce <span class="muted">${ready.length}</span></h2></div>
          ${ready.length ? `<div class="p7-evs">${ready.map(ev => `<div class="p7-ev"><div class="p7-evh"><span class="p7-date"><small>${esc(TH.MONTHS[evStart(ev).getMonth()].slice(0, 3))}</small><b>${evStart(ev).getDate()}</b></span><span class="p7-evt"><b>${esc(ev.title)}</b><span>${esc(fmtWhen(ev))} · ${esc(roomLabel(org, ev).text)}</span></span></div>
            <div class="p7-evacts"><button class="btn sm" data-p7ann="${esc(ev.id)}">${icon('send')} Announce this</button><button class="p7-tbtn" data-p7draft="${esc(ev.id)}">${icon('sparkle')}Draft the announcement</button></div>${lumaRow(ev)}</div>`).join('')}</div>`
            : `<div class="p7-clear">${icon('send')}<b>Nothing waiting</b><span>Scheduled events show up here to announce.</span><button class="btn sm line" data-go="orgplan">Go to Plan</button></div>`}</div>
        ${live.length ? `<div class="section"><div class="section-head"><h2>Announced</h2></div><div class="p7-evs">${live.map(ev => `<div class="p7-ev st-announced"><div class="p7-evh"><span class="p7-date"><small>${esc(TH.MONTHS[evStart(ev).getMonth()].slice(0, 3))}</small><b>${evStart(ev).getDate()}</b></span><span class="p7-evt"><b>${esc(ev.title)}</b><span>Announced ${ago(ev.annAt)} · ${rsvps(org, ev)} RSVPs ${est()}</span></span></div>${lumaRow(ev)}</div>`).join('')}</div></div>` : ''}
        <div class="section"><div class="section-head"><h2>Sent</h2><button data-go="orgnews">Write a newsletter</button></div>
          ${o.sent.length ? `<div class="rows">${o.sent.slice(0, 6).map(n => `<div class="row" style="--rc:var(--cardinal)"><span class="rico">${icon(n.ev ? 'send' : 'mail')}</span><span class="rmain"><span class="rtitle wrap">${esc(n.subject)}</span><span class="rsub wrap">${ago(n.at)} · ${n.count} members${n.sample ? ' · sample' : ''}</span></span></div>`).join('')}</div>` : `<p class="muted">Nothing sent yet.</p>`}</div>
        ${sim('Posting is simulated: nothing leaves this device. Luma links are real links; Trojan Hub can’t read or write your Luma events.')}`);
    },
    mount(host) {
      const org = XO().cur(); if (!isClub(org)) return;
      $('#p7-luma', host).onclick = () => lumaSheet(org);
      bindEvCards(host);
      host.addEventListener('click', e => {
        const find = id => XO().O(org).events.find(v => v.id === id);
        const a = e.target.closest('[data-p7lumaadd]'), l = e.target.closest('[data-p7lumaev]');
        if (a) { const ev = find(a.dataset.p7lumaadd), d = announceDraft(org, ev); addToLuma(org, ev, d.subject, d.body); }
        else if (l) lumaEventSheet(org, find(l.dataset.p7lumaev));
      });
    },
  };
  // a newsletter started from "Announce this" marks the event announced when it's sent
  (function () {
    const s = TH.screens.orgnews; if (!s) return; const m0 = s.mount;
    s.mount = function (host) {
      m0 && m0.apply(this, arguments);
      const f = $('#nl-form', host); if (!f) return;
      f.addEventListener('submit', () => {
        const a = TH.state.p7annFor; if (!a) return; TH.state.p7annFor = null;
        const org = XO().orgs().find(o => o.id === a.org), ev = org && XO().O(org).events.find(v => v.id === a.ev);
        const b = $('#nl-body'); if (!ev || (b && b.value.trim().length < 10)) return;
        ev.annAt = Date.now(); if (ev.rsvp == null) ev.rsvp = rsvps(org, ev); save();
      });
    };
  })();

  // =====================================================================
  // PEOPLE: Discord-style roster
  // =====================================================================
  const MF = () => TH.state.p7mf || (TH.state.p7mf = { pay: 'all', year: 'all', q: '' });
  const SEL = () => TH.state.p7sel || (TH.state.p7sel = new Set());
  function filtered(org) {
    const F = MF(), q = F.q.trim().toLowerCase();
    return roster(org).filter(m => (F.pay === 'all' || (F.pay === 'paid') === !!m.paid) && (F.year === 'all' || m.year === F.year) && (!q || [m.name, m.email, m.role, m.year].join(' ').toLowerCase().includes(q)));
  }
  function memRow(org, m) {
    const o = XO().O(org), sel = SEL().has(m.name), key = esc(m.name);
    const sub = [m.year, m.paid ? (m.via ? (/trojan hub/i.test(m.via) ? 'paid in app' : /marked/i.test(m.via) ? 'marked paid' : 'paid via ' + m.via) : 'paid') : 'owes ' + money(o.dues)].filter(Boolean).map(esc).join(' · ');
    return `<div class="p7-mem ${m.paid ? 'paid' : ''} ${sel ? 'sel' : ''} ${TH.state.p7just === m.name ? 'just' : ''}">
      ${m.you ? `<span class="p7-cb-sp"></span>` : `<label class="p7-cb"><input type="checkbox" data-p7sel="${key}" ${sel ? 'checked' : ''} aria-label="Select ${esc(bare(m.name))}"><i></i></label>`}
      ${avatar(m)}<span class="p7-mm"><b>${esc(bare(m.name))}${m.you ? ' <span class="p7-you">you</span>' : ''}</b><span>${sub}</span></span>
      ${m.you ? (m.paid ? `<span class="p7-paid on">${icon('check')}Paid</span>` : `<button class="p7-paid" data-club="${esc(org.id)}">Pay</button>`) : `<button class="p7-paid ${m.paid ? 'on' : ''}" data-p7pay="${key}" aria-pressed="${m.paid}" aria-label="${esc(bare(m.name))}: ${m.paid ? 'paid. Tap to mark unpaid' : 'unpaid. Tap to mark paid'}">${m.paid ? icon('check') + 'Paid' : 'Unpaid'}</button><button class="p7-del" data-p7del="${key}" aria-label="Remove ${esc(bare(m.name))}">${icon('trash')}</button>`}</div>`;
  }
  function listHTML(org) {
    const ms = filtered(org); if (!ms.length) return `<div class="p7-clear">${icon('users')}<b>No one matches</b><span>Try another filter or name.</span></div>`;
    const off = ms.filter(m => m.role && m.role !== 'Member'), mem = ms.filter(m => !m.role || m.role === 'Member');
    const grp = (l, t) => l.length ? `<div class="p7-grp">${t} — ${l.length}</div>${l.map(m => memRow(org, m)).join('')}` : '';
    return grp(off, 'Officers') + grp(mem, 'Members');
  }
  function bulkHTML(org) {
    const s = SEL(), n = s.size; if (!n) return '';
    const anyUn = roster(org).some(m => s.has(m.name) && !m.paid);
    return `<div class="p7-bulk" role="toolbar" aria-label="${n} selected"><b>${n} selected</b><button class="btn sm" data-p7b="msg">${icon('chat')} Message</button>${anyUn ? `<button class="btn sm line" data-p7b="remind">${icon('bell')} Remind</button><button class="btn sm line" data-p7b="paid">${icon('check')} Mark paid</button>` : ''}<button class="iconbtn flat" data-p7b="clear" aria-label="Clear selection">${icon('x')}</button></div>`;
  }
  TH.screens.orgpeople = {
    render() {
      const org = XO().cur();
      if (!isClub(org)) return shell('orgpeople', `<div class="rows">${TH.x.row('data-go="orginbox"', 'flag', 'Inbox', 'Problem reports and questions Tommy couldn’t answer', 'var(--c-safety)')}</div>`);
      const F = MF(), ms = roster(org), tt = totals(org), o = XO().O(org), le = lastEvent(org), at = attendees(org, le), vp = venmoPending(org);
      const years = YEARS.filter(y => ms.some(m => m.year === y));
      // drop selections of people no longer on the roster
      const names = new Set(ms.map(m => m.name)); [...SEL()].forEach(n => { if (!names.has(n)) SEL().delete(n); });
      return shell('orgpeople', `
        <div class="p7-quick">
          <button class="p7-qa" id="p7-remind" ${tt.unpaid ? '' : 'disabled'}>${icon('bell')}<b>Remind all unpaid</b><span>${tt.unpaid ? `${tt.unpaid} owe ${money(o.dues)}` : 'Everyone has paid'}</span></button>
          <button class="p7-qa" id="p7-msgatt" ${at.length ? '' : 'disabled'}>${icon('chat')}<b>Message attendees</b><span>${le ? `${at.length} at ${esc(le.title)}` : 'After your first event'}</span></button>
          <button class="p7-qa" id="p7-venmo">${icon('dollar')}<b>${o.venmo && o.venmo.on ? 'Check Venmo' : 'Link Venmo'}</b><span>${o.venmo && o.venmo.on ? (vp.length ? `${plural(vp.length, 'payment')} to match` : `checked ${ago(o.venmo.at)}`) : 'Match payments to members'}</span></button>
        </div>
        <div class="p7-tools">
          <div class="p7-search">${icon('search')}<input id="p7-q" type="search" placeholder="Search ${plural(ms.length, 'member')}" aria-label="Search members" autocomplete="off" value="${esc(F.q)}"></div>
          <button class="btn sm" id="p7-add">${icon('plus')} Add</button>
        </div>
        <div class="p7-chips" role="group" aria-label="Paid status">${[['all', 'All', ms.length], ['paid', 'Paid', tt.paid], ['unpaid', 'Unpaid', tt.unpaid]].map(([k, l, n]) => `<button data-p7pf="${k}" aria-pressed="${F.pay === k}">${l}<b>${n}</b></button>`).join('')}</div>
        <div class="p7-chips scroll" role="group" aria-label="Year"><button data-p7yf="all" aria-pressed="${F.year === 'all'}">Any year</button>${years.map(y => `<button data-p7yf="${esc(y)}" aria-pressed="${F.year === y}">${esc(y)}</button>`).join('')}</div>
        <div class="p7-selall"><label class="p7-cb"><input type="checkbox" id="p7-all" aria-label="Select everyone shown"><i></i></label><span>Select everyone shown</span><button class="p7-tbtn" id="p7-tm-unpaid">${icon('sparkle')}Who hasn’t paid?</button></div>
        <div class="p7-roster" id="p7-list" aria-live="polite">${listHTML(org)}</div>
        <div id="p7-bulk">${bulkHTML(org)}</div>
        ${P(org).msgs.length ? `<div class="section"><div class="section-head"><h2>Messages you sent</h2></div><div class="rows">${P(org).msgs.slice(0, 4).map(m => `<div class="row" style="--rc:var(--c-fitness)"><span class="rico">${icon('chat')}</span><span class="rmain"><span class="rtitle wrap">${esc(m.text.slice(0, 80))}</span><span class="rsub wrap">To ${plural(m.to.length, 'member')} · ${ago(m.at)}</span></span></div>`).join('')}</div></div>` : ''}
        ${sim(`Sample roster: names, years and payments are generated for this demo, not ${esc(org.name)}’s real records. Adds, removals, paid marks, reminders and messages are simulated and saved on this device. Attendance is a sample check-in list.`)}`);
    },
    mount(host) {
      const org = XO().cur(); if (!isClub(org)) return;
      const F = MF(), list = $('#p7-list', host), bulk = $('#p7-bulk', host);
      const refresh = () => { list.innerHTML = listHTML(org); bulk.innerHTML = bulkHTML(org); const all = $('#p7-all', host), vis = filtered(org).filter(m => !m.you); all.checked = vis.length > 0 && vis.every(m => SEL().has(m.name)); };
      refresh();
      $('#p7-q', host).addEventListener('input', e => { F.q = e.target.value; refresh(); });
      host.addEventListener('click', e => {
        const pf = e.target.closest('[data-p7pf]'), yf = e.target.closest('[data-p7yf]'), pb = e.target.closest('[data-p7pay]'), db = e.target.closest('[data-p7del]'), bb = e.target.closest('[data-p7b]');
        if (pf) { F.pay = pf.dataset.p7pf; TH.render(true); }
        else if (yf) { F.year = yf.dataset.p7yf; TH.render(true); }
        else if (pb) togglePaid(org, pb.dataset.p7pay);
        else if (db) removeSheet(org, db.dataset.p7del);
        else if (bb) {
          const k = bb.dataset.p7b, ms = roster(org).filter(m => SEL().has(m.name));
          if (k === 'clear') { SEL().clear(); refresh(); } else if (k === 'msg') messageSheet(org, ms, 'Selected members'); else if (k === 'remind') remindSheet(org, ms.filter(m => !m.paid)); else if (k === 'paid') bulkPaid(org, ms.filter(m => !m.paid));
        }
      });
      host.addEventListener('change', e => {
        const c = e.target.closest('[data-p7sel]');
        if (c) { c.checked ? SEL().add(c.dataset.p7sel) : SEL().delete(c.dataset.p7sel); c.closest('.p7-mem').classList.toggle('sel', c.checked); bulk.innerHTML = bulkHTML(org); }
        else if (e.target.id === 'p7-all') { filtered(org).filter(m => !m.you).forEach(m => e.target.checked ? SEL().add(m.name) : SEL().delete(m.name)); refresh(); }
      });
      $('#p7-remind', host).onclick = () => remindSheet(org, totals(org).un);
      $('#p7-msgatt', host).onclick = () => { const le = lastEvent(org); messageSheet(org, attendees(org, le), le ? `Everyone at ${le.title}` : 'Attendees'); };
      $('#p7-venmo', host).onclick = () => venmoCheck(org);
      $('#p7-add', host).onclick = () => addSheet(org);
      $('#p7-tm-unpaid', host).onclick = () => tommyUnpaid(org);
    },
  };

  // ---------- roster actions (Part 6 add/remove + paid toggles, same TH.H().x.orgs maps as js/hub2b.js) ----------
  function flash(name) { TH.state.p7just = name; TH.render(true); TH.state.p7just = null; }
  function setPaid(o, name, to, via) {
    const prev = { paid: o.paid[name], at: o.paidAt[name], amt: o.paidAmt[name], via: o.via[name] };
    o.paid[name] = to;
    if (to) { o.paidAt[name] = clockMs(); o.paidAmt[name] = o.dues; o.via[name] = via || 'marked by you'; } else { delete o.paidAt[name]; delete o.paidAmt[name]; }
    return () => [['paid', 'paid'], ['paidAt', 'at'], ['paidAmt', 'amt'], ['via', 'via']].forEach(([k, pk]) => { if (prev[pk] === undefined) delete o[k][name]; else o[k][name] = prev[pk]; });
  }
  function togglePaid(org, name) {
    const o = XO().O(org), m = roster(org).find(x => x.name === name); if (!m || m.you) return;
    const to = !m.paid, undo = setPaid(o, name, to);
    TH.commit(to ? `Marked ${name} paid: ${money(o.dues)} dues to ${org.name} (simulated)` : `Marked ${name} unpaid in ${org.name} (simulated)`);
    flash(name); undoToast(to ? `${name} paid ${money(o.dues)}. Added to the members chat.` : `${name} marked unpaid`, to ? 'dollar' : 'clock', () => { undo(); save(); TH.render(true); });
  }
  function bulkPaid(org, ms) {
    const o = XO().O(org); if (!ms.length) return; const undos = ms.filter(m => !m.you).map(m => setPaid(o, m.name, true));
    TH.commit(`Marked ${plural(undos.length, 'member')} paid in ${org.name} (simulated)`); SEL().clear(); TH.render(true);
    undoToast(`${plural(undos.length, 'member')} marked paid`, 'dollar', () => { undos.forEach(u => u()); save(); TH.render(true); });
  }
  function venmoCheck(org) {
    const o = XO().O(org), p = P(org);
    if (!o.venmo || !o.venmo.on) { o.venmo = Object.assign(o.venmo || {}, { on: true, at: Date.now() }); save(); TH.toast('Venmo linked (simulated). Tap Check Venmo to match payments.', 'link'); TH.render(true); return; }
    const vp = venmoPending(org); o.venmo.at = Date.now();
    if (!vp.length) { save(); TH.render(true); return TH.toast('No new Venmo payments to match (simulated)', 'dollar'); }
    const undos = vp.map(m => { p.venmoFeed[m.name] = Date.now(); return setPaid(o, m.name, true, 'Venmo'); });
    TH.commit(`Matched ${plural(vp.length, 'Venmo payment')} to members of ${org.name}: ${vp.map(m => m.name).join(', ')} (simulated)`);
    TH.render(true);
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${icon('dollar')} Venmo ${esc(o.venmo.handle || '')}</span><h2>Matched ${plural(vp.length, 'payment')}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p7-matched">${vp.map(m => `<div>${avatar(Object.assign({}, m, { paid: true }))}<span><b>${esc(m.name)}</b><small>${money(o.dues)} · matched by name</small></span>${icon('check')}</div>`).join('')}</div>
      <p class="muted" style="font-size:13px;margin:0">All ${plural(vp.length, 'member')} are marked paid and added to the members chat.</p>
      <div class="btn-row"><button class="btn line" id="p7v-undo">Undo</button><button class="btn" data-close>Done</button></div>
      ${sim('Simulated Venmo feed on the demo account. Trojan Hub doesn’t connect to Venmo.')}</div>`, w => {
      $('#p7v-undo', w).onclick = () => { undos.forEach(u => u()); vp.forEach(m => { delete p.venmoFeed[m.name]; }); save(); TH.closeSheet(); TH.render(true); TH.toast('Venmo matches undone', 'swap'); };
    });
  }
  function remindSheet(org, un) {
    const o = XO().O(org); if (!un || !un.length) return TH.toast('Everyone selected has paid', 'check');
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${money(o.dues)} dues · ${money(un.length * o.dues)} outstanding</span><h2>Remind ${plural(un.length, 'member')}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p7-to">${un.map(m => `<span>${esc(bare(m.name))}</span>`).join('')}</div>
      <div class="field"><label for="p7r-msg">Message</label><textarea id="p7r-msg" rows="4" maxlength="500">Hi! Friendly reminder from ${esc(org.name)}: dues are ${money(o.dues)} this semester. Pay in Trojan Hub${o.venmo && o.venmo.on ? ` or on Venmo ${esc(o.venmo.handle)}` : ''} and you’re in the members chat right away. Fight on! ${esc(TH.student().first)}</textarea></div>
      <button class="btn block" id="p7r-send">${icon('bell')} Send to ${plural(un.length, 'member')}</button>
      ${sim('Simulated: the reminder goes out in the app on this demo account. Nothing is emailed.')}</div>`, w => {
      $('#p7r-send', w).onclick = () => {
        o.reminded = Date.now(); P(org).msgs.unshift({ to: un.map(m => m.name), text: $('#p7r-msg', w).value, at: Date.now(), kind: 'remind' });
        TH.commit(`Sent a dues reminder to ${plural(un.length, 'member')} of ${org.name} (simulated)`);
        if (un.some(m => m.you)) note('dues', `Dues reminder: ${org.name}`, `${money(o.dues)} for this semester. Pay in the app to join the members chat.`, 'clubs:' + org.id);
        SEL().clear(); TH.closeSheet(); TH.render(true); TH.toast(`Reminder sent to ${plural(un.length, 'member')} (simulated)`, 'bell');
      };
    });
  }
  function messageSheet(org, ms, label) {
    if (!ms || !ms.length) return TH.toast('No one to message yet', 'alert');
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${esc(label)}</span><h2>Message ${plural(ms.length, 'member')}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p7-to">${ms.map(m => `<span>${esc(bare(m.name))}</span>`).join('')}</div>
      <div class="field"><label for="p7m-msg">Message</label><textarea id="p7m-msg" rows="4" maxlength="500" placeholder="Thanks for coming! Slides are in #general."></textarea></div>
      <button class="btn block" id="p7m-send">${icon('send')} Send</button>
      ${sim('Simulated: sent as an in-app message on this demo account. Nothing leaves this device.')}</div>`, w => {
      $('#p7m-send', w).onclick = () => {
        const t = $('#p7m-msg', w).value.trim(); if (t.length < 2) return TH.toast('Write a message first', 'alert');
        P(org).msgs.unshift({ to: ms.map(m => m.name), text: t, at: Date.now(), kind: 'msg' });
        TH.commit(`Messaged ${plural(ms.length, 'member')} of ${org.name} (simulated)`); SEL().clear(); TH.closeSheet(); TH.render(true); TH.toast(`Sent to ${plural(ms.length, 'member')} (simulated)`, 'send');
      };
    });
  }
  function addSheet(org) {
    const o = XO().O(org); let role = 'Member';
    TH.sheet(`<div class="stack p7-form"><div class="sheet-head"><div><span class="eyebrow">${esc(org.name)}</span><h2>Add a member</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="p7am-name">Name</label><input id="p7am-name" autocomplete="off" maxlength="40" placeholder="e.g. Alex Kim"></div>
      <div class="field"><label for="p7am-email">USC email</label><input id="p7am-email" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="ttrojan@usc.edu"></div>
      <div class="field"><span class="flabel">Role</span><div class="p7-chips wrap" role="group" aria-label="Role">${ROLES.map(r => `<button type="button" data-p7role="${esc(r)}" aria-pressed="${r === role}">${esc(r)}</button>`).join('')}</div></div>
      <div class="field"><label for="p7am-year">Year</label><select id="p7am-year">${YEARS.map(y => `<option>${y}</option>`).join('')}</select></div>
      ${o.dues ? `<label class="p7-check"><input type="checkbox" id="p7am-paid"><span><b>Already paid ${money(o.dues)}</b><span>Marks them paid today</span></span></label>` : ''}
      <span class="ferr" id="p7am-err" aria-live="polite"></span>
      <button class="btn block" id="p7am-ok">${icon('plus')} Add member</button>
      ${sim('Simulated: added to this demo roster on your device only. No email is sent.')}</div>`, w => {
      w.addEventListener('click', e => { const r = e.target.closest('[data-p7role]'); if (!r) return; role = r.dataset.p7role; $$('[data-p7role]', w).forEach(b => b.setAttribute('aria-pressed', String(b === r))); });
      $('#p7am-ok', w).onclick = () => {
        const name = $('#p7am-name', w).value.trim().replace(/\s+/g, ' '), email = $('#p7am-email', w).value.trim().toLowerCase(), ms = roster(org), er = $('#p7am-err', w);
        const bad = name.length < 2 || !/[a-z]/i.test(name) ? 'Add their name (at least 2 letters).' : ms.some(m => bare(m.name).toLowerCase() === name.toLowerCase()) ? `${name} is already on the roster.` : !USC_EMAIL.test(email) ? 'Use a USC email that ends in @usc.edu.' : ms.some(m => (m.email || '').toLowerCase() === email) ? 'Someone already uses that email.' : '';
        if (bad) { er.textContent = bad; return; }
        const paid = !!($('#p7am-paid', w) || {}).checked, rec = { name, email, role, year: $('#p7am-year', w).value, at: clockMs() };
        const prev = ['role', 'paid', 'paidAt', 'paidAmt', 'via'].reduce((a, k) => { a[k] = Object.prototype.hasOwnProperty.call(o[k], name) ? o[k][name] : undefined; return a; }, {});
        o.added.push(rec); o.role[name] = role; o.paid[name] = paid;
        if (paid) { o.paidAt[name] = rec.at; o.paidAmt[name] = o.dues; o.via[name] = 'marked by you'; } else { delete o.paidAt[name]; delete o.paidAmt[name]; delete o.via[name]; }
        TH.commit(`Added ${name} (${role}) to ${org.name}${paid ? `, dues ${money(o.dues)} marked paid` : ''} (simulated roster)`);
        TH.closeSheet(); MF().q = ''; flash(name);
        undoToast(`${name} added. Welcome aboard!`, 'users', () => { o.added = o.added.filter(x => x !== rec); Object.keys(prev).forEach(k => { if (prev[k] === undefined) delete o[k][name]; else o[k][name] = prev[k]; }); save(); TH.render(true); });
      };
    });
  }
  function removeSheet(org, name) {
    const o = XO().O(org), m = roster(org).find(x => x.name === name); if (!m || m.you) return;
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${esc(org.name)}</span><h2>Remove ${esc(name.split(' ')[0])}?</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p7-who">${avatar(m)}<span><b>${esc(name)}</b><span class="muted">${esc([m.role, m.year, m.email].filter(Boolean).join(' · '))}</span></span></div>
      <p class="muted" style="font-size:13.5px;margin:0">They leave the roster and the members chat. You can undo right after.</p>
      <div class="btn-row"><button class="btn line" data-close>Keep</button><button class="btn" id="p7rm-ok" style="background:var(--risk-high);color:#fff">${icon('trash')} Remove</button></div>
      ${sim('Simulated roster on the demo account. Nothing is sent to the member.')}</div>`, w => {
      $('#p7rm-ok', w).onclick = () => {
        let undo;
        if (m.added) { const rec = o.added.find(x => x.name === name), i = o.added.indexOf(rec); o.added.splice(i, 1); undo = () => o.added.splice(Math.min(i, o.added.length), 0, rec); }
        else { if (!o.removed.includes(name)) o.removed.push(name); undo = () => { o.removed = o.removed.filter(x => x !== name); }; }
        SEL().delete(name); TH.commit(`Removed ${name} from ${org.name} (simulated roster)`); TH.closeSheet(); TH.render(true);
        undoToast(`${name} removed`, 'trash', () => { undo(); save(); flash(name); });
      };
    });
  }

  // =====================================================================
  // MONEY
  // =====================================================================
  TH.screens.orgmoney = {
    render() {
      const org = XO().cur();
      if (!isClub(org)) return shell('orgmoney', `<div class="empty">${icon('dollar')}<b>Money is for clubs</b><span>USC offices don’t collect dues here.</span></div>`);
      const o = XO().O(org), tt = totals(org), base = tt.collected + tt.outstanding, pc = base ? Math.round(tt.collected / base * 100) : 0, vp = venmoPending(org);
      const evs = myEvents(org), spent = evs.filter(e => e.cost != null), upc = evs.filter(e => !e.doneAt), facts = budgetFacts(org);
      const spentT = spent.reduce((s, e) => s + e.cost, 0), upT = upc.reduce((s, e) => s + (estCost(org, e) || 0), 0);
      return shell('orgmoney', `
        <div class="card p7-dues"><div class="p7-dtot"><div><span>Collected</span><b>${money(tt.collected)}</b><small>${tt.paid} of ${tt.n} paid</small></div><div class="out"><span>Outstanding</span><b>${money(tt.outstanding)}</b><small>${tt.unpaid ? `${plural(tt.unpaid, 'member')} · ${money(o.dues)} each` : 'All paid up!'}</small></div></div>
          <div class="p7-bar" role="img" aria-label="${pc}% of dues collected"><i style="width:${pc}%"></i></div>
          <div class="p7-row2"><button class="btn block sm" id="p7-mremind" ${tt.unpaid ? '' : 'disabled'}>${icon('bell')} Remind ${tt.unpaid} unpaid</button><button class="btn line block sm" id="p7-mvenmo">${icon('dollar')} ${o.venmo && o.venmo.on ? (vp.length ? `Match ${vp.length} Venmo` : 'Check Venmo') : 'Link Venmo'}</button></div>
          <button class="p7-tbtn" id="p7-mtm">${icon('sparkle')}Who hasn’t paid?</button></div>
        <div class="section"><div class="section-head"><h2>Event costs</h2><span class="muted tiny">${money(spentT)} logged</span></div>
          ${evs.length ? `<div class="rows">${evs.map(e => { const c = e.cost != null ? money(e.cost) : estCost(org, e) != null ? `~${money(estCost(org, e))}` : '—'; return `<div class="row" style="--rc:var(--ok)"><span class="rico">${icon(e.doneAt ? 'check' : 'calendar')}</span><span class="rmain"><span class="rtitle wrap">${esc(e.title)}</span><span class="rsub wrap">${esc(fmtWhen(e))} · ${e.doneAt ? `${e.att} came` : 'upcoming'}</span></span><span class="rside"><b>${c}</b>${e.cost == null ? est() : ''}</span></div>`; }).join('')}</div>
            ${upT ? `<span class="muted tiny">Upcoming events: about ${money(upT)} ${est()} at last semester’s sample cost per attendee.</span>` : ''}` : `<p class="muted">Costs you log when an event is done show here.</p>`}</div>
        <div class="section"><div class="section-head"><h2>Budget read</h2><button data-go="orgbudget">Full budget</button></div>
          <div class="x-ai"><span class="eyebrow">${icon('sparkle')} Tommy on your budget</span><ul>${facts.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join('')}</ul><button class="linkbtn" id="p7-mbud" style="color:var(--cardinal-ink);font-weight:650">How is our budget?</button></div></div>
        ${sim('Dues, Venmo matches and the ledger are sample data and simulated on this device. Costs you type are saved on this device.')}`);
    },
    mount(host) {
      const org = XO().cur(); if (!isClub(org)) return;
      $('#p7-mremind', host).onclick = () => remindSheet(org, totals(org).un);
      $('#p7-mvenmo', host).onclick = () => venmoCheck(org);
      $('#p7-mtm', host).onclick = () => tommyUnpaid(org);
      $('#p7-mbud', host).onclick = () => tommyBudget(org);
    },
  };

  // =====================================================================
  // MORE: club settings, switch to student view, account, help
  // =====================================================================
  TH.screens.orgmore = {
    render() {
      const org = XO().cur(), all = XO().orgs(), club = isClub(org), o = XO().O(org), p = club ? P(org) : null, st = TH.student();
      const R = (attrs, ic, t, sub, color) => TH.x.row(attrs, ic, t, sub, color);
      return `<div class="screen p7">${TH.ui.topbar('Club menu', true)}<div class="pad screen-body stack">${head(org)}
        ${all.length > 1 ? `<div class="field"><label for="p7-org">You’re running</label><select id="p7-org">${all.map(x => `<option value="${esc(x.id)}" ${x.id === org.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.role)}</option>`).join('')}</select></div>` : ''}
        ${club ? `<div class="section"><div class="section-head"><h2>Club settings</h2></div><div class="rows">
          ${R('id="p7-set-dues"', 'dollar', 'Dues', `${money(o.dues)} per semester`, 'var(--ok)')}
          ${R('id="p7-set-venmo"', 'link', 'Venmo', o.venmo && o.venmo.on ? `Linked · ${esc(o.venmo.handle)} (simulated)` : 'Not linked', '#008cff')}
          ${R('id="p7-set-luma"', 'calendar', 'Luma calendar', p.luma.url ? `Linked · ${esc(p.luma.url.replace(/^https?:\/\//, ''))}` : 'Not linked', 'var(--c-study)')}
          ${R(`data-club="${esc(org.id)}"`, 'club', 'Club profile', 'What students see: about, events, dues, join', 'var(--c-landmark)')}
        </div></div>` : ''}
        <div class="rows">
          ${R('data-go="home"', 'swap', 'Switch to student view', 'Your classes, My Day, clubs you joined', 'var(--cardinal)')}
          ${R('data-go="profile"', 'user', 'Account', `${esc(st.full)} · profile and sharing settings`, 'var(--c-fitness)')}
          ${R('id="p7-learnrow"', 'sparkle', 'Tommy is learning', 'Tools Tommy proposes from questions it couldn’t answer', 'var(--c-study)')}
          ${R('id="p7-help"', 'info', 'Help', 'How the club view works · ask Tommy', 'var(--gold-ink)')}
        </div>
        ${sim('Club settings here are simulated on the demo account.')}</div></div>`;
    },
    mount(host) {
      const org = XO().cur(), s = $('#p7-org', host);
      if (s) s.onchange = () => { TH.state.xorg = s.value; SEL().clear(); TH.render(); };
      const d = $('#p7-set-dues', host); if (d) d.onclick = () => duesSheet(org);
      const v = $('#p7-set-venmo', host); if (v) v.onclick = () => venmoSheet(org);
      const l = $('#p7-set-luma', host); if (l) l.onclick = () => lumaSheet(org);
      $('#p7-learnrow', host).onclick = learningSheet;
      $('#p7-help', host).onclick = () => TH.sheet(`<div class="stack"><div class="sheet-head"><h2>How the club view works</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="p7-help">${[['grid', 'Today', 'The three things that need a decision, each with its next step.'], ['calendar', 'Plan', 'Every event moves Requested → Scheduled → Announced → Done. Requests, rooms and attendee insights live here too.'], ['users', 'People', 'Your roster: filter, search, select, then remind or message in one go. Members chat is here.'], ['megaphone', 'Promote', 'Announce events, write the newsletter, link your Luma calendar.'], ['dollar', 'Money', 'Dues, Venmo matching, event costs and the budget.']].map(([ic, t, s]) => `<div>${icon(ic)}<span><b>${t}</b>${s}</span></div>`).join('')}</div>
        <p class="muted" style="font-size:13px;margin:0">Look for the ${icon('sparkle')} Tommy buttons where the work is. Everything here runs on sample data and is simulated on the demo account.</p>
        <button class="btn block" id="p7-help-tm">${icon('sparkle')} Ask Tommy</button></div>`, w => { $('#p7-help-tm', w).onclick = () => { TH.closeSheet(); TH.go('orgtommy'); }; });
    },
  };
  function duesSheet(org) {
    const o = XO().O(org);
    TH.sheet(`<div class="stack"><div class="sheet-head"><h2>Dues per semester</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="p7du">Amount ($)</label><input id="p7du" type="number" min="0" max="500" step="1" inputmode="numeric" value="${o.dues}"></div>
      <span class="muted tiny">Payments already made keep their amount.</span><button class="btn block" id="p7du-ok">Save</button></div>`, w => {
      $('#p7du-ok', w).onclick = () => { const v = Math.max(0, Math.min(500, Math.round(+$('#p7du', w).value || 0))); roster(org).forEach(m => { if (m.paid && o.paidAmt[m.name] == null) o.paidAmt[m.name] = m.amt; }); o.dues = v; TH.commit(`Set ${org.name} dues to ${money(v)} (simulated)`); TH.closeSheet(); TH.render(true); TH.toast(`Dues set to ${money(v)} per semester`, 'dollar'); };
    });
  }
  function venmoSheet(org) {
    const o = XO().O(org), on = o.venmo && o.venmo.on;
    TH.sheet(`<div class="stack"><div class="sheet-head"><h2>Venmo</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="p7vm">Club Venmo handle</label><input id="p7vm" maxlength="40" value="${esc((o.venmo && o.venmo.handle) || '@')}"></div>
      <button class="btn block" id="p7vm-ok">${on ? 'Save' : 'Link Venmo'}</button>${on ? `<button class="btn line block" id="p7vm-off">Unlink</button>` : ''}
      ${sim('Simulated. Trojan Hub doesn’t connect to Venmo; matches are sample data.')}</div>`, w => {
      $('#p7vm-ok', w).onclick = () => { const h = $('#p7vm', w).value.trim(); o.venmo = Object.assign(o.venmo || {}, { on: true, handle: /^@/.test(h) ? h : '@' + h, at: o.venmo && o.venmo.at || Date.now() }); save(); TH.closeSheet(); TH.render(true); TH.toast('Venmo saved (simulated)', 'link'); };
      const off = $('#p7vm-off', w); if (off) off.onclick = () => { o.venmo.on = false; save(); TH.closeSheet(); TH.render(true); TH.toast('Venmo unlinked', 'link'); };
    });
  }

  // let other files (and tests) reach the redesign
  TH.p7 = { aiDraft, aiLearning, announcePayload, summaryPayload, JOBS, JOB_OF, decisions, openSchedule, announceSheet, doneSheet, venmoCheck, remindSheet, messageSheet, lumaSheet, myEvents, stageOf, P };
})(window.TH = window.TH || {});
