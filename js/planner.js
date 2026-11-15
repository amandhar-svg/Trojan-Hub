/* js/planner.js — Part 6: "Tommy, plan my day / plan my week".
 *
 * TH.plan.day(dateKey, opts) and TH.plan.week(startKey, opts) build plans from what the student already has
 * (TH.dayItems: classes, exams, homework due, appointments, study rooms, Trojan Passes, mobile orders, virtual lines,
 * saved and club events) plus suggestions in the gaps:
 *   - meals at dining places OPEN at that time (real USC hours via TH.openFor), with diet / allergy notes from TH.prefs
 *   - study blocks before homework deadlines and exams (TH.acad), at a library that is open for the whole block
 *   - events: joined clubs first, then TH.clubMatch + the profile (TH.x.recEvents) + thumbs (TH.likeScore)
 *   - rec-center time only when the student's interests fit, a "recharge" block in Chill mode, and a wind-down
 *   - walking time between known places (TH.route, labeled Est.)
 * Plan object: { key, blocks:[{id, slot, start, end, kind, title, place?, eventId?, why, fixed}], picks:[...], swaps:{slot:[alts]} … }
 *
 * Screen `plan` (TH.screens.plan): Day = itinerary timeline with swap (alternatives), lock, remove, shuffle and
 * "Add to My Day"; Week = 7-day board, outings & field trips (real EngageSC events that leave campus), free food,
 * club meetings, exams and deadlines, and "Plan this day".
 * "Add to My Day" RSVPs events through TH.act.saveEvent and keeps the other blocks as Tommy-plan items in
 * TH.H().x.dayplan (shown on My Day through a TH.dayItems wrapper). Native adds set TA.Brain.lastUndo, so the
 * Undo button here and "undo" in Tommy both take it back. Everything is simulated on the demo student.
 * Tommy: js/ta/script.js (plan.day / plan.week / plan.outings commands) and js/ta/act-anything.js (hub_plan_add);
 * the chat cards are rendered here (TA.UI.cards.plan / planweek / outings).
 * UI-only state lives in TH.state.plan (view, day, vibe, swaps, locks, removals). Load after p6-clubs.js.
 */
(function (TH) {
  'use strict';
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c || '');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasTA = () => !!(window.TA && TA.State && TA.State.d);
  const now = () => TH.clock.now();
  const today = () => TH.dayStart(now());
  const nowMin = () => TH.minOfDay(now());
  const fmt = m => TH.fmtMin(m);
  const todayKey = () => TH.dkey(today());
  const offOf = key => Math.round((TH.parseKey(key) - today()) / 864e5);
  const keyAt = off => TH.dkey(TH.addDays(today(), off));
  const at = (date, min) => { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setMinutes(min); return d; };
  const r5 = m => Math.ceil(m / 5) * 5;
  const uniq = a => [...new Set(a.filter(Boolean))];
  const dur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h${mm ? ' ' + mm + 'm' : ''}` : `${mm} min`; };
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const firstName = () => { try { return TH.student().first || 'you'; } catch (e) { return 'you'; } };
  const dayName = d => TH.DAYS[d.getDay()];
  const dayWord = key => { const o = offOf(key); return o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : dayName(TH.parseKey(key)); };
  const dateShort = d => `${TH.MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

  // ---------- extra icons for the sprite (added before TH.boot builds it) ----------
  Object.assign(TH.iconPaths, {
    mountain: '<path d="M3 20l6-10 4 6 2-3 6 7z"/><path d="M8.2 11.4 9 10l1.6 2.4"/>',
    wave: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><circle cx="17" cy="6" r="2.5"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    shuffle: '<path d="M3 7h3.5c4 0 6 10 10.5 10H21M3 17h3.5c1.6 0 2.8-1.6 3.8-3.4M13.6 9.6C14.6 8.1 15.6 7 17 7h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9"/>',
  });

  // ---------- looks per kind ----------
  const K = {
    class: { label: 'Class', icon: 'book', color: 'var(--c-study)' },
    exam: { label: 'Exam', icon: 'pencil', color: 'var(--cardinal)' },
    due: { label: 'Due', icon: 'check', color: 'var(--c-study)' },
    appt: { label: 'Appointment', icon: 'health', color: 'var(--c-health)' },
    room: { label: 'Study room', icon: 'book', color: 'var(--c-study)' },
    event: { label: 'Saved event', icon: 'calendar', color: 'var(--c-dining)' },
    club: { label: 'Your club', icon: 'users', color: 'var(--c-fitness)' },
    pass: { label: 'Trojan Pass', icon: 'ticket', color: 'var(--c-landmark)' },
    zip: { label: 'Zipcar', icon: 'car', color: '#3d9b35' },
    line: { label: 'Virtual line', icon: 'queue', color: 'var(--c-health)' },
    order: { label: 'Mobile order', icon: 'bag', color: 'var(--c-dining)' },
    ride: { label: 'USC Lyft', icon: 'car', color: '#ff00bf' },
    planned: { label: 'Tommy’s plan', icon: 'sparkle', color: 'var(--gold-ink)' },
    other: { label: 'On your calendar', icon: 'calendar', color: 'var(--cardinal)' },
    meal: { label: 'Meal', icon: 'fork', color: 'var(--c-dining)' },
    study: { label: 'Study', icon: 'book', color: 'var(--c-study)' },
    pick: { label: 'Event pick', icon: 'star', color: 'var(--cardinal)' },
    outing: { label: 'Outing', icon: 'compass', color: 'var(--c-fitness)' },
    move: { label: 'Move', icon: 'dumbbell', color: 'var(--c-fitness)' },
    recharge: { label: 'Recharge', icon: 'leaf', color: 'var(--ok)' },
    wind: { label: 'Wind down', icon: 'moon', color: '#6a5fd0' },
  };
  TH.PLAN_KINDS = K;
  const VIBES = {
    balanced: { label: 'Balanced', icon: 'star', picks: 2, study: 2, thr: 1.2 },
    study: { label: 'Study mode', icon: 'book', picks: 1, study: 3, thr: 3 },
    social: { label: 'Social', icon: 'users', picks: 3, study: 1, thr: 0.6 },
    chill: { label: 'Chill', icon: 'leaf', picks: 1, study: 1, thr: 2 },
  };
  TH.PLAN_VIBES = VIBES;

  // ---------- context shared by one planning pass ----------
  function prefs() { try { return TH.prefs ? TH.prefs() : {}; } catch (e) { return {}; } }
  // "Your clubs" = clubs joined in the app + the club the student helps run on the organizer side (TH.x.primaryClub,
  // the same club Home shows as "Because you’re part of …")
  function myClubs(h) {
    const ids = new Set((h.clubs || []).map(c => String(c.id))); let org = null;
    try { const pc = TH.x && TH.x.primaryClub ? TH.x.primaryClub() : null; if (pc && pc.id != null) { org = String(pc.id); ids.add(org); } } catch (e) { /* organizer side unavailable */ }
    return { ids, org };
  }
  function ctxNew() {
    const h = hasTA() ? TH.H() : { calendar: [], clubs: [] }, x = h.x || {};
    const rec = new Map(); try { ((TH.x && TH.x.recEvents) ? TH.x.recEvents(400) : []).forEach(o => rec.set(String(o.e.id), o)); } catch (e) { /* recommendations unavailable */ }
    const P = Object.assign({ interests: [], careerInterests: [], careerGoals: [], clubTypes: [], foods: [], snacks: [], drinks: [], diet: [], allergies: [], major: '', minor: '' }, prefs());
    const mc = myClubs(h);
    return { h, fb: x.fb || {}, joined: mc.ids, orgClub: mc.org, onCal: new Set((h.calendar || []).map(c => String(c.ref))), rec, P, routes: new Map(), scores: new Map(), undergrad: !/grad/i.test((TH.student() || {}).level || "") || /undergrad/i.test((TH.student() || {}).level || "") };
  }

  // ---------- Health Sciences Campus: a shuttle or car ride from UPC, never a walk ----------
  // EngageSC spells it many ways ("Health Science Campus", "USC Health Sciences Campus", "HSC", or just the
  // San Pablo St / Zonal / Eastlake address in 90033).
  const HSC_RE = /\bhealth sciences? campus\b|\bhsc\b|\bsan pablo st|\b90033\b|\b(zonal|eastlake|biggy|alcazar|soto)\s+(ave|avenue|st|street)\b|\bpappas quad\b|\bmayer auditorium\b|\baresty\b|\bmckibben hall\b|\bzilkha\b|\bbroad cirm\b/i;
  const isHSC = loc => HSC_RE.test(String(loc || ''));
  TH.isHSC = isHSC;
  const HSC_TRIP = 45; // allow ~45 min each way, door to door (Est.)
  // Real Intercampus Shuttle departures (js/data.js, USC Transportation): stop 0 = UPC Jefferson turnout, stop 2 = HSC
  function icsDeps(date, stop) {
    const out = [];
    ['ics', 'weekend-ics'].forEach(id => { try { (TH.busDepartures ? TH.busDepartures(id, stop, date) : []).forEach(x => { if (!x.est) out.push(x.at); }); } catch (e) { /* no schedule */ } });
    return out.sort((a, b) => a - b);
  }
  // A shuttle is suggested only when it fits the ~45 min allowance the plan keeps free (leave 40-55 min before,
  // or 5-15 min after it ends) and hasn't left yet; otherwise the leg says car or rideshare, so the timeline never
  // runs into the ride.
  function hscTrip(date, start, end, notBefore) {
    const to = icsDeps(date, 0).filter(t => t <= start - 40 && t >= Math.max(start - 55, notBefore || 0)).pop();
    const back = icsDeps(date, 2).find(t => t >= end + 5 && t <= end + 15);
    return { min: HSC_TRIP, to: to == null ? null : to, back: back == null ? null : back };
  }

  // ---------- places & walking ----------
  const ptOf = p => p && p.x != null && p.y != null ? { x: +p.x, y: +p.y } : null;
  const SHORT = { evk: 'EVK', parkside: 'Parkside', villagedh: 'Village Dining Hall', leavey: 'Leavey Library', doheny: 'Doheny Library', sel: 'Science & Engineering Library', lyon: 'Lyon Center', vfit: 'Village Fitness Center', uac: 'Uytengsu Aquatics Center' };
  const shortName = p => !p ? '' : SHORT[p.id] || String(p.name).replace(/\s*\((UPC|SCA)\)\s*$/, '').replace(/\s+featuring\s.*$/i, '');
  const walkEst = (a, b) => (a && b) ? Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 1.3 / 80)) : null;
  function walk(ctx, a, b, hour) {
    if (!a || !b) return null;
    const k = `${Math.round(a.x)},${Math.round(a.y)}>${Math.round(b.x)},${Math.round(b.y)}@${hour >= 19 || hour < 6 ? 'n' : 'd'}`;
    if (ctx.routes.has(k)) return ctx.routes.get(k);
    let m = null;
    try { m = TH.route ? TH.route(a, b, { hour, mode: 'safe' }).minutes : walkEst(a, b); } catch (e) { m = walkEst(a, b); }
    ctx.routes.set(k, m); return m;
  }
  function evPlace(e) { if (!e || !e.location || !TH.eventPlace) return null; try { return TH.eventPlace(e.location); } catch (e2) { return null; } }
  const placeByName = nm => (TH.PLACES || []).find(p => p.name === nm) || null;

  // ---------- event scoring (one number + reasons) ----------
  const shortOrg = s => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/^(USC|The)\s+/i, '').trim().slice(0, 34);
  function scoreEvent(e, ctx) {
    if (ctx.scores.has(e.id)) return ctx.scores.get(e.id);
    let out = null;
    const fb = ctx.fb['e' + e.id];
    if (!(fb && fb.v < 0)) {
      const club = TH.clubById ? TH.clubById(e.orgId) : null, joined = ctx.joined.has(String(e.orgId)), why = [], rec = ctx.rec.get(String(e.id));
      let s = 0;
      if (joined) { s += 6; why.push('Your club: ' + shortOrg(e.org)); }
      if (rec) { s += Math.min(8, rec.s); rec.why.forEach(w => why.push(w)); }
      if (club && TH.clubMatch) { try { const m = TH.clubMatch(club); if (m && m.score > 0) { s += Math.min(3, m.score * 0.4); if (m.why && m.why[0]) why.push(m.why[0]); } } catch (er) { /* no match model */ } }
      const ls = TH.likeScore ? TH.likeScore(e) : 0; s += ls * 3; if (ls > 0.2) why.push('Like ones you gave a thumbs up');
      if (e.food) { s += 1; if (!why.some(w => /food/i.test(w))) why.push('Free food listed'); }
      const type = String(e.type || '');
      if (/office hours/i.test(type)) s -= joined ? 0 : 5;
      else if (/^meeting$/i.test(type)) s -= joined ? 0 : 1.2;
      else if (/social|performance|film|athletic|exhibition|dinner|luncheon/i.test(type)) s += 0.6;
      const loc = String(e.location || ''), online = /\b(online|zoom|virtual|webinar)\b/i.test(loc), hsc = !online && isHSC(loc);
      if (hsc) s -= 3; // Health Sciences Campus: a shuttle or car ride away (travel handled in day())
      if (ctx.undergrad && /\b(ph\.?\s?d|doctoral|postdocs?|faculty only|staff only|for staff|graduate students only|grad students only)\b/i.test(e.title || '')) s -= 8;
      out = { e, s, why: uniq(why), warn: rec ? (rec.warn || []) : [], joined, online, hsc };
    }
    ctx.scores.set(e.id, out); return out;
  }

  // ---------- outings & field trips: real EngageSC events that leave campus ----------
  const OUT_TITLE = /\b(field ?trips?|day ?trips?|road ?trips?|excursions?|outings?|hikes?|hiking|beach|camping|kayak\w*|surf(ing)?|museum (trip|visit|day)|trip to)\b/i;
  const OUT_TEXT = /\b(off[- ]campus (excursion|trip|outing|adventure|event|activity)|drive to the destination|(meet|gather) (at|in) [^.]{3,80}?(then|and) (drive|carpool|head over|travel|take the|ride)|carpool(ing)?|transportation (will be |is )?provided|(bus|van|shuttle) (leaves|departs)|field ?trip|day ?trip|road ?trip|excursion|site visits?|company visits?|tours? (of|to) (?!(the )?(campus|usc|our|lab|labs|university park)\b))\b/i;
  const OUT_PLACES = /\b(playa del rey|santa monica|venice beach|malibu|manhattan beach|hermosa beach|redondo beach|zuma|griffith|getty|lacma|the broad\b|natural history museum|california science center|hollywood bowl|dodger stadium|little tokyo|grand central market|disneyland|universal studios|huntington library|catalina|big bear|joshua tree|runyon canyon|descanso|echo park lake)\b/i;
  const OUT_NOT = /\b(off[- ]campus (guests?|housing|students?|living|apartments?|residents?)|study abroad|online event|zoom)\b/i;
  function outingOf(e) {
    if (!e || e.allDay) return null;
    const title = String(e.title || ''), loc = String(e.location || ''), desc = String(e.desc || '').slice(0, 900), all = `${title} | ${loc} | ${desc}`;
    if (OUT_NOT.test(title + ' ' + loc)) return null;
    const m = OUT_TITLE.exec(title) || OUT_TEXT.exec(loc) || OUT_PLACES.exec(title + ' ' + loc) || OUT_TEXT.exec(desc) || OUT_PLACES.exec(desc);
    if (!m) return null;
    const w = m[0].toLowerCase();
    const kind = /beach|surf|kayak/.test(w + title.toLowerCase()) ? 'Beach' : /hik|runyon|griffith|camp|big bear|joshua/.test(w) ? 'Hike' : /museum|getty|lacma|broad|science center|huntington/.test(w) ? 'Museum' : /screening|movie|film/i.test(all) ? 'Off-campus show' : /trip|excursion|outing|drive|carpool|bus|van|shuttle/.test(w) ? 'Trip' : 'Off-campus';
    // the sentence that says it leaves campus (shown as the reason)
    const src = [desc, loc, title].find(t => t && (OUT_TEXT.test(t) || OUT_PLACES.test(t) || OUT_TITLE.test(t))) || '';
    let line = '';
    const sentences = src.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
    line = (sentences.find(s => OUT_TEXT.test(s) || OUT_PLACES.test(s) || OUT_TITLE.test(s)) || '').trim();
    if (line.length > 110) line = line.slice(0, 107).replace(/\s+\S*$/, '') + '…';
    const icon = kind === 'Beach' ? 'wave' : kind === 'Hike' ? 'mountain' : kind === 'Museum' ? 'building' : kind === 'Off-campus show' ? 'ticket' : 'compass';
    return { kind, icon, line };
  }
  TH.outingOf = outingOf;

  // ---------- fixed items (what the student already has) ----------
  function kindOf(it) {
    const k = String(it.kind || '');
    if (it.planSlot) return 'planned';
    if (k === 'Class') return 'class'; if (/^Due/.test(k)) return 'due'; if (/exam|midterm/i.test(k)) return 'exam';
    if (k === 'Appointment') return 'appt'; if (k === 'Study room') return 'room'; if (k === 'Club event') return 'club'; if (k === 'Event') return 'event';
    if (k === 'Trojan Pass') return 'pass'; if (k === 'Zipcar') return 'zip'; if (k === 'Virtual line') return 'line'; if (k === 'Mobile order') return 'order'; if (k === 'USC Lyft') return 'ride';
    return 'other';
  }
  function fixedBlocks(off) {
    let items = []; try { items = TH.dayItems(off) || []; } catch (e) { items = []; }
    return items.map((it, i) => {
      const kind = kindOf(it), ev = it.event ? TH.eventById(it.event) : null;
      let place = null;
      if (it.placeId && TH.byId) place = TH.byId[it.placeId] || null;
      else if (kind === 'order') place = placeByName(it.title);
      else if (kind === 'room') place = (TH.PLACES || []).find(p => p.cat === 'study' && String(it.title || '').toLowerCase().includes(p.name.toLowerCase().split(' ')[0])) || null;
      const hsc = !!(ev && isHSC(ev.location)), evPt = ev && !hsc ? evPlace(ev) : null, soft = kind === 'club' || kind === 'event';
      // come-and-go sessions (drop-in tutoring, office hours) never block the plan
      const dropIn = soft && (/office hours/i.test((ev && ev.type) || '') || /\b(drop-?in|office hours|open hours|walk-?in|open lab|study hall)\b/i.test(it.title || ''));
      return {
        id: 'fx' + i + '-' + hash(it.kind + it.title + it.start), slot: it.planSlot || null, planId: it.planId || null, fixed: true, kind, kindLabel: it.planSlot ? (it.kind || K.planned.label) : (it.kind || K[kind].label),
        start: it.start, end: Math.max(it.start, it.end == null ? it.start : it.end), title: it.title, sub: it.sub || '', marker: kind === 'due', done: !!it.done,
        eventId: it.event || null, place, pt: ptOf(place) || (evPt ? { x: evPt.x, y: evPt.y } : null), placeLabel: place ? shortName(place) : evPt ? evPt.label : '',
        color: it.color || K[kind].color, go: it.go || null, food: !!(ev && ev.food), live: !!it.live, why: '', icon: (K[kind] || K.other).icon, soft, dropIn,
        hsc,
      };
    });
  }
  const blocking = b => !b.marker && !b.dropIn && b.end > b.start;

  // ---------- interval helpers ----------
  const overlap = (a1, b1, a2, b2) => a1 < b2 && a2 < b1;
  const fits = (occ, s, e, pad) => !occ.some(o => overlap(s - pad, e + pad, o.s, o.e));
  function findSlot(occ, A, B, want, min, target, pad) {
    let best = null;
    for (let s = r5(A); s + min <= B; s += 5) {
      let d = Math.min(want, B - s); d -= d % 5;
      while (d >= min && !fits(occ, s, s + d, pad)) d -= 5;
      if (d < min) continue;
      const sc = Math.abs(s + d / 2 - target) - d * 0.6;
      if (!best || sc < best.sc) best = { s, e: s + d, sc };
    }
    return best;
  }
  function mergedBusy(blocks, A, B) {
    const iv = blocks.filter(b => !b.marker && b.end > b.start).map(b => [Math.max(A, b.start - (b.hsc ? HSC_TRIP : 0)), Math.min(B, b.end + (b.hsc ? HSC_TRIP : 0))]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
    let tot = 0, cur = null;
    iv.forEach(([a, b]) => { if (!cur || a > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); });
    if (cur) tot += cur[1] - cur[0];
    return tot;
  }

  // ---------- suggestion builders ----------
  const MOVE_RE = /fitness|gym|workout|basketball|dance|hiking|yoga|climb|running|\brun\b|swim|soccer|volleyball|tennis|sports|lift|wellness|recreation|pickleball|martial/i;
  function dietLine(P) {
    const d = (P.diet || []).filter(v => v && v !== 'None'), a = (P.allergies || []).filter(v => v && v !== 'None');
    if (!d.length && !a.length) return '';
    return 'Your notes: ' + [...d, ...a.map(x => x.toLowerCase() + ' allergy')].join(' · ') + '. Check station labels and ask staff.';
  }
  function mealCands(meal, s, len, date, ctx, prevPt, usedIds) {
    const P = ctx.P, diet = (P.diet || []).join(' ').toLowerCase(), favs = uniq([...(P.foods || []), ...(P.snacks || [])]), FK = (TH.x && TH.x.FOOD_KW) || {};
    const swipes = (TH.student().dining || {}).swipesLeft || 0, out = [];
    (TH.PLACES || []).forEach(p => {
      if (p.cat !== 'dining') return;
      const tags = (p.tags || []).join(' '), isHall = !!p.hall;
      if (!isHall) {
        if (/groceries|uscard|events venue|essentials/i.test(tags) || /members[- ]only/i.test((p.features || []).join(' ') + ' ' + (p.desc || ''))) return;
        if (meal.slot === 'breakfast' ? !/coffee|breakfast|tea/i.test(tags) : !/campus center|restaurant/i.test(tags)) return;
      }
      if (TH.openFor(p, at(date, s), len) !== true) return;
      const hay = (p.name + ' ' + (p.features || []).join(' ') + ' ' + (p.desc || '')).toLowerCase(), why = [];
      let sc = isHall ? 3 : 1.4;
      if (/vegan|vegetarian/.test(diet)) { if (/vegan/.test(hay)) { sc += 2.5; why.push('Vegan station'); } else if (/plant-forward|plant based|plant-based/.test(hay)) { sc += 1.2; why.push('Plant-forward options'); } }
      if (/gluten/.test(diet) && /gluten/.test(hay)) { sc += 2.5; why.push('Gluten Awareness Zone'); }
      const fav = favs.find(f => (FK[f] || [String(f).toLowerCase()]).some(k => hay.includes(k)));
      if (fav) { sc += 1.5; why.push('Serves ' + String(fav).toLowerCase()); } // from the venue's listed stations, not today's menu
      if (meal.slot === 'breakfast' && (P.drinks || []).some(d => /coffee/i.test(d)) && /coffee/i.test(tags)) { sc += 1; why.push('Coffee fix'); }
      const w = walkEst(prevPt, p); if (w != null) sc -= w * 0.12;
      if (usedIds && usedIds.has(p.id)) sc -= 1.1; // mix it up across the day's meals
      let line = null; try { const lv = TH.live(p, at(date, s)); if (lv && lv.kind === 'wait') { line = lv.value; sc -= lv.value * 0.05; } } catch (e) { /* no estimate */ }
      if (isHall && swipes > 0) why.push('1 meal swipe');
      sc += (hash(p.id + s) % 100) / 1000;
      out.push({ kind: 'meal', ref: 'place:' + p.id, place: p, sc, why, line, walk: w });
    });
    return out.sort((a, b) => b.sc - a.sc);
  }
  function studyPlaces(s, len, date, prevPt, ctx, paper) {
    const stem = /computer|engineer|math|physics|chem|bio|data|science/i.test(ctx.P.major || '');
    const out = [];
    (TH.PLACES || []).forEach(p => {
      if (p.cat !== 'study' || /archives|its computing/i.test(p.name)) return;
      if (/writing center/i.test(p.name) && !paper) return;
      if (TH.openFor(p, at(date, s), len) !== true) return;
      const why = []; let sc = /^(leavey|doheny|sel)$/.test(p.id) ? 2 : 0.6;
      if (p.id === 'sel' && stem) { sc += 0.8; why.push('Science & Engineering Library'); }
      if (p.id === 'leavey') why.push('Open 24 hours');
      if (/writing center/i.test(p.name) && paper) { sc += 2; why.push('Writing Center for your paper'); }
      let busy = null; try { const lv = TH.live(p, at(date, s)); if (lv && lv.kind === 'busy') { busy = lv.value; sc -= lv.value / 100; } } catch (e) { /* no estimate */ }
      const w = walkEst(prevPt, p); if (w != null) sc -= w * 0.1;
      sc += (hash(p.id + s) % 100) / 1000;
      out.push({ kind: 'study', ref: 'place:' + p.id, place: p, sc, why, busy, walk: w });
    });
    return out.sort((a, b) => b.sc - a.sc);
  }
  function movePlaces(s, len, date, prevPt, hits) {
    const swim = hits.some(h => /swim/i.test(h)), out = [];
    ['lyon', 'vfit', 'uac'].forEach(id => {
      const p = TH.byId && TH.byId[id]; if (!p) return;
      if (TH.openFor(p, at(date, s), len) !== true) return;
      let sc = id === 'uac' ? (swim ? 3 : 0.5) : 2; const why = [], f = (p.features || []).join(' ');
      if (hits.some(h => /basketball|volleyball|pickleball|racquet/i.test(h)) && /courts?/i.test(f)) { sc += 1; why.push('Courts at the Main Gym'); }
      if (hits.some(h => /dance|yoga|boxing|cycl/i.test(h)) && /studio/i.test(f)) { sc += 1; why.push('Studios for ' + hits.find(h => /dance|yoga|boxing|cycl/i.test(h)).toLowerCase()); }
      const w = walkEst(prevPt, p); if (w != null) sc -= w * 0.08;
      out.push({ kind: 'move', ref: 'place:' + id, place: p, sc, why, walk: w });
    });
    return out.sort((a, b) => b.sc - a.sc);
  }

  // =====================================================================
  // TH.plan.day(dateKey, opts)
  // =====================================================================
  function day(key, o) {
    key = /^\d{4}-\d{2}-\d{2}$/.test(String(key || '')) ? key : todayKey();
    if (offOf(key) < 0) key = todayKey();
    o = Object.assign({ vibe: 'balanced', removed: [], swaps: {}, locked: {}, seed: 0, focus: null }, o || {});
    const V = VIBES[o.vibe] || VIBES.balanced, ctx = ctxNew(), P = ctx.P;
    const date = TH.parseKey(key), off = offOf(key), isToday = off === 0, wd = date.getDay(), weekend = wd === 0 || wd === 6;
    const holiday = window.TA && TA.POLICY && TA.POLICY.holidays ? TA.POLICY.holidays[key] : null;
    const brk = TH.acad && TH.acad.breakOn ? TH.acad.breakOn(key) : null;
    const END = 1380, nm = nowMin(), fixed = fixedBlocks(off);
    const firstFx = fixed.filter(b => blocking(b) && b.kind !== 'line' && b.kind !== 'ride').map(b => b.start).sort((a, b) => a - b)[0];
    const wake = Math.min(weekend || holiday ? 570 : 480, firstFx != null ? Math.max(400, firstFx - 50) : 1440);
    const from = isToday ? Math.max(wake, r5(nm + 10)) : wake;
    const late = isToday && nm >= 1350;
    const removed = new Set(o.removed || []);
    const savedSlots = new Set(fixed.filter(b => b.slot).map(b => b.slot));
    const occ = fixed.filter(blocking).map(b => ({ s: b.start - (b.hsc ? HSC_TRIP : 0), e: b.end + (b.hsc ? HSC_TRIP : 0), id: b.id, soft: b.soft })); // HSC: the ride there and back is busy too
    const sug = [], used = new Set(), swaps = {};
    const prevPtAt = m => { let best = null; [...fixed, ...sug].forEach(b => { if (b.pt && b.end <= m && (!best || b.end > best.end)) best = b; }); return best ? best.pt : (isToday ? ptOf(TH.ME) : ptOf(TH.HOME)); };
    const can = slot => !removed.has(slot) && !savedSlots.has(slot) && !late;
    const pickIdx = (slot, cands) => {
      const sw = o.swaps && o.swaps[slot];
      if (sw) { const i = cands.findIndex(c => c.ref === sw); if (i >= 0) return i; }
      if (o.seed && !(o.locked && o.locked[slot])) return o.seed % Math.min(3, cands.length);
      return 0;
    };
    const add = b => { sug.push(b); if (b.end > b.start) occ.push({ s: b.start - (b.hsc ? HSC_TRIP : 0), e: b.end + (b.hsc ? HSC_TRIP : 0), id: b.id }); if (b.eventId) used.add(String(b.eventId)); };
    const mk = (slot, kind, s, e, extra) => Object.assign({ id: 'sg-' + slot, slot, kind, kindLabel: K[kind].label, start: s, end: e, fixed: false, icon: K[kind].icon, color: K[kind].color, locked: !!(o.locked && o.locked[slot]) }, extra);

    // 1) locked suggestions keep their exact choice and time
    Object.keys(o.locked || {}).forEach(slot => {
      const L = o.locked[slot]; if (!L || !can(slot) || L.start < from) return;
      if (L.eventId) { const e = TH.eventById(L.eventId); if (!e || ctx.onCal.has(String(e.id))) return; }
      if (L.placeId && TH.byId[L.placeId] && TH.openFor(TH.byId[L.placeId], at(date, L.start), L.end - L.start) === false) return;
      const lp = L.hsc ? HSC_TRIP : 0;
      if (!fits(occ, L.start - lp, L.end + lp, 0) || (L.hsc && L.start - HSC_TRIP < (isToday ? nm : wake))) return;
      const place = L.placeId ? TH.byId[L.placeId] : null;
      add(mk(slot, L.kind, L.start, L.end, { title: L.title, why: L.why, sub: L.sub || '', place, pt: ptOf(place) || L.pt || null, placeLabel: place ? shortName(place) : L.placeLabel || '', eventId: L.eventId || null, ref: L.ref, food: !!L.food, warn: L.warn || [], locked: true, hsc: !!L.hsc, mine: !!L.mine }));
    });
    const has = slot => sug.some(b => b.slot === slot);

    // 2) meals (a fixed event with free food or a mobile order in the window covers the meal)
    const MEALS = weekend || holiday
      ? [{ slot: 'brunch', label: 'Brunch', A: 600, B: 810, target: 690, want: 50, min: 30 }, { slot: 'dinner', label: 'Dinner', A: 1020, B: 1230, target: 1110, want: 50, min: 30 }]
      : [{ slot: 'breakfast', label: 'Breakfast', A: 420, B: 615, target: 510, want: 30, min: 20 }, { slot: 'lunch', label: 'Lunch', A: 660, B: 870, target: 735, want: 45, min: 25 }, { slot: 'dinner', label: 'Dinner', A: 1020, B: 1230, target: 1110, want: 50, min: 30 }];
    const covered = {};
    MEALS.forEach(M => {
      const c = fixed.find(b => !b.dropIn && ((b.food && (b.kind === 'event' || b.kind === 'club')) || b.kind === 'order') && overlap(b.start, Math.max(b.end, b.start + 30), M.A, M.B) && (b.end > from || !isToday));
      if (c) { covered[M.slot] = c; c.covers = c.kind === 'order' ? `Your ${M.label.toLowerCase()} is ordered` : `Doubles as ${M.label.toLowerCase()}: free food listed`; }
    });
    const dl = dietLine(P);
    function placeMeal(M) {
      if (!can(M.slot) || has(M.slot) || covered[M.slot]) return;
      const A = Math.max(M.A, from); if (A + M.min > M.B) return;
      let sl = findSlot(occ, A, M.B, M.want, M.min, M.target, 10), clash = null;
      if (!sl) { // no clean gap: eat during an optional club/saved event rather than skip the meal
        sl = findSlot(occ.filter(q => !q.soft), A, M.B, M.want, M.min, M.target, 10);
        if (sl) clash = fixed.find(b => b.soft && blocking(b) && overlap(sl.s, sl.e, b.start, b.end));
      }
      if (!sl) return;
      const prev = prevPtAt(sl.s), cands = mealCands(M, sl.s, sl.e - sl.s, date, ctx, prev, new Set(sug.filter(b => b.kind === 'meal' && b.place).map(b => b.place.id)));
      if (!cands.length) return;
      const c = cands[pickIdx(M.slot, cands)], p = c.place;
      const st = TH.status(p, at(date, sl.s)), why = [...c.why];
      if (st && st.detail && /^until /i.test(st.detail)) why.unshift('Open till ' + st.detail.replace(/^until /i, ''));
      if (clash) why.unshift(`Overlaps ${clash.title.length > 40 ? clash.title.slice(0, 38) + '…' : clash.title}. Eat first, then head over`);
      add(mk(M.slot, 'meal', sl.s, sl.e, { title: `${M.label} at ${shortName(p)}`, place: p, pt: ptOf(p), placeLabel: p.name, ref: c.ref, why: why.slice(0, 3).join(' · '), line: c.line, warn: dl ? [dl] : [], mealLabel: M.label, alts: cands }));
    }
    MEALS.forEach(placeMeal);

    // 3) events: joined clubs + profile + thumbs, that fit (a free-food event can stand in for a meal)
    const evs = (TH.events ? TH.events() : []).filter(e => e.dkey === key && !e.allDay && !e.multiDay && !ctx.onCal.has(String(e.id)) && !used.has(String(e.id)));
    const scored = evs.map(e => { const sc = scoreEvent(e, ctx); return sc ? Object.assign({ out: outingOf(e) }, sc, { why: sc.why.slice() }) : null; }).filter(Boolean)
      .map(x => { if (x.out) { x.s += 1.2; x.why.unshift(x.out.kind === 'Trip' || x.out.kind === 'Off-campus' ? 'Off-campus outing' : x.out.kind + ' outing'); } return x; })
      .sort((a, b) => b.s - a.s || a.e.start - b.e.start);
    const evWindow = x => { const e = x.e, len = Math.max(30, (e.end > e.start ? e.end : e.start + 60) - e.start); if (len <= 150) return { s: e.start, e: e.start + len, dropIn: false }; return { s: Math.max(e.start, from), e: Math.max(e.start, from) + 75, dropIn: true, until: e.start + len }; };
    // HSC events need the ride there and back (~45 min each way, est.) free, and enough lead time to get there
    const padOf = x => (x.hsc ? HSC_TRIP : 10);
    const evFits = (x, occList) => {
      const w = evWindow(x), pad = padOf(x), earliest = x.hsc ? (isToday ? nm : wake) + HSC_TRIP : from;
      if (w.e > 1439 || (!w.dropIn && w.s < earliest)) return null;
      if (w.dropIn) { for (let s = Math.max(w.s, r5(earliest)); s + 60 <= Math.min(w.until, END); s += 15) if (fits(occList, s, s + 60, pad)) return { s, e: s + 60, dropIn: true, until: w.until }; return null; }
      return fits(occList, w.s, w.e, pad) ? w : null;
    };
    function placeEvent(slot) {
      if (!can(slot) || has(slot)) return;
      const cands = scored.filter(x => !used.has(String(x.e.id)) && x.s >= (x.joined ? 0 : V.thr));
      const fitList = [];
      cands.forEach(x => {
        let w = evFits(x, occ), bump = null;
        if (!w) { // try moving a planned meal out of the way, or let free food replace it
          const meal = sug.find(b => b.kind === 'meal' && !b.locked && overlap(evWindow(x).s - padOf(x), evWindow(x).e + padOf(x), b.start, b.end));
          if (meal) { const rest = occ.filter(q => q.id !== meal.id); w = evFits(x, rest); if (w) bump = meal; }
        }
        if (w) fitList.push({ x, w, bump });
      });
      if (!fitList.length) return;
      const pick = fitList[pickIdx(slot, fitList.map(f => ({ ref: 'event:' + f.x.e.id })))];
      const { x, w, bump } = pick, e = x.e, full = TH.eventById(e.id), pp = evPlace(full);
      if (bump) { sug.splice(sug.indexOf(bump), 1); const i = occ.findIndex(q => q.id === bump.id); if (i >= 0) occ.splice(i, 1); }
      const kind = x.out ? 'outing' : 'pick', why = x.why.slice(0, 2);
      if (w.dropIn) why.push(`Runs till ${fmt(w.until)}, drop in`);
      const b = mk(slot, kind, w.s, w.e, { title: e.title, eventId: e.id, ref: 'event:' + e.id, sub: shortOrg(e.org), place: null, pt: pp && !x.hsc ? { x: pp.x, y: pp.y } : null, placeLabel: x.online ? 'Online' : pp && !x.hsc ? pp.label : (e.location ? TH.shortLoc(e.location) : 'Location shown after you RSVP on EngageSC'), why: why.join(' · '), food: !!e.food, warn: x.warn || [], longEv: w.dropIn, out: x.out, hsc: x.hsc, mine: !!x.joined });
      add(b);
      if (bump) { // re-place the meal elsewhere, or let the free food cover it; never drop a meal for an event
        const M = MEALS.find(m => m.slot === bump.slot);
        if (e.food && overlap(w.s, w.e, M.A, M.B)) { covered[M.slot] = b; b.why = [`Doubles as ${M.label.toLowerCase()}: free food listed`, ...why.filter(y => !/free food|^free /i.test(y))].slice(0, 2).join(' · '); }
        else {
          placeMeal(M);
          if (!has(M.slot)) { sug.splice(sug.indexOf(b), 1); const j = occ.findIndex(q => q.id === b.id); if (j >= 0) occ.splice(j, 1); add(bump); return placeEvent(slot); }
        }
      }
      b.alts = fitList.filter(f => f !== pick).map(f => f.x);
    }
    const savedEv = fixed.filter(b => b.kind === 'event' && !b.dropIn && (!isToday || b.end > from)).length; // already going to something: suggest fewer
    for (let i = 1; i <= Math.max(0, V.picks - savedEv); i++) placeEvent('evt' + i);
    // 4) study blocks before deadlines and exams
    const A2 = TH.acad, targets = [];
    if (A2) {
      const dayEnd = TH.addDays(date, 1), lim = at(dayEnd, 720);
      A2.items().filter(i => !A2.isDone(i) && i.at > now() && i.at >= date && i.at <= lim).forEach(i => targets.push({ t: 'due', i, by: i.key === key ? i.min : 1440, rank: i.at, title: `Finish ${i.course} ${i.title.split(':')[0]}`, paper: i.type === 'paper', why: i.key === key ? `Due ${i.min >= 1430 ? 'tonight at 11:59 PM' : 'at ' + fmt(i.min)}. Knock it out early` : `Due tomorrow ${A2.dueLabel(i)}. Future you says thanks`, course: i.course }));
      A2.exams().filter(x => !x.past && x.day >= date && x.day <= TH.addDays(date, 4)).forEach(x => { const d = Math.round((x.day - date) / 864e5); targets.push({ t: 'exam', x, by: d === 0 ? x.start - 30 : 1440, rank: x.at, title: `Study for ${x.course} ${x.title}`, why: d === 0 ? `${x.title} is today at ${fmt(x.start)}. Light review only` : `${x.title} is ${d === 1 ? 'tomorrow' : dayName(x.day)} at ${fmt(x.start)}. Short sessions beat one cram`, course: x.course }); });
      targets.sort((a, b) => a.rank - b.rank);
      if (!targets.length && o.vibe === 'study') { const nx = A2.nextExams(1)[0]; if (nx) targets.push({ t: 'exam', x: nx, by: 1440, rank: nx.at, title: `Get ahead in ${nx.course}`, why: `${nx.title} is ${TH.fmtDate(nx.day)}. A head start now = a calm week`, course: nx.course }); }
    }
    let si = 0;
    const examToday = fixed.filter(b => b.kind === 'exam' && b.end > from).sort((x, y) => x.start - y.start)[0];
    targets.filter(tg => !examToday || String(examToday.title).indexOf(tg.course) === 0).slice(0, V.study).forEach(tg => { // exam day: only that exam
      si++; const slot = 'study' + si; if (!can(slot) || has(slot)) return;
      const want = tg.t === 'exam' ? 90 : 60, min = 40, B = Math.min(END - 30, tg.by - 10, examToday ? examToday.start - 30 : 1440); // exam day: study before it, not after
      const sl = findSlot(occ, from, B, want, min, si === 1 ? 900 : 1170, 10); if (!sl) return;
      const prev = prevPtAt(sl.s), cands = studyPlaces(sl.s, sl.e - sl.s, date, prev, ctx, tg.paper); if (!cands.length) return;
      const c = cands[pickIdx(slot, cands)], p = c.place, why = [tg.why, ...c.why];
      add(mk(slot, 'study', sl.s, sl.e, { title: tg.title, place: p, pt: ptOf(p), placeLabel: p.name, ref: c.ref, why: why.slice(0, 2).join(' · '), busy: c.busy, course: tg.course, alts: cands }));
    });
    // 5) move, if the student's interests fit
    const hits = uniq([...(P.interests || []), ...(P.clubTypes || []), ...(P.careerGoals || [])].filter(v => MOVE_RE.test(v)));
    if (hits.length && can('move') && !has('move')) {
      const sl = findSlot(occ, Math.max(from, 420), 1290, 60, 40, weekend ? 660 : 1050, 10);
      if (sl) { const prev = prevPtAt(sl.s), cands = movePlaces(sl.s, sl.e - sl.s, date, prev, hits); if (cands.length) { const c = cands[pickIdx('move', cands)], p = c.place; add(mk('move', 'move', sl.s, sl.e, { title: `Move at ${shortName(p)}`, place: p, pt: ptOf(p), placeLabel: p.name, ref: c.ref, why: [`You’re into ${hits.slice(0, 2).join(' & ').toLowerCase()}`, ...c.why].slice(0, 2).join(' · '), alts: cands })); } }
    }
    // after an exam: a small reward
    if (examToday && can('treat') && !has('treat')) {
      const sl = findSlot(occ, Math.max(from, examToday.end), Math.min(examToday.end + 150, 1410), 40, 25, examToday.end + 20, 5);
      if (sl) add(mk('treat', 'recharge', sl.s, sl.e, { title: 'Post-exam treat', why: `You finished ${examToday.title}. Boba, a walk or a nap: your call`, placeLabel: 'You earned it' }));
    }
    // 6) recharge (Chill mode)
    if (o.vibe === 'chill' && can('recharge') && !has('recharge')) {
      const sl = findSlot(occ, Math.max(from, 780), 1260, 45, 30, 960, 10);
      if (sl) add(mk('recharge', 'recharge', sl.s, sl.e, { title: 'Recharge', why: 'Tommy’s orders: nap, walk, call home. No problem sets', placeLabel: 'Anywhere but a library' }));
    }
    // 7) wind down: lights out ~8h before tomorrow's first class or exam
    let windWhy = 'Nothing early tomorrow. Sleep in a little', bed = 1410;
    try {
      const t2 = TH.addDays(date, 1), first = [...TH.classesOn(t2).map(c => ({ s: c.start, t: `${c.code} ${c.type}` })), ...((TH.acad && TH.acad.examsOn(TH.dkey(t2))) || []).map(x => ({ s: x.start, t: `${x.course} ${x.title}` }))].sort((a, b) => a.s - b.s)[0];
      if (first) { bed = Math.max(1320, Math.min(1470, first.s + 1440 - 525)); windWhy = `Lights out by ${fmt(bed)}: 8 hours before your ${fmt(first.s)} ${first.t}`; }
    } catch (e) { /* no classes */ }
    if (can('wind') && !has('wind')) {
      let ws = bed - 30; const lastEnd = Math.max(0, ...occ.map(q => q.e));
      if (lastEnd > ws) ws = r5(lastEnd + 10);
      if (ws >= from && ws + 20 <= 1470) add(mk('wind', 'wind', ws, Math.min(ws + 30, 1470), { title: 'Wind down', why: windWhy, placeLabel: 'Phone on Do Not Disturb' }));
    }

    // ---------- walking legs + tight connections ----------
    const all = [...fixed, ...sug].sort((a, b) => a.start - b.start || (a.marker ? -1 : 0) - (b.marker ? -1 : 0) || a.end - b.end);
    const timed = all.filter(b => blocking(b) && (!isToday || b.end > from - 10));
    timed.forEach((b, i) => {
      if (b.hsc) { b.trip = hscTrip(date, b.start, b.end, isToday ? nm + 5 : 0); return; } // shuttle / car legs, not a walk
      if (!b.pt || b.fixed && b.kind === 'class') return;
      const prev = timed[i - 1];
      if (prev && !prev.pt) { b.gapBefore = b.start - prev.end; return; }
      const origin = prev ? prev.pt : (isToday ? ptOf(TH.ME) : ptOf(TH.HOME)), lab = prev ? (prev.placeLabel || prev.title) : (isToday ? 'where you are (TCC)' : 'home');
      const m = walk(ctx, origin, b.pt, Math.floor(b.start / 60));
      if (m == null) return;
      b.walk = { min: m, from: lab };
      if (prev && b.start - prev.end < m) b.tight = true;
    });

    // ---------- alternatives for swaps ----------
    sug.forEach(b => {
      if (!b.alts) return;
      const curRef = b.ref;
      swaps[b.slot] = b.alts.map(c => {
        if (c.e) { const e = c.e, full = TH.eventById(e.id), pp = c.hsc ? null : evPlace(full), long = e.end - e.start > 150, st = long ? Math.max(e.start, c.hsc ? r5(Math.max(from, (isToday ? nm : wake) + HSC_TRIP)) : from) : e.start; return { ref: 'event:' + e.id, kind: c.out ? 'outing' : 'pick', title: e.title, sub: shortOrg(e.org), start: st, end: long ? st + 75 : (e.end > e.start ? e.end : e.start + 60), eventId: e.id, why: [...(long ? [`Runs till ${fmt(e.end)}, drop in`] : []), ...c.why].slice(0, 2).join(' · ') || 'Fits your free time', food: !!e.food, hsc: !!c.hsc, placeLabel: (c.online ? 'Online' : pp ? pp.label : (e.location ? TH.shortLoc(e.location) : '')) + (c.hsc && !/health science/i.test(e.location ? TH.shortLoc(e.location) : '') ? ' · Health Sciences Campus' : '') + (c.hsc ? ' (~45 min away, est.)' : '') }; }
        const p = c.place; return { ref: c.ref, kind: c.kind, title: b.kind === 'meal' ? `${b.mealLabel} at ${shortName(p)}` : b.kind === 'move' ? `Move at ${shortName(p)}` : shortName(p), placeId: p.id, placeLabel: p.name, start: b.start, end: b.end, why: (c.why.join(' · ') || TH.rangesText(TH.dayRanges(p, date))) + (c.walk != null ? ` · ~${c.walk} min walk` : ''), line: c.line, busy: c.busy };
      }).filter(a => a.ref !== curRef).slice(0, 6);
      delete b.alts;
    });

    // ---------- vibe + free time ----------
    const winStart = isToday ? Math.min(Math.max(wake, nm), END) : wake;
    const windowMin = Math.max(0, END - winStart);
    const busyFixed = mergedBusy(fixed.filter(b => !b.dropIn && b.kind !== 'planned' && b.kind !== 'line' && b.kind !== 'ride'), winStart, END);
    const plannedMin = mergedBusy(sug.filter(b => b.kind !== 'wind'), winStart, END);
    const free = Math.max(0, windowMin - busyFixed);
    const classes = fixed.filter(b => b.kind === 'class').length, exams = fixed.filter(b => b.kind === 'exam' && (!isToday || b.end > nm)), dueOpen = fixed.filter(b => b.kind === 'due' && !b.done).length;
    const remClasses = isToday ? fixed.filter(b => b.kind === 'class' && b.end > nm).length : classes;
    const load = busyFixed / Math.max(60, windowMin);
    let tone, title, line;
    const part = isToday && nm >= 1020 ? 'evening' : isToday && nm >= 720 ? 'afternoon' : 'day';
    const nPicks = sug.filter(b => b.kind !== 'wind').length;
    const done = isToday && classes && !remClasses ? 'Classes are done. ' : isToday && remClasses && remClasses < classes ? `${remClasses} class${remClasses === 1 ? '' : 'es'} to go. ` : '';
    if (late) { tone = 'late'; title = 'That’s a wrap for today'; line = 'It’s late. Tommy’s best plan: sleep. Want tomorrow sorted instead?'; }
    else if (exams.length) { tone = 'exam'; title = 'Exam day. You’ve got this.'; line = `${exams[0].title} at ${fmt(exams[0].start)}. Tommy kept the rest of the day calm${nPicks ? ' and fed' : ''}.`; }
    else if (holiday || (brk && brk.kind !== 'finals' && brk.kind !== 'study')) { tone = 'free'; title = holiday ? `${holiday}: no classes` : `${brk.name}: no classes`; line = 'A free day. Here’s how to make it count.'; }
    else if (load >= 0.55 || remClasses >= 4) { tone = 'packed'; title = part === 'day' ? 'Packed day. Tommy’s got you.' : `Packed ${part}. Tommy’s got you.`; line = `${done}Meals and breathers are worked in between everything.`; }
    else if (load >= 0.28 || remClasses >= 2) { tone = 'busy'; title = part === 'day' ? 'Busy but doable' : `Busy ${part}, still doable`; line = `${done}${dur(free)} of free time, and Tommy filled it with the good stuff.`; }
    else if (weekend && !classes) { tone = 'free'; title = 'Free day! Let’s make it count'; line = 'No classes. Here’s a plan with room to breathe.'; }
    else { tone = 'chill'; title = part === 'evening' ? 'Easy evening ahead' : part === 'afternoon' ? 'Smooth afternoon ahead' : 'Chill day ahead'; line = `${done}Lots of room. Here’s how to make it count.`; }
    if (o.vibe === 'study' && !late && tone !== 'exam') line = 'Study mode: deadlines first, then food. ' + line;

    const blocks = all;
    const picks = sug.filter(b => !b.fixed).sort((a, b) => a.start - b.start);
    return {
      key, date, off, isToday, weekend, holiday: holiday || null, brk: brk || null, from, late, vibe: { tone, title, line, mode: o.vibe, label: V.label },
      free: { min: free, planned: plannedMin, window: windowMin, pct: windowMin ? Math.round(Math.max(0, free - plannedMin) / windowMin * 100) : 0, left: Math.max(0, free - plannedMin) },
      stats: { classes, exams: exams.length, due: dueOpen, picks: picks.length }, blocks, picks, swaps, fixed, covered,
      onboarded: !!P.onboarded, prefsEmpty: !((P.interests || []).length || (P.careerGoals || []).length || (P.clubTypes || []).length || (P.foods || []).length),
    };
  }

  // =====================================================================
  // TH.plan.week(startKey, opts)
  // =====================================================================
  function quickDay(key, ctx) {
    const date = TH.parseKey(key), off = offOf(key), fixed = fixedBlocks(off), wd = date.getDay(), weekend = wd === 0 || wd === 6;
    const holiday = window.TA && TA.POLICY && TA.POLICY.holidays ? TA.POLICY.holidays[key] : null;
    const wake = weekend || holiday ? 570 : 480, END = 1380, from = off === 0 ? Math.max(wake, nowMin()) : wake;
    const busy = mergedBusy(fixed.filter(b => !b.dropIn && b.kind !== 'line' && b.kind !== 'ride'), wake, END);
    const classes = fixed.filter(b => b.kind === 'class').length;
    const exams = (TH.acad ? TH.acad.examsOn(key) : []).filter(x => !(off === 0 && x.end < nowMin()));
    const due = TH.acad ? TH.acad.dueOn(key).filter(i => !TH.acad.isDone(i)) : [];
    const brk = TH.acad && TH.acad.breakOn ? TH.acad.breakOn(key) : null;
    const load = busy / (END - wake);
    const tone = exams.length ? 'exam' : holiday || (brk && brk.kind === 'holiday') ? 'free' : load >= 0.55 || classes >= 4 ? 'packed' : load >= 0.28 || classes >= 2 ? 'busy' : weekend && !classes ? 'free' : 'chill';
    // today: skip what already started, and HSC events the student can't reach in time (~45 min ride, est.)
    const tooFar = e => off === 0 && isHSC(e.location) && (e.end - e.start > 150 ? e.end - 60 : e.start) - HSC_TRIP < nowMin();
    const evs = (TH.events ? TH.events() : []).filter(e => e.dkey === key && !e.allDay && !e.multiDay && !(off === 0 && e.start + 30 < from) && !tooFar(e));
    const sc = evs.map(e => scoreEvent(e, ctx)).filter(Boolean);
    const onCal = fixed.filter(b => b.kind === 'event' || b.kind === 'club');
    const dropRe = /\b(drop-?in|office hours|open hours|walk-?in|open lab|study hall)\b/i, isDrop = e => /office hours/i.test(e.type || '') || dropRe.test(e.title || '');
    const clubEv = [...onCal.filter(b => b.kind === 'club' && !b.dropIn), ...sc.filter(x => x.joined && !ctx.onCal.has(String(x.e.id)) && !isDrop(x.e)).map(x => ({ title: x.e.title, start: x.e.start, eventId: x.e.id, kind: 'club', notSaved: true }))];
    const drops = onCal.filter(b => b.dropIn).length;
    // never pick something that clashes with a class or exam, and show a double-listed event once
    const hard = fixed.filter(b => blocking(b) && !b.soft), clash = e => { const pad = isHSC(e.location) ? HSC_TRIP : 0; return hard.some(b => overlap(e.start - pad, Math.max(e.end, e.start + 30) + pad, b.start, b.end)); };
    const seen = new Set(), once = x => { const k = String(x.e.title).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 26); if (seen.has(k)) return false; seen.add(k); return true; };
    const picks = sc.filter(x => !ctx.onCal.has(String(x.e.id)) && !x.joined && x.s >= 1.2 && !clash(x.e)).sort((a, b) => b.s - a.s).filter(once).slice(0, 3);
    const food = sc.filter(x => x.e.food && !ctx.onCal.has(String(x.e.id))).sort((a, b) => b.s - a.s);
    const outings = evs.map(e => { const out = outingOf(e); return out ? { e, out, sc: scoreEvent(e, ctx) } : null; }).filter(Boolean);
    return { key, date, off, label: TH.DAYS3[wd], dnum: date.getDate(), weekend, holiday: holiday || null, brk, tone, busy, free: Math.max(0, END - from - busy), classes, exams, due, clubEv, drops, saved: onCal.filter(b => b.kind === 'event' && !b.dropIn), picks, food, outings, plannedN: fixed.filter(b => b.kind === 'planned').length };
  }
  function week(startKey, o) {
    startKey = /^\d{4}-\d{2}-\d{2}$/.test(String(startKey || '')) && offOf(startKey) >= 0 ? startKey : todayKey();
    o = o || {};
    const ctx = ctxNew(), start = TH.parseKey(startKey);
    const days = Array.from({ length: 7 }, (_, i) => quickDay(TH.dkey(TH.addDays(start, i)), ctx));
    const picks = days.flatMap(d => d.picks.map(x => Object.assign({ day: d }, x))).sort((a, b) => b.s - a.s).slice(0, 8);
    const food = days.flatMap(d => d.food.map(x => Object.assign({ day: d }, x))).sort((a, b) => b.s - a.s || a.e.s - b.e.s).slice(0, 8);
    const outings = days.flatMap(d => d.outings.map(x => Object.assign({ day: d }, x)));
    const endK = TH.dkey(TH.addDays(start, 7)), lim = TH.dkey(TH.addDays(start, 35));
    const later = (TH.events ? TH.events() : []).filter(e => e.dkey >= endK && e.dkey < lim && !e.allDay && !e.multiDay).map(e => { const out = outingOf(e); return out ? { e, out } : null; }).filter(Boolean).slice(0, 4);
    const deadlines = days.flatMap(d => [...d.exams.map(x => ({ day: d, kind: 'exam', title: `${x.course} ${x.title}`, at: x.start, color: x.color })), ...d.due.map(i => ({ day: d, kind: 'due', title: `${i.course} ${i.title.split(':')[0]}`, at: i.min, color: i.color }))]);
    const exams = days.reduce((n, d) => n + d.exams.length, 0), dueN = days.reduce((n, d) => n + d.due.length, 0), busyDays = days.filter(d => d.tone === 'packed' || d.tone === 'exam').length;
    const tone = exams >= 2 || busyDays >= 3 ? 'packed' : exams || busyDays >= 1 ? 'busy' : 'chill';
    const title = exams >= 2 ? `Big week: ${exams} exams` : exams ? 'One exam, lots of life' : busyDays >= 3 ? 'A full week. Pace yourself' : 'Smooth week ahead';
    const off = days.find(d => d.holiday || (d.brk && d.brk.kind !== 'finals' && d.brk.kind !== 'study'));
    const firstEx = days.find(d => d.exams.length);
    const offDay = off ? (off.off === 0 ? 'today' : off.off === 1 ? 'tomorrow' : TH.DAYS[off.date.getDay()]) : '';
    const line = (off ? (off.holiday && !(off.brk && off.brk.kind === 'recess') ? `${off.holiday} is ${offDay} (no classes). ` : `${(off.brk && off.brk.name) || off.holiday} starts ${offDay}. `) : '') + (tone === 'packed' ? 'Pace yourself: Tommy saved room to study, eat and sleep.' : firstEx ? `Get ahead on ${firstEx.exams[0].course} before ${firstEx.off === 0 ? 'today' : TH.DAYS[firstEx.date.getDay()]}, then enjoy the rest.` : picks.length ? 'Room to explore. Tommy found the good stuff.' : 'Nothing big on the calendar. Enjoy it.');
    const blocks = days.flatMap(d => d.picks.map(x => ({ start: x.e.start, end: x.e.end, kind: 'pick', title: x.e.title, eventId: x.e.id, why: x.why[0] || '', fixed: false, day: d.key })));
    return { start: startKey, end: TH.dkey(TH.addDays(start, 6)), days, picks, food, outings, later, deadlines, vibe: { tone, title, line }, blocks, swaps: {} };
  }
  // real outings in a range of days (Tommy's "find a field trip")
  function outings(fromKey, days) {
    const a = fromKey || todayKey(), b = TH.dkey(TH.addDays(TH.parseKey(a), days || 7)), ctx = ctxNew(), nm = nowMin(), tk = todayKey();
    return (TH.events ? TH.events() : []).filter(e => e.dkey >= a && e.dkey < b && !e.allDay && !e.multiDay && !(e.dkey === tk && e.start + 30 < nm)).map(e => { const out = outingOf(e); return out ? { e, out, sc: scoreEvent(e, ctx) } : null; }).filter(Boolean);
  }

  // =====================================================================
  // saved plan blocks (My Day) + TH.act extensions
  // =====================================================================
  function store() { const x = TH.H().x || (TH.H().x = {}); if (!x.dayplan || typeof x.dayplan !== 'object') x.dayplan = {}; return x.dayplan; }
  const slim = b => ({ slot: b.slot, kind: b.kind, start: b.start, end: b.end, title: b.title, why: b.why || '', placeId: b.place ? b.place.id : (b.placeId || null), placeLabel: b.placeLabel || '', eventId: b.eventId || null, ref: b.ref || null, food: !!b.food, warn: (b.warn || []).slice(0, 2), pt: b.pt || null, sub: b.sub || '', hsc: !!b.hsc, mine: !!b.mine });
  const dayItems0 = TH.dayItems;
  TH.dayItems = function (off) {
    const items = dayItems0.apply(this, arguments);
    try {
      if (!hasTA()) return items;
      const key = TH.dkey(TH.addDays(today(), off || 0)), list = (store()[key] || []);
      if (!list.length) return items;
      list.forEach(p => items.push({ start: p.start, end: p.end, kind: 'Tommy’s plan · ' + (K[p.kind] || K.planned).label, title: p.title, sub: [p.placeLabel, p.why].filter(Boolean).join(' · '), color: 'var(--gold-ink)', go: 'plan:' + key, planSlot: p.slot, planId: p.id, placeId: p.placeId || null }));
      items.sort((a, b) => a.start - b.start || a.end - b.end);
    } catch (e) { /* plan store unavailable */ }
    return items;
  };
  const R = () => ({ block: [], warn: [] });
  function checkAdd(key, blocks) {
    const r = R(); key = String(key || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || offOf(key) < 0) { r.block.push('That day has already passed.'); return r; }
    const list = (blocks || []).filter(Boolean);
    if (!list.length) r.block.push('There’s nothing new to add from this plan.');
    const nm = nowMin(), isToday = offOf(key) === 0, have = store()[key] || [];
    list.forEach(b => {
      if (isToday && b.end <= nm) r.warn.push(`${b.title} already ended, so it’s skipped.`);
      if (b.eventId) { const c = TH.act.check.saveEvent(b.eventId); c.block.forEach(x => r.warn.push(x + ' Skipped.')); c.warn.forEach(x => r.warn.push(x)); }
      else if (have.some(h => h.slot === b.slot)) r.warn.push(`${b.title}: you already have a ${(K[b.kind] || K.planned).label.toLowerCase()} block that day; it’s replaced.`);
    });
    return { block: r.block, warn: uniq(r.warn).slice(0, 6) };
  }
  function runAdd(key, blocks) {
    const list = (blocks || []).filter(Boolean), nm = nowMin(), isToday = offOf(key) === 0, st = store(), have = st[key] || (st[key] = []);
    let ev = 0, pl = 0; const names = [];
    list.forEach(b => {
      if (isToday && b.end <= nm) return;
      if (b.eventId) { const c = TH.act.check.saveEvent(b.eventId); if (c.block.length) return; TH.act.saveEvent(b.eventId); ev++; names.push(b.title); return; }
      const i = have.findIndex(h => h.slot === b.slot); if (i >= 0) have.splice(i, 1);
      have.push(Object.assign({ id: 'pl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now() }, slim(b))); pl++; names.push(b.title);
    });
    have.sort((a, b) => a.start - b.start);
    if (!have.length) delete st[key];
    const d = TH.parseKey(key), when = offOf(key) === 0 ? 'today' : offOf(key) === 1 ? 'tomorrow' : TH.fmtDate(d);
    const n = ev + pl;
    return {
      title: n ? `Added ${n} to My Day` : 'Nothing new to add',
      rows: [['Day', TH.fmtDate(d, true)], ...(ev ? [['Events RSVP’d', `${ev} (simulated; RSVP for real on EngageSC)`]] : []), ...(pl ? [['Tommy’s plan blocks', String(pl)]] : []), ['Added', names.slice(0, 4).join('; ') + (names.length > 4 ? '; …' : '')]],
      log: `Added Tommy’s plan for ${when} to My Day: ${names.slice(0, 5).join('; ')}${names.length > 5 ? '; …' : ''}`,
      item: { key, events: ev, blocks: pl },
    };
  }
  function checkRemove(key, id) { const r = R(); if (!(store()[key] || []).some(p => p.id === id)) r.block.push('That plan block isn’t on My Day anymore.'); return r; }
  function runRemove(key, id) { const st = store(), list = st[key] || [], p = list.find(q => q.id === id); st[key] = list.filter(q => q.id !== id); if (!st[key].length) delete st[key]; return { title: 'Removed from My Day', rows: [['Block', p.title]], log: `Removed ${p.title} (Tommy’s plan) from My Day`, item: p }; }
  function ext(name, check, run) {
    TH.act.check[name] = (...a) => { try { const r = check(...a); return { block: r.block, warn: r.warn }; } catch (e) { return { block: [e.message], warn: [] }; } };
    TH.act[name] = (...a) => { const r = check(...a); if (r.block.length) throw new Error(r.block[0]); const out = run(...a); out.warn = r.warn; return out; };
  }
  if (TH.act) { ext('addPlan', checkAdd, runAdd); ext('removePlanBlock', checkRemove, runRemove); }

  // =====================================================================
  // UNDO for "Add to My Day" (the Plan screen and Tommy's "add these to my day"). TA's own undo puts back a snapshot of
  // the whole account, which would also wipe anything changed since without a log entry (profile and allergy edits,
  // thumbs, SOS details, notifications). Here the add remembers exactly what it changed (its day-plan blocks, the
  // calendar entries and RSVPs it made) and Undo reverts only that, and only while the add is still the latest logged
  // change and what it wrote is still as it left it. Otherwise it can't be undone: the Plan screen's Undo goes away and
  // Tommy says so, and nothing else is touched.
  // =====================================================================
  const SKIP_ROOT = { log: 1, signedIn: 1, scopes: 1 };                      // TA's restore keeps these as they are
  const J = v => (v === undefined ? undefined : JSON.stringify(v));
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const idsOk = arr => arr.every(x => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number')) && new Set(arr.map(x => String(x.id))).size === arr.length;
  // what changed between two copies of the account: objects are compared key by key, lists of records with ids item by item
  function diffOps(a, b, path, out) {
    if (J(a) === J(b)) return out;
    if (isObj(a) && isObj(b)) { new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => { if (!path.length && SKIP_ROOT[k]) return; diffOps(a[k], b[k], path.concat(k), out); }); return out; }
    if (Array.isArray(a) && Array.isArray(b) && idsOk(a) && idsOk(b)) {
      const am = new Map(a.map((x, i) => [String(x.id), [x, i]])), bm = new Map(b.map(x => [String(x.id), x])), op = { p: path, t: 'list', add: [], del: [], chg: [] };
      b.forEach(x => { const k = String(x.id), was = am.get(k); if (!was) op.add.push(k); else if (J(was[0]) !== J(x)) op.chg.push({ id: k, a: J(was[0]), b: J(x) }); });
      a.forEach((x, i) => { const k = String(x.id); if (!bm.has(k)) op.del.push({ id: k, i, a: J(x) }); });
      out.push(op); return out;
    }
    out.push({ p: path, t: 'val', a: J(a), b: J(b) }); return out;
  }
  const getAt = (root, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), root);
  function setAt(root, p, v) {
    let o = root; for (let i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
    const k = p[p.length - 1]; if (v === undefined) delete o[k]; else o[k] = v;
  }
  // is everything the add wrote still as it left it? (records it added may have picked up a reminder flag since)
  function intact(ops) {
    const d = TA.State.d;
    return ops.every(op => {
      const cur = getAt(d, op.p);
      if (op.t === 'val') return J(cur) === op.b;
      if (!Array.isArray(cur)) return !op.add.length && !op.chg.length;
      const m = new Map(cur.map(x => [String(x && x.id), x]));
      return op.add.every(k => m.has(k)) && op.del.every(x => !m.has(x.id)) && op.chg.every(x => m.has(x.id) && J(m.get(x.id)) === x.b);
    });
  }
  // put back only what the add changed; everything else in the account stays as it is now
  function revert(ops) {
    const d = TA.State.d;
    ops.forEach(op => {
      if (op.t === 'val') return setAt(d, op.p, op.a === undefined ? undefined : JSON.parse(op.a));
      let cur = getAt(d, op.p); if (!Array.isArray(cur)) { cur = []; setAt(d, op.p, cur); }
      const drop = new Set(op.add);
      for (let i = cur.length - 1; i >= 0; i--) if (cur[i] && drop.has(String(cur[i].id))) cur.splice(i, 1);
      op.chg.forEach(x => { const i = cur.findIndex(y => y && String(y.id) === x.id); if (i >= 0) cur[i] = JSON.parse(x.a); });
      op.del.slice().sort((x, y) => x.i - y.i).forEach(x => { if (!cur.some(y => y && String(y.id) === x.id)) cur.splice(Math.min(x.i, cur.length), 0, JSON.parse(x.a)); });
    });
  }
  const opsSince = snap => { try { return diffOps(JSON.parse(snap), TA.State.d, [], []); } catch (e) { return null; } };
  // native commit with Tommy's Undo (TA.Brain.lastUndo is what "undo" reverts; its ops make that undo targeted)
  function commitUndoable(fn) {
    const snap = TA.State.snapshot(), res = fn();
    const entry = TA.State.log({ action: res.log, system: 'Trojan Hub', conf: TA.confNo ? TA.confNo('TH') : null });
    TA.State.save();
    if (TA.Brain) TA.Brain.lastUndo = { snap, logId: entry.id, title: res.title, label: res.log, ops: opsSince(snap), planAdd: true };
    return { res, logId: entry.id };
  }
  // live = still the latest logged change, and (for a plan add) what it wrote is untouched
  const undoLive = id => { const u = window.TA && TA.Brain && TA.Brain.lastUndo, L = TA.State && TA.State.d && TA.State.d.log; return !!(u && u.logId === id && L && L[0] && L[0].id === id && (!u.ops || intact(u.ops))); };
  if (window.TA && TA.Brain && TA.State) {
    const B = TA.Brain;
    // Tommy's "add these to my day" goes through TA's own confirm card: remember what that add changed as well
    const exec1 = B.execute;
    if (typeof exec1 === 'function') B.execute = function (p) {
      const before = B.lastUndo, out = exec1.apply(this, arguments);
      const tagOps = o => { try { const u = B.lastUndo; if (p && p.aid === 'hub_plan_add' && u && u !== before && u.snap && !u.ops) { u.ops = opsSince(u.snap); u.planAdd = true; } } catch (e) { /* undo falls back to TA's own */ } return o; };
      return out && typeof out.then === 'function' ? out.then(tagOps) : tagOps(out);
    };
    // TA's undo restores u.snap: for a plan add that becomes the targeted revert
    const restore0 = TA.State.restore;
    TA.State.restore = function (snap) { const u = B.lastUndo; if (u && u.ops && u.planAdd && u.snap === snap) return revert(u.ops); return restore0.apply(this, arguments); };
    // "undo" once the add's blocks or RSVPs have changed: say so, and never put an old copy back
    const undo1 = B.undo;
    B.undo = function () {
      const u = B.lastUndo, L = TA.State.d.log || [];
      if (u && u.ops && u.planAdd && L[0] && L[0].id === u.logId && !intact(u.ops)) {
        B.lastUndo = null;
        return [{ role: 'bot', kind: 'c', md: 'I can’t undo adding Tommy’s plan anymore: some of those blocks or RSVPs have changed since. You can remove any of them on My Day.', chips: [{ label: 'Open My Day', value: '@go:plans', kind: '' }] }];
      }
      const out = undo1.apply(this, arguments);
      if (u && u.ops && u.planAdd && !B.lastUndo) (out || []).forEach(m => { if (m && m.md) m.md = String(m.md).replace('Your account is back to how it was before.', 'Those plan blocks and RSVPs are off My Day, and anything else you changed since stays as it is.'); });
      return out;
    };
  }

  let last = null;
  TH.plan = {
    day, week, outings, slim, kinds: K, vibes: VIBES,
    draft: key => draftOf(key),
    // the student's current day plan with their swaps/locks/removals and vibe (what the screen shows)
    current: (key, extra) => day(key, Object.assign({ vibe: PS().vibe }, draftOf(key), extra || {})),
    last: () => (last && Date.now() - last.t < 30 * 60000 ? last : null),
    remember: (key, focus) => { last = { key, focus: focus || null, t: Date.now() }; },
    saved: key => (hasTA() ? (store()[key] || []).slice() : []),
    addable: (key, focus) => { const p = TH.plan.current(key); return p.picks.filter(b => !focus || inFocus(b, focus)).map(slim); },
  };
  const inFocus = (b, focus) => focus === 'evening' ? b.end > 1020 : focus === 'afternoon' ? b.start >= 720 && b.start < 1080 : focus === 'morning' ? b.start < 720 : true;

  // =====================================================================
  // SCREEN: plan
  // =====================================================================
  function PS() {
    const S = TH.state || (TH.state = {});
    if (!S.plan) { let v = 'balanced'; try { v = TH.store.get('planVibe', 'balanced'); } catch (e) { v = 'balanced'; } S.plan = { view: 'day', key: null, wk: null, vibe: VIBES[v] ? v : 'balanced', drafts: {}, anim: '', added: null, focus: null, scrollTo: null }; }
    return S.plan;
  }
  function draftOf(key) { const ps = PS(); return ps.drafts[key] || (ps.drafts[key] = { removed: [], swaps: {}, locked: {}, seed: 0 }); }
  function ring(pct, size, label, sub) {
    const r = (size - 10) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct));
    return `<span class="pl-ring" style="--sz:${size}px" role="img" aria-label="${esc(label + ' ' + sub)}"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="trk"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="val" style="--c:${c.toFixed(1)};--o:${(c * (1 - v / 100)).toFixed(1)}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - v / 100)).toFixed(1)}"/></svg><span class="pl-ring-t"><b>${esc(label)}</b><small>${esc(sub)}</small></span></span>`;
  }
  const timeCol = m => { const t = fmt(m).split(' '); return `<span class="pl-t"><b>${esc(t[0])}</b><small>${esc(t[1] || '')}</small></span>`; };
  const GAP_LINES = ['Breathe.', 'Your call.', 'Snack o’clock?', 'Free real estate.', 'Stretch, sip, scroll.', 'All yours.'];
  function blockHTML(b, i, ps, key) {
    const k = K[b.kind] || K.other, color = b.color || k.color, delay = `style="--bc:${color};--d:${Math.min(i, 14) * 45}ms"`;
    const when = b.marker ? `Due ${fmt(b.start)}` : b.end > b.start ? `${fmt(b.start)} – ${fmt(b.end)}` : fmt(b.start);
    if (b.fixed) {
      const attrs = b.eventId ? `data-event="${esc(b.eventId)}"` : b.place && b.kind !== 'planned' ? `data-place="${esc(b.place.id)}"` : b.go && b.kind !== 'planned' ? `data-go="${esc(b.go)}"` : '';
      const tag = attrs ? 'button' : 'div';
      const rm = b.kind === 'planned' && b.planId ? `<button class="pl-mini" data-unplan="${esc(b.planId)}" aria-label="Remove ${esc(b.title)} from My Day">${icon('x')}</button>` : '';
      return `<div class="pl-b fx k-${b.kind}${b.marker ? ' marker' : ''}${b.done ? ' done' : ''}" ${delay} data-start="${b.start}">${timeCol(b.start)}<span class="pl-dot" aria-hidden="true">${icon(b.icon)}</span>
        <div class="pl-card"><${tag} class="pl-fxmain" ${attrs}><span class="pl-kind">${esc(b.kind === 'planned' ? 'On My Day · ' + b.kindLabel.replace(/^Tommy’s plan · /, '') : b.kindLabel)}${b.live ? ' · live' : ''}</span><b class="pl-title">${esc(b.title)}</b><span class="pl-sub">${esc(b.marker ? (b.sub || when) : [when, b.sub].filter(Boolean).join(' · '))}</span>${b.covers ? `<span class="pl-cover">${icon('fork')}${esc(b.covers)}</span>` : ''}</${tag}>${rm}</div></div>`;
    }
    const alts = (ps.swapsCache[b.slot] || []).length;
    const est = b.line ? `<span class="pl-meta">${icon('queue')}~${b.line} min line around then <span class="est">Est.</span></span>` : b.busy != null ? `<span class="pl-meta">${icon('users')}About ${b.busy}% full around then <span class="est">Est.</span></span>` : '';
    const place = b.place ? `<button class="pl-where" data-place="${esc(b.place.id)}">${icon('pin')}<span>${esc(b.placeLabel)}</span></button>${est}` : b.placeLabel ? `<span class="pl-where">${icon(b.kind === 'wind' ? 'moon' : b.kind === 'recharge' ? 'leaf' : 'pin')}<span>${esc(b.placeLabel)}${b.hsc && !/health science/i.test(b.placeLabel) ? ' · Health Sciences Campus' : ''}</span></span>` : '';
    const title = b.eventId ? `<button class="pl-title linky" data-event="${esc(b.eventId)}">${esc(b.title)}</button>` : `<b class="pl-title">${esc(b.title)}</b>`;
    const extra = b.kind === 'study' && b.place && /leavey|doheny|sel/.test(b.place.id) ? `<button class="pl-link" data-room="${esc(b.place.id)}|${b.start}">${icon('calendar-plus')}Book a room with Tommy</button>`
      : b.kind === 'meal' && b.place && b.place.order && !b.place.hall ? `<button class="pl-link" data-order="${esc(b.place.id)}">${icon('bag')}Order ahead</button>` : '';
    return `<article class="pl-b sug k-${b.kind}${b.locked ? ' locked' : ''}${b.tight ? ' tight' : ''}${ps.flash === b.slot ? ' flash' : ''}" ${delay} data-slot="${esc(b.slot)}" data-start="${b.start}">${timeCol(b.start)}<span class="pl-dot" aria-hidden="true">${icon(b.icon)}</span>
      <div class="pl-card">
        <div class="pl-top"><span class="pl-kind">${icon('sparkle')}${esc(b.kind === 'pick' ? (b.mine ? 'Tommy pick · your club' : 'Tommy pick') : b.kind === 'outing' ? 'Outing · ' + (b.out ? b.out.kind : 'off campus') : b.kindLabel)}</span><span class="pl-len">${esc(b.longEv ? 'drop in' : dur(b.end - b.start))}</span></div>
        ${title}
        ${b.sub && b.eventId ? `<span class="pl-sub">${esc(b.sub)}${b.food ? ' · free food' : ''}</span>` : ''}
        ${place}
        ${b.why ? `<p class="pl-why">${esc(b.why)}${b.tight ? ` · <b>Tight: ~${b.walk.min} min walk</b>` : ''}</p>` : ''}
        ${(b.warn || []).slice(0, 1).map(w => `<p class="pl-warn">${icon('alert')}<span>${esc(w)}</span></p>`).join('')}
        ${extra}
        <div class="pl-acts">
          <button class="pl-act" data-swap="${esc(b.slot)}" ${alts ? '' : 'disabled'} aria-label="Swap ${esc(b.title)}${alts ? `, ${alts} alternatives` : ', no alternatives'}">${icon('refresh')}<span>Swap</span>${alts ? `<i>${alts}</i>` : ''}</button>
          <button class="pl-act" data-lock="${esc(b.slot)}" aria-pressed="${b.locked}" aria-label="${b.locked ? 'Unlock' : 'Lock'} ${esc(b.title)}">${icon(b.locked ? 'lock' : 'unlock')}<span>${b.locked ? 'Locked' : 'Lock'}</span></button>
          <button class="pl-act rm" data-rm="${esc(b.slot)}" aria-label="Remove ${esc(b.title)} from the plan">${icon('x')}<span>Remove</span></button>
        </div>
      </div></article>`;
  }
  function legHTML(b) {
    if (!b.walk) return '';
    return `<div class="pl-leg${b.tight ? ' tight' : ''}" aria-label="${b.walk.min} minute walk from ${esc(b.walk.from)}">${icon('walk')}<span>${b.walk.min} min walk from ${esc(b.walk.from)}</span><span class="est">Est.</span></div>`;
  }
  // Health Sciences Campus ride there / back: real Intercampus Shuttle departures when one fits, else car or rideshare
  function tripHTML(b, dir) {
    const t = b.trip; if (!t) return '';
    const sh = dir === 'to' ? t.to : t.back;
    const txt = dir === 'to'
      ? `~${t.min} min to the Health Sciences Campus${sh != null ? ` · Intercampus Shuttle ${fmt(sh)} from the Jefferson turnout` : ' by car or rideshare'}`
      : `~${t.min} min back to UPC${sh != null ? ` · Intercampus Shuttle ${fmt(sh)} from Eastlake Ave` : ' by car or rideshare'}`;
    return `<div class="pl-leg trip">${icon(sh != null ? 'bus' : 'car')}<span>${esc(txt)}</span><span class="est">Est.</span></div>`;
  }
  const gapHTML = (key, at, g) => `<div class="pl-gap"><span>Free · ${dur(g)}</span><small>${GAP_LINES[(hash(key + at) % GAP_LINES.length)]}</small></div>`;
  function daysStrip(key) {
    const ctx = ctxNew();
    return `<div class="pl-days" role="group" aria-label="Pick a day to plan">${Array.from({ length: 7 }, (_, i) => { const k = keyAt(i), d = TH.parseKey(k), q = quickDay(k, ctx); return `<button data-pday="${k}" aria-pressed="${k === key}" class="tone-${q.tone}"><span>${i === 0 ? 'Today' : TH.DAYS3[d.getDay()]}</span><b>${d.getDate()}</b><i aria-hidden="true"></i><span class="sr">${esc(q.tone)}</span></button>`; }).join('')}</div>`;
  }
  const TONE_ICON = { packed: 'flame', busy: 'bolt', chill: 'leaf', free: 'sun', exam: 'pencil', late: 'moon', balanced: 'star' };
  function renderDay(ps) {
    const key = ps.key || todayKey(), dr = draftOf(key);
    const plan = day(key, Object.assign({ vibe: ps.vibe }, dr));
    ps.swapsCache = plan.swaps; ps.lastPlan = plan;
    const d = plan.date, label = plan.off === 0 ? `Today, ${dateShort(d)}` : plan.off === 1 ? 'Tomorrow' : TH.fmtDate(d);
    const nm = nowMin(), isToday = plan.isToday;
    const past = isToday ? plan.blocks.filter(b => b.fixed && (b.marker ? b.start < plan.from - 10 : b.end <= plan.from - 10)) : [];
    const upcoming = plan.blocks.filter(b => past.indexOf(b) < 0);
    let html = '', idx = 0, lastEnd = null, nowPlaced = !isToday;
    const drops = upcoming.filter(b => b.dropIn), main = upcoming.filter(b => !b.dropIn);
    let dropsPlaced = !drops.length;
    const dropHTML = () => { dropsPlaced = true; const a = Math.min(...drops.map(x => x.start)), z = Math.max(...drops.map(x => x.end)), orgs = uniq(drops.map(x => String(x.sub || '').split(' · ')[0])).slice(0, 2).join(', ');
      return `<div class="pl-b fx k-drop" style="--bc:var(--c-fitness);--d:${Math.min(idx++, 14) * 45}ms" data-start="${a}">${timeCol(a)}<span class="pl-dot" aria-hidden="true">${icon('users')}</span><details class="pl-card pl-dropc"><summary><span class="pl-fxmain"><span class="pl-kind">Drop-in · come and go</span><b class="pl-title">${drops.length === 1 ? esc(drops[0].title) : `${drops.length} drop-in sessions`}</b><span class="pl-sub">${esc([`${fmt(a)} – ${fmt(z)}`, orgs].filter(Boolean).join(' · '))}. Tommy plans around them.</span></span>${drops.length > 1 ? icon('down', 'pl-dd') : ''}</summary>${drops.length > 1 ? `<div class="pl-droplist">${drops.map(x => `<button data-event="${esc(x.eventId || '')}"><b>${esc(fmt(x.start))}</b><span>${esc(x.title)}</span></button>`).join('')}</div>` : ''}</details></div>`; };
    main.forEach(b => {
      if (!dropsPlaced && b.start >= drops[0].start) html += dropHTML();
      if (!nowPlaced && b.start >= nm) { html += `<div class="pl-now"><span>${icon('clock')}Now · ${fmt(nm)}</span></div>`; nowPlaced = true; }
      if (b.trip) { // HSC: any free time first, then the ride over
        if (lastEnd != null) { const g = b.start - b.trip.min - lastEnd; if (g >= 30) html += gapHTML(key, b.start, g); }
        html += tripHTML(b, 'to');
      } else if (lastEnd != null && !b.marker) {
        if (b.walk) html += legHTML(b);
        else { const g = b.start - lastEnd; if (g >= 30) html += gapHTML(key, b.start, g); }
      } else if (lastEnd == null && b.walk && !b.fixed) html += legHTML(b);
      html += blockHTML(b, idx++, ps, key);
      if (b.trip) html += tripHTML(b, 'back');
      if (!b.marker && b.end > b.start) lastEnd = Math.max(lastEnd == null ? 0 : lastEnd, b.end + (b.trip ? b.trip.min : 0));
    });
    if (!dropsPlaced) html += dropHTML();
    if (!nowPlaced) html += `<div class="pl-now"><span>${icon('clock')}Now · ${fmt(nm)}</span></div>`;
    const ringPct = plan.free.window ? Math.round(plan.free.min / plan.free.window * 100) : 0;
    const anim = ps.anim === 'day:' + key + ':' + ps.vibe ? ' pl-static' : '';
    ps.anim = 'day:' + key + ':' + ps.vibe;
    const added = ps.added && ps.added.key === key && undoLive(ps.added.logId) ? ps.added : null;
    const tunes = Object.keys(VIBES).map(v => `<button class="chip" data-vibe="${v}" aria-pressed="${ps.vibe === v}">${icon(VIBES[v].icon)}${esc(VIBES[v].label)}</button>`).join('');
    const statChips = [plan.stats.classes ? `${plan.stats.classes} class${plan.stats.classes === 1 ? '' : 'es'}` : '', plan.stats.exams ? `${plan.stats.exams} exam${plan.stats.exams === 1 ? '' : 's'}` : '', plan.stats.due ? `${plan.stats.due} due` : '', plan.stats.picks ? `${plan.stats.picks} Tommy pick${plan.stats.picks === 1 ? '' : 's'}` : ''].filter(Boolean);
    const n = plan.picks.length;
    const empty = !upcoming.length ? `<div class="empty">${icon('calendar')}<b>Nothing left to plan here</b><span>${plan.late ? 'It’s late. Rest up and plan tomorrow.' : 'Tommy couldn’t fit anything new. Try another day or vibe.'}</span>${plan.late ? `<button class="btn sm" data-pday="${keyAt(1)}">Plan tomorrow</button>` : ''}</div>` : '';
    return `<section class="pl-hero tone-${plan.vibe.tone}${anim}">
        <div class="pl-hero-txt"><span class="pl-kick">${icon(TONE_ICON[plan.vibe.tone] || 'star')}Tommy’s plan · ${esc(label)}</span><h2>${esc(plan.vibe.title)}</h2><p>${esc(plan.vibe.line)}</p></div>
        ${ring(ringPct, 92, dur(plan.free.min).replace(' min', 'm'), plan.isToday ? 'free left' : 'free')}
        ${statChips.length ? `<div class="pl-stats">${statChips.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      </section>
      ${daysStrip(key)}
      <div class="pl-tune"><span class="pl-tune-l">Vibe</span><div class="chips">${tunes}</div></div>
      ${added ? `<div class="pl-done" role="status"><span class="pl-done-ic">${icon('check')}</span><div><b>${esc(added.title)}</b><span>Changed your mind? Undo here, or tell Tommy “undo”.</span></div><button class="btn sm ghost" id="pl-undo">Undo</button></div>` : ''}
      ${past.length ? `<details class="pl-past"><summary>${icon('check')}Earlier today · ${past.length} item${past.length === 1 ? '' : 's'}</summary><div class="pl-past-list">${past.map(b => `<span>${esc(fmt(b.start))} · ${esc(b.title)}</span>`).join('')}</div></details>` : ''}
      <div class="pl-tl${anim}">${html}${empty}</div>
      ${plan.prefsEmpty ? `<button class="pl-nudge" id="pl-ob">${icon('sparkle')}<span><b>Make Tommy’s picks more you</b><small>Interests, career goals, food and allergies take 60 seconds.</small></span>${icon('chev')}</button>` : ''}
      <p class="simnote">${icon('info')}<span>Built from your classes, USC’s posted hours, EngageSC events and your profile. Walk times and lines are estimates. Nothing is booked until you add it, and adding is simulated on the demo account.</span></p>
      <div class="pl-cta">${n ? `<button class="btn line" id="pl-shuffle" aria-label="Shuffle unlocked picks">${icon('shuffle')}Shuffle</button><button class="btn" id="pl-add">${icon('calendar-plus')}Add ${n} to My Day</button>` : `<button class="btn ghost block" data-go="plans">${icon('calendar')}Open My Day</button>`}</div>`;
  }

  function weekGlance(W) {
    const max = Math.max(1, ...W.days.map(d => d.busy));
    return `<div class="pl-glance" role="group" aria-label="Your week at a glance">${W.days.map(d => `<button data-wjump="${d.key}" class="tone-${d.tone}" aria-label="${esc(TH.fmtDate(d.date, true))}: ${esc(d.tone)}, ${d.exams.length} exams, ${d.due.length} due, ${d.picks.length} picks">
      <span>${d.off === 0 ? 'Today' : d.label}</span><b>${d.dnum}</b><span class="pl-bar"><i style="--h:${Math.max(6, Math.round(d.busy / max * 100))}%"></i></span>
      <span class="pl-dots">${d.exams.length ? '<i class="ex"></i>' : ''}${d.due.length ? '<i class="du"></i>' : ''}${d.picks.length ? '<i class="pk"></i>' : ''}${d.outings.length ? '<i class="ou"></i>' : ''}</span></button>`).join('')}</div>
      <div class="pl-legend"><span><i class="ex"></i>Exam</span><span><i class="du"></i>Due</span><span><i class="pk"></i>Pick</span><span><i class="ou"></i>Outing</span><span><i class="bar"></i>Class load</span></div>`;
  }
  function outingCard(o) {
    const e = o.e, when = `${dayWord(e.dkey)}${offOf(e.dkey) > 1 ? ', ' + dateShort(e.date) : ''} · ${fmt(e.start)}`;
    const on = hasTA() && (TH.H().calendar || []).some(x => String(x.ref) === String(e.id));
    return `<article class="pl-out k-${o.out.kind.replace(/\W+/g, '').toLowerCase()}"><div class="pl-out-art">${icon(o.out.icon)}<span>${esc(o.out.kind)}</span></div>
      <div class="pl-out-b"><span class="pl-out-when">${esc(when)}</span><button class="pl-out-t" data-event="${esc(e.id)}">${esc(e.title)}</button><span class="pl-out-org">${esc(shortOrg(e.org))}</span>${o.out.line ? `<p>“${esc(o.out.line)}”</p>` : ''}
      <div class="pl-out-acts">${on ? `<span class="pill ok">${icon('check')}On My Day</span>` : `<button class="btn sm" data-addev="${esc(e.id)}">${icon('calendar-plus')}Add</button>`}<button class="btn sm ghost" data-event="${esc(e.id)}">Details</button></div>
      <span class="pl-src">From the EngageSC listing</span></div></article>`;
  }
  function renderWeek(ps) {
    const W = week(ps.wk || todayKey(), { vibe: ps.vibe });
    const s = TH.parseKey(W.start), e = TH.parseKey(W.end), anim = ps.anim === 'week:' + W.start ? ' pl-static' : '';
    ps.anim = 'week:' + W.start;
    const canPrev = offOf(W.start) >= 7, canNext = offOf(W.start) < 14;
    const stats = [W.days.reduce((n, d) => n + d.exams.length, 0) ? `${W.days.reduce((n, d) => n + d.exams.length, 0)} exam${W.days.reduce((n, d) => n + d.exams.length, 0) === 1 ? '' : 's'}` : '', W.deadlines.filter(x => x.kind === 'due').length ? `${W.deadlines.filter(x => x.kind === 'due').length} due` : '', W.picks.length ? `${W.picks.length} picks` : '', `${W.outings.length || 'No'} outing${W.outings.length === 1 ? '' : 's'}`].filter(Boolean);
    const outs = W.outings.length ? `<div class="carousel pl-outs">${W.outings.map(outingCard).join('')}</div>`
      : `<div class="pl-outs-empty">${icon('compass')}<div><b>No outings posted for these 7 days</b><span>Tommy checked every EngageSC event for trips, hikes, beach days and off-campus visits.${W.later.length ? ' Next one he can see:' : ' None are posted for the next month either.'}</span>${W.later.length ? `<button class="pl-later" data-event="${esc(W.later[0].e.id)}">${icon(W.later[0].out.icon)}<b>${esc(W.later[0].e.title)}</b><small>${esc(TH.fmtDate(W.later[0].e.date))} · ${esc(fmt(W.later[0].e.start))} · ${esc(W.later[0].out.kind)}</small></button>` : ''}</div></div>`;
    const laterRow = W.outings.length && W.later.length ? `<p class="muted tiny pl-next">${icon('compass')}Coming up after this week: ${W.later.slice(0, 2).map(x => `<button class="linkbtn" data-event="${esc(x.e.id)}">${esc(x.e.title)}</button> (${esc(TH.fmtDate(x.e.date))})`).join(', ')}</p>` : '';
    const food = W.food.length ? `<div class="carousel pl-food">${W.food.map(x => `<button class="pl-fd" data-event="${esc(x.e.id)}"><span class="pl-fd-k">${icon('fork')}${esc(dayWord(x.e.dkey))} · ${esc(fmt(x.e.start))}</span><b>${esc(x.e.title)}</b><small>${esc(x.why.find(w => /free|food|veg/i.test(w)) || 'Free food listed')}</small></button>`).join('')}</div>` : `<p class="muted">No free food listed on EngageSC these 7 days.</p>`;
    const dayCard = d => {
      const rows = [], push0 = rows.push.bind(rows); let tAt = 0; rows.push = h => push0([tAt, h]);
      d.exams.forEach(x => (tAt = x.start, rows.push(`<button class="pl-r ex" data-go="grades:${esc(x.course)}">${icon('pencil')}<span><b>${esc(x.course)} ${esc(x.title)}</b><small>${esc(fmt(x.start))} · ${esc(x.where)}</small></span></button>`)));
      d.due.slice(0, 3).forEach(i => (tAt = i.min, rows.push(`<button class="pl-r du" data-go="plans:week">${icon('check')}<span><b>${esc(i.course)} ${esc(i.title.split(':')[0])}</b><small>Due ${esc(TH.acad.dueLabel(i))}</small></span></button>`)));
      d.clubEv.slice(0, 2).forEach(c => (tAt = c.start, rows.push(`<button class="pl-r cl" data-event="${esc(c.eventId || '')}">${icon('users')}<span><b>${esc(c.title)}</b><small>${esc(fmt(c.start))} · your club${c.notSaved ? ' · not on My Day yet' : ''}</small></span></button>`)));
      d.saved.slice(0, 2).forEach(c => (tAt = c.start, rows.push(`<button class="pl-r sv" data-event="${esc(c.eventId || '')}">${icon('calendar')}<span><b>${esc(c.title)}</b><small>${esc(fmt(c.start))} · saved</small></span></button>`)));
      d.picks.forEach(x => (tAt = x.e.start, rows.push(`<button class="pl-r pk" data-event="${esc(x.e.id)}">${icon('star')}<span><b>${esc(x.e.title)}</b><small>${esc(fmt(x.e.start))}${x.hsc ? ' · at HSC, ~45 min away' : ''} · ${esc(x.why[0] || 'Fits your week')}</small></span></button>`)));
      d.outings.filter(o => !d.picks.some(x => x.e.id === o.e.id)).forEach(o => (tAt = o.e.start, rows.push(`<button class="pl-r ou" data-event="${esc(o.e.id)}">${icon(o.out.icon)}<span><b>${esc(o.e.title)}</b><small>${esc(fmt(o.e.start))} · ${esc(o.out.kind)}</small></span></button>`)));
      rows.sort((a, b) => a[0] - b[0]);
      const foodN = d.food.filter(x => !d.picks.some(p => p.e.id === x.e.id)).length;
      const meta = [d.classes ? `${d.classes} class${d.classes === 1 ? '' : 'es'}` : d.weekend ? 'No classes' : '', foodN ? `${foodN} free food` : '', d.drops ? `${d.drops} drop-in${d.drops === 1 ? '' : 's'}` : '', d.plannedN ? `${d.plannedN} on your plan` : ''].filter(Boolean).join(' · ');
      return `<article class="pl-dc tone-${d.tone}" id="pl-d-${d.key}"><header><span class="pl-dc-d"><b>${d.off === 0 ? 'Today' : d.off === 1 ? 'Tomorrow' : TH.DAYS[d.date.getDay()]}</b><small>${esc(dateShort(d.date))}</small></span><span class="pl-tone">${icon(TONE_ICON[d.tone] || 'star')}${esc({ packed: 'Packed', busy: 'Busy', chill: 'Chill', free: 'Free day', exam: 'Exam day' }[d.tone] || 'Chill')}</span></header>
        ${d.holiday ? `<p class="pl-dc-note">${icon('sun')}${esc(d.holiday)} · no classes</p>` : ''}
        ${rows.length ? `<div class="pl-rows">${rows.map(r => r[1]).join('')}</div>` : `<p class="muted pl-dc-empty">Wide open. Tommy can fill it.</p>`}
        <footer><span class="muted tiny">${esc(meta || `${dur(d.free)} free`)}</span><button class="btn sm" data-plan-day="${d.key}">${icon('sparkle')}Plan this day</button></footer></article>`;
    };
    return `<section class="pl-hero pl-wk tone-${W.vibe.tone}${anim}">
        <div class="pl-hero-txt"><span class="pl-kick">${icon('calendar')}Your week · ${esc(dateShort(s))} – ${esc(dateShort(e))}</span><h2>${esc(W.vibe.title)}</h2><p>${esc(W.vibe.line)}</p></div>
        <div class="pl-stats">${stats.map(x => `<span>${esc(x)}</span>`).join('')}</div>
      </section>
      <div class="cal-nav pl-wknav"><button class="iconbtn flat" data-wk="-7" ${canPrev ? '' : 'disabled'} aria-label="Previous week">${icon('back')}</button><b>${offOf(W.start) === 0 ? 'Next 7 days' : esc(dateShort(s) + ' – ' + dateShort(e))}</b><button class="iconbtn flat" data-wk="7" ${canNext ? '' : 'disabled'} aria-label="Next week">${icon('chev')}</button></div>
      ${weekGlance(W)}
      <div class="section" id="pl-outings"><div class="pl-sh"><h2>Outings &amp; field trips</h2><span>Real EngageSC events that leave campus</span></div>${outs}${laterRow}</div>
      <div class="section"><div class="pl-sh"><h2>Free food picks</h2><span>${W.food.length ? 'Listed on EngageSC, ranked for you' : 'From EngageSC listings'}</span></div>${food}</div>
      <div class="section"><div class="section-head"><h2>Day by day</h2><button data-go="plans:week">My Day week</button></div><div class="pl-dcs${anim}">${W.days.map(dayCard).join('')}</div></div>
      <p class="simnote">${icon('info')}<span>Events and outings come from EngageSC’s public calendar (labeled as off-campus only when the listing says so). Exams, homework and classes are from your account. Picks use your profile and thumbs.</span></p>`;
  }

  TH.screens.plan = {
    render() {
      const S = TH.state, ps = PS(), a = S.params && S.params.arg;
      if (a != null) {
        const arg = String(a);
        if (arg === 'week' || arg === 'outings') { ps.view = 'week'; ps.wk = todayKey(); ps.scrollTo = arg === 'outings' ? 'pl-outings' : null; }
        else if (/^week:\d{4}-\d{2}-\d{2}$/.test(arg)) { ps.view = 'week'; ps.wk = arg.slice(5); }
        else if (arg === 'tomorrow') { ps.view = 'day'; ps.key = keyAt(1); }
        else if (/^\d{4}-\d{2}-\d{2}(:\w+)?$/.test(arg)) { ps.view = 'day'; ps.key = arg.slice(0, 10); ps.focus = arg.slice(11) || null; }
        else { ps.view = 'day'; ps.key = todayKey(); ps.focus = arg === 'tonight' ? 'evening' : null; }
        S.params = {};
      }
      if (!ps.key || offOf(ps.key) < 0 || offOf(ps.key) > 20) ps.key = todayKey();
      if (ps.wk && offOf(ps.wk) < 0) ps.wk = todayKey();
      const seg = `<div class="seg pl-seg" role="group" aria-label="Plan view"><button data-pv="day" aria-pressed="${ps.view === 'day'}">${icon('sun')}Day</button><button data-pv="week" aria-pressed="${ps.view === 'week'}">${icon('calendar')}Week</button></div>`;
      let body = '';
      try { body = ps.view === 'week' ? renderWeek(ps) : renderDay(ps); }
      catch (e) { console.error(e); body = `<div class="empty">${icon('alert')}<b>Tommy couldn’t build this plan.</b><span>${esc(e.message)}</span></div>`; }
      return `<div class="screen pl-screen${reduced() ? ' pl-rm' : ''}">${TH.ui.topbar(ps.view === 'week' ? 'Plan my week' : 'Plan my day', true, `<button class="iconbtn" data-asktommy aria-label="Ask Tommy about my plan">${icon('chat')}</button>`)}
        <div class="pad screen-body stack pl-body">${seg}${body}</div></div>`;
    },
    mount(host) {
      const ps = PS(), scr = host.matches && host.matches('.screen') ? host : $('.screen', host) || host;
      const rerender = (keep) => { TH.render(keep); };
      $$('[data-pv]', host).forEach(b => b.onclick = () => { ps.view = b.dataset.pv; if (ps.view === 'week') ps.wk = ps.wk || todayKey(); rerender(false); });
      $$('[data-pday]', host).forEach(b => b.onclick = () => { ps.key = b.dataset.pday; ps.view = 'day'; ps.flash = null; rerender(false); });
      $$('[data-plan-day]', host).forEach(b => b.onclick = () => { ps.key = b.dataset.planDay; ps.view = 'day'; rerender(false); });
      $$('[data-vibe]', host).forEach(b => b.onclick = () => { ps.vibe = b.dataset.vibe; try { TH.store.set('planVibe', ps.vibe); } catch (e) { /* storage */ } TH.toast(`Vibe: ${VIBES[ps.vibe].label}. Tommy re-planned.`, 'sparkle'); rerender(true); });
      $$('[data-wk]', host).forEach(b => b.onclick = () => { const k = TH.dkey(TH.addDays(TH.parseKey(ps.wk || todayKey()), +b.dataset.wk)); ps.wk = offOf(k) < 0 ? todayKey() : k; rerender(false); });
      $$('[data-wjump]', host).forEach(b => b.onclick = () => { const el = $('#pl-d-' + b.dataset.wjump, host); if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); });
      $$('[data-asktommy]', host).forEach(b => b.onclick = () => TH.askTommy ? TH.askTommy(ps.view === 'week' ? 'plan my week' : offOf(ps.key) === 0 ? 'plan my day' : offOf(ps.key) === 1 ? 'plan tomorrow' : 'plan ' + TH.DAYS[TH.parseKey(ps.key).getDay()].toLowerCase()) : TH.go('assistant'));
      const key = ps.key || todayKey(), dr = draftOf(key);
      $$('[data-lock]', host).forEach(b => b.onclick = () => {
        const slot = b.dataset.lock, blk = ps.lastPlan && ps.lastPlan.picks.find(x => x.slot === slot); if (!blk) return;
        if (dr.locked[slot]) { delete dr.locked[slot]; TH.toast('Unlocked. Shuffle can change it now.', 'unlock'); }
        else { dr.locked[slot] = slim(blk); TH.toast('Locked in. Shuffle won’t touch it.', 'lock'); }
        rerender(true);
      });
      $$('[data-rm]', host).forEach(b => b.onclick = () => {
        const slot = b.dataset.rm, blk = ps.lastPlan && ps.lastPlan.picks.find(x => x.slot === slot);
        if (!dr.removed.includes(slot)) dr.removed.push(slot); delete dr.locked[slot]; delete dr.swaps[slot];
        const card = b.closest('.pl-b'); const done = () => rerender(true);
        TH.toast(`Removed ${blk ? blk.title : 'that block'} from the plan`, 'x');
        if (card && !reduced()) { card.classList.add('out'); setTimeout(done, 220); } else done();
      });
      $$('[data-swap]', host).forEach(b => b.onclick = () => openSwap(b.dataset.swap, key));
      $$('[data-unplan]', host).forEach(b => b.onclick = () => { TH.runAct('removePlanBlock', [key, b.dataset.unplan], 'Removed from My Day'); });
      $$('[data-room]', host).forEach(b => b.onclick = () => { const [pid, m] = b.dataset.room.split('|'), p = TH.byId[pid], d = TH.parseKey(key); TH.askTommy(`book a study room at ${p.name} on ${TH.MONTHS[d.getMonth()]} ${d.getDate()} at ${fmt(+m)}`); });
      $$('[data-order]', host).forEach(b => b.onclick = () => { if (TH.openOrder) TH.openOrder(b.dataset.order); else TH.go('food', { arg: 'order' }); });
      $$('[data-addev]', host).forEach(b => b.onclick = () => { const e = TH.eventById(b.dataset.addev); if (!e) return; TH.confirmAct('saveEvent', [e.id], { title: 'Add this outing to My Day?', rows: [['Event', e.title], ['When', TH.when(e)], ['Host', e.org || '—']], ok: 'Add to My Day', url: e.url, urlLabel: 'RSVP on EngageSC', toast: 'Added to My Day' }); });
      const ob = $('#pl-ob', host); if (ob) ob.onclick = () => { if (TH.openOnboarding) TH.openOnboarding(); else TH.go('profile'); };
      const sh = $('#pl-shuffle', host); if (sh) sh.onclick = () => { dr.seed = (dr.seed || 0) + 1; dr.swaps = {}; ps.flash = null; TH.toast(Object.keys(dr.locked).length ? 'Shuffled. Locked picks stayed put.' : 'Shuffled! Fresh picks.', 'shuffle'); rerender(true); };
      const ad = $('#pl-add', host); if (ad) ad.onclick = () => openAdd(key);
      // Undo only while that add is still undoable (nothing logged since, its blocks and RSVPs untouched); it takes back
      // just what the add put on My Day, never anything changed since
      const un = $('#pl-undo', host); if (un) un.onclick = () => {
        const live = ps.added && undoLive(ps.added.logId);
        let ok = false;
        if (live) { try { TA.Brain.undo(); ok = !TA.Brain.lastUndo; } catch (e) { console.error(e); ok = false; } }
        ps.added = null;
        TH.toast(ok ? 'Undone. Tommy’s plan is off My Day; everything else stays.' : 'That add can’t be undone anymore. Remove blocks on My Day instead.', ok ? 'refresh' : 'alert');
        rerender(true);
      };
      if (ps.flash) setTimeout(() => { ps.flash = null; }, 900);
      // first open on a focus / anchor: bring it into view
      if (ps.scrollTo) { const el = $('#' + ps.scrollTo, host); ps.scrollTo = null; if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 30); }
      else if (ps.focus === 'evening' && ps.view === 'day') { ps.focus = null; const el = $$('.pl-b', host).find(x => +x.dataset.start >= 1020); if (el && scr) setTimeout(() => { scr.scrollTop = Math.max(0, el.getBoundingClientRect().top - scr.getBoundingClientRect().top + scr.scrollTop - 150); }, 30); }
    },
  };

  // "Plan my day" entry points without an argument (Home card, plus menu) always open today's day view
  const go0 = TH.go;
  TH.go = function (name, params) {
    if (name === 'plan' && !(params && params.arg) && TH.state && TH.state.route !== 'plan') { const ps = PS(); ps.view = 'day'; ps.key = todayKey(); }
    return go0.apply(this, arguments);
  };

  // ---------- swap sheet ----------
  function openSwap(slot, key) {
    const ps = PS(), plan = ps.lastPlan, blk = plan && plan.picks.find(b => b.slot === slot), alts = (plan && plan.swaps[slot]) || [];
    if (!blk || !alts.length) return;
    const cur = `<div class="pl-sw cur"><span class="pl-sw-ic" style="--bc:${blk.color}">${icon(blk.icon)}</span><span><small>Now</small><b>${esc(blk.title)}</b><em>${esc(fmt(blk.start))} · ${esc(blk.placeLabel || '')}</em></span></div>`;
    TH.sheet(`<div class="stack pl-sheet"><div class="sheet-head"><h2>Swap ${esc((blk.mealLabel || K[blk.kind].label).toLowerCase())}</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${cur}<p class="muted tiny">Tommy’s other picks for this spot, best first.</p>
      <div class="pl-swl">${alts.map((a, i) => `<button class="pl-sw" data-pick="${i}"><span class="pl-sw-ic" style="--bc:${(K[a.kind] || K.pick).color}">${icon((K[a.kind] || K.pick).icon)}</span><span><b>${esc(a.title)}</b><em>${esc(a.start !== blk.start ? fmt(a.start) + ' · ' : '')}${esc(a.placeLabel || a.sub || '')}${a.line ? ` · ~${a.line} min line (est.)` : ''}${a.food && a.eventId ? ' · free food' : ''}</em><small>${esc(a.why || '')}</small></span>${icon('chev', 'chev')}</button>`).join('')}</div>
      <p class="simnote">${icon('info')}<span>Only places open for the whole block and events that fit your free time are shown.</span></p></div>`, w => {
      $$('[data-pick]', w).forEach(b => b.onclick = () => {
        const a = alts[+b.dataset.pick], dr = draftOf(key);
        dr.swaps[slot] = a.ref; if (dr.locked[slot]) delete dr.locked[slot];
        ps.flash = slot; TH.closeSheet(); TH.toast(`Swapped in ${a.title}`, 'refresh'); TH.render(true);
      });
    });
  }
  // ---------- add-to-My-Day confirm sheet ----------
  function openAdd(key) {
    const ps = PS(), plan = ps.lastPlan; if (!plan || !plan.picks.length) return;
    const picks = plan.picks.slice();
    const rowsHTML = picks.map((b, i) => `<label class="pl-ad"><input type="checkbox" data-i="${i}" checked><span class="pl-sw-ic" style="--bc:${b.color}">${icon(b.icon)}</span><span><b>${esc(b.title)}</b><em>${esc(fmt(b.start))}${b.end > b.start ? ' – ' + esc(fmt(b.end)) : ''}${b.eventId ? ' · RSVP (simulated)' : ' · plan block'}</em></span></label>`).join('');
    const d = plan.date;
    TH.sheet(`<div class="stack pl-sheet"><div class="sheet-head"><h2>Add to My Day?</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <p class="muted" style="font-size:13.5px">${esc(TH.fmtDate(d, true))}. Untick anything you don’t want.</p>
      <div class="pl-adl">${rowsHTML}</div>
      <div class="pl-adwarn"></div>
      <div class="err" hidden></div>
      <div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="pl-ok">${icon('calendar-plus')}<span>Add ${picks.length}</span></button></div>
      <p class="simnote">${icon('info')}<span>Events are RSVP’d on the demo account only (RSVP for real on EngageSC). Meals, study and the rest show on My Day as Tommy’s plan. Undo anytime.</span></p></div>`, w => {
      const chosen = () => $$('[data-i]', w).filter(c => c.checked).map(c => slim(picks[+c.dataset.i]));
      const upd = () => {
        const list = chosen(), ck = TH.act.check.addPlan(key, list), ok = $('#pl-ok', w);
        $('span', ok).textContent = `Add ${list.length}`; ok.disabled = !list.length || ck.block.length > 0;
        $('.pl-adwarn', w).innerHTML = [...ck.block.map(x => `<div class="banner">${icon('alert')}<div><span>${esc(x)}</span></div></div>`), ...ck.warn.slice(0, 3).map(x => `<div class="banner info">${icon('info')}<div><span>${esc(x)}</span></div></div>`)].join('');
      };
      $$('[data-i]', w).forEach(c => c.onchange = upd); upd();
      $('#pl-ok', w).onclick = () => {
        try {
          const list = chosen(), { res, logId } = commitUndoable(() => TH.act.addPlan(key, list));
          ps.added = { key, logId, title: res.title, at: Date.now() };
          TH.closeSheet(); TH.toast(res.title + '. Say “undo” to Tommy to take it back.', 'calendar-plus'); TH.render(true);
          const scr = $('.pl-screen'); if (scr) scr.scrollTop = 0;
        } catch (e) { const er = $('.err', w); er.hidden = false; er.textContent = e.message; }
      };
    });
  }

  // ---------- re-render the plan screen when the account changes (Tommy actions, Undo, ticks) ----------
  const onChange0 = TH.onTAStateChange;
  if (typeof onChange0 === 'function') {
    let q = false;
    TH.onTAStateChange = function () {
      onChange0.apply(this, arguments);
      if (q || !(TH.state && TH.state.route === 'plan')) return; q = true;
      setTimeout(() => { q = false; if (TH.state.route !== 'plan' || document.querySelector('.sheet-wrap')) return; const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; try { TH.render(true); } catch (e) { console.error(e); } }, 0);
    };
  }

  // ---------- My Day: one slim "Plan with Tommy" row ----------
  const plans = TH.screens.plans;
  if (plans && plans.render) {
    const pr0 = plans.render;
    plans.render = function () {
      const h = pr0.apply(this, arguments);
      try {
        const S = TH.state, v = S.plansView || 'day', off = Math.max(0, S.plansDay || 0), wk = v === 'week';
        if (v === 'month' || (S.plansDay || 0) < 0) return h;
        const lab = wk ? 'Plan my week with Tommy' : off === 0 ? 'Plan today with Tommy' : off === 1 ? 'Plan tomorrow with Tommy' : `Plan ${TH.DAYS[TH.addDays(today(), off).getDay()]} with Tommy`;
        const row = `<button class="pl-entry" data-go="plan:${wk ? 'week' : keyAt(off)}"><span class="pl-entry-av" aria-hidden="true">T</span><span><b>${esc(lab)}</b><small>${wk ? 'Best events, outings, free food, deadlines' : 'Meals, study time and picks in your free time'}</small></span>${icon('chev')}</button>`;
        return h.replace(/(<div class="seg" role="group" aria-label="Calendar view">[\s\S]*?<\/div>)/, m => m + row);
      } catch (e) { return h; }
    };
  }

  // =====================================================================
  // TOMMY: chat answers + cards (commands in js/ta/script.js; "add these" action in js/ta/act-anything.js)
  // =====================================================================
  const go = (label, screen, arg) => ({ label, value: '@go:' + screen + (arg != null ? ':' + arg : ''), kind: '' });
  const say = (label, value) => ({ label, value: value || label.toLowerCase(), kind: '' });
  const actc = (label, value) => ({ label, value, kind: 'action' });
  function resolveDay(day) {
    const t = String(day || '').toLowerCase().trim();
    if (!t || t === 'today' || t === 'tonight') return todayKey();
    if (t === 'tomorrow') return keyAt(1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return offOf(t) < 0 ? todayKey() : t;
    const wd = TH.DAYS.findIndex(d => d.toLowerCase() === t || d.toLowerCase().slice(0, 3) === t.slice(0, 3));
    if (wd >= 0) { const o = (wd - today().getDay() + 7) % 7; return keyAt(o); }
    return todayKey();
  }
  TH.plan.resolveDay = resolveDay;
  function cardItems(plan, focus, max) {
    let list = plan.blocks.filter(b => !b.dropIn && !(plan.isToday && b.fixed && (b.marker ? b.start < plan.from - 10 : b.end <= plan.from - 10)));
    if (focus) list = list.filter(b => inFocus(b, focus) || (b.kind === 'wind'));
    const sug = list.filter(b => !b.fixed), out = [];
    // keep every suggestion that fits, then the fixed items between them
    list.forEach(b => { if (!b.fixed || out.filter(x => x.fixed).length < Math.max(2, max - sug.length)) out.push(b); });
    return out.slice(0, max).map(b => ({ t: b.marker ? 'Due ' + fmt(b.start) : fmt(b.start), ic: b.icon, title: b.title, sub: b.fixed ? [b.covers || b.kindLabel || '', b.trip ? `HSC, ~${b.trip.min} min each way` : ''].filter(Boolean).join(' · ') : [b.placeLabel, b.trip ? `HSC, ~${b.trip.min} min each way (est.)` : b.walk ? `${b.walk.min} min walk` : ''].filter(Boolean).join(' · '), sug: !b.fixed, kind: b.kind, ev: b.eventId || null }));
  }
  function chatDay(args) {
    args = args || {};
    if (!hasTA()) return [{ role: 'bot', md: 'Your account is still loading. Try again in a moment.' }];
    const focus = args.focus === 'evening' || args.focus === 'afternoon' || args.focus === 'morning' ? args.focus : null;
    let key = resolveDay(args.day);
    let plan = TH.plan.current(key);
    if (plan.late && offOf(key) === 0 && !focus) {
      const k2 = keyAt(1), p2 = TH.plan.current(k2), done2 = !p2.picks.length && p2.fixed.some(b => b.kind === 'planned');
      TH.plan.remember(k2, null);
      return [{ role: 'bot', kind: 'c', md: `It’s ${fmt(nowMin())}, so today’s a wrap. Best plan: sleep. ${done2 ? 'Tomorrow’s plan is already on My Day, so here it is:' : 'Here’s **tomorrow** instead:'}`, card: cardOf(p2, null), chips: [go('Open full plan', 'plan', k2), ...(p2.picks.length ? [actc('Add these to My Day', 'add my plan to my day @plan:' + k2)] : []), say('Plan my week', 'plan my week')] }];
    }
    TH.plan.remember(key, focus);
    const sug = plan.picks.filter(b => !focus || inFocus(b, focus));
    const who = firstName(), dw = dayWord(key), dl = dw === 'Today' || dw === 'Tomorrow' ? dw.toLowerCase() : dw;
    const evPick = sug.find(b => b.kind === 'pick' || b.kind === 'outing');
    // the free time the card shows (the evening card counts the evening only), so the words and the card agree
    const free = focus === 'evening' ? eveningFree(plan) : plan.free.min;
    // Tommy's plan blocks already on My Day for this day (what "Add these to My Day" saved)
    const onDay = plan.fixed.some(b => b.kind === 'planned' && (focus !== 'evening' || b.end > 1020));
    const whose = dl === 'today' ? 'Your plan’s' : dl === 'tomorrow' ? 'Tomorrow’s plan is' : `${dl}’s plan is`;
    let md, roomy = false;
    const sent = t => (/[.!?]$/.test(t) ? t : t + '.'); // titles like "Packed day. Tommy’s got you." already end a sentence
    const lateish = plan.isToday && nowMin() >= 1260; // after 9 PM: no "go find an event" nudges
    if (focus === 'evening') {
      if (sug.length) md = `**Tonight’s lineup, ${who}.** ${evPick ? `Best bet: **${evPick.title}** at ${fmt(evPick.start)}.` : 'Nothing on EngageSC fits tonight, so here’s a calm one.'} ${sug.some(b => b.kind === 'meal') ? 'Dinner’s sorted too.' : ''}`;
      else if (onDay) md = `**Your evening plan’s already on My Day, ${who}.** Here it is. Nothing new to add${free >= 45 ? `, and you still have ${dur(free)} free tonight` : ''}.`;
      else if (free >= 45 && !lateish) { roomy = true; md = `**Tonight’s wide open, ${who}.** You have ${dur(free)} free and nothing new fits it well, so it’s yours. Want event ideas?`; }
      else md = lateish ? `It’s getting late, ${who}, so I kept tonight light. Here’s what’s on it.` : `Your evening is already full, ${who}. Here’s what’s on it.`;
    } else if (sug.length) md = `**Here’s ${dl === 'today' ? 'your day' : dl === 'tomorrow' ? 'tomorrow' : dl}, ${who}.** ${sent(plan.vibe.title)} I fit in ${listWords(sug)}.`;
    else if (onDay) md = `**${whose} already on My Day, ${who}.** Here it is. Nothing new to add${free >= 45 ? `, and you still have ${dur(free)} free` : ''}.`;
    else if (free >= 45 && !lateish) { roomy = true; md = `**Here’s ${dl === 'today' ? 'your day' : dl === 'tomorrow' ? 'tomorrow' : dl}, ${who}.** ${sent(plan.vibe.title)} You have ${dur(free)} free and nothing new fits it well, so it’s yours. Want event ideas?`; }
    else md = `**Here’s ${dl === 'today' ? 'your day' : dl === 'tomorrow' ? 'tomorrow' : dl}, ${who}.** ${sent(plan.vibe.title)} ${lateish ? 'There’s not much day left, so I kept it light.' : 'Your schedule is full, so I didn’t add anything.'}`;
    md += sug.length || !onDay ? '\n\n_Suggestions only: nothing is booked until you add it. Walk times and lines are estimates._' : '\n\n_Your plan blocks are on My Day (simulated on the demo account). Walk times and lines are estimates._';
    const chips = [go('Open full plan', 'plan', key + (focus ? ':' + focus : ''))];
    if (sug.length) chips.push(actc(`Add ${sug.length === 1 ? 'it' : 'these'} to My Day`, 'add my plan to my day @plan:' + key + (focus ? ':' + focus : '')));
    if (roomy) chips.push(say('Events for me', 'recommend events for me'));
    chips.push(offOf(key) === 0 ? say('Plan tomorrow', 'plan tomorrow') : say('Plan my week', 'plan my week'));
    if (!plan.onboarded && plan.prefsEmpty) chips.push(say('Make picks more me', 'edit my profile'));
    return [{ role: 'bot', kind: 'c', md, card: cardOf(plan, focus), chips }];
  }
  // free minutes from 5 PM (or now, if later) to 11 PM, outside fixed commitments (same rules as the day's ring)
  function eveningFree(plan) {
    const A = plan.isToday ? Math.max(1020, nowMin()) : 1020, END = 1380; if (A >= END) return 0;
    return Math.max(0, END - A - mergedBusy(plan.fixed.filter(b => !b.dropIn && b.kind !== 'planned' && b.kind !== 'line' && b.kind !== 'ride'), A, END));
  }
  function listWords(sug) {
    const w = []; const by = k => sug.filter(b => b.kind === k);
    by('meal').forEach(b => w.push(b.mealLabel ? b.mealLabel.toLowerCase() + ' at ' + shortName(b.place) : b.title));
    if (by('study').length) w.push(by('study').length === 1 ? 'a study block for ' + (by('study')[0].course || 'your deadline') : by('study').length + ' study blocks');
    [...by('pick'), ...by('outing')].forEach(b => w.push('**' + b.title + '**'));
    if (by('move').length) w.push('a workout');
    if (by('recharge').length) w.push('a recharge break');
    if (by('wind').length) w.push('a wind-down');
    return w.length <= 1 ? w.join('') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
  }
  function cardOf(plan, focus) {
    const items = cardItems(plan, focus, 7), total = plan.blocks.filter(b => !b.marker).length;
    const eve = focus === 'evening', fr = eve ? eveningFree(plan) : plan.free.min, win = eve ? Math.max(0, 1380 - (plan.isToday ? Math.max(1020, nowMin()) : 1020)) : plan.free.window;
    const ringPct = win ? Math.round(fr / win * 100) : 0;
    return { type: 'plan', id: 'pl' + Date.now().toString(36), key: plan.key, day: `${dayWord(plan.key)} · ${dateShort(plan.date)}`, tone: plan.vibe.tone, title: eve ? 'Tonight' : plan.vibe.title, free: dur(fr).replace(' min', 'm'), pct: ringPct, picks: plan.picks.filter(b => !focus || inFocus(b, focus)).length, items, more: Math.max(0, total - items.length) };
  }
  function chatWeek(args) {
    if (!hasTA()) return [{ role: 'bot', md: 'Your account is still loading. Try again in a moment.' }];
    args = args || {};
    let start = todayKey();
    if (args.start === 'next') { const o = (8 - today().getDay()) % 7 || 7; start = keyAt(o); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(args.start || ''))) start = offOf(args.start) < 0 ? todayKey() : args.start;
    const W = week(start), weekend = args.start === 'weekend' || args.span === 'weekend';
    let days = W.days;
    if (weekend) { days = W.days.filter(d => d.weekend).slice(0, 2); }
    const outs = weekend ? W.outings.filter(o => days.some(d => d.key === o.e.dkey)) : W.outings;
    W.outings = outs;
    const card = { type: 'planweek', id: 'pw' + Date.now().toString(36), title: weekend ? 'Your weekend' : W.vibe.title, range: weekend ? days.map(d => `${d.label} ${dateShort(d.date)}`).join(' – ') : `${dateShort(TH.parseKey(W.start))} – ${dateShort(TH.parseKey(W.end))}`, tone: W.vibe.tone, days: days.map(d => ({ key: d.key, label: d.off === 0 ? 'Today' : d.label, dnum: d.dnum, tone: d.tone, line: [d.classes ? `${d.classes} class${d.classes === 1 ? '' : 'es'}` : '', d.exams.length ? `${d.exams[0].course} ${d.exams[0].title.toLowerCase()}` : '', d.due.length ? `${d.due.length} due` : ''].filter(Boolean).join(' · ') || (d.holiday ? d.holiday + ' · no classes' : d.weekend ? 'No classes' : 'Light day'), pick: d.picks[0] ? `${d.picks[0].e.title} · ${fmt(d.picks[0].e.start)}${d.picks[0].hsc ? ' · at HSC' : ''}` : d.clubEv[0] ? `${d.clubEv[0].title} · ${fmt(d.clubEv[0].start)}` : '', food: d.food.length, out: d.outings.length })), outings: W.outings.slice(0, 3).map(o => ({ id: o.e.id, title: o.e.title, when: `${dayWord(o.e.dkey)} ${fmt(o.e.start)}`, kind: o.out.kind, ic: o.out.icon })), later: W.outings.length ? null : (W.later[0] ? { title: W.later[0].e.title, when: TH.fmtDate(W.later[0].e.date) } : null) };
    const ex = W.deadlines.filter(x => x.kind === 'exam');
    const sum = k => days.reduce((n, d) => n + d[k].length, 0), pN = sum('picks'), fN = sum('food'), dN = sum('due');
    let md = weekend
      ? `**Your weekend, ${firstName()}.** ${[pN ? `${pN} pick${pN === 1 ? '' : 's'} for you` : 'Not much is posted yet', fN ? `${fN} with free food` : '', dN ? `${dN} thing${dN === 1 ? '' : 's'} due` : ''].filter(Boolean).join(', ')}.`
      : `**Your week, ${firstName()}.** ${W.vibe.line}`;
    if (ex.length && !weekend) md += ` Heads-up: ${ex.map(x => `**${x.title}** ${x.day.off === 0 ? 'today' : x.day.off === 1 ? 'tomorrow' : TH.DAYS[x.day.date.getDay()]}`).join(', ')}.`;
    md += W.outings.length ? ` I found ${W.outings.length} real outing${W.outings.length === 1 ? '' : 's'} off campus.` : ' No outings or field trips are posted on EngageSC for these days.';
    const chips = [go(weekend ? 'Open the week plan' : 'Open full week plan', 'plan', 'week')];
    const sat = days.find(d => d.date.getDay() === 6);
    if (sat) chips.push(say(`Plan ${weekend ? 'Saturday' : 'my Saturday'}`, 'plan my saturday'));
    chips.push(say('Find an outing', 'find a field trip this week'), say('Plan tomorrow', 'plan tomorrow'));
    return [{ role: 'bot', kind: 'c', md, card, chips }];
  }
  function chatOutings(args) {
    if (!hasTA()) return [{ role: 'bot', md: 'Your account is still loading. Try again in a moment.' }];
    args = args || {};
    const startOff = args.range === 'next' ? ((8 - today().getDay()) % 7 || 7) : 0, span = args.range === 'month' ? 30 : 7;
    const list = outings(keyAt(startOff), span).sort((a, b) => a.e.s - b.e.s);
    const label = args.range === 'month' ? 'in the next month' : args.range === 'next' ? 'next week' : 'in the next 7 days';
    if (!list.length) {
      const more = outings(keyAt(startOff + span), 30).sort((a, b) => a.e.s - b.e.s)[0];
      const md = `I checked every EngageSC event ${label} for trips, hikes, beach days and off-campus visits, and **none are posted**.${more ? ` The next one I can see is **${more.e.title}** (${TH.fmtDate(more.e.date)}, ${fmt(more.e.start)}, ${more.out.kind.toLowerCase()}).` : ''} Club trips sometimes go out only to members, so ask your clubs too.`;
      return [{ role: 'bot', kind: 'c', md, chips: [...(more ? [go('See ' + (more.e.title.length > 26 ? more.e.title.slice(0, 24) + '…' : more.e.title), 'event', more.e.id)] : []), go('Week plan', 'plan', 'week'), say('Plan my week', 'plan my week')] }];
    }
    TH.plan.remember(list[0].e.dkey, null);
    const card = { type: 'outings', id: 'po' + Date.now().toString(36), label, items: list.slice(0, 5).map(o => ({ id: o.e.id, title: o.e.title, when: `${dayWord(o.e.dkey)}${offOf(o.e.dkey) > 1 ? ', ' + dateShort(o.e.date) : ''} · ${fmt(o.e.start)}`, kind: o.out.kind, ic: o.out.icon, line: o.out.line, org: shortOrg(o.e.org), on: (TH.H().calendar || []).some(x => String(x.ref) === String(o.e.id)) })) };
    const md = `**${list.length} real outing${list.length === 1 ? '' : 's'} ${label}** from EngageSC. Each one says in its listing that it leaves campus.`;
    const chips = list.slice(0, 2).filter(o => !(TH.H().calendar || []).some(x => String(x.ref) === String(o.e.id))).map(o => actc('Add ' + (o.e.title.length > 22 ? o.e.title.slice(0, 20) + '…' : o.e.title), 'rsvp @ev:' + o.e.id));
    chips.push(go('Open week plan', 'plan', 'outings'));
    return [{ role: 'bot', kind: 'c', md, card, chips }];
  }
  TH.plan.chatDay = chatDay; TH.plan.chatWeek = chatWeek; TH.plan.chatOutings = chatOutings;

  // chat card renderers (TA.UI.cards.*): data in, HTML out (cards persist with the conversation)
  if (window.TA && TA.UI && TA.UI.cards) {
    const C = TA.UI.cards;
    C.plan = c => {
      const items = (c.items || []).map(i => `<li class="${i.sug ? 'sug' : 'fx'} k-${esc(i.kind)}"><span class="t">${esc(i.t)}</span><span class="ic">${icon(i.ic || 'calendar')}</span><span class="m"><b>${esc(i.title)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span>${i.sug ? `<span class="tag">${icon('sparkle')}</span>` : ''}</li>`).join('');
      return `<div class="ta-card pl-chat tone-${esc(c.tone)}"><div class="pl-chat-hero"><div><span class="k">Tommy’s plan · ${esc(c.day)}</span><b>${esc(c.title)}</b><small>${esc(c.free)} free · ${c.picks} pick${c.picks === 1 ? '' : 's'}</small></div>${ring(c.pct || 0, 58, c.free, 'free')}</div>
        <ol class="pl-chat-list">${items || '<li class="fx"><span class="m"><b>Nothing left to plan</b></span></li>'}</ol>${c.more ? `<button type="button" class="pl-chat-more" data-send="@go:plan:${esc(c.key)}">+${c.more} more in the full plan ${icon('chev')}</button>` : ''}</div>`;
    };
    C.planweek = c => `<div class="ta-card pl-chat pl-chatwk tone-${esc(c.tone)}"><div class="pl-chat-hero"><div><span class="k">Week plan · ${esc(c.range)}</span><b>${esc(c.title)}</b></div></div>
      <ol class="pl-chat-week">${(c.days || []).map(d => `<li class="tone-${esc(d.tone)}"><button type="button" data-send="@go:plan:${esc(d.key)}"><span class="d"><b>${esc(d.label)}</b><small>${d.dnum}</small></span><span class="m"><b>${esc(d.line)}</b>${d.pick ? `<small>${icon('star')}${esc(d.pick)}</small>` : ''}</span><span class="f">${d.food ? `<i title="free food">${icon('fork')}</i>` : ''}${d.out ? `<i title="outing">${icon('compass')}</i>` : ''}</span></button></li>`).join('')}</ol>
      ${(c.outings || []).length ? `<div class="pl-chat-outs"><span class="k">${icon('compass')}Outings</span>${c.outings.map(o => `<button type="button" data-send="@go:event:${esc(o.id)}">${icon(o.ic)}<b>${esc(o.title)}</b><small>${esc(o.when)} · ${esc(o.kind)}</small></button>`).join('')}</div>` : `<p class="pl-chat-none">${icon('compass')}No off-campus outings posted these days${c.later ? `. Next: ${esc(c.later.title)} (${esc(c.later.when)})` : ''}.</p>`}</div>`;
    C.outings = c => `<div class="ta-card pl-chat outs"><div class="pl-chat-hero"><div><span class="k">Outings &amp; field trips · ${esc(c.label)}</span><b>Get off campus</b></div></div>
      <ol class="pl-chat-olist">${(c.items || []).map(o => `<li><button type="button" data-send="@go:event:${esc(o.id)}"><span class="ic">${icon(o.ic)}</span><span class="m"><span class="k2">${esc(o.kind)} · ${esc(o.when)}</span><b>${esc(o.title)}</b>${o.line ? `<small>“${esc(o.line)}”</small>` : `<small>${esc(o.org)}</small>`}</span>${o.on ? `<span class="on">${icon('check')}</span>` : ''}</button></li>`).join('')}</ol><p class="pl-chat-src">Real EngageSC listings. Off-campus only when the listing says so.</p></div>`;
  }
})(window.TH = window.TH || {});
