/* js/ta/hub-tools.js */
/* js/ta/hub-tools.js — TH.assistantTools: small, plain-data readers of Trojan Hub's real data for Claude
 * (ai-sample.js passes them as `sample` tools). Read-only: data globals + TH.H() + TA.State. No DOM.
 * Every result stays well under the 32 KB tool-result cap. Estimates are labeled as estimates. */
(function () {
  'use strict';
  var TH = window.TH || (window.TH = {});
  var LA = 'America/Los_Angeles';
  var KEY = new Intl.DateTimeFormat('en-CA', { timeZone: LA, year: 'numeric', month: '2-digit', day: '2-digit' });
  var TIME = new Intl.DateTimeFormat('en-US', { timeZone: LA, hour: 'numeric', minute: '2-digit' });

  function now() { return (window.TA && TA.now) ? TA.now() : (TH.clock ? TH.clock.now() : new Date()); }
  function nowMin() { var d = now(); return d.getHours() * 60 + d.getMinutes(); }
  function pad(x) { return String(x).padStart(2, '0'); }
  function fmtMin(m) { if (TH.fmtMin) return TH.fmtMin(m); m = ((Math.round(m) % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return mm ? h + ':' + pad(mm) + ' ' + ap : h + ' ' + ap; }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function norm(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function hub() { if (TH.H) { try { return TH.H(); } catch (e) { } } return (window.TA && TA.State && TA.State.d && TA.State.d.hub) || {}; }
  function walkMin(p) { if (TH.ui && TH.ui.walkMin) { try { return TH.ui.walkMin(p); } catch (e) { } } var me = TH.ME || { x: 0, y: 0 }; return Math.max(1, Math.round(Math.hypot(p.x - me.x, p.y - me.y) * 1.3 / 80)); }
  function status(p) { if (TH.status) { try { var s = TH.status(p, now()); return { open: s.open, text: [s.label, s.detail].filter(Boolean).join(' · ') }; } catch (e) { } } return { open: null, text: p.hours === null ? 'Hours not published' : '' }; }
  function live(p) { if (!TH.live) return null; try { var lv = TH.live(p); if (!lv) return null; return (lv.kind === 'wait' ? lv.value + ' min wait' : lv.kind === 'busy' ? lv.value + '% full' : lv.value + ' ' + (lv.unit || '') + ' ' + (lv.label || '')).trim() + ' (estimate; USC publishes no live data)'; } catch (e) { return null; } }
  function lyftOpen() { if (window.TA && TA.lyftOpen) return TA.lyftOpen(); return null; }
  function dayOffset(x) { var n = Math.round(Number(x) || 0); return Math.max(0, Math.min(30, n)); }
  // device wall-clock fields ARE campus time (TH.clock convention): never run a wall-clock Date through the LA formatter
  function dayKey(off) { var d = now(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off, 12); return dkey(d); }
  function dayLabel(off) { var d = now(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off); return TH.fmtDate ? TH.fmtDate(d) : WD[d.getDay()] + ', ' + MO[d.getMonth()] + ' ' + d.getDate(); }
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function wall(iso) { return TH.laDate ? TH.laDate(iso) : new Date(iso); }

  var T = TH.assistantTools = {
    // campus places near the student
    find_places: function (i) {
      i = i || {}; var q = norm(i.query), cat = i.category && TH.CATS && TH.CATS[i.category] ? i.category : null, words = q ? q.split(' ').filter(function (w) { return w.length > 2; }) : [];
      var list = (TH.PLACES || []).map(function (p) {
        if (cat && p.cat !== cat) return null;
        var sc = 1;
        if (words.length) { var hay = norm([p.name, p.bldg, (p.tags || []).join(' '), (p.features || []).join(' '), p.desc, TH.CATS && TH.CATS[p.cat] && TH.CATS[p.cat].label].join(' ')); sc = words.filter(function (w) { return hay.indexOf(w) >= 0; }).length / words.length; if (norm(p.name).indexOf(q) >= 0) sc += 1; if (sc < 0.5) return null; }
        var st = status(p); if (i.open_now && st.open === false) return null;
        return { p: p, sc: sc, st: st };
      }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc || walkMin(a.p) - walkMin(b.p); }).slice(0, 8);
      if (!list.length) return { places: [], note: 'No matching places in Trojan Hub’s map data.' };
      return { places: list.map(function (x) { var p = x.p; return { id: p.id, name: p.name, category: p.cat, status: x.st.text || null, hours_published: p.hours !== null, walk_min: walkMin(p), live: live(p), address: p.address || null, features: (p.features || []).slice(0, 4), access: p.access || null, url: p.url || null, note: p.inferred ? 'Restrooms inside this building; exact location not mapped by USC.' : undefined }; }), you_are_at: TH.ME ? TH.ME.label : null };
    },

    // Lyft, USC buses, Metro, U-Pass, Zipcar, parking
    get_transport: function () {
      var Tr = TH.TRANSPORT || {}, L = Tr.lyft || {}, h = hub(), d = now(), m = nowMin(), out = {};
      out.lyft = { hours: L.hoursText, running_now: lyftOpen(), boundary: L.boundary && L.boundary.text, cost: L.cost, limit: L.limitText, after_hours: L.afterHours, my_ride: h.ride && h.ride.state !== 'done' ? { to: h.ride.to, state: h.ride.state } : null, url: L.url };
      out.usc_buses = (Tr.buses || []).map(function (b) {
        var nx = [];
        // USC publishes some afternoon trips only as estimated windows: "~3:06–3:12 PM (est.)"
        try { nx = TH.busUpcoming ? TH.busUpcoming(b.id, 0, d, m).slice(0, 3).map(TH.busDepText) : TH.busTimes ? TH.busTimes(b.id, 0, d).filter(function (x) { return x >= m; }).slice(0, 3).map(fmtMin) : []; } catch (e) { nx = []; }
        return { route: b.name, first_stop: b.stops && b.stops[0] && b.stops[0].name, next_departures_today: nx, note: b.note || undefined };
      }).slice(0, 10);
      out.metro = Tr.metro ? { stations: (Tr.metro.stations || []).map(function (s) { return s.name; }), note: Tr.metro.note, url: Tr.metro.url } : null;
      out.upass = { my_status: h.upass ? h.upass.status : 'not signed up', cost: Tr.upass && Tr.upass.cost, eligibility: Tr.upass && Tr.upass.eligibility, url: Tr.upass && Tr.upass.url };
      out.zipcar = Tr.zipcar ? { text: Tr.zipcar.text, url: Tr.zipcar.url, my_reservations: (h.zips || []).length } : null;
      var P = Tr.parking || {};
      out.parking = { structures: (P.structures || []).map(function (id) { var p = TH.byId && TH.byId[id]; return p ? p.name : id; }), daily_rate: P.rates && P.rates.daily, cheapest: P.rates && P.rates.cheapest, free: P.rates && P.rates.free_parking, my_saved_spot: h.parking ? { at: (TH.byId && TH.byId[h.parking.at] || {}).name || h.parking.at, level: h.parking.level || null } : null, url: P.url };
      return out;
    },

    // real public EngageSC events on a day
    get_events: function (i) {
      i = i || {}; var off = dayOffset(i.day_offset), key = dayKey(off), q = norm(i.query), cat = norm(i.category), cal = (hub().calendar || []);
      var list = (TH.CLUB_EVENTS || []).filter(function (e) {
        if (off === 0 && wall(e.end || e.start) < now()) return false; // already over today
        if (e.allDay || e.multiDay || KEY.format(new Date(e.start)) !== key) return false;
        if (cat) { if (/food/.test(cat)) { if (!e.food) return false; } else if (!(e.tags || []).some(function (t) { return norm(t.name || t) === cat; })) return false; }
        if (q) { var hay = ' ' + norm(e.title + ' ' + e.org + ' ' + (e.desc || '')) + ' '; if (hay.indexOf(q) < 0 && !q.split(' ').every(function (w) { return hay.indexOf(' ' + w) >= 0; })) return false; }
        return true;
      }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
      return { date: key, count: list.length, events: list.slice(0, 12).map(function (e) { return { id: e.id, title: e.title, host: e.org, time: TIME.format(new Date(e.start)) + (e.end ? '–' + TIME.format(new Date(e.end)) : ''), where: e.location || 'Shown to registered attendees on EngageSC', free_food: !!e.food, on_my_calendar: cal.some(function (c) { return String(c.ref) === String(e.id); }), past: off === 0 && wall(e.end || e.start) < now() ? true : undefined, url: e.url }; }), source: 'EngageSC public events feed (snapshot Nov 9, 2026)' };
    },

    // EngageSC student organizations
    get_clubs: function (i) {
      i = i || {}; var q = norm(i.query), cat = norm(i.category), mine = (hub().clubs || []).map(function (c) { return +c.id; });
      var cands;
      if (q && window.TA && TA.HubMatch) {
        // exact / acronym names first, then topic matches (name or description), then looser name matches
        var fc = TA.HubMatch.findClubs(q), strong = fc.filter(function (x) { return x.score >= 0.9; }), topic = TA.HubMatch.searchClubs ? TA.HubMatch.searchClubs(q) : [], seen = {};
        cands = strong.concat(topic, fc.filter(function (x) { return x.score < 0.9; })).map(function (x) { return x.c; }).filter(function (c) { if (seen[c.id]) return false; seen[c.id] = 1; return true; });
      }
      else cands = (TH.CLUBS || []).filter(function (c) { return !q || norm(c.name + ' ' + (c.desc || '')).indexOf(q) >= 0; });
      if (cat) cands = cands.filter(function (c) { return (c.cats || [c.cat]).some(function (x) { return norm(x) === cat; }); });
      if (!q) cands = cands.filter(function (c) { return c.registered; });
      var up = window.TA && TA.HubMatch ? TA.HubMatch.upcoming() : [];
      return { count: cands.length, clubs: cands.slice(0, 10).map(function (c) { return { id: c.id, name: c.name, categories: (c.cats || [c.cat]).slice(0, 3), registered: !!c.registered, online_join_open: c.open !== false, upcoming_events: up.filter(function (e) { return e.orgId === c.id; }).length, member: mine.indexOf(c.id) >= 0, about: String(c.desc || '').slice(0, 160), url: c.engage || c.url }; }), my_clubs: (hub().clubs || []).map(function (c) { return c.name; }), note: 'Meeting times are rarely public; join to get the group’s posted events on My Day.' };
    },

    // safest vs fastest walk, DPS alerts, phones
    get_safety: function (i) {
      i = i || {}; var h = i.hour != null && !isNaN(+i.hour) ? +i.hour : nowMin() / 60, dest = String(i.destination || 'home');
      var to = dest === 'home' ? TH.HOME : (TH.byId && TH.byId[dest]);
      if (!to && TH.PLACES && window.TA && TA.HubMatch) { var f = TA.HubMatch.findPlaces(dest)[0]; to = f && f.score >= 0.6 ? f.p : null; }
      var out = { at: fmtMin(Math.round(h * 60)), from: TH.ME ? TH.ME.label : 'You', to: to ? (to.label || to.name) : null };
      if (to && TH.route && TH.ME) {
        try {
          var s = TH.route(TH.ME, to, { hour: h, mode: 'safe' }), fa = TH.route(TH.ME, to, { hour: h, mode: 'fast' }), lab = function (r) { return TH.riskLabel && TH.riskLevel ? TH.riskLabel[TH.riskLevel(r.risk)] : Math.round(r.risk * 100) + '%'; };
          out.safest = { minutes: s.minutes, level: lab(s), via: (s.streets || []).slice(0, 5) }; out.fastest = { minutes: fa.minutes, level: lab(fa), via: (fa.streets || []).slice(0, 5) };
        } catch (e) { out.route_error = 'Routing unavailable'; }
      } else if (!to) out.note = 'Unknown destination; use "home" or a place id from find_places.';
      out.dps_alerts = (TH.DPS_ALERTS || []).filter(function (a) { return a.date && (now() - (TH.laDate ? TH.laDate(a.date) : new Date(a.date))) < 7 * 864e5; }).slice(0, 5).map(function (a) { return { title: a.title, date: a.date, level: a.level, url: a.url }; });
      out.free_lyft_running_now = lyftOpen();
      out.controlled_access = TH.SAFETY && TH.SAFETY.access ? TH.SAFETY.access.idCheck + ': ' + TH.SAFETY.access.text : null;
      out.phones = (TH.SAFETY && TH.SAFETY.phones || []).slice(0, 4).map(function (p) { return p.label + ': ' + p.number; });
      out.caption = 'Scores come from reports to USC DPS, not proof a crime occurred. They describe streets at times of day, not neighborhoods or people.';
      return out;
    },

    // the student's timeline (classes, appointments, Hub items)
    get_my_day: function (i) {
      var off = dayOffset(i && i.day_offset), items = [];
      if (TH.dayItems) { try { items = TH.dayItems(off) || []; } catch (e) { items = []; } }
      return { day: dayLabel(off), items: items.slice(0, 20).map(function (x) { return { time: x.start != null ? fmtMin(x.start) + (x.end != null && x.end !== x.start ? '–' + fmtMin(x.end) : '') : '', kind: x.kind, title: x.title, detail: x.sub || undefined }; }), note: items.length ? undefined : 'Nothing scheduled.' };
    },

    // Tommy's suggested plan for a day (js/planner.js): fixed items + suggestions; suggestions are not booked
    get_plan: function (i) {
      if (!TH.plan || !TH.plan.day) return { note: 'The planner is not loaded.' };
      var off = dayOffset(i && i.day_offset), p;
      try { p = TH.plan.current(dayKey(off)); } catch (e) { return { note: 'Couldn’t build a plan for that day.' }; }
      return {
        day: dayLabel(off), vibe: p.vibe.title, free_time: Math.round(p.free.min) + ' min',
        blocks: p.blocks.slice(0, 24).map(function (b) { return { time: fmtMin(b.start) + (b.end > b.start ? '–' + fmtMin(b.end) : ''), title: b.title, kind: b.kindLabel || b.kind, suggested: !b.fixed, place: b.placeLabel || undefined, why: b.why || undefined, walk_min_est: b.walk ? b.walk.min : undefined }; }),
        note: 'Suggestions are not booked until the student adds them. Walk times and lines are estimates.'
      };
    },

    // a button under the answer that opens a Hub screen/place (returns the chip; ai-sample collects it)
    add_button: function (i, sink) {
      i = i || {}; var screen = String(i.screen || '').trim(), id = i.place_id ? String(i.place_id) : (i.arg != null ? String(i.arg) : '');
      var ok = (TH.screens && TH.screens[screen]) || /^(walk|place|club|event|safewalk)$/.test(screen) || /^(home|map|plans|plan|more|rides|upass|food|pass|queue|safety|events|clubs|wallet|alerts|gameday|access|about)$/.test(screen);
      if (!ok) throw new Error('Unknown screen "' + screen + '".');
      if ((screen === 'walk' || screen === 'place' || screen === 'safewalk') && id.replace(/@\d+$/, '') !== 'home' && !(TH.byId && TH.byId[id.replace(/@\d+$/, '')])) throw new Error('Unknown place_id "' + id + '". Get ids from find_places.');
      var chip = { label: String(i.label || screen).slice(0, 40), value: '@go:' + screen + (id ? ':' + id : ''), kind: '' };
      if (Array.isArray(sink)) { if (sink.length >= 3) return 'limit reached (3 buttons)'; sink.push(chip); }
      return 'ok';
    }
  };
  T._screens = 'home, map, plans, plan (Tommy’s day plan; arg YYYY-MM-DD or "week"), rides, upass, food, pass, queue, safety, events, clubs, wallet, alerts, gameday, access, walk (+place_id or "home"), safewalk (Safety screen route; place_id or "home"), place (+place_id), club (+arg club id)';
})();

