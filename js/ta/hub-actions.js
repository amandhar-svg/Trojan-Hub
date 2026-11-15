/* js/ta/hub-actions.js */
/* js/ta/hub-actions.js — Trojan Hub actions for Trojan Assist ("Ask Tommy").
 * Load AFTER js/ta/app.js and BEFORE TA.boot(). TA.Process.load() (run by boot) drops every researched
 * process that an already-registered action covers (score >= 0.8), so registering here first is what stops
 * the generic "rsvp-campus-event", "request a Lyft" and "activate U-Pass" processes from shadowing these.
 *
 * Every run() calls the shared Trojan Hub API (TH.act.*, js/actions.js) and mutates only TA.State.d
 * (TA.State.d.hub via TH.H()), so Brain.execute's snapshot/restore makes "Undo" revert it, TA.State.save()
 * persists it and fires TA.State.on (bridge.js re-renders Hub screens). run() never calls TH.commit:
 * Brain.execute logs, saves and snapshots by itself.
 *
 * Also here: the router hook (a confident Hub action wins over B.misuse/B.offTopic, e.g. "order me a latte"),
 * walk-to navigation answers (@go:walk:<placeId> chips, no confirm), receipt chips, starter chips.
 * Safety: flagged messages (crisis, emergency, distress, disclosures, threats, medical...) never reach the hook.
 */
(function () {
  'use strict';
  var TA = window.TA, TH = window.TH || (window.TH = {});
  var B = TA.Brain, def = TA._actionHelpers.def; // def() pushes onto TA.Actions.list (the same array)
  var D = function () { return TA.State.d; };

  // ---------------------------------------------------------------- state + TH.act plumbing
  function hub() {
    if (TH.H) return TH.H();
    var d = D();
    return d.hub || (d.hub = { calendar: [], clubs: [], orders: [], passes: [], lines: [], ride: null, zips: [], upass: null, parking: null, lyftUsedUSD: 0, notes: null });
  }
  TA.hub = hub;
  function act(name) {
    var f = TH.act && TH.act[name];
    if (typeof f !== 'function') throw new Error('Trojan Hub can’t do “' + name + '” right now.');
    return f.apply(TH.act, [].slice.call(arguments, 1)) || {};
  }
  // TH.act.check.X mirrors the validation of TH.act.X; any throw becomes a block line
  function chk(name) {
    var o = { block: [], warn: [], offers: [] }, c = TH.act && TH.act.check && TH.act.check[name];
    if (typeof c !== 'function') return o;
    try { var r = c.apply(TH.act.check, [].slice.call(arguments, 1)) || {}; o.block = (r.block || []).slice(); o.warn = (r.warn || []).slice(); } catch (e) { o.block.push(e.message || String(e)); }
    return o;
  }
  function merge(a, b) { a.block = a.block.concat(b.block || []); a.warn = a.warn.concat(b.warn || []); a.offers = (a.offers || []).concat(b.offers || []); return a; }
  function receipt(r, title, log) { r = r || {}; return { title: r.title || title, rows: r.rows || [], log: r.log || log || r.title || title }; }

  // ---------------------------------------------------------------- text + time helpers
  function norm(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  var STOP = { the: 1, a: 1, an: 1, of: 1, and: 1, at: 1, for: 1, in: 1, on: 1, to: 1, usc: 1, club: 1, clubs: 1, student: 1, students: 1, association: 0, society: 0, org: 1, organization: 1, me: 1, my: 1, join: 1, please: 1, sign: 1, up: 1 };
  function toks(s) { return norm(s).split(' ').filter(function (w) { return w && !STOP[w]; }); }
  function lev1(a, b) { // edit distance <= 1 (typo tolerance for words >= 5 letters)
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
    var i = 0, j = 0, e = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return e + (a.length - i) + (b.length - j) <= 1;
  }
  function has(re, n) { return re.test(n.t); }
  // a plain question stays a question ("how do I RSVP on Engage?", "is the Lyft free?", "where can I park?")
  var HOWQ = /\b(how (do|can|would|should|does|much|many|long|late|early) |how to\b|what (is|are|does|do|time|happens)\b|where (can|do|should) (i|we)\b|is (it|the|there|this|that)\b|are (there|the|they)\b|tell me (about|how|more)\b|explain\b|when (does|do|is|are|can)\b|why\b|which\b|does\b|do (i|you|they|we) (need|have)\b)/;
  function isCmd(n) {
    if (HOWQ.test(n.t) && !/\b(for me|on my behalf)\b/.test(n.t) && !/^(can|could|would|will) you (please )?(get|order|book|reserve|call|request|sign|put|add|join|save|rsvp|enroll|grab|find me)\b/.test(n.t)) return false;
    if (n.isQuestion && !n.polite) return false;
    return true;
  }
  function pad(x) { return String(x).padStart(2, '0'); }
  function fmtMin(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return mm ? h + ':' + pad(mm) + ' ' + ap : h + ' ' + ap; }
  function now() { return TA.now(); }
  function nowMin() { var d = now(); return d.getHours() * 60 + d.getMinutes(); }
  function ceilTo(m, step) { return Math.ceil(m / step) * step; }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function money(x) { return TA.money ? TA.money(x) : '$' + Number(x).toFixed(2); }
  function timeOf(n) { var t = n.times && n.times[0]; return t ? t.h * 60 + t.m : null; }
  // ranges a place is open on a date (honors `special` dates and past-midnight closes); null = hours not published
  function rangesOn(p, date) {
    if (!p || !p.hours) return null;
    var k = dkey(date), sp = p.special && p.special[k];
    return (sp || p.hours[date.getDay()] || []).map(function (r) { return [r[0], r[1]]; });
  }
  function openAt(p, min, date) { // true / false / null (hours not published); min may be >= 1440 for "later tonight"
    date = date || now();
    if (TH.openFor) { try { var at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0); at.setMinutes(min); return TH.openFor(p, at, 0); } catch (e) { /* fall through */ } }
    var r = rangesOn(p, date); if (r === null) return null;
    if (r.some(function (x) { return min >= x[0] && min < x[1]; })) return true;
    var y = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1), ry = rangesOn(p, y) || [];
    return ry.some(function (x) { return x[1] > 1440 && min + 1440 < x[1]; });
  }
  function hoursText(p, date) { var r = rangesOn(p, date || now()); if (r === null) return 'Hours not published'; if (!r.length) return 'Closed today'; if (TH.rangesText) return TH.rangesText(r); return r.map(function (x) { return fmtMin(x[0]) + '–' + fmtMin(x[1]); }).join(', '); }

  // ---------------------------------------------------------------- places
  function places() { return TH.PLACES || []; }
  function placeById(id) { return (TH.byId && TH.byId[id]) || places().find(function (p) { return p.id === id; }) || null; }
  var _gen = null;
  function generic() { // words shared by many place names ("hall", "center", "building") never identify a place alone
    if (_gen) return _gen; var df = {}; places().forEach(function (p) { toks(p.name).forEach(function (w) { df[w] = (df[w] || 0) + 1; }); });
    _gen = {}; Object.keys(df).forEach(function (w) { if (df[w] >= 6) _gen[w] = 1; }); return _gen;
  }
  function walkMin(p) { if (TH.ui && TH.ui.walkMin) { try { return TH.ui.walkMin(p); } catch (e) { } } var me = TH.ME || { x: 0, y: 0 }; return Math.max(1, Math.round(Math.hypot(p.x - me.x, p.y - me.y) * 1.3 / 80)); }
  // best matching places for free text; [{p, score}] (score 1 = full name present)
  function findPlaces(text, filter) {
    var t = ' ' + norm(text) + ' ', words = norm(text).split(' '), g = generic(), out = [];
    places().forEach(function (p) {
      if (filter && !filter(p)) return;
      var nm = norm(p.name), base = norm(String(p.name).replace(/\s*[(–—-].*$/, '').replace(/\s+featuring\s.*$/i, '')), sc = 0;
      if (nm.length >= 4 && t.indexOf(' ' + nm + ' ') >= 0) sc = 1;
      else if (base.length >= 4 && t.indexOf(' ' + base + ' ') >= 0) sc = 0.97;
      else {
        var code = /\(([A-Z]{2,5})\)/.exec(p.name || '') || /\(([A-Z]{2,5})[\/)]/.exec(p.bldg || '');
        if (code && words.indexOf(code[1].toLowerCase()) >= 0 && code[1].length >= 3) sc = 0.9;
        var nt = toks(base).filter(function (w) { return !g[w] && w.length >= 3; });
        if (nt.length) {
          var hitW = nt.filter(function (w) { return words.some(function (x) { return x === w || lev1(x, w) || (w.length >= 6 && x.length >= 5 && w.indexOf(x) === 0); }); }), hit = hitW.length;
          var s2 = hit / nt.length * 0.88; if (hit && hitW[0] === nt[0]) s2 = Math.max(s2, 0.8); // the name's head word ("Doheny", "Leavey")
          if (hit && s2 >= 0.44) sc = Math.max(sc, s2);
        }
        // a contiguous run of 2+ name words ("trojan grounds", "leavey library")
        var all = base.split(' ');
        for (var a = 0; a < all.length - 1 && sc < 0.9; a++) for (var z = all.length; z >= a + 2; z--) { var run = all.slice(a, z).join(' '); if (run.length >= 9 && t.indexOf(' ' + run + ' ') >= 0 && all.slice(a, z).some(function (w) { return !g[w]; })) { sc = Math.max(sc, (z - a) / all.length >= 0.5 ? 0.92 : 0.75); break; } }
        (p.tags || []).forEach(function (tg) { var tn = norm(tg); if (tn.length >= 5 && t.indexOf(' ' + tn + ' ') >= 0) sc = Math.max(sc, 0.55); });
      }
      // tie-break: share of ALL the name's words present ("Doheny Memorial Library" beats "Restrooms inside Doheny …")
      if (sc > 0) { var nw = base.split(' '); sc += 0.05 * nw.filter(function (w) { return words.indexOf(w) >= 0; }).length / nw.length; out.push({ p: p, score: sc }); }
    });
    return out.sort(function (a, b) { return b.score - a.score || walkMin(a.p) - walkMin(b.p); });
  }
  function bestPlace(text, filter, min) { var r = findPlaces(text, filter); return r.length && r[0].score >= (min || 0.6) && !(r[1] && r[1].score === r[0].score && r[1].p.name !== r[0].p.name && r[0].score < 0.97) ? r[0].p : null; }

  // ---------------------------------------------------------------- clubs + events (TH.CLUBS / TH.CLUB_EVENTS, EngageSC)
  function clubs() { return TH.CLUBS || []; }
  function clubById(id) { id = +id; return clubs().find(function (c) { return c.id === id; }) || null; }
  var _cdf = null;
  function clubGeneric(w) { // words in 40+ group names ("student", "association", "trojan", "keck"...) never identify a club alone
    if (!_cdf) { _cdf = {}; clubs().forEach(function (c) { var seen = {}; toks(c.name).forEach(function (x) { if (!seen[x]) { seen[x] = 1; _cdf[x] = (_cdf[x] || 0) + 1; } }); }); }
    return (_cdf[w] || 0) >= 40;
  }
  function acronym(name) { return norm(name.replace(/\(.*?\)/g, '')).split(' ').filter(function (w) { return w && !/^(of|the|and|at|for|in|usc)$/.test(w); }).map(function (w) { return w[0]; }).join(''); }
  // ranked candidates for what the student typed: exact > contained > acronym > token overlap (typo-tolerant)
  function findClubs(text) {
    var t0 = norm(text).replace(/^(the|a|an) /, ''), t = t0.replace(/ (clubs?|orgs?|organizations?|groups?|chapters?)$/, ''), tw = toks(t), out = [];
    if (t.length < 2) return out;
    clubs().forEach(function (c) {
      var nm = norm(c.name), sc = 0, paren = /\(([^)]+)\)/.exec(c.name), fuzzy = false;
      if (nm === t || nm === t0 || norm(c.name.replace(/\s*\(.*?\)\s*/g, ' ')) === t) sc = 1;
      else if (nm.length >= 8 && nm.split(' ').length >= 2 && (' ' + t0 + ' ').indexOf(' ' + nm + ' ') >= 0) sc = 0.98; // the query contains the full name
      else if (paren && norm(paren[1]) === t && t.length >= 2) sc = 0.97;
      else if (t.length >= 6 && (' ' + t + ' ').indexOf(' ' + nm + ' ') >= 0 && nm.length >= 4) sc = 0.95;
      else if (t.length >= 3 && t.indexOf(' ') < 0 && t.length <= 6 && acronym(c.name) === t) sc = 0.9;
      else if (t.length >= 5 && nm.indexOf(t) >= 0) sc = 0.86 - Math.min(0.2, (nm.length - t.length) / 200);
      else if (tw.length) {
        var cw = toks(c.name); if (!cw.length) return;
        var hitW = tw.filter(function (w) { return cw.some(function (x) { return x === w || lev1(x, w); }); }), hit = hitW.length;
        var exactW = hitW.filter(function (w) { return cw.indexOf(w) >= 0; });
        if (hit && hitW.some(function (w) { return !clubGeneric(w); })) { sc = 0.8 * hit / Math.max(cw.length, tw.length); if (hit === tw.length && tw.length >= 2) sc = Math.max(sc, 0.78); if (exactW.length < hit) sc -= 0.05; fuzzy = !exactW.some(function (w) { return !clubGeneric(w); }); }
      }
      if (sc >= 0.4) out.push({ c: c, score: sc + (c.registered ? 0.001 : 0), fuzzy: fuzzy });
    });
    // "chess" also matches "chefs" by one letter; drop typo-only matches when real word matches exist
    if (out.some(function (x) { return !x.fuzzy; })) out = out.filter(function (x) { return !x.fuzzy; });
    return out.sort(function (a, b) { return b.score - a.score || norm(a.c.name).length - norm(b.c.name).length; });
  }
  // decision: one clear club, an ambiguous list, or nothing
  function pickClub(text) {
    var r = findClubs(text); if (!r.length) return { club: null, cands: [] };
    var top = r[0], close = r.filter(function (x) { return x.score >= top.score - 0.06 && x.score >= 0.5; });
    if (top.score >= 0.9 && (close.length === 1 || top.score >= 0.97 && (!r[1] || r[1].score < 0.97))) return { club: top.c, cands: [] };
    return { club: null, cands: (close.length > 1 ? close : r).slice(0, 6).map(function (x) { return x.c; }) };
  }
  var LA = 'America/Los_Angeles';
  var LA_DAY = new Intl.DateTimeFormat('en-US', { timeZone: LA, weekday: 'short', month: 'short', day: 'numeric' });
  var LA_TIME = new Intl.DateTimeFormat('en-US', { timeZone: LA, hour: 'numeric', minute: '2-digit' });
  var LA_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: LA, year: 'numeric', month: '2-digit', day: '2-digit' });
  function when(e) { var s = new Date(e.start); return LA_DAY.format(s) + ', ' + LA_TIME.format(s) + (e.end ? '–' + LA_TIME.format(new Date(e.end)) : ''); }
  function evDay(e) { return LA_KEY.format(new Date(e.start)); }
  // an ISO instant as a campus wall-clock Date, comparable with now() (TH.clock is campus wall clock)
  function wall(iso) { return TH.laDate ? TH.laDate(iso) : new Date(iso); }
  // all-day and multi-day "events" (semester-long office hours, check-ins) are not things to RSVP to
  function upcoming() { var t = now(); return (TH.CLUB_EVENTS || []).filter(function (e) { return wall(e.end || e.start) >= t && !e.allDay && !e.multiDay; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); }); }
  function eventsFor(clubId) { return upcoming().filter(function (e) { return e.orgId === clubId; }); }
  function eventById(id) { return (TH.CLUB_EVENTS || []).find(function (e) { return String(e.id) === String(id); }) || null; }
  function findEvent(text) {
    var t = ' ' + norm(text) + ' ', best = null, bestLen = 0;
    upcoming().forEach(function (e) { var nm = norm(e.title); if (nm.length >= 6 && t.indexOf(' ' + nm + ' ') >= 0 && nm.length > bestLen) { best = e; bestLen = nm.length; } });
    if (best) return best;
    // looser: most of the title's distinctive words
    var words = norm(text).split(' '), top = null, topSc = 0;
    upcoming().slice(0, 600).forEach(function (e) { var tw = toks(e.title).filter(function (w) { return w.length >= 4; }); if (tw.length < 2) return; var hit = tw.filter(function (w) { return words.indexOf(w) >= 0; }).length, sc = hit / tw.length; if (hit >= 2 && sc >= 0.75 && sc > topSc) { top = e; topSc = sc; } });
    return top;
  }
  // topic search ("chess", "robotics", "hiking"): every topic word in the group's name or description, name hits first
  var _cix = null;
  function stem(w) { return w.length > 4 ? w.replace(/ies$/, 'y').replace(/(ches|shes|xes)$/, function (x) { return x.slice(0, -2); }).replace(/([^s])s$/, '$1') : w; }
  function searchClubs(text) {
    var ws = toks(text).filter(function (w) { return w.length >= 3; }).map(stem); if (!ws.length) return [];
    if (!_cix || _cix.n !== clubs().length) _cix = { n: clubs().length, rows: clubs().map(function (c) { return { c: c, nm: ' ' + norm(c.name) + ' ', ds: ' ' + norm(c.desc || '') + ' ' }; }) };
    var up = {}; upcoming().forEach(function (e) { up[e.orgId] = 1; });
    var res = [];
    _cix.rows.forEach(function (r) {
      var nh = 0, dh = 0, ok = ws.every(function (w) { var re = ' ' + w; if (r.nm.indexOf(re) >= 0) { nh++; return true; } if (r.ds.indexOf(re) >= 0) { dh++; return true; } return false; });
      if (ok) res.push({ c: r.c, score: nh * 2 + dh * 0.5 + (r.c.registered ? 0.3 : 0) + (up[r.c.id] ? 0.1 : 0) - r.nm.length / 1000 });
    });
    return res.sort(function (a, b) { return b.score - a.score; });
  }
  function onCalendar(id) { return (hub().calendar || []).some(function (x) { return String(x.ref) === String(id); }); }
  function isMember(id) { return (hub().clubs || []).some(function (x) { return +x.id === +id; }); }
  TA.HubMatch = { findClubs: findClubs, searchClubs: searchClubs, pickClub: pickClub, findPlaces: findPlaces, findEvent: findEvent, upcoming: upcoming, when: when, openAt: openAt };

  // ---------------------------------------------------------------- registration + routing allow-list
  var HUB_IDS = { join_org: 1 };
  var NEXT = {}; // receipt chips per action
  TA.registerHubAction = function (a, nextChips) { def(a); HUB_IDS[a.id] = 1; if (nextChips) NEXT[a.id] = nextChips; return a; };
  function go(label, screen, arg) { return { label: label, value: '@go:' + screen + (arg != null ? ':' + arg : ''), kind: '' }; }
  var SIM = 'Simulated on the demo account — nothing is sent to USC.';

  // ======================================================================
  // 1) RSVP to a public EngageSC event -> TH.act.saveEvent
  // ======================================================================
  TA.registerHubAction({
    id: 'hub_rsvp_event', title: 'Save a campus event to My Day (RSVP)', scope: 'campuslife', icon: 'calendar',
    system: 'EngageSC (engage.usc.edu) + Trojan Hub calendar',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      var verb = /\b(rsvp|add (it|this|that|.{3,60}) to my (calendar|day|schedule|plans)|put (it|this|that|.{3,60}) on my (calendar|day|schedule)|save (the|this|that) event|save .{3,60} event)\b/.test(n.t);
      if (verb) return findEvent(n.t) || /@ev:\d+/.test(n.raw || '') ? 0.95 : 0.85;
      if (/\b(sign me up for|i want to go to|i am going to|count me in for|take me to)\b/.test(n.t) && findEvent(n.t)) return 0.93;
      return 0;
    },
    init: function (n) { var m = /@ev:(\d+)/.exec(n.raw || ''), e = m ? eventById(m[1]) : findEvent(n.t); return { eventId: e ? e.id : null, q: n.t }; },
    next: function (s) {
      if (s.eventId) return null;
      var list = upcoming().filter(function (e) { return !onCalendar(e.id); });
      var food = /\b(free food|food)\b/.test(s.q || ''); if (food) list = list.filter(function (e) { return e.food; });
      list = list.slice(0, 6);
      return { slot: 'eventId', md: list.length ? (food ? 'Which free-food event?' : 'Which event? Here are the next public EngageSC events:') : 'I don’t see any upcoming public events right now.', options: list.map(function (e) { return { label: e.title, sub: when(e) + ' · ' + e.org + (e.food ? ' · free food' : ''), value: '@ev:' + e.id }; }), placeholder: 'Or type the event name' };
    },
    fill: function (name, n, s, text) {
      var m = /@ev:(\d+)/.exec(text || ''), e = m ? eventById(m[1]) : findEvent(n.t);
      if (e) { s.eventId = e.id; return true; } return false;
    },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, e = eventById(s.eventId);
      if (!e) { o.block.push('I couldn’t find that event in EngageSC’s public calendar.'); o.offers.push({ label: 'Show events', value: '@go:events' }); return o; }
      if (wall(e.end || e.start) < now()) o.block.push('**' + e.title + '** has already ended.');
      else if (onCalendar(e.id)) o.block.push('**' + e.title + '** is already on your calendar.');
      merge(o, chk('saveEvent', e.id));
      return o;
    },
    preview: function (s) {
      var e = eventById(s.eventId);
      return {
        title: 'RSVP and add to My Day',
        rows: [['Event', e.title], ['When', when(e)], ['Host', e.org], ['Where', e.location || 'Shown to registered attendees on EngageSC']].concat(e.food ? [['Food', 'Provided (per EngageSC)']] : []),
        notes: ['It goes on your My Day calendar, and you can add it to your phone’s calendar from there.'],
        fine: ['Simulated RSVP: nothing is sent to EngageSC. RSVP for real on the event page.'],
        sources: [{ url: e.url, title: e.title + ' – EngageSC' }]
      };
    },
    run: function (s) { var e = eventById(s.eventId); return receipt(act('saveEvent', e.id), 'You’re going', 'RSVP’d to ' + e.title + ' (' + when(e) + ') and added it to My Day'); }
  }, [go('Open My Day', 'plans'), go('More events', 'events')]);

  // ======================================================================
  // 2) join_org OVERRIDE (in place, id kept: brain.js special-cases 'join_org') -> TH.act.joinClub
  // ======================================================================
  var L = TA.Actions.list, ix = L.findIndex(function (a) { return a.id === 'join_org'; }), base = L[ix];
  var JOIN_RE = /\b(?:join|sign up for|sign me up for|add me to|put me in|become a member of|apply to join|request to join)\s+(?:the\s+)?(.{2,80}?)[.!?]*$/i;
  function clubText(raw) { var m = JOIN_RE.exec(String(raw || '')); return m ? m[1] : String(raw || ''); }
  function attach(s, raw) {
    var id = /@club:(\d+)/.exec(String(raw || ''));
    if (id && clubById(id[1])) { var c0 = clubById(id[1]); s.clubId = c0.id; s.name = c0.name; s.cands = null; return s; }
    var pk = pickClub(clubText(raw)); if (!pk.club && s.name) pk = pickClub(s.name);
    if (pk.club) { s.clubId = pk.club.id; s.name = pk.club.name; s.cands = null; }
    else s.cands = pk.cands.map(function (c) { return c.id; });
    return s;
  }
  L[ix] = Object.assign({}, base, {
    title: 'Join a student organization (EngageSC)',
    system: 'EngageSC (engage.usc.edu) + Trojan Hub calendar',
    init: function (n) { var s = base.init.call(this, n) || {}; if (/@club:\d+/.test(n.raw || '')) s.name = s.name || 'club'; return s.name ? attach(s, n.raw) : s; },
    next: function (s) {
      if (!s.name && !s.clubId) return { slot: 'name', md: 'Which organization? Type its name as it appears on EngageSC.', placeholder: 'e.g. Troy Camp' };
      if (!s.clubId && s.cands && s.cands.length) {
        return { slot: 'club', md: 'I found a few EngageSC groups that match **' + s.name + '**. Which one?', options: s.cands.map(clubById).filter(Boolean).map(function (c) { return { label: c.name, sub: (c.cat || 'Student organization') + (c.registered ? '' : ' · Not registered yet') + ' · ' + TA.plural(eventsFor(c.id).length, 'upcoming event'), value: '@club:' + c.id }; }), placeholder: 'Or type the exact name' };
      }
      return null;
    },
    fill: function (name, n, s, text) {
      var m = /@club:(\d+)/.exec(text || '');
      if (m && clubById(m[1])) { var c = clubById(m[1]); s.clubId = c.id; s.name = c.name; s.cands = null; return true; }
      if (!text || text.trim().length < 2) return false;
      var raw = String(text).trim(); s.name = clubText(raw).replace(/[.!?]+$/, ''); s.clubId = null; attach(s, raw);
      return true;
    },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, c = s.clubId ? clubById(s.clubId) : null;
      if (!c) {
        o.block.push('I couldn’t find **' + (s.name || 'that group') + '** in the EngageSC directory (2,000 groups). Check the exact name on EngageSC, or browse Clubs.');
        o.offers.push({ label: 'Browse clubs', value: '@go:clubs' }); return o;
      }
      if (isMember(c.id)) { o.block.push('You’re already a member of **' + c.name + '**.'); o.offers.push({ label: 'Leave ' + c.name, value: 'leave @club:' + c.id }); return o; }
      merge(o, chk('joinClub', c.id)); // warns: not registered yet / online joining closed / no public events
      return o;
    },
    preview: function (s) {
      var c = clubById(s.clubId), ev = TH.clubEvents ? TH.clubEvents(c.id) : eventsFor(c.id), p = D().profile;
      var rows = [['Organization', c.name], ['Category', (c.cats || [c.cat]).filter(Boolean).slice(0, 3).join(', ') || '—'],
        ['Adds to My Day', ev.length ? TA.plural(ev.length, 'upcoming event') + ' in the next 6 weeks: ' + ev.slice(0, 3).map(function (e) { return e.title + ' (' + when(e) + ')'; }).join('; ') + (ev.length > 3 ? '; …' : '') : 'No public EngageSC events in the next 6 weeks']];
      if (c.meeting) rows.push(['Meets', (c.meeting.text || String(c.meeting)) + ' (per the group’s own page)']);
      rows.push(['Shared with officers', p.first + ' ' + p.last + ' · ' + p.email]);
      return {
        title: 'Join ' + c.name, rows: rows,
        notes: ['Officers review membership requests on EngageSC; some groups also hold tryouts or interviews.', 'Regular meeting times usually aren’t public, so I only add events the group has posted.'],
        fine: ['Simulated: no request is sent to EngageSC. Join for real on the group’s EngageSC page.'],
        sources: [{ url: c.engage || c.url || 'https://engage.usc.edu/club_signup', title: c.name + ' – EngageSC' }]
      };
    },
    run: function (s) { var c = clubById(s.clubId); return receipt(act('joinClub', c.id), 'Joined ' + c.name, 'Joined ' + c.name + ' (EngageSC)'); }
  });
  HUB_IDS.join_org = 1; NEXT.join_org = [go('Open My Day', 'plans'), go('My clubs', 'clubs')];

  // ---- leave a club -> TH.act.leaveClub
  function joinedClub(text) {
    var m = /@club:(\d+)/.exec(text || ''); if (m && isMember(m[1])) return +m[1];
    var mine = hub().clubs || [], t = norm(text);
    var hit = mine.filter(function (x) { var nm = norm(x.name); return t.indexOf(nm) >= 0 || (findClubs(text)[0] || {}).c && findClubs(text)[0].c.id === +x.id; });
    return hit.length === 1 ? +hit[0].id : null;
  }
  TA.registerHubAction({
    id: 'hub_leave_club', title: 'Leave a club', scope: 'campuslife', icon: 'users', system: 'EngageSC + Trojan Hub calendar',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (!/\b(leave|quit|drop out of|unjoin|remove me from|cancel my membership (in|with|at))\b/.test(n.t)) return 0;
      if (/\b(line|queue|class|course|section|meal plan|waitlist|lyft|ride|absence|leave of absence)\b/.test(n.t)) return 0;
      if (/@club:\d+/.test(n.raw || '') || joinedClub(n.raw)) return 0.93;
      var fc = findClubs(String(n.raw || '').replace(/^.*?\b(leave|quit|drop out of|unjoin|remove me from)\s+(the\s+)?/i, ''))[0]; if (fc && fc.score >= 0.9) return 0.88;
      return /\b(club|org|organization|group|chapter)\b/.test(n.t) ? 0.85 : 0;
    },
    init: function (n) { var id = joinedClub(n.raw); if (!id) { var fc = findClubs(String(n.raw || '').replace(/^.*?\b(leave|quit|drop out of|unjoin|remove me from)\s+(the\s+)?/i, ''))[0]; if (fc && fc.score >= 0.9) id = fc.c.id; } return { clubId: id }; },
    next: function (s) {
      var mine = hub().clubs || [];
      if (s.clubId || !mine.length) return null;
      return { slot: 'clubId', md: 'Which club should I take you out of?', options: mine.map(function (x) { return { label: x.name, value: '@club:' + x.id }; }) };
    },
    fill: function (name, n, s, text) { var id = joinedClub(text); if (id) { s.clubId = id; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!(hub().clubs || []).length) o.block.push('You haven’t joined any clubs in Trojan Hub yet, so there’s nothing to leave.'); else if (!s.clubId) o.block.push('I couldn’t tell which of your clubs you meant.'); else if (!isMember(s.clubId)) o.block.push('You’re not a member of **' + ((clubById(s.clubId) || {}).name || 'that group') + '** in Trojan Hub.'); else merge(o, chk('leaveClub', s.clubId)); return o; },
    preview: function (s) { var c = clubById(s.clubId) || { name: 'this club' }, n = (hub().calendar || []).filter(function (x) { return x.kind === 'club' && +x.orgId === +s.clubId; }).length;
      return { title: 'Leave ' + c.name, rows: [['Organization', c.name], ['Removes from My Day', n ? TA.plural(n, 'club event') : 'No club events']], fine: [SIM], sources: c.engage || c.url ? [{ url: c.engage || c.url, title: c.name + ' – EngageSC' }] : [] }; },
    run: function (s) { var c = clubById(s.clubId) || { name: 'club' }; return receipt(act('leaveClub', s.clubId), 'Left ' + c.name, 'Left ' + c.name); }
  }, [go('Browse clubs', 'clubs')]);

  // ======================================================================
  // 3) Mobile order for pickup -> TH.act.placeOrder(placeId, items, windowMin)
  // ======================================================================
  var KINDS = [ // what the student asked for -> which sample item fits (USC publishes no mobile-order menus)
    { k: 'coffee', re: /\b(coffee|latte|lattes|cappuccino|espresso|americano|mocha|cold brew|macchiato|frappuccino|flat white|cortado|iced coffee)\b/, item: [/coffee/i, /drink/i] },
    { k: 'tea', re: /\b(tea|chai|matcha|boba)\b/, item: [/tea/i, /drink/i] },
    { k: 'pastry', re: /\b(pastry|pastries|croissants?|muffins?|scones?|bagels?|donuts?|doughnuts?|cookies?)\b/, item: [/pastry/i, /side/i] },
    { k: 'sandwich', re: /\b(sandwich(es)?|panini|wraps?|sub)\b/, item: [/sandwich/i, /entr/i] },
    { k: 'drink', re: /\b(drinks?|soda|juice|smoothies?|water|lemonade)\b/, item: [/drink/i, /coffee/i] },
    { k: 'side', re: /\b(fries|side|salad|chips|snack)\b/, item: [/side/i, /pastry/i] },
    { k: 'entree', re: /\b(burgers?|tacos?|pizza|slices?|bowls?|entr[eé]es?|meal|lunch|dinner|breakfast|food|burritos?|orange chicken|plate|something to eat|bite)\b/, item: [/entr/i, /sandwich/i] }
  ];
  var QTY = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, couple: 2 };
  function kindsFrom(t) {
    var out = [];
    KINDS.forEach(function (K) { var m = K.re.exec(t); if (!m) return; var q = new RegExp('\\b(\\d|one|two|three|four|a couple of)\\s+(?:\\w+\\s+)?' + m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).exec(t); var qty = q ? (QTY[q[1].replace('a couple of', 'couple')] || +q[1] || 1) : 1; out.push({ k: K.k, word: m[0], qty: Math.min(qty, 6) }); });
    if (out.length > 1) out = out.filter(function (x) { return x.k !== 'entree' || !/^(food|meal|lunch|dinner|breakfast|something to eat|bite)$/.test(x.word); });
    return out;
  }
  function menuFor(id) { return (TH.ORDER_MENUS && TH.ORDER_MENUS[id]) || null; }
  function orderVenues() { return Object.keys(TH.ORDER_MENUS || {}).map(placeById).filter(Boolean); }
  function resolveItems(placeId, kinds) {
    var menu = menuFor(placeId) || [], out = [];
    kinds.forEach(function (K) { var spec = KINDS.find(function (x) { return x.k === K.k; }); var it = null; spec.item.some(function (re) { it = menu.find(function (m) { return re.test(m[0]); }); return !!it; }); if (it && !out.some(function (o) { return o[0] === it[0]; })) out.push([it[0], K.qty, it[1]]); });
    return out;
  }
  function venueFrom(text) { return bestPlace(text, function (p) { return !!menuFor(p.id); }, 0.6); }
  function totalOf(items) { return Math.round(items.reduce(function (a, i) { return a + i[1] * i[2]; }, 0) * 100) / 100; }
  function windows(p) { var m0 = ceilTo(nowMin() + 10, 5), out = []; [0, 15, 30, 45, 60, 90].forEach(function (d) { var w = m0 + d; if (w < 1440 && openAt(p, w) !== false && openAt(p, w + 10) !== false && out.length < 4) out.push(w); }); return out; }
  TA.registerHubAction({
    id: 'hub_order_food', title: 'Mobile order food or coffee for pickup', scope: 'dining', icon: 'meal',
    system: 'Trojan Hub Mobile Order (USC Hospitality venue)',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (/\b(textbooks?|books?|transcripts?|permit|uscard|card|cap and gown|gown|diploma|tickets?|merch|supplies|laptop|uber ?eats|doordash|grubhub|meal plan|dining dollars|swipes?)\b/.test(n.t)) return 0;
      var kinds = kindsFrom(n.t), venue = venueFrom(n.raw);
      var verb = /\b(order|get|grab|buy|bring|pick up|place an order|mobile order)\b/.test(n.t), want = /\b(i want|i would like|i need|can i get|could i get|i will have|i will take)\b/.test(n.t);
      if (/\bmobile order\b/.test(n.t) && (venue || kinds.length)) return 0.95;
      if (verb && /\b(order|get|grab|buy)\b( me| us)?\b/.test(n.t) && kinds.length && !/\b(where|which)\b/.test(n.t)) return venue ? 0.95 : 0.9;
      if (/\border\b/.test(n.t) && venue) return 0.92;
      if (want && kinds.length && kinds.some(function (k) { return k.k !== 'entree' || k.word !== 'food'; }) && (venue || /\b(pick ?up|to go|for pickup)\b/.test(n.t))) return 0.85;
      return 0;
    },
    init: function (n) {
      var p = venueFrom(n.raw), kinds = kindsFrom(n.t), w = timeOf(n), off = dayOffOf(n);
      return { otherDay: off > 0 ? off : 0, placeId: p ? p.id : null, kinds: kinds, asked: kinds.map(function (k) { return k.word; }).join(', '), items: p ? resolveItems(p.id, kinds) : [], win: w != null && w >= nowMin() ? w : null, asap: /\b(asap|a s a p|right now|right away|now|soonest|earliest|as soon as possible|immediately)\b/.test(n.t) };
    },
    next: function (s) {
      if (s.otherDay) return null; // check() explains that orders are same-day only
      if (!s.placeId) {
        var exact = function (p) { return s.kinds.filter(function (K) { var spec = KINDS.find(function (x) { return x.k === K.k; }); return (menuFor(p.id) || []).some(function (m) { return spec.item[0].test(m[0]); }); }).length; };
        var open = orderVenues().filter(function (p) { return openAt(p, nowMin() + 15) === true && (!s.kinds.length || resolveItems(p.id, s.kinds).length); }).sort(function (a, b) { return exact(b) - exact(a) || walkMin(a) - walkMin(b); });
        if (!open.length) { s.noneOpen = true; return null; }
        return { slot: 'placeId', md: (s.asked ? 'Where should I order your **' + s.asked + '** from? ' : 'Where should I order from? ') + 'These take mobile orders and are open now:', options: open.slice(0, 6).map(function (p) { return { label: p.name, sub: 'Open · ' + hoursText(p) + ' · ' + walkMin(p) + ' min walk', value: '@place:' + p.id }; }), placeholder: 'Or type a venue' };
      }
      var p = placeById(s.placeId);
      if (!s.items.length) return { slot: 'items', md: 'What would you like from **' + p.name + '**? (USC doesn’t publish a mobile-order menu, so these are sample items.)', options: (menuFor(p.id) || []).map(function (m, i) { return { label: m[0].replace(/ \(sample item\)/, '') + ' · ' + money(m[1]), value: '@item:' + i }; }) };
      if (s.win == null) { var ws = windows(p); if (!ws.length) return null; if (s.asap) { s.win = ws[0]; return null; } return { slot: 'win', md: 'When do you want to pick it up?', options: ws.map(function (w, i) { return { label: (i === 0 ? 'ASAP · ' : '') + fmtMin(w) + '–' + fmtMin(w + 10), value: '@win:' + w }; }) }; }
      return null;
    },
    fill: function (name, n, s, text) {
      var m;
      if ((m = /@place:([\w-]+)/.exec(text || '')) && placeById(m[1])) { s.placeId = m[1]; s.items = resolveItems(s.placeId, s.kinds || []); return true; }
      if ((m = /@item:(\d+)/.exec(text || ''))) { var it = (menuFor(s.placeId) || [])[+m[1]]; if (it) { s.items = [[it[0], 1, it[1]]]; return true; } }
      if ((m = /@win:(\d+)/.exec(text || ''))) { s.win = +m[1]; return true; }
      if (name === 'placeId') { var p = venueFrom(text); if (p) { s.placeId = p.id; s.items = resolveItems(p.id, s.kinds || []); return true; } }
      if (name === 'items') { var k = kindsFrom(n.t); if (k.length) { s.kinds = k; s.asked = k.map(function (x) { return x.word; }).join(', '); s.items = resolveItems(s.placeId, k); return !!s.items.length; } }
      if (name === 'win') { var w = timeOf(n); if (w == null && /\b(asap|now|soon|earliest|first)\b/.test(n.t)) w = windows(placeById(s.placeId))[0]; if (w != null) { s.win = w; return true; } }
      return false;
    },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] };
      if (s.otherDay) { o.block.push('Mobile orders are for today only, so I can’t schedule a pickup ' + dayPhrase(s.otherDay) + '. Ask me again that day, or order now for pickup today.'); o.offers.push({ label: 'Order for today', value: 'order food', kind: 'action' }, { label: 'Open Food', value: '@go:food' }); return o; }
      if (s.noneOpen && !s.placeId) { o.block.push('None of the mobile-order venues are open right now' + '. Check hours on the Food screen.'); o.offers.push({ label: 'Open Food', value: '@go:food' }); return o; }
      var p = placeById(s.placeId);
      if (!p || !menuFor(p.id)) { o.block.push('I can only place mobile orders at the USC Hospitality venues listed under Food.'); o.offers.push({ label: 'Open Food', value: '@go:food' }); return o; }
      if (!s.items || !s.items.length) { o.block.push('I couldn’t match what you asked for to ' + p.name + '’s sample items.'); return o; }
      if (s.win == null) { o.block.push('**' + p.name + '** has no pickup times left today (' + hoursText(p) + ').'); o.offers.push({ label: 'Other places', value: 'order food' }); return o; }
      if (s.win < nowMin()) o.block.push('That pickup time has already passed.');
      else if (openAt(p, s.win) === false) { o.block.push('**' + p.name + '** isn’t open at ' + fmtMin(s.win) + ' (today: ' + hoursText(p) + ').'); }
      if (!o.block.length) merge(o, chk('placeOrder', p.id, s.items, s.win));
      return o;
    },
    preview: function (s) {
      var p = placeById(s.placeId), tot = totalOf(s.items), url = (TH.MENU_URLS && TH.MENU_URLS[p.id]) || p.url;
      var rows = [['Venue', p.name]];
      s.items.forEach(function (it, i) { rows.push([i ? '' : 'Items', it[1] + '× ' + it[0] + ' — ' + money(it[1] * it[2])]); });
      rows.push(['Total', money(tot)], ['Pickup', 'Today ' + fmtMin(s.win) + '–' + fmtMin(s.win + 10)], ['Pay with', 'Dining Dollars (balance ' + money((D().dining || {}).diningDollars || 0) + ')']);
      var notes = ['When you get there, tap **I’m here** in Mobile Order and they start making it.'];
      if (s.asked && !s.items.some(function (it) { return norm(it[0]).indexOf(norm(s.asked)) >= 0; })) notes.unshift('You asked for **' + s.asked + '**. USC doesn’t publish mobile-order menus, so this prototype orders the closest sample item.');
      return { title: 'Mobile order at ' + p.name, rows: rows, notes: notes, fine: ['Simulated order: nothing is sent to USC Hospitality. Items and prices are samples, not the real menu.'], sources: url ? [{ url: url, title: p.name + ' – USC Hospitality (real menu & hours)' }] : [] };
    },
    run: function (s) { var p = placeById(s.placeId); return receipt(act('placeOrder', p.id, s.items, s.win), 'Order placed at ' + p.name, 'Placed a mobile order at ' + p.name + ' (pickup ' + fmtMin(s.win) + ')'); }
  }, [go('Track my order', 'food'), go('Open My Day', 'plans')]);

  // ---- cancel an order (only orders not yet being made)
  function liveOrders() { return (hub().orders || []).filter(function (o) { return o.state === 'placed'; }); }
  TA.registerHubAction({
    id: 'hub_cancel_order', title: 'Cancel a mobile order', scope: 'dining', icon: 'meal', system: 'Trojan Hub Mobile Order',
    detect: function (n) { if (!isCmd(n)) return 0; return /\b(cancel|call off|scrap)\b.{0,30}\b(food |mobile |coffee |my |the |that )?order\b/.test(n.t) && !/\b(transcript|permit|textbook|book)\b/.test(n.t) ? 0.9 : 0; },
    init: function () { var l = liveOrders(); return { code: l.length === 1 ? l[0].code : null }; },
    next: function (s) { var l = liveOrders(); if (s.code || l.length < 2) return null; return { slot: 'code', md: 'Which order?', options: l.map(function (o) { var p = placeById(o.at) || { name: o.at }; return { label: p.name + ' · pickup ' + fmtMin(o.window), value: '@order:' + o.code }; }) }; },
    fill: function (name, n, s, text) { var m = /@order:(\S+)/.exec(text || ''); if (m) { s.code = m[1]; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }, all = hub().orders || [], ord = all.find(function (x) { return x.code === s.code; });
      if (!liveOrders().length) o.block.push(all.some(function (x) { return x.state === 'preparing' || x.state === 'ready'; }) ? 'Your order is already being made, so it can’t be cancelled here. Ask the staff at the counter.' : 'You don’t have a mobile order to cancel.');
      else if (!ord) o.block.push('I couldn’t find that order.'); else merge(o, chk('cancelOrder', s.code)); return o; },
    preview: function (s) { var ord = (hub().orders || []).find(function (x) { return x.code === s.code; }), p = placeById(ord.at) || { name: ord.at }; return { title: 'Cancel order at ' + p.name, rows: [['Order', ord.code], ['Items', (ord.items || []).map(function (i) { return i[1] + '× ' + i[0]; }).join(', ')], ['Pickup', fmtMin(ord.window)]], fine: [SIM] }; },
    run: function (s) {
      var ord = (hub().orders || []).find(function (x) { return x.code === s.code; }), p = placeById(ord.at) || { name: ord.at };
      if (TH.act && typeof TH.act.cancelOrder === 'function') return receipt(TH.act.cancelOrder(s.code), 'Order cancelled', 'Cancelled mobile order ' + s.code + ' at ' + p.name);
      var list = hub().orders; list.splice(list.indexOf(ord), 1); // no Dining Dollars were taken yet (they are debited at pickup)
      return { title: 'Order cancelled', rows: [['Venue', p.name], ['Order', ord.code]], log: 'Cancelled mobile order ' + ord.code + ' at ' + p.name };
    }
  }, [go('Food', 'food')]);

  // ======================================================================
  // 4) Trojan Pass (return-time reservation) -> TH.act.bookPass(passId, startMin)
  // ======================================================================
  function passes() { return TH.PASSES || []; }
  function passFrom(t) {
    var P = passes(), f = function (id) { return P.find(function (p) { return p.id === id; }) || null; };
    if (/\bracquetball\b/.test(t)) return f('racquetball');
    if (/\b(study room|group room|leavey|its room|collaboration room)\b/.test(t)) return f('room');
    if (/\bwriting( center)?\b/.test(t)) return f('writing');
    if (/\b(career|advising|advisor)\b/.test(t)) return f('career');
    if (/\b(engemann|health|doctor|clinic)\b/.test(t)) return f('health');
    var hit = P.find(function (p) { return t.indexOf(norm(p.name)) >= 0; }); return hit || null;
  }
  // return times on day `off` (0 = today): from now+15 min today, from the venue's opening on later days
  function passStarts(p, off) {
    off = off || 0; var w = placeById(p.where), date = dayDate(off), len = p.len || 60, out = [];
    var m0 = off ? 8 * 60 : ceilTo(nowMin() + 15, 30);
    if (off && w) { var r = rangesOn(w, date); if (r && r.length) m0 = Math.max(m0, ceilTo(Math.min.apply(null, r.map(function (x) { return x[0]; })), 30)); }
    for (var m = m0; m <= 1440 - len && out.length < 4; m += 30) if (!w || (openAt(w, m, date) !== false && openAt(w, m + len - 1, date) !== false)) out.push(m);
    return out;
  }
  // a named day wins; "at 9am" with no day when it's already past 9 means tomorrow (same rule as Zipcar)
  function passDay(n) { var w = timeOf(n), off = dayOffOf(n); if (off == null) off = w != null && w <= nowMin() ? 1 : 0; return { off: off, w: w }; }
  TA.registerHubAction({
    id: 'hub_trojan_pass', title: 'Reserve a Trojan Pass return time', scope: 'campuslife', icon: 'calendar',
    system: 'Trojan Hub Trojan Pass (simulated return times)',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (CANCEL.test(n.t) || /\b(check (me )?in|i am here|im here)\b/.test(n.t)) return 0; // hub_cancel_pass / hub_checkin_pass
      if (/\btrojan pass\b|\breturn (time|window)\b/.test(n.t)) return /\b(book|reserve|get|grab|use|want|need|make)\b/.test(n.t) || n.polite ? 0.93 : 0.82;
      if (/\bracquetball\b/.test(n.t) && /\b(book|reserve|get|grab|court)\b/.test(n.t)) return 0.9;
      return 0;
    },
    // the day the student named ("tomorrow at 10am", "friday 3pm") is kept: TH.act.bookPass(passId, start, day)
    init: function (n) { var p = passFrom(n.t), d = passDay(n); return { passId: p ? p.id : null, day: d.off, start: d.w != null && (d.off > 0 || d.w > nowMin()) ? d.w : null }; },
    next: function (s) {
      if (!s.passId) return { slot: 'passId', md: 'Which Trojan Pass?', options: passes().map(function (p) { var w = placeById(p.where); return { label: p.name, sub: (w ? w.name + ' · ' : '') + (p.len || 60) + ' min', value: '@pass:' + p.id }; }) };
      if (s.start == null) { var p = passes().find(function (x) { return x.id === s.passId; }), st = passStarts(p, s.day); if (!st.length) return null; return { slot: 'start', md: 'What time works? (Return times for **' + dayWord(s.day) + '**.)', options: st.map(function (m) { return { label: fmtMin(m) + '–' + fmtMin(m + (p.len || 60)), value: '@at:' + m }; }), placeholder: 'Or type a time, like “tomorrow 3pm”' }; }
      return null;
    },
    fill: function (name, n, s, text) {
      var m;
      if ((m = /@pass:([\w-]+)/.exec(text || ''))) { s.passId = m[1]; return true; }
      if ((m = /@at:(\d+)/.exec(text || ''))) { s.start = +m[1]; return true; }
      if (name === 'passId') { var p = passFrom(n.t); if (p) { s.passId = p.id; return true; } }
      if (name === 'start') { var d = passDay(n), named = dayOffOf(n); if (named != null) s.day = named; if (d.w != null) { s.start = d.w; return true; } if (named != null) return true; }
      return false;
    },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, p = passes().find(function (x) { return x.id === s.passId; }), off = s.day || 0, date = dayDate(off);
      if (!p) { o.block.push('I couldn’t find that Trojan Pass.'); return o; }
      if (s.start == null) { o.block.push('There are no **' + p.name + '** return times left ' + (off ? 'on ' + dayWord(off) : 'today') + '.'); if (!off) o.offers.push({ label: 'Tomorrow instead', value: 'book a ' + p.name + ' trojan pass tomorrow', kind: 'action' }); return o; }
      if (!off && s.start <= nowMin()) o.block.push('That time has already passed.');
      var w = placeById(p.where); if (w && openAt(w, s.start, date) === false) o.block.push('**' + w.name + '** isn’t open at ' + fmtMin(s.start) + ' (' + dayWord(off) + ': ' + hoursText(w, date) + ').');
      if (!o.block.length) merge(o, chk('bookPass', p.id, s.start, off));
      return o;
    },
    preview: function (s) {
      var p = passes().find(function (x) { return x.id === s.passId; }), w = placeById(p.where);
      return { title: 'Trojan Pass: ' + p.name, rows: [['Pass', p.name], ['Where', w ? w.name : p.where], ['Return time', dayWord(s.day) + ' ' + fmtMin(s.start) + '–' + fmtMin(s.start + (p.len || 60))]], notes: [p.desc].filter(Boolean),
        fine: ['Simulated return time: nothing is booked with USC. Book for real at the link below.'], sources: p.url ? [{ url: p.url, title: p.name + ' – how to book for real' }] : [] };
    },
    run: function (s) { var p = passes().find(function (x) { return x.id === s.passId; }); return receipt(act('bookPass', p.id, s.start, s.day || 0), 'Trojan Pass booked', 'Reserved a Trojan Pass for ' + p.name + ' ' + dayPhrase(s.day) + ' at ' + fmtMin(s.start)); }
  }, [go('My passes', 'pass'), go('Open My Day', 'plans')]);

  // ======================================================================
  // 5) Virtual line -> TH.act.joinLine / leaveLine
  // ======================================================================
  function queues() { return TH.QUEUES || []; }
  function queueFrom(t) {
    var Q = queues(), f = function (id) { return Q.find(function (q) { return q.id === id; }) || null; };
    if (/\b(headshot|iris|photo booth)\b/.test(t)) return f('q-iris');
    if (/\b(financial aid|finaid|fin aid)\b/.test(t)) return f('q-finaid');
    if (/\b(u-?pass|upass|metro card)\b/.test(t)) return f('q-upass');
    if (/\b(career|resume|cover letter)\b/.test(t)) return f('q-career');
    return Q.find(function (q) { return t.indexOf(norm(q.name)) >= 0; }) || null;
  }
  function qOpen(q) { var h = q.hours && q.hours[now().getDay()]; if (!h) return null; var m = nowMin(); return h.some(function (r) { return m >= r[0] && m < r[1]; }); }
  function qHours(q) { var h = q.hours && q.hours[now().getDay()]; return !h ? 'see the office’s page' : !h.length ? 'closed today' : h.map(function (r) { return fmtMin(r[0]) + '–' + fmtMin(r[1]); }).join(', '); }
  function myLines() { return (hub().lines || []).filter(function (l) { return l.state !== 'done'; }); }
  TA.registerHubAction({
    id: 'hub_virtual_line', title: 'Join a virtual line for a walk-in service', scope: 'advising', icon: 'users',
    system: 'Trojan Hub Virtual Line (simulated)',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (/\b(leave|exit|get out of|drop out of|cancel|quit)\b/.test(n.t)) return 0;
      var q = queueFrom(n.t);
      if (/\bvirtual (line|queue)\b/.test(n.t)) return q ? 0.95 : 0.88;
      if (/\b(join|get in|get into|hop in|hop into|put me in|get me in|get me into|add me to|save my (spot|place) in|line up for)\b.{0,40}\b(line|queue|drop-?ins?|walk-?ins?)\b/.test(n.t)) return q ? 0.95 : 0.85;
      return 0;
    },
    init: function (n) { var q = queueFrom(n.t); return { lineId: q ? q.id : null }; },
    next: function (s) { if (s.lineId) return null; return { slot: 'lineId', md: 'Which line?', options: queues().map(function (q) { var w = placeById(q.where); return { label: q.name, sub: (qOpen(q) ? 'Open now' : 'Closed now') + ' · ' + qHours(q) + (w ? ' · ' + w.name : ''), value: '@line:' + q.id }; }) }; },
    fill: function (name, n, s, text) { var m = /@line:([\w-]+)/.exec(text || ''), q = m ? queues().find(function (x) { return x.id === m[1]; }) : queueFrom(n.t); if (q) { s.lineId = q.id; return true; } return false; },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, q = queues().find(function (x) { return x.id === s.lineId; });
      if (!q) { o.block.push('I couldn’t find that line.'); return o; }
      if (myLines().some(function (l) { return l.id === q.id; })) { o.block.push('You’re already in the **' + q.name + '** line.'); o.offers.push({ label: 'See my place', value: '@go:queue' }); return o; }
      if (qOpen(q) === false) o.block.push('**' + q.name + '** isn’t taking walk-ins right now (today: ' + qHours(q) + ').');
      if (!o.block.length) merge(o, chk('joinLine', q.id));
      return o;
    },
    preview: function (s) {
      var q = queues().find(function (x) { return x.id === s.lineId; }), w = placeById(q.where), est = q.base != null && q.per != null ? Math.round((q.base + 1) * q.per) : null;
      return { title: 'Join the line: ' + q.name, rows: [['Line', q.name], ['Where', w ? w.name : q.where], ['Hours today', qHours(q)]].concat(est != null ? [['Est. wait', '~' + est + ' min (estimate; USC publishes no live wait)']] : []),
        notes: [q.desc, 'I’ll alert you in Trojan Hub when it’s your turn to walk over.'].filter(Boolean), fine: ['Simulated virtual line: the real service is first-come, first-served in person.'], sources: q.url ? [{ url: q.url, title: q.name }] : [] };
    },
    run: function (s) { var q = queues().find(function (x) { return x.id === s.lineId; }); return receipt(act('joinLine', q.id), 'You’re in line', 'Joined the virtual line for ' + q.name); }
  }, [go('See my place in line', 'queue')]);

  TA.registerHubAction({
    id: 'hub_leave_line', title: 'Leave a virtual line', scope: 'advising', icon: 'users', system: 'Trojan Hub Virtual Line (simulated)',
    detect: function (n) { if (!isCmd(n)) return 0; return /\b(leave|exit|get out of|drop out of|cancel|quit|remove me from)\b.{0,30}\b(line|queue|virtual line|spot in line)\b/.test(n.t) && !/\b(deadline|online)\b/.test(n.t) ? 0.9 : 0; },
    init: function (n) { var q = queueFrom(n.t), mine = myLines(); return { lineId: q && mine.some(function (l) { return l.id === q.id; }) ? q.id : mine.length === 1 ? mine[0].id : null }; },
    next: function (s) { var mine = myLines(); if (s.lineId || mine.length < 2) return null; return { slot: 'lineId', md: 'Which line should I take you out of?', options: mine.map(function (l) { var q = queues().find(function (x) { return x.id === l.id; }) || { name: l.id }; return { label: q.name, value: '@line:' + l.id }; }) }; },
    fill: function (name, n, s, text) { var m = /@line:([\w-]+)/.exec(text || ''); if (m) { s.lineId = m[1]; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!myLines().length) o.block.push('You’re not in any virtual line right now.'); else if (!s.lineId) o.block.push('I couldn’t tell which line you meant.'); else merge(o, chk('leaveLine', s.lineId)); return o; },
    preview: function (s) { var q = queues().find(function (x) { return x.id === s.lineId; }) || { name: s.lineId }; return { title: 'Leave the line: ' + q.name, rows: [['Line', q.name]], fine: [SIM] }; },
    run: function (s) { var q = queues().find(function (x) { return x.id === s.lineId; }) || { name: s.lineId }; return receipt(act('leaveLine', s.lineId), 'Left the line', 'Left the virtual line for ' + q.name); }
  }, [go('Virtual lines', 'queue')]);

  // ======================================================================
  // 6) Free USC Lyft -> TH.act.requestLyft(toLabel, fromLabel)   (real hours from TH.TRANSPORT.lyft)
  // ======================================================================
  function lyft() { return (TH.TRANSPORT && TH.TRANSPORT.lyft) || {}; }
  function lyftOpen() { // hours: 7 arrays of [open, close>1440 past midnight]
    if (TH.lyftOpen) { try { return TH.lyftOpen(now()); } catch (e) { /* fall through */ } }
    var L2 = lyft(), H = L2.hours, d = now(), m = nowMin(); if (!H) return null;
    var today = H[d.getDay()] || [], yday = H[(d.getDay() + 6) % 7] || [];
    return today.some(function (r) { return m >= r[0] && m < r[1]; }) || yday.some(function (r) { return r[1] > 1440 && m + 1440 < r[1]; });
  }
  TA.lyftOpen = lyftOpen;
  function homeLabel() { return (TH.HOME && (TH.HOME.label || TH.HOME.name)) || 'Home'; }
  function rideActive() { var r = hub().ride; return r && r.state !== 'done' ? r : null; }
  function destFrom(n) {
    if (/\b(home|my dorm|my room|my place|my apartment|my building|back to (the )?village|cowlings|ilium)\b/.test(n.t)) return { to: homeLabel(), home: true };
    var m = /\b(?:to|at)\s+(?:the\s+)?(.{3,60}?)(?:\s+(?:please|now|tonight|asap))?[.!?]*$/i.exec(n.raw || ''); if (!m) return null;
    var p = bestPlace(m[1], null, 0.6); if (p) return { to: p.name, placeId: p.id };
    return /lyft|ride/i.test(m[1]) ? null : { to: m[1].trim() };
  }
  TA.registerHubAction({
    id: 'hub_request_lyft', title: 'Request a free USC Lyft ride', scope: 'transportation', icon: 'car',
    system: 'USC Lyft Rides Program (via Trojan Hub, simulated)',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (/\b(cancel|end|stop)\b.{0,20}\b(lyft|ride)\b/.test(n.t)) return 0;
      var verb = /\b(get|call|request|order|book|need|want|send|grab|hail|take)\b/.test(n.t) || n.polite;
      if (/\blyfts?\b/.test(n.t) && verb) return 0.93;
      if (/\b(free ride|ride (home|back)|safe ride)\b/.test(n.t) && verb) return 0.88;
      return 0;
    },
    init: function (n) { var d = destFrom(n) || {}; return { to: d.to || null, placeId: d.placeId || null, home: !!d.home }; },
    next: function (s) { if (s.to) return null; return { slot: 'to', md: 'Where to? (Rides must start and end inside the USC Lyft boundary.)', options: [{ label: 'Home · ' + (TH.HOME && TH.HOME.name ? TH.HOME.name : 'my housing'), value: 'home' }], placeholder: 'Or type a destination' }; },
    fill: function (name, n, s, text) { var d = destFrom(n); if (!d && text && text.trim().length >= 3) { var p = bestPlace(text, null, 0.6); d = p ? { to: p.name, placeId: p.id } : { to: text.trim() }; } if (d) { s.to = d.to; s.placeId = d.placeId || null; s.home = !!d.home; return true; } return false; },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, L2 = lyft();
      var r = rideActive(); if (r) { o.block.push('You already have a Lyft on the way' + (r.to ? ' to ' + r.to : '') + '.'); o.offers.push({ label: 'See my ride', value: '@go:rides' }); return o; }
      if (lyftOpen() === false) {
        o.block.push('USC’s free Lyft runs **' + (L2.hoursText || '7 PM – 2 AM') + '**, and it’s ' + fmtMin(nowMin()) + ' now, so I can’t request one.' + (L2.afterHours ? ' ' + L2.afterHours : ''));
        o.offers.push({ label: 'Safe walking route', value: '@go:safety' }, { label: 'Next USC buses', value: '@go:rides' });
        return o;
      }
      if (!s.home && !s.placeId) o.warn.push('I can’t check that address against the boundary. ' + ((L2.boundary && L2.boundary.text) || ''));
      merge(o, chk('requestLyft', s.to, (TH.ME && TH.ME.label) || 'Your location'));
      return o;
    },
    preview: function (s) {
      var L2 = lyft();
      return { title: 'Request a free USC Lyft', rows: [['From', (TH.ME && TH.ME.label) || 'Your location'], ['To', s.to], ['Service', (L2.name || 'USC Lyft Rides Program') + ' · Shared'], ['Hours', L2.hoursText || ''], ['Cost', L2.cost || 'Free if the ride qualifies']],
        notes: TH.act && TH.act.check && TH.act.check.requestLyft ? [] : [(L2.boundary && L2.boundary.text) || null, (L2.rules || [])[0] || null].filter(Boolean),
        fine: ['Simulated: no Lyft is requested. For a real ride, use the Lyft app with the “USC Lyft Rides” payment method.'], sources: L2.url ? [{ url: L2.url, title: 'USC Lyft Rides Program – USC Transportation' }] : [] };
    },
    run: function (s) { return receipt(act('requestLyft', s.to, (TH.ME && TH.ME.label) || 'Your location'), 'Lyft requested', 'Requested a free USC Lyft to ' + s.to); }
  }, [go('Track my ride', 'rides')]);

  TA.registerHubAction({
    id: 'hub_cancel_ride', title: 'Cancel my USC Lyft ride', scope: 'transportation', icon: 'car', system: 'USC Lyft Rides Program (via Trojan Hub, simulated)',
    detect: function (n) { if (!isCmd(n)) return 0; return /\b(cancel|end|stop|call off)\b.{0,20}\b(my |the |that )?(lyft|ride)\b/.test(n.t) ? 0.9 : 0; },
    init: function () { return {}; }, next: function () { return null; }, fill: function () { return false; },
    check: function () { var o = { block: [], warn: [], offers: [] }; if (!rideActive()) o.block.push('You don’t have a Lyft ride in progress.'); else merge(o, chk('endRide')); return o; },
    preview: function () { var r = rideActive(); return { title: 'Cancel your Lyft', rows: [['Ride', 'To ' + (r.to || '—')], ['Status', r.state]], notes: [((lyft().rules || []).find(function (x) { return /cancel/i.test(x); })) || null].filter(Boolean), fine: [SIM] }; },
    run: function () { return receipt(act('endRide'), 'Ride cancelled', 'Cancelled the USC Lyft ride'); }
  }, [go('Getting around', 'rides')]);

  // ======================================================================
  // 7) Zipcar -> TH.act.reserveZip(startMin, hours)   (USC lists no Zipcar locations or cars)
  // ======================================================================
  // the day the student named ("tomorrow", "friday", "Nov 12") as an offset from today (0..14), or null
  function dayOffOf(n) {
    var d = n.dates && n.dates[0]; if (!d) return /\b(today|tonight|this (afternoon|evening|morning))\b/.test(n.t) ? 0 : null;
    var x = new Date(d), t = now(), a = new Date(x.getFullYear(), x.getMonth(), x.getDate()), b2 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var off = Math.round((a - b2) / 864e5); return off >= 0 ? off : null;
  }
  function dayPhrase(off) { return !off ? 'today' : off === 1 ? 'tomorrow' : 'on ' + dayWord(off); }
  function dayDate(off) { var t = now(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + (off || 0)); }
  function dayWord(off) { return !off ? 'Today' : off === 1 ? 'Tomorrow' : LA_DAY.format(new Date(Date.UTC(dayDate(off).getFullYear(), dayDate(off).getMonth(), dayDate(off).getDate(), 20))); }
  function zipStarts(off) { var m0 = off ? 8 * 60 : ceilTo(nowMin() + 30, 30), out = []; for (var m = m0; m < 1440 && out.length < 4; m += off ? 120 : 60) out.push(m); return out; }
  TA.registerHubAction({
    id: 'hub_reserve_zipcar', title: 'Reserve a Zipcar', scope: 'transportation', icon: 'car',
    system: 'Zipcar for USC (via Trojan Hub, simulated)',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (/\b(cancel|remove|delete|drop|call off|scrap|undo)\b/.test(n.t)) return 0; // hub_cancel_zipcar
      // any verb ("order me a zipcar", "get", "book", "rent"...): "zipcar" alone must beat TA's order-textbooks process
      if (/\bzip ?cars?\b/.test(n.t) && (/\b(reserve|book|get|rent|need|want|grab|order|schedule|borrow|find|set up|line up)\b/.test(n.t) || n.polite)) return 0.97;
      if (/\b(rent|reserve|book|order|get) (me |us )?a (car|rental car)\b/.test(n.t)) return 0.86;
      return 0;
    },
    init: function (n) {
      var w = timeOf(n), off = dayOffOf(n), h = n.durationMin ? Math.max(1, Math.min(12, Math.round(n.durationMin / 60))) : null;
      if (off == null) off = w != null && w <= nowMin() ? 1 : 0; // "at 9am" when it's already noon = tomorrow
      return { day: off, start: w != null && (off > 0 || w > nowMin()) ? w : null, hours: h };
    },
    next: function (s) {
      if (s.start == null) { var st = zipStarts(s.day); if (!st.length) return null; return { slot: 'start', md: 'When do you need the car? (' + dayWord(s.day) + ')', options: st.map(function (m) { return { label: fmtMin(m), value: '@at:' + m }; }), placeholder: 'Or type a time, like “tomorrow 10am”' }; }
      if (!s.hours) return { slot: 'hours', md: 'For how long?', options: [1, 2, 3, 4].map(function (h) { return { label: TA.plural(h, 'hour'), value: h + ' hours' }; }) };
      return null;
    },
    fill: function (name, n, s, text) {
      var m = /@at:(\d+)/.exec(text || ''); if (m) { s.start = +m[1]; return true; }
      if (name === 'start') { var w = timeOf(n), off = dayOffOf(n); if (off != null) s.day = off; if (w != null) { s.start = w; return true; } if (off != null) return true; }
      if (name === 'hours') { var h = n.durationMin ? Math.round(n.durationMin / 60) : (/^(\d{1,2})$/.exec(n.t.trim()) || [])[1]; if (h) { s.hours = Math.max(1, Math.min(12, +h)); return true; } }
      return false;
    },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (s.start == null) { o.block.push('It’s too late to start a Zipcar reservation today in this demo. Try “tomorrow at 10am”.'); return o; } if (!s.day && s.start <= nowMin()) o.block.push('That start time has already passed.'); if (!o.block.length) merge(o, chk('reserveZip', s.start, s.hours, s.day || 0)); return o; },
    preview: function (s) {
      var Z = (TH.TRANSPORT && TH.TRANSPORT.zipcar) || {}, dw = dayWord(s.day);
      return { title: 'Reserve a Zipcar', rows: [['Car', 'Zipcar at USC (USC doesn’t list locations or cars)'], ['Start', dw + ' ' + fmtMin(s.start)], ['Length', TA.plural(s.hours, 'hour')], ['Return', fmtMin(s.start + s.hours * 60) + ', same spot']],
        notes: [Z.text || null].filter(Boolean), fine: ['Simulated: nothing is reserved with Zipcar. Reserve for real in the Zipcar app.'], sources: Z.url ? [{ url: Z.url, title: 'Zipcar – USC Transportation' }] : [] };
    },
    run: function (s) { return receipt(act('reserveZip', s.start, s.hours, s.day || 0), 'Zipcar reserved', 'Reserved a Zipcar ' + dayPhrase(s.day) + ' at ' + fmtMin(s.start) + ' for ' + TA.plural(s.hours, 'hour')); }
  }, [go('Getting around', 'rides'), go('Open My Day', 'plans')]);

  // ======================================================================
  // 8) Metro U-Pass -> TH.act.enrollUpass(delivery)
  // ======================================================================
  var UPASS_OPTS = [ // values match TH.act.enrollUpass(delivery)
    { label: 'I need a card (pick up at USC Transportation)', value: 'pickup', text: 'Pick up a physical card at USC Transportation, McCarthy Way Structure (Mon–Fri 8:30 AM–3 PM)' },
    { label: 'I already have a USC U-Pass card (renewal)', value: 'have-card', text: 'Renewal: keep using your current USC U-Pass card' }
  ];
  TA.registerHubAction({
    id: 'hub_upass', title: 'Sign up for the Metro U-Pass', scope: 'transportation', icon: 'card',
    system: 'USC Transportation U-Pass form (via Trojan Hub, simulated)',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (/\bactivat\w*\b/.test(n.t)) return 0; // hub_activate_upass
      if (/\b(u-?pass|upass|u pass|metro pass|transit pass|tap card)\b/.test(n.t) && (/\b(enroll|sign me up|sign up|get|apply|register|renew|order|request|want|need)\b/.test(n.t) || n.polite)) return 0.92;
      return 0;
    },
    init: function (n) { return { delivery: /\b(renew|renewal|already have|have (a|my) card)\b/.test(n.t) ? 'have-card' : null }; },
    next: function (s) { if (s.delivery) return null; return { slot: 'delivery', md: 'The U-Pass needs a **physical card issued by USC**. Do you already have one?', options: UPASS_OPTS.map(function (o) { return { label: o.label, value: o.value }; }) }; },
    fill: function (name, n, s, text) { var v = UPASS_OPTS.find(function (o) { return o.value === String(text || '').trim(); }); if (!v) v = /\b(renew|already|have one|have a card|yes)\b/.test(n.t) ? UPASS_OPTS[1] : /\b(pick ?up|upc|need|no)\b/.test(n.t) ? UPASS_OPTS[0] : null; if (v) { s.delivery = v.value; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }, u = hub().upass; if (u) { o.block.push('You’re already signed up for the Metro U-Pass (status: ' + (u.status === 'active' ? 'active' : 'waiting for activation') + ').'); o.offers.push({ label: 'Open Wallet', value: '@go:wallet' }); return o; } merge(o, chk('enrollUpass', s.delivery)); return o; },
    preview: function (s) {
      var U = (TH.TRANSPORT && TH.TRANSPORT.upass) || {}, opt = UPASS_OPTS.find(function (o) { return o.value === s.delivery; }) || UPASS_OPTS[0];
      return { title: 'Sign up for the Metro U-Pass', rows: [['Program', U.name || 'Metro U-Pass'], ['Cost', U.cost || ''], ['Eligibility', U.eligibility || ''], ['Card', opt.text], ['Term', 'Fall 2026 (re-register every semester)']],
        steps: U.steps || [], notes: [U.commonFailure || null].filter(Boolean), fine: ['Simulated sign-up: nothing is sent to USC Transportation or LA Metro. Sign up for real on the U-Pass page.'], sources: U.url ? [{ url: U.url, title: 'Student U-Pass – USC Transportation' }] : [] };
    },
    run: function (s) { return receipt(act('enrollUpass', s.delivery), 'U-Pass sign-up sent', 'Signed up for the Metro U-Pass (' + s.delivery + ')'); }
  }, [go('Open Wallet', 'wallet'), go('U-Pass steps', 'upass')]);

  // ======================================================================
  // 9) Save my parking spot -> TH.act.saveParking(placeId, level)   (strict: never "parking permit")
  // ======================================================================
  function structures() { var ids = (TH.TRANSPORT && TH.TRANSPORT.parking && TH.TRANSPORT.parking.structures) || []; return ids.map(placeById).filter(Boolean); }
  function structFrom(t) {
    var S2 = structures(), key = [['mccarthy', 'p-mccarthy'], ['downey', 'p-downey'], ['jefferson', 'p-jefferson'], ['royal', 'p-royal'], ['shrine', 'p-shrine'], ['grand', 'p-grand'], ['village', 'p-village'], ['psx', 'p-mccarthy'], ['psa', 'p-downey']];
    for (var i = 0; i < key.length; i++) if (new RegExp('\\b' + key[i][0] + '\\b').test(t)) { var p = S2.find(function (x) { return x.id === key[i][1]; }); if (p) return p; }
    return bestPlace(t, function (p) { return S2.indexOf(p) >= 0; }, 0.6);
  }
  function levelFrom(t) { var m = /\b(?:level|floor|lvl|deck)\s?([a-z]?\d{1,2}|[a-z]{1,2})\b/.exec(t) || /\b(p\d{1,2}|b\d)\b/.exec(t) || /\b(roof(top)?)\b/.exec(t) || /\b(\d{1,2})(?:st|nd|rd|th) floor\b/.exec(t); return m ? m[1].toUpperCase().replace('ROOFTOP', 'Roof').replace('ROOF', 'Roof') : null; }
  TA.registerHubAction({
    id: 'hub_save_parking', title: 'Save where I parked', scope: 'transportation', icon: 'car', system: 'Trojan Hub parking reminder',
    detect: function (n) {
      if (!isCmd(n)) return 0;
      if (/\b(permit|citation|ticket|fine|pay|rates?|cost|price)\b/.test(n.t)) return 0;
      if (/\b(i (just )?parked|save (my )?(parking|parking spot|spot|car|car location)|remember (where i parked|my (parking|spot|car))|mark (my )?(parking|car|spot)|i left my car|note (where|my) (i parked|parking|car))\b/.test(n.t)) return 0.92;
      return 0;
    },
    init: function (n) { var p = structFrom(n.t); return { placeId: p ? p.id : null, level: levelFrom(n.t) }; },
    next: function (s) { if (s.placeId) return null; return { slot: 'placeId', md: 'Which structure?', options: structures().map(function (p) { return { label: p.name, value: '@place:' + p.id }; }) }; },
    fill: function (name, n, s, text) { var m = /@place:([\w-]+)/.exec(text || ''), p = m ? placeById(m[1]) : structFrom(n.t); if (p) { s.placeId = p.id; if (!s.level) s.level = levelFrom(n.t); return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!placeById(s.placeId)) o.block.push('I couldn’t find that parking structure.'); else merge(o, chk('saveParking', s.placeId, s.level)); return o; },
    preview: function (s) { var p = placeById(s.placeId), P2 = (TH.TRANSPORT && TH.TRANSPORT.parking) || {}; return { title: 'Save your parking spot', rows: [['Where', p.name], ['Level', s.level || 'Not noted'], ['Saved at', fmtMin(nowMin()) + ' today']], notes: ['I’ll show it on the map so you can walk back to it.'], fine: ['Saved only in this app.'], sources: P2.url ? [{ url: P2.url, title: 'Daily & hourly parking – USC Transportation' }] : [] }; },
    run: function (s) { var p = placeById(s.placeId); return receipt(act('saveParking', s.placeId, s.level || null), 'Parking spot saved', 'Saved parking at ' + p.name + (s.level ? ', level ' + s.level : '')); }
  });
  NEXT.hub_save_parking = function () { var pk = hub().parking; return [pk && pk.at ? go('Walk back to my car', 'walk', pk.at) : go('Map', 'map'), go('Getting around', 'rides')]; };

  // ======================================================================
  // 10) Undo-style Hub actions: cancel a Zipcar, un-RSVP, cancel/check in a Trojan Pass, "I'm here" / picked up,
  //     clear the saved parking spot, activate the U-Pass. Each calls the matching TH.act.* with its check().
  // ======================================================================
  var CANCEL = /\b(cancel|remove|delete|drop|call off|scrap|undo|get rid of|unbook|unreserve)\b/;
  function todayKey() { return dkey(now()); }
  function dayOfKey(k) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : now(); }
  function offOfKey(k) { var a = dayOfKey(k), t = now(); return Math.round((a - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); }
  function keyWord(k) { return dayWord(offOfKey(k)); }
  // narrow a list of {day:'YYYY-MM-DD'} items by a day the student named ("cancel my zipcar tomorrow")
  function byNamedDay(list, n) { var off = dayOffOf(n); if (off == null) return list; var k = dkey(dayDate(off)), f = list.filter(function (x) { return x.day === k; }); return f.length ? f : list; }

  // ---- cancel a Zipcar -> TH.act.cancelZip(id)
  function myZips() { var k = todayKey(), m = nowMin(); return (hub().zips || []).filter(function (z) { return z.day > k || (z.day === k && z.start + z.hours * 60 > m); }).sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.start - b.start; }); }
  function zipLabel(z) { return keyWord(z.day) + ' ' + fmtMin(z.start) + '–' + fmtMin(z.start + z.hours * 60); }
  TA.registerHubAction({
    id: 'hub_cancel_zipcar', title: 'Cancel a Zipcar reservation', scope: 'transportation', icon: 'car', system: 'Zipcar for USC (via Trojan Hub, simulated)',
    detect: function (n) { if (!isCmd(n)) return 0; return CANCEL.test(n.t) && /\bzip ?cars?\b|\b(car|rental car) (reservation|booking)\b/.test(n.t) ? 0.96 : 0; },
    init: function (n) { var l = byNamedDay(myZips(), n); return { id: l.length === 1 ? l[0].id : null }; },
    next: function (s) { var l = myZips(); if (s.id || l.length < 2) return null; return { slot: 'id', md: 'Which Zipcar reservation?', options: l.map(function (z) { return { label: zipLabel(z), value: '@zip:' + z.id }; }) }; },
    fill: function (name, n, s, text) { var m = /@zip:([\w-]+)/.exec(text || ''); if (m) { s.id = m[1]; return true; } var l = byNamedDay(myZips(), n); if (l.length === 1 && dayOffOf(n) != null) { s.id = l[0].id; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!myZips().length) { o.block.push('You don’t have an upcoming Zipcar reservation.'); o.offers.push({ label: 'Reserve a Zipcar', value: 'reserve a zipcar', kind: 'action' }); return o; } if (!s.id) { o.block.push('I couldn’t tell which reservation you meant.'); return o; } merge(o, chk('cancelZip', s.id)); return o; },
    preview: function (s) { var z = (hub().zips || []).find(function (x) { return x.id === s.id; }); return { title: 'Cancel your Zipcar', rows: [['Car', 'Zipcar at USC'], ['When', zipLabel(z)], ['Length', TA.plural(z.hours, 'hour')]], fine: ['Simulated: nothing is changed with Zipcar. Cancel a real reservation in the Zipcar app.'] }; },
    run: function (s) { var z = (hub().zips || []).find(function (x) { return x.id === s.id; }), lab = z ? zipLabel(z) : ''; return receipt(act('cancelZip', s.id), 'Zipcar canceled', 'Canceled the Zipcar reservation (' + lab + ')'); }
  }, [go('Getting around', 'rides'), go('Open My Day', 'plans')]);

  // ---- un-RSVP / remove an event from My Day -> TH.act.unsaveEvent(eventId)
  var UNSAVE = /\b(unsave|un ?rsvp|unrsvp|cancel (my |the )?rsvp|withdraw (my )?rsvp|(remove|delete|drop|take|clear) .{2,90} (from|off|out of) my (calendar|day|schedule|plans|agenda)|(i am|im) not going to|(cant|can not|cannot|wont|will not) make it to|no longer going to|not attending)\b/;
  function myCal() { var t = now(); return (hub().calendar || []).filter(function (x) { return wall(x.end || x.start) >= t; }).sort(function (a, b) { return wall(a.start) - wall(b.start); }); }
  function calMatch(text) {
    var m = /@ev:(\d+)/.exec(text || ''); if (m) return myCal().find(function (x) { return String(x.ref) === m[1]; }) || null;
    var t = ' ' + norm(text) + ' ', words = norm(text).split(' '), best = null, bestSc = 0;
    myCal().forEach(function (x) {
      var nm = norm(x.title), sc = 0; if (nm.length >= 4 && t.indexOf(' ' + nm + ' ') >= 0) sc = 2;
      else { var tw = toks(x.title).filter(function (w) { return w.length >= 3; }); if (tw.length) { var hit = tw.filter(function (w) { return words.some(function (y) { return y === w || lev1(y, w); }); }).length; if (hit && (hit / tw.length >= 0.5 || hit >= 2)) sc = hit / tw.length; } }
      if (sc > bestSc) { best = x; bestSc = sc; }
    });
    return best;
  }
  TA.registerHubAction({
    id: 'hub_unsave_event', title: 'Remove an event from My Day (cancel RSVP)', scope: 'campuslife', icon: 'calendar', system: 'EngageSC + Trojan Hub calendar',
    detect: function (n) { if (!isCmd(n) && !/\b(i am|im) not going\b/.test(n.t)) return 0; if (!UNSAVE.test(n.t)) return 0; if (/\b(class|course|section|appointment|zipcar|trojan pass|order)\b/.test(n.t)) return 0; return calMatch(n.raw) ? 0.96 : 0.9; },
    init: function (n) { var x = calMatch(n.raw); return { ref: x ? x.ref : null }; },
    next: function (s) { var l = myCal(); if (s.ref || !l.length) return null; return { slot: 'ref', md: 'Which event should I take off your calendar?', options: l.slice(0, 8).map(function (x) { var e = eventById(x.ref); return { label: x.title, sub: (e ? when(e) : '') + (x.kind === 'club' ? ' · from ' + (x.org || 'a club you joined') : ''), value: '@ev:' + x.ref }; }) }; },
    fill: function (name, n, s, text) { var x = calMatch(text); if (x) { s.ref = x.ref; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!myCal().length) { o.block.push('There are no upcoming events on your Trojan Hub calendar.'); o.offers.push({ label: 'Browse events', value: '@go:events' }); return o; } if (!s.ref) { o.block.push('I couldn’t find that event on your calendar.'); o.offers.push({ label: 'Open My Day', value: '@go:plans' }); return o; } merge(o, chk('unsaveEvent', s.ref)); return o; },
    preview: function (s) { var x = myCal().find(function (y) { return String(y.ref) === String(s.ref); }) || {}, e = eventById(s.ref);
      return { title: 'Remove from My Day', rows: [['Event', x.title || (e && e.title) || '—'], ['When', e ? when(e) : '—']].concat(x.org ? [['Host', x.org]] : []), notes: x.kind === 'club' ? ['This came from your ' + (x.org || 'club') + ' membership. You stay in the club; only this event is removed.'] : [], fine: ['Simulated: nothing is sent to EngageSC. If you RSVP’d for real, cancel on the event page.'], sources: e && e.url ? [{ url: e.url, title: e.title + ' – EngageSC' }] : [] }; },
    run: function (s) { var x = myCal().find(function (y) { return String(y.ref) === String(s.ref); }) || {}; return receipt(act('unsaveEvent', s.ref), 'Removed from My Day', 'Removed ' + (x.title || 'an event') + ' from My Day (canceled RSVP)'); }
  }, [go('Open My Day', 'plans'), go('More events', 'events')]);

  // ---- Trojan Pass: cancel / check in -> TH.act.cancelPass(bid) / checkInPass(bid)
  function passDef(id) { return passes().find(function (p) { return p.id === id; }) || { name: id, len: 60 }; }
  function myPasses() { var k = todayKey(), m = nowMin(); return (hub().passes || []).filter(function (b) { return !b.checked && (b.day > k || (b.day === k && b.start + (passDef(b.id).len || 60) > m)); }).sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.start - b.start; }); }
  function passLabel(b) { var d = passDef(b.id); return d.name + ' · ' + keyWord(b.day) + ' ' + fmtMin(b.start) + '–' + fmtMin(b.start + (d.len || 60)); }
  function passPick(n, list) { var p = passFrom(n.t); if (p) list = list.filter(function (b) { return b.id === p.id; }); return byNamedDay(list, n); }
  function aboutMyPass(n) { var p = passFrom(n.t); return /\btrojan pass(es)?\b|\breturn time\b/.test(n.t) || (p && (hub().passes || []).some(function (b) { return b.id === p.id; })); }
  TA.registerHubAction({
    id: 'hub_cancel_pass', title: 'Cancel a Trojan Pass return time', scope: 'campuslife', icon: 'calendar', system: 'Trojan Hub Trojan Pass (simulated return times)',
    detect: function (n) { if (!isCmd(n)) return 0; return CANCEL.test(n.t) && (aboutMyPass(n) || /\bracquetball\b/.test(n.t)) ? 0.97 : 0; }, // above TA's cancel_appt (0.95)
    init: function (n) { var l = passPick(n, myPasses()); return { bid: l.length === 1 ? l[0].bid : null }; },
    next: function (s) { var l = myPasses(); if (s.bid || l.length < 2) return null; return { slot: 'bid', md: 'Which Trojan Pass should I cancel?', options: l.map(function (b) { return { label: passLabel(b), value: '@bid:' + b.bid }; }) }; },
    fill: function (name, n, s, text) { var m = /@bid:([\w-]+)/.exec(text || ''); if (m) { s.bid = m[1]; return true; } var l = passPick(n, myPasses()); if (l.length === 1) { s.bid = l[0].bid; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!myPasses().length) { o.block.push('You don’t have an upcoming Trojan Pass to cancel.'); o.offers.push({ label: 'My passes', value: '@go:pass' }); return o; } if (!s.bid) { o.block.push('I couldn’t tell which Trojan Pass you meant.'); return o; } merge(o, chk('cancelPass', s.bid)); return o; },
    preview: function (s) { var b = (hub().passes || []).find(function (x) { return x.bid === s.bid; }), d = passDef(b.id), w = placeById(d.where); return { title: 'Cancel Trojan Pass', rows: [['Pass', d.name], ['Where', w ? w.name : (d.where || '—')], ['Return time', keyWord(b.day) + ' ' + fmtMin(b.start) + '–' + fmtMin(b.start + (d.len || 60))]], fine: [SIM] }; },
    run: function (s) { var b = (hub().passes || []).find(function (x) { return x.bid === s.bid; }), lab = b ? passLabel(b) : 'Trojan Pass'; return receipt(act('cancelPass', s.bid), 'Trojan Pass canceled', 'Canceled ' + lab); }
  }, [go('My passes', 'pass'), go('Open My Day', 'plans')]);

  function todayPasses() { var k = todayKey(); return (hub().passes || []).filter(function (b) { return !b.checked && b.day === k; }); }
  TA.registerHubAction({
    id: 'hub_checkin_pass', title: 'Check in for a Trojan Pass', scope: 'campuslife', icon: 'calendar', system: 'Trojan Hub Trojan Pass (simulated return times)',
    detect: function (n) { if (!/\b(check (me )?in|i am here|im here|i have arrived|i arrived|i am at|im at)\b/.test(n.t)) return 0; if (/\border\b/.test(n.t)) return 0; return aboutMyPass(n) ? 0.95 : 0; },
    init: function (n) { var l = passPick(n, todayPasses()); return { bid: l.length === 1 ? l[0].bid : null }; },
    next: function (s) { var l = todayPasses(); if (s.bid || l.length < 2) return null; return { slot: 'bid', md: 'Which pass are you checking in for?', options: l.map(function (b) { return { label: passLabel(b), value: '@bid:' + b.bid }; }) }; },
    fill: function (name, n, s, text) { var m = /@bid:([\w-]+)/.exec(text || ''); if (m) { s.bid = m[1]; return true; } return false; },
    check: function (s) { var o = { block: [], warn: [], offers: [] }; if (!todayPasses().length) { o.block.push('You don’t have a Trojan Pass to check in for today.'); o.offers.push({ label: 'My passes', value: '@go:pass' }); return o; } if (!s.bid) { o.block.push('I couldn’t tell which pass you meant.'); return o; } merge(o, chk('checkInPass', s.bid)); return o; },
    preview: function (s) { var b = (hub().passes || []).find(function (x) { return x.bid === s.bid; }), d = passDef(b.id); return { title: 'Check in: ' + d.name, rows: [['Pass', d.name], ['Return time', fmtMin(b.start) + '–' + fmtMin(b.start + (d.len || 60))]], fine: [SIM] }; },
    run: function (s) { var b = (hub().passes || []).find(function (x) { return x.bid === s.bid; }), d = passDef(b.id); return receipt(act('checkInPass', s.bid), 'Checked in', 'Checked in for ' + d.name); }
  }, [go('My passes', 'pass')]);

  // ---- mobile order: "I'm here" / picked up -> TH.act.orderHere(code) / orderPicked(code)
  function ordersIn(states) { var k = todayKey(); return (hub().orders || []).filter(function (o) { return o.day === k && states.indexOf(o.state) >= 0; }); }
  function orderLabel(o) { var p = placeById(o.at) || { name: o.at }; return p.name + ' · pickup ' + fmtMin(o.window) + ' · #' + o.code; }
  function orderPick(n, list) { var v = bestPlace(n.raw, function (p) { return list.some(function (o) { return o.at === p.id; }); }, 0.6); return v ? list.filter(function (o) { return o.at === v.id; }) : list; }
  var PICKED = /\b(picked up|got|grabbed|collected|received|have) (my |the |our )?(order|food|coffee|drink|meal|lunch)\b|\bpicked (it|my order) up\b/;
  TA.registerHubAction({
    id: 'hub_order_here', title: 'Mobile order: I’m here / picked up', scope: 'dining', icon: 'meal', system: 'Trojan Hub Mobile Order',
    detect: function (n) {
      var here = /\b(i am here|im here|i have arrived|i arrived|i am at|im at|i just got to|check (me )?in)\b/.test(n.t), bare = /^(ok |okay )?(i am|im) here( now)?$/.test(n.t);
      if (PICKED.test(n.t) && (hub().orders || []).length) return 0.93;
      if (here && (/\b(order|pickup|pick up|food|coffee)\b/.test(n.t) || (bare && ordersIn(['placed']).length && !todayPasses().length))) return 0.95;
      if (here && ordersIn(['placed']).some(function (o) { var p = placeById(o.at); return p && bestPlace(n.raw, function (x) { return x.id === p.id; }, 0.6); })) return 0.94;
      return 0;
    },
    init: function (n) { var mode = PICKED.test(n.t) ? 'picked' : 'here', l = orderPick(n, ordersIn(mode === 'here' ? ['placed'] : ['ready', 'preparing'])); return { mode: mode, code: l.length === 1 ? l[0].code : null }; },
    next: function (s) { var l = ordersIn(s.mode === 'here' ? ['placed'] : ['ready', 'preparing']); if (s.code || l.length < 2) return null; return { slot: 'code', md: 'Which order?', options: l.map(function (o) { return { label: orderLabel(o), value: '@order:' + o.code }; }) }; },
    fill: function (name, n, s, text) { var m = /@order:(\S+)/.exec(text || ''); if (m) { s.code = m[1]; return true; } return false; },
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, l = ordersIn(s.mode === 'here' ? ['placed'] : ['ready', 'preparing']);
      if (!l.length) {
        if (s.mode === 'picked' && ordersIn(['placed']).length) { o.block.push('The kitchen hasn’t started your order yet: tap **I’m here** when you get to the counter, then **Picked up** once you have it.'); o.offers.push({ label: 'I’m here', value: 'i am here for my order', kind: 'action' }, { label: 'Track my order', value: '@go:food' }); return o; }
        o.block.push(s.mode === 'here' ? (ordersIn(['preparing', 'ready']).length ? 'The kitchen already has your order. Tap **Picked up** when you have it.' : 'You don’t have a mobile order waiting for pickup today.') : 'You don’t have an order waiting to be picked up.'); o.offers.push({ label: 'Track my order', value: '@go:food' }); return o;
      }
      if (!s.code) { o.block.push('I couldn’t tell which order you meant.'); return o; }
      merge(o, chk(s.mode === 'here' ? 'orderHere' : 'orderPicked', s.code)); return o;
    },
    preview: function (s) { var ord = (hub().orders || []).find(function (x) { return x.code === s.code; }), p = placeById(ord.at) || { name: ord.at };
      return { title: s.mode === 'here' ? 'I’m here: ' + p.name : 'Picked up at ' + p.name, rows: [['Order', '#' + ord.code], ['Items', (ord.items || []).map(function (i) { return i[1] + '× ' + i[0]; }).join(', ')], ['Pickup', fmtMin(ord.window) + '–' + fmtMin(ord.window + 10)]].concat(s.mode === 'picked' ? [['Charge', money(ord.total) + ' Dining Dollars']] : []), notes: s.mode === 'here' ? ['The kitchen starts making it now.'] : [], fine: [SIM] }; },
    run: function (s) { var ord = (hub().orders || []).find(function (x) { return x.code === s.code; }), p = placeById(ord.at) || { name: ord.at }; return s.mode === 'here' ? receipt(act('orderHere', s.code), 'They’re making your order', 'Tapped I’m here for order ' + s.code + ' at ' + p.name) : receipt(act('orderPicked', s.code), 'Enjoy!', 'Picked up order ' + s.code + ' at ' + p.name); }
  }, [go('Track my order', 'food')]);

  // ---- clear the saved parking spot -> TH.act.clearParking()
  TA.registerHubAction({
    id: 'hub_clear_parking', title: 'Clear my saved parking spot', scope: 'transportation', icon: 'car', system: 'Trojan Hub parking reminder',
    detect: function (n) { if (!isCmd(n)) return 0; if (/\b(permit|citation|ticket)\b/.test(n.t)) return 0; return /\b(clear|forget|delete|remove|reset|unsave|erase)\b.{0,30}\b(parking( spot)?|my spot|my car|where i parked|car location)\b|\bi (moved|took) my car\b|\bi left the (garage|structure)\b/.test(n.t) ? 0.93 : 0; },
    init: function () { return {}; }, next: function () { return null; }, fill: function () { return false; },
    check: function () { var o = { block: [], warn: [], offers: [] }; if (!hub().parking) { o.block.push('You don’t have a saved parking spot.'); return o; } merge(o, chk('clearParking')); return o; },
    preview: function () { var pk = hub().parking, p = placeById(pk.at) || { name: pk.at }; return { title: 'Clear your parking spot', rows: [['Saved spot', p.name + (pk.level ? ', level ' + pk.level : '')]], fine: ['Saved only in this app.'] }; },
    run: function () { return receipt(act('clearParking'), 'Parking spot cleared', 'Cleared the saved parking spot'); }
  }, [go('Getting around', 'rides')]);

  // ---- activate the U-Pass -> TH.act.activateUpass()
  TA.registerHubAction({
    id: 'hub_activate_upass', title: 'Activate my Metro U-Pass', scope: 'transportation', icon: 'card', system: 'USC Transportation U-Pass (via Trojan Hub, simulated)',
    detect: function (n) { if (!isCmd(n)) return 0; return /\bactivat\w*\b/.test(n.t) && /\b(u-?pass|upass|u pass|metro pass|transit pass|tap card)\b/.test(n.t) ? 0.95 : 0; },
    init: function () { return {}; }, next: function () { return null; }, fill: function () { return false; },
    check: function () { var o = { block: [], warn: [], offers: [] }, u = hub().upass; if (!u) { o.block.push('You haven’t signed up for the Metro U-Pass yet, so there’s nothing to activate.'); o.offers.push({ label: 'Sign up for the U-Pass', value: 'sign me up for the u-pass', kind: 'action' }); return o; } merge(o, chk('activateUpass')); return o; },
    preview: function () { var U = (TH.TRANSPORT && TH.TRANSPORT.upass) || {}; return { title: 'Activate your Metro U-Pass', rows: [['Program', U.name || 'Metro U-Pass'], ['Request', (hub().upass || {}).id || '—']], notes: ['For real: activate with the LA Metro link in your confirmation email, then tap the card at a Metro station or bus within 14 days.'], fine: ['Simulated: nothing is sent to USC Transportation or LA Metro.'], sources: U.url ? [{ url: U.url, title: 'Student U-Pass – USC Transportation' }] : [] }; },
    run: function () { return receipt(act('activateUpass'), 'U-Pass active', 'Activated the Metro U-Pass'); }
  }, [go('Open Wallet', 'wallet')]);

  // ======================================================================
  // Navigation answers (no confirm, no log, no undo): "walk me to Leavey", "where is Doheny", "where did I park"
  // ======================================================================
  var NAV = /\b(?:walk me|take me|bring me|guide me|navigate( me)?|directions|route me|show me the way|how do i get|how can i get|how to get|get me|walking route|way)\s+(?:to|towards?)\s+(?:the\s+)?(.{2,60}?)(?:\s+(?:please|now|from here))?[.!?]*$/i;
  var WHERE = /^(?:hey tommy,?\s*)?(?:where(?: is|'s| are)|find)\s+(?:the\s+)?(.{3,60}?)(?:\s+(?:located|on campus|at usc))?[?.!]*$/i;
  function placeLine(p) { var c = TH.CATS && TH.CATS[p.cat]; return '**' + p.name + '**' + (p.address ? ' · ' + p.address : '') + ' · about ' + walkMin(p) + ' min walk' + (p.hours !== undefined ? ' · ' + (p.hours === null ? 'hours not published' : hoursText(p)) : '') + (c ? ' (' + c.label + ')' : ''); }
  // ---- the student's own Hub data, answered locally (the same readers Claude gets: TH.assistantTools) ----
  var WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function tools() { return TH.assistantTools || null; }
  function dayItemsLine(it) { return '- ' + (it.time ? '**' + it.time + '** ' : '') + it.title + (it.kind ? ' _(' + it.kind + ')_' : ''); }
  function myAnswer(n) {
    var t = n.t || '', T2 = tools(); if (!T2) return null;
    if (/(spring|next (semester|term)|fall 20\d\d|registration|register|finals?|exam schedule|academic calendar|registrar)\b/.test(t)) return null;
    // "what clubs am I in?", "my clubs"
    if (/\b(what|which|list|show|see)\b.{0,25}\b(clubs?|orgs?|organizations?|groups?)\b.{0,25}\b(am i in|i am in|im in|i joined|have i joined|i belong to|am i a member of|i am a member of)\b|\bmy (clubs|orgs|organizations|student (orgs|organizations|groups))\b/.test(t) && !/\b(join|leave|quit)\b/.test(t.replace(/\b(i|have i) joined\b/, ''))) {
      var mine = hub().clubs || [];
      if (!mine.length) return [{ role: 'bot', md: 'You haven’t joined any clubs in Trojan Hub yet. Browse the 2,000 EngageSC groups, or tell me “join Troy Camp”.', chips: [go('Browse clubs', 'clubs'), { label: 'Join a club', value: 'join a club', kind: 'action' }] }];
      var lines = mine.map(function (c) { var nx = eventsFor(+c.id)[0]; return '- **' + c.name + '**' + (nx ? ' · next: ' + nx.title + ' (' + when(nx) + ')' : ' · no upcoming public events'); });
      return [{ role: 'bot', md: 'You’re in ' + TA.plural(mine.length, 'club') + ' (simulated on the demo account):\n' + lines.join('\n'), chips: [go('My clubs', 'clubs'), go('Open My Day', 'plans')] }];
    }
    // "when is my next club meeting?"
    if (/\bnext (club )?(meeting|event|gathering)\b|\bwhen (do|does) (my )?clubs? meet\b/.test(t) && /\b(my|club|clubs|i)\b/.test(t)) {
      var cal = (hub().calendar || []).filter(function (x) { return (x.kind === 'club' || /\bclub\b/.test(t) ? x.kind === 'club' : true) && wall(x.end || x.start) >= now(); }).sort(function (a, b) { return wall(a.start) - wall(b.start); });
      if (!cal.length) return [{ role: 'bot', md: (hub().clubs || []).length ? 'None of your clubs has an upcoming public event on EngageSC, so there’s nothing on your calendar yet. Regular meeting times usually aren’t public.' : 'You haven’t joined any clubs in Trojan Hub yet, so there are no club meetings on your calendar.', chips: [go('Browse clubs', 'clubs')] }];
      var x = cal[0], ev = eventById(x.ref);
      return [{ role: 'bot', md: 'Your next ' + (x.kind === 'club' ? 'club event' : 'event') + ' is **' + x.title + '**' + (x.org ? ' (' + x.org + ')' : '') + ' · ' + (ev ? when(ev) : TH.fmtDate(wall(x.start)) + ' ' + TH.fmtTime(wall(x.start))) + (x.where ? ' · ' + x.where : '') + '.' + (cal[1] ? '\n\nAfter that: ' + cal.slice(1, 3).map(function (y) { return y.title; }).join('; ') + '.' : ''), chips: [go('Open My Day', 'plans')].concat(ev && ev.url ? [] : []), sources: ev && ev.url ? [{ url: ev.url, title: ev.title + ' – EngageSC' }] : [] }];
    }
    // "what's on my calendar this week?", "what do I have tomorrow?", "my day", "my schedule on friday"
    var mine2 = /\b(my (calendar|schedule|day|plans|agenda)|on my (calendar|schedule|day|plate)|what do i have|what have i got|what('s| is) (up|on|happening) (for me )?(today|tomorrow|tonight|this week|on \w+day)|am i (free|busy)|do i have anything)\b/.test(t);
    if (mine2 && !/\b(add|put|save|remove|delete|cancel|clear|rsvp|change|sync|export|google|outlook|ical|phone)\b/.test(t)) {
      var offs = [], label;
      if (/\b(this|the) week\b|\bweek\b/.test(t)) { for (var i = 0; i < 7; i++) offs.push(i); label = 'this week'; }
      else if (/\btomorrow\b/.test(t)) { offs = [1]; label = 'tomorrow'; }
      else { var wd = WD.findIndex(function (w) { return new RegExp('\\b' + w + '\\b').test(t); }); if (wd >= 0) { var o2 = (wd - now().getDay() + 7) % 7; offs = [o2]; label = o2 === 0 ? 'today' : WD[wd].charAt(0).toUpperCase() + WD[wd].slice(1); } else { offs = [0]; label = 'today'; } }
      var blocks = offs.map(function (o) { var r = T2.get_my_day({ day_offset: o }); return { off: o, r: r }; }).filter(function (b) { return offs.length === 1 || b.r.items.length; });
      var md = blocks.length ? blocks.map(function (b) { return '**' + (b.off === 0 ? 'Today, ' : b.off === 1 ? 'Tomorrow, ' : '') + b.r.day + '**\n' + (b.r.items.length ? b.r.items.map(dayItemsLine).join('\n') : '- Nothing scheduled.'); }).join('\n\n') : 'Nothing on your calendar ' + label + '.';
      return [{ role: 'bot', md: (offs.length > 1 ? 'Here’s your week (classes, club events, RSVPs and Hub plans):\n\n' : '') + md, chips: [go('Open My Day', 'plans', offs.length > 1 ? 'week' : undefined)].concat(TH.plan ? [offs.length > 1 ? { label: 'Plan my week', value: 'plan my week', kind: '' } : { label: 'Plan it with Tommy', value: offs[0] === 0 ? 'plan my day' : offs[0] === 1 ? 'plan tomorrow' : 'plan ' + WD[(now().getDay() + offs[0]) % 7], kind: '' }] : []) }];
    }
    // "when is the next bus?", "next tram"
    if (/\b(next|when('s| is| does) the( next)?)\s+(usc |campus )?(bus|buses|shuttle|tram|cart)\b/.test(t) && !/\b(metro|expo|e line|dash|lax|union station|airport)\b/.test(t)) {
      var tr = T2.get_transport(), bus = (tr.usc_buses || []).filter(function (b) { return b.next_departures_today && b.next_departures_today.length; });
      if (!bus.length) return [{ role: 'bot', md: 'No more published USC bus departures today. ' + (tr.lyft && tr.lyft.running_now ? 'The free USC Lyft is running now (' + tr.lyft.hours + ').' : 'Free USC Lyft hours: ' + ((tr.lyft && tr.lyft.hours) || '7 PM – 2 AM') + '.'), chips: [go('Getting around', 'rides')] }];
      return [{ role: 'bot', md: 'Next USC bus departures (published schedules):\n' + bus.slice(0, 5).map(function (b) { return '- **' + b.route + '** from ' + (b.first_stop || 'the first stop') + ': ' + b.next_departures_today.join(', '); }).join('\n'), chips: [go('Getting around', 'rides')] }];
    }
    return null;
  }
  // ---------------------------------------------------------------- local intents over Hub data (no confirm)
  function dayOffText(n) { var off = dayOffOf(n); if (off != null) return off; if (/\btonight\b/.test(n.t)) return 0; if (/\b(this )?weekend\b/.test(n.t)) return (6 - now().getDay() + 7) % 7; return null; }
  function dayHead(off) { var d = dayDate(off), lab = LA_DAY.format(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 20))); return off === 0 ? 'today (' + lab + ')' : off === 1 ? 'tomorrow (' + lab + ')' : lab; }
  var FILL = {}; ('find show list search for recommend suggest look looking give me us are is there any some what whats which a an the at usc on campus about related to into focused in that do does you have can could please i want would like join good best cool fun interesting of with hey tommy know exist exists available here around offer offers offered get involved type types kind kinds sort all other more really new where tell student students org orgs organization organizations group groups society societies club clubs events event happening going things thing today tonight tomorrow week weekend this next monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun nov november dec december oct october am pm free food anything there s').split(' ').forEach(function (w) { FILL[w] = 1; });
  function topicOf(t) { return norm(t).split(' ').filter(function (w) { return w && !FILL[w] && !/^\d+(st|nd|rd|th)?$/.test(w); }).join(' '); }

  // ---- club search: "chess clubs", "find me a chess club", "are there any robotics clubs?", "clubs about hiking"
  var CLUBW = '(clubs?|orgs?|organizations?|groups?|societies|society|teams?)';
  var CLUB_ASK = new RegExp('^(?:hey tommy )?(?:(?:can|could) you |please )?(?:(?:find|show|list|search(?: for)?|recommend|suggest|look for|give)(?: me| us)?\\b.*\\b' + CLUBW + '\\b|(?:are|is) there\\b.*\\b' + CLUBW + '\\b|(?:what|which|any)\\b.*\\b' + CLUBW + '\\b|(?:[a-z]+ ){1,3}' + CLUBW + '(?: (?:at usc|on campus))?$|i (?:want|would like|am looking|m looking)\\b.*\\b' + CLUBW + '\\b)|\\b' + CLUBW + ' (?:for|about|related to|into|focused on|on) [a-z]');
  function clubAnswer(n) {
    var t = n.t; if (!CLUB_ASK.test(t)) return null;
    if (/\b(how|start|create|found|register|registration|funding|fund|money|budget|reserve|officers?|president|my|am i|i am in|im in|joined|leave|quit|fees?|cost|costs|dues|price|pay|deadline|fair|insurance|waiver)\b/.test(t)) return null;
    if (/\b(study|support|counseling|therapy) groups?\b/.test(t)) return null;
    if (/\bclub (sports?|teams?)\b|^(what|whats) (is |s )?(a|an) /.test(t)) return null; // "what is a club sport?" is a definition for USC's pages
    var topic = topicOf(t); if (!topic || topic.length < 3) return null;
    var T2 = tools(); if (!T2 || !T2.get_clubs) return null;
    var r = T2.get_clubs({ query: topic }); if (!r.clubs || !r.clubs.length) return null; // the KB answers when there's no match
    var top = r.clubs.slice(0, 5);
    var md = 'EngageSC groups matching **' + topic + '**' + (r.count > top.length ? ' (top ' + top.length + ' of ' + r.count + ')' : '') + ':\n' + top.map(function (c) {
      return '- **' + c.name + '**' + (c.categories && c.categories[0] && c.categories[0] !== 'Other' ? ' · ' + c.categories[0] : '') + (c.registered ? '' : ' · not registered yet') + (c.member ? ' · _you’re a member_' : '') + ' · ' + TA.plural(c.upcoming_events, 'upcoming event') + (c.about ? '\n  ' + c.about.replace(/\s+/g, ' ').slice(0, 110) + (c.about.length > 110 ? '…' : '') : '');
    }).join('\n') + '\n\n_From the EngageSC directory. Meeting times are rarely public; joining adds a group’s posted events to My Day._';
    var chips = [];
    top.slice(0, 2).forEach(function (c) { if (!c.member) chips.push({ label: 'Join ' + c.name.slice(0, 24), value: 'join @club:' + c.id, kind: 'action' }); chips.push(go('Details: ' + c.name.slice(0, 20), 'club', c.id)); });
    chips.push(go('Browse clubs', 'clubs'));
    return [{ role: 'bot', md: md, chips: chips.slice(0, 5), sources: top[0].url ? [{ url: top[0].url, title: top[0].name + ' – EngageSC' }] : [] }];
  }

  // ---- events on a day: "what events are on Wednesday?", "anything happening tomorrow night", "events this weekend"
  function eventsAnswer(n) {
    var t = n.t; if (!/\b(events?|happening|going on|things to do|stuff to do)\b/.test(t)) return null;
    if (/\b(my|i have|im going|i am going|am i)\b/.test(t) || /\b(how|create|host|plan|register|registration|hazing|deadline|career fair|ticket|tickets|parking|game ?day)\b/.test(t)) return null;
    if (!/\b(what|whats|any|anything|which|show|list|are there|is there|find|events?)\b/.test(t)) return null;
    var off = dayOffText(n); if (off == null) { if (!/\b(on campus|today)\b/.test(t)) return null; off = 0; }
    if (off > 30) return null;
    var T2 = tools(); if (!T2 || !T2.get_events) return null;
    var topic = topicOf(t), food = /\bfree food|food\b/.test(t), q = { day_offset: off, category: food ? 'food' : undefined, query: topic || undefined };
    var r = T2.get_events(q), miss = false;
    if (!r.count && topic) { miss = true; r = T2.get_events({ day_offset: off, category: q.category }); }
    var list = (r.events || []).filter(function (e) { return !e.past; }), head = dayHead(off);
    if (!list.length) return [{ role: 'bot', md: 'I don’t see any ' + (r.count ? 'more ' : '') + 'public EngageSC events' + (food ? ' with food' : '') + ' ' + (off > 1 ? 'on ' : '') + head + '.', chips: [go('Browse events', 'events')] }];
    var shown = list.slice(0, 8);
    var md = (miss ? 'Nothing matching **' + topic + '** ' + (off > 1 ? 'on ' : '') + head + '. ' : '') + 'Public EngageSC events' + (food ? ' with food' : '') + ' ' + (off > 1 ? 'on ' : '') + '**' + head + '**' + (r.count > shown.length ? ' (first ' + shown.length + ' of ' + r.count + ')' : '') + ':\n' + shown.map(function (e) { return '- **' + e.time + '** ' + e.title + ' · ' + e.host + (e.free_food ? ' · food' : '') + (e.on_my_calendar ? ' · _on your calendar_' : ''); }).join('\n');
    var first = list.find(function (e) { return !e.on_my_calendar; });
    return [{ role: 'bot', md: md + '\n\n_As listed by hosts on EngageSC; some events need an RSVP or are for members._', chips: (first ? [{ label: 'RSVP: ' + first.title.slice(0, 26), value: 'rsvp to @ev:' + first.id, kind: 'action' }] : []).concat([go('All events', 'events')]), sources: list[0].url ? [{ url: list[0].url, title: list[0].title + ' – EngageSC' }] : [] }];
  }

  // ---- safe walk: "safe route to Cowlings", "is it safe to walk to Leavey at 11pm?", "safest way home"
  var SAFEQ = /\b(safe(st|r)? (route|way|walk|path)|walk (me )?safely|walking safely|is it safe to walk|safe to walk|how safe is (it )?(to walk|walking)|safe walk|(get|walk|go|head|make it)(?: (?:home|back))?(?: (?:to|over to) (?:the |my )?[\w'&.-]+(?: [\w'&.-]+){0,3})? safely|safely (get|walk|go|head)(?: back| home)?)\b/;
  function safeAnswer(n) {
    if (!SAFEQ.test(n.t)) return null;
    var T2 = tools(); if (!T2 || !T2.get_safety) return null;
    var raw = String(n.raw || '').replace(/\b(safe|safely) to walk\b/i, 'safe walk'), m = /^.*\b(?:to|towards?)\s+(?:the\s+)?(.{2,60}?)(?:\s+(?:at|around|by|after|before|tonight|now|late|alone|right now|later)\b.*)?[?.!]*$/i.exec(raw);
    // "safest way to walk home tonight" / "get back to my dorm safely": the verb is not part of the destination
    var dt = m ? m[1].trim().replace(/\s+(safely|safe)$/i, '').replace(/^(?:(?:walk|get|go|head|make it|travel|run)(?:\s+(?:back|over))?\s+)+(?:to\s+(?:the\s+)?)?/i, '').trim() : '';
    if (/^(back|there|home safely)$/i.test(dt)) dt = 'home';
    if (!dt && !/\bhome\b/.test(n.t)) return null; // "is it safe to walk at night?" (no destination) stays with USC's safety pages
    var dest = 'home', name = (TH.HOME && (TH.HOME.name || TH.HOME.label)) || 'home';
    if (dt && !/^(home|my (dorm|room|place|apartment|building|housing)|the village|village|cowlings( and ilium)?|ilium)$/i.test(norm(dt))) {
      var hit = findPlaces(dt).filter(function (x) { return x.score >= 0.6 && !x.p.inferred; })[0];
      if (!hit) return [{ role: 'bot', md: 'I couldn’t find **' + dt.replace(/[*_]/g, '') + '** on the Trojan Hub map, so I can’t score a route there. Pick a destination on the Safety screen, or call DPS at **213-740-4321** (24/7) for a safety escort question.', chips: [go('Safety map', 'safety')] }];
      dest = hit.p.id; name = hit.p.name;
    }
    var w = timeOf(n), hr = w != null ? w / 60 : (/\b(tonight|late|at night)\b/.test(n.t) && nowMin() < 20 * 60 ? 22 : nowMin() / 60), H = Math.floor(hr);
    var r = T2.get_safety({ destination: dest, hour: hr }), lines = [];
    var via = function (x) { return x.via && x.via.length ? ' via ' + x.via.slice(0, 3).join(', ') : ''; };
    if (r.safest) {
      lines.push('- **Safest:** ' + r.safest.minutes + ' min · ' + r.safest.level + via(r.safest));
      if (r.fastest && (r.fastest.minutes !== r.safest.minutes || r.fastest.via.join() !== r.safest.via.join())) lines.push('- **Fastest:** ' + r.fastest.minutes + ' min · ' + r.fastest.level + via(r.fastest));
    } else lines.push('- Routing isn’t available right now; the Safety screen shows the map.');
    var d0 = dayDate(0); d0.setHours(H, Math.round((hr - H) * 60));
    var lyftAt = TH.lyftOpen ? TH.lyftOpen(d0) : null, L2 = lyft(), night = H >= 21 || H < 6;
    if (night && r.controlled_access) lines.push('- **Controlled access** ' + r.controlled_access);
    if (lyftAt) lines.push('- The free **USC Lyft** runs then (' + (L2.hoursText || '') + ') if you’d rather ride.');
    (r.dps_alerts || []).slice(0, 2).forEach(function (a) { lines.push('- DPS ' + (a.level || 'alert') + ': ' + a.title); });
    lines.push('- In an emergency call **911** or USC DPS at **213-740-4321** (24/7).');
    var md = 'Walking from **' + (r.from || 'you') + '** to **' + name + '** at **' + fmtMin(Math.round(hr * 60)) + '**:\n' + lines.join('\n') + '\n\n_' + r.caption + '_';
    var chips = [go('Show safe route', 'safewalk', dest + '@' + H), go('Walk me there', 'walk', dest)];
    if (lyftAt && lyftOpen()) chips.push({ label: 'Free Lyft there', value: 'get me a lyft to ' + (dest === 'home' ? 'home' : name), kind: 'action' });
    return [{ role: 'bot', md: md, chips: chips, sources: [{ url: 'https://dps.usc.edu/alerts/log/', title: 'USC DPS · Daily Crime & Fire Log' }] }];
  }

  // ---- "Tell me about <place or club>" (the place / club sheets' Ask Tommy button): verified Hub data first
  var ABOUT = /^(?:hey tommy,?\s*)?(?:tell me (?:more )?about|what(?:'s| is)|whats|info(?:rmation)? (?:on|about)|details (?:on|about|for))\s+(?:the\s+)?(.{3,90}?)[?.!]*$/i;
  // the sheets send the exact name: an exact place / club name is that place / club (never a loose KB match)
  function exactPlace(target) { var t = norm(target); return t.length >= 3 ? places().find(function (x) { return norm(x.name) === t; }) || null : null; }
  function exactClub(target) {
    var t = norm(target).replace(/^the /, ''); if (t.length < 3) return null;
    var l = clubs().filter(function (c) { return norm(c.name).replace(/^the /, '') === t; }), ex = l.filter(function (c) { return norm(c.name) === norm(target); });
    if (ex.length === 1) return ex[0];
    return l.find(function (c) { return c.registered && !/duplicate/i.test(c.name); }) || l.find(function (c) { return !/duplicate/i.test(c.name); }) || l[0] || null;
  }
  function placeAbout(p) {
    var c = TH.CATS && TH.CATS[p.cat], st = null; try { st = TH.status ? TH.status(p, now()) : null; } catch (e) { st = null; }
    var lv = null; try { lv = TH.live ? TH.live(p) : null; } catch (e) { lv = null; }
    var rows = [];
    if (st) rows.push('- **Now:** ' + [st.label, st.detail].filter(Boolean).join(' · '));
    rows.push('- **Hours today:** ' + (p.hours === null ? 'Hours not published by USC' : hoursText(p)));
    if (p.address) rows.push('- **Address:** ' + p.address);
    rows.push('- **Walk:** about ' + walkMin(p) + ' min from ' + ((TH.ME && TH.ME.label) || 'you'));
    if (lv) rows.push('- **Est. ' + (lv.label || 'busy') + ':** ' + lv.value + (lv.unit === '%' ? '%' : ' ' + (lv.unit || '')) + ' _(estimate; USC publishes no live data)_');
    if (p.features && p.features.length) rows.push('- **Features:** ' + p.features.slice(0, 5).join(', '));
    if (p.access) rows.push('- **Access:** ' + p.access);
    if (p.phone) rows.push('- **Phone:** ' + p.phone);
    var md = '**' + p.name + '**' + (c ? ' · ' + c.label : '') + '\n' + rows.join('\n') + (p.desc ? '\n\n' + String(p.desc).slice(0, 260) + (String(p.desc).length > 260 ? '…' : '') : '') + (p.inferred ? '\n\n_Restrooms inside this building; USC doesn’t map their exact location._' : '');
    var srcs = (p.sources || []).concat(p.url ? [p.url] : []).filter(function (u, i, a) { return u && a.indexOf(u) === i; });
    if (srcs.length) md += '\n\n_Source: USC’s published hours and info (' + srcs.length + ' page' + (srcs.length > 1 ? 's' : '') + ' linked below)._';
    var src = srcs.slice(0, 2).map(function (u) { return { url: u, title: p.name + ' – source' }; });
    var chips = [go('Walk me there', 'walk', p.id), go('Details', 'place', p.id)];
    if (p.order && menuFor(p.id)) chips.push({ label: 'Mobile order here', value: 'mobile order from ' + p.name, kind: 'action' });
    var out = [{ role: 'bot', md: md, chips: chips, sources: src }];
    out.kbExtra = p.inferred ? null : norm(String(p.name).replace(/\s*[(–—-].*$/, '')); // route() appends matching USC-page passages
    return out;
  }
  function clubAbout(cl) {
    var ev = eventsFor(cl.id), mem = isMember(cl.id);
    var md2 = '**' + cl.name + '** · ' + ((cl.cats || [cl.cat]).filter(Boolean).slice(0, 3).join(', ') || 'Student organization') + (cl.registered ? '' : ' · not registered yet on EngageSC') + (mem ? ' · _you’re a member_' : '') + '\n'
      + (cl.desc ? String(cl.desc).replace(/\s+/g, ' ').slice(0, 320) + (String(cl.desc).length > 320 ? '…' : '') + '\n' : '')
      + (cl.meeting ? '\n- **Meets:** ' + (cl.meeting.text || String(cl.meeting)) + ' (per the group’s page)' : '')
      + '\n- **Upcoming public events:** ' + (ev.length ? ev.slice(0, 3).map(function (e) { return e.title + ' (' + when(e) + ')'; }).join('; ') : 'none listed on EngageSC')
      + '\n\n_From the EngageSC directory._';
    var ch = [mem ? { label: 'Leave ' + cl.name.slice(0, 24), value: 'leave @club:' + cl.id, kind: 'action' } : { label: 'Join ' + cl.name.slice(0, 26), value: 'join @club:' + cl.id, kind: 'action' }, go('Details', 'club', cl.id)];
    return [{ role: 'bot', md: md2, chips: ch, sources: cl.engage || cl.url ? [{ url: cl.engage || cl.url, title: cl.name + ' – EngageSC' }] : [] }];
  }
  // "Tell me about <exact place or club name>" (what the place / club sheets send), or null
  function exactAbout(n) {
    var m = /^(?:hey tommy,?\s*)?tell me (?:more )?about\s+(.{3,300}?)[?.!]*$/i.exec(String(n.raw || '').trim()); if (!m) return null;
    var p = exactPlace(m[1]); if (p) return placeAbout(p);
    var c = exactClub(m[1]); return c ? clubAbout(c) : null;
  }
  TA.Hub = TA.Hub || {};
  TA.Hub.exactAbout = exactAbout;
  function aboutAnswer(n) {
    var m = ABOUT.exec(String(n.raw || '').trim()); if (!m) return null;
    var target = m[1], tell = /^(hey tommy,?\s*)?(tell|info|details)/i.test(String(n.raw).trim()), tn = norm(target);
    var ex = tell ? exactAbout(n) : null; if (ex) return ex;
    var ep = exactPlace(target); if (ep) return placeAbout(ep);
    // "what's happening with my financial aid?", "what is the deal with parking" are questions, not place look-ups
    if (!tell && (/^(happening|going on|up|wrong|new|the (deal|status|latest|process|deadline|difference))\b/.test(tn) || /\b(my|i|me)\b/.test(tn))) return null;
    var hits = findPlaces(target), top = hits[0], pk = tell ? pickClub(target) : { club: null, cands: [] }, fc = pk.club ? findClubs(target)[0] : null;
    if (fc && fc.score >= 0.97 && !(top && top.score >= 0.97)) top = null; // "Trojan Chess Club" is a club, not Trojan Grounds
    // an office named after a topic ("tell me about financial aid") answers from USC's pages unless the office itself is named
    var need = top && top.p.cat === 'service' ? 0.97 : tell ? 0.8 : 0.92;
    if (top && top.score >= need && !(hits[1] && hits[1].score === top.score && hits[1].p.name !== top.p.name && top.score < 0.97)) return placeAbout(top.p);
    if (!tell) return null;
    if (pk.club) return clubAbout(pk.club);
    // "tell me about the chess club": several groups match -> list them (same as the club search)
    if (pk.cands && pk.cands.length > 1 && /\b(clubs?|orgs?|organizations?|societ(y|ies)|associations?|teams?|chapters?)\b/.test(tn)) return clubAnswer({ t: 'find ' + tn + (/\bclubs?\b/.test(tn) ? '' : ' clubs'), raw: n.raw });
    return null;
  }
  function navAnswer(n, text) {
    var raw = String(text || n.raw || '').trim(), m, target, home = false;
    var my = myAnswer(n); if (my) return my;
    if (/\bwhere (did|have) i park(ed)?\b|\bwhere('s| is) my car\b|\bfind my car\b/.test(n.t)) {
      var pk = hub().parking, pp = pk && placeById(pk.at);
      if (!pp) return [{ role: 'bot', md: 'You haven’t saved a parking spot in Trojan Hub yet. Next time, tell me “I parked at McCarthy level 3” and I’ll remember it.', chips: [go('Getting around', 'rides')] }];
      return [{ role: 'bot', md: 'You parked at **' + pp.name + '**' + (pk.level ? ', level **' + pk.level + '**' : '') + '. It’s about ' + walkMin(pp) + ' min on foot.', chips: [go('Walk me there', 'walk', pp.id), go('Show on map', 'place', pp.id)] }];
    }
    var sa = safeAnswer(n); if (sa) return sa;
    var ab = aboutAnswer(n); if (ab) return ab;
    var ca = clubAnswer(n); if (ca) return ca;
    // "i was just thinking, are there any chess clubs?": the club question is the last clause
    var lastCl = String(n.raw || '').split(/[,;]\s*|\s+(?:but|so|anyway)\s+/).pop();
    if (lastCl && lastCl.length < String(n.raw || '').length && lastCl.trim().length >= 8) { var ca2 = clubAnswer(TA.NLU.parse(lastCl.trim())); if (ca2) return ca2; }
    // "how do I RSVP to an event?" is about EngageSC events (TA's index also knows "RSVP" as CARE-SC's old name)
    if (/\b(how|where|can i|do i)\b.{0,30}\b(rsvp|un ?rsvp|register for|sign up for)\b.{0,30}\b(an |a |the |this |that )?(event|events|engage|engagesc)\b/.test(n.t) && !/\b(care|advocat\w*|sexual|assault|violence|prevention)\b/.test(n.t))
      return [{ role: 'bot', md: 'Public events are listed on EngageSC (engage.usc.edu), and you RSVP from the event’s own EngageSC page. Some events are for members or need an RSVP, as the host sets it.\n\nIn Trojan Hub you can open any event under **Events** and use its EngageSC link, or tell me “RSVP to <event name>”. I’ll put it on My Day (simulated on the demo account; the real RSVP is on EngageSC).', chips: [go('Browse events', 'events'), { label: 'RSVP to an event', value: 'rsvp to an event', kind: 'action' }], sources: [{ url: 'https://engage.usc.edu/', title: 'EngageSC' }] }];
    // "any free food today?" -> today's real EngageSC events that list food (not food-insecurity help: that stays with the KB)
    var foodQ = /\bfree food\b|\bfood at (an )?events?\b/.test(n.t) && !/\b(pantry|insecur\w*|can not afford|cannot afford|hungry|starving|no money|basic needs|calfresh|emergency)\b/.test(n.t);
    // a named day ("free food tomorrow", "events on Wednesday") answers for that day
    if (foodQ ? dayOffText(n) > 0 : true) { var ea = foodQ ? eventsAnswer({ t: n.t.replace(/\bfree food\b/, 'free food events'), raw: n.raw, dates: n.dates, times: n.times }) : eventsAnswer(n); if (ea) return ea; }
    if (foodQ) {
      var t0 = now(), todayKey = dkey(t0), up = upcoming().filter(function (e) { return e.food && wall(e.end || e.start) > t0; });
      var tonight = up.filter(function (e) { return evDay(e) === todayKey; }), list = (tonight.length ? tonight : up).slice(0, 4);
      if (!list.length) return [{ role: 'bot', md: 'I don’t see any upcoming public EngageSC events that list free food right now.', chips: [go('Browse events', 'events')] }];
      return [{ role: 'bot', md: (tonight.length ? 'Public EngageSC events with food **today**:' : 'Nothing left today, but these upcoming EngageSC events list food:') + '\n' + list.map(function (e) { return '- **' + e.title + '** · ' + when(e) + ' · ' + e.org; }).join('\n') + '\n\n_Food is as listed by the host on EngageSC; some events are for members or need an RSVP._',
        chips: [{ label: 'RSVP: ' + list[0].title.slice(0, 26), value: 'rsvp to @ev:' + list[0].id, kind: 'action' }, go('All events', 'events')], sources: [{ url: list[0].url, title: list[0].title + ' – EngageSC' }] }];
    }
    if (/\b(my )?next class\b/.test(n.t) && (NAV.test(raw) || /^where\b/.test(n.t))) return [{ role: 'bot', md: 'I can’t map your classrooms: the Schedule of Classes data I have doesn’t include rooms. Your times are on My Day, and the room is listed on your schedule in OASIS / myUSC.', chips: [go('Open My Day', 'plans'), go('Map', 'map')] }];
    if (/^(?:please\s+)?(?:take|walk|bring|guide|get|navigate|route) me home\b|^(?:directions|route|walking route|way) (?:back )?home\b/i.test(raw.replace(/^(hey )?tommy,?\s*/i, ''))) target = 'home';
    else if ((m = NAV.exec(raw))) target = m[2];
    else if ((m = WHERE.exec(raw)) && !/\b(i |can i|do i|should i|my (car|class|advisor)|office hours|apply|form|located\?? for)\b/.test(n.t)) target = m[1];
    if (!target) return null;
    // "where is the closest restroom / nearest coffee": nearest open places of that category
    var CATW = [[/\b(restrooms?|bathrooms?|toilets?|wc)\b/, 'restroom'], [/\b(coffee|food|eat|dining|lunch|dinner|breakfast|cafe)\b/, 'dining'], [/\b(study|library|quiet)\b/, 'study'], [/\b(gym|fitness|workout)\b/, 'fitness'], [/\b(blue ?light|safety|dps)\b/, 'safety'], [/\b(parking|park my car|garage)\b/, 'parking'], [/\b(bus|shuttle|stop|metro)\b/, 'transit']];
    var cw = /\b(closest|nearest|nearby|close by|open)\b/.test(norm(target)) ? CATW.find(function (c) { return c[0].test(norm(target)); }) : null;
    if (cw) {
      var byWalk = function (a, b) { return walkMin(a) - walkMin(b); }, inCat = places().filter(function (p) { return p.cat === cw[1]; });
      // only places whose published hours say "open" count as open now; unpublished hours are listed separately
      var near = inCat.filter(function (p) { return openAt(p, nowMin()) === true; }).sort(byWalk).slice(0, 3);
      var unk = inCat.filter(function (p) { return openAt(p, nowMin()) === null; }).sort(byWalk).slice(0, near.length ? 2 : 3);
      if (!near.length && !unk.length) return null;
      var lab = (TH.CATS && TH.CATS[cw[1]] && TH.CATS[cw[1]].label) || cw[1];
      var line = function (p) { return '- ' + placeLine(p) + (p.inferred ? ' _(restrooms inside; exact spot not mapped by USC)_' : ''); };
      var md = (near.length ? 'Closest ' + lab.toLowerCase() + ' open now:\n' + near.map(line).join('\n') : 'I can’t confirm any ' + lab.toLowerCase() + ' open right now from published hours.')
        + (unk.length ? '\n\n**Hours not published** (may be closed or need ID at this time):\n' + unk.map(line).join('\n') : '');
      var first = (near[0] || unk[0]);
      return [{ role: 'bot', md: md, chips: [go('Walk me there', 'walk', first.id), go('Details', 'place', first.id), go('Map', 'map')] }];
    }
    if (/^(home|my (dorm|room|place|apartment|building|housing))$/.test(norm(target))) home = true;
    if (home && TH.HOME) return [{ role: 'bot', md: 'Home is **' + (TH.HOME.name || TH.HOME.label) + '**' + (TH.HOME.address ? ', ' + TH.HOME.address : '') + '. I’ll draw the safest walking route on the map' + (lyftOpen() ? ', or I can get you a free USC Lyft (running now).' : '.'), chips: [go('Walk me home', 'walk', 'home')].concat(lyftOpen() ? [{ label: 'Free Lyft home', value: 'get me a lyft home', kind: 'action' }] : []).concat([go('Safety map', 'safety')]) }];
    var hits = findPlaces(target).filter(function (x) { return x.score >= 0.6; });
    // "best way to get to LAX?" is a travel question for USC's pages; only a walking command ("walk me to X") says "not on the map"
    if (!hits.length) return NAV.test(raw) && /\b(walk|take|bring|guide|navigate|route) me\b|^(directions|walking route)\b/i.test(raw) ? [{ role: 'bot', md: 'I couldn’t find **' + target.replace(/[*_]/g, '') + '** on the Trojan Hub map. Try a building name or code (like “Leavey” or “TCC”), or search the map.', chips: [go('Open the map', 'map')] }] : null;
    var top = hits[0].p, others = hits.slice(1, 3).filter(function (x) { return x.score >= hits[0].score - 0.05 && x.p.name !== top.name; });
    var md = (m && NAV.test(raw) ? 'Here’s the way to ' : '') + placeLine(top) + (others.length ? '\n\nAlso: ' + others.map(function (x) { return x.p.name; }).join('; ') : '');
    var chips = [go('Walk me there', 'walk', top.id), go('Details', 'place', top.id)].concat(others.map(function (x) { return go(x.p.name.slice(0, 28), 'place', x.p.id); }));
    return [{ role: 'bot', md: md, chips: chips.slice(0, 4), sources: top.url ? [{ url: top.url, title: top.name }] : [] }];
  }
  TA.Hub = Object.assign(TA.Hub || {}, { navAnswer: navAnswer });

  // ======================================================================
  // Routing: a confident Hub action (or a navigation request) wins over the brain's pre-action filters
  // (B.misuse answers "order me a coffee" with "I can't place food orders", B.offTopic, quick facts...).
  // Safety flags, pending flows, yes/no/cancel/undo, split questions and @chips still go to the original router.
  // ======================================================================
  function hubHit(n) { var h = TA.Actions.detect(n); return h && h.score >= 0.8 && HUB_IDS[h.action.id] ? h : null; }
  // same nets as B.sensitive minus B.misuse (misuse is exactly what refuses "order me a latte")
  var SENS = [/\b(grop\w*|sexual(ly)? (assault\w*|harass\w*)|raped|rape|stalk\w*|forced (himself|herself|themselves) on me|pressur\w* me (into|to have) sex|made a pass at me|dating violence|domestic violence|(boyfriend|girlfriend|partner|ex) (hit|hits|beat|beats|choked|threatens|threatened))\b/,
    /\b(racis\w*|sexis\w*|homophob\w*|transphob\w*|antisemit\w*|islamophob\w*|discriminat\w*|bull(y|ied|ying)|harass(ed|ing)? me|catcall\w*|slurs?)\b/,
    /\b(mak(e|ing)|made) myself (throw up|vomit|puke)|purg(e|ing)\b|starv(e|ing) myself|anorexi\w*|bulimi\w*|eating disorder|addicted|addiction\b/,
    /\b(kill|hurt|harm|die|dying|suicid\w*|weapon|gun|knife|follow(ing|ed)? me|unsafe|scared|afraid|emergency|attack\w*|assault\w*|threat\w*|drunk|overdos\w*)\b/];
  // hazing, harassment, bullying, stalking and threats in ANY form ("my frat is hazing me", "im being harassed"):
  // the NLU only flags described hazing acts, so this net makes sure the support/reporting branches always run.
  var SAFE_NET = /\b(haz(e|ed|es|ing)|pledg\w* (abuse|forced)|harass\w*|bull(y|ied|ying|ies)|cyberbull\w*|stalk\w*|threaten\w*|intimidat\w*)\b/;
  function supportCue(n) {
    var t = n.t || '';
    if (SAFE_NET.test(t) && !(/\b(anti ?(hazing|bullying|harassment)|(hazing|harassment|bullying) (prevention|awareness|education|training|workshop|policy|week))\b/.test(t) && !/\b(me|my|i|im|us|we)\b/.test(t.replace(/\b(join|rsvp|sign me up|add me|for me|me to)\b/g, '')))) return true;
    try { if (B.r4Bias && B.r4Bias(n)) return true; if (B.r4Bully && B.r4Bully(n)) return true; } catch (e) { /* ignore */ }
    return false;
  }
  function flagged(n) { return !!(n.crisis || n.emergency || n.distress || n.disclose || n.hazing || n.threat || n.threatMe || n.violence || n.concern || n.medical || n.injury || n.overdose || n.safetyInfo || n.lang || SENS.some(function (re) { return re.test(n.t || ''); }) || supportCue(n)); }
  TA.Hub.flagged = flagged;
  TA.Hub.supportCue = supportCue;
  // the message is a question of its own, not a value for the waiting slot
  function slotValue(n) { return !!((n.times && n.times.length) || (n.dates && n.dates.length) || n.durationMin); }
  function sideQuestion(n, p) {
    var raw = String(n.raw || '').trim(); if (!/\?\s*$/.test(raw)) return false;
    var last = norm(raw.split(/[,;.!]\s+|\s(?:but|so|and|also)\s/).pop() || raw);
    if (!/^(are there|is there|what|whats|when|where|which|who|how|why|does|do (i|you|they|we)|can i|could i|should i|will|am i|is it|is the|are the)\b/.test(last)) return false;
    if (/^(what|how) about\b|^can you do\b|^(is|does|would|could) .{0,20}\b(work|ok|okay|fine|free|available|open)\b/.test(last)) return false; // counter-offers answer the slot
    // generic researched processes take any free text as "details"; Hub flows only when the question names a course
    // or isn't about the request's own subject
    if (/^proc:/.test(p.aid)) return true;
    if (!HUB_IDS[p.aid]) return false;
    return /\b[a-z]{2,5}[- ]?\d{3}[a-z]?\b/i.test(raw) && !!(n.courses && n.courses.length) && !slotValue(n); // a course code typed in this message
  }
  // "i was just attacked", "we were literally mugged", "i've been jumped": a filler word must not hide an assault
  // from TA's danger net (it matches "i was attacked" / "got jumped"), so the message is re-read without it
  var ASSAULT_ADV = /\b(i|we)\s+(?:was|were|got|have been|had been|ve been|just got|just been)((?:\s+(?:just|literally|actually|recently|basically|kinda|kind of|like|really|totally|physically|violently|almost|seriously|badly))*)\s+(assaulted|attacked|mugged|robbed|jumped|raped|beaten up|beat up)\b/;
  // "someone just attacked me", "a man is attacking me", "somebody punched my friend": an attacker as the subject,
  // in the past or happening now, is an emergency too (TA's net only knows the first-person "i was attacked" form)
  var ASSAULT_3P = /\b(?:someone|somebody|some(?:one| guy| man| woman| dude| person| people| stranger)?|a (?:guy|man|woman|dude|person|stranger|group(?: of \w+)?)|this (?:guy|man|woman|dude|person)|he|she|they|people)\s+(?:(?:just|literally|actually|really|suddenly|randomly)\s+)*(?:(?:attacked|assaulted|punched|stabbed|shot|mugged|robbed|jumped|grabbed|choked|beat(?: up)?|pulled a (?:gun|knife) on)\s+(?:me|us|my \w+)|(?:is|are|'s|'re|keeps?)\s+(?:attacking|assaulting|beating|punching|stabbing|robbing|mugging|hitting|choking|grabbing)\s+(?:me|us|my \w+))\b/;
  // ----------------------------------------------------------------------
  // Happening-now emergencies TA's own nets miss: someone following another person, injuries ("my friend fell down
  // the stairs and is bleeding"), someone at the door or window who won't leave, an intruder inside, and being lost or
  // stranded outdoors ("we are lost on a hike and it's getting dark"). Each gets the emergency card (911 / DPS) first.
  // Matched on a copy of the text with contractions spelled out; past events ("fell last week and hurt her knee"),
  // social-media follows and lost belongings are left to the normal answers.
  // ----------------------------------------------------------------------
  function dzCanon(t) {
    return ' ' + String(t || '').toLowerCase().replace(/[’‘`´]/g, "'")
      .replace(/\b(he|she|it|someone|somebody|that|there|who)'s\b/g, '$1 is').replace(/\b(hes|shes|its|someones|somebodys|thats|theres|whos)\b/g, function (w) { return w.slice(0, -1) + ' is'; })
      .replace(/\b(they|we|you)'re\b/g, '$1 are').replace(/\b(theyre|youre)\b/g, function (w) { return w.slice(0, -2) + ' are'; })
      .replace(/\bi'?m\b/g, 'i am').replace(/\bwo?n'?t\b/g, 'will not').replace(/\bcannot\b/g, 'can not')
      .replace(/\b(is|are|was|were|has|have|had|does|do|did|ca|could|would|should)n'?t\b/g, function (w, a) { return (a === 'ca' ? 'can' : a) + ' not'; })
      .replace(/\brn\b/g, 'right now').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  }
  var DZ_REL = '(?:friends?|roommates?|suitemates?|housemates?|classmates?|teammates?|sister|brother|siblings?|girlfriend|boyfriend|partner|gf|bf|mom|mother|dad|father|cousin|kids?|son|daughter|wife|husband|bestie|best friend|date|neighbou?r|buddy|ra|grandma|grandpa|aunt|uncle|baby)';
  var DZ_AGENT = '(?:someone|somebody|some(?: \\w+){0,2}? (?:guys?|m[ae]n|wom[ae]n|dudes?|person|people|stranger|creep|car|van|truck)|an?(?: \\w+){0,3}? (?:guy|man|woman|dude|person|stranger|creep|car|van|truck|group|driver)|(?:this|that|the|same)(?: \\w+){0,2}? (?:guy|man|woman|dude|person|stranger|creep|car|van|truck|group|driver)|two(?: \\w+)? (?:guys|men|people|women)|he|she|they|people|strangers|(?:her|his|their|my) ex(?: boyfriend| girlfriend)?)';
  var DZ_VICT3 = '(?:my(?: \\w+)? ' + DZ_REL + '|her|him|them|us|me and my(?: \\w+)? ' + DZ_REL + '|my(?: \\w+)? ' + DZ_REL + ' and (?:me|i))';
  var DZ_SUBJ = '(?:my(?: \\w+){0,2}? ' + DZ_REL + '|(?:a|an|this|that|the|some|one of my)(?: \\w+){0,2}? (?:friend|student|kid|guy|girl|man|woman|person|classmate|roommate|biker|cyclist|runner|skater|hiker|player|teammate|lady|dude|child|baby)|he|she|they|someone|somebody|we|our(?: \\w+)? (?:friend|roommate|group))';
  var DZ_PAST = /\b(yesterday|last (night|week|month|year|semester|weekend|time|summer|spring|fall)|(days|weeks|months|years) ago|a (few |couple )?(days|weeks|months|years) ago|in the past|used to|when i was|a while ago|before)\b|\bonce(?= (?:and|but|lol|haha|or twice|before)\b| ?$)/;
  var DZ_NOW = /\b(right now|now|currently|still|tonight|getting dark|it is dark|after dark|at night)\b/;
  // the matched words themselves say it is happening ("we ARE lost", "she IS bleeding"): a "before"/"once" elsewhere
  // in the message ("we are lost and need to get back before dark") never turns it into a past story
  var DZ_PRESENT = /\b(?:is|are|am|keeps?|has been|have been|can not|will not)\b/;
  var NOW_DANGER = [
    // "a man is following my friend", "some guy keeps following my roommate home", "a car is following us",
    // "there is a guy following my sister" (first-person "a man is following me" too; "keeps following me" stays TA's stalking answer)
    { kind: 'follow',
      re: [new RegExp('\\b' + DZ_AGENT + '(?: \\w+){0,6}? (?:is|are|keeps?|has been|have been)(?: (?:still|literally|just|now|actually|really|kinda|kind of|definitely|totally|been))* (?:following|chasing|tailing|stalking|trailing) ' + DZ_VICT3 + '\\b'),
        new RegExp('\\b' + DZ_AGENT + '(?: \\w+){0,6}? (?:is|are)(?: (?:still|literally|just|now|actually|really|definitely|totally))* (?:following|chasing|tailing|trailing) me\\b'),
        new RegExp('\\bthere is (?:a|an|some|this)(?: \\w+){0,3}? (?:guy|man|woman|dude|person|stranger|creep|car|van|truck|group) (?:following|chasing|tailing|trailing) (?:me|' + DZ_VICT3 + ')\\b'),
        new RegExp('\\b(?:my(?: \\w+)? ' + DZ_REL + '|she|he|they|we) (?:is|are) (?:being|getting) (?:followed|chased|tailed)\\b')],
      not: /^ ?(?:'?s )?(?:on|via) (?:insta\w*|ig|tiktok|twitter|x|snap\w*|social|linkedin|spotify|youtube|facebook|fb|twitch|github|bereal|strava|venmo|threads|pinterest|reddit|discord|tumblr|soundcloud)\b|^ ?(?:'?s )?(?:online|account|accounts|page|posts?|story|stories|reels?|tweets?|videos?|blog|channel|podcast|advice|lead|example|instructions?|recipe|footsteps|music|band|plan|career|journey|playlist)\b/ },
    // "my friend fell down the stairs and is bleeding", "my roommate fell and is not moving", "she is bleeding", "i fell and i am bleeding"
    { kind: 'injury', medical: true,
      re: [new RegExp('\\b' + DZ_SUBJ + '(?: \\w+){0,6}? (?:is|are|keeps?|has been|have been|started|starts)(?: (?:still|really|badly|so|just|now|literally|very))* (?:bleeding|unconscious|unresponsive|not moving|not responding|knocked out|out cold|convulsing|seizing|coughing up blood|throwing up blood|not waking up|turning blue|seriously (?:hurt|injured)|badly (?:hurt|injured)|really (?:hurt|injured)|severely (?:hurt|injured)|hurt (?:bad|badly|really bad|pretty bad)|in (?:a lot of|so much|bad|serious) pain)\\b'),
        new RegExp('\\b' + DZ_SUBJ + '(?: \\w+){0,3}? (?:just )?(?:fell|has fallen|tripped|slipped|crashed|wiped out|collapsed|got hit|was hit|got knocked|was knocked|hit (?:his|her|their|our|its) head)\\b(?: \\w+){0,10}? (?:(?:is|are|keeps|has been|have been)(?: (?:still|really|badly|so|now|very))* (?:bleeding|hurt|injured|unconscious|unresponsive|not moving|not responding|passed out|knocked out|out cold|in (?:a lot of|so much|bad|serious) pain)|(?:can not|will not|is not able to) (?:move|get up|stand|walk|wake up|respond|breathe|stop bleeding)|not (?:moving|breathing|responding|waking up|getting up)|bleeding|hit (?:his|her|their|our|my) head|broke (?:his|her|their|our) (?:arm|arms|leg|legs|ankle|wrist|hip|nose|neck|back|collarbone|jaw|foot|hand|finger|ribs?|bones?|skull|knee|shoulder|elbow)|(?:arm|leg|ankle|wrist|bone|neck) (?:is|looks) broken)\\b'),
        /\bi (?:just )?(?:fell|crashed|wiped out|got hit|was hit|slipped|tripped)\b(?: \w+){0,10}? (?:i am |am |and i am |and am |i )?(?:bleeding|can not (?:move|get up|stand|walk|feel my \w+)|hit my head|think i broke|broke my (?:arm|leg|ankle|wrist|neck|back|hip))\b/],
      not: /\bbleed(?:ing|s)? (?:money|cash|points|subscribers|followers|fans|talent|users|customers|members)\b/,
      past: true },
    // "someone is outside my door and won't leave", "a guy keeps knocking on my door", "a man is at my window", "there is an intruder in my apartment"
    { kind: 'intruder',
      re: [new RegExp('\\b(?:' + DZ_AGENT + '|there is (?:a|an|some|this)(?: \\w+){0,2}? (?:guy|man|woman|dude|person|stranger|creep))(?: \\w+){0,4}? (?:is |are |keeps? |has been |have been )?(?:still |just |now )?(?:outside|at|by|in front of|near|banging on|knocking on|pounding on|kicking|standing (?:outside|at|by)|waiting (?:outside|at|by)|lurking (?:outside|at|by|near)|hanging (?:out )?(?:outside|by|at)|trying to (?:open|get in|get into|come in)|looking (?:in|into|through)|yelling (?:at|outside))(?: of)? (?:my|our|the)(?: \\w+)? (?:door|front door|window|room|dorm|apartment|apt|house|home|place|unit|suite|bedroom)\\b(?: \\w+){0,10}? (?:will not (?:leave|go away|stop|go|let)|refuses? to (?:leave|go)|(?:is|are) not leaving|not leaving|keeps? (?:knocking|banging|trying|coming back|yelling|ringing|pounding)|wants? (?:to come in|me to open)|(?:trying|tries) to (?:get|come|break) in|i am (?:scared|afraid|terrified|freaking out)|scared|afraid|terrified|i do not know (?:him|her|them|who)|does not live here|threaten\\w*)\\b'),
        new RegExp('\\b' + DZ_AGENT + '(?: \\w+){0,4}? (?:is |are )(?:standing |hiding |lurking |looking )?(?:outside|at|by|in) (?:my|our) (?:bedroom )?window\\b'),
        new RegExp('\\b' + DZ_AGENT + '(?: \\w+){0,4}? (?:keeps? |is |are )(?:banging|knocking|pounding|kicking) (?:on )?(?:my|our) (?:front )?(?:door|window)\\b'),
        /\b(?:there is |there are )?(?:an intruder|intruders|a stranger|strangers|someone i do not know|somebody i do not know|a (?:guy|man|woman|person) i do not know)(?: \w+){0,3}? (?:is |are )?(?:in|inside|hiding in|in the middle of) (?:my|our|the) (?:room|dorm|apartment|apt|house|home|place|unit|suite|bedroom|bathroom|closet|kitchen|building|hallway)\b/,
        // "there is someone in my room i don't know", "there's a guy inside our apartment who doesn't live here"
        /\bthere (?:is|are) (?:someone|somebody|a (?:guy|man|woman|person|stranger)|people|strangers)(?: \w+){0,2}? (?:in|inside) (?:my|our) (?:room|dorm|apartment|apt|house|home|place|unit|suite|bedroom|bathroom|closet)\b(?: \w+){0,4}? (?:(?:that|who|whom) )?(?:i|we) do not know\b|\bthere (?:is|are) (?:someone|somebody|a (?:guy|man|woman|person|stranger)|people|strangers)(?: \w+){0,2}? (?:in|inside) (?:my|our) (?:room|dorm|apartment|apt|house|home|place|unit|suite|bedroom|bathroom|closet)\b(?: \w+){0,4}? (?:who|that) (?:does|do) not live here\b/,
        /\bthere is (?:an? )?intruder\b|\bintruder (?:is |are )?(?:in|inside)\b/] },
    // "we are lost on a hike and it's getting dark, need help", "i am stranded on a trail", "we lost the trail and can't find our way back"
    { kind: 'lost',
      re: [new RegExp('\\b(?:we|i|my(?: \\w+)? ' + DZ_REL + '(?: and i)?|our (?:group|friends?)|they|he|she)(?: (?:are|is|am|got|have gotten|have been|been))?(?: (?:totally|completely|really|so|kind of|kinda|all|both|now|currently|still|just))* (?:lost|stranded|stuck|trapped)(?: \\w+){0,2}? (?:on|in|at|up|near|off|along|by|down|somewhere (?:on|in)|in the middle of)(?: (?:a|an|the|this|our|my|some))?(?: \\w+){0,2}? (?:hike|hiking|trail|trails|trailhead|mountain|mountains|canyon|woods|forest|desert|wilderness|backcountry|cliff|ridge|summit|peak|hills|griffith|runyon|bluffs?|cave|ocean|rocks|rip current)\\b'),
        /\b(?:on|during|from) (?:a|the|our|my|this) (?:hike|trail|hiking trip|camping trip)\b(?: \w+){0,8}? (?:(?:are|am|is|got|have gotten) )?(?:lost|stranded|stuck|can not find (?:the|our|my) way(?: back| out| down)?|lost the trail)\b/,
        /\b(?:we|i|they) (?:lost the trail|can not find (?:the|our|my) way (?:back|out|down))\b/,
        // "we got lost hiking and it's dark", "i am stranded while climbing"
        new RegExp('\\b(?:we|i|my(?: \\w+)? ' + DZ_REL + '(?: and i)?|our (?:group|friends?)|they|he|she)(?: (?:are|is|am|got|have gotten|have been|been))?(?: (?:totally|completely|really|so|kind of|kinda|all|both|now|currently|still|just))* (?:lost|stranded) (?:while |when |after )?(?:hiking|climbing|camping|backpacking|trail running|rock climbing|mountain biking)\\b')],
      not: /\blost (?:my|our|his|her|their|a|an) (?:phone|keys?|wallet|card|uscard|id|bag|backpack|water bottle|jacket|airpods|headphones|charger|bottle|hat|sunglasses|glasses)\b/,
      past: true }
  ];
  function nowDanger(t) {
    var c = dzCanon(t);
    for (var i = 0; i < NOW_DANGER.length; i++) {
      var k = NOW_DANGER[i], hit = null;
      for (var j = 0; j < k.re.length && !hit; j++) { var m = k.re[j].exec(c); if (m && !(k.kind === 'follow' && k.not.test(c.slice(m.index + m[0].length)))) hit = m; }
      if (!hit) continue;
      if (k.kind !== 'follow' && k.not && k.not.test(c) && !/\b(we|i) (?:are|am) (?:lost|stranded|stuck)\b/.test(c)) continue;
      if (k.past && DZ_PAST.test(c) && !DZ_NOW.test(c) && !DZ_PRESENT.test(hit[0])) continue; // "fell last week and hurt her knee": not happening now
      if (k.kind === 'lost' && /\b(if|in case|what happens|how (?:to|do|can|not)|tips?|should i bring|prepare)\b/.test(c) && !DZ_NOW.test(c)) continue; // "what if we get lost"
      return k;
    }
    return null;
  }
  TA.Hub.nowDanger = function (n) { var k = nowDanger((n && (n.t || n.raw)) || ''); return k ? k.kind : null; };
  // what to do next, under the emergency card (the card itself carries the tap-to-call numbers); injuries already get
  // TA's medical steps, so only these three have their own short guide
  var NOW_GUIDE = {
    follow: 'Head for a busy, well-lit place (an open building, a store or a group of people) and call **DPS at 213-740-4321** or **911**. Say where you are and what the person looks like. If it’s happening to a friend, call them, stay on the line, and tell DPS where they are.',
    intruder: 'Keep the door locked and don’t open it. Call **DPS at 213-740-4321** or **911**, give your building and room number, and stay on the line. If you can, move away from the door, ideally to a room you can lock.',
    lost: 'Call **911** first: on a trail or anywhere off campus, it’s the fastest way to get help to you. Stay where you are and stay together, keep your phone on and save its battery, and share your location in the call or with a friend.'
  };
  // a student going without food or a place to sleep ("plan tomorrow, i haven't eaten in days", "i got evicted and have
  // nowhere to sleep"). Read on the same spelled-out copy as the danger checks. Bare "starving" is everyday hunger.
  var NEED_CUE = /\b(?:have|has) not eaten (?:in|for|since|all)\b|\bnot eaten (?:in|for) \w+ (?:days?|meals?)\b|\bdid not eat (?:today|yesterday|all day|in days|for days)\b|\b(?:nothing|no food) (?:to eat|left to eat|at home|in my fridge)\b|\bno (?:money|cash) (?:for|to buy) (?:food|groceries|meals?)\b|\bcan not afford (?:to eat|food|groceries|meals?|rent|housing|my rent|a place to (?:live|stay))\b|\bfood insecur\w*|\bhomeless\w*|\bevicted\b|\beviction\b|\bkicked out of (?:my|our|the) (?:place|apartment|house|dorm|home)\b|\bnowhere to (?:sleep|stay|live)\b|\bno place to (?:sleep|stay|live)\b|\bsleeping in (?:my|our|a) car\b/;
  function needCue(n) { return NEED_CUE.test(dzCanon((n && (n.raw || n.t)) || '')); }
  TA.Hub.needCue = needCue;
  function dangerText(n) {
    if (!n || n.crisis || n.emergency) return null;
    var t = n.t || '', m3 = ASSAULT_3P.exec(t);
    if (m3) {
      var n3 = TA.NLU.parse(t.slice(0, m3.index) + 'i was attacked' + t.slice(m3.index + m3[0].length));
      if (n3.emergency || n3.crisis) { try { B.resolveCourses(n3); } catch (e) { /* optional */ } return n3; }
    }
    // happening-now emergencies: the student's own words, read as an emergency (and a medical one for injuries)
    var nk = nowDanger(t);
    if (nk) {
      var n4 = TA.NLU.parse(n.raw || t);
      if (!n4.crisis) { n4.emergency = true; n4.distress = false; n4.concern = false; n4.threat = false; if (nk.medical) n4.medical = true; }
      n4.nowDanger = nk.kind;
      try { B.resolveCourses(n4); } catch (e) { /* optional */ }
      return n4;
    }
    var m = ASSAULT_ADV.exec(t); if (!m) return null;
    var v = m[3], canon = m[1] === 'i' && /^(assaulted|attacked|mugged|robbed|raped)$/.test(v) ? 'i was ' + v : m[1] + ' got ' + (/^beat/.test(v) ? 'attacked' : v);
    var t2 = t.slice(0, m.index) + canon + t.slice(m.index + m[0].length), n2 = TA.NLU.parse(t2);
    if (!(n2.emergency || n2.crisis)) return null;
    try { B.resolveCourses(n2); } catch (e) { /* optional */ }
    return n2;
  }
  TA.Hub.dangerText = dangerText;
  // a waiting request a safety message must end: Hub flows and researched processes (whose free-text "details" slot
  // would otherwise swallow "my frat is hazing me" and show a confirm card); TA's health booking keeps its own rules
  function dropsOnSafety(p) { return !!p && p.aid !== 'book_health' && (HUB_IDS[p.aid] || /^proc:/.test(p.aid) || p.stage === 'slot'); }
  var route0 = B.route;
  B.route = async function (n, text, notes, meta) {
    var dz = dangerText(n); if (dz) { n = dz; text = dz.raw; arguments[0] = n; arguments[1] = text; }
    // a hazing/harassment/safety message while a Hub flow waits for a value (venue, time, event...) ends that flow,
    // so the original router's support and reporting answers run instead of "I didn't quite get that"
    // a student saying they have gone without food or a place to sleep ends it too, so USC's Student Basic Needs answer
    // comes first ("plan tomorrow, i haven't eaten in days" while "When do you want to pick it up?" waits)
    if (dropsOnSafety(B.pending) && !(meta && (meta.split || meta.r4Inner)) && !/^@/.test(String(text || '')) && !n.yes && !n.no && !n.cancel && !n.undo && (flagged(n) || needCue(n))) B.dropPending(notes || [], false);
    // a different, clear Hub command while a Hub flow waits for a slot value ("join a club" → "RSVP to ISA GlobeFeast")
    // starts the new request instead of being read as the slot's value
    if (B.pending && B.pending.stage === 'slot' && HUB_IDS[B.pending.aid] && !flagged(n) && !(meta && (meta.split || meta.r4Inner)) && !/^@/.test(String(text || '')) && !n.yes && !n.no && !n.cancel && !n.undo) {
      var sw = hubHit(n);
      if (sw && sw.action.id !== B.pending.aid && sw.score >= 0.9) { B.dropPending(notes || [], true); B.ctx.topic = n.raw; return B.start(sw.action, n); }
      // the same request said again ("rent a zipcar" while "When do you need the car?" waits) starts it over with
      // whatever the new message says, instead of "I didn't quite get that"
      if (sw && sw.action.id === B.pending.aid && sw.score >= 0.9 && !slotValue(n)) { B.dropPending(notes || [], true); B.ctx.topic = n.raw; return B.start(sw.action, n); }
    }
    // "when is the next bus?" / "what clubs am I in?" while a request waits: answer from the student's Hub data, keep the request
    if (B.pending && !flagged(n) && !(meta && (meta.split || meta.r4Inner)) && !/^@/.test(String(text || '')) && !n.yes && !n.no && !n.cancel && !n.undo) {
      var mya = myAnswer(n);
      if (mya) { var pa = TA.Actions.get(B.pending.aid); return mya.concat([{ role: 'bot', md: '_Your request' + (pa ? ' to ' + pa.title.charAt(0).toLowerCase() + pa.title.slice(1) : '') + ' is still waiting above. Answer it there, or say cancel._' }]); }
    }
    // "Tell me about <exact place/club name>" from the place / club sheets: the verified Hub record, even when the
    // name itself contains a word the safety nets watch ("Emergency Medical Services at USC"); a safety line is appended
    if (!B.pending && !(meta && (meta.split || meta.r4Inner)) && !/^@/.test(String(text || ''))) {
      var exA = exactAbout(n);
      if (exA) {
        if (flagged(n)) exA[exA.length - 1].md += '\n\n_If you or someone else is in danger, call **911** or USC DPS at **213-740-4321** (24/7). Counseling and Mental Health is available 24/7 at **213-740-9355**._';
        if (exA.kbExtra && !flagged(n)) {
          var key0 = exA.kbExtra, ex0 = [];
          try { ex0 = (await route0.call(this, n, text, notes, meta)) || []; } catch (e) { ex0 = []; }
          if (B.pending) { B.pending = null; ex0 = []; } // a KB passage never starts a flow here
          ex0 = ex0.filter(function (x) { return x && x.md && !x.card && norm(x.md).slice(0, 220).indexOf(key0) >= 0 && !/couldn.t find a clear answer|Day — Hours/i.test(x.md); }).slice(0, 1);
          if (ex0.length) { ex0[0] = Object.assign({}, ex0[0], { md: '**More from USC’s pages:**\n' + String(ex0[0].md).replace(/^Here’s the closest match I found on USC’s pages:\s*/, '') }); delete ex0[0].chips; return exA.concat(ex0); }
        }
        return exA;
      }
    }
    // a question asked while a flow waits for a free-text detail ("this class is killing me lol, are there afternoon
    // sections of CSCI 104?" during "order textbooks") is answered as a question; the request keeps waiting
    if (B.pending && B.pending.stage === 'slot' && !flagged(n) && sideQuestion(n, B.pending) && !(meta && (meta.split || meta.r4Inner)) && !/^@/.test(String(text || '')) && !n.yes && !n.no && !n.cancel && !n.undo) {
      var held = B.pending, ha = TA.Actions.get(held.aid), side = [];
      B.pending = null;
      try { side = (await B.route.call(this, n, text, notes, meta)) || []; } catch (e) { console.error(e); side = []; }
      if (B.pending) return side; // the question itself started a new request (that replaces the old one)
      B.pending = held;
      if (!side.length) side = [{ role: 'bot', md: 'I couldn’t find that on USC’s pages.' }];
      var hq = ha && ha.next ? ha.next(held.slots) : null;
      return hq ? side.concat([B.ask(hq, 'Back to your request — ')]) : side.concat([{ role: 'bot', md: '_Your request' + (ha ? ' to ' + ha.title.charAt(0).toLowerCase() + ha.title.slice(1) : '') + ' is still waiting above. Answer it there, or say cancel._' }]);
    }
    if ((supportCue(n) || needCue(n)) && B.ctx) B.ctx.lastAns = {}; // safety and basic-needs answers are never shortened to "that's what my last answer covers"
    // "my frat is hazing me, get me a lyft home": answer the hazing/harassment part with USC's support and reporting
    // resources FIRST and only offer the Hub action as a chip (never start a confirm flow from such a message)
    if (!(meta && (meta.split || meta.r4Inner)) && !/^@/.test(String(text || '')) && supportCue(n) && hubHit(n)) {
      var raw = String(n.raw || text || ''), parts = raw.split(/\s*(?:[,;.!?]+|\s(?:and|but|so|also|then|plus)\s)\s*/i).filter(function (x) { return x && x.trim().length > 1; });
      var cueP = parts.filter(function (x) { return supportCue(TA.NLU.parse(x)); }), rest = parts.filter(function (x) { return cueP.indexOf(x) < 0; }).join(', ');
      var supText = cueP.join(', ') || raw, supN = TA.NLU.parse(supText);
      var out = (await route0.call(this, supN, supText, notes, { r4Inner: false })) || [];
      if (!/213-740-(2500|4321|9355)/.test(JSON.stringify(out))) out.unshift(supportMsg());
      if (rest && hubHit(TA.NLU.parse(rest))) { var last = out[out.length - 1]; last.chips = (last.chips || []).concat([{ label: 'Also: ' + rest.slice(0, 32), value: rest, kind: 'action' }]); }
      return out;
    }
    if (!flagged(n) && !B.pending && !(meta && (meta.split || meta.r4Inner)) && !n.yes && !n.no && !n.cancel && !n.undo && !/^@/.test(String(text || ''))) {
      var h = hubHit(n);
      if (h) { B.ctx.topic = n.raw; return B.start(h.action, n); }
      var nav = navAnswer(n, text);
      if (nav && nav.kbExtra) { // "Tell me about <place>": Hub data first, then USC-page passages that are really about it
        var key = nav.kbExtra, extra = [];
        try { extra = (await route0.call(this, n, text, notes, meta)) || []; } catch (e) { extra = []; }
        extra = extra.filter(function (x) { return x && x.md && !x.card && norm(x.md).indexOf(key) >= 0 && !/couldn.t find a clear answer|Day — Hours/i.test(x.md) && norm(x.md).slice(0, 220).indexOf(key) >= 0; }).slice(0, 1);
        if (extra.length && !B.pending) { extra[0] = Object.assign({}, extra[0], { md: '**More from USC’s pages:**\n' + String(extra[0].md).replace(/^Here’s the closest match I found on USC’s pages:\s*/, '') }); delete extra[0].chips; return nav.concat(extra); }
        return nav;
      }
      if (nav) return nav;
    }
    return backstop(n, await route0.apply(this, arguments));
  };
  // "I feel unsafe walking home", "im scared to walk back alone", "walking home alone feels unsafe": first-person
  // unsafety about the walk itself. Not "I'm nervous about going home for Thanksgiving", "scared I'll fail my midterm",
  // "is my dog scared of walking at night" (anxiety or someone else), which keep their normal answer.
  var UNSAFE_WALK = /\b(?:i|im|i am)\s+(?:feel(?:ing)?\s+|am\s+|getting\s+)?(?:really |kinda |kind of |so |very |a bit |a little |pretty )?(?:unsafe|not safe|scared|afraid|frightened)\s+(?:to (?:walk|go|get|head)|walking|going|getting|heading)\s+(?:back\s+|home\s+)?(?:home|back|alone|by myself|at night|tonight|to (?:my|the) (?:dorm|room|apartment|car|village))\b|\b(?:walking|walk|going|getting) (?:home|back)(?: alone| by myself| at night| tonight)* (?:feels|is|seems) (?:unsafe|scary|sketchy|dangerous)\b/;
  TA.Hub.unsafeWalk = function (n) { return UNSAFE_WALK.test((n && n.t) || ''); };
  function supportMsg() { return { role: 'bot', kind: 'c', md: 'I’m sorry you’re dealing with this. It isn’t OK, and you don’t have to handle it alone.\n- **In danger right now:** call **911** or USC DPS at **213-740-4321** (24/7).\n- **Talk to someone, 24/7:** Counseling and Mental Health at **213-740-9355**.\n- **Report hazing, harassment or bullying** (you can stay anonymous): **USC Report & Response**, report.usc.edu or **213-740-2500**, 24/7.', sources: [{ url: 'https://campusactivities.usc.edu/programs/hazing-prevention/reporting/', title: 'Reporting Hazing – USC Campus Activities' }] }; }
  // safety backstop on the original router's answer: a hazing/harassment/bullying message never ends with an action
  // confirm card (any card a waiting request produced from it is removed and the request ends) and always gets the
  // support and reporting numbers first; first-person unsafety about walking gets DPS + the safe-walk route
  function backstop(n, out) {
    out = out || [];
    try {
      if (supportCue(n) && !(B.pending && B.pending.aid === 'book_health')) {
        var hadCard = out.some(function (x) { return x && x.card && x.card.type === 'confirm'; });
        if (hadCard) { out = out.filter(function (x) { return !(x && x.card && x.card.type === 'confirm'); }); if (B.pending && B.pending.stage === 'confirm') B.pending = null; }
      }
      // following / someone at the door / lost outdoors: one short "what to do now" under the emergency card
      if (n.nowDanger && NOW_GUIDE[n.nowDanger] && out.length === 1 && out[0] && out[0].card && out[0].card.tone === 'emergency') out.push({ role: 'bot', kind: 'c', md: NOW_GUIDE[n.nowDanger] });
      var js = JSON.stringify(out);
      if (supportCue(n) && !/213-740-(2500|4321|9355)/.test(js)) { out.unshift(supportMsg()); return out; }
      if (UNSAFE_WALK.test(n.t || '') && !/213-740-4321/.test(js)) {
        var sa = safeAnswer({ t: 'safest way home', raw: 'safest way home', times: n.times || [], dates: [] }) || [];
        var head = { role: 'bot', kind: 'c', md: 'If you feel unsafe right now, call **911** or USC DPS at **213-740-4321** (24/7), and stay where there are people and light.' + (lyftOpen() ? ' The free **USC Lyft** is running now if you’d rather ride.' : ''), chips: lyftOpen() ? [{ label: 'Free Lyft home', value: 'get me a lyft home', kind: 'action' }] : [] };
        var keep = out.filter(function (x) { return x && x.kind !== 'none' && x.kind !== 'off'; });
        return [head].concat(sa, keep);
      }
      // "I'm scared I'll fail my midterm": worry, not danger. The counseling line, never a DPS route
      if (/\b(scared|nervous|anxious|afraid|worried|terrified|stressed|freaking out)\b/.test(n.t || '') && /\b(fail\w*|midterms?|exams?|finals?|tests?|grades?|gpa|class|classes|course|presentation|interview|graduation|ceremony)\b/.test(n.t || '') && !/213-740-9355/.test(js) && out.length) {
        var lm = out[out.length - 1]; lm.md = (lm.md || '') + '\n\n_If the stress feels like too much, Counseling and Mental Health is there 24/7 at **213-740-9355**._';
      }
    } catch (e) { console.error(e); }
    return out;
  }
  // "@go:" chips are handled by embed.js before they reach the brain; "leave @club:ID" etc. are plain commands

  // receipts: Undo + the Hub screen that shows the result
  var next0 = B.nextSteps;
  B.nextSteps = function (aid) { var c = NEXT[aid]; if (c) return typeof c === 'function' ? c() : c.slice(); return next0.call(B, aid); };
  // the greeting's chips mix Trojan Hub actions in
  var starter0 = B.starterChips;
  B.starterChips = function (signed) {
    var c = starter0.call(B, signed) || [], chip = function (l, v, k) { return { label: l, value: v || l.toLowerCase(), kind: k || '' }; };
    if (signed) return [c[0], chip('Order me a coffee', 'order me a coffee', 'action'), chip('Join a club', 'join a club', 'action'), chip('Any free food today?', 'rsvp to a free food event', 'action')].filter(Boolean);
    return [chip('Where’s the closest open restroom?', 'where is the closest restroom')].concat(c.slice(0, 3));
  };
})();

