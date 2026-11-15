/* js/core.js */
/* Trojan Hub — core: demo clock, formatting, campus-time helpers, open/closed status from REAL
 * hours (incl. special dates and unpublished days), simulated live estimates (labeled "Est."),
 * storage, events adapter over real EngageSC events, the demo student, and the icon sprite.
 * Side-effect free at load (no DOM, no TA.State access until called).
 * Routing, walking graph and safety risk live in js/geo.js; schedules in js/data.js. */
(function (TH) {
  'use strict';
  // ---------- clock ----------
  // Like Trojan Assist, the demo runs on the date the USC data was collected (Mon Nov 9, 2026)
  // with the current CAMPUS time of day (America/Los_Angeles, whatever the viewer's time zone).
  // "Demo time" (More → Demo controls) overrides the time. Every Date the app works with is a
  // "campus wall-clock" Date: its local fields (getHours, getDay…) hold Los Angeles time.
  const DEMO_DAY = [2026, 10, 9];
  let CLK = null;
  try { CLK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }); } catch (e) { CLK = null; }
  function campusWall(inst) { // real instant -> local Date carrying LA wall-clock fields
    if (!CLK) return new Date(inst);
    const p = {}; CLK.formatToParts(inst).forEach(x => { p[x.type] = +x.value; });
    return new Date(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second, inst.getMilliseconds());
  }
  const clock = {
    _base: null, _setAt: 0, realDate: false,
    now() {
      if (this._base) return new Date(this._base.getTime() + (Date.now() - this._setAt));
      const r = campusWall(new Date()); if (this.realDate) return r;
      return new Date(DEMO_DAY[0], DEMO_DAY[1], DEMO_DAY[2], r.getHours(), r.getMinutes(), r.getSeconds(), r.getMilliseconds());
    },
    set(d) { this._base = new Date(d); this._setAt = Date.now(); },
    clear() { this._base = null; },
    // set a time of day (minutes) on the demo day (or today when realDate)
    setMinutes(min) { const r = this.realDate ? campusWall(new Date()) : new Date(DEMO_DAY[0], DEMO_DAY[1], DEMO_DAY[2]); r.setHours(0, 0, 0, 0); r.setMinutes(min); this.set(r); },
    get overridden() { return !!this._base; },
    // minutes of day of the override (for persisting demo time across reloads), or null
    get minutes() { if (!this._base) return null; const d = this.now(); return d.getHours() * 60 + d.getMinutes(); },
    demoDay() { return new Date(DEMO_DAY[0], DEMO_DAY[1], DEMO_DAY[2]); },
  };
  TH.clock = clock;
  const minOfDay = d => d.getHours() * 60 + d.getMinutes();
  TH.minOfDay = minOfDay;
  const pad2 = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  TH.dkey = dkey; TH.dayStart = dayStart; TH.addDays = addDays;
  TH.parseKey = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };

  // ---------- formatting ----------
  function fmtMin(m) { m = ((m % 1440) + 1440) % 1440; let h = Math.floor(m / 60), mm = m % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return mm ? `${h}:${pad2(mm)} ${ap}` : `${h} ${ap}`; }
  function fmtTime(d) { return fmtMin(minOfDay(d)); }
  function fmtHM(s) { return fmtMin(TH.hoursHelpers.t(s)); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS3 = DAYS.map(d => d.slice(0, 3));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtDate = (d, long) => `${(long ? DAYS : DAYS3)[d.getDay()]}, ${long ? MONTHS[d.getMonth()] : MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  function fmtDelta(m) { m = Math.max(0, Math.round(m)); if (m < 60) return `${m} min`; if (m < 2880) return `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}`; return `${Math.round(m / 1440)} days`; }
  Object.assign(TH, { fmtMin, fmtTime, fmtHM, esc, DAYS, DAYS3, MONTHS, fmtDate, fmtDelta });
  TH.money = n => '$' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);

  // ---------- campus time (America/Los_Angeles) ----------
  // EngageSC/DPS timestamps carry a UTC offset. The app treats the device's wall clock as campus
  // time, so convert any ISO instant to a local Date with the same LA wall-clock fields.
  let LAF = null;
  try { LAF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }); } catch (e) { LAF = null; }
  const laCache = new Map();
  TH.laDate = function (iso) {
    if (iso instanceof Date) return new Date(iso);
    if (!iso) return null;
    if (laCache.has(iso)) return new Date(laCache.get(iso));
    let out;
    if (!/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso); out = m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : new Date(iso); }
    else {
      const inst = new Date(iso);
      if (!LAF || isNaN(inst)) out = inst;
      else { const p = {}; LAF.formatToParts(inst).forEach(x => { p[x.type] = +x.value; }); out = new Date(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second); }
    }
    laCache.set(iso, out.getTime());
    return new Date(out);
  };
  // local (campus wall-clock) Date -> ISO string with the correct LA offset, e.g. 2026-11-09T14:00:00-08:00
  TH.laISO = function (d) {
    const guess = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
    let offMin = -480; // PST fallback
    if (LAF) { const back = TH.laDate(guess.toISOString()); offMin = Math.round((Date.UTC(back.getFullYear(), back.getMonth(), back.getDate(), back.getHours(), back.getMinutes(), back.getSeconds()) - guess.getTime()) / 60000); }
    const s = offMin < 0 ? '-' : '+', a = Math.abs(offMin);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${s}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
  };

  // ---------- hours / open status (real hours from js/data.js) ----------
  // dayRanges honors special dates, unpublished days and the validity window; null = not published.
  const ranges = (p, d) => (TH.hoursHelpers && TH.hoursHelpers.dayRanges) ? TH.hoursHelpers.dayRanges(p, d) : (p.hours ? (p.hours[d.getDay()] || []) : null);
  TH.dayRanges = ranges;
  const is24 = r => r && r.length === 1 && r[0][0] <= 0 && r[0][1] >= 1440;
  TH.rangesText = r => r == null ? 'Not published' : !r.length ? 'Closed' : is24(r) ? 'Open 24 hours' : r.map(([a, b]) => `${fmtMin(a)} – ${fmtMin(b)}`).join(', ');
  TH.status = function (place, at) {
    const now = at || clock.now(), m = minOfDay(now);
    const today = ranges(place, now), yday = ranges(place, addDays(now, -1));
    const note = TH.hoursHelpers && TH.hoursHelpers.dayNote ? TH.hoursHelpers.dayNote(place, now) : null;
    const res = o => (note && (o.note = note), o);
    if (yday) for (const [, b] of yday) if (b > 1440 && m + 1440 < b) return res(openRes(b - 1440 - m, b, today));
    if (today == null) return res({ open: null, unknown: true, label: 'Hours not published', detail: '', tone: 'mute' });
    for (const [a, b] of today) if (m >= a && m < b) return res(openRes(b - m, b, today));
    for (let k = 0; k < 8; k++) {
      const day = k === 0 ? today : ranges(place, addDays(now, k));
      if (day == null) return res({ open: false, label: 'Closed', detail: k === 0 ? '' : 'Next opening not published', tone: 'bad' });
      for (const [a] of day) if (k > 0 || a > m) {
        const when = k === 0 ? fmtMin(a) : k === 1 ? `tomorrow ${fmtMin(a)}` : `${DAYS3[addDays(now, k).getDay()]} ${fmtMin(a)}`;
        return res({ open: false, label: 'Closed', detail: `Opens ${when}`, tone: 'bad', opensIn: k * 1440 + a - m });
      }
    }
    return res({ open: false, label: 'Closed', detail: 'No open hours this week', tone: 'mute' });
    function openRes(left, b, td) {
      if (is24(td) || left > 1440) return { open: true, label: 'Open 24 hours', tone: 'ok', detail: '', left: Infinity };
      if (left <= 45) return { open: true, label: 'Closing soon', detail: `Closes ${fmtMin(b)}`, tone: 'warn', left, closesAt: b };
      return { open: true, label: 'Open', detail: `Until ${fmtMin(b)}`, tone: 'ok', left, closesAt: b };
    }
  };
  // Is the place open for the whole window [date, date + durMin)? true / false / null (hours not published)
  TH.openFor = function (place, date, durMin = 0) {
    const m = minOfDay(date), end = m + Math.max(0, durMin);
    const today = ranges(place, date), yday = ranges(place, addDays(date, -1));
    if (yday) for (const [, b] of yday) if (b > 1440 && m + 1440 < b) return end <= b - 1440 || (today || []).some(([a, b2]) => a <= b - 1440 && end <= b2);
    if (today == null) return null;
    return today.some(([a, b]) => m >= a && end <= b);
  };
  TH.hoursText = function (place) { // weekly table [[Mon, text], ...] (Sun..Sat) or [] when not published
    if (!place.hours) return [];
    return place.hours.map((r, i) => [DAYS3[i], TH.rangesText(r)]);
  };
  // Special dates (holidays/breaks) and unpublished days in the next `days` days → [{key, date, label, text, note}]
  TH.specialHours = function (place, from, days = 21) {
    const out = [], start = dayStart(from || clock.now());
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i), k = dkey(d);
      const sp = place.special && Object.prototype.hasOwnProperty.call(place.special, k);
      const un = place.unpublished && place.unpublished.includes(k);
      if (!sp && !un) continue;
      out.push({ key: k, date: d, label: fmtDate(d), text: sp ? TH.rangesText(place.special[k]) : 'Not published yet', note: (place.specialNote && place.specialNote[k]) || (un ? 'USC had not posted hours for this day' : '') });
    }
    return out;
  };

  // ---------- storage (UI preferences only; account data lives in TA.State.d) ----------
  TH.store = {
    get(k, dflt) { try { const v = localStorage.getItem('th:' + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set(k, v) { try { localStorage.setItem('th:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    clear() { try { Object.keys(localStorage).filter(k => k.startsWith('th:')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage unavailable */ } },
  };

  // ---------- live numbers: SIMULATED ESTIMATES (USC publishes no live data) ----------
  function crowdAt(curve, now) { const h = now.getHours(), f = now.getMinutes() / 60; return curve[h] * (1 - f) + curve[(h + 1) % 24] * f; }
  function jitter(id, now) { let s = 0; for (const c of String(id)) s += c.charCodeAt(0); const slot = Math.floor(now.getTime() / 300000); return ((Math.sin(s * 12.9898 + slot * 78.233) * 43758.5453) % 1 + 1) % 1; }
  const SEAT_CURVE = [55, 40, 30, 20, 15, 10, 8, 10, 20, 35, 45, 55, 60, 65, 70, 72, 75, 78, 85, 90, 92, 88, 80, 70];
  // ---------- order-ahead kitchens (SIMULATED ESTIMATE, labeled Est. wherever shown) ----------
  // One number per venue per 30-minute pickup window, on a typical meal-time curve (cafés peak in the morning,
  // food-court kitchens at lunch and dinner), plus a small fixed per-venue offset and a 0-1 min nudge per window.
  // Every surface (Order ahead list, order sheet, slot chips, active-order card, Home, place sheet, Tommy, planner)
  // reads this, so the same kitchen never shows two different waits for the same window.
  const KITCHEN_CURVE = {
    food: [.1, .05, .05, .05, .05, .05, .1, .25, .4, .35, .35, .6, 1, .9, .55, .35, .35, .55, .75, .6, .4, .3, .2, .15],
    cafe: [.1, .05, .05, .05, .05, .1, .25, .55, .85, .95, .75, .6, .7, .65, .55, .45, .4, .35, .3, .25, .2, .2, .15, .1],
  };
  function khash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // at: Date (or minute of day, today) of the pickup window → estimated minutes from "I'm here" to ready
  TH.kitchenWait = function (place, at) {
    if (!place) return null;
    let d = at;
    if (typeof at === 'number') { d = dayStart(clock.now()); d.setMinutes(at); }
    else if (!(at instanceof Date)) d = clock.now();
    const bucket = Math.floor(minOfDay(d) / 30), mid = (bucket * 30 + 15) / 60, h = Math.floor(mid), f = mid - h;
    const curve = /coffee|tea|caf[eé]/i.test((place.tags || []).join(' ')) ? KITCHEN_CURVE.cafe : KITCHEN_CURVE.food;
    const c = curve[h % 24] * (1 - f) + curve[(h + 1) % 24] * f;
    const off = (khash(place.id) % 3) - 1, nudge = khash(place.id + '|' + dkey(d) + '|' + bucket) % 2;
    return Math.max(3, Math.min(14, Math.round(3 + c * 8 + off + nudge)));
  };
  // Pickup windows (minute of day, 10 min long, every 10 min from ~10 min after `at`) while the venue is open, same
  // day only. When it's closed now, the first window lines up with opening time (e.g. 7:00 AM, not 7:05).
  // The order sheet offers these; the first one is what "the wait" means everywhere else.
  TH.pickupWindows = function (place, at, n) {
    const d0 = at instanceof Date ? at : clock.now(), day = dayStart(d0), out = [];
    const ok = t => { const d = new Date(day); d.setMinutes(t); return TH.openFor(place, d, 10) === true; };
    let t = Math.ceil((minOfDay(d0) + 10) / 5) * 5;
    while (t + 10 <= 1440 && !ok(t)) t += 5;
    for (; t + 10 <= 1440 && out.length < (n || 9); t += 10) if (ok(t)) out.push(t);
    return out;
  };
  TH.live = function (place, at) {
    const now = at || clock.now(), st = TH.status(place, now);
    if (st.open !== true) return null;
    const E = o => Object.assign(o, { estimate: true });
    if (place.hall && place.crowd) { const c = crowdAt(place.crowd, now); return E({ kind: 'wait', value: Math.max(1, Math.round(c * 0.22 + jitter(place.id, now) * 4)), unit: 'min', label: 'line', pct: c }); }
    // open seats only when a real seat count exists; `seats: true` just flags study seating (USC publishes no counts),
    // so those places get the estimated busyness % instead of a meaningless "0 seats"
    if (typeof place.seats === 'number' && place.seats > 1) { const curve = place.crowd || SEAT_CURVE; const occ = Math.min(98, crowdAt(curve, now) + jitter(place.id, now) * 8); return E({ kind: 'seats', value: Math.max(0, Math.round(place.seats * (1 - occ / 100))), unit: 'seats', label: 'open', pct: occ }); }
    const bcurve = place.crowd || (place.seats ? SEAT_CURVE : null);
    if (bcurve) { const c = Math.min(99, Math.round(crowdAt(bcurve, now) * (0.9 + jitter(place.id, now) * 0.2))); return E({ kind: 'busy', value: c, unit: '%', label: 'full', pct: c }); }
    if (place.order) { // the kitchen wait at the earliest pickup window from `now` (what the order sheet leads with)
      const w0 = TH.pickupWindows(place, now, 1)[0]; if (w0 == null) return null;
      const d = dayStart(now); d.setMinutes(w0); const v = TH.kitchenWait(place, d);
      return E({ kind: 'wait', value: v, unit: 'min', label: 'pickup', pct: Math.round(v / 14 * 100), pickupAt: w0 });
    }
    return null;
  };
  TH.crowdAt = crowdAt;

  // ---------- events: real EngageSC public events (TH.CLUB_EVENTS) ----------
  let evCache = null, evKey = null;
  TH.events = function () {
    const today = dayStart(clock.now()), key = dkey(today) + ':' + (TH.CLUB_EVENTS || []).length;
    if (evCache && evKey === key) return evCache;
    evCache = (TH.CLUB_EVENTS || []).map(e => {
      const s = TH.laDate(e.start), en = TH.laDate(e.end || e.start), day = dayStart(s);
      const spill = Math.round((dayStart(en) - day) / 864e5);
      return {
        id: e.id, title: e.title, start: e.allDay ? 0 : minOfDay(s), end: e.allDay ? 1440 : Math.max(minOfDay(s), minOfDay(en) + 1440 * Math.max(0, spill)),
        date: day, dkey: dkey(day), off: Math.round((day - today) / 864e5), where: null, location: e.location || null,
        cats: e.tags || [], food: !!e.food, url: e.url, ical: e.ical, orgId: e.orgId, org: e.org, allDay: !!e.allDay, multiDay: !!e.multiDay,
        spanDays: e.spanDays || 1, startISO: e.start, endISO: e.end, desc: e.desc || '', type: e.type || '', s, e: en,
      };
    }).sort((a, b) => a.s - b.s);
    evKey = key;
    return evCache;
  };
  // "Venue, 1425 San Pablo Street, Los Angeles, CA 90033, United States" -> "Venue" (full text stays on the event sheet)
  TH.shortLoc = function (loc) {
    const parts = String(loc || '').split(/\s*,\s*/).filter(Boolean).filter(x => !/^(united states|usa|us|los angeles|la|ca|california)$/i.test(x) && !/^(ca|california)\s+\d{5}/i.test(x) && !/^\d{5}(-\d{4})?$/.test(x));
    if (!parts.length) return String(loc || '');
    return /^\d/.test(parts[0]) ? parts[0] : parts[0].length < 6 && parts[1] ? parts[0] + ', ' + parts[1] : parts[0];
  };
  // ---------- HASHTAGS & NETFLIX-STYLE RECOMMENDATION HELPERS ----------
  TH.getEventHashtags = function (e) {
    if (!e) return [];
    if (Array.isArray(e.hashtags) && e.hashtags.length > 0) {
      return e.hashtags.map(h => (h.startsWith("#") ? h : "#" + h).toLowerCase());
    }
    const hState = (TH.H && TH.H().eventHashtags) || {};
    if (hState[e.id] && hState[e.id].length) {
      return hState[e.id].map(h => (h.startsWith("#") ? h : "#" + h).toLowerCase());
    }
    const tags = new Set();
    const text = ((e.title || "") + " " + (e.desc || "") + " " + (e.org || "") + " " + (e.cats || []).join(" ")).toLowerCase();

    if (/robot|robotics|viterbi|arduino|hardware|circuit|meche|ieee/.test(text)) { tags.add("#robotics"); tags.add("#engineering"); tags.add("#viterbi"); }
    if (/ai\b|artificial intelligence|machine learning|deep learning|data science|nlp|llm|computer science|coding|hackathon|developer|software/.test(text)) { tags.add("#ai"); tags.add("#tech"); tags.add("#coding"); }
    if (/food|boba|pizza|taco|snack|cater|lunch|dinner|refreshment|breakfast|donut|coffee/.test(text) || e.food) { tags.add("#freefood"); tags.add("#social"); }
    if (/career|resume|internship|job|recruiting|network|interview|hire|alumni|marshall|consulting|finance/.test(text)) { tags.add("#career"); tags.add("#networking"); }
    if (/pre-?med|health|doctor|medicine|biology|clinical|hospital|keck|pharmacy|nursing/.test(text)) { tags.add("#premed"); tags.add("#healthcare"); }
    if (/film|cinema|movie|screen|animation|direct|production|sca|actor|theatre|acting/.test(text)) { tags.add("#film"); tags.add("#cinema"); tags.add("#arts"); }
    if (/music|concert|band|orchestra|sing|choir|thornton|sound|performance/.test(text)) { tags.add("#music"); tags.add("#performance"); }
    if (/game|gaming|esports|board game|trivia|arcade|play/.test(text)) { tags.add("#gaming"); tags.add("#social"); }
    if (/culture|cultural|heritage|asian|black|latino|latinx|hispanic|international|global|pride|lgbtq|diversity/.test(text)) { tags.add("#cultural"); tags.add("#community"); }
    if (/service|volunteer|community|outreach|philanthropy|advocacy|justice/.test(text)) { tags.add("#service"); tags.add("#community"); }
    if (/fitness|workout|gym|run|lift|yoga|climb|dance|sports|recsports|nike/.test(text)) { tags.add("#fitness"); tags.add("#wellness"); }
    if (/trojan|football|coliseum|tailgate|spirit|usg|fsl|greek|sorority|fraternity/.test(text)) { tags.add("#trojanlife"); tags.add("#campuslife"); }
    if (/research|lab|phd|grad|symposium|academic|seminar|lecture|speaker/.test(text)) { tags.add("#academics"); tags.add("#research"); }
    if (/design|art|creative|fashion|architecture|roski|drawing|media/.test(text)) { tags.add("#design"); tags.add("#creative"); }

    (e.cats || []).forEach(c => {
      const clean = c.replace(/[^a-zA-Z0-9]/g, "");
      if (clean && clean.length > 2) tags.add("#" + clean.toLowerCase());
    });

    if (tags.size === 0) {
      tags.add("#trojan");
      tags.add("#campuslife");
    }
    return Array.from(tags).slice(0, 5);
  };

  TH.ai = TH.ai || {};
  TH.ai.generateHashtags = function (title, desc, orgName, category) {
    const combined = `${title || ""} ${desc || ""} ${orgName || ""} ${category || ""}`.toLowerCase();
    const tags = new Set();
    if (/robot|viterbi|arduino|hardware|circuit|ieee/.test(combined)) { tags.add("#Robotics"); tags.add("#Viterbi"); }
    if (/ai\b|machine learning|deep learning|data|nlp|software|coding|python|hackathon/.test(combined)) { tags.add("#AI"); tags.add("#Tech"); }
    if (/food|boba|pizza|snack|taco|cater|lunch|dinner|refreshment/.test(combined)) { tags.add("#FreeFood"); }
    if (/career|internship|job|resume|interview|network|marshall|finance|consulting/.test(combined)) { tags.add("#Career"); tags.add("#Networking"); }
    if (/med|health|doctor|clinic|keck|hospital|pharmacy/.test(combined)) { tags.add("#PreMed"); tags.add("#Health"); }
    if (/film|movie|sca|cinema|theatre|acting/.test(combined)) { tags.add("#Film"); tags.add("#Cinema"); }
    if (/music|concert|band|thornton|song/.test(combined)) { tags.add("#Music"); }
    if (/game|esports|gaming/.test(combined)) { tags.add("#Gaming"); }
    if (/culture|latino|black|asian|international|heritage/.test(combined)) { tags.add("#Culture"); tags.add("#Community"); }
    if (/service|volunteer|giving|nonprofit/.test(combined)) { tags.add("#Service"); }
    if (/gym|fitness|workout|lift|sports/.test(combined)) { tags.add("#Fitness"); }
    if (/research|academic|phd|science/.test(combined)) { tags.add("#Research"); }
    if (/design|art|creative|fashion/.test(combined)) { tags.add("#Design"); }

    const words = combined.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 4 && !/about|there|where|which|their|event|meeting|student|university|campus/.test(w));
    words.slice(0, 3).forEach(w => tags.add("#" + w.charAt(0).toUpperCase() + w.slice(1)));

    if (tags.size === 0) {
      tags.add("#TrojanHub");
      tags.add("#USCEvents");
    }
    return Array.from(tags).slice(0, 5);
  };

  TH.calcEventMatch = function (e) {
    const h = (window.TH && TH.H && TH.H()) || {};
    const x = h.x || {};
    const fb = (x.fb && x.fb["e" + e.id]) || {};
    const w = x.w || { tag: {}, org: {}, hashtag: {} };
    w.hashtag = w.hashtag || {};
    const joined = new Set((h.clubs || []).map(c => String(c.id)));
    
    let score = 0;
    const reasons = [];

    if (fb.v > 0) { score += 20; reasons.push("You gave thumbs up"); }
    else if (fb.v < 0) { return { score: -100, pct: 40, why: "Hidden (thumbs down)", hidden: true, disliked: true, hashtags: TH.getEventHashtags(e) }; }

    const tags = TH.getEventHashtags(e);
    const matchingHashtags = tags.filter(t => (w.hashtag[t] || 0) > 0);
    if (matchingHashtags.length > 0) {
      const hw = matchingHashtags.reduce((sum, t) => sum + (w.hashtag[t] || 0), 0);
      score += hw * 4;
      reasons.push("Because you like " + matchingHashtags.slice(0, 2).join(" "));
    }

    (e.cats || []).forEach(c => {
      if ((w.tag && w.tag[c] || 0) > 0) {
        score += (w.tag[c] || 0) * 3;
        if (!reasons.length) reasons.push("Matches liked category " + c);
      }
    });

    if (joined.has(String(e.orgId))) {
      score += 15;
      reasons.push("From a club you joined");
    }

    if (e.food) {
      score += 5;
      if (!reasons.length) reasons.push("Free food");
    }

    const pct = Math.min(99, Math.max(70, Math.round(75 + score * 2.5)));
    return {
      score,
      pct,
      why: reasons[0] || (pct >= 85 ? "Recommended for you" : "Popular campus event"),
      hashtags: tags,
      liked: fb.v > 0,
      disliked: fb.v < 0
    };
  };

  TH.setEventFeedback = function (eventId, vote, meta) {
    meta = meta || {};
    const h = TH.H();
    const x = h.x || (h.x = {});
    x.fb = x.fb || {};
    x.w = x.w || { tag: {}, org: {}, hashtag: {} };
    x.w.hashtag = x.w.hashtag || {};
    x.w.tag = x.w.tag || {};
    x.w.org = x.w.org || {};

    const key = "e" + eventId;
    const prev = (x.fb[key] || {}).v || 0;
    const newV = prev === vote ? 0 : vote;
    const delta = newV - prev;

    x.fb[key] = { v: newV, at: Date.now(), title: meta.title || "", org: meta.org || null };

    (meta.hashtags || []).forEach(t => {
      x.w.hashtag[t] = (x.w.hashtag[t] || 0) + delta * 3;
    });
    (meta.cats || []).forEach(c => {
      x.w.tag[c] = (x.w.tag[c] || 0) + delta * 2;
    });
    if (meta.orgId != null) {
      x.w.org[meta.orgId] = (x.w.org[meta.orgId] || 0) + delta * 3;
    }

    try { if (window.TA && window.TA.State && window.TA.State.save) window.TA.State.save(); } catch (e) {}

    if (newV > 0) {
      TH.toast("👍 Thumbs up! We’ll recommend more events with similar hashtags.", "up");
    } else if (newV < 0) {
      TH.toast("👎 Got it. We’ll recommend fewer events like this.", "dn");
    } else {
      TH.toast("Rating removed.", "info");
    }
    TH.render(true);
  };

  TH.eventById = id => (TH.CLUB_EVENTS || []).find(e => String(e.id) === String(id)) || null;
  TH.clubById = id => (TH.CLUBS || []).find(c => String(c.id) === String(id)) || null;

  // ---------- the demo student (Trojan Assist's Jordan Rivera; single source of truth) ----------
  TH.student = function () {
    const d = window.TA && TA.State && TA.State.d;
    if (!d) return { first: 'Student', last: '', full: 'Student', uscid: '', netid: '', standing: '', major: '', school: '', dining: { swipesLeft: 0, swipesTotal: 0, diningDollars: 0, guestLeft: 0, plan: '' }, uscard: null, parkingPermit: null, housing: '' };
    const p = d.profile || {}, dn = d.dining || {};
    const first = p.preferred || p.first || 'Student';
    return {
      first, last: p.last || '', full: `${first} ${p.last || ''}`.trim(), uscid: p.uscid || '', netid: p.netid || '', email: p.email || '',
      standing: p.standing || '', level: p.level || '', major: p.major || '', school: p.school || '', gradTerm: p.gradTerm || '',
      dining: { swipesLeft: dn.swipesLeft, swipesTotal: dn.swipesTotal, diningDollars: dn.diningDollars, guestLeft: dn.guestLeft, plan: dn.plan },
      uscard: d.uscard || null, parkingPermit: (d.parking && d.parking.permit) || null, housing: (d.housing && d.housing.building) || '',
    };
  };

  // ---------- icons (inline SVG sprite) ----------
  const P = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    fork: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 12v9M17 21V3c-2 1.5-3 4-3 7 0 2 1 3 3 3"/>',
    wc: '<circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><path d="M8 9v12M6 10h4v6H6zM16 9l-3 8h6l-3-8M15 17v4M17 17v4"/>',
    book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13v-4"/>',
    gate: '<path d="M3 21V8l9-5 9 5v13M8 21v-8h8v8M12 13v8"/>',
    health: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
    dumbbell: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
    bus: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8 21v-4M16 21v-4M8.5 13.5h.01M15.5 13.5h.01"/>',
    parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    sparkle: '<path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7zM19 16c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z"/>',
    ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2M6 6l9-3 1 3"/>',
    train: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 10h12M9 21l1.5-4M15 21l-1.5-4M9.5 13.5h.01M14.5 13.5h.01"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    pin: '<path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.4 2.5 4 5.5"/>',
    car: '<path d="M5 16l1.6-5.2A2 2 0 0 1 8.5 9.5h7a2 2 0 0 1 1.9 1.3L19 16M3 16h18v3H3zM7 19v2M17 19v2"/>',
    bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
    football: '<path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16zM9 15l6-6M10.5 11.5l2 2M12.5 9.5l2 2"/>',
    access: '<circle cx="12" cy="4" r="2"/><path d="M6 8h12M12 8v6M9 21l3-7 3 7"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6 3 3v3M8 12l2.5-4 3.5 1 2 3.5"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1"/>',
    queue: '<circle cx="5" cy="8" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="8" r="2"/><path d="M3 18c0-3 1-5 2-5s2 2 2 5M10 18c0-3 1-5 2-5s2 2 2 5M17 18c0-3 1-5 2-5s2 2 2 5"/>',
    flame: '<path d="M12 21c-4 0-7-3-7-7 0-3 2-5 3-7 1 2 2 3 3 3 0-3 1-6 4-8 0 4 4 6 4 11 0 5-3 8-7 8z"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
      'calendar-plus': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v6M9 16h6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    verified: '<path d="M12 3l2.4 1.7 2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21l-2.4-1.7-2.9.2-.9-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    grid: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M3 15h18M9 9v12M15 9v12"/>',
    columns: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 9v12M13 9v12M18 9v12"/>',
    club: '<path d="M4 21V5M4 5h11l-2 4 2 4H4"/><circle cx="18" cy="17" r="3"/>',
    alert: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  };

  // ---------- USC bus departures incl. USC's estimated afternoon windows ----------
  // Some routes (Union Station → UPC) publish afternoon trips only as estimated windows ("3:06–3:12 PM").
  // TH.busDepartures merges them with the fixed trips: [{at, end?, est?}] sorted by `at`, for stop 0 only.
  TH.busDepartures = function (busId, stopIdx, date) {
    const T = TH.TRANSPORT || {}, bus = (T.buses || []).find(b => b.id === busId); if (!bus || !TH.busTimes) return [];
    const d = date || clock.now(), wd = d.getDay(), key = dkey(d);
    const runs = (bus.days || []).includes(wd) && !(T.holidays || []).includes(key) && !(bus.noService || []).includes(key);
    if (!runs) return [];
    const out = TH.busTimes(busId, stopIdx, d).map(at => ({ at }));
    if (!(stopIdx || 0) && Array.isArray(bus.estWindows)) bus.estWindows.forEach(w => {
      const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(w); if (!m) return;
      out.push({ at: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4], est: true });
    });
    return out.sort((a, b) => a.at - b.at);
  };
  // "7:40 PM" or "~3:06–3:12 PM (est.)"
  TH.busDepText = x => x.est ? `~${fmtMin(x.at).replace(/ [AP]M$/, '')}–${fmtMin(x.end)} (est.)` : fmtMin(x.at);
  // departures still ahead at minute `m` (an estimated window counts until it closes)
  TH.busUpcoming = (busId, stopIdx, date, m) => TH.busDepartures(busId, stopIdx, date).filter(x => (x.est ? x.end : x.at) >= m);
  // place sheet: next departures at a stop, with the estimated windows (overrides data.js's fixed-trips-only version)
  TH.nextBuses = function (stopPlaceId, date, fromMin, n) {
    const d = date || clock.now(), m = fromMin == null ? minOfDay(d) : fromMin, out = [];
    ((TH.TRANSPORT || {}).buses || []).forEach(b => b.stops.forEach((s, i) => {
      if (s.placeId !== stopPlaceId) return;
      TH.busUpcoming(b.id, i, d, m).slice(0, n || 3).forEach(x => out.push({ busId: b.id, name: b.name, short: b.short, color: b.color, stop: i, at: x.at, end: x.end, est: !!x.est, inMin: Math.max(0, x.at - m) }));
    }));
    return out.sort((a, b) => a.at - b.at).slice(0, n || 6);
  };

  TH.icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  TH.iconSprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('')}</defs></svg>`;
  TH.iconPaths = P;
})(window.TH = window.TH || {});

