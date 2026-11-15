/* js/actions.js */
/* Trojan Hub — account actions (TH.act.*), shared by the native UI and by Tommy (js/ta/hub-actions.js).
 *
 * Every action validates against REAL rules from the research data (Lyft service hours, venue hours,
 * one-booking-per-day limits, slot conflicts, club membership…), throws Error(userFacingMessage) when
 * blocked, mutates ONLY TA.State.d (via TH.H()), and returns {title, rows:[[k,v]], log, item}.
 * TH.act.check.X(...) returns {block:[], warn:[]} with the same rules for confirm sheets.
 * All of these are SIMULATED on the demo student (Jordan Rivera); nothing reaches a USC system.
 *
 * Native UI flow:  confirm sheet → TH.act.X() → TH.commit(log) → toast
 * Tommy flow:      TA action run() → TH.act.X() only (TA's execute logs, saves and snapshots for Undo)
 */
(function (TH) {
  'use strict';
  const D = () => { if (!window.TA || !TA.State || !TA.State.d) throw new Error('Your account is still loading. Try again in a moment.'); return TA.State.d; };

  // ---------- Hub account state, inside Trojan Assist's store (one student, one store, one Undo) ----------
  TH.H = () => { const d = D(); return d.hub || (d.hub = {
    calendar: [], clubs: [], orders: [], passes: [], lines: [], ride: null, zips: [], upass: null, parking: null, lyftUsedUSD: 0, notes: null,
  }); };
  // Ensure every list exists even if an older/partial hub object was stored.
  function hub() {
    const h = TH.H();
    ['calendar', 'clubs', 'orders', 'passes', 'lines', 'zips'].forEach(k => { if (!Array.isArray(h[k])) h[k] = []; });
    if (h.ride === undefined) h.ride = null; if (h.upass === undefined) h.upass = null; if (h.parking === undefined) h.parking = null;
    if (typeof h.lyftUsedUSD !== 'number') h.lyftUsedUSD = 0;
    return h;
  }
  TH.commit = function (logText) {
    if (!window.TA || !TA.State) return;
    TA.State.log({ action: logText, system: 'Trojan Hub', conf: TA.confNo ? TA.confNo('TH') : null });
    TA.State.save();
  };

  // ---------- helpers ----------
  const now = () => TH.clock.now();
  const nowMin = () => TH.minOfDay(now());
  const today = () => TH.dayStart(now());
  const uid = () => (window.TA && TA.uid) ? TA.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const nowISO = () => TH.laISO(now());
  const fmtMin = m => TH.fmtMin(m);
  const range = (a, b) => `${fmtMin(a)} – ${fmtMin(b)}`;
  const overlap = (a1, b1, a2, b2) => a1 < b2 && a2 < b1;
  const R = () => ({ block: [], warn: [] });
  function dayOf(day) { // undefined | offset number | 'YYYY-MM-DD' | Date  →  local midnight Date
    if (day == null || day === '') return today();
    if (typeof day === 'number') return TH.addDays(today(), day);
    if (day instanceof Date) return TH.dayStart(day);
    return TH.parseKey(day);
  }
  const at = (day, min) => { const d = new Date(day); d.setHours(0, 0, 0, 0); d.setMinutes(min); return d; };
  const offOf = day => Math.round((TH.dayStart(day) - today()) / 864e5);
  const dayLabel = day => { const o = offOf(day); return o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : TH.fmtDate(day); };
  const place = id => (TH.byId || {})[id] || null;
  const placeName = id => (place(id) || {}).name || id;
  function hoursHint(p, date) { const r = TH.dayRanges(p, date); return r == null ? 'hours not published' : `hours that day: ${TH.rangesText(r)}`; }

  // Classes from Trojan Assist's real Fall 2026 sections (USC Schedule of Classes) on a date
  TH.classesOn = function (date) {
    const d = window.TA && TA.State && TA.State.d; if (!d) return [];
    const iso = TH.dkey(date), P = TA.POLICY || {}, cal = P.cal || {};
    let term = null; Object.keys(cal).forEach(t => { if (iso >= cal[t].classesBegin && iso <= cal[t].classesEnd) term = t; });
    if (!term || (P.holidays && P.holidays[iso])) return [];
    const L = 'UMTWHFS'.charAt(date.getDay()), mins = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
    const out = [];
    TA.State.termCourses(term).forEach(c => (c.sections || []).forEach(x => {
      if (String(x[2] || '').toUpperCase().indexOf(L) < 0) return;
      const a = mins(x[3]), b = mins(x[4]); if (a == null || b == null) return;
      out.push({ start: a, end: b, code: c.code, type: x[1], title: c.title, section: x[0], instructor: x[5] || '', term });
    }));
    return out.sort((p, q) => p.start - q.start);
  };
  const classClash = (day, a, b) => TH.classesOn(day).find(c => overlap(a, b, c.start, c.end));

  // ---------- clubs & events (real EngageSC data) ----------
  const CLUB_WINDOW_DAYS = 45;
  // Upcoming, dated, timed events of a club: not all-day, not multi-day (semester-long "office hours"), within ~45 days.
  TH.clubEvents = function (clubId, days = CLUB_WINDOW_DAYS) {
    const n = now(), lim = TH.addDays(n, days);
    return (TH.CLUB_EVENTS || []).filter(e => String(e.orgId) === String(clubId) && !e.allDay && !e.multiDay && e.start)
      .map(e => [e, TH.laDate(e.start)]).filter(([, s]) => s >= n && s <= lim).sort((a, b) => a[1] - b[1]).map(([e]) => e);
  };
  TH.when = function (e) {
    const s = TH.laDate(e.start), en = e.end ? TH.laDate(e.end) : null;
    if (e.allDay) return `${TH.fmtDate(s)} · all day`;
    const sameDay = en && TH.dkey(en) === TH.dkey(s);
    return `${TH.fmtDate(s)}, ${TH.fmtTime(s)}${en ? (sameDay ? ' – ' + TH.fmtTime(en) : ' – ' + TH.fmtDate(en) + ' ' + TH.fmtTime(en)) : ''}`;
  };
  const calItem = (e, kind) => ({ id: 'cal-' + uid(), kind, ref: e.id, title: e.title, start: e.start, end: e.end || e.start, where: e.location || null, url: e.url || null, ical: e.ical || null, org: e.org || null, orgId: e.orgId ?? null });
  const joined = id => hub().clubs.find(c => String(c.id) === String(id));

  const A = {}; // spec: name → {check(...args) → {block, warn, ctx}, run(ctx, ...args) → result}

  A.joinClub = {
    check(clubId) {
      const r = R(), c = TH.clubById(clubId);
      if (!c) { r.block.push('That group isn’t in the EngageSC directory.'); return r; }
      if (joined(c.id)) r.block.push(`You’re already a member of ${c.name}.`);
      if (c.registered === false) r.warn.push('EngageSC marks this group “Not Registered Yet” for this year.');
      if (c.open === false) r.warn.push('Online joining is closed for this group on EngageSC; officers may ask you to reach out directly.');
      const evs = TH.clubEvents(c.id);
      if (!evs.length) r.warn.push('No upcoming public events are listed for this group yet, so nothing will be added to your calendar.');
      r.ctx = { c, evs };
      return r;
    },
    run({ c, evs }) {
      const h = hub(), when = nowISO();
      h.clubs.push({ id: c.id, name: c.name, joinedAt: when });
      const orgs = (D().life || (D().life = { orgs: [], rsvps: [] })).orgs || (D().life.orgs = []);
      if (!orgs.some(o => o.name === c.name)) orgs.push({ name: c.name, status: 'member', at: when });
      let added = 0;
      evs.forEach(e => { if (!h.calendar.some(x => String(x.ref) === String(e.id))) { h.calendar.push(calItem(e, 'club')); added++; } });
      return {
        title: `You joined ${c.name}`,
        rows: [['Group', c.name], ['Added to your calendar', added ? `${added} upcoming event${added === 1 ? '' : 's'}` : 'No upcoming public events yet'], ...(evs[0] ? [['Next', `${evs[0].title} · ${TH.when(evs[0])}`]] : []), ['Join for real', c.url || 'engage.usc.edu']],
        log: `Joined ${c.name} (simulated EngageSC membership)${added ? ` and added ${added} event${added === 1 ? '' : 's'} to My Day` : ''}`,
        item: { club: h.clubs[h.clubs.length - 1], added },
      };
    },
  };
  A.leaveClub = {
    check(clubId) { const r = R(), m = joined(clubId); if (!m) r.block.push('You’re not a member of that group.'); r.ctx = { m }; return r; },
    run({ m }) {
      const h = hub(), before = h.calendar.length;
      h.clubs = h.clubs.filter(c => String(c.id) !== String(m.id));
      h.calendar = h.calendar.filter(x => !(x.kind === 'club' && String(x.orgId) === String(m.id)));
      const life = D().life; if (life && life.orgs) life.orgs = life.orgs.filter(o => o.name !== m.name);
      const removed = before - h.calendar.length;
      return { title: `You left ${m.name}`, rows: [['Group', m.name], ['Removed from calendar', `${removed} event${removed === 1 ? '' : 's'}`]], log: `Left ${m.name}${removed ? ` and removed ${removed} club event${removed === 1 ? '' : 's'} from My Day` : ''}`, item: { club: m, removed } };
    },
  };
  A.saveEvent = {
    check(eventId) {
      const r = R(), e = TH.eventById(eventId);
      if (!e) { r.block.push('That event isn’t in EngageSC’s public calendar.'); return r; }
      const s = TH.laDate(e.start), en = TH.laDate(e.end || e.start);
      if (en < now()) r.block.push(`${e.title} has already ended.`);
      const have = hub().calendar.find(x => String(x.ref) === String(e.id));
      if (have) r.block.push(have.kind === 'club' ? `${e.title} is already on your calendar (from ${have.org || 'a club you joined'}).` : `${e.title} is already on your calendar.`);
      if (e.multiDay) r.warn.push(`This listing spans ${e.spanDays || 'several'} days on EngageSC; it’s added as one long calendar entry.`);
      else if (e.allDay) r.warn.push('This is an all-day listing.');
      else { const k = classClash(TH.dayStart(s), TH.minOfDay(s), TH.minOfDay(s) + Math.max(15, Math.round((en - s) / 60000))); if (k && TH.dkey(s) === TH.dkey(en)) r.warn.push(`Overlaps your ${k.code} ${k.type} (${range(k.start, k.end)}).`); }
      if (!e.location) r.warn.push('EngageSC shows the location only to registered attendees.');
      r.ctx = { e };
      return r;
    },
    run({ e }) {
      const h = hub(); h.calendar.push(calItem(e, 'event'));
      const life = D().life || (D().life = { orgs: [], rsvps: [] }); (life.rsvps || (life.rsvps = [])).push({ id: e.id, title: e.title, at: nowISO() });
      return { title: 'Added to your calendar', rows: [['Event', e.title], ['When', TH.when(e)], ['Host', e.org || '—'], ['RSVP for real', e.url || 'engage.usc.edu']], log: `Saved ${e.title} (${TH.when(e)}) to My Day`, item: h.calendar[h.calendar.length - 1] };
    },
  };
  A.unsaveEvent = {
    check(eventId) { const r = R(), items = hub().calendar.filter(x => String(x.ref) === String(eventId)); if (!items.length) r.block.push('That event isn’t on your calendar.'); r.ctx = { items }; return r; },
    run({ items }, eventId) {
      const h = hub(); h.calendar = h.calendar.filter(x => String(x.ref) !== String(eventId));
      const life = D().life; if (life && life.rsvps) life.rsvps = life.rsvps.filter(x => String(x.id) !== String(eventId));
      return { title: 'Removed from your calendar', rows: [['Event', items[0].title]], log: `Removed ${items[0].title} from My Day`, item: items[0] };
    },
  };

  // ---------- mobile order (real venues + real hours; sample items; simulated) ----------
  function normItems(placeId, items) {
    const menu = (TH.ORDER_MENUS || {})[placeId] || [];
    return (items || []).map(it => Array.isArray(it) ? it : [it.name, it.qty ?? it.q ?? 1, it.price]).map(([name, qty, price]) => {
      const m = menu.find(x => x[0] === name);
      return [String(name || ''), Math.round(+qty || 0), m ? m[1] : +price];
    });
  }
  A.placeOrder = {
    check(placeId, items, windowMin) {
      const r = R(), p = place(placeId);
      if (!p) { r.block.push('That venue isn’t on the map.'); return r; }
      if (!p.order) { r.block.push(`${p.name} doesn’t take mobile orders in this app.`); return r; }
      const list = normItems(placeId, items), menu = (TH.ORDER_MENUS || {})[placeId] || [];
      if (!list.length) r.block.push('Add at least one item.');
      list.forEach(([n, q, pr]) => {
        if (!n || !(q >= 1)) r.block.push('Each item needs a quantity of at least 1.');
        else if (q > 10) r.block.push(`Up to 10 of each item (${n}).`);
        if (menu.length && !menu.some(x => x[0] === n)) r.block.push(`“${n}” isn’t on this venue’s sample menu.`);
        if (!(pr >= 0)) r.block.push(`No price for ${n}.`);
      });
      const total = Math.round(list.reduce((s, [, q, pr]) => s + (q || 0) * (pr || 0), 0) * 100) / 100;
      const nm = nowMin(), w = windowMin == null ? Math.ceil((nm + 10) / 5) * 5 : Math.round(+windowMin);
      if (!(w >= 0)) r.block.push('Pick a pickup time.');
      else if (w < nm + 5) r.block.push('Pick a pickup time at least 5 minutes from now.');
      else if (w + 10 > 1440) r.block.push('Pickup has to be today.');
      else {
        const open = TH.openFor(p, at(today(), w), 10);
        if (open === false) r.block.push(`${p.name} isn’t open at ${fmtMin(w)} (${hoursHint(p, today())}).`);
        if (open === null) r.block.push(`USC hasn’t published ${p.name}’s hours for today, so a pickup can’t be scheduled.`);
      }
      const dd = (D().dining || {}).diningDollars ?? 0;
      if (total > dd) r.block.push(`Your Dining Dollars balance (${TH.money(dd)}) doesn’t cover ${TH.money(total)}.`);
      if (hub().orders.filter(o => o.state !== 'picked' && o.day === TH.dkey(today())).length >= 3) r.block.push('You already have 3 open orders today. Pick one up first.');
      r.ctx = { p, list, total, w };
      return r;
    },
    run({ p, list, total, w }) {
      const h = hub(); let code; do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (h.orders.some(o => o.code === code));
      const o = { code, at: p.id, items: list, total, window: w, day: TH.dkey(today()), state: 'placed', hereAt: null, placedAt: Date.now() };
      h.orders.push(o);
      return { title: 'Order placed', rows: [['Venue', p.name], ['Items', list.map(([n, q]) => `${q}× ${n}`).join(', ')], ['Total', `${TH.money(total)} Dining Dollars (charged at pickup)`], ['Pickup', range(w, w + 10)], ['Order code', code]], log: `Placed mobile order ${code} at ${p.name} for pickup ${range(w, w + 10)} (${TH.money(total)})`, item: o };
    },
  };
  const findOrder = code => hub().orders.find(o => String(o.code) === String(code));
  A.orderHere = {
    check(code) {
      const r = R(), o = findOrder(code);
      if (!o) r.block.push('No order with that code.');
      else if (o.state !== 'placed') r.block.push(o.state === 'picked' ? 'That order was already picked up.' : 'The kitchen already has that order.');
      else if (o.day !== TH.dkey(today())) r.block.push('That order is for another day.');
      else if (nowMin() < o.window - 30) r.block.push(`Too early. Tap “I’m here” within 30 minutes of your ${fmtMin(o.window)} pickup.`);
      r.ctx = { o }; return r;
    },
    run({ o }) { o.state = 'preparing'; o.hereAt = Date.now(); return { title: 'The kitchen is making your order', rows: [['Venue', placeName(o.at)], ['Code', o.code]], log: `Checked in for order ${o.code} at ${placeName(o.at)}`, item: o }; },
  };
  A.orderPicked = {
    check(code) {
      const r = R(), o = findOrder(code);
      if (!o) r.block.push('No order with that code.');
      else if (o.state === 'picked') r.block.push('That order was already picked up.');
      else if (o.state !== 'ready') r.block.push('That order isn’t ready yet.');
      const dd = (D().dining || {}).diningDollars ?? 0;
      if (o && o.state === 'ready' && o.total > dd) r.block.push(`Your Dining Dollars balance (${TH.money(dd)}) doesn’t cover ${TH.money(o.total)}.`);
      r.ctx = { o }; return r;
    },
    run({ o }) {
      const dn = D().dining; dn.diningDollars = Math.round((dn.diningDollars - o.total) * 100) / 100;
      o.state = 'picked'; o.pickedAt = Date.now();
      return { title: 'Enjoy!', rows: [['Order', o.code], ['Charged', `${TH.money(o.total)} Dining Dollars`], ['Balance', TH.money(dn.diningDollars)]], log: `Picked up order ${o.code} at ${placeName(o.at)}; charged ${TH.money(o.total)} Dining Dollars`, item: o };
    },
  };
  A.cancelOrder = {
    check(code) { const r = R(), o = findOrder(code); if (!o) r.block.push('No order with that code.'); else if (o.state !== 'placed') r.block.push('Orders can be canceled only before you tap “I’m here”.'); r.ctx = { o }; return r; },
    run({ o }) { const h = hub(); h.orders = h.orders.filter(x => x !== o); return { title: 'Order canceled', rows: [['Order', o.code], ['Venue', placeName(o.at)]], log: `Canceled mobile order ${o.code} at ${placeName(o.at)}`, item: o }; },
  };

  // ---------- Trojan Pass (return times for real reservable services; simulated) ----------
  const passDef = id => (TH.PASSES || []).find(p => p.id === id);
  const passLen = def => def.len || 60;
  A.bookPass = {
    check(passId, startMin, day) {
      const r = R(), def = passDef(passId);
      if (!def) { r.block.push('That reservation type doesn’t exist.'); return r; }
      const p = place(def.where), dDay = dayOf(day), off = offOf(dDay), s = Math.round(+startMin), len = passLen(def);
      if (!(s >= 0 && s + len <= 1440 + 0)) { r.block.push('Pick a start time.'); return r; }
      if (off < 0) r.block.push('That day has passed.');
      else if (off === 0 && s < nowMin()) r.block.push(`${fmtMin(s)} has already passed today.`);
      const ahead = def.id === 'racquetball' ? 2 : 7;
      if (off > ahead) r.block.push(def.id === 'racquetball' ? 'Racquetball courts open for booking two days ahead.' : 'You can book up to a week ahead.');
      if (p) {
        const open = TH.openFor(p, at(dDay, s), len);
        if (open === false) r.block.push(`${p.name} is closed for part of ${range(s, s + len)} (${hoursHint(p, dDay)}).`);
        if (open === null) r.warn.push(`USC doesn’t publish ${p.name}’s hours for that day; confirm the time when you book for real.`);
      }
      const key = TH.dkey(dDay), mine = hub().passes;
      if (def.id === 'writing') { if (mine.some(b => b.id === 'writing' && Math.abs(offOf(TH.parseKey(b.day)) - off) < 7)) r.block.push('The Writing Center allows one 50-minute session per week.'); }
      else if (mine.some(b => b.id === def.id && b.day === key)) r.block.push(`You already have a ${def.name} that day (limit one per day).`);
      const clash = mine.find(b => b.day === key && overlap(s, s + len, b.start, b.start + passLen(passDef(b.id) || {})));
      if (clash) r.block.push(`That overlaps your ${(passDef(clash.id) || {}).name || 'other booking'} at ${fmtMin(clash.start)}.`);
      const k = classClash(dDay, s, s + len); if (k) r.warn.push(`Overlaps your ${k.code} ${k.type} (${range(k.start, k.end)}).`);
      r.ctx = { def, p, dDay, s, len };
      return r;
    },
    run({ def, p, dDay, s, len }) {
      const b = { bid: 'b-' + uid(), id: def.id, start: s, day: TH.dkey(dDay), bookedAt: Date.now(), checked: false };
      hub().passes.push(b);
      return { title: 'Trojan Pass booked', rows: [['Reservation', def.name], ['Where', p ? p.name : def.where], ['Day', dayLabel(dDay)], ['Return time', range(s, s + len)], ['Book for real', def.url || '—']], log: `Booked ${def.name} for ${dayLabel(dDay)} ${range(s, s + len)}`, item: b };
    },
  };
  const findPass = bid => hub().passes.find(b => b.bid === bid);
  A.checkInPass = {
    check(bid) {
      const r = R(), b = findPass(bid);
      if (!b) { r.block.push('No booking found.'); return r; }
      const def = passDef(b.id) || {}, len = passLen(def), nm = nowMin();
      if (b.checked) r.block.push('You already checked in.');
      else if (b.day !== TH.dkey(today())) r.block.push(`That booking is for ${dayLabel(TH.parseKey(b.day))}.`);
      else if (nm < b.start - 15) r.block.push(`Check-in opens at ${fmtMin(b.start - 15)}.`);
      else if (nm > b.start + len) r.block.push('That return window has ended.');
      r.ctx = { b, def }; return r;
    },
    run({ b, def }) { b.checked = true; b.checkedAt = Date.now(); return { title: 'Checked in', rows: [['Reservation', def.name || b.id], ['Window', range(b.start, b.start + passLen(def))]], log: `Checked in for ${def.name || b.id}`, item: b }; },
  };
  A.cancelPass = {
    check(bid) { const r = R(), b = findPass(bid); if (!b) r.block.push('No booking found.'); else if (b.checked) r.block.push('You already checked in for that booking.'); r.ctx = { b }; return r; },
    run({ b }) { const h = hub(), def = passDef(b.id) || {}; h.passes = h.passes.filter(x => x !== b); return { title: 'Booking canceled', rows: [['Reservation', def.name || b.id], ['Was', `${dayLabel(TH.parseKey(b.day))} ${fmtMin(b.start)}`]], log: `Canceled ${def.name || b.id} (${b.day} ${fmtMin(b.start)})`, item: b }; },
  };

  // ---------- virtual lines (real walk-in services; simulated line) ----------
  const lineDef = id => (TH.QUEUES || []).find(q => q.id === id);
  const activeLine = id => hub().lines.find(l => l.id === id && l.state !== 'done');
  A.joinLine = {
    check(lineId) {
      const r = R(), q = lineDef(lineId);
      if (!q) { r.block.push('That line doesn’t exist.'); return r; }
      const pseudo = q.hours ? { hours: q.hours } : place(q.where);
      const open = pseudo ? TH.openFor(pseudo, now(), 0) : null;
      if (activeLine(q.id)) r.block.push(`You’re already in the ${q.name} line.`);
      else if (open === false) r.block.push(`${q.name} isn’t taking walk-ins right now (${hoursHint(pseudo, today())}).`);
      else if (open === null) r.warn.push('Walk-in hours aren’t published for today.');
      if (hub().lines.filter(l => l.state === 'waiting').length >= 2) r.block.push('You can be in up to 2 virtual lines at once.');
      r.ctx = { q }; return r;
    },
    run({ q }) {
      const n = now(), pos = Math.max(1, (q.base || 3) + (n.getMinutes() % 3));
      const l = { id: q.id, pos, startPos: pos, state: 'waiting', joinedAt: Date.now(), lastStep: Date.now() };
      hub().lines.push(l);
      return { title: 'You’re in line', rows: [['Line', q.name], ['Where', placeName(q.where)], ['Your spot', `#${pos}`], ['Estimated wait', `~${pos * (q.per || 10)} min (estimate)`]], log: `Joined the ${q.name} virtual line at #${pos}`, item: l };
    },
  };
  A.leaveLine = {
    check(lineId) { const r = R(), l = activeLine(lineId); if (!l) r.block.push('You’re not in that line.'); r.ctx = { l }; return r; },
    run({ l }) { const h = hub(), q = lineDef(l.id) || {}; h.lines = h.lines.filter(x => x !== l); return { title: 'You left the line', rows: [['Line', q.name || l.id]], log: `Left the ${q.name || l.id} virtual line`, item: l }; },
  };

  // ---------- USC Lyft (real program hours and rules; ride is simulated) ----------
  const lyft = () => (TH.TRANSPORT && TH.TRANSPORT.lyft) || {};
  // Home football game days (UPC): USC Lyft starts 5 h after the scheduled kickoff or at normal hours, whichever is
  // later. Kickoff times aren't published yet, so the evening of a game day is "unknown" (null), never "running".
  TH.gameDays = function () {
    const g = TH.SAFETY && TH.SAFETY.gameDay, out = [];
    [g && g.nextHomeGame].concat((g && g.homeGames) || []).forEach(x => { const m = /\d{4}-\d{2}-\d{2}/.exec(String(x || '')); if (m && !out.includes(m[0])) out.push(m[0]); });
    return out;
  };
  TH.lyftGameDay = function (date) { // the game day whose Lyft evening `date` falls in, or null
    const d = date || now(), m = TH.minOfDay(d), k = TH.dkey(d), y = TH.dkey(TH.addDays(d, -1)), G = TH.gameDays();
    return G.includes(k) ? k : (G.includes(y) && m < 6 * 60 ? y : null);
  };
  TH.lyftOpen = function (date) { // true / false / null (game-day evening: start time depends on an unpublished kickoff)
    const L = lyft(), d = date || now();
    let open;
    if (L.hours) open = TH.openFor({ hours: L.hours }, d, 0) === true;
    else { const [a, b] = (L.span || ['19:00', '02:00']).map(s => TH.hoursHelpers.t(s)), m = TH.minOfDay(d); open = b < a ? (m >= a || m < b) : (m >= a && m < b); }
    return open && TH.lyftGameDay(d) ? null : open;
  };
  TH.lyftGameText = () => lyft().gameDay || 'Fall home football game days: starts 5 hours after scheduled kickoff or at normal hours, whichever is later.';
  // obviously outside the USC Lyft zone (east of Normandie, south of Washington, west of Main, north of MLK)
  const OUT_OF_ZONE = /\b(new york|nyc|brooklyn|chicago|boston|seattle|portland,? or|san francisco|san jose|oakland|sacramento|san diego|las vegas|phoenix|texas|tx|nevada|nv|arizona|az|oregon|washington state|florida|fl|santa monica|venice|malibu|pasadena|burbank|glendale|long beach|irvine|anaheim|culver city|beverly hills|hollywood|west hollywood|santa clarita|torrance|inglewood|lax|airport|union station|health sciences|hsc|keck hospital|dtla|downtown la|downtown los angeles|koreatown|silver lake|echo park)\b/i;
  TH.lyftOutOfZone = to => OUT_OF_ZONE.test(String(to || '')) || (/\b[A-Z]{2}\s+\d{5}\b/.test(String(to || '')) && !/\bCA\s+\d{5}\b/.test(String(to || '')));
  A.requestLyft = {
    check(toLabel, fromLabel) {
      const r = R(), L = lyft(), h = hub();
      if (!toLabel || !String(toLabel).trim()) r.block.push('Where to?');
      if (h.ride && h.ride.state !== 'done') r.block.push('You already have a ride on the way.');
      const op = TH.lyftOpen(now());
      if (op === false) r.block.push(`USC Lyft runs ${L.hoursText || '7 PM – 2 AM daily'}. ${L.afterHours || 'Outside those hours, call DPS at (213) 740-6000 for an escort.'}`);
      if (op === null) r.warn.push(`Home game day: ${TH.lyftGameText()} The kickoff time isn’t published yet, so USC Lyft may not be running right now.`);
      if (TH.lyftOutOfZone(toLabel)) r.block.push('That destination is outside the USC Lyft zone, so the ride wouldn’t be free. ' + ((L.boundary && L.boundary.text) || ''));
      if (L.boundary && L.boundary.text) r.warn.push(`Free only inside the zone: ${L.boundary.text}`);
      r.warn.push('Choose “Shared” in Lyft; LUX, scheduled rides, added stops and tips are not covered.');
      r.ctx = { to: String(toLabel || '').trim(), from: String(fromLabel || (TH.ME && TH.ME.label) || 'Your location').trim() };
      return r;
    },
    run({ to, from }) {
      const eta = 3 + (Math.floor(Date.now() / 60000) % 5);
      const ride = { state: 'arriving', to, from, driver: 'Lyft driver (simulated)', car: 'Shared ride', plate: 'SIM-' + String(Math.floor(Math.random() * 900) + 100), eta, left: eta, t0: Date.now() };
      hub().ride = ride;
      return { title: 'Ride requested', rows: [['From', from], ['To', to], ['Pickup in', `~${eta} min`], ['Cost', 'Free if the ride qualifies (USC Lyft Rides)'], ['Ride for real', 'Lyft app → Payment → “USC Lyft Rides”']], log: `Requested a USC Lyft ride from ${from} to ${to}`, item: ride };
    },
  };
  A.endRide = {
    check() { const r = R(), ride = hub().ride; if (!ride || ride.state === 'done') r.block.push('You don’t have an active ride.'); r.ctx = { ride }; return r; },
    run({ ride }) { hub().ride = null; return { title: ride.state === 'here' ? 'Ride complete' : 'Ride canceled', rows: [['To', ride.to]], log: `${ride.state === 'here' ? 'Finished' : 'Canceled'} USC Lyft ride to ${ride.to}`, item: ride }; },
  };

  // ---------- Zipcar (real program terms; no car inventory is published, so no car names) ----------
  A.reserveZip = {
    check(startMin, hours, day) {
      const r = R(), dDay = dayOf(day), off = offOf(dDay), s = Math.round(+startMin), hrs = +hours;
      if (!(s >= 0 && s < 1440)) r.block.push('Pick a start time.');
      if (!(hrs >= 1 && hrs <= 12 && Math.round(hrs) === hrs)) r.block.push('Reserve 1 to 12 whole hours.');
      if (off < 0) r.block.push('That day has passed.');
      else if (off === 0 && s < nowMin()) r.block.push(`${fmtMin(s)} has already passed today.`);
      if (off > 14) r.block.push('Book up to two weeks ahead in this demo.');
      const key = TH.dkey(dDay), clash = hub().zips.find(z => z.day === key && overlap(s, s + hrs * 60, z.start, z.start + z.hours * 60));
      if (clash) r.block.push(`That overlaps your Zipcar at ${fmtMin(clash.start)}.`);
      r.warn.push('Needs a Zipcar membership (USC students: free the first year, then $35/year; 18+).');
      r.ctx = { dDay, s, hrs }; return r;
    },
    run({ dDay, s, hrs }) {
      const z = { id: 'zip-' + uid(), start: s, hours: hrs, day: TH.dkey(dDay) };
      hub().zips.push(z);
      return { title: 'Zipcar reserved', rows: [['Car', 'Zipcar at USC (pick a car in the Zipcar app)'], ['When', `${dayLabel(dDay)} ${range(s, s + hrs * 60)}`], ['Reserve for real', 'zipcar.com / Zipcar app']], log: `Reserved a Zipcar for ${dayLabel(dDay)} ${range(s, s + hrs * 60)}`, item: z };
    },
  };
  A.cancelZip = {
    check(id) { const r = R(), z = hub().zips.find(x => x.id === id); if (!z) r.block.push('No Zipcar reservation found.'); r.ctx = { z }; return r; },
    run({ z }) { const h = hub(); h.zips = h.zips.filter(x => x !== z); return { title: 'Zipcar canceled', rows: [['Was', `${z.day} ${fmtMin(z.start)}`]], log: `Canceled Zipcar reservation (${z.day} ${fmtMin(z.start)})`, item: z }; },
  };

  // ---------- Metro U-Pass (real eligibility and steps; enrollment simulated) ----------
  A.enrollUpass = {
    check(delivery) {
      const r = R(), u = hub().upass;
      if (u) r.block.push(u.status === 'active' ? 'Your U-Pass is already active.' : 'You already signed up; activate your card to finish.');
      if (delivery === 'pickup') r.warn.push('Pick up a physical card at USC Transportation (McCarthy Way Structure), Mon–Fri 8:30 AM – 3 PM.');
      r.ctx = { delivery: delivery || 'pickup' }; return r;
    },
    run({ delivery }) {
      const U = (TH.TRANSPORT && TH.TRANSPORT.upass) || {};
      const u = { status: 'pending-activation', delivery, requestedAt: nowISO(), id: (window.TA && TA.confNo) ? TA.confNo('UP') : 'UP-' + uid() };
      hub().upass = u;
      return { title: 'U-Pass request sent', rows: [['Cost', U.cost || 'No additional cost'], ['Card', delivery === 'have-card' ? 'Using your existing card' : 'Pick up at USC Transportation'], ['Next', 'Activate with the LA Metro link in your confirmation email, then tap within 14 days'], ['Do it for real', U.url || 'transnet.usc.edu']], log: 'Requested a Metro U-Pass for Fall 2026 (pending activation)', item: u };
    },
  };
  A.activateUpass = {
    check() { const r = R(), u = hub().upass; if (!u) r.block.push('Sign up for the U-Pass first.'); else if (u.status === 'active') r.block.push('Your U-Pass is already active.'); r.ctx = { u }; return r; },
    run({ u }) { u.status = 'active'; u.activatedAt = nowISO(); return { title: 'U-Pass active', rows: [['Status', 'Active (tap at any Metro station or bus within 14 days)']], log: 'Activated Metro U-Pass', item: u }; },
  };

  // ---------- parking reminder ----------
  A.saveParking = {
    check(placeId, level) {
      const r = R(), p = place(placeId);
      if (!p || p.cat !== 'parking') r.block.push('Pick a USC parking structure.');
      if (level && String(level).length > 40) r.block.push('Keep the level/spot note under 40 characters.');
      const cur = hub().parking; if (cur && p && cur.at !== p.id) r.warn.push(`Replaces your saved spot at ${placeName(cur.at)}.`);
      if (!(D().parking && D().parking.permit)) r.warn.push('Your account shows no parking permit; daily permits are bought on the USC Transportation site.');
      r.ctx = { p, level: String(level || '').trim() }; return r;
    },
    run({ p, level }) { const v = { at: p.id, level, t: Date.now() }; hub().parking = v; return { title: 'Parking spot saved', rows: [['Where', p.name], ['Level / spot', level || '—']], log: `Saved parking spot at ${p.name}${level ? ' (' + level + ')' : ''}`, item: v }; },
  };
  A.clearParking = {
    check() { const r = R(), v = hub().parking; if (!v) r.block.push('No saved parking spot.'); r.ctx = { v }; return r; },
    run({ v }) { hub().parking = null; return { title: 'Parking spot cleared', rows: [['Was', placeName(v.at)]], log: `Cleared saved parking spot at ${placeName(v.at)}`, item: v }; },
  };

  // ---------- public API ----------
  const act = TH.act = { check: {} };
  Object.keys(A).forEach(name => {
    const spec = A[name];
    act.check[name] = (...args) => { try { const r = spec.check(...args); return { block: r.block, warn: r.warn }; } catch (e) { return { block: [e.message], warn: [] }; } };
    act[name] = (...args) => {
      const r = spec.check(...args);
      if (r.block.length) throw new Error(r.block[0]);
      const out = spec.run(r.ctx, ...args);
      out.warn = r.warn;
      return out;
    };
  });

  // ---------- "Add to phone calendar": RFC 5545 iCalendar ----------
  // events: hub.calendar items, TH.events() entries or TH.CLUB_EVENTS records.
  TH.ics = function (events, opts = {}) {
    const CRLF = '\r\n';
    const escTxt = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    const bytes = s => enc ? enc.encode(s).length : unescape(encodeURIComponent(s)).length;
    const fold = line => { // 75-octet folding without splitting UTF-8 characters
      if (bytes(line) <= 75) return line;
      const out = []; let cur = '', lim = 75;
      for (const ch of line) { if (bytes(cur + ch) > lim) { out.push(cur); cur = ' ' + ch; lim = 75; } else cur += ch; }
      out.push(cur); return out.join(CRLF);
    };
    const instant = v => { // ISO with offset → real instant; Date / offset-less ISO = campus wall clock
      if (v instanceof Date) return new Date(TH.laISO(v));
      if (typeof v === 'string' && /[zZ]|[+-]\d\d:?\d\d$/.test(v)) return new Date(v);
      if (typeof v === 'string') return new Date(TH.laISO(TH.laDate(v)));
      return null;
    };
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trojan Hub//USC student app prototype//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + escTxt(opts.name || 'Trojan Hub'), 'X-WR-TIMEZONE:America/Los_Angeles'];
    const stamp = utc(new Date());
    (events || []).forEach((e, i) => {
      const s = instant(e.startISO || e.start), en = instant(e.endISO || e.end || e.startISO || e.start);
      if (!s || isNaN(s)) return;
      const ref = e.ref ?? e.id ?? i;
      L.push('BEGIN:VEVENT', `UID:${escTxt(String(ref))}@trojan-hub.prototype`, `DTSTAMP:${stamp}`);
      if (e.allDay) {
        const sd = TH.laDate(e.startISO || e.start), ed = TH.addDays(TH.laDate(e.endISO || e.end || e.startISO || e.start), 1);
        const dd = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        L.push(`DTSTART;VALUE=DATE:${dd(sd)}`, `DTEND;VALUE=DATE:${dd(ed)}`);
      } else {
        L.push(`DTSTART:${utc(s)}`, `DTEND:${utc(en && en > s ? en : new Date(s.getTime() + 3600000))}`);
      }
      L.push('SUMMARY:' + escTxt(e.title || 'Event'));
      const where = e.where || e.location; if (where) L.push('LOCATION:' + escTxt(where));
      const org = e.org ? `Hosted by ${e.org}. ` : '';
      L.push('DESCRIPTION:' + escTxt(`${org}${e.url ? 'Details and RSVP: ' + e.url + ' ' : ''}(Added from Trojan Hub, a student prototype.)`));
      if (e.url) L.push('URL:' + e.url);
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join(CRLF) + CRLF;
  };
})(window.TH = window.TH || {});

