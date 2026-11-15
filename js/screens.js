/* js/screens.js */
/* Trojan Hub — feature screens: Getting Around (USC Lyft, USC buses, Metro, Zipcar, parking),
 * Metro U-Pass, Dining & Mobile Order, Trojan Pass, Virtual Lines, Safety, Events, Wallet, Alerts,
 * Game Day, Accessibility and About.
 *
 * Real data: js/data.js (TH.PLACES, TH.TRANSPORT, TH.SAFETY, TH.PASSES, TH.QUEUES…), js/clubs-data.js
 * (EngageSC events), js/safety-data.js (USC DPS log + alerts). Account actions go through TH.act.*
 * (js/actions.js) on Trojan Assist's demo student and are labeled "Simulated"; estimates say "Est.".
 * Side-effect free at load: only defines TH.screens.* and a few TH.open* sheets.
 */
(function (TH) {
  'use strict';
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c), fmtMin = m => TH.fmtMin(m), fmtTime = d => TH.fmtTime(d);
  const S = () => TH.state, H = () => TH.ui;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasTA = () => !!(window.TA && TA.State && TA.State.d);
  const EMPTY_HUB = { calendar: [], clubs: [], orders: [], passes: [], lines: [], ride: null, zips: [], upass: null, parking: null, lyftUsedUSD: 0, notes: [] };
  const hub = () => (hasTA() ? TH.H() : EMPTY_HUB);
  const now = () => TH.clock.now();
  const nowMin = () => TH.minOfDay(now());
  const today = () => TH.dayStart(now());
  const T = () => TH.TRANSPORT || {};
  const place = id => (TH.byId || {})[id] || null;
  const card = (inner, extra = '') => `<div class="card ${extra}">${inner}</div>`;
  const simBadge = (t = 'Simulated') => `<span class="simbadge" title="Practice action on the demo account. Nothing is sent to USC.">${esc(t)}</span>`;
  const src = (u, l) => H().src(u, l);
  const ext = (u, l, cls = 'btn ghost') => u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${icon('external')} ${esc(l)}</a>` : '';
  const telHref = n => { const d = String(n).replace(/\(WELL\)/, '').replace(/[^\d]/g, ''); return d.length >= 3 ? 'tel:' + d : null; };
  const dayOffLabel = o => o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : TH.fmtDate(TH.addDays(today(), o));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const sheetHead = (title, sub) => `<div class="sheet-head"><div style="flex:1;min-width:0;display:grid;gap:3px"><h2>${esc(title)}</h2>${sub ? `<p class="muted" style="font-size:13px">${sub}</p>` : ''}</div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>`;
  const banners = ck => ck.block.map(b => `<div class="banner">${icon('alert')}<div><b>Can’t do that yet</b><span>${esc(b)}</span></div></div>`).join('') + ck.warn.map(w => `<div class="banner info">${icon('info')}<div><span>${esc(w)}</span></div></div>`).join('');

  // ---------------------------------------------------------------------------
  // Form sheet: pick options, see live checks (TH.act.check.X), one primary button → TH.act.X → TH.commit → toast
  // ---------------------------------------------------------------------------
  function formSheet(o) {
    const html = `<div class="stack">${sheetHead(o.title, o.sub)}${o.top || ''}${o.fields || ''}<div class="fs-check" aria-live="polite"></div>
      <div class="err" hidden></div>
      <button class="btn block ${o.okClass || ''}" id="fs-ok" ${o.okStyle ? `style="${o.okStyle}"` : ''}>${o.ok || 'Confirm'}</button>
      ${o.bottom || ''}${H().sim(o.url, o.urlLabel)}</div>`;
    TH.sheet(html, w => {
      const ok = $('#fs-ok', w);
      const update = () => {
        let args; try { args = o.args(w); } catch (e) { args = null; }
        const ck = args ? TH.act.check[o.act](...args) : { block: [], warn: [] };
        $('.fs-check', w).innerHTML = banners(ck);
        ok.disabled = !args || !!ck.block.length;
        if (o.label) ok.innerHTML = o.label(w, args);
      };
      w.addEventListener('change', update); w.addEventListener('input', update);
      o.mount && o.mount(w, update);
      update();
      ok.onclick = () => {
        try {
          const res = TH.act[o.act](...o.args(w));
          TH.commit(res.log); TH.closeSheet(); TH.toast(o.toast ? o.toast(res) : res.title, o.toastIcon || 'check');
          o.done ? o.done(res) : TH.render(true);
        } catch (e) { const er = $('.err', w); er.hidden = false; er.textContent = e.message; }
      };
    });
  }
  TH.formSheet = formSheet;

  // =====================================================================
  // GETTING AROUND
  // =====================================================================
  const LYFT_PINK = 'background:#ff00bf;color:#fff';
  function busCards() {
    const n = now(), m = nowMin(), dow = n.getDay(), key = TH.dkey(n), Tr = T();
    const holiday = (Tr.holidays || []).includes(key);
    return (Tr.buses || []).map(b => {
      // the first stop with published departures (usually the origin), else the first mapped stop
      let si = b.trips ? b.stops.findIndex((s, i) => (b.trips[i] || b.trips[String(i)] || []).length) : -1;
      if (si < 0) si = b.stops.findIndex(s => s.placeId); if (si < 0) si = 0;
      const stop = b.stops[si] || {};
      // fixed trips + USC's estimated afternoon windows (Union Station → UPC publishes 3–7 PM trips only as windows)
      const deps = TH.busDepartures ? TH.busDepartures(b.id, si, n) : TH.busTimes(b.id, si, n).map(at => ({ at }));
      const times = deps.map(x => x.at), next = deps.filter(x => (x.est ? x.end : x.at) >= m), dt = x => TH.busDepText ? TH.busDepText(x) : fmtMin(x.at);
      const runsToday = b.days.includes(dow) && !holiday && !(b.noService || []).includes(key);
      const days = b.days.length === 5 && !b.days.includes(0) ? 'Weekdays' : b.days.length === 2 && b.days.includes(0) && b.days.includes(6) ? 'Weekends' : b.days.map(d => TH.DAYS3[d]).join(', ');
      let side = '', sub = '';
      if (!runsToday) { sub = holiday ? 'No USC buses today (university holiday)' : `Doesn’t run today · ${days}`; }
      else if (!next.length) { sub = times.length ? `Done for today · last ${fmtMin(times[times.length - 1])}` : 'No published times for this stop'; }
      else { const x = Math.max(0, next[0].at - m); side = `<span class="big">${x <= 90 ? `${next[0].est ? '~' : ''}${x}<small>min${next[0].est ? ' est.' : ''}</small>` : `<span style="font-size:15px">${fmtMin(next[0].at)}</span><small>next</small>`}</span>`; sub = `Next ${dt(next[0])}${next.length > 1 ? ` · then ${next.slice(1, 3).map(dt).join(', ')}` : ''}${next.slice(0, 3).some(y => y.est) ? ' · est. windows published by USC' : ''}`; }
      const attrs = stop.placeId && place(stop.placeId) ? `data-place="${esc(stop.placeId)}"` : '';
      return `<${attrs ? 'button' : 'div'} class="row" ${attrs} style="--rc:${esc(b.color || 'var(--c-transit)')}"><span class="rico">${icon('bus')}</span>
        <span class="rmain"><span class="rtitle">${esc(b.name)}</span><span class="rsub">${esc(sub)}</span><span class="rsub">From ${esc(stop.name || 'UPC')} · ${esc(days)}</span></span>
        <span class="rside">${side}</span></${attrs ? 'button' : 'div'}>`;
    }).join('');
  }
  function parkingEst(p, n) {
    const lv = TH.live(p, n); if (lv) return lv;
    if (p.crowd && TH.status(p, n).open !== false) { const v = Math.min(99, Math.round(TH.crowdAt(p.crowd, n))); return { kind: 'busy', value: v, unit: '%', pct: v, estimate: true }; }
    return null;
  }
  TH.screens.rides = {
    render() {
      const n = now(), Tr = T(), L = Tr.lyft || {}, h = hub(), open = TH.lyftOpen(n), ride = h.ride && h.ride.state !== 'done' ? h.ride : null;
      const P = Tr.parking || {}, saved = h.parking && place(h.parking.at);
      const up = h.upass;
      const lyftCard = ride ? card(`<div class="stack"><div class="lyftbar"><span class="lyft-logo">lyft</span><div style="flex:1"><b>${ride.state === 'here' ? 'Your driver is here' : `Arriving in about ${ride.left ?? ride.eta} min`}</b><br><span class="muted" style="font-size:13px">To ${esc(ride.to)}</span></div>${simBadge()}</div>
          <div class="ride-anim"><i style="width:${ride.state === 'here' ? 100 : Math.round((1 - (ride.left ?? ride.eta) / Math.max(1, ride.eta)) * 100)}%"></i></div>
          <dl class="kv"><dt>Pickup</dt><dd>${esc(ride.from)}</dd><dt>Ride type</dt><dd>${esc(ride.car || 'Shared')}</dd><dt>Cost</dt><dd>Free if the ride qualifies</dd></dl>
          <div class="btn-row"><a class="btn ghost" href="https://www.lyft.com/" target="_blank" rel="noopener">${icon('external')} Lyft app</a><button class="btn line" id="ride-end">${ride.state === 'here' ? 'I’m in the car' : 'Cancel ride'}</button></div></div>`)
        : card(`<div class="stack"><div class="lyftbar"><span class="lyft-logo">lyft</span><div style="flex:1"><b style="font-size:16px">Free USC Lyft</b><br><span class="muted" style="font-size:13px">${esc(L.hoursText || '7 PM – 2 AM daily')} · Shared rides</span></div>${H().pill(open ? { tone: 'ok', label: 'Running now' } : open === null ? { tone: 'warn', label: 'Game day' } : { tone: 'mute', label: 'Starts 7 PM' })}</div>
          ${open === false ? `<button class="btn block line" id="lyft-go" disabled aria-disabled="true">${icon('clock')} Available at 7 PM</button>`
            : `<button class="btn block" id="lyft-go" style="${LYFT_PINK}">${icon('car')} Request a ride</button>`}
          ${open === null ? `<span class="muted" style="font-size:12.5px">${esc(TH.lyftGameText())} The kickoff time isn’t published yet, so it may not be running now.</span>` : ''}
          ${open === false ? `<span class="muted" style="font-size:12.5px">Outside USC Lyft hours. ${(() => { const mm = nowMin(); return mm >= 120 && mm < 360 ? esc(L.afterHours || '') : 'Walking somewhere now? <button class="linkbtn" data-go="safety">Plan a safe walk</button> or call DPS at (213) 740-4321 any time.'; })()}</span>` : ''}
          <details class="more"><summary>How USC Lyft works</summary><div class="stack" style="margin-top:8px">
            <p><b>Where:</b> ${esc((L.boundary && L.boundary.text) || L.zone || '')}</p>
            <ul class="plain">${(L.rules || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
            <p><b>Set it up once:</b></p><ol class="plain">${(L.enroll || []).map(r => `<li>${esc(r)}</li>`).join('')}</ol>
            ${L.limitText ? `<p class="muted" style="font-size:13px">${esc(L.limitText)}</p>` : ''}
            ${src(L.url, 'USC Transportation · How to use Lyft')}</div></details></div>`);
      return `<div class="screen">${H().topbar('Getting Around')}
        <div class="pad screen-body stack">
          ${lyftCard}
          <div class="section"><div class="section-head"><h2>USC buses</h2><span class="muted tiny">Published schedule</span></div>
            <div class="rows">${busCards()}</div>
            <span class="muted tiny">${esc([(Tr.busRules || {}).holidays, (Tr.busRules || {}).tracking].filter(Boolean).join(' '))}</span>
            ${src(((Tr.buses || [])[0] || {}).url || 'https://transnet.usc.edu/index.php/bus-map-schedules/', 'USC Transportation · Bus maps & schedules')}</div>
          <div class="section"><div class="section-head"><h2>Metro</h2>${up ? `<span class="pill ${up.status === 'active' ? 'ok' : 'warn'}">U-Pass ${up.status === 'active' ? 'active' : 'pending'}</span>` : `<button data-go="upass">Get U-Pass</button>`}</div>
            <div class="rows">${((Tr.metro || {}).stations || []).map(st => { const p = place(st.placeId); return `<button class="row" ${p ? `data-place="${esc(st.placeId)}"` : ''} style="--rc:var(--c-transit)"><span class="rico">${icon('train')}</span><span class="rmain"><span class="rtitle">${esc(st.name)}</span><span class="rsub">${esc(st.line)}${p ? ` · ${H().walkMin(p)} min walk` : ''}</span></span>${icon('chev', 'chev')}</button>`; }).join('')}</div>
            <p class="muted" style="font-size:13px">${esc((Tr.metro || {}).note || '')}</p>
            <div class="btn-row">${ext('https://www.metro.net/', 'Train times on metro.net')}${up ? '' : `<button class="btn gold" data-go="upass">${icon('ticket')} Free U-Pass</button>`}</div></div>
          <div class="section" id="zipcar"><div class="section-head"><h2>Zipcar</h2>${simBadge()}</div>
            ${card(`<div class="stack"><div class="lyftbar"><span class="zip-logo">zip</span><div style="flex:1"><b>Zipcar at USC</b><br><span class="muted" style="font-size:13px">Free to join the first year, then $35/year · 18+</span></div></div>
              ${h.zips.filter(z => z.day >= TH.dkey(today())).map(z => `<div class="row flatrow" style="--rc:#3d9b35"><span class="rico">${icon('car')}</span><span class="rmain"><span class="rtitle">${esc(dayOffLabel(Math.round((TH.parseKey(z.day) - today()) / 864e5)))} · ${fmtMin(z.start)} – ${fmtMin(z.start + z.hours * 60)}</span><span class="rsub">Pick the car in the Zipcar app</span></span><button class="btn sm line" data-unzip="${esc(z.id)}">Cancel</button></div>`).join('')}
              <button class="btn block" id="zip-go" style="background:#3d9b35;color:#fff">${icon('car')} Reserve a Zipcar</button>
              <p class="muted" style="font-size:12.5px">${esc((Tr.zipcar || {}).text || '')}</p>
              ${src((Tr.zipcar || {}).url, 'USC Transportation · Zipcar')}</div>`, 'flat')}</div>
          <div class="section" id="parking"><div class="section-head"><h2>Parking</h2><span class="muted tiny">Occupancy is ${H().est()}</span></div>
            ${saved ? `<div class="card flat parkcard">${icon('parking')}<span style="flex:1"><b>You parked at ${esc(saved.name)}</b><br><span class="muted" style="font-size:13px">${esc(h.parking.level || 'No level saved')} · ${TH.fmtDelta(Math.round((Date.now() - h.parking.t) / 60000))} ago</span></span><button class="btn sm line" id="park-clear">Clear</button></div>` : ''}
            <div class="rows">${(P.structures || []).map(place).filter(Boolean).map(p => { const st = TH.status(p, n), lv = parkingEst(p, n); return `<div class="row park-row" style="--rc:var(--c-parking)"><button class="rico" data-place="${esc(p.id)}" aria-label="${esc(p.name)} details">${icon('parking')}</button>
                <button class="rmain" data-place="${esc(p.id)}"><span class="rtitle">${esc(p.name)}</span><span class="rsub">${lv ? `Est. ${lv.value}% full` : esc(st.open == null ? 'Hours not published' : st.label)} · ${H().walkMin(p)} min walk</span>${lv ? `<span class="meter"><i class="${H().toneFor(lv)}" style="width:${Math.min(100, lv.pct)}%"></i></span>` : ''}</button>
                <button class="btn sm ghost" data-park="${esc(p.id)}">I parked here</button></div>`; }).join('')}</div>
            <p class="muted" style="font-size:12.5px">${esc(((P.rates || {}).daily) || '')}${(P.rates || {}).free_parking ? ' · ' + esc(P.rates.free_parking) : ''}</p>
            ${src(P.permitsUrl || P.url, 'USC Transportation · Parking rates')}</div>
        </div></div>`;
    },
    mount(host) {
      const go = $('#lyft-go', host); if (go) go.onclick = () => TH.openLyft();
      const end = $('#ride-end', host); if (end) end.onclick = () => TH.runAct('endRide', [], hub().ride && hub().ride.state === 'here' ? 'Have a safe ride. Fight On!' : 'Ride canceled');
      const zg = $('#zip-go', host); if (zg) zg.onclick = () => TH.openZip();
      $$('[data-unzip]', host).forEach(b => b.onclick = () => TH.runAct('cancelZip', [b.dataset.unzip]));
      $$('[data-park]', host).forEach(b => b.onclick = e => { e.stopPropagation(); TH.parkSheet(b.dataset.park); });
      const pc = $('#park-clear', host); if (pc) pc.onclick = () => TH.runAct('clearParking', []);
      const a = S().params.arg;
      if (a === 'lyft') { S().params = {}; setTimeout(() => TH.openLyft(), 60); }
      if (a === 'zipcar' || a === 'parking') { S().params = {}; setTimeout(() => { const el = $('#' + a, host); if (el) host.scrollTop = el.offsetTop - 70; }, 60); }
    },
  };

  const LYFT_FROM = () => [[TH.ME.label, TH.ME.label], ...(TH.HOME ? [[TH.HOME.label, TH.HOME.label]] : []), ...['leavey', 'doheny', 'sel', 'lyon', 'villagedh', 'parkside', 'st-expopark'].map(place).filter(Boolean).map(p => [p.name, p.name])];
  const LYFT_TO = () => [...(TH.HOME ? [[TH.HOME.label.replace(/^Home · /, 'Home: '), TH.HOME.address ? `${TH.HOME.name}, ${TH.HOME.address}` : TH.HOME.label]] : []), ...['villagedh', 'parkside', 'leavey', 'st-jeffusc', 'st-expopark', 'galen', 'shrine'].map(place).filter(Boolean).map(p => [p.name, p.name])];
  TH.openLyft = function (dest) {
    const L = T().lyft || {}, to = LYFT_TO(), from = LYFT_FROM();
    const pick = dest && to.find(([l, v]) => v === dest || l === dest);
    formSheet({
      title: 'Request a USC Lyft', sub: `${esc(L.hoursText || '')} · Shared ride`, act: 'requestLyft', ok: `${icon('car')} Request ride`, okStyle: LYFT_PINK,
      fields: `<div class="field"><label for="ly-from">Pickup</label><select id="ly-from">${from.map(([l, v]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label for="ly-to">Drop-off</label><select id="ly-to">${to.map(([l, v]) => `<option value="${esc(v)}" ${pick && pick[1] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}<option value="">Somewhere else…</option></select></div>
        <div class="field" id="ly-other-wrap" hidden><label for="ly-other">Address inside the USC Lyft zone</label><input id="ly-other" maxlength="80" placeholder="e.g. 2715 Portland St">
          <label class="checkline"><input type="checkbox" id="ly-inzone"> It’s inside the zone: east of Normandie, south of Washington, west of Main, north of MLK Jr. Blvd</label></div>`,
      args: w => { const sel = $('#ly-to', w).value, oth = $('#ly-other', w); $('#ly-other-wrap', w).hidden = !!sel; if (!sel && (!oth.value.trim() || !$('#ly-inzone', w).checked)) return null; return [sel || oth.value, $('#ly-from', w).value]; },
      bottom: `<p class="muted" style="font-size:12.5px">For real: open the Lyft app, choose <b>Shared</b>, and pay with <b>USC Lyft Rides</b> (Payment section).</p>`,
      url: L.url, urlLabel: 'USC Lyft program',
      toast: () => 'Ride requested (simulated)', toastIcon: 'car',
      done: () => { if (S().route === 'rides') TH.render(true); else TH.go('rides'); },
    });
  };
  TH.openZip = function () {
    const start = Math.ceil((nowMin() + 30) / 30) * 30;
    const opts = d => { const out = [], first = d === 0 ? start : 7 * 60; for (let t = first; t <= 22 * 60; t += 30) out.push(t); return out; };
    formSheet({
      title: 'Reserve a Zipcar', sub: 'Zipcar at USC · pick the exact car in the Zipcar app', act: 'reserveZip', ok: 'Reserve', okStyle: 'background:#3d9b35;color:#fff',
      fields: `<div class="field"><label for="zp-day">Day</label><select id="zp-day">${[0, 1, 2, 3, 4, 5, 6].map(o => `<option value="${o}">${esc(dayOffLabel(o))}</option>`).join('')}</select></div>
        <div class="grid2"><div class="field"><label for="zp-start">Start</label><select id="zp-start"></select></div>
        <div class="field"><label for="zp-len">Length</label><select id="zp-len">${[1, 2, 3, 4, 6, 8].map(h => `<option value="${h}">${plural(h, 'hour')}</option>`).join('')}</select></div></div>`,
      mount: (w, update) => {
        const fill = () => { const d = +$('#zp-day', w).value, s = $('#zp-start', w), list = opts(d); s.innerHTML = list.length ? list.map(t => `<option value="${t}">${fmtMin(t)}</option>`).join('') : '<option value="">No times left today</option>'; };
        $('#zp-day', w).addEventListener('change', () => { fill(); update(); }); fill();
      },
      args: w => { const s = $('#zp-start', w).value; return s === '' ? null : [+s, +$('#zp-len', w).value, +$('#zp-day', w).value]; },
      bottom: `<p class="muted" style="font-size:12.5px">USC doesn’t publish which cars are where, so Trojan Hub doesn’t show car names.</p>`,
      url: (T().zipcar || {}).url, urlLabel: 'Zipcar for USC', toastIcon: 'car',
    });
  };

  // =====================================================================
  // METRO U-PASS
  // =====================================================================
  function metroCard(u) {
    const st = TH.student();
    return `<div class="wcard metro ${u.status !== 'active' ? 'pending' : ''}"><span class="shine"></span><div class="wtop"><div><span class="wlabel">LA Metro · U-Pass · ${u.status === 'active' ? 'Active' : 'Pending activation'}</span><h3>${esc(st.full)}</h3><span style="opacity:.85;font-size:13px">USC student · Fall 2026</span></div><span class="metro-logo" style="width:38px;height:38px;font-size:16px">M</span></div>
      <div class="wtop"><span class="mono" style="font-size:12px">${esc(u.id || '')}</span><span class="wsim">Simulated</span></div></div>`;
  }
  TH.screens.upass = {
    render() {
      const U = T().upass || {}, u = hub().upass, steps = U.steps || [];
      let body;
      if (!u) body = `${card(`<div class="stack"><b>Who can get it</b><p>${esc(U.eligibility || '')}</p><b>Cost</b><p>${esc(U.cost || '')}</p><p class="muted" style="font-size:13px">${esc(U.term || '')}</p></div>`, 'flat')}
        <div class="section"><div class="section-head"><h2>How to sign up</h2></div><ol class="steplist">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
        <div class="section"><div class="section-head"><h2>Do you have a U-Pass card?</h2></div>
          <div class="stack" role="radiogroup" aria-label="Card">
            <label class="card flat check"><input type="radio" name="up-card" value="have-card" checked><span><b>Yes, I have a USC U-Pass card</b><br><span class="muted" style="font-size:13px">Re-register it for Fall 2026 (keep the same card).</span></span></label>
            <label class="card flat check"><input type="radio" name="up-card" value="pickup"><span><b>No, I’ll pick one up</b><br><span class="muted" style="font-size:13px">${esc((U.pickup || {}).text || 'USC Transportation')}</span></span></label></div></div>
        <button class="btn gold block" id="up-go">${icon('ticket')} Sign up for the U-Pass</button>`;
      else if (u.status !== 'active') body = `${metroCard(u)}
        <div class="section"><div class="section-head"><h2>Almost done</h2><span class="pill warn">Pending activation</span></div>
          <ol class="steplist">${steps.map((s, i) => `<li class="${i < 2 ? 'done' : ''}">${i < 2 ? icon('check') : ''}${esc(s)}</li>`).join('')}</ol>
          ${U.commonFailure ? `<div class="banner info">${icon('info')}<div><span>${esc(U.commonFailure)}</span></div></div>` : ''}
          ${u.delivery === 'pickup' ? `<button class="btn ghost block" data-go="queue:q-upass">${icon('queue')} Join the U-Pass pickup line</button>` : ''}
          <button class="btn block" id="up-act">${icon('check')} I activated and tapped my card</button></div>`;
      else body = `${metroCard(u)}
        ${card(`<div class="stack"><b>Rides free on</b><ul class="plain">${(U.validOn || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><b>Not valid on</b><p class="muted">${esc((U.notValidOn || []).join(', '))}</p></div>`, 'flat')}
        <button class="btn ghost" data-go="rides">${icon('train')} Metro stations near campus</button>`;
      return `<div class="screen">${H().topbar('Metro U-Pass')}<div class="pad screen-body stack">
        ${card(`<div class="lyftbar"><span class="metro-logo">M</span><div style="flex:1"><b>Unlimited Metro rides for USC students</b><br><span class="muted" style="font-size:13px">E Line at Expo Park/USC and Jefferson/USC, every Metro bus.</span></div>${simBadge()}</div>`)}
        ${body}
        <p class="muted tiny">Signing up here is simulated on the demo account. ${U.contact ? 'Questions: ' + esc(U.contact) + '.' : ''}</p>
        ${src(U.url, 'USC Transportation · Student U-Pass')}
      </div></div>`;
    },
    mount(host) {
      const go = $('#up-go', host);
      if (go) go.onclick = () => { const v = ($('input[name=up-card]:checked', host) || {}).value || 'have-card'; const U = T().upass || {};
        TH.confirmAct('enrollUpass', [v], { title: 'Sign up for the U-Pass?', ok: 'Sign up', rows: [['Card', v === 'pickup' ? 'Pick up at USC Transportation' : 'Use my existing card'], ['Cost', U.cost || '—'], ['After this', 'Activate on LA Metro, then tap within 14 days']], url: U.url, urlLabel: 'Sign up for real', toast: 'U-Pass requested. Activate your card to finish.' }); };
      const act = $('#up-act', host);
      if (act) act.onclick = () => TH.confirmAct('activateUpass', [], { title: 'Mark your U-Pass active?', ok: 'It’s active', rows: [['Check', 'You entered the card number + activation code on LA Metro and tapped the card within 14 days']], url: (T().upass || {}).url, urlLabel: 'U-Pass help', toast: 'U-Pass active. It’s in your Wallet.' });
    },
  };

  // =====================================================================
  // DINING & MOBILE ORDER
  // =====================================================================
  const ORDER_STATE = { placed: ['mute', 'Placed'], preparing: ['warn', 'Being made'], ready: ['ok', 'Ready'] };
  function orderCard(o) {
    if (TH.orderEta) return TH.orderEta.card(o); // Part 6 (js/p6-order.js): ring, stage tracker, leave-by time, kitchen meter
    const p = place(o.at) || { name: o.at }, [tone, lab] = ORDER_STATE[o.state] || ['mute', o.state];
    const act = o.state === 'placed' ? `<button class="btn gold block" data-here="${esc(o.code)}">${icon('pin')} I’m here, start making it</button><div class="btn-row"><span class="muted" style="font-size:12.5px;flex:1">Pickup ${fmtMin(o.window)} – ${fmtMin(o.window + 10)}. Tap when you walk up so it’s fresh.</span><button class="btn sm line" data-cancel="${esc(o.code)}">Cancel</button></div>`
      : o.state === 'ready' ? `<button class="btn block" data-picked="${esc(o.code)}">${icon('check')} I picked it up</button>`
      : `<div class="ride-anim"><i style="width:60%;background:var(--gold)"></i></div><span class="muted" style="font-size:12.5px">We’ll let you know when it’s on the pickup shelf.</span>`;
    return card(`<div class="stack"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div style="min-width:0"><span class="kindline mono muted">Mobile order · #${esc(o.code)}</span><br><b>${esc(p.name)}</b><br><span class="muted" style="font-size:13px">${o.items.map(([n, q]) => `${q}× ${esc(n)}`).join(', ')} · ${TH.money(o.total)}</span></div><span class="pill ${tone}">${esc(lab)}</span></div>${act}<span class="muted tiny">Simulated order on the demo account.</span></div>`, 'order-card');
  }
  function hallCard(p, n) {
    const st = TH.status(p, n), lv = TH.live(p, n), rr = TH.dayRanges(p, n), sp = TH.specialHours(p, n, 14), menu = (TH.MENU_URLS || {})[p.id] || p.url;
    return card(`<div class="stack"><button data-place="${esc(p.id)}" class="hall-head"><span style="min-width:0"><b style="font-size:16px">${esc(p.name)}</b><br><span class="muted" style="font-size:13px">${H().walkMin(p)} min walk · Today ${esc(TH.rangesText(rr))}</span></span>
        ${lv ? `<span class="hall-line ${H().toneFor(lv)}"><b>${lv.value}</b><small>min line</small>${H().est()}</span>` : H().pill(st)}</button>
      ${st.detail || st.note ? `<div class="tags">${st.open != null ? H().pill(st) : ''}${st.detail ? `<span class="pill mute">${esc(st.detail)}</span>` : ''}${st.note ? `<span class="pill gold">${esc(st.note)}</span>` : ''}</div>` : ''}
      ${sp.length ? `<div class="special"><b>Special hours</b><dl class="kv">${sp.slice(0, 4).map(s => `<dt>${esc(s.label)}</dt><dd>${esc(s.text)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</dd>`).join('')}</dl></div>` : ''}
      ${p.crowd ? `<div><span class="muted tiny">Usually busy (estimate)</span>${H().bars(p.crowd, n.getHours())}</div>` : ''}
      <div class="btn-row">${menu ? `<a class="btn sm ghost" href="${esc(menu)}" target="_blank" rel="noopener">${icon('external')} Today’s menu</a>` : ''}<button class="btn sm ghost" data-place="${esc(p.id)}">${icon('clock')} Hours</button></div></div>`, 'hall-card');
  }
  TH.screens.food = {
    render() {
      const st = S(); if (st.params.arg === 'order') st.food = 'order'; else if (st.params.arg === 'halls') st.food = 'halls';
      const n = now(), stu = TH.student(), dn = stu.dining || {}, h = hub();
      const halls = TH.PLACES.filter(p => p.hall), shops = TH.PLACES.filter(p => p.order), other = TH.PLACES.filter(p => p.cat === 'dining' && !p.hall && !p.order);
      const active = h.orders.filter(o => o.state !== 'picked' && o.day === TH.dkey(today()));
      const tab = st.food === 'order' ? 'order' : 'halls';
      const shopRow = p => {
        if (TH.orderEta && TH.orderEta.venueRow) return TH.orderEta.venueRow(p); // Part 6: same wait as the order sheet, or your open order
        const s2 = TH.status(p, n), lv = TH.live(p, n);
        return `<button class="row" data-order="${esc(p.id)}" style="--rc:var(--c-dining)"><span class="rico">${icon('bag')}</span><span class="rmain"><span class="rtitle">${esc(p.name)}</span><span class="rsub">${s2.open ? `${H().walkMin(p)} min walk · ready in ~${lv ? lv.value : 8} min (est.)` : esc(s2.open == null ? 'Hours not published' : (s2.detail || 'Closed'))}</span></span><span class="rside">${H().pill(s2)}</span></button>`;
      };
      return `<div class="screen">${H().topbar('Dining')}
        <div class="pad screen-body stack">
          <div class="seg"><button data-ftab="halls" aria-pressed="${tab === 'halls'}">Dining halls</button><button data-ftab="order" aria-pressed="${tab === 'order'}">Order ahead</button></div>
          <div class="grid2">${card(`<span class="muted" style="font-size:12px">Meal swipes left</span><div class="big-num" style="font-size:28px">${dn.swipesLeft ?? '—'}<small class="muted" style="font-size:13px"> of ${dn.swipesTotal ?? '—'}</small></div>`, 'flat')}${card(`<span class="muted" style="font-size:12px">Dining Dollars</span><div class="big-num" style="font-size:28px">${TH.money(dn.diningDollars)}</div>`, 'flat')}</div>
          ${active.map(orderCard).join('')}
          ${tab === 'halls' ? `${halls.map(p => hallCard(p, n)).join('')}<p class="muted tiny">Hours from USC Hospitality. Line lengths are estimates from typical patterns; USC publishes no live counts.</p>`
          : `${TH.orderEta ? `${TH.orderEta.howItWorks()}<div class="section-head p6o-listhead"><h2>Pick a spot</h2><span>${H().est(' wait')} ${simBadge()}</span></div>` : `<p class="muted" style="font-size:13.5px">Pick a real USC Hospitality spot, choose a pickup time while it’s open, and tap “I’m here” when you walk up. ${simBadge()}</p>`}
            <div class="rows">${shops.map(shopRow).join('')}</div>
            ${other.length ? `<div class="section"><div class="section-head"><h2>More places to eat</h2></div><div class="rows">${other.map(p => H().placeRow(p)).join('')}</div></div>` : ''}
            <p class="muted tiny">${esc(TH.ORDER_MENU_NOTE || 'Sample items (simulated).')}</p>`}
          ${src('https://hospitality.usc.edu/hours-of-operation/', 'USC Hospitality · Hours of operation')}
        </div></div>`;
    },
    mount(host) {
      $$('[data-ftab]', host).forEach(b => b.onclick = () => { S().food = b.dataset.ftab; S().params = {}; TH.render(); });
      $$('[data-order]', host).forEach(b => b.onclick = () => TH.openOrder(b.dataset.order));
      $$('[data-here]', host).forEach(b => b.onclick = () => TH.runAct('orderHere', [b.dataset.here], 'Got it! The kitchen is starting your order.'));
      $$('[data-cancel]', host).forEach(b => b.onclick = () => TH.runAct('cancelOrder', [b.dataset.cancel]));
      $$('[data-picked]', host).forEach(b => b.onclick = () => { const o = hub().orders.find(x => x.code === b.dataset.picked); TH.confirmAct('orderPicked', [b.dataset.picked], { title: 'Picked up your order?', ok: 'Yes, picked up', rows: [['Order', '#' + b.dataset.picked], ['Charge', `${TH.money(o ? o.total : 0)} Dining Dollars`], ['Balance now', TH.money(TH.student().dining.diningDollars)]], toast: 'Enjoy! Fight On.' }); });
      const a = S().params.arg; if (a && place(a) && place(a).order) { S().params = {}; setTimeout(() => TH.openOrder(a), 60); }
    },
  };
  TH.openOrder = function (id) {
    const p = place(id); if (!p) return;
    const menu = (TH.ORDER_MENUS || {})[id] || [], cart = {}, menuUrl = (TH.MENU_URLS || {})[id] || p.url;
    const n = now(), m = nowMin(), base = Math.ceil((m + 10) / 5) * 5;
    // same windows everywhere (js/core.js): the first one is the "wait" the Order ahead list shows
    const wins = TH.pickupWindows ? TH.pickupWindows(p, n, 9) : [];
    if (!TH.pickupWindows) for (let t = base; t + 10 <= 1440 && wins.length < 9; t += 10) { const d = new Date(today()); d.setMinutes(t); if (TH.openFor(p, d, 10) === true) wins.push(t); }
    const st = TH.status(p, n);
    let win = wins[0] ?? null;
    const items = () => Object.entries(cart).filter(([, q]) => q > 0).map(([nm, q]) => [nm, q, (menu.find(x => x[0] === nm) || [])[1]]);
    const E = TH.orderEta, readyAt = t => t + ((E && E.waitAt(p, t)) || 6);
    formSheet({
      title: p.name, sub: `${esc(st.label)}${st.detail ? ' · ' + esc(st.detail) : ''} · Today ${esc(TH.rangesText(TH.dayRanges(p, n)))}`, act: 'placeOrder', okClass: '',
      top: `${E ? `<div id="ord-eta">${E.sheetHero(p, win)}</div>` : ''}<p class="muted tiny" style="margin-top:${E ? '0' : '-6px'}">${esc(TH.ORDER_MENU_NOTE || 'Sample items (simulated).')}</p>`,
      fields: `<div class="rows" id="ord-items">${menu.map(([nm, pr]) => `<div class="row"><span class="rmain"><span class="rtitle">${esc(nm)}</span><span class="rsub mono">${TH.money(pr)}</span></span><span class="qty"><button class="iconbtn flat" data-dec="${esc(nm)}" aria-label="Remove one ${esc(nm)}">${icon('minus')}</button><b class="mono" data-q="${esc(nm)}">0</b><button class="iconbtn flat" data-inc="${esc(nm)}" aria-label="Add one ${esc(nm)}">${icon('plus')}</button></span></div>`).join('')}</div>
        ${menuUrl ? `<a class="linkbtn" href="${esc(menuUrl)}" target="_blank" rel="noopener">${icon('external')} See the real menu (USC Hospitality)</a>` : ''}
        <div class="field"><span class="flabel">Pickup time${E && wins.length ? ` <span class="muted p6o-flnote">· est. wait at the counter</span>` : ''}</span>${wins.length ? `<div class="slots">${E ? E.slotHTML(p, wins, win) : wins.map((t, i) => `<button class="slot" data-win="${t}" aria-pressed="${i === 0}">${fmtMin(t)}</button>`).join('')}</div>` : E ? `<p class="muted">No pickup times left today.</p>` : `<p class="muted">No pickup times left today while ${esc(p.name)} is open${st.detail ? ` (${esc(st.detail)})` : ''}.</p>`}</div>
        <p class="muted" style="font-size:12.5px">Pay with Dining Dollars at pickup · balance ${TH.money(TH.student().dining.diningDollars)}</p>`,
      mount: (w, update) => {
        w.addEventListener('click', e => {
          const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), sl = e.target.closest('[data-win]');
          if (inc || dec) { const k = (inc || dec).dataset[inc ? 'inc' : 'dec']; cart[k] = Math.max(0, Math.min(10, (cart[k] || 0) + (inc ? 1 : -1))); $$('[data-q]', w).forEach(x => { if (x.dataset.q === k) x.textContent = cart[k]; }); update(); }
          if (sl) { win = +sl.dataset.win; $$('[data-win]', w).forEach(x => x.setAttribute('aria-pressed', String(x === sl))); const eh = $('#ord-eta', w); if (eh && E) eh.innerHTML = E.sheetHero(p, win); update(); }
        });
      },
      args: () => (items().length && win != null ? [id, items(), win] : null),
      label: () => { const its = items(), tot = its.reduce((s, [, q, pr]) => s + q * (pr || 0), 0); return `${icon('bag')} ${its.length ? `Place order · ${TH.money(tot)}` : 'Add an item'}${win != null ? (E ? ` · ready ~${fmtMin(readyAt(win))}` : ` · ${fmtMin(win)}`) : ''}`; },
      url: menuUrl, urlLabel: 'Real menu', toastIcon: 'bag',
      toast: res => E ? `Order in! Leave by ${fmtMin(Math.max(nowMin(), res.item.window - E.walk(p)))}, then tap “I’m here”.` : `Order placed for ${fmtMin(res.item.window)}. Tap “I’m here” when you arrive.`,
      done: () => { S().food = 'order'; if (S().route === 'food') TH.render(); else TH.go('food'); },
    });
  };

  // =====================================================================
  // TROJAN PASS (return times for real reservable services; simulated)
  // =====================================================================
  const passDef = id => (TH.PASSES || []).find(p => p.id === id);
  TH.screens.pass = {
    render() {
      const h = hub(), key = TH.dkey(today());
      const mine = h.passes.filter(b => b.day >= key).sort((a, b) => (a.day + a.start / 1e4) < (b.day + b.start / 1e4) ? -1 : 1);
      return `<div class="screen">${H().topbar('Trojan Pass')}<div class="pad screen-body stack">
        ${card(`<div class="stack"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><b>Skip the line. Pick a return time.</b>${simBadge()}</div><p class="muted" style="font-size:13.5px">Practice-book real USC services that take reservations. Each one links to where you book it for real.</p></div>`, 'flat')}
        ${mine.map(b => { const ps = passDef(b.id) || { name: b.id, len: 60, icon: 'ticket' }, p = place(ps.where), off = Math.round((TH.parseKey(b.day) - today()) / 864e5);
          return `<div class="wcard id pass-card"><span class="shine"></span><div class="wtop"><div><span class="wlabel">Trojan Pass · ${esc(dayOffLabel(off))}</span><h3>${esc(ps.name)}</h3><span style="opacity:.85;font-size:13px">${esc(p ? p.name : '')}</span></div>${icon(ps.icon || 'ticket')}</div>
            <div class="wtop" style="align-items:flex-end"><span class="countdown" style="color:var(--gold)">${fmtMin(b.start)} – ${fmtMin(b.start + (ps.len || 60))}</span>
              ${b.checked ? `<span class="pill ok">${icon('check')} Checked in</span>` : `<span class="btn-row"><button class="btn sm ghost onwhite" data-pcancel="${esc(b.bid)}">Cancel</button>${off === 0 ? `<button class="btn sm gold" data-checkin="${esc(b.bid)}">Check in</button>` : ''}</span>`}</div>
            <span class="wsim">Simulated</span></div>`; }).join('')}
        <div class="rows">${(TH.PASSES || []).map(ps => { const p = place(ps.where); return `<button class="row" data-pass="${esc(ps.id)}" style="--rc:var(--c-landmark)"><span class="rico">${icon(ps.icon || 'ticket')}</span><span class="rmain"><span class="rtitle">${esc(ps.name)}</span><span class="rsub">${esc(p ? p.name : '')} · ${ps.len} min</span></span>${icon('chev', 'chev')}</button>`; }).join('')}</div>
      </div></div>`;
    },
    mount(host) {
      $$('[data-pass]', host).forEach(b => b.onclick = () => openPass(b.dataset.pass));
      $$('[data-checkin]', host).forEach(b => b.onclick = () => TH.runAct('checkInPass', [b.dataset.checkin], 'Checked in. Enjoy!'));
      $$('[data-pcancel]', host).forEach(b => b.onclick = () => TH.runAct('cancelPass', [b.dataset.pcancel]));
      const a = S().params.arg; if (a && passDef(a)) { S().params = {}; setTimeout(() => openPass(a), 60); }
    },
  };
  function openPass(id) {
    const ps = passDef(id); if (!ps) return; const p = place(ps.where);
    let day = 0, t = null;
    const ahead = id === 'racquetball' ? 2 : 6;
    const slots = d => { const out = []; for (let m = 7 * 60; m + (ps.len || 60) <= 24 * 60; m += 30) { const ck = TH.act.check.bookPass(id, m, d); out.push({ m, ok: !ck.block.length }); } return out.filter(s => s.ok || (d !== 0 || s.m >= nowMin())); };
    formSheet({
      title: ps.name, sub: `${esc(p ? p.name : '')} · ${ps.len} min`, act: 'bookPass', ok: 'Reserve',
      top: `<p class="muted" style="font-size:13.5px">${esc(ps.desc || '')}</p>`,
      fields: `<div class="week pass-days" role="group" aria-label="Day">${Array.from({ length: ahead + 1 }, (_, o) => { const d = TH.addDays(today(), o); return `<button data-pday="${o}" aria-pressed="${o === 0}"><span>${o === 0 ? 'Today' : TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b></button>`; }).join('')}</div>
        <div class="field"><span class="flabel">Return time</span><div id="ps-slots"></div></div>`,
      mount: (w, update) => {
        const draw = () => { const list = slots(day), ok = list.filter(s => s.ok); if (t != null && !ok.some(s => s.m === t)) t = null; if (t == null && ok[0]) t = ok[0].m;
          $('#ps-slots', w).innerHTML = ok.length ? `<div class="slots">${list.map(s => `<button class="slot" data-t="${s.m}" ${s.ok ? '' : 'disabled'} aria-pressed="${s.m === t}">${fmtMin(s.m)}</button>`).join('')}</div>` : `<p class="muted">No open return times that day (hours or your other bookings).</p>`; };
        w.addEventListener('click', e => {
          const d = e.target.closest('[data-pday]'); if (d) { day = +d.dataset.pday; $$('[data-pday]', w).forEach(x => x.setAttribute('aria-pressed', String(x === d))); draw(); update(); }
          const s = e.target.closest('[data-t]'); if (s && !s.disabled) { t = +s.dataset.t; $$('[data-t]', w).forEach(x => x.setAttribute('aria-pressed', String(x === s))); update(); }
        });
        draw();
      },
      args: () => (t == null ? null : [id, t, day]),
      label: () => t == null ? 'Pick a time' : `${icon('ticket')} Reserve ${esc(dayOffLabel(day))} ${fmtMin(t)} – ${fmtMin(t + (ps.len || 60))}`,
      url: ps.url, urlLabel: 'Book for real', toastIcon: 'ticket',
      toast: res => `Booked. Come back ${fmtMin(res.item.start)} – ${fmtMin(res.item.start + (ps.len || 60))}.`,
      done: () => { if (S().route === 'pass') TH.render(true); else TH.go('pass'); },
    });
  }
  TH.openPass = openPass;

  // =====================================================================
  // VIRTUAL LINES (real walk-in services; simulated line)
  // =====================================================================
  const lineDef = id => (TH.QUEUES || []).find(q => q.id === id);
  function confirmJoinLine(id) {
    const q = lineDef(id); if (!q) return; const p = place(q.where);
    TH.confirmAct('joinLine', [id], { title: `Join the line: ${q.name}?`, ok: 'Join line', rows: [['Where', p ? p.name : q.where], ['About', q.desc || '']], url: q.url, urlLabel: 'Official page', toast: 'You’re in line. We’ll tell you when it’s your turn.', done: () => { if (S().route !== 'queue') TH.go('queue'); } });
  }
  TH.screens.queue = {
    render() {
      const n = now(), mine = hub().lines.filter(l => l.state !== 'done');
      return `<div class="screen">${H().topbar('Virtual Lines')}<div class="pad screen-body stack">
        <p class="muted" style="font-size:13.5px">Join a walk-in line from anywhere and wait somewhere comfy. We’ll tell you when it’s your turn. ${simBadge()}</p>
        ${mine.map(l => { const d = lineDef(l.id) || { name: l.id, per: 10 }, p = place(d.where) || { name: d.where }, pct = Math.round((1 - l.pos / Math.max(1, l.startPos)) * 100);
          return card(`<div class="stack"><div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><span class="kindline mono muted">Your line</span><br><b style="font-size:16px">${esc(d.name)}</b><br><span class="muted" style="font-size:13px">${esc(p.name)}</span></div>
            ${l.state === 'called' ? `<span class="pill ok">Your turn</span>` : `<div style="text-align:right"><span class="big-num" style="font-size:34px">#${l.pos}</span><br><span class="muted" style="font-size:12px">~${l.pos * (d.per || 10)} min (est.)</span></div>`}</div>
            <div class="meter"><i style="width:${l.state === 'called' ? 100 : pct}%"></i></div>
            ${l.state === 'called' ? `<div class="banner ok">${icon('check')}<div><b>Head to ${esc(p.name)} now</b><span>Check in at the desk within 10 minutes.</span></div></div><div class="btn-row"><button class="btn" data-walkq="${esc(d.where)}">${icon('walk')} Walk there</button><button class="btn line" data-leave="${esc(l.id)}">I’m done</button></div>`
              : `<div class="btn-row"><button class="btn ghost" data-walkq="${esc(d.where)}">${icon('walk')} Directions</button><button class="btn line" data-leave="${esc(l.id)}">Leave line</button></div>`}</div>`); }).join('')}
        <div class="rows">${(TH.QUEUES || []).map(d => { const inQ = mine.find(l => l.id === d.id), st = TH.status(d.hours ? { hours: d.hours } : (place(d.where) || {}), n), p = place(d.where);
          return `<div class="row" style="--rc:var(--c-health)"><span class="rico">${icon(d.icon || 'queue')}</span><span class="rmain"><span class="rtitle">${esc(d.name)}</span><span class="rsub">${esc(p ? p.name : '')} · ${st.open ? `about ${d.base} ahead (est.)` : esc(st.open == null ? 'Hours not published' : (st.detail || 'Closed now'))}</span></span>
            <span class="rside">${inQ ? `<span class="pill ok">Joined</span>` : `<button class="btn sm" data-join="${esc(d.id)}" ${st.open === false ? 'disabled' : ''}>Join</button>`}</span></div>`; }).join('')}</div>
        <p class="muted tiny">Lines are simulated: your spot moves up every 15 seconds in this demo. Each service is real and walk-in at USC.</p>
      </div></div>`;
    },
    mount(host) {
      $$('[data-join]', host).forEach(b => b.onclick = () => confirmJoinLine(b.dataset.join));
      $$('[data-leave]', host).forEach(b => b.onclick = () => TH.runAct('leaveLine', [b.dataset.leave]));
      $$('[data-walkq]', host).forEach(b => b.onclick = () => { S().pendingRoute = { to: b.dataset.walkq }; TH.go('map'); });
      const a = S().params.arg; if (a && lineDef(a) && !hub().lines.some(l => l.id === a && l.state !== 'done')) { S().params = {}; setTimeout(() => confirmJoinLine(a), 60); }
    },
  };

  // =====================================================================
  // SAFETY
  // =====================================================================
  const SW_FROM = ['me', 'leavey', 'doheny', 'sel', 'lyon', 'villagedh', 'st-expopark', 'st-jeffusc'];
  const SW_TO = ['home', 'parkside', 'villagedh', 'leavey', 'st-jeffusc', 'st-expopark', 'st-expoverm', 'shrine', 'galen', 'p-grand'];
  const swPt = k => k === 'me' ? Object.assign({ name: TH.ME.label }, TH.ME) : k === 'home' ? Object.assign({ name: TH.HOME.label }, TH.HOME) : place(k);
  // short labels so the From/To selects stay readable at phone width
  const swLabel = k => k === 'me' ? 'You (TCC)' : k === 'home' ? 'Home (Cowlings & Ilium)' : ((place(k) || {}).name || k).replace(/\s*\((Metro )?[A-Z][^)]*\)\s*$/, '').replace(/ Residential Dining Hall$/, ' Dining').replace(/ Memorial Library$/, ' Library').replace(/ Station$/, '');
  function alertCard(a) {
    const d = TH.laDate(a.date), ago = Math.round((now() - d) / 36e5);
    const color = a.level === 'alert' ? 'var(--risk-high)' : a.level === 'advisory' ? 'var(--risk-med)' : 'var(--c-transit)';
    return `<div class="card flat alert-card" style="--al:${color}"><span class="mono muted alert-meta">${esc(a.kind || a.level)} · ${esc(TH.fmtDate(d))}${ago >= 0 && ago < 48 ? ` · ${ago}h ago` : ''}</span>
      <b>${esc(a.title)}</b>
      <span class="alert-where">${icon('pin')}${a.sensitive ? 'Location withheld in this app' : esc(a.where || 'Location not given')}</span>
      ${a.body ? `<span style="font-size:13.5px">${esc(a.body)}</span>` : ''}
      ${a.url ? `<a class="linkbtn" href="${esc(a.url)}" target="_blank" rel="noopener">Read the DPS post ↗</a>` : ''}</div>`;
  }
  TH.alertCard = alertCard;
  const sortedAlerts = () => (TH.DPS_ALERTS || []).slice().sort((a, b) => TH.laDate(b.date) - TH.laDate(a.date));
  TH.screens.safety = {
    render() {
      const st = S(), n = now(), hourNow = TH.minOfDay(n) / 60;
      const sh = st.safeHour ?? Math.floor(hourNow), F = st.safeFrom || 'me', To = st.safeTo || 'home', acc = !!st.safeAcc;
      const SF = TH.SAFETY || {}, phones = SF.phones || [], A = SF.access || {};
      const cs = TH.campusStatus ? TH.campusStatus(n) : { controlled: false };
      let safe, fast, err = null;
      try { safe = TH.route(swPt(F), swPt(To), { hour: sh + 0.5, mode: 'safe', accessible: acc }); fast = TH.route(swPt(F), swPt(To), { hour: sh + 0.5, mode: 'fast', accessible: acc }); } catch (e) { err = e.message; }
      const lv = r => TH.riskLevel(r.risk), tone = r => ({ low: 'ok', med: 'warn', high: 'bad' })[lv(r)];
      const night = TH.isNight ? TH.isNight(sh + 0.5) : (sh >= 19 || sh < 6);
      const lyftAt = (() => { const d = new Date(today()); d.setHours(sh, 30); return TH.lyftOpen(d); })();
      const al = sortedAlerts(), showAll = !!st.safeAllAlerts;
      const M = TH.INCIDENTS_META || {};
      const emerg = phones[0], non = phones[1];
      const phoneCard = (p, strong) => p ? `<div class="card ${strong ? 'sos-main' : 'flat'}"><span class="sos-label">${esc(p.label.replace(/ \(UPC and USC Village\)/, ''))}</span><span class="num">${esc(p.number)}</span><div class="btn-row">${telHref(p.number) ? `<a class="btn sm ${strong ? '' : 'ghost'}" href="${telHref(p.number)}" ${strong ? 'style="background:var(--bad);color:#fff"' : ''}>${icon('phone')} Call</a>` : ''}<button class="btn sm ghost" data-copy="${esc(p.number)}">${icon('copy')}</button></div></div>` : '';
      return `<div class="screen">${H().topbar('Safety')}<div class="pad screen-body stack">
        <div class="sos">${phoneCard(emerg, true)}${phoneCard(non, false)}</div>
        <p class="muted tiny" style="margin-top:-4px">DPS answers 24/7 for University Park and USC Village. Off campus, call 911.</p>
        <div class="card flat access-card ${cs.controlled ? 'on' : ''}"><b>${icon('gate')} ${cs.controlled ? 'Controlled access now' : 'Campus is open to the public now'}</b>
          <span style="font-size:13.5px">${esc(cs.controlled ? A.text : (A.daytime || A.text || ''))}</span>
          <span class="muted" style="font-size:12.5px">${esc(A.idCheck || '9 PM – 6 AM')}: only ${esc((A.after9 || []).map(id => (place(id) || {}).name || id).join(' and '))} are open.</span>
          ${src(A.url, 'DPS · Visitor registration & campus access')}</div>
        <div class="section"><div class="section-head"><h2>Safe Walk planner</h2></div>
          ${card(`<div class="stack">
            <div class="grid2 sw-pair"><div class="field"><label for="sw-from">From</label><select id="sw-from">${SW_FROM.filter(k => k === 'me' || place(k)).map(k => `<option value="${k}" ${k === F ? 'selected' : ''}>${esc(swLabel(k))}</option>`).join('')}</select></div>
            <div class="field"><label for="sw-to">To</label><select id="sw-to">${SW_TO.concat(SW_TO.includes(To) ? [] : [To]).filter(k => (k === 'home' && TH.HOME) || place(k)).map(k => `<option value="${k}" ${k === To ? 'selected' : ''}>${esc(swLabel(k))}</option>`).join('')}</select></div></div>
            <div class="field"><label for="sw-hr">Leaving at <b class="mono" style="color:var(--ink)">${fmtMin(sh * 60)}</b></label><input id="sw-hr" type="range" min="0" max="23" value="${sh}"></div>
            <label class="check small"><input type="checkbox" id="sw-acc" ${acc ? 'checked' : ''}> Step-free route (avoid mapped stairs)</label>
            ${err ? `<p class="muted">Couldn’t plan that walk: ${esc(err)}</p>` : `<div class="route-cmp">
              <button class="card flat" data-showroute="safe"><span class="pill ${tone(safe)}" style="justify-self:start">${esc(TH.riskLabel[lv(safe)])}</span><b class="countdown">${safe.minutes} min</b><span class="muted" style="font-size:12px">Fewer-reports route · via ${esc(safe.streets.slice(0, 2).join(', '))}</span></button>
              <button class="card flat" data-showroute="fast"><span class="pill ${tone(fast)}" style="justify-self:start">${esc(TH.riskLabel[lv(fast)])}</span><b class="countdown">${fast.minutes} min</b><span class="muted" style="font-size:12px">Fastest · via ${esc(fast.streets.slice(0, 2).join(', '))}</span></button></div>
            ${safe.pts.join() === fast.pts.join() ? `<p style="font-size:13.5px">The fastest way is also the route with the fewest DPS reports at this hour.</p>` : safe.risk < fast.risk - 0.03 ? `<p style="font-size:13.5px">The fewer-reports route passes fewer recent DPS reports for ${safe.minutes - fast.minutes <= 0 ? 'no extra time' : plural(safe.minutes - fast.minutes, 'extra minute')}.</p>` : ''}
            ${night && lv(safe) !== 'low' && lyftAt ? `<button class="btn block" data-go="rides:lyft" style="${LYFT_PINK}">${icon('car')} Late? Take a free USC Lyft instead</button>` : ''}
            <button class="btn ghost block" data-showroute="safe">${icon('map')} Walk it on the full map</button>`}
          </div>`)}</div>
        <div class="section"><div class="section-head"><h2>Safety map</h2><button data-go="map:safety-layer">Full screen</button></div>
          <div class="card smap" id="smap"></div>
          <div class="legend-row" style="font-size:12px"><span><i style="background:var(--risk-low)"></i>${esc(TH.riskLabel.low)}</span><span><i style="background:var(--risk-med)"></i>${esc(TH.riskLabel.med)}</span><span><i style="background:var(--risk-high)"></i>${esc(TH.riskLabel.high)}</span><span class="muted">at ${fmtMin(sh * 60)}</span></div>
          <span class="muted tiny">${esc(TH.riskCaption || M.caveat || '')}</span></div>
        <div class="section"><div class="section-head"><h2>DPS alerts</h2><span class="muted tiny">${al.length} since ${al.length ? esc(TH.fmtDate(TH.laDate(al[al.length - 1].date))) : '—'}</span></div>
          <div class="stack">${(showAll ? al : al.slice(0, 4)).map(alertCard).join('')}</div>
          ${al.length > 4 ? `<button class="btn ghost" id="al-more">${showAll ? 'Show fewer' : `Show all ${al.length} alerts`}</button>` : ''}
          ${src(M.alertsSource || 'https://dps.usc.edu/category/alerts/', 'USC DPS · Alerts')}</div>
        <div class="section"><div class="section-head"><h2>Help nearby</h2></div>
          <div class="rows">${(SF.programs || []).filter(p => !/Lyft/.test(p.name)).map(p => `<a class="row" href="${esc(p.url)}" target="_blank" rel="noopener" style="--rc:var(--c-safety)"><span class="rico">${icon(/phone/i.test(p.name) ? 'phone' : /Alert/i.test(p.name) ? 'bell' : 'shield')}</span><span class="rmain"><span class="rtitle">${esc(p.name)}</span><span class="rsub wrap">${esc(p.text)}</span></span>${icon('external', 'chev')}</a>`).join('')}</div></div>
        <details class="card flat"><summary class="sumh">More phone numbers</summary><div class="rows" style="margin-top:8px">${phones.slice(2).map(p => `<div class="row flatrow"><span class="rmain"><span class="rtitle">${esc(p.label)}</span><span class="rsub mono">${esc(p.number)}${p.note ? ' · ' + esc(p.note) : ''}</span></span>${telHref(p.number) ? `<a class="btn sm ghost" href="${telHref(p.number)}">${icon('phone')}</a>` : ''}</div>`).join('')}</div>${src((phones[0] || {}).url, 'DPS · Contact')}</details>
        <details class="card flat"><summary class="sumh">How the safety map works</summary><div class="stack" style="margin-top:10px;font-size:13.5px">
          <p><b>Data:</b> ${esc(M.window || 'USC DPS Daily Crime & Fire Log')}${M.total ? ` · ${M.total} reports used (${Object.entries(M.counts || {}).map(([k, v]) => `${v} ${k}`).join(', ')})` : ''}. DPS alerts from the DPS website. Collected Nov 9, 2026.</p>
          <p><b>Method:</b> each street segment is scored from nearby reports, weighted by how close they happened to the hour you pick and by how sure the location is. DPS alerts from the last 12 hours count extra. Only violent, property and personal-safety reports are used; noise, service calls and health or welfare calls are left out.</p>
          <p><b>Ethics:</b> sensitive reports (for example sexual offenses or stalking) only feed the street scores; they never appear as pins or with locations, and victim details are never shown. Scores describe reported incidents on streets at times of day, not neighborhoods or the people who live there.</p>
          <p class="muted"><b>DPS caveat:</b> ${esc(M.dpsCaveat || 'The log lists reports as received and is not proof that a crime occurred.')}</p>
          ${M.geocoding ? `<p class="muted">${esc(M.geocoding)}</p>` : ''}
          ${src(M.source || 'https://dps.usc.edu/alerts/log/', 'USC DPS · Daily Crime & Fire Log')}
          <span class="muted tiny">Street map © OpenStreetMap contributors (ODbL).</span></div></details>
      </div></div>`;
    },
    mount(host) {
      const st = S(), sh = st.safeHour ?? Math.floor(TH.minOfDay(now()) / 60), F = st.safeFrom || 'me', To = st.safeTo || 'home', acc = !!st.safeAcc;
      const el = $('#smap', host);
      try {
        const a = swPt(F), b = swPt(To), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, w = Math.max(600, Math.hypot(a.x - b.x, a.y - b.y) * 1.6);
        TH._smap = new TH.MapView(el, { safety: true, hour: sh + 0.5, filter: p => p.cat === 'safety' || p.cat === 'gate', onSelect: p => TH.openPlace(p.id), view: { x: cx - w / 2, y: cy + w / 2, w, h: w } });
        const safe = TH.route(a, b, { hour: sh + 0.5, mode: 'safe', accessible: acc }), fast = TH.route(a, b, { hour: sh + 0.5, mode: 'fast', accessible: acc });
        setTimeout(() => { if (TH._smap) { TH._smap.showRoute(safe, safe.pts.join() === fast.pts.join() ? null : fast); TH._smap.centerOn && TH._smap.centerOn(cx, cy, w); } }, 80);
      } catch (e) { console.error(e); el.innerHTML = `<div class="empty">${icon('map')}<b>The map couldn’t load</b><span>${esc(e.message)}</span></div>`; }
      $('#sw-from', host).onchange = e => { st.safeFrom = e.target.value; TH.render(true); };
      $('#sw-to', host).onchange = e => { st.safeTo = e.target.value; TH.render(true); };
      $('#sw-acc', host).onchange = e => { st.safeAcc = e.target.checked; if (st.map) st.map.accessible = st.safeAcc; TH.render(true); };
      const hr = $('#sw-hr', host);
      hr.onchange = () => { st.safeHour = +hr.value; TH.render(true); };
      hr.oninput = () => { const lb = hr.previousElementSibling.querySelector('b'); if (lb) lb.textContent = fmtMin(+hr.value * 60); };
      const more = $('#al-more', host); if (more) more.onclick = () => { st.safeAllAlerts = !st.safeAllAlerts; TH.render(true); };
      $$('[data-showroute]', host).forEach(b => b.onclick = () => {
        const to = swPt(To), from = swPt(F);
        if (st.map) st.map.accessible = acc;
        st.pendingRoute = { from: F !== 'me' && F !== 'home' ? F : null, fromPoint: from, to: to.id || null, toPoint: Object.assign({ label: swLabel(To) }, to), hour: sh + 0.5, safety: true };
        const mode = b.dataset.showroute; TH.go('map');
        if (mode === 'fast' && st.activeRoute) { st.activeRoute.mode = 'fast'; TH.render(true); }
      });
    },
  };

  // =====================================================================
  // EVENTS (real EngageSC public events)
  // =====================================================================
  let LOCIDX = null;
  const CODE_ALIASES = { TCC: 'tutor campus center', URC: 'religious center', STU: 'student union', GCS: 'ginsburg', RTH: 'ronald tutor hall', THH: 'taper hall', VKC: 'von kleinsmid', SGM: 'seeley', KAP: 'kaprielian', SAL: 'salvatori computer', LVL: 'leavey', DML: 'doheny', SKS: 'sample hall', WPH: 'waite phillips', ZHS: 'zumberge', ANN: 'wallis annenberg', SWC: 'social work', JFF: 'fertitta', GFS: 'grace ford salvatori', OHE: 'olin hall', PHE: 'powell hall' };
  function mappedLocation(loc) {
    if (!loc || /health science|hsc\b|online|zoom|off-campus/i.test(loc)) return null;
    if (!LOCIDX) {
      LOCIDX = { names: [], codes: {} };
      (TH.PLACES || []).forEach(p => {
        if (p.cat === 'safety' || p.name.length < 6) return;
        const v = { x: p.x, y: p.y, label: p.name, id: p.id }, base = p.name.replace(/\s*\(.*\)\s*$/, '').toLowerCase();
        LOCIDX.names.push([base, v]); if (/^usc /.test(base) && base.length > 12) LOCIDX.names.push([base.slice(4), v]);
        if (p.id === 'bovard') LOCIDX.names.push(['bovard auditorium', v]);
      });
      ((TH.GEO && TH.GEO.buildings) || []).forEach(b => {
        if (!b.usc && b.kind === 'building') return;
        if (b.name && b.name.length >= 6) LOCIDX.names.push([b.name.toLowerCase(), { x: b.x, y: b.y, label: b.name }]);
        if (b.code) LOCIDX.codes[b.code.toUpperCase()] = { x: b.x, y: b.y, label: b.name || b.code };
      });
      LOCIDX.names.sort((a, b) => b[0].length - a[0].length);
      // Common USC building codes → the OSM building whose name contains that text (position still from OSM).
      Object.entries(CODE_ALIASES).forEach(([code, nm]) => { if (LOCIDX.codes[code]) return; const b = ((TH.GEO && TH.GEO.buildings) || []).find(x => x.name && x.name.toLowerCase().includes(nm)); if (b) LOCIDX.codes[code] = { x: b.x, y: b.y, label: b.name }; });
    }
    const l = loc.toLowerCase();
    const hit = LOCIDX.names.find(([nm]) => l.includes(nm)); if (hit) return hit[1];
    const m = loc.match(/\b[A-Z]{2,4}\b/g) || [];
    for (const c of m) if (LOCIDX.codes[c]) return LOCIDX.codes[c];
    return null;
  }
  TH.eventPlace = mappedLocation;
  const evCats = () => (TH.EVENT_CATS || ['Free food']);
  TH.screens.events = {
    render() {
      const st = S(), all = TH.events(), day = st.eventsDay || 0, cat = st.eventsCat || null, q = (st.eventsQ || '').trim();
      const n = now();
      const popTags = ['#FreeFood', '#AI', '#Robotics', '#Career', '#Networking', '#Social', '#Wellness', '#PreMed', '#Arts', '#Gaming'];
      return `<div class="screen">${H().topbar('Events')}<div class="pad screen-body stack">
        <label class="searchbox">${icon('search')}<span class="sr">Search events</span><input id="ev-q" type="search" placeholder="Search events, clubs, hashtags (#ai, #robotics)…" value="${esc(q)}" autocomplete="off"></label>
        
        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:2px;" role="toolbar" aria-label="Popular Hashtags">
          ${popTags.map(t => `<button class="hashtag-pill" data-hashtag="${esc(t)}" style="${q.toLowerCase() === t.toLowerCase() ? 'background:var(--cardinal);color:#fff;' : ''}">${esc(t)}</button>`).join('')}
        </div>

        <div class="week ev-days" role="group" aria-label="Pick a day">${Array.from({ length: 14 }, (_, o) => { const d = TH.addDays(today(), o); const has = all.some(e => e.off === o && e.food && !e.multiDay); return `<button data-eday="${o}" aria-pressed="${o === day && !q}"><span>${o === 0 ? 'Today' : TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b>${has ? '<span class="evdot" title="Free food"></span>' : '<span class="evdot none"></span>'}</button>`; }).join('')}</div>
        
        <div class="chips" role="toolbar" aria-label="Event categories"><button class="chip" data-ecat="" aria-pressed="${!cat}">All</button>${evCats().map(c => `<button class="chip" data-ecat="${esc(c)}" aria-pressed="${cat === c}" ${c === 'Free food' ? 'style="--chip-c:var(--gold-ink)"' : ''}>${c === 'Free food' ? icon('star') : ''}${esc(c)}</button>`).join('')}</div>
        
        <div id="ev-list">${eventsList(all, day, cat, q, n)}</div>
        <p class="muted tiny">Public events from EngageSC (engage.usc.edu/rss_events), verified and accurate. Recommendations powered by hashtags and Netflix-style thumbs up/down feedback.</p>
      </div></div>`;
    },
    mount(host) {
      const st = S();
      $$('[data-eday]', host).forEach(b => b.onclick = () => { st.eventsDay = +b.dataset.eday; st.eventsQ = ''; TH.render(true); });
      $$('[data-ecat]', host).forEach(b => b.onclick = () => { st.eventsCat = b.dataset.ecat || null; TH.render(true); });
      const qi = $('#ev-q', host); let tmr;
      qi.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { st.eventsQ = qi.value; $('#ev-list', host).innerHTML = eventsList(TH.events(), st.eventsDay || 0, st.eventsCat || null, qi.value.trim(), now()); $$('[data-eday]', host).forEach(x => x.setAttribute('aria-pressed', String(!qi.value.trim() && +x.dataset.eday === (st.eventsDay || 0)))); }, 200); };
      
      host.addEventListener('click', e => {
        // Thumbs rating click
        const thBtn = e.target.closest('[data-evth]');
        if (thBtn) {
          e.stopPropagation();
          const id = thBtn.dataset.evid;
          const vote = +thBtn.dataset.evth;
          const ev = TH.eventById(id);
          if (ev) {
            TH.setEventFeedback(id, vote, { title: ev.title, orgId: ev.orgId, cats: ev.cats, hashtags: TH.getEventHashtags(ev) });
          }
          return;
        }
        // Open event click
        const openBtn = e.target.closest('[data-openev]');
        if (openBtn) {
          e.stopPropagation();
          TH.openEvent(openBtn.dataset.openev);
          return;
        }
        // Hashtag click
        const hashBtn = e.target.closest('[data-hashtag]');
        if (hashBtn) {
          e.stopPropagation();
          const tag = hashBtn.dataset.hashtag;
          st.eventsQ = tag;
          if (qi) qi.value = tag;
          $('#ev-list', host).innerHTML = eventsList(TH.events(), st.eventsDay || 0, st.eventsCat || null, tag, now());
          $$('[data-eday]', host).forEach(x => x.setAttribute('aria-pressed', 'false'));
          return;
        }
      });

      const a = st.params.arg;
      if (a) { st.params = {}; if (evCats().includes(a)) { st.eventsCat = a; TH.render(true); } else if (TH.eventById(a)) setTimeout(() => TH.openEvent(a), 60); else { st.eventsQ = a; TH.render(true); } }
    },
  };

  function eventsList(all, day, cat, q, n) {
    const onCal = new Set(hub().calendar.map(x => String(x.ref)));
    const catOk = e => !cat || (cat === 'Free food' ? e.food : e.cats.includes(cat));
    let list = [], ongoing = [], title = '', multiDayNotice = '';

    if (q) {
      const words = q.toLowerCase().split(/\s+/);
      list = all.filter(e => e.e >= n && catOk(e) && words.every(w => {
        const htags = (TH.getEventHashtags(e) || []).join(' ');
        return (e.title + ' ' + (e.org || '') + ' ' + (e.location || '') + ' ' + e.cats.join(' ') + ' ' + htags).toLowerCase().includes(w);
      })).slice(0, 60);
      title = `${list.length} upcoming match${list.length === 1 ? '' : 'es'}`;
    } else {
      const d = TH.addDays(today(), day), dk = TH.dkey(d), dEnd = TH.addDays(d, 1);
      const dayList = all.filter(e => e.off === day && !e.multiDay && catOk(e) && (day > 0 || e.e >= n || e.allDay));

      // CORE USER REQUIREMENT:
      // "If there is only one event under a category, don’t have it for only one day, show multiple calendar events.
      // Showing all events for a day is less important than showing more relevant results for the people."
      if (cat && dayList.length <= 1) {
        list = all.filter(e => catOk(e) && e.e >= n && !e.multiDay).slice(0, 40);
        title = `Upcoming ${cat} Events · ${plural(list.length, 'calendar event')} across upcoming days`;
        multiDayNotice = `<div class="multi-day-notice">${icon('sparkle')}<span><strong>Multiple calendar events shown:</strong> Found ${dayList.length ? 'only 1 event on this day' : 'no events on this day'} for ${esc(cat)}. Showing relevant ${esc(cat)} calendar events across upcoming days.</span></div>`;
      } else {
        list = dayList;
        ongoing = all.filter(e => (e.multiDay || (e.allDay && e.off !== day)) && e.s < dEnd && e.e >= d && e.dkey !== dk && catOk(e));
        title = `${TH.DAYS[d.getDay()]}, ${TH.MONTHS[d.getMonth()]} ${d.getDate()} · ${plural(list.length, 'event')}`;
      }
    }

    // Rank events by relevance (Netflix-style match score):
    list.sort((a, b) => {
      const ma = TH.calcEventMatch(a);
      const mb = TH.calcEventMatch(b);
      if (ma.disliked && !mb.disliked) return 1;
      if (!ma.disliked && mb.disliked) return -1;
      return (mb.score - ma.score) || (a.s - b.s);
    });

    const row = e => {
      const c = (TH.EV_COLORS || {})[e.food ? 'Free food' : (e.cats.find(x => (TH.EV_COLORS || {})[x]) || '')] || ['#445a77'];
      const match = TH.calcEventMatch(e);
      const fb = match.liked ? 1 : match.disliked ? -1 : 0;
      const tags = match.hashtags || TH.getEventHashtags(e);
      const isMulti = q || (cat && all.filter(x => x.off === day && !x.multiDay && catOk(x)).length <= 1) || e.off !== day;
      const dateLabel = isMulti ? `${TH.MONTHS[e.date.getMonth()].slice(0, 3)} ${e.date.getDate()}` : (e.allDay ? 'All<br>day' : fmtMin(e.start).replace(' ', '<br>'));
      const timeSub = isMulti ? `${e.allDay ? 'All day' : fmtMin(e.start)} · ${esc(e.org || '')}` : esc(e.org || '');

      return `<div class="row ev-row ${match.disliked ? 'ev-demoted' : ''}" style="--rc:${c[0]}; display:flex; align-items:flex-start; gap:10px; padding:10px 12px;">
        <span class="rico ev-time" style="margin-top:2px;"><small>${isMulti ? dateLabel : ''}</small>${isMulti ? (e.allDay ? 'All day' : fmtMin(e.start)) : (e.allDay ? 'All<br>day' : fmtMin(e.start).replace(' ', '<br>'))}</span>
        <button class="rmain" data-openev="${esc(e.id)}" style="flex:1; min-width:0; text-align:left; background:none; border:none; padding:0; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="rtitle" style="font-weight:700;">${esc(e.title)}</span>
            <span class="netflix-match">${match.pct}% Match</span>
          </div>
          <span class="rsub" style="font-size:12.5px;">${timeSub}</span>
          ${e.location ? `<span class="rsub" style="font-size:12px;">${icon('pin')}${esc(TH.shortLoc(e.location))}</span>` : ''}
          <div class="ev-hashtags-wrap">
            ${tags.slice(0, 4).map(t => `<span class="hashtag-pill" data-hashtag="${esc(t)}">${esc(t)}</span>`).join('')}
          </div>
          ${match.why ? `<span class="muted tiny" style="color:var(--ok); font-size:11.5px; display:inline-flex; align-items:center; gap:3px; margin-top:2px;">${icon('sparkle')} ${esc(match.why)}</span>` : ''}
        </button>
        <div class="ev-rate-box">
          <button class="th-btn up ${fb === 1 ? 'active' : ''}" data-evth="1" data-evid="${esc(e.id)}" title="Recommend more like this (Thumbs Up)" aria-label="Thumbs up">${icon('up')}</button>
          <button class="th-btn down ${fb === -1 ? 'active' : ''}" data-evth="-1" data-evid="${esc(e.id)}" title="Not for me (Thumbs Down)" aria-label="Thumbs down">${icon('dn')}</button>
        </div>
      </div>`;
    };

    return `${multiDayNotice}
      <p class="muted" style="font-size:13px; display:flex; justify-content:space-between; align-items:center;">
        <span>${esc(title)}${cat ? ` · ${esc(cat)}` : ''}</span>
        <span class="muted tiny" style="font-weight:600;">Netflix-style relevance</span>
      </p>
      ${list.length ? `<div class="rows">${list.map(row).join('')}</div>` : `<div class="empty">${icon('calendar')}<b>No ${cat ? esc(cat.toLowerCase()) + ' ' : ''}events ${q ? 'match' : 'this day'}</b><span>Try another day or clear the filter.</span></div>`}
      ${list.some(e => !e.location) ? `<p class="muted tiny">Events without a location show it on EngageSC after you sign in there.</p>` : ''}
      ${ongoing.length ? `<details class="card flat"><summary class="sumh">Ongoing listings (${ongoing.length})</summary><div class="rows" style="margin-top:8px">${ongoing.slice(0, 20).map(row).join('')}</div></details>` : ''}`;
  }

  // Event sheet (overrides the shell's basic sheet with a walk-there button and the EngageSC .ics link)
  TH.openEvent = function (id) {
    const e = TH.eventById(id); if (!e) { TH.toast('That event isn’t in EngageSC’s public calendar', 'alert'); return; }
    const onCal = hub().calendar.find(x => String(x.ref) === String(e.id));
    const club = TH.clubById(e.orgId), spot = mappedLocation(e.location);
    const ended = TH.laDate(e.end || e.start) < now();
    const desc = (e.desc || '').length > 600 ? e.desc.slice(0, 600) + '…' : (e.desc || '');
    const [c1, c2] = (TH.EV_COLORS || {})[e.food ? 'Free food' : ((e.tags || []).find(t => (TH.EV_COLORS || {})[t]) || '')] || ['#990000', '#4a0507'];
    const hashtags = TH.getEventHashtags(e);
    const match = TH.calcEventMatch(e);
    const fb = match.liked ? 1 : match.disliked ? -1 : 0;
    const html = `<div class="stack">
      <div class="ev-art" style="background:linear-gradient(135deg, ${c1}, ${c2})"><span>${e.food ? '★ Free food' : esc((e.tags || [])[0] || e.type || 'Event')}</span><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <h2>${esc(e.title)}</h2>
        <span class="netflix-match" style="margin-top:4px;">${match.pct}% Match</span>
      </div>
      <div class="ev-hashtags-wrap">
        ${hashtags.map(t => `<span class="hashtag-pill" data-hashtag="${esc(t)}">${esc(t)}</span>`).join(' ')}
      </div>
      <dl class="kv"><dt>When</dt><dd>${esc(TH.when(e))} <span class="muted">(Pacific)</span></dd>
        <dt>Where</dt><dd>${esc(e.location || 'Location shown after EngageSC sign-in')}</dd>
        <dt>Host</dt><dd>${club ? `<button class="linkbtn" data-club="${esc(club.id)}">${esc(e.org)}</button>` : esc(e.org || '—')}</dd></dl>
      ${e.food ? `<p class="muted tiny">Free food ${e.foodBasis === 'mentioned_in_description' ? 'is mentioned in the description (not flagged by the host)' : 'flagged by the host on EngageSC'}.</p>` : ''}
      ${desc ? `<p class="muted" style="white-space:pre-line;font-size:14px">${esc(desc)}</p>` : ''}
      
      <!-- Netflix-style Thumbs Up / Down Bar -->
      <div class="card flat" style="padding:10px 12px; display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border-radius:var(--r-sm);">
        <div>
          <b style="font-size:13px; display:block;">Recommend events like this?</b>
          <span class="muted tiny">${match.why ? esc(match.why) : 'Thumbs up or down helps Tommy recommend similar events'}</span>
        </div>
        <div class="ev-rate-box">
          <button class="th-btn up ${fb === 1 ? 'active' : ''}" id="ev-sheet-th-up" title="Thumbs Up (More like this)" aria-label="Thumbs up">${icon('up')}</button>
          <button class="th-btn down ${fb === -1 ? 'active' : ''}" id="ev-sheet-th-dn" title="Thumbs Down (Fewer like this)" aria-label="Thumbs down">${icon('dn')}</button>
        </div>
      </div>

      <div class="stack">
        ${ended ? `<p class="muted">This event has ended.</p>` : onCal ? `<button class="btn line block" id="ev-unsave">${icon('check')} On My Day${onCal.kind === 'club' ? ' (club event)' : ''} · Remove</button>` : `<button class="btn block" id="ev-save">${icon('calendar-plus')} Add to My Day</button>`}
        ${spot && !ended ? `<button class="btn ghost block" id="ev-walk">${icon('walk')} Walk there · ${esc(spot.label)}</button>` : ''}
        ${!ended && e.ical ? `<a class="btn ghost block" href="${esc(e.ical)}" target="_blank" rel="noopener">${icon('calendar-plus')} Add to phone calendar</a>` : ''}
        ${e.url ? `<a class="btn ghost block" href="${esc(e.url)}" target="_blank" rel="noopener">${icon('external')} RSVP on EngageSC</a>` : ''}
      </div>
      ${H().sim(e.url, 'RSVP on EngageSC')}
    </div>`;
    TH.sheet(html, w => {
      const sheetThUp = $('#ev-sheet-th-up', w);
      if (sheetThUp) sheetThUp.onclick = () => {
        TH.setEventFeedback(e.id, 1, { title: e.title, orgId: e.orgId, cats: e.cats, hashtags });
        TH.closeSheet();
        setTimeout(() => TH.openEvent(e.id), 60);
      };
      const sheetThDn = $('#ev-sheet-th-dn', w);
      if (sheetThDn) sheetThDn.onclick = () => {
        TH.setEventFeedback(e.id, -1, { title: e.title, orgId: e.orgId, cats: e.cats, hashtags });
        TH.closeSheet();
        setTimeout(() => TH.openEvent(e.id), 60);
      };
      const sv = $('#ev-save', w); if (sv) sv.onclick = () => TH.confirmAct('saveEvent', [e.id], { title: 'Add to My Day?', ok: 'Add', rows: [['Event', e.title], ['When', TH.when(e)], ['Where', e.location || 'Shown after EngageSC sign-in']], url: e.url, urlLabel: 'RSVP on EngageSC', toast: 'Added to My Day' });
      const un = $('#ev-unsave', w); if (un) un.onclick = () => { if (onCal.kind === 'club') { TH.toast('Club events stay while you’re a member. Leave the club to remove them.', 'info'); return; } TH.closeSheet(); TH.runAct('unsaveEvent', [e.id]); };
      const wk = $('#ev-walk', w); if (wk) wk.onclick = () => { S().pendingRoute = spot.id ? { to: spot.id } : { toPoint: { x: spot.x, y: spot.y, label: spot.label, name: spot.label } }; TH.go('map'); };
    });
  };

  // =====================================================================
  // WALLET
  // =====================================================================
  const NEXT_GAME = { date: '2026-11-21', opp: 'Maryland', where: 'Los Angeles Memorial Coliseum', src: 'https://hospitality.usc.edu/game-day/' };
  TH.screens.wallet = {
    render() {
      const stu = TH.student(), d = hasTA() ? TA.State.d : {}, h = hub(), card0 = stu.uscard || {}, frozen = card0.status === 'frozen';
      const permit = (d.parking && d.parking.permit) || null, saved = h.parking && place(h.parking.at);
      const u = h.upass, log = ((d.log || []).filter(x => x && x.action)).slice(0, 8);
      const gd = TH.parseKey(NEXT_GAME.date), gOff = Math.round((gd - today()) / 864e5);
      return `<div class="screen">${H().topbar('Trojan Wallet')}<div class="pad screen-body stack">
        <div class="wcard id ${frozen ? 'frozen' : ''}"><span class="shine"></span><div class="wtop"><div><span class="wlabel">USCard · Student${frozen ? ' · Frozen' : ''}</span><h3>${esc(stu.full)}</h3><span style="opacity:.85;font-size:13px">${esc(stu.standing)} · ${esc(stu.major)}</span></div><span class="avatar" style="background:var(--gold)">${icon('user')}</span></div>
          <div class="code"><canvas data-code="${esc(stu.uscid)}" data-rotate="1" width="240" height="56"></canvas></div>
          <div class="wtop"><span class="mono" style="font-size:12px">USC ID ${esc(stu.uscid)}</span><span class="mono" style="font-size:12px">${frozen ? 'Card frozen' : 'Demo code'}</span></div>
          ${frozen ? `<span class="frozen-tag">${icon('alert')} Frozen: ask Tommy to unfreeze or replace it</span>` : ''}</div>
        <div class="grid2">${card(`<span class="muted" style="font-size:12px">Dining Dollars</span><div class="big-num" style="font-size:26px">${TH.money(stu.dining.diningDollars)}</div>`)}${card(`<span class="muted" style="font-size:12px">Meal swipes</span><div class="big-num" style="font-size:26px">${stu.dining.swipesLeft ?? '—'}<small class="muted" style="font-size:13px"> of ${stu.dining.swipesTotal ?? '—'}</small></div>`)}</div>
        ${card0.discretionary != null ? `<div class="row flatrow"><span class="rico" style="--rc:var(--cardinal)">${icon('wallet')}</span><span class="rmain"><span class="rtitle">USCard Discretionary</span><span class="rsub">${frozen ? 'Can’t be spent while the card is frozen' : 'Balance on the demo account'}</span></span><span class="rside"><b class="mono">${TH.money(card0.discretionary)}</b></span></div>` : ''}
        ${u ? `<button class="wbtn" data-go="upass">${metroCard(u)}</button>` : `<button class="card flat lyftbar" data-go="upass" style="width:100%;text-align:left"><span class="metro-logo">M</span><span style="flex:1"><b>Add your Metro U-Pass</b><br><span class="muted" style="font-size:13px">No extra cost for USC students</span></span>${icon('chev')}</button>`}
        <div class="wcard park" style="min-height:0"><div class="wtop"><div><span class="wlabel">Parking</span><h3>${permit ? esc(permit.name) : 'No parking permit'}</h3><span style="opacity:.85;font-size:13px">${permit ? esc([permit.term, permit.plate].filter(Boolean).join(' · ')) : 'Buy daily or semester permits from USC Transportation'}</span></div>${icon('parking')}</div>
          ${saved ? `<div class="park-saved"><span>${icon('pin')} Saved spot: <b>${esc(saved.name)}</b>${h.parking.level ? ' · ' + esc(h.parking.level) : ''}</span><div class="btn-row"><button class="btn sm gold" data-place="${esc(saved.id)}">Find my car</button><button class="btn sm ghost onwhite" id="park-clear">Clear</button></div></div>` : `<div class="btn-row"><button class="btn sm ghost onwhite" data-go="rides:parking">${icon('parking')} Save my spot</button>${permit ? '' : `<a class="btn sm ghost onwhite" href="${esc((T().parking || {}).permitsUrl || 'https://transnet.usc.edu/')}" target="_blank" rel="noopener">Permits ↗</a>`}</div>`}</div>
        ${gOff >= 0 ? `<button class="wbtn" data-go="gameday"><div class="wcard game"><div class="wtop"><div><span class="wlabel">Football · next home game</span><h3>USC vs. ${esc(NEXT_GAME.opp)}</h3><span style="font-size:13px">${esc(TH.fmtDate(gd, true))} · ${esc(NEXT_GAME.where)} · kickoff time not published yet</span></div>${icon('football')}</div><div class="code"><canvas data-code="GAME-${esc(stu.uscid)}" width="240" height="56"></canvas></div><span class="wsim dark">Simulated ticket · not valid for entry</span></div></button>` : ''}
        <div class="section"><div class="section-head"><h2>Recent activity by Tommy</h2><button data-go="assistant">Ask Tommy</button></div>
          ${log.length ? `<div class="rows">${log.map(x => `<div class="row flatrow"><span class="rico" style="--rc:var(--gold-ink)">${icon(x.system === 'Trojan Hub' ? 'check' : 'sparkle')}</span><span class="rmain"><span class="rtitle wrap">${esc(x.action)}</span><span class="rsub">${x.at ? esc(TH.fmtDate(new Date(x.at)) + ' ' + fmtTime(new Date(x.at))) : ''}${x.system ? ' · ' + esc(x.system) : ''}</span></span>${x.conf ? `<span class="rside"><span class="mono conf">${esc(x.conf)}</span></span>` : ''}</div>`).join('')}</div>`
          : `<p class="muted">Nothing yet. When you or Tommy do something on your account, it shows up here with a confirmation code.</p>`}</div>
        <p class="muted tiny">Cards here are simulated for the demo student. The real USCard and permits come from USC’s own systems.</p>
      </div></div>`;
    },
    mount(host) {
      drawCodes(host);
      const t = setInterval(() => { if (!document.body.contains(host)) return clearInterval(t); drawCodes(host, true); }, 30000);
      const pc = $('#park-clear', host); if (pc) pc.onclick = () => TH.runAct('clearParking', []);
    },
  };
  function drawCodes(root, rotateOnly) {
    $$('canvas[data-code]', root).forEach(cv => {
      if (rotateOnly && !cv.dataset.rotate) return;
      const ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
      const seedStr = cv.dataset.code + (cv.dataset.rotate ? Math.floor(Date.now() / 30000) : '');
      let s = 0; for (const c of seedStr) s = (s * 31 + c.charCodeAt(0)) >>> 0;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#111';
      let x = 6; while (x < cv.width - 6) { s = (s * 1664525 + 1013904223) >>> 0; const w = 1 + (s % 4); if ((s >> 5) & 1) ctx.fillRect(x, 4, w, cv.height - 8); x += w + 1 + ((s >> 9) % 2); }
    });
  }
  TH.drawCodes = drawCodes;

  // =====================================================================
  // ALERTS
  // =====================================================================
  TH.screens.alerts = {
    render() {
      const notes = TH.notes ? TH.notes() : [];
      const ago = n => { const m = Math.round((Date.now() - n.at) / 60000); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
      const al = sortedAlerts().slice(0, 5);
      return `<div class="screen">${H().topbar('Alerts', true, notes.some(n => !n.read) ? `<button class="btn sm ghost" id="mark-read">Mark all read</button>` : '')}<div class="pad screen-body stack">
        ${notes.length ? `<div class="rows">${notes.map(n => `<button class="row note-row ${n.read ? '' : 'unread'}" data-note="${esc(n.id)}" style="--rc:${n.read ? 'var(--c-service)' : 'var(--cardinal)'}"><span class="rico">${icon(/DPS|Alert/i.test(n.title) ? 'shield' : 'bell')}</span><span class="rmain"><span class="rtitle">${esc(n.title)}</span><span class="rsub wrap">${esc(n.body || '')}</span></span><span class="rside"><span class="muted" style="font-size:11px">${ago(n)}</span></span></button>`).join('')}</div>`
          : `<div class="empty">${icon('bell')}<b>No notifications</b><span>Order updates, line calls and reminders show up here.</span></div>`}
        <div class="section"><div class="section-head"><h2>Latest from USC DPS</h2><button data-go="safety">Safety</button></div>
          <div class="stack">${al.map(alertCard).join('')}</div>
          ${src('https://dps.usc.edu/category/alerts/', 'USC DPS · Alerts')}</div>
      </div></div>`;
    },
    mount(host) {
      const mr = $('#mark-read', host); if (mr) mr.onclick = () => { TH.notes().forEach(n => { n.read = true; }); if (hasTA()) TA.State.save(); TH.render(true); };
      $$('[data-note]', host).forEach(b => b.onclick = () => {
        const n = TH.notes().find(x => x.id === b.dataset.note); if (!n) return;
        n.read = true; if (hasTA()) TA.State.save();
        if (n.place && place(n.place)) { TH.openPlace(n.place); return; }
        if (n.go) { const i = n.go.indexOf(':'); TH.go(i < 0 ? n.go : n.go.slice(0, i), i < 0 ? null : { arg: n.go.slice(i + 1) }); } else TH.render(true);
      });
      setTimeout(() => { if (S().route !== 'alerts') return; let ch = false; TH.notes().forEach(n => { if (!n.read) { n.read = true; ch = true; } }); if (ch && hasTA()) TA.State.save(); if (TH.updateBadge) TH.updateBadge(); }, 2500);
    },
  };

  // =====================================================================
  // GAME DAY
  // =====================================================================
  TH.screens.gameday = {
    render() {
      const SF = (TH.SAFETY || {}).gameDay || {}, Tg = T().gameDay || {};
      const gd = TH.parseKey(NEXT_GAME.date), days = Math.round((gd - today()) / 864e5);
      return `<div class="screen">${H().topbar('Game Day')}<div class="pad screen-body stack">
        <div class="wcard game"><div class="wtop"><div><span class="wlabel">Next home game</span><h3>USC vs. ${esc(NEXT_GAME.opp)}</h3><span style="font-size:13px">${esc(TH.fmtDate(gd, true))} · ${esc(NEXT_GAME.where)}</span></div>${icon('football')}</div>
          <div class="gd-count"><div><div class="big-num">${Math.max(0, days)}</div><span>${days === 1 ? 'day' : 'days'} to go</span></div><div class="gd-kick">Kickoff time<br><b>not published yet</b></div></div></div>
        <label class="card flat check" style="align-items:center"><input type="checkbox" id="gd-toggle" ${S().gameday ? 'checked' : ''}><span><b>Game Day mode</b><br><span class="muted" style="font-size:13px">Gold home screen and Coliseum shortcuts.</span></span></label>
        ${card(`<div class="stack"><b>${icon('bag')} Clear bag rule</b><p style="font-size:13.5px">${esc((SF.clearBag || '').replace(/\s*\(Stated on.*$/, ''))}</p><span class="muted tiny">USC’s clear-bag page says the rule is “similar to the one used at USC Athletics events”.</span>${src('https://commencement.usc.edu/clear-bag-policy/', 'USC · Clear bag policy')}</div>`, 'flat')}
        <div class="section"><div class="section-head"><h2>What changes on game day</h2></div>
          <ul class="plain gd-list">${(Tg.changes || SF.changes || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
          ${Tg.shuttle ? `<p style="font-size:13.5px">${esc(Tg.shuttle)}</p>` : ''}
          ${src(Tg.url || 'https://transnet.usc.edu/index.php/gameday/', 'USC Transportation · Game day')}</div>
        <div class="rows">
          <button class="row" data-go="wallet" style="--rc:var(--gold-ink)"><span class="rico">${icon('ticket')}</span><span class="rmain"><span class="rtitle">Ticket in Wallet</span><span class="rsub">Simulated ticket for the demo</span></span>${icon('chev', 'chev')}</button>
          <button class="row" data-place="coliseum" style="--rc:var(--cardinal)"><span class="rico">${icon('pin')}</span><span class="rmain"><span class="rtitle">Los Angeles Memorial Coliseum</span><span class="rsub">Walk there from campus</span></span>${icon('chev', 'chev')}</button>
          <button class="row" data-go="rides" style="--rc:var(--c-transit)"><span class="rico">${icon('train')}</span><span class="rmain"><span class="rtitle">Getting there</span><span class="rsub">Metro E Line: Expo Park/USC station</span></span>${icon('chev', 'chev')}</button>
        </div>
        ${SF.ticketScams ? `<div class="banner info">${icon('shield')}<div><b>Ticket scams</b><span>${esc(SF.ticketScams)}</span></div></div>` : ''}
        <p class="muted tiny">Student gate locations, gate times and tailgate zones are published by USC Athletics and aren’t verified here, so this app doesn’t show them.</p>
      </div></div>`;
    },
    mount(host) { $('#gd-toggle', host).onchange = e => { S().gameday = e.target.checked; if (TH.saveUI) TH.saveUI(); TH.toast(S().gameday ? 'Game Day mode on. Fight On!' : 'Game Day mode off', 'football'); }; },
  };

  // =====================================================================
  // ACCESSIBILITY
  // =====================================================================
  TH.screens.access = {
    render() {
      const osas = place('osas');
      const rr = TH.PLACES.filter(p => p.cat === 'restroom' && !p.inferred && (p.features || []).some(f => /all-gender|gender-neutral/i.test(f)));
      const g24 = ((TH.SAFETY || {}).access || {}).after9 || [];
      return `<div class="screen">${H().topbar('Accessibility')}<div class="pad screen-body stack">
        ${osas ? card(`<div class="stack"><b>${esc(osas.name)}</b><p style="font-size:13.5px">${esc(osas.desc || '')}</p>${osas.phone ? `<span class="mono">${esc(osas.phone)}</span>` : ''}<div class="btn-row"><button class="btn sm ghost" data-place="osas">${icon('pin')} Hours &amp; map</button>${osas.phone && telHref(osas.phone) ? `<a class="btn sm ghost" href="${telHref(osas.phone)}">${icon('phone')} Call</a>` : ''}</div>${src((osas.sources || [])[0] || osas.url, 'OSAS · Contact')}</div>`, 'flat') : ''}
        ${card(`<div class="stack"><b>${icon('car')} DART for temporary mobility issues</b><p style="font-size:13.5px">DART, run by USC Transportation, is a free service for USC students, faculty and staff with temporary mobility issues. For a temporary injury you can also request accommodations through OSAS.</p>${src('https://osas.usc.edu/current-students/accommodation-information/', 'OSAS · Accommodation information')}</div>`, 'flat')}
        <div class="section"><div class="section-head"><h2>Step-free walking</h2></div>
          <p style="font-size:13.5px">USC doesn’t publish which gates are step-free. Trojan Hub can plan a route that avoids stairs mapped in OpenStreetMap. Check the route before you go: not every step is mapped.</p>
          <button class="btn ghost" id="acc-route">${icon('access')} Plan a step-free walk</button></div>
        <div class="section"><div class="section-head"><h2>Open 24/7</h2></div>
          <div class="rows">${g24.map(place).filter(Boolean).map(p => H().placeRow(p, ' · staffed 24/7')).join('')}</div></div>
        <div class="section"><div class="section-head"><h2>All-gender restrooms</h2></div>
          <div class="rows">${rr.map(p => H().placeRow(p)).join('')}</div>
          <p class="muted" style="font-size:12.5px">At USC all single-stall restrooms are gender-inclusive.</p>
          ${src('https://lgbtqplus.usc.edu/services-and-resources/transusc/all-gender-restrooms/', 'USC LGBTQ+ Student Center · All-gender restrooms')}</div>
      </div></div>`;
    },
    mount(host) { $('#acc-route', host).onclick = () => { S().safeAcc = true; if (S().map) S().map.accessible = true; TH.go('safety'); }; },
  };

  // =====================================================================
  // ABOUT
  // =====================================================================
  const SOURCES = [
    ['Campus map', 'OpenStreetMap buildings, paths and streets (© OpenStreetMap contributors, ODbL), extract from Jun 1, 2026', 'https://www.openstreetmap.org/copyright'],
    ['Hours, places, transport', 'USC Hospitality, USC Libraries, Recreational Sports, USC Transportation, Student Health and OSAS pages, checked Nov 9, 2026', 'https://transnet.usc.edu/'],
    ['Clubs and events', '2,000 groups from the public EngageSC directory and its public events feed, Nov 9, 2026', 'https://engage.usc.edu/club_signup?view=all&'],
    ['Safety', 'USC DPS 60-day Daily Crime & Fire Log (Sep 6 – Nov 8, 2026) and DPS alert posts (Sep 13 – Nov 3, 2026)', 'https://dps.usc.edu/alerts/log/'],
    ['Ask Tommy', 'Trojan Assist knowledge base built from official USC pages, Nov 9, 2026', null],
  ];
  const SIMULATED = ['Wait times, crowding, open seats and parking occupancy (labeled “Est.”)', 'Every account action: joining clubs, RSVPs, mobile orders, Trojan Pass, virtual lines, Lyft and Zipcar requests, U-Pass sign-up, parking', 'Menu items in mobile order (USC publishes the real menus on its own site)', 'The demo student Jordan Rivera, the USCard code and the game ticket'];
  TH.screens.about = {
    render() {
      return `<div class="screen">${H().topbar('About Trojan Hub')}<div class="pad screen-body stack">
        <p style="font-size:14.5px">USC students juggle a dozen apps and sites for rides, food, safety, clubs and events. Trojan Hub puts them in one place, modeled on how the Disneyland app runs a whole park from one screen.</p>
        <div class="section"><div class="section-head"><h2>Disneyland app → Trojan Hub</h2></div>
          <div class="rows">${(TH.CONCEPTS || []).map(([d, u, go]) => `<button class="concept" data-go="${esc(go)}"><span><b>Disneyland app</b>${esc(d)}</span><span><b>Trojan Hub</b>${esc(u)}</span></button>`).join('')}</div></div>
        <div class="section"><div class="section-head"><h2>Where the data comes from</h2></div>
          <div class="rows">${SOURCES.map(([t, d, u]) => `<${u ? `a href="${esc(u)}" target="_blank" rel="noopener"` : 'div'} class="row flatrow"><span class="rmain"><span class="rtitle">${esc(t)}</span><span class="rsub wrap">${esc(d)}</span></span>${u ? icon('external', 'chev') : ''}</${u ? 'a' : 'div'}>`).join('')}</div></div>
        <div class="section"><div class="section-head"><h2>What’s simulated</h2></div>
          <ul class="plain">${SIMULATED.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          <p class="muted" style="font-size:13px">Nothing in this app reaches a USC system. Each simulated action links to the real page where you can do it for real.</p></div>
        <p class="muted tiny">Student prototype, not an official USC app. Map data © OpenStreetMap contributors (ODbL). USC, EngageSC, Lyft, Zipcar and LA Metro names belong to their owners.</p>
      </div></div>`;
    },
  };
})(window.TH = window.TH || {});

