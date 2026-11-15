/* js/p6-order.js — Part 6, order agent: a clear, fun pickup ETA for mobile order-ahead.
 *
 * TH.orderEta = { waitAt, busy, walk, eta, card, mini, sheetHero, slotHTML, howItWorks, quip }
 * Used by the Food screen (js/screens.js: order card, venue rows, order sheet), wrapped onto Home ("Your plans
 * now") and My Day (TH.dayItems) below.
 *
 * Truthfulness: USC publishes no live kitchen data. Kitchen waits come from ONE estimate model, TH.kitchenWait in
 * js/core.js (per venue per 30-min pickup window on a meal-time curve, labeled Est.), so the venue list, the sheet,
 * the slot chips and the order card always agree. Orders themselves are simulated on the demo account, and the
 * "being made" phase is sped up for the demo (about 25 s, the same timer as app.js tickSims), so the countdown
 * says so. Walk minutes come from TH.route (from TH.ME, the demo student's spot at Tutor Campus Center).
 */
(function (TH) {
  'use strict';
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c), fmtMin = m => TH.fmtMin(m);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const now = () => TH.clock.now(), nowMin = () => TH.minOfDay(now()), today = () => TH.dayStart(now());
  const hasTA = () => !!(window.TA && TA.State && TA.State.d);
  const hub = () => (hasTA() ? TH.H() : { orders: [] });
  const place = id => (TH.byId || {})[id] || null;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const PREP_MS = 25000; // keep in step with tickSims in js/app.js (preparing → ready after 25 s, simulated)
  const est = () => (TH.ui && TH.ui.est ? TH.ui.est() : '<span class="est">Est.</span>');
  const ui = () => TH.state || (TH.state = {});
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------------------------------------------------------------------------
  // ESTIMATES
  // ---------------------------------------------------------------------------
  const atMin = m => { const d = new Date(today()); d.setMinutes(m); return d; };
  // Earliest pickup window from now (minute of day), or null when there is none left today.
  const firstWin = p => { if (!p || !TH.pickupWindows) return null; const w = TH.pickupWindows(p, now(), 1)[0]; return w == null ? null : w; };
  // Estimated kitchen wait (min) for a pickup window (minute of day). m == null: the earliest window from now,
  // the number the venue list shows and the sheet leads with. One source: TH.kitchenWait (js/core.js).
  function waitAt(p, m) {
    if (!p) return null;
    if (m == null) { m = firstWin(p); if (m == null) return null; }
    return TH.kitchenWait ? TH.kitchenWait(p, atMin(m)) : 6 + hash(p.id + Math.floor(m / 30)) % 6;
  }
  // Beyond this many minutes, say the clock time ("Ready around 7:08 AM") instead of a minute count.
  const LONG = 60;
  const clockHTML = m => { const [t, ap] = fmtMin(m).split(' '); return `${t}${ap ? `<small> ${ap}</small>` : ''}`; };
  const LEVELS = [
    { max: 5, label: 'Chill', tone: 'ok', bars: 1, line: 'Barely a line' },
    { max: 8, label: 'Steady', tone: 'mid', bars: 2, line: 'A few orders ahead' },
    { max: 11, label: 'Busy', tone: 'warn', bars: 3, line: 'Lunch-rush energy' },
    { max: 99, label: 'Slammed', tone: 'bad', bars: 4, line: 'Packed kitchen' },
  ];
  function busy(w) { const L = LEVELS.find(l => (w || 0) <= l.max) || LEVELS[3]; return Object.assign({ ahead: Math.max(1, Math.round((w || 6) / 1.8)) }, L); }
  const gauge = b => `<span class="p6o-gauge ${b.tone}" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= b.bars ? 'on' : ''}"></i>`).join('')}</span>`;

  // Walk minutes from where the demo student is (TH.ME) using the campus walking graph; cached per venue.
  const walkCache = {};
  function walk(p) {
    if (!p) return 3;
    if (walkCache[p.id] == null) {
      let m = null; try { const r = TH.route && TH.ME ? TH.route(TH.ME, p, { mode: 'fast' }) : null; m = r && r.minutes; } catch (e) { m = null; }
      walkCache[p.id] = Math.max(1, Math.round(m || (TH.ui && TH.ui.walkMin ? TH.ui.walkMin(p) : 3)));
    }
    return walkCache[p.id];
  }

  // ---------------------------------------------------------------------------
  // PLAYFUL COPY (generic and venue-flavored; no menu claims: the items are samples)
  // ---------------------------------------------------------------------------
  const ITEM_LINES = [
    [/coffee|latte|espresso/i, ['Your coffee is getting its foam on', 'Grinding beans, just for you', 'Steaming the milk just right']],
    [/\btea\b/i, ['Your tea is steeping', 'Water at the perfect temp', 'Almost steeped']],
    [/pastry/i, ['Warming up your pastry', 'Flaky things take a sec']],
    [/sandwich/i, ['Your sandwich is getting pressed', 'Stacking it up']],
  ];
  const VENUE_LINES = {
    cgjuice: ['Your juice is getting squeezed', 'The blender is doing its thing'],
    burgercrush: ['Your burger is sizzling', 'Toasting the bun'],
    tacotaco: ['Tortillas are hitting the griddle', 'Wrapping it up'],
    slice: ['Your slice is getting toasty', 'Cheese getting melty'],
    panda: ['The wok is fired up', 'Tossing it in the wok'],
    bowls: ['Your bowl is being built', 'Layering it up'],
    seeds: ['Your order is coming together', 'Bagging it up'],
  };
  const GENERIC = ['The kitchen is on it', 'Plating it up with care', 'Almost there, hang tight'];
  function quip(o, stage) {
    if (stage === 2) return /coffee|tea/i.test((o.items || []).map(i => i[0]).join(' ')) ? 'Still steaming on the pickup shelf. Go get it!' : 'Hot and waiting on the pickup shelf. Go get it!';
    const its = (o.items || []).map(i => i[0]).join(' '), hit = ITEM_LINES.find(([re]) => re.test(its));
    const lines = (hit && hit[1]) || VENUE_LINES[o.at] || GENERIC;
    return lines[Math.floor(Date.now() / 4000) % lines.length];
  }
  const venueIcon = o => /coffee|tea/i.test((o.items || []).map(i => i[0]).join(' ')) || /grounds|literatea|cafe|café|coffee/i.test(o.at + ' ' + ((place(o.at) || {}).name || '')) ? 'cup' : 'bag';

  // ---------------------------------------------------------------------------
  // ETA for an order on the demo account
  // stage 0 placed (waiting for "I'm here") · 1 being made · 2 ready · 3 picked up
  // ---------------------------------------------------------------------------
  function eta(o) {
    const p = place(o.at), nm = nowMin(), wk = walk(p), prep = waitAt(p, o.window) || 6, b = busy(prep);
    if (o.state === 'picked') return { stage: 3, p, wk, prep, busy: b, frac: 1, mins: 0 };
    if (o.state === 'ready') return { stage: 2, p, wk, prep, busy: b, frac: 1, mins: 0 };
    if (o.state === 'preparing') {
      const f = clamp((Date.now() - (o.hereAt || Date.now())) / PREP_MS), left = Math.max(0, Math.ceil(prep * (1 - f) - 1e-9));
      return { stage: 1, p, wk, prep, busy: b, frac: Math.max(0.04, f), mins: left, readyAt: nm + left };
    }
    const start = Math.max(o.window, nm), readyAt = start + prep, placedMin = o.placedMin != null && o.placedMin <= nm ? o.placedMin : nm - (Date.now() - (o.placedAt || Date.now())) / 6e4;
    const frac = clamp((nm - placedMin) / Math.max(1, readyAt - placedMin), 0.04, 0.96);
    return { stage: 0, p, wk, prep, busy: b, frac, mins: Math.max(1, readyAt - nm), readyAt, win: o.window, leaveBy: o.window - wk, hereFrom: o.window - 30, canHere: nm >= o.window - 30, late: nm > o.window + 10, goNow: nm >= o.window - wk && nm <= o.window + 10 };
  }
  // Ring inner for the Home mini tracker before the kitchen starts: minutes, or the clock time for a far-off pickup
  const miniNum = e => e.mins > LONG ? (() => { const [t, ap] = fmtMin(e.readyAt).split(' '); return `<b>${t}</b><small>${ap || ''}</small>`; })() : `<b>${e.mins}</b><small>min</small>`;

  // ---------------------------------------------------------------------------
  // PIECES
  // ---------------------------------------------------------------------------
  const ring = (frac, inner, cls = '') => `<span class="p6o-ring ${cls}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="trk" cx="22" cy="22" r="19" pathLength="100"/><circle class="bar" cx="22" cy="22" r="19" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - Math.round(clamp(frac) * 100)}"/></svg><span class="in">${inner}</span></span>`;
  const STAGES = ['Placed', 'Being made', 'Ready', 'Picked up'];
  const steps = stage => `<ol class="p6o-steps" aria-label="Order progress: ${esc(STAGES[stage])}">${STAGES.map((l, i) => `<li class="${i < stage ? 'done' : i === stage ? 'now' : ''}"${i === stage ? ' aria-current="step"' : ''}><i>${i < stage ? icon('check') : ''}</i><span>${l}</span></li>`).join('')}</ol>`;
  const confetti = () => `<span class="p6o-confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${Math.round(i * 360 / 14 + (i % 3) * 9)}deg;--d:${46 + (i * 7) % 30}px;--c:${['var(--gold)', 'var(--cardinal)', 'var(--ok)', '#3c7bd1'][i % 4]}"></i>`).join('')}</span>`;
  const itemsLine = o => `${(o.items || []).map(([n, q]) => `${q}× ${esc(String(n).replace(/\s*\(sample item\)/i, ''))}`).join(', ')} · ${TH.money(o.total)}`;

  function bigLine(e) {
    if (e.stage === 2) return `<span class="p6o-lab">Order ready</span><b class="p6o-big" data-p6-big>Ready!</b><span class="p6o-sub">On the mobile order shelf</span>`;
    if (e.stage === 1) return `<span class="p6o-lab">Ready in</span><b class="p6o-big" data-p6-big>${e.mins > 0 ? `~${e.mins}<small> min</small>` : 'Any sec…'}</b><span class="p6o-sub">${est()} <span>sped-up demo kitchen</span></span>`;
    // a pickup more than an hour out (e.g. pre-ordered before opening): the time, not "~340 min"
    if (e.mins > LONG) return `<span class="p6o-lab">Ready around</span><b class="p6o-big" data-p6-big>${clockHTML(e.readyAt)}</b><span class="p6o-sub">at your <b>${fmtMin(e.win)}</b> pickup ${est()}</span>`;
    return `<span class="p6o-lab">Ready in</span><b class="p6o-big" data-p6-big>~${e.mins}<small> min</small></b><span class="p6o-sub">around <b data-p6-at>${fmtMin(e.readyAt)}</b> ${est()}</span>`;
  }

  // Full card on the Food screen
  function card(o) {
    const e = eta(o), p = e.p || { name: o.at }, st = ui(), seen = st.p6oSeen || (st.p6oSeen = {});
    if (e.stage === 2 && !seen[o.code]) seen[o.code] = Date.now();
    const pop = e.stage === 2 && Date.now() - seen[o.code] < 1500; // celebrate once (a back-to-back re-render still shows it)
    const vi = venueIcon(o);
    const inner = e.stage === 2 ? icon('check') : icon(vi);
    let mid = '', act = '';
    if (e.stage === 0) {
      const leave = e.late ? `<b>Your window was ${fmtMin(o.window)}</b><span>Still coming? Tap “I’m here” when you walk up.</span>`
        : e.goNow ? `<b>Head over now</b><span>${e.wk} min walk from ${esc((TH.ME && TH.ME.short) || 'you')}</span>`
        : `<b>Leave by ${fmtMin(e.leaveBy)}</b><span>${e.wk} min walk from ${esc((TH.ME && TH.ME.short) || 'you')}</span>`;
      mid = `<div class="p6o-facts">
          <div class="p6o-fact ${e.goNow ? 'go' : ''}">${icon('walk')}<span>${leave}</span></div>
          <div class="p6o-fact">${gauge(e.busy)}<span><b>Kitchen: ${esc(e.busy.label)}</b><span>~${e.busy.ahead} order${e.busy.ahead === 1 ? '' : 's'} ahead at ${fmtMin(o.window)} · Est.</span></span></div>
        </div>`;
      act = `<button class="btn gold block p6o-here" data-here="${esc(o.code)}">${icon('pin')} I’m here, start making it</button>
        <div class="p6o-foot"><span class="muted">${e.canHere ? `Pickup ${fmtMin(o.window)} – ${fmtMin(o.window + 10)}. Tap when you walk up so it’s hot.` : `Pickup ${fmtMin(o.window)} – ${fmtMin(o.window + 10)}. You can tap “I’m here” from ${fmtMin(e.hereFrom)}.`}</span><button class="btn sm line" data-cancel="${esc(o.code)}">Cancel</button></div>`;
    } else if (e.stage === 1) {
      mid = `<div class="p6o-facts one"><div class="p6o-fact">${icon('bell')}<span><b>We’ll ping you the second it’s ready</b><span>Kitchen: ${esc(e.busy.label)} · Est. ~${e.prep} min to make</span></span></div></div>`;
      act = '';
    } else {
      mid = `<div class="p6o-code"><span>Pickup code</span><b class="mono">${esc(o.code)}</b></div>`;
      act = `<button class="btn block p6o-picked" data-picked="${esc(o.code)}">${icon('check')} I picked it up</button>`;
    }
    const big = bigLine(e);
    return `<div class="card p6o-card s${e.stage}${pop ? ' pop' : ''}" data-p6eta="${esc(o.code)}" data-stage="${e.stage}">
      <div class="p6o-head"><span style="min-width:0"><span class="kindline mono muted">Mobile order · #${esc(o.code)}</span><b class="p6o-venue">${esc(p.name)}</b><span class="muted p6o-items">${itemsLine(o)}</span></span><span class="simbadge" title="Practice order on the demo account. Nothing is sent to USC.">Simulated</span></div>
      <div class="p6o-hero">${pop ? confetti() : ''}${ring(e.frac, inner, 'lg s' + e.stage)}<span class="p6o-eta">${big}</span></div>
      ${steps(e.stage)}
      <p class="p6o-quip" data-p6-quip>${icon(e.stage === 2 ? 'sparkle' : e.stage === 1 ? 'flame' : 'check')}<span>${esc(e.stage === 0 ? (e.late ? 'Your window passed, but your order is still saved.' : 'Order’s in! The kitchen starts it when you tap “I’m here”, so it’s hot, not waiting.') : quip(o, e.stage))}</span></p>
      ${mid}${act}
    </div>`;
  }

  // Compact row for Home ("Your plans now")
  function mini(o) {
    const e = eta(o), p = e.p || { name: o.at };
    const inner = e.stage === 2 ? icon('check') : e.stage === 1 && e.mins <= 0 ? icon(venueIcon(o)) : e.stage === 0 ? miniNum(e) : `<b>${e.mins}</b><small>min</small>`;
    const kind = e.stage === 2 ? 'Mobile order · ready!' : e.stage === 1 ? 'Mobile order · being made' : `Order · ready ~${fmtMin(e.readyAt)}`;
    const sub = e.stage === 2 ? `Code ${o.code} · on the pickup shelf` : e.stage === 1 ? quip(o, 1) : e.late ? `Window was ${fmtMin(o.window)} · tap I’m here when you arrive` : e.goNow ? `Head over now · ${e.wk} min walk` : `Leave by ${fmtMin(e.leaveBy)} · ${e.wk} min walk`;
    const side = e.stage === 0 ? (e.canHere ? `<button class="btn sm gold" data-p6-here="${esc(o.code)}">I’m here</button>` : `<span class="muted tiny">I’m here<br>from ${fmtMin(e.hereFrom)}</span>`)
      : e.stage === 2 ? `<button class="btn sm" data-p6-picked="${esc(o.code)}">Picked up</button>` : `<span class="p6o-live">${est()}</span>`;
    return `<div class="row rn-row p6o-mini s${e.stage}" style="--rc:var(--c-dining)" data-p6eta="${esc(o.code)}" data-stage="${e.stage}" data-mini="1">
      <button class="rn-main" data-go="food:order">${ring(e.frac, inner, 'sm s' + e.stage)}<span class="rmain"><span class="mono muted kindline" data-p6-kind>${esc(kind)}${e.stage === 0 ? ' ' + est() : ''}</span><span class="rtitle">${esc(p.name)}</span><span class="rsub" data-p6-quip>${esc(sub)}</span><span class="p6o-bar" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i < e.stage ? 'done' : i === e.stage ? 'now' : ''}"></i>`).join('')}</span></span></button>
      <span class="rside">${side}</span></div>`;
  }

  // ---------------------------------------------------------------------------
  // ORDER SHEET (before ordering)
  // ---------------------------------------------------------------------------
  function sheetHero(p, w) {
    const st = TH.status(p, now()), nm = nowMin();
    if (w == null) { // nothing left to pick up today: say why, kindly
      const [h, s] = st.open === true ? ['Pickups are done for today', `${st.detail ? st.detail + '. ' : ''}The last pickup time has passed. Another spot may still be open.`]
        : st.open == null ? ['Hours not published', 'USC hasn’t posted today’s hours here, so a pickup can’t be scheduled.']
        : ['Closed for today', `${st.detail ? st.detail + '. ' : ''}Order ahead is for same-day pickup, so check back then.`];
      return `<div class="p6o-sheethero closed">${icon('moon')}<span><b>${esc(h)}</b><span>${esc(s)}</span></span></div>`;
    }
    const prep = waitAt(p, w) || 6, readyAt = w + prep, wk = walk(p), b = busy(prep), lead = readyAt - nm, first = firstWin(p);
    // closed now (or between pickup periods): a pre-order for the window the student picked
    const closedNow = st.open !== true, gap = !closedNow && first != null && first - nm > LONG;
    const note = closedNow ? `<div class="p6o-pre" role="status">${icon('moon')}<span><b>Closed right now${st.detail ? ` · ${esc(st.detail.replace(/^Opens/, 'opens'))}` : ''}</b><span>No rush: order now and it’s scheduled for your <b>${fmtMin(w)}</b> pickup.</span></span></div>`
      : gap ? `<div class="p6o-pre" role="status">${icon('clock')}<span><b>Next pickups start at ${fmtMin(first)}</b><span>Order now and it’s scheduled for your <b>${fmtMin(w)}</b> pickup.</span></span></div>` : '';
    const top = lead > LONG
      ? `<span class="p6o-lab">${closedNow || gap ? 'Pre-order · ready around' : 'Ready around'}</span><b class="p6o-big">${clockHTML(readyAt)}</b><span class="p6o-sub">at your <b>${fmtMin(w)}</b> pickup ${est()}</span>`
      : `<span class="p6o-lab">Ready in</span><b class="p6o-big">~${Math.max(1, lead)}<small> min</small></b><span class="p6o-sub">around <b>${fmtMin(readyAt)}</b> ${est()}</span>`;
    return `<div class="p6o-sheethero${note ? ' pre' : ''}">${note}
        <div class="p6o-sh-top"><span class="p6o-eta">${top}</span>
          <span class="p6o-kit" title="Estimated kitchen wait at your ${fmtMin(w)} pickup">${gauge(b)}<b>${esc(b.label)}</b><small>~${b.ahead} ahead</small></span></div>
        <ol class="p6o-plan">
          <li>${icon('walk')}<b>${fmtMin(Math.max(nm, w - wk))}</b><span>Leave · ${wk} min walk</span></li>
          <li>${icon('pin')}<b>${fmtMin(w)}</b><span>Tap “I’m here”</span></li>
          <li>${icon('cup')}<b>~${fmtMin(readyAt)}</b><span>Grab it hot</span></li>
        </ol>
      </div>`;
  }
  // Pickup-time chips with each window's estimated wait; the quickest one gets a star.
  function slotHTML(p, wins, sel) {
    // star the quickest window only when it stands out (waits move in 30-min steps, so ties are common)
    const ws = wins.map(t => waitAt(p, t) || 6), min = Math.min(...ws), nMin = ws.filter(x => x === min).length, quick = nMin < ws.length && nMin <= 3 ? ws.indexOf(min) : -1;
    return wins.map((t, i) => { const b = busy(ws[i]); return `<button class="slot p6o-slot" data-win="${t}" aria-pressed="${t === sel}" aria-label="${fmtMin(t)}, about ${ws[i]} minute wait (estimate)${i === quick ? ', shortest wait' : ''}"><b>${fmtMin(t)}</b><small><i class="dot ${b.tone}"></i>~${ws[i]} min</small>${i === quick ? `<em>${icon('star')}Quickest</em>` : ''}</button>`; }).join('');
  }
  const howItWorks = () => `<div class="p6o-how" aria-label="How order ahead works">
      <span><i>1</i><b>Order</b><small>pick a pickup time</small></span>
      <span><i>2</i><b>Tap “I’m here”</b><small>when you walk up</small></span>
      <span><i>3</i><b>Grab it hot</b><small>in a few minutes</small></span>
    </div>`;
  // Venue row badge in the Order ahead list: the wait for the earliest pickup window (what the sheet leads with)
  const venueWait = p => { const at = firstWin(p); if (at == null) return null; const w = waitAt(p, at), b = busy(w); return { w, b, at, html: `<span class="p6o-wait ${b.tone}"><b>~${w}</b><small>min</small><span class="sr"> estimated wait for a ${fmtMin(at)} pickup</span></span>` }; };
  // Whole row in the Order ahead list. A venue with an open order today shows that order instead of a second
  // wait number, so the card above and the row never disagree about the same kitchen.
  function venueRow(p) {
    const st = TH.status(p, now()), key = TH.dkey(today());
    const mine = hasTA() ? hub().orders.find(o => o.at === p.id && o.day === key && o.state !== 'picked') : null;
    const ic = /caf[eé]|coffee|grounds|literatea/i.test(p.name) ? 'cup' : 'bag', U = TH.ui || {};
    const rowHTML = (sub, side, cls) => `<button class="row p6o-vrow${cls ? ' ' + cls : ''}" data-order="${esc(p.id)}" style="--rc:var(--c-dining)"><span class="rico">${icon(ic)}</span><span class="rmain"><span class="rtitle">${esc(p.name)}</span><span class="rsub">${sub}</span></span><span class="rside">${side}</span></button>`;
    if (mine) {
      const e = eta(mine), what = e.stage === 2 ? 'ready on the shelf!' : e.stage === 1 ? 'being made' : `ready ~${fmtMin(e.readyAt)}`;
      return rowHTML(`<span>Your order #${esc(mine.code)} · ${esc(what)}</span>`, `<span class="p6o-wait mine">${icon(e.stage === 2 ? 'check' : ic)}<small>Yours</small></span>`, 'mine');
    }
    const vw = st.open === true ? venueWait(p) : null;
    if (vw) return rowHTML(`${walk(p)} min walk · ${gauge(vw.b)} ${esc(vw.b.label)}`, vw.html);
    const at = firstWin(p);
    const sub = st.open == null ? 'Hours not published'
      : at != null ? `${esc(st.detail || 'Closed now')} · pre-order now`
      : st.open === true ? `${esc(st.detail || 'Closing soon')} · no pickups left today` : esc(st.detail || 'Closed');
    return rowHTML(sub, U.pill ? U.pill(st) : esc(st.label || ''), 'shut');
  }

  TH.orderEta = { waitAt, busy, walk, eta, card, mini, sheetHero, slotHTML, howItWorks, quip, venueWait, venueRow, firstWin, gauge };

  // ---------------------------------------------------------------------------
  // ORDER SHEET: the older "Wait right now" box (hub2c.js) is superseded by the ETA hero.
  // ---------------------------------------------------------------------------
  if (TH.openOrder) {
    const open0 = TH.openOrder;
    TH.openOrder = function () {
      const r = open0.apply(this, arguments);
      const sh = $('.sheet'); if (sh && $('.p6o-sheethero', sh)) $$('.x-wait', sh).forEach(n => n.remove());
      return r;
    };
  }

  // Remember the demo-clock minute an order was placed so the ring can show progress toward pickup
  // (placedAt is a real timestamp; the demo clock can be moved in Demo controls). Covers the app and Tommy.
  if (TH.act && TH.act.placeOrder) {
    const po0 = TH.act.placeOrder;
    TH.act.placeOrder = function () { const r = po0.apply(this, arguments); try { if (r && r.item) r.item.placedMin = nowMin(); } catch (e) { /* optional */ } return r; };
  }

  // ---------------------------------------------------------------------------
  // HOME: order rows in "Your plans now" become live mini trackers
  // ---------------------------------------------------------------------------
  function upgradeHome(host) {
    const sec = $('.plans-now', host); if (!sec || !hasTA()) return;
    const key = TH.dkey(today()), open = hub().orders.filter(o => o.day === key && o.state !== 'picked'), used = new Set();
    $$('.rn-row', sec).forEach(r => {
      const m = r.querySelector('.rn-main[data-go="food:order"]'); if (!m || r.dataset.mini) return;
      const title = (r.querySelector('.rtitle') || {}).textContent || '', kl = ((r.querySelector('.kindline') || {}).textContent || '').toLowerCase();
      const want = /ready/.test(kl) ? 'ready' : /being made/.test(kl) ? 'preparing' : 'placed';
      const btn = r.querySelector('[data-rn-here],[data-rn-picked]'), code = btn && (btn.dataset.rnHere || btn.dataset.rnPicked);
      const o = (code && open.find(x => x.code === code)) || open.find(x => !used.has(x.code) && x.state === want && ((place(x.at) || {}).name || 'Mobile order') === title);
      if (!o) return; used.add(o.code);
      r.insertAdjacentHTML('afterend', mini(o)); r.remove();
    });
    sec.addEventListener('click', ev => {
      const h = ev.target.closest('[data-p6-here]'), pk = ev.target.closest('[data-p6-picked]');
      if (h) { ev.stopPropagation(); TH.runAct('orderHere', [h.dataset.p6Here], 'Got it! The kitchen is starting your order.'); }
      if (pk) { ev.stopPropagation(); pickedSheet(pk.dataset.p6Picked); }
    });
  }
  function pickedSheet(code) {
    const o = hub().orders.find(x => x.code === code);
    TH.confirmAct('orderPicked', [code], { title: 'Picked up your order?', ok: 'Yes, picked up', rows: [['Order', '#' + code], ['Charge', `${TH.money(o ? o.total : 0)} Dining Dollars`], ['Balance now', TH.money(TH.student().dining.diningDollars)]], toast: 'Enjoy! Fight On.' });
  }
  TH.orderEta.pickedSheet = pickedSheet;
  if (TH.screens && TH.screens.home) {
    const hm0 = TH.screens.home.mount;
    TH.screens.home.mount = function (host) { if (hm0) hm0.apply(this, arguments); try { upgradeHome(host || $('#screen-host')); } catch (e) { console.error(e); } };
  }

  // ---------------------------------------------------------------------------
  // MY DAY: order items say when it'll be ready and when to leave
  // ---------------------------------------------------------------------------
  if (TH.dayItems) {
    const di0 = TH.dayItems;
    TH.dayItems = function (off) {
      const items = di0.apply(this, arguments);
      if (off || !hasTA()) return items;
      try {
        const key = TH.dkey(today()), open = hub().orders.filter(o => o.day === key && o.state !== 'picked');
        items.forEach(it => {
          if (it.kind !== 'Mobile order') return;
          const o = open.find(x => x.window === it.start && ((place(x.at) || {}).name || 'Mobile order') === it.title); if (!o) return;
          const e = eta(o);
          it.sub = e.stage === 2 ? `Ready now! Code ${o.code} · pickup shelf` : e.stage === 1 ? `Being made · ready in ~${Math.max(1, e.mins)} min (est.)` : `Ready ~${fmtMin(e.readyAt)} (est.) · leave by ${fmtMin(e.leaveBy)} · tap I’m here`;
        });
      } catch (e) { /* keep the original text */ }
      return items;
    };
  }

  // ---------------------------------------------------------------------------
  // READY MOMENT: friendlier notification + a buzz where the device supports it
  // ---------------------------------------------------------------------------
  if (TH.notify) {
    const n0 = TH.notify;
    TH.notify = function (title, body, go) {
      if (/^Order ready at /.test(String(title || ''))) {
        const code = (String(body || '').match(/\b(\d{4})\b/) || [])[1];
        title = String(title).replace(/^Order ready at /, 'Your order is ready at ');
        body = `${code ? 'Code ' + code + '. ' : ''}Hot and waiting on the mobile order shelf. (Simulated)`;
        try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) { /* not supported */ }
      }
      return n0.call(this, title, body, go, arguments[3]);
    };
  }

  // ---------------------------------------------------------------------------
  // LIVE: tick the countdowns once a second (no full re-render; tickSims re-renders on state changes)
  // ---------------------------------------------------------------------------
  function tickLive() {
    const els = $$('[data-p6eta]'); if (!els.length || !hasTA()) return;
    const orders = hub().orders;
    els.forEach(el => {
      const o = orders.find(x => x.code === el.dataset.p6eta); if (!o) return;
      const e = eta(o); if (String(e.stage) !== el.dataset.stage) return; // state changed: the next render redraws it
      const bar = el.querySelector('.p6o-ring .bar'); if (bar) bar.setAttribute('stroke-dashoffset', String(100 - Math.round(clamp(e.frac) * 100)));
      const isMini = !!el.dataset.mini;
      if (e.stage === 1) {
        const q = el.querySelector('[data-p6-quip] span') || el.querySelector('[data-p6-quip]'); if (q) q.textContent = quip(o, 1);
        if (isMini) { const inn = el.querySelector('.p6o-ring .in'); if (inn) inn.innerHTML = e.mins > 0 ? `<b>${e.mins}</b><small>min</small>` : icon(venueIcon(o)); }
        else { const b = el.querySelector('[data-p6-big]'); if (b) b.innerHTML = e.mins > 0 ? `~${e.mins}<small> min</small>` : 'Any sec…'; }
      } else if (e.stage === 0) {
        if (isMini) { const inn = el.querySelector('.p6o-ring .in'); if (inn) inn.innerHTML = miniNum(e); }
        else { const box = el.querySelector('.p6o-hero .p6o-eta'), k = `${e.mins > LONG ? 'L' : e.mins}:${e.readyAt}`; if (box && box.dataset.k !== k) { box.innerHTML = bigLine(e); box.dataset.k = k; } }
      }
    });
  }
  setInterval(() => { try { tickLive(); } catch (e) { /* never break the app for a countdown */ } }, 1000);
})(window.TH = window.TH || {});
