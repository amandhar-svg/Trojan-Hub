/* js/ta/hub-actions.js — Trojan Hub actions for Trojan Assist ("Ask Tommy").
 * Load AFTER js/ta/app.js and BEFORE TA.boot(). TA.Process.load() (run by boot) drops every
 * researched process that an already-registered action covers (score >= 0.8), so registering
 * first is what stops the generic "rsvp-campus-event" process from shadowing these.
 *
 * Data contract (provided by Trojan Hub, e.g. js/data.js built from research/clubs):
 *   TH.CLUBS        [{id, name, url, open, registered, meeting, ...}]   (clubs.min.json)
 *   TH.CLUB_EVENTS  [{id, title, org_id, org_name, start, end, location, url, ical_url, food_provided}] (events.json)
 */
(function () {
  'use strict';
  var TA = window.TA, TH = window.TH || (window.TH = {});
  var B = TA.Brain, def = TA._actionHelpers.def; // def() pushes onto TA.Actions.list (the same array)
  var D = function () { return TA.State.d; };

  // Everything the assistant changes for the Hub lives INSIDE TA.State.d, so
  //  - Brain.execute's snapshot/restore makes "Undo" revert it,
  //  - TA.State.save() persists it (localStorage "ta:state") and fires TA.State.on listeners,
  //  - Trojan Hub reads it for My Day and Wallet.
  function hub() {
    var d = D();
    return d.hub || (d.hub = { calendar: [], clubs: [], orders: [], passes: [], lines: [], rides: [], zips: [], upass: null, parkedAt: null });
  }
  TA.hub = hub;

  // ---------- lookups over Trojan Hub's real data ----------
  function norm(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function clubs() { return TH.CLUBS || []; }
  function clubById(id) { return clubs().find(function (c) { return c.id === id; }) || null; }
  function findClub(text) {
    var t = norm(text); if (t.length < 3) return null;
    var hits = clubs().filter(function (c) { var nm = norm(c.name); return nm === t || (t.indexOf(nm) >= 0 && nm.length >= 4) || (nm.indexOf(t) >= 0 && t.length >= 5); });
    hits.sort(function (a, b) { return (norm(b.name) === t) - (norm(a.name) === t) || (b.registered ? 1 : 0) - (a.registered ? 1 : 0) || norm(b.name).length - norm(a.name).length; });
    return hits[0] || null;
  }
  // skip all-day and multi-day "events" (office hours that span a semester) — they are not things to RSVP to
  function upcoming() { var now = TA.now(); return (TH.CLUB_EVENTS || []).filter(function (e) { return new Date(e.end || e.start) >= now && !e.all_day && !(e.multi_day_span_days > 1); }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); }); }
  function eventsFor(clubId) { return upcoming().filter(function (e) { return e.org_id === clubId; }); }
  function eventById(id) { return (TH.CLUB_EVENTS || []).find(function (e) { return String(e.id) === String(id); }) || null; }
  function findEvent(t) {
    t = norm(t); var best = null, bestLen = 0;
    upcoming().forEach(function (e) { var nm = norm(e.title); if (nm.length >= 6 && t.indexOf(nm) >= 0 && nm.length > bestLen) { best = e; bestLen = nm.length; } });
    return best;
  }
  // EngageSC times carry a UTC offset; always show them in campus time, whatever the device's zone
  var LA_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric' });
  var LA_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
  function when(e) { var s = new Date(e.start); return LA_DAY.format(s) + ', ' + LA_TIME.format(s) + (e.end ? '–' + LA_TIME.format(new Date(e.end)) : ''); }
  function addToCalendar(e, via) {
    var cal = hub().calendar;
    if (cal.some(function (x) { return x.ref === e.id; })) return false;
    cal.push({ id: TA.uid(), kind: 'event', ref: e.id, title: e.title, org: e.org_name, start: e.start, end: e.end, where: e.location || null, url: e.url, ical: e.ical_url, via: via });
    return true;
  }

  // ======================================================================
  // 1) NEW action: RSVP to an event and put it on My Day
  // ======================================================================
  var HUB_IDS = { hub_rsvp_event: 1, join_org: 1 };
  def({
    id: 'hub_rsvp_event', title: 'Save a campus event to My Day (RSVP)', scope: 'campuslife', icon: 'calendar',
    system: 'EngageSC (engage.usc.edu) + Trojan Hub calendar',
    // NLU entry point: return 0..1. >= 0.8 starts the flow; questions stay with the knowledge base.
    detect: function (n) {
      if (n.isQuestion && !n.polite) return 0;                   // "how do I RSVP?" is a question
      var verb = /\b(rsvp|add (it|this|that|.{3,60}) to my (calendar|day|schedule)|put (it|this|that|.{3,60}) on my (calendar|day)|save (the|this|that) event)\b/.test(n.t);
      if (!verb) return 0;
      return findEvent(n.t) ? 0.95 : 0.85;
    },
    init: function (n) { var e = findEvent(n.t); return { eventId: e ? e.id : null }; },
    // ask for whatever is missing; options with `sub` render as an option card, others as chips
    next: function (s) {
      if (s.eventId) return null;
      var list = upcoming().slice(0, 6);
      return { slot: 'eventId', md: list.length ? 'Which event?' : 'I don’t see any upcoming public events.', options: list.map(function (e) { return { label: e.title, sub: when(e) + ' · ' + e.org_name, value: '@ev:' + e.id }; }), placeholder: 'Or type the event name' };
    },
    fill: function (name, n, s, text) {
      if (name !== 'eventId') return false;
      var m = /@ev:(\d+)/.exec(text || ''), e = m ? eventById(m[1]) : findEvent(n.t);
      if (e) { s.eventId = e.id; return true; }
      return false;
    },
    // re-run right before execute: block = refuse, warn = yellow rows on the card, offers = chips
    check: function (s) {
      var o = { block: [], warn: [], offers: [] }, e = eventById(s.eventId);
      if (!e) o.block.push('I couldn’t find that event in EngageSC’s public calendar.');
      else if (new Date(e.end || e.start) < TA.now()) o.block.push('**' + e.title + '** has already ended.');
      else if (hub().calendar.some(function (x) { return x.ref === e.id; })) o.block.push('**' + e.title + '** is already on your calendar.');
      else if (e.external_registration) o.warn.push('This event uses its own registration page; I’ll add it to My Day, but register there too.');
      return o;
    },
    preview: function (s) {
      var e = eventById(s.eventId);
      return {
        title: 'RSVP and add to My Day',
        rows: [['Event', e.title], ['When', when(e)], ['Host', e.org_name], ['Where', e.location || 'Location shown to registered attendees on EngageSC']].concat(e.food_provided ? [['Food', 'Provided (per EngageSC)']] : []),
        notes: ['You’ll get a reminder in Trojan Hub before it starts.'],
        fine: ['Simulated RSVP. Event details are from EngageSC’s public event feed (Nov 9, 2026).'],
        sources: [{ url: e.url, title: e.title + ' – EngageSC' }]
      };
    },
    // mutate TA.State.d only; Brain.execute snapshots before, logs + saves after, and offers Undo
    run: function (s) {
      var e = eventById(s.eventId);
      addToCalendar(e, 'rsvp');
      D().life.rsvps.push({ id: e.id, title: e.title, at: TA.now().toISOString() });
      return { title: 'You’re going', rows: [['Event', e.title], ['When', when(e)], ['Added to', 'My Day']], log: 'RSVP’d to ' + e.title + ' (' + when(e) + ') and added it to My Day' };
    }
  });

  // ======================================================================
  // 2) OVERRIDE in place: join_org also adds the club's real events to My Day.
  //    Keep the id: brain.js special-cases 'join_org' (lines 4027, 5344, 5946, 5985, 6024).
  // ======================================================================
  var L = TA.Actions.list, ix = L.findIndex(function (a) { return a.id === 'join_org'; }), base = L[ix];
  // match the directory on the words the student typed (base.init strips "student", "club"... from the name)
  var JOIN_RE = /\b(?:join|sign up for|sign me up for|add me to|put me in|become a member of|apply to join|request to join)\s+(?:the\s+)?(.{3,80}?)[.!?]*$/i;
  function attach(s, raw) { var m = JOIN_RE.exec(String(raw || '')), c = (m && findClub(m[1])) || findClub(raw) || findClub(s.name || ''); if (c) { s.name = c.name; s.clubId = c.id; } return s; }
  L[ix] = Object.assign({}, base, {
    system: 'EngageSC (engage.usc.edu) + Trojan Hub calendar',
    init: function (n) { return attach(base.init.call(this, n) || {}, n.raw); },
    fill: function (name, n, s, text) { var ok = base.fill.call(this, name, n, s, text); if (ok) attach(s, text); return ok; },
    check: function (s) {
      var o = base.check.call(this, s); o.offers = o.offers || [];
      var c = s.clubId ? clubById(s.clubId) : null;
      if (!o.block.length && !c && clubs().length) o.block.push('I couldn’t find **' + s.name + '** in the EngageSC directory. Check the exact name at engage.usc.edu/club_signup.');
      if (c && !c.registered) o.warn.push('EngageSC marks this group “Not Registered Yet” for this year.');
      if (c && c.open === false) o.warn.push('Online joining is closed for this group on EngageSC, so the officers may ask you to reach out directly.');
      return o;
    },
    preview: function (s) {
      var pv = base.preview.call(this, s), c = s.clubId ? clubById(s.clubId) : null, ev = c ? eventsFor(c.id) : [];
      pv.rows = (pv.rows || []).concat([['Adds to My Day', ev.length ? ev.length + ' upcoming event' + (ev.length === 1 ? '' : 's') + ': ' + ev.slice(0, 3).map(function (e) { return e.title + ' (' + when(e) + ')'; }).join('; ') : 'No upcoming public events listed']]);
      if (c && c.meeting) pv.rows.push(['Meets', c.meeting.text || String(c.meeting)]);
      if (c) pv.sources = [{ url: c.url, title: c.name + ' – EngageSC' }];
      return pv;
    },
    run: function (s) {
      var r = base.run.call(this, s), c = s.clubId ? clubById(s.clubId) : null;
      if (c) {
        hub().clubs.push({ id: c.id, name: c.name, at: TA.now().toISOString() });
        var added = eventsFor(c.id).filter(function (e) { return addToCalendar(e, 'club:' + c.id); }).length;
        r.rows.push(['Added to My Day', added ? TA.plural(added, 'event') : 'No upcoming public events yet']);
        r.log += added ? ' and added ' + TA.plural(added, 'event') + ' to My Day' : '';
      }
      return r;
    }
  });

  // ======================================================================
  // 3) Routing: a confident Hub action wins over the brain's pre-action filters
  //    (B.misuse answers "order me a coffee" with "I can't place food orders", B.offTopic, quick facts...).
  //    Safety flags, pending flows, yes/no/cancel/undo and split questions still go to the original router.
  // ======================================================================
  function hubHit(n) { var h = TA.Actions.detect(n); return h && h.score >= 0.8 && HUB_IDS[h.action.id] ? h : null; }
  var route0 = B.route;
  B.route = async function (n, text, notes, meta) {
    var flagged = n.crisis || n.emergency || n.distress || n.disclose || n.hazing || n.threat || n.threatMe || n.violence || n.concern || n.medical || n.injury;
    if (!flagged && !B.pending && !(meta && (meta.split || meta.r4Inner)) && !n.yes && !n.no && !n.cancel && !n.undo && !/^@/.test(String(text || ''))) {
      var h = hubHit(n);
      if (h) { B.ctx.topic = n.raw; return B.start(h.action, n); }
    }
    return route0.apply(this, arguments);
  };
  TA.registerHubAction = function (a) { def(a); HUB_IDS[a.id] = 1; return a; };

  // receipts get a chip that jumps to the Hub screen (handled by embed.js: "@go:<screen>")
  var next0 = B.nextSteps;
  B.nextSteps = function (aid) { return HUB_IDS[aid] ? [{ label: 'Open My Day', value: '@go:plans', kind: '' }] : next0.call(B, aid); };
})();
