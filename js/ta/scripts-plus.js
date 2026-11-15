/* js/ta/scripts-plus.js — Part 7: many more Tommy Script command families over the real data this app already carries.
 *
 * Each family is ONE command with arguments, so it answers many concrete questions:
 *   course.when course="CSCI 104"  ·  place.hours place="evk" day="saturday"  ·  open.now cat="dining"  ·  my.dining
 * Sources (all on this device): USC Schedule of Classes (TA.SOC), places and hours (TH.PLACES), transport and safety
 * (TH.TRANSPORT, TH.SAFETY), academic calendar (TA.POLICY, TA.FINALS, TA.GE_LISTS), EngageSC clubs and events
 * (TH.CLUBS, TH.events()), and the student's own account (TA.State.d, TH.H()) which never leaves the device.
 * Answers never come from the AI: the translator only picks the command. Every answer cites its sources.
 *
 * On-device matching (`match`) is deliberately narrow: it only claims wording Trojan Assist's own brain answers badly
 * (checked on a 500+ question sample, before vs after). Everything else reaches these commands through the AI
 * translator, which sees them in TA.Script.catalog().
 * Load after course-info.js (and before faq.js). Defines TA.ScriptsPlus for faq.js and tests. */
(function () {
  'use strict';
  var TA = window.TA, TH = window.TH, TS = TA && TA.Script;
  if (!TS || !TS.cmds || !TH) return;
  var SOC = TA.SOC, X = TA.ScriptsPlus = { names: [], util: {} };

  // ============================================================================================ helpers
  var SRC = {
    soc: { url: 'https://classes.usc.edu/', title: 'USC Schedule of Classes' },
    finals: { url: 'https://arr.usc.edu/final-exam-schedule/', title: 'Final Exam Schedule – USC Registrar' },
    cal: { url: 'https://www.usc.edu/academic-calendar/', title: 'Academic Calendar – USC' },
    tuition: { url: 'https://arr.usc.edu/tuition-and-fees/', title: 'Tuition and Fees – USC Registrar' },
    hours: { url: 'https://hospitality.usc.edu/hours-of-operation/', title: 'Hours of Operation – USC Hospitality' },
    meal: { url: 'https://hospitality.usc.edu/meal-plan-options/', title: 'Meal Plan Options – USC Hospitality' },
    uscard: { url: 'https://mycard.usc.edu/', title: 'USCard Services' },
    lyft: { url: 'https://transnet.usc.edu/index.php/how-to-use-lyft/', title: 'USC Lyft Rides Program – USC Transportation' },
    bus: { url: 'https://transnet.usc.edu/index.php/bus-map-schedules/', title: 'Bus Map & Schedules – USC Transportation' },
    upass: { url: 'https://transnet.usc.edu/index.php/student-u-pass/', title: 'Student U-Pass – USC Transportation' },
    zipcar: { url: 'https://transnet.usc.edu/index.php/zipcar/', title: 'Zipcar – USC Transportation' },
    parking: { url: 'https://transnet.usc.edu/index.php/parking-rates/', title: 'Parking Rates – USC Transportation' },
    fee: { url: 'https://transnet.usc.edu/index.php/student-transportation-fee/', title: 'Student Transportation Fee – USC Transportation' },
    gameday: { url: 'https://transnet.usc.edu/index.php/gameday/', title: 'Game Day – USC Transportation' },
    metrolink: { url: 'https://transnet.usc.edu/index.php/metrolink-student-pass/', title: 'Metrolink Student Pass – USC Transportation' },
    bikes: { url: 'https://dps.usc.edu/services/bikes/', title: 'Bicycle Registration – USC DPS' },
    dps: { url: 'https://dps.usc.edu/contact/', title: 'Contact – USC Department of Public Safety' },
    access: { url: 'https://dps.usc.edu/services/visitor-registration/', title: 'Visitor Registration – USC DPS' },
    engage: { url: 'https://engage.usc.edu/', title: 'EngageSC' },
    rec: { url: 'https://recsports.usc.edu/rec-facilities/operating-hours/', title: 'Operating Hours – USC Recreational Sports' },
    lib: { url: 'https://libraries.usc.edu/hours', title: 'Library Hours – USC Libraries' },
    history: { url: 'https://www.usc.edu/we-are-usc/the-university/our-history/', title: 'Our History – USC' }
  };
  var ACCT = { url: 'https://my.usc.edu/', title: 'Your account (demo data on this device)' };
  function bot(md, sources, chips) { return { role: 'bot', kind: 'c', md: md, chips: chips || [], sources: (sources || []).filter(Boolean) }; }
  function go(label, screen, arg) { return { label: label, value: '@go:' + screen + (arg != null ? ':' + arg : ''), kind: '' }; }
  function say(label, value) { return { label: label, value: value || label.toLowerCase(), kind: '' }; }
  function srcOf(url, title) { return url ? { url: url, title: title || url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') } : null; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function words(s) { return norm(s).split(' ').filter(Boolean); }
  function now() { return TA.now(); }
  function minOf(d) { return d.getHours() * 60 + d.getMinutes(); }
  function fmtMin(m) { return TH.fmtMin ? TH.fmtMin(((m % 1440) + 1440) % 1440) : TA.fmtTime(String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function list(a, n) { a = a.filter(Boolean); return a.slice(0, n || 8).map(function (x) { return '- ' + x; }).join('\n') + (a.length > (n || 8) ? '\n- …and ' + (a.length - (n || 8)) + ' more' : ''); }
  function dk(d) { return TH.dkey(d); }
  function dayStart(d) { return TH.dayStart(d); }
  function addDays(d, n) { return TH.addDays(d, n); }
  function dLabel(d) { var t = dayStart(now()), k = dk(d); return k === dk(t) ? 'today' : k === dk(addDays(t, 1)) ? 'tomorrow' : TH.fmtDate(d); }
  function fmtD(d) { return TH.fmtDate(d); }
  function iso2date(k) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  var WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var WDS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, weds: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  // "today" | "tomorrow" | weekday | "YYYY-MM-DD" | "this weekend" -> {d: Date, label, weekend?}
  function dayArg(v, raw) {
    var t = norm(v || ''), base = dayStart(now());
    if (!t && raw) t = norm(raw);
    if (/\b(tomorrow|tmrw|tmr|tomorow)\b/.test(t)) return { d: addDays(base, 1), label: 'tomorrow' };
    if (/\b(this )?weekend\b/.test(t)) { var sat = addDays(base, (6 - base.getDay() + 7) % 7); return { d: sat, label: 'this weekend', weekend: true }; }
    var HOL = { thanksgiving: '2026-11-26', 'veterans day': '2026-11-11', 'black friday': '2026-11-27', christmas: '2026-12-25', 'christmas eve': '2026-12-24', 'new years eve': '2026-12-31', 'new years': '2027-01-01', 'new years day': '2027-01-01', 'mlk day': '2027-01-18', 'martin luther king': '2027-01-18', 'presidents day': '2027-02-15', 'game day': (TH.gameDays ? TH.gameDays()[0] : null) };
    var hk = Object.keys(HOL).sort(function (x, y) { return y.length - x.length; }).filter(function (k) { return HOL[k] && new RegExp('\\b' + k + '\\b').test(t); })[0];
    if (hk) { var hd = iso2date(HOL[hk]); return { d: hd, label: cap(hk) + ' (' + fmtD(hd) + ')' }; }
    var m = /\b(\d{4}-\d{2}-\d{2})\b/.exec(String(v || raw || ''));
    if (m) { var dd = iso2date(m[1]); return { d: dd, label: fmtD(dd) }; }
    for (var i = 0; i < 7; i++) {
      if (new RegExp('\\b' + WD[i] + 's?\\b').test(t) || Object.keys(WDS).some(function (k) { return WDS[k] === i && new RegExp('\\b' + k + '\\b').test(t); })) {
        var off = (i - base.getDay() + 7) % 7; if (/\bnext\b/.test(t) && off === 0) off = 7;
        var d2 = addDays(base, off); return { d: d2, label: off === 0 ? 'today' : off === 1 ? 'tomorrow' : cap(WD[i]) + ' (' + fmtD(d2) + ')' };
      }
    }
    if (v && !/\b(today|tonight|now)\b/.test(t)) {
      try { var n = TA.NLU.parse(String(v)); if (n.dates && n.dates[0]) { var d3 = iso2date(String(n.dates[0]).slice(0, 10)); if (d3) return { d: d3, label: fmtD(d3) }; } } catch (e) { /* no date */ }
    }
    return { d: base, label: 'today', today: true };
  }
  function fdt(x) { var d = typeof x === 'string' ? TA.parseISO(x) : x; return d ? TA.fmtDateTime(d) : String(x || ''); }
  function signedIn() { return !!(TA.State && TA.State.d && TA.State.d.signedIn); }
  function needSignIn() { return [bot('Please sign in with your USC account so I can check your account. Your account data stays on this device.', [], [say('Sign in', 'sign in')])]; }
  function D() { return TA.State.d; }
  function H() { return TH.H ? TH.H() : (D().hub || {}); }
  X.util = { norm: norm, words: words, bot: bot, dayArg: dayArg, srcOf: srcOf, list: list, SRC: SRC };

  // define a family. match(t, raw) -> args | null (on-device). run(args) -> messages.
  function F(name, about, args, run, match) {
    TS.cmds[name] = {
      name: name, about: about, args: args || [], plus: true,
      match: match || function () { return null; },
      run: function (a) {
        try { var out = run(a || {}); return out && out.length ? out : [bot('I don’t have that in my data. Try asking another way.')]; }
        catch (e) { console.error('[scripts-plus] ' + name, e); return [bot('Sorry, I hit an error looking that up. Nothing was changed.')]; }
      }
    };
    X.names.push(name);
  }
  X.F = F;

  // ============================================================================================ COURSES
  var TERM = function () { return ((TA.POLICY || {}).terms || {}); };
  function termIds(term) {
    var ids = Object.keys((SOC && SOC.terms) || {}).sort(), t = norm(term);
    if (/spring|2027|next/.test(t)) return ids.filter(function (id) { return /spring/i.test(SOC.label(id)); });
    if (/fall|2026|this|current/.test(t)) return ids.filter(function (id) { return /fall/i.test(SOC.label(id)); });
    return ids;
  }
  var CSTOP = /\b(who|whos|which|what|whats|when|where|how|many|much|does|do|is|are|was|the|for|of|in|at|on|usc|class|classes|course|courses|this|next|semester|term|fall|spring|2026|2027|it|my|me|tell|please|can|you|u|i|a|an|about|info|information|details|meet|meets|meeting|time|times|days|seats?|left|open|units?|credits?|prereqs?|prerequisites?|requirements?|ge|final|exam|description|sections?|clearance|offered|taught|teach|teaches|have|has|need|any|there|still|get|take|taking|to|be|will|count|counts|toward|towards|and|or)\b/g;
  function topicOf(q) { return norm(q).replace(CSTOP, ' ').replace(/\s+/g, ' ').trim(); }
  function titleScore(c, q) {
    var qw = words(q).map(function (w) { return w === 'intro' ? 'introduction' : w === 'calc' ? 'calculus' : w; }), tw = words(c.title);
    var hit = qw.filter(function (w) { return tw.some(function (x) { return x === w || (w.length > 3 && x.indexOf(w) === 0); }); }).length;
    var extra = tw.filter(function (x) { return !/^(to|and|of|the|in|for|a|an|i|ii|iii|iv)$/.test(x) && !qw.some(function (w) { return x === w || x.indexOf(w) === 0; }); }).length;
    return { hit: hit, extra: extra, ok: hit > 0 && hit >= Math.min(2, qw.length) };
  }
  // course text -> [{term, c}] best first (codes exact; names by title match)
  function findCourse(q, term) {
    if (!SOC || !SOC.ready) return null;
    var ids = termIds(term), codes = codesIn(String(q || '')), found = [], tq = topicOf(q) || norm(q);
    if (!codes.length) { var m = /\b([a-z]{2,4})[ -]?(\d{3}[a-z]?)\b/i.exec(String(q || '')); if (m) codes = [m[1].toUpperCase() + ' ' + m[2].toUpperCase()]; }
    ids.forEach(function (id, ti) {
      if (codes.length) { codes.forEach(function (code) { var c = SOC.course(id, code); if (c) found.push({ term: id, c: c, hit: 9, extra: 0, ti: ti }); }); return; }
      if (tq.length < 3) return;
      SOC.search(id, tq, { limit: 12 }).forEach(function (c) { var s = titleScore(c, tq); if (s.ok) found.push({ term: id, c: c, hit: s.hit, extra: s.extra, ti: ti }); });
    });
    found.sort(function (a, b) { return b.hit - a.hit || a.extra - b.extra || a.ti - b.ti; });
    return { list: found, codes: codes, ids: ids };
  }
  function courseOr(a, fn, termPref) {
    if (!SOC || !SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
    var q = String(a.course || '').trim();
    if (!q) return [bot('Which class? Tell me the code (like **CSCI 104**) or its name.')];
    var r = findCourse(q, a.term);
    if (!r.list.length) return [bot('I couldn’t find **' + q + '** in USC’s Schedule of Classes for ' + r.ids.map(function (i) { return SOC.label(i); }).join(' and ') + '. Try the course code (like **CSCI 104**).', [SRC.soc])];
    var best = r.list[0];
    // same course in both terms: pick the preferred term unless the student named one
    if (!a.term && termPref) { var pref = r.list.filter(function (f) { return f.c.code === best.c.code && /spring/i.test(SOC.label(f.term)) === (termPref === 'spring'); })[0]; if (pref) best = pref; }
    var other = r.list.filter(function (f) { return f.c.code === best.c.code && f.term !== best.term; })[0];
    return fn(best.c, best.term, other, r.list);
  }
  var ALLC = {};
  // every course of a term as Schedule of Classes objects (cached; SOC.byTerm holds raw rows)
  function allCourses(id) {
    if (ALLC[id]) return ALLC[id];
    var mp = SOC && SOC.byTerm && SOC.byTerm[id], out = new Map();
    if (mp) mp.forEach(function (row, code) { var c = null; try { c = SOC.toCourse(row); } catch (e) { c = null; } if (c) out.set(code, c); });
    return (ALLC[id] = out);
  }
  function live(c) { return (c.sections || []).filter(function (s) { return !s.cancelled; }); }
  function meetTxt(s) {
    if (!s.meets || !s.meets.length) return 'time TBA';
    return s.meets.map(function (m) { return (m.days ? TA.fmtDays(m.days) + ' ' : '') + (m.start && m.start !== 'TBA' ? TA.fmtTime(m.start) + '–' + TA.fmtTime(m.end) : 'time TBA'); }).join('; ');
  }
  function head(c, term) { return '**' + c.code + ' · ' + c.title + '** (' + SOC.label(term) + ')'; }
  function alsoTerm(other) { return other ? '\n\n_Also offered in ' + SOC.label(other.term) + '._' : ''; }
  var SOC_NOTE = '\n\n_From USC’s Schedule of Classes as collected Nov 9, 2026. Check classes.usc.edu before you register._';
  function socSrc(term) { return [{ url: SRC.soc.url, title: 'USC Schedule of Classes – ' + SOC.label(term) }]; }
  function lectures(c) { var L = live(c).filter(function (s) { return /lec/i.test(s.type); }); return L.length ? L : live(c); }
  // on-device: a course code plus a cue word, never a personal/account or action request
  function courseCue(re, not) {
    return function (t, raw) {
      if (!re.test(t) || (not && not.test(t)) || /\b(my|register|enroll|add me|drop|sign me up|swap|waitlist me)\b/.test(t)) return null;
      var codes = codesIn(raw);
      if (codes.length !== 1) return null;
      var term = /\bspring\b/.test(t) ? 'spring' : /\bfall\b/.test(t) ? 'fall' : undefined;
      return term ? { course: codes[0], term: term } : { course: codes[0] };
    };
  }

  function codesIn(raw) {
    var c = (TA.NLU.parse(raw).courses || []).slice(), re = /\b([a-z]{2,4})[ -]?(\d{3}[a-z]?)\b/gi, m;
    while ((m = re.exec(String(raw || '')))) { var k = m[1].toUpperCase() + ' ' + m[2].toUpperCase(); if (c.indexOf(k) < 0 && SOC && SOC.ready && Object.keys(SOC.terms || {}).some(function (id) { return SOC.byTerm[id] && SOC.byTerm[id].has(k); })) c.push(k); }
    return c;
  }
  X.codesIn = codesIn;
  F('course.when', 'When a USC course meets: days, times, instructor per section. "when does CSCI 104 meet", "what time is math 226", "is writ 150 on fridays". course; term? fall|spring',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term, other) {
        var secs = live(c), L = secs.filter(function (s) { return /lec|sem|studio/i.test(s.type); }); if (!L.length) L = secs;
        var md = head(c, term) + ' meets:\n' + list(L.map(function (s) { return s.type + ' ' + s.id + ' · ' + meetTxt(s) + (s.instr ? ' · ' + s.instr : ''); }), 8);
        var rest = secs.filter(function (s) { return L.indexOf(s) < 0; });
        if (rest.length) md += '\n\nPlus ' + rest.length + ' ' + Array.from(new Set(rest.map(function (s) { return s.type.toLowerCase(); }))).join('/') + ' section' + (rest.length > 1 ? 's' : '') + ' (you pick one when you register).';
        return [bot(md + alsoTerm(other) + SOC_NOTE, socSrc(term))];
      });
    }, courseCue(/\b(when|what time|which days?|what days?)\b.{0,30}\b(meet|meets|is|are|does|on)\b|\bmeeting times?\b|\bclass times?\b|\b(days and times|lecture times?|schedule for)\b/, /\b(final|exam|midterm|due|office hours?|register|registration|drop)\b/));

  F('course.seats', 'Open seats in a USC course, per section (Schedule of Classes). "is csci 201 full", "how many seats left in econ 203", "any spots open in psyc 100". course; term?',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term, other) {
        var secs = live(c).filter(function (s) { return s.seats; }), L = secs.filter(function (s) { return /lec/i.test(s.type); }); if (!L.length) L = secs;
        var open = L.reduce(function (n, s) { return n + SOC.seatsLeft(s); }, 0), tot = L.reduce(function (n, s) { return n + (s.seats || 0); }, 0);
        var md = head(c, term) + ': **' + open + ' of ' + tot + ' ' + (L === secs ? '' : 'lecture ') + 'seats open**.\n' + list(L.map(function (s) { var l = SOC.seatsLeft(s); return s.type + ' ' + s.id + ' · ' + meetTxt(s) + ' · ' + (l ? l + ' of ' + s.seats + ' open' : '**full**') + (s.d ? ' · D-clearance' : ''); }), 8);
        return [bot(md + alsoTerm(other) + '\n\n_Seat counts as collected Nov 9, 2026; they change as students register._', socSrc(term), [say('Who teaches it?', 'who teaches ' + c.code)])];
      }, 'spring');
    }, courseCue(/\b(seats?|spots?|full|space|room left|openings?|capacity|class size|how big)\b/, /\b(parking|stadium|game|lyft|bus|study room)\b/));

  F('course.units', 'How many units a USC course is worth. "how many units is writ 150", "is csci 104 4 units", "credits for math 125". course',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term, other) {
        var u = Array.from(new Set(live(c).map(function (s) { return String(s.units || '').replace(/\.0$/, ''); }).filter(function (x) { return x && x !== '0'; })));
        return [bot(head(c, term) + ' is **' + (c.units || u.join(' or ')) + ' unit' + (String(c.units) === '1' ? '' : 's') + '**.' + (u.length > 1 ? ' Sections list ' + u.join(', ') + ' units.' : '') + alsoTerm(other), socSrc(term))];
      });
    }, courseCue(/\b(units?|credits?|credit hours)\b/, /\b(max|maximum|overload|how many units (can|should|do) i)\b/));

  F('course.prereqs', 'Prerequisites, corequisites and restrictions of a USC course. "prereqs for csci 201", "what do i need before math 226", "can freshmen take econ 351". course',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term, other) {
        var or = function (g) { return g.join(' or '); };
        var md = head(c, term) + '\n- **Prerequisite:** ' + (c.prereq && c.prereq.length ? c.prereq.map(or).join(' **and** ') : 'none listed') +
          '\n- **Corequisite:** ' + (c.coreq && c.coreq.length ? c.coreq.map(or).join(' and ') : 'none listed') +
          (c.restr ? '\n- **Restriction:** ' + c.restr : '') + (c.dup ? '\n- **Duplicates credit in:** ' + c.dup : '');
        return [bot(md + '\n\n_Groups joined by “or” mean any one of them. From the Schedule of Classes._', socSrc(term))];
      });
    }, courseCue(/\b(prereq\w*|pre req\w*|prerequisite\w*|coreq\w*|co req\w*|corequisite\w*|requirements? (for|to take)|need (to take )?before|restricted|restriction)\b/));

  F('course.ge', 'Which GE categories a USC course counts for (GE course lists). "does ahis 120 count for ge", "what ge is psyc 100". course',
    ['course'], function (a) {
      var code = (TA.NLU.parse(String(a.course || '')).courses || [])[0] || String(a.course || '').toUpperCase().trim();
      var g = SOC && SOC.geFor ? SOC.geFor(code) : [];
      if (!g.length) {
        var r = findCourse(a.course); if (r && r.list.length) { code = r.list[0].c.code; g = SOC.geFor(code); if (!g.length && r.list[0].c.ge) g = [{ cat: r.list[0].c.ge, title: 'GE ' + r.list[0].c.ge, url: 'https://dornsife.usc.edu/ge/' }]; }
      }
      if (!g.length) return [bot('**' + code + '** isn’t on any of the GE Program’s course lists I carry. Check your STARS report or the GE site for how a course applies to you.', [{ url: 'https://dornsife.usc.edu/ge/', title: 'USC General Education' }])];
      return [bot('**' + code + '** is on the GE Program’s **' + g.map(function (x) { return x.title; }).join('** and **') + '** list' + (g.length > 1 ? 's' : '') + '.\n\nYour **STARS report** shows how it applies to your own requirements.', g.map(function (x) { return { url: x.url, title: x.title + ' – USC GE' }; }))];
    });

  F('course.final', 'Final exam day and time for a USC course (Registrar’s final exam schedule). "when is the final for csci 104", "math 226 final exam date". course; term?',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term) {
        var L = lectures(c), lines = [], seen = {};
        L.forEach(function (s) {
          var m = (s.meets || [])[0]; if (!m || !m.start || m.start === 'TBA') return;
          var f = SOC.finalFor(term, c.code, m.days, m.start, m.end); if (!f) return;
          var k = f.day + f.hour; if (seen[k]) { seen[k].push(s.id); return; } seen[k] = [s.id];
          lines.push({ f: f, s: s, ids: seen[k] });
        });
        var F2 = (TA.FINALS || {})[term] || {};
        if (!lines.length) return [bot(head(c, term) + ': I can’t work out its final from the schedule (no regular lecture time). Finals for ' + SOC.label(term) + ' run **' + (F2.dates || '') + '**; your instructor confirms the slot.', [SRC.finals])];
        var md = head(c, term) + ' final exam:\n' + list(lines.map(function (x) { return '**' + x.f.day + ', ' + x.f.hour + '**' + (lines.length > 1 ? ' (lecture ' + x.ids.join(', ') + ' · ' + meetTxt(x.s) + ')' : ''); }));
        return [bot(md + '\n\n_From the Registrar’s Final Exam Schedule (finals ' + (F2.dates || '') + '). Your instructor can confirm the room._', [SRC.finals, socSrc(term)[0]])];
      }, 'fall');
    }, courseCue(/\b(final|finals)\b/, /\b(grade|need on|need to get|score)\b/));

  F('course.about', 'What a USC course is about (official description). "what is csci 270 about", "describe ling 115", "whats covered in econ 203". course',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term, other) {
        return [bot(head(c, term) + ' · ' + c.units + ' units\n\n' + (c.desc || 'USC’s schedule has no description for this course.') + alsoTerm(other), socSrc(term), [say('When does it meet?', 'when does ' + c.code + ' meet'), say('Prereqs', 'prereqs for ' + c.code)])];
      });
    }, courseCue(/\b(about|description|describe|covers?|covered|cover|topics?|what is)\b/, /\b(final|seats?|prereq\w*|units?|teach\w*|when|time|ge)\b/));

  F('course.sections', 'All sections of a USC course: type, ID, days/times, instructor, seats. "sections of csci 103", "list the labs for phys 151", "discussion times for econ 203". course; term?; type? lecture|lab|discussion|quiz',
    ['course', 'term', 'type'], function (a) {
      return courseOr(a, function (c, term, other) {
        var ty = norm(a.type), secs = live(c).filter(function (s) { return !ty || norm(s.type).indexOf(ty.slice(0, 3)) === 0; });
        if (!secs.length) return [bot(head(c, term) + ' has no ' + (ty || '') + ' sections listed.', socSrc(term))];
        return [bot(head(c, term) + ' · ' + secs.length + ' ' + (ty ? ty + ' ' : '') + 'section' + (secs.length > 1 ? 's' : '') + ':\n' + list(secs.map(function (s) { return s.type + ' ' + s.id + ' · ' + meetTxt(s) + ' · ' + (s.instr || 'instructor TBA') + (s.seats ? ' · ' + SOC.seatsLeft(s) + '/' + s.seats + ' open' : '') + (s.d ? ' · D-clearance' : ''); }), 14) + alsoTerm(other) + SOC_NOTE, socSrc(term))];
      });
    }, courseCue(/\b(sections?|labs?|discussions?|quiz sections?|lab times|discussion times)\b/, /\b(seats?|final|lab report|homework)\b/));

  F('course.dclear', 'Whether a USC course or section needs D-clearance (department clearance). "does csci 104 need d clearance", "is mus 101 d clearance". course; term?',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term) {
        var secs = live(c), d = secs.filter(function (s) { return s.d; });
        var md = head(c, term) + ': ' + (!d.length ? '**no D-clearance** listed on any section.' : d.length === secs.length ? '**every section needs D-clearance** from the department.' : '**' + d.length + ' of ' + secs.length + ' sections need D-clearance**:\n' + list(d.map(function (s) { return s.type + ' ' + s.id + ' · ' + meetTxt(s); })));
        return [bot(md + '\n\nD-clearance comes from the department that offers the course, not from the Registrar.' + SOC_NOTE, socSrc(term))];
      }, 'spring');
    }, courseCue(/\b(d ?clearance|d clear|dept clearance|department clearance)\b/));

  F('course.offered', 'Which terms (Fall 2026 / Spring 2027) a USC course is offered. "is csci 360 offered in spring", "when is phil 140 offered", "can i take math 407 next semester". course',
    ['course'], function (a) {
      if (!SOC || !SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
      var r = findCourse(a.course); if (!r || !r.list.length) return [bot('I couldn’t find **' + (a.course || 'that course') + '** in the Fall 2026 or Spring 2027 Schedule of Classes.', [SRC.soc])];
      var code = r.list[0].c.code, ins = r.ids.map(function (id) { var c = SOC.course(id, code); return { id: id, c: c, n: c ? live(c).length : 0 }; });
      var on = ins.filter(function (x) { return x.n; }), off = ins.filter(function (x) { return !x.n; });
      var md = '**' + code + ' · ' + r.list[0].c.title + '** is offered in **' + on.map(function (x) { return SOC.label(x.id) + '** (' + x.n + ' section' + (x.n > 1 ? 's' : '') + ')'; }).join(' and **') +
        (off.length ? '. It isn’t on the ' + off.map(function (x) { return SOC.label(x.id); }).join(' or ') + ' schedule.' : '.');
      return [bot(md + '\n\n_I only carry Fall 2026 and Spring 2027._', [SRC.soc])];
    }, courseCue(/\b(offered|available|offering|taught in|is there a)\b.{0,25}\b(spring|fall|next semester|next term|this semester)\b|\bwhen is .{2,12} offered\b/));

  F('course.find', 'Find USC courses on a topic, optionally only ones with open seats or on certain days. "classes about machine learning", "easy film classes in spring", "psychology courses on fridays". topic; term?; days? like "MW"; open? yes',
    ['topic', 'term', 'days', 'open'], function (a) {
      if (!SOC || !SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
      var q = String(a.topic || '').trim(); if (!q) return [bot('What topic? For example “classes about machine learning”.')];
      var ids = termIds(a.term || 'spring'), out = [], dset = String(a.days || '').toUpperCase().replace(/[^MTWHF]/g, '');
      ids.forEach(function (id) {
        SOC.search(id, q, { limit: 30 }).forEach(function (c) {
          var secs = live(c);
          if (dset) secs = secs.filter(function (s) { return (s.meets || []).some(function (m) { return dset.split('').every(function (ch) { return String(m.days || '').indexOf(ch) >= 0; }); }); });
          if (/^(y|yes|true|1)/i.test(String(a.open || ''))) secs = secs.filter(function (s) { return SOC.seatsLeft(s) > 0; });
          if (secs.length) out.push({ id: id, c: c, secs: secs });
        });
      });
      if (!out.length) return [bot('I didn’t find ' + SOC.label(ids[0]) + ' courses matching **' + q + '**' + (dset ? ' on ' + TA.fmtDays(dset) : '') + '. Try a broader word.', [SRC.soc])];
      return [bot('**' + SOC.label(out[0].id) + '** courses matching **' + q + '**' + (dset ? ' (meeting ' + TA.fmtDays(dset) + ')' : '') + ':\n' + list(out.map(function (x) { var s = x.secs[0]; return '**' + x.c.code + '** ' + x.c.title + ' · ' + x.c.units + ' units · ' + meetTxt(s) + (x.secs.length > 1 ? ' (+' + (x.secs.length - 1) + ' more)' : ''); }), 10) + SOC_NOTE, socSrc(out[0].id))];
    });

  F('course.prof', 'Which courses a given instructor teaches (Schedule of Classes). "what does professor slocum teach", "classes taught by mark redekopp". name; term?',
    ['name', 'term'], function (a) {
      if (!SOC || !SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
      var nw = words(a.name).filter(function (w) { return !/^(prof|professor|dr|mr|ms|mrs|instructor|teacher)$/.test(w) && w.length > 1; });
      if (!nw.length) return [bot('Which instructor? Tell me a last name.')];
      var out = [];
      termIds(a.term).forEach(function (id) {
        allCourses(id).forEach(function (c, code) {
          if (!c || !c.sections) return;
          var who = null;
          c.sections.forEach(function (s) { if (s.cancelled || !s.instr) return; String(s.instr).split(/\s*,\s*/).forEach(function (n) { var w = words(n); if (nw.every(function (x) { return w.indexOf(x) >= 0; })) who = n; }); });
          if (who) out.push({ id: id, c: c, who: who });
        });
      });
      if (!out.length) return [bot('No sections taught by **' + a.name + '** in ' + termIds(a.term).map(function (i) { return SOC.label(i); }).join(' or ') + ' as of Nov 9, 2026.', [SRC.soc])];
      var names = Array.from(new Set(out.map(function (x) { return x.who; })));
      return [bot((names.length > 1 ? 'Instructors matching **' + a.name + '** (' + names.slice(0, 4).join(', ') + ')' : '**' + names[0] + '**') + ' teach' + (names.length > 1 ? '' : 'es') + ':\n' + list(out.map(function (x) { return '**' + x.c.code + '** ' + x.c.title + ' · ' + SOC.label(x.id) + (names.length > 1 ? ' · ' + x.who : ''); }), 12) + SOC_NOTE, [SRC.soc])];
    }, function (t, raw) {
      var m = /\b(?:what|which) (?:classes|courses|class|course)? ?(?:does|is) (?:prof(?:essor)?|dr\.?) ([a-z][a-z' -]{2,30}?) (?:teach|teaching)\b/.exec(t) || /\b(?:classes|courses) (?:taught by|by) (?:prof(?:essor)? |dr\.? )?([a-z][a-z' -]{2,30})$/.exec(t);
      return m ? { name: m[1].trim() } : null;
    });

  F('course.section', 'Details of one USC section by its 5-digit section number. "section 29903", "what class is section 30119", "is 29905 full". section; term?',
    ['section', 'term'], function (a) {
      if (!SOC || !SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
      var id = (/\b(\d{5})\b/.exec(String(a.section || '')) || [])[1]; if (!id) return [bot('Which section? Give me the 5-digit section number.')];
      var hits = [];
      termIds(a.term).forEach(function (t) { allCourses(t).forEach(function (c) { (c.sections || []).forEach(function (s) { if (s.id === id) hits.push({ t: t, c: c, s: s }); }); }); });
      if (!hits.length) return [bot('Section **' + id + '** isn’t in the Fall 2026 or Spring 2027 schedule I carry.', [SRC.soc])];
      return [bot(hits.map(function (h) { var s = h.s; return head(h.c, h.t) + '\n- ' + s.type + ' **' + s.id + '** · ' + meetTxt(s) + '\n- Instructor: ' + (s.instr || 'not listed') + '\n- Seats: ' + (s.seats ? SOC.seatsLeft(s) + ' of ' + s.seats + ' open' : 'not listed') + '\n- Units: ' + String(s.units || h.c.units).replace(/\.0$/, '') + (s.d ? '\n- **D-clearance required**' : '') + (s.cancelled ? '\n- **Cancelled**' : '') + (s.notes ? '\n- Note: ' + s.notes : ''); }).join('\n\n') + SOC_NOTE, socSrc(hits[0].t))];
    }, function (t, raw) { var m = /\bsection (?:number |#)?(\d{5})\b/.exec(t) || (/^(what|which) (class|course) is (\d{5})$/.exec(t) || [])[3]; return m ? { section: Array.isArray(m) ? m[1] : m } : null; });

  F('course.dept', 'List the courses a department (prefix) offers in a term. "what CSCI classes are offered in spring", "list of math courses", "all ECON 300-level classes". prefix like CSCI; term?; level? like 300',
    ['prefix', 'term', 'level'], function (a) {
      if (!SOC || !SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
      var pre = String(a.prefix || '').toUpperCase().replace(/[^A-Z]/g, ''), id = termIds(a.term || 'spring')[0], map = {};
      allCourses(id).forEach(function (c, k) { map[k] = c; });
      var lv = (/(\d)/.exec(String(a.level || '')) || [])[1];
      var codes = Object.keys(map).filter(function (k) { return k.split(' ')[0] === pre && (!lv || (k.split(' ')[1] || '').charAt(0) === lv) && live(map[k]).length; }).sort(function (x, y) { return parseInt(x.split(' ')[1], 10) - parseInt(y.split(' ')[1], 10); });
      if (!codes.length) return [bot('I don’t see ' + (lv ? lv + '00-level ' : '') + '**' + (pre || a.prefix) + '** courses in the ' + SOC.label(id) + ' schedule.', [SRC.soc])];
      return [bot('**' + pre + '** ' + (lv ? lv + '00-level ' : '') + 'courses in **' + SOC.label(id) + '** (' + codes.length + '):\n' + list(codes.map(function (k) { return '**' + k + '** ' + map[k].title + ' · ' + map[k].units + 'u'; }), 25) + SOC_NOTE, socSrc(id))];
    });

  F('course.gelist', 'Courses offered in a term that satisfy a GE category (A–H). "which classes count for ge-c", "ge a courses in spring with open seats", "easy GE-H options". cat A-H; term?; topic?',
    ['cat', 'term', 'topic'], function (a) {
      var k = (/\b([a-h])\b/i.exec(String(a.cat || '').replace(/^ge[- ]?/i, ' ')) || [])[1]; k = k && k.toUpperCase();
      var L = TA.GE_LISTS && TA.GE_LISTS[k]; if (!L) return [bot('Which GE category? Use a letter A–H (for example **GE-C**).', [{ url: 'https://dornsife.usc.edu/ge/', title: 'USC General Education' }])];
      var id = termIds(a.term || 'spring')[0], tw = words(a.topic), out = [];
      L.codes.forEach(function (code) { var c = SOC.course(id, code); if (!c || !live(c).length) return; if (tw.length && !tw.some(function (w) { return norm(c.title + ' ' + (c.desc || '')).indexOf(w) >= 0; })) return; out.push(c); });
      return [bot('**' + L.title + '**: ' + out.length + ' courses on its list are offered in **' + SOC.label(id) + '**' + (tw.length ? ' matching “' + a.topic + '”' : '') + ':\n' + list(out.map(function (c) { var o = live(c).reduce(function (n, s) { return n + SOC.seatsLeft(s); }, 0); return '**' + c.code + '** ' + c.title + ' · ' + o + ' seats open'; }), 15) + SOC_NOTE, [{ url: L.url, title: L.title + ' – USC GE' }, SRC.soc])];
    });

  F('course.conflict', 'Whether a USC course’s lecture times clash with the student’s own classes (on device). "does csci 201 conflict with my schedule", "can i fit math 225 in". course; term?',
    ['course', 'term'], function (a) {
      if (!signedIn()) return needSignIn();
      return courseOr(a, function (c, term) {
        var mine = TA.State.termCourses(term) || [], blocks = [];
        mine.forEach(function (m) { (m.sections || []).forEach(function (x) { String(x[2] || '').split('').forEach(function (ch) { blocks.push({ code: m.code, d: ch, a: TA.minutes(x[3]), b: TA.minutes(x[4]) }); }); }); });
        var res = live(c).filter(function (s) { return /lec|sem/i.test(s.type) || live(c).length === 1; }).map(function (s) {
          var clash = []; (s.meets || []).forEach(function (m) { var a1 = TA.minutes(m.start), b1 = TA.minutes(m.end); String(m.days || '').split('').forEach(function (ch) { blocks.forEach(function (b) { if (b.d === ch && a1 < b.b && b.a < b1 && clash.indexOf(b.code) < 0) clash.push(b.code); }); }); });
          return s.type + ' ' + s.id + ' · ' + meetTxt(s) + ' · ' + (clash.length ? '**clashes with ' + clash.join(', ') + '**' : 'fits your schedule');
        });
        return [bot(head(c, term) + ' against your ' + SOC.label(term) + ' classes (' + (mine.map(function (m) { return m.code; }).join(', ') || 'none yet') + '):\n' + list(res, 10) + '\n\n_Checked on this device against your schedule; labs and discussions not included._', socSrc(term).concat([ACCT]))];
      }, 'spring');
    });

  F('course.restrict', 'Registration restrictions and duplicate-credit notes on a USC course. "who can take busn 104", "is csci 170 restricted to majors". course',
    ['course', 'term'], function (a) {
      return courseOr(a, function (c, term) {
        var notes = Array.from(new Set(live(c).map(function (s) { return s.notes; }).filter(Boolean)));
        return [bot(head(c, term) + '\n- **Restriction:** ' + (c.restr || 'none listed') + '\n- **Duplicate credit:** ' + (c.dup || 'none listed') + (notes.length ? '\n- **Section notes:** ' + notes.slice(0, 3).join(' · ') : ''), socSrc(term))];
      }, 'spring');
    });

  // ============================================================================================ PLACES & HOURS
  var ALIAS = {
    evk: ['evk', 'everybodys kitchen', 'everybody kitchen', 'everybodys'], parkside: ['parkside', 'parkside dining', 'parkside dh', 'parkside dining hall', 'parkside grill'],
    villagedh: ['village dining', 'village dh', 'village dining hall', 'usc village dining', 'village caf'], leavey: ['leavey', 'leavy', 'leavey library', 'lvl'],
    doheny: ['doheny', 'doheny library', 'doheney'], sel: ['sel', 'science and engineering library', 'science library', 'engineering library', 'seeley', 'seeley wintersmith mudd'],
    lyon: ['lyon', 'lyon center', 'lyon gym', 'lyons'], vfit: ['village gym', 'village fitness', 'vfit', 'village fitness center', 'gym at the village', 'village rec'],
    uac: ['pool', 'aquatics', 'uytengsu', 'swim', 'rec swim', 'swimming pool'], engemann: ['health center', 'student health', 'engemann', 'student health center', 'shc', 'clinic', 'doctor'],
    pharmacy: ['pharmacy', 'usc pharmacy'], bookstore: ['bookstore', 'book store', 'usc bookstore'], career: ['career center', 'careers center', 'career services'],
    finaid: ['financial aid', 'fin aid', 'finaid', 'financial aid office'], osas: ['osas', 'accessibility services', 'disability services', 'student accessibility'],
    mailstop: ['mail stop', 'mailstop', 'mail room', 'mailroom'], housing: ['housing office', 'housing services'], transportation: ['transportation office', 'parking office', 'usc transportation office'],
    fedex: ['fedex', 'fed ex', 'fedex office'], amazonhub: ['amazon hub', 'amazon locker', 'amazon lockers'], traderjoes: ['trader joes', 'tjs', 'trader joe'], target: ['target'],
    citytacos: ['city tacos'], rockreillys: ['rock and reillys', 'rock reillys', 'rock and reilly'], its: ['its computing center', 'computer lab', 'computing center'],
    writing: ['writing center'], seeds: ['seeds', 'seeds marketplace'], panda: ['panda', 'panda express'], cgjuice: ['c and g', 'cg juice', 'juice co'], trojangrounds: ['trojan grounds', 'illy'],
    coffeebean: ['coffee bean'], burgercrush: ['burger crush'], tacotaco: ['taco taco'], slice: ['slice shop'], upstairs: ['the upstairs'], literatea: ['literatea'], popovich: ['popovich', 'popovich cafe'],
    cafeannenberg: ['cafe annenberg', 'annenberg cafe'], tutorhall: ['tutor hall cafe'], lawcafe: ['law school cafe', 'law cafe'], thelab: ['the lab'], rossooros: ['rosso oro', 'rosso oros'],
    mckays: ['mckays', 'mc kays'], uclub: ['university club', 'uclub'], 'music-library': ['music library'], 'cinematic-arts-library': ['cinema library', 'cinematic arts library'],
    'east-asian-library': ['east asian library'], dps: ['dps station', 'dps office', 'dps headquarters', 'public safety office'], coliseum: ['coliseum'], galen: ['galen', 'galen center'],
    tommy: ['tommy trojan'], bovard: ['bovard'], fisher: ['fisher museum'], nhm: ['natural history museum'], sciencecenter: ['science center'], mccarthyquad: ['mccarthy quad', 'mccarthy'],
    alumnipark: ['alumni park'], shrine: ['shrine auditorium'], felix: ['felix field'], rosegarden: ['rose garden']
  };
  var GEN = { gym: ['lyon', 'vfit'], library: ['leavey', 'doheny', 'sel'], libraries: ['leavey', 'doheny', 'sel'], 'dining hall': ['evk', 'parkside', 'villagedh'], 'dining halls': ['evk', 'parkside', 'villagedh'], 'the dining hall': ['evk', 'parkside', 'villagedh'], 'rec center': ['lyon', 'vfit'] };
  function P(id) { return (TH.PLACES || []).find(function (p) { return p.id === id; }); }
  // text -> [place] (best first). Phrases first (longest), then distinctive name words.
  function findPlaces(q) {
    var exact = P(String(q || '').trim()); if (exact) return [exact];
    var t = ' ' + norm(q) + ' ', best = [], bl = 0;
    Object.keys(ALIAS).forEach(function (id) { ALIAS[id].forEach(function (al) { if (t.indexOf(' ' + al + ' ') >= 0 && al.length > bl) { bl = al.length; best = [id]; } else if (t.indexOf(' ' + al + ' ') >= 0 && al.length === bl && best.indexOf(id) < 0) best.push(id); }); });
    if (!best.length) Object.keys(GEN).forEach(function (g) { if (t.indexOf(' ' + g + ' ') >= 0 && g.length > bl) { bl = g.length; best = GEN[g].slice(); } });
    if (!best.length) {
      var sc = [];
      (TH.PLACES || []).forEach(function (p) {
        if (/^(rr-|bl-|g-|stop-|st-)/.test(p.id)) return;
        var nw = words(p.name).filter(function (w) { return w.length > 3 && !/^(usc|hall|center|library|dining|cafe|room|building|campus|street|station|structure|parking|restroom|restrooms|inside|floor|office|entrance|village)$/.test(w); });
        var hit = nw.filter(function (w) { return t.indexOf(' ' + w + ' ') >= 0; }).length;
        if (hit) sc.push({ id: p.id, s: hit / nw.length + hit });
      });
      sc.sort(function (a, b) { return b.s - a.s; });
      if (sc.length) best = sc.filter(function (x) { return x.s === sc[0].s; }).map(function (x) { return x.id; }).slice(0, 3);
    }
    return best.map(P).filter(Boolean);
  }
  X.findPlaces = findPlaces;
  function pSrc(p) { var s = []; if (p.url) s.push(srcOf(p.url, p.name)); (p.sources || []).slice(0, 2).forEach(function (u) { if (typeof u === 'string' && u !== p.url) s.push(srcOf(u)); }); return s.slice(0, 2); }
  function rangesTxt(r) { return r == null ? 'not published' : !r.length ? 'closed' : TH.rangesText(r); }
  function hoursOn(p, d) { return TH.hoursHelpers.dayRanges(p, d); }
  function noPlace(q) { return [bot('I couldn’t find **' + (q || 'that place') + '** among the campus places I carry (dining, libraries, gyms, health, offices, landmarks). Try its full name, or open the map.', [], [go('Open the map', 'map')])]; }
  function statusLine(p, d) {
    var st = TH.status(p, d || now());
    return st ? (st.open ? '🟢 **Open now**' : '🔴 **Closed now**') + (st.detail ? ' · ' + st.detail : '') : '';
  }
  function hoursMd(p, day) {
    if (!p.hours) return '**' + p.name + '**: ' + (p.hoursNote || 'USC doesn’t publish regular hours for it.');
    var r = hoursOn(p, day.d), note = TH.hoursHelpers.dayNote(p, day.d);
    var md = '**' + p.name + '** · ' + (day.today ? 'today' : day.label) + ': **' + rangesTxt(r) + '**' + (note ? ' (' + note + ')' : '');
    if (day.today) md += '\n' + statusLine(p);
    if (r == null && p.hoursNote) md += '\n_' + p.hoursNote + '_';
    return md;
  }
  var PLACE_Q = /\b(open|close|closes|closed|closing|hours?|opens?|opening)\b/;
  F('place.hours', 'Hours of a campus place on a day, and open/closed now (dining halls, cafes, libraries, gyms, health, offices). "is evk open", "what time does the village gym close", "leavey hours saturday". place; day? today|tomorrow|weekday|YYYY-MM-DD',
    ['place', 'day'], function (a) {
      var ps = findPlaces(a.place); if (!ps.length) return noPlace(a.place);
      var day = dayArg(a.day);
      if (day.weekend) return [bot(ps.map(function (p) { return hoursMd(p, { d: day.d, label: 'Saturday' }) + '\n' + hoursMd(p, { d: addDays(day.d, 1), label: 'Sunday' }).replace(/^\*\*[^*]+\*\* · /, '**' + p.name + '** · '); }).join('\n\n'), pSrc(ps[0]))];
      return [bot(ps.map(function (p) { return hoursMd(p, day); }).join('\n\n') + '\n\n_Posted USC hours; holidays can differ._', ps.reduce(function (s, p) { return s.concat(pSrc(p)); }, []).slice(0, 3), [go('See on the map', 'map', ps[0].id)])];
    }, function (t, raw) {
      if (!PLACE_Q.test(t) || /\b(registration|register|enroll|webreg|portal|application|deadline|class|course|seats?|parking permit|account|office hours of|professor|prof|ta)\b/.test(t)) return null;
      var ps = findPlaces(raw); if (!ps.length) return null;
      var day = /\b(tomorrow|tmrw|tonight|today|this weekend|weekend|thanksgiving|veterans day|black friday|christmas eve|christmas|new years|game day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/.exec(t);
      if (/\b(this week|weekly|all week|every day)\b/.test(t)) return null;
      return day ? { place: ps.map(function (p) { return p.id; })[0] === ps[0].id && ps.length > 1 && /\bgym|library|dining hall/.test(t) ? (/\bgym\b/.test(t) ? 'gym' : /\blibrar/.test(t) ? 'library' : 'dining hall') : ps[0].id, day: day[1] } : { place: ps.length > 1 && /\b(gym|library|librar|dining halls?)\b/.test(t) ? (/\bgym\b/.test(t) ? 'gym' : /\blibrar/.test(t) ? 'library' : 'dining hall') : ps[0].id };
    });

  F('place.week', 'Full weekly hours of a campus place plus upcoming holiday/special hours. "evk hours this week", "lyon center weekly schedule", "thanksgiving hours for the village gym". place',
    ['place'], function (a) {
      var ps = findPlaces(a.place); if (!ps.length) return noPlace(a.place);
      var p = ps[0];
      if (!p.hours) return [bot('**' + p.name + '**: ' + (p.hoursNote || 'no regular hours published.'), pSrc(p))];
      var md = '**' + p.name + '** weekly hours:\n' + list(TH.hoursText(p).map(function (r) { return r[0] + ': ' + (r[1] || 'closed'); }), 7);
      var sp = TH.specialHours ? TH.specialHours(p, now(), 45) : [];
      if (sp.length) md += '\n\n**Special / holiday hours:**\n' + list(sp.map(function (x) { return x.label + ': ' + (x.text || 'closed') + (x.note ? ' (' + x.note + ')' : ''); }), 10);
      if (p.hoursNote) md += '\n\n_' + p.hoursNote + '_';
      return [bot(md, pSrc(p), [go('See on the map', 'map', p.id)])];
    }, function (t, raw) {
      if (!/\b(weekly hours|hours this week|all week|week hours|thanksgiving hours|holiday hours|special hours|finals week hours|break hours)\b/.test(t)) return null;
      var ps = findPlaces(raw); return ps.length ? { place: ps[0].id } : null;
    });

  var CATQ = { dining: /\b(food|eat|eating|dining|meal|lunch|dinner|breakfast|brunch|snack|hungry|restaurant|dining halls?|grab a bite|bite)\b/, coffee: /\b(coffee|cafe|caf|tea|boba|latte|espresso|drinks?)\b/, study: /\b(study|studying|librar\w*|quiet place|place to work)\b/, fitness: /\b(gym|gyms|work ?out|workout|fitness|lift|lifting|swim|pool|exercise)\b/, health: /\b(health|clinic|doctor|pharmacy|nurse)\b/, service: /\b(office|offices|services?)\b/, restroom: /\b(restroom|bathroom|toilet|washroom)\b/ };
  function catOf(v) { var t = norm(v); var k = Object.keys(CATQ).filter(function (c) { return CATQ[c].test(' ' + t + ' ') || t === c; })[0]; return k || (/(dining|study|fitness|health|service|restroom|parking|landmark|transit|safety|gate)/.exec(t) || [])[1] || null; }
  function inCat(p, c) { if (c === 'coffee') return p.cat === 'dining' && /coffee|tea|caf[eé]|grounds|bean|literatea|juice/i.test(p.name + ' ' + (p.tags || []).join(' ') + ' ' + (p.desc || '')); return p.cat === c; }
  F('open.now', 'What’s open right now (or at a given time) by category: food, coffee, study/libraries, gyms, health, offices, restrooms. "what’s open right now for food", "any coffee open", "libraries open now", "what’s open at 11pm". cat; at? like "11pm"; day?',
    ['cat', 'at', 'day'], function (a) {
      var c = catOf(a.cat || 'dining') || 'dining', day = dayArg(a.day), at = new Date(now());
      if (!day.today) { at = new Date(day.d); at.setHours(now().getHours(), now().getMinutes()); }
      var tm = String(a.at || '').trim(), mm = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(tm);
      if (/midnight/i.test(tm)) { at = new Date(dayStart(at)); at.setHours(23, 59); }
      else if (/noon/i.test(tm)) { at = new Date(dayStart(at)); at.setHours(12, 0); }
      else if (mm) { var h = +mm[1] % 12 + (/pm/i.test(mm[3] || '') || (!mm[3] && +mm[1] < 7) ? 12 : 0); at = new Date(dayStart(at)); at.setHours(h, +(mm[2] || 0)); }
      var when = (tm || !day.today) ? 'at ' + fmtMin(minOf(at)) + (day.today ? '' : ' ' + day.label) : 'right now';
      var ps = (TH.PLACES || []).filter(function (p) { return inCat(p, c) && p.hours; });
      var open = ps.filter(function (p) { return TH.openFor(p, at, 0) === true; }), unk = ps.filter(function (p) { return TH.openFor(p, at, 0) == null; });
      var label = { dining: 'places to eat', coffee: 'coffee spots', study: 'libraries and study spaces', fitness: 'gyms and rec facilities', health: 'health places', service: 'offices', restroom: 'restrooms' }[c] || c;
      if (!open.length) return [bot('No ' + label + ' I carry are open ' + when + '.' + (unk.length ? ' Hours aren’t published for ' + unk.slice(0, 4).map(function (p) { return p.name; }).join(', ') + '.' : '') + (c === 'dining' || c === 'coffee' ? '\n\nFree USC Lyft runs 7 PM – 2 AM if you need to get off campus for food.' : ''), [SRC.hours])];
      var md = '**' + cap(label) + ' open ' + when + '** (' + open.length + '):\n' + list(open.map(function (p) { var st = TH.status(p, at); return '**' + p.name + '**' + (st && st.detail ? ' · ' + st.detail.toLowerCase() : '') + ((p.tags || []).indexOf('Meal swipes') >= 0 ? ' · meal swipes' : ''); }), 12);
      if (unk.length) md += '\n\n_Hours not published for ' + unk.length + ' more (e.g. ' + unk.slice(0, 2).map(function (p) { return p.name; }).join(', ') + ')._';
      return [bot(md + '\n\n_Posted USC hours; specials and holidays can differ._', c === 'fitness' ? [SRC.rec] : c === 'study' ? [SRC.lib] : [SRC.hours], [go('Open the map', 'map')])];
    }, function (t, raw) {
      if (!/\b(open|still open|opened)\b/.test(t) || !/\b(what|whats|where|anything|anywhere|any|is there|somewhere|places?)\b/.test(t)) return null;
      if (/\b(registration|enroll|class|course|seats?|section|apply|application|portal|house|position|spots?)\b/.test(t) || findPlaces(raw).length && !/\b(what|anything|any)\b/.test(t)) return null;
      var c = catOf(t); if (!c) return null;
      var at = /\b(at|after|around|by) (\d{1,2}(:\d{2})? ?(am|pm)?|midnight|noon)\b/.exec(t), d = /\b(tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/.exec(t);
      var o = { cat: c }; if (at) o.at = at[2]; if (d) o.day = d[1]; if (/\b(late|tonight|late night|after 10)\b/.test(t) && !o.at) o.at = '10pm';
      return o;
    });

  F('place.where', 'Where a campus place is: building, address, walking time from you. "where is leavey library", "where is the career center", "how do i get to the lyon center". place',
    ['place'], function (a) {
      var ps = findPlaces(a.place);
      if (!ps.length) {
        var b = TH.searchBuildings ? TH.searchBuildings(a.place || '') : [];
        if (b.length) { var h = b[0].b; return [bot('**' + h.name + '**' + (h.code ? ' (' + h.code + ')' : '') + ' is on the campus map.' + (b[0].room ? ' Room **' + b[0].room + '**.' : ''), [srcOf('https://maps.usc.edu/', 'USC Maps')], [go('Show on the map', 'map', h.code || '')])]; }
        return noPlace(a.place);
      }
      var p = ps[0], r = null; try { r = TH.route(TH.ME, p); } catch (e) { r = null; }
      var md = '**' + p.name + '**\n- ' + (p.bldg && p.bldg !== p.name ? p.bldg + ' · ' : '') + (p.address || 'address not listed') + (r && r.minutes ? '\n- About **' + r.minutes + ' min walk** from you (' + (TH.ME.short || 'your spot') + ')' : '') + (p.access ? '\n- ' + p.access : '');
      return [bot(md, pSrc(p), [go('Walk me there', 'map', p.id)])];
    }, function (t, raw) {
      var m = /^(?:where(?:s| is| are)|how do i get to|directions to|where can i find|wheres) (?:the )?(.{3,40})$/.exec(t);
      if (!m || /\b(my|class|classroom|room \d|final|exam|bus|lyft|parking|bathroom|restroom|food|coffee)\b/.test(t)) return null;
      var ps = findPlaces(m[1]); return ps.length === 1 ? { place: ps[0].id } : null;
    });

  F('place.contact', 'Phone, website and email for a campus place or office from USC pages. "phone number for the health center", "how do i contact the bookstore", "financial aid phone". place',
    ['place'], function (a) {
      var o = officeFind(a.place); if (o) return officeAnswer(o, 'contact');
      var ps = findPlaces(a.place); if (!ps.length) return noPlace(a.place);
      var p = ps[0];
      return [bot('**' + p.name + '**\n' + list([p.phone ? 'Phone: **' + p.phone + '**' : 'No phone number published', p.email ? 'Email: ' + p.email : null, p.url ? 'Web: ' + p.url : null, p.address ? 'Address: ' + p.address : null]), pSrc(p))];
    }, function (t, raw) {
      if (!/\b(phone|number|call|contact|email|reach)\b/.test(t) || /\b(my|emergency|dps|police|911|crisis|text)\b/.test(t)) return null;
      var o = officeFind(raw); if (o) return { place: o.id };
      var ps = findPlaces(raw); return ps.length === 1 ? { place: ps[0].id } : null;
    });

  F('place.about', 'What a campus place offers (description and features). "what does seeds marketplace have", "what is the lyon center", "does evk have gluten free". place',
    ['place'], function (a) {
      var ps = findPlaces(a.place); if (!ps.length) return noPlace(a.place);
      var p = ps[0];
      return [bot('**' + p.name + '**\n\n' + (p.desc || '') + ((p.features || []).length ? '\n\n' + list(p.features, 8) : '') + ((p.facts || []).length ? '\n\n' + list(p.facts, 5) : ''), pSrc(p), [say('Is it open?', 'is ' + p.name + ' open')])];
    });

  F('place.nearest', 'Nearest campus place of a kind to you, with walking time: restroom, food, coffee, library, gym, blue light, bus stop, parking. "closest bathroom", "nearest place to eat", "nearest blue light phone". cat',
    ['cat'], function (a) {
      var t = norm(a.cat), c = /bath|rest|toilet/.test(t) ? 'restroom' : /blue|emergency phone|safety/.test(t) ? 'safety' : /bus|shuttle|stop|metro|train/.test(t) ? 'transit' : /park/.test(t) ? 'parking' : /gate|entrance/.test(t) ? 'gate' : catOf(t) || 'dining';
      var ps = (TH.PLACES || []).filter(function (p) { return inCat(p, c); });
      if (!ps.length) return [bot('I don’t have any ' + c + ' places on the map.')];
      var me = TH.ME, d = function (p) { return Math.hypot(p.x - me.x, p.y - me.y); };
      ps.sort(function (x, y) { return d(x) - d(y); });
      var top = ps.slice(0, 3).map(function (p) { var r = null; try { r = TH.route(me, p); } catch (e) { r = null; } var st = p.hours ? TH.status(p, now()) : null; return '**' + p.name + '**' + (r && r.minutes ? ' · ~' + r.minutes + ' min walk' : '') + (st ? ' · ' + (st.open ? 'open' : 'closed') + ' now' : ''); });
      return [bot('Nearest to you (' + (me.short || me.label) + '):\n' + list(top) + '\n\n_Walking times are estimates from the campus map._', pSrc(ps[0]), [go('Walk me there', 'map', ps[0].id)])];
    }, function (t) {
      var m = /^(?:wheres |where is |where are )?(?:the )?(?:closest|nearest|close by|nearby) (bathroom|restroom|toilet|blue light|blue light phone|bus stop|place to eat|food|coffee|library|gym|parking|parking structure|gate|entrance)s?(?: near me| to me| around here)?$/.exec(t) || /^(?:where is|wheres) (?:a|the) (bathroom|restroom)(?: near me| nearby| around here)?$/.exec(t);
      return m ? { cat: m[1] } : null;
    });

  F('place.list', 'List campus places of a kind from the map data: dining halls, cafes, libraries, gyms, offices, parking structures, landmarks, restrooms, gates. "list all dining halls", "what libraries are there", "landmarks on campus". cat',
    ['cat'], function (a) {
      var t = norm(a.cat), c = /hall/.test(t) && /din/.test(t) ? 'hall' : /land|statue|sight|museum/.test(t) ? 'landmark' : /park/.test(t) ? 'parking' : /gate|entrance/.test(t) ? 'gate' : /bath|rest/.test(t) ? 'restroom' : catOf(t) || 'dining';
      var ps = (TH.PLACES || []).filter(function (p) { return c === 'hall' ? p.hall || (p.tags || []).indexOf('Dining hall') >= 0 : inCat(p, c); });
      return [bot('**' + ps.length + ' ' + (c === 'hall' ? 'dining halls' : c + ' places') + '** on the Trojan Hub map:\n' + list(ps.map(function (p) { return '**' + p.name + '**' + (p.bldg && p.bldg !== p.name ? ' · ' + p.bldg : ''); }), 30), [c === 'study' ? SRC.lib : c === 'fitness' ? SRC.rec : SRC.hours], [go('Open the map', 'map')])];
    });

  F('place.walk', 'Walking time and distance between you (or one place) and a campus place, using the campus map. "how long to walk to leavey", "how far is evk from lyon". to; from?',
    ['to', 'from'], function (a) {
      var to = findPlaces(a.to)[0], from = a.from ? findPlaces(a.from)[0] : null;
      if (!to) return noPlace(a.to);
      var r = null; try { r = TH.route(from || TH.ME, to); } catch (e) { r = null; }
      if (!r) return [bot('I couldn’t work out a walking route to **' + to.name + '**.')];
      return [bot('From **' + (from ? from.name : (TH.ME.short || 'you')) + '** to **' + to.name + '**: about **' + r.minutes + ' min** walking (' + (r.meters / 1609).toFixed(2) + ' mi).\n\n_Estimate from the campus map’s walking paths._', pSrc(to), [go('Walk me there', 'map', to.id)])];
    }, function (t, raw) {
      var m = /^how (?:long|far)(?: is it| does it take)?(?: to walk)? (?:to|from) (.{3,30}?)(?: (?:to|from) (.{3,30}))?(?: walking| on foot)?$/.exec(t);
      if (!m) return null; var a1 = findPlaces(m[1]); if (!a1.length) return null;
      if (m[2]) { var b1 = findPlaces(m[2]); if (!b1.length) return null; return /^how (long|far)( is it| does it take)?( to walk)? from/.test(t) ? { to: b1[0].id, from: a1[0].id } : { to: a1[0].id, from: b1[0].id }; }
      return { to: a1[0].id };
    });

  // ============================================================================================ DINING
  function halls() { return ['evk', 'parkside', 'villagedh'].map(P).filter(Boolean); }
  F('dining.halls', 'Which residential dining halls are open now or on a day, with hours. "are the dining halls open", "dining hall hours tomorrow", "which dining hall is open late". day?',
    ['day'], function (a) {
      var day = dayArg(a.day);
      return [bot('**Dining halls** · ' + day.label + ':\n' + list(halls().map(function (p) { return '**' + p.name + '**: ' + rangesTxt(hoursOn(p, day.d)) + (day.today ? ' · ' + (TH.status(p, now()).open ? 'open now' : 'closed now') : ''); })) + '\n\nAll three take meal swipes (all-you-care-to-eat).' + (hoursOn(halls()[0], day.d) == null ? '\n\n_' + halls()[0].hoursNote + '_' : ''), [SRC.hours], [go('Order ahead', 'order')])];
    }, function (t) { return /\b(dining halls?|dhs?)\b/.test(t) && /\b(open|hours|close|closing|closed)\b/.test(t) && !/\b(evk|parkside|village)\b/.test(t) ? { day: (/\b(tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/.exec(t) || [])[1] } : null; });

  F('dining.meals', 'Breakfast/lunch/dinner times at USC dining halls (only open–close times are published). "when is breakfast at evk", "what time is dinner at parkside", "brunch hours". meal?; place?',
    ['meal', 'place'], function (a) {
      var ps = a.place ? findPlaces(a.place).filter(function (p) { return p.cat === 'dining'; }) : halls(); if (!ps.length) ps = halls();
      return [bot('USC Hospitality posts only **open and close times**, not separate breakfast, lunch and dinner periods. Today:\n' + list(ps.map(function (p) { return '**' + p.name + '**: ' + rangesTxt(hoursOn(p, now())); })) + '\n\nEach dining hall serves continuously between those times; the menu changes through the day.', [SRC.hours], ps[0].menuUrl ? [{ label: 'Menu', value: '@go:map:' + ps[0].id, kind: '' }] : [])];
    }, function (t) { return /\b(when|what time)\b.{0,20}\b(breakfast|lunch|dinner|brunch)\b/.test(t) && /\b(evk|parkside|village|dining hall|dh)\b/.test(t) ? { meal: (/(breakfast|lunch|dinner|brunch)/.exec(t) || [])[1] } : null; });

  F('dining.plans', 'USC meal plan options and prices (current semester). "what meal plans are there", "how much is the cardinal plan", "difference between flex120 and trojan plan". plan?',
    ['plan'], function (a) {
      var M = (TA.POLICY || {}).mealPlans || [], t = norm(a.plan), sel = M.filter(function (m) { return t && norm(m.name + ' ' + m.id).indexOf(t.split(' ')[0]) >= 0; });
      var L = sel.length ? sel : M;
      return [bot('**USC meal plans** (per semester):\n' + list(L.map(function (m) { return '**' + m.name + '** · ' + money(m.price) + ': ' + m.short + (m.note ? ' _' + m.note + '_' : ''); }), 10), [SRC.meal, { url: 'https://mycard.usc.edu/meal-plans/', title: 'Meal Plans – USCard Services' }])];
    });

  F('dining.dollars', 'How Dining Dollars work: add-on blocks, discount, where they work, meal-plan change deadline. "can i buy more dining dollars", "where can i use dining dollars", "meal plan change deadline". topic?',
    ['topic'], function () {
      var Pl = TA.POLICY || {}, md = '**Dining Dollars**\n' + list([
        'Add-on blocks: ' + (Pl.ddBlocks || []).map(money).join(' or '),
        Pl.ddDiscount ? 'Bonus/discount on add-ons: ' + Math.round(Pl.ddDiscount * 100) + '%' : null,
        'Meal plan change deadline: ' + Object.keys(Pl.mealChangeDeadline || {}).map(function (k) { return (Pl.cal[k] || {}).label + ' ' + TA.fmtDate(Pl.mealChangeDeadline[k]); }).join(' · '),
        'Usable at residential dining halls and USC Hospitality retail cafés (the Trojan Plan is 100% Dining Dollars)'
      ]);
      return [bot(md, [{ url: 'https://mycard.usc.edu/meal-plans/', title: 'Meal Plans – USCard Services' }, SRC.meal])];
    });

  F('dining.swipes', 'Where meal swipes work (dining halls) vs. Dining Dollars / USCard discretionary (retail). "where can i use meal swipes", "does seeds take swipes", "can i use swipes at the village". place?',
    ['place'], function (a) {
      var ps = a.place ? findPlaces(a.place) : [];
      if (ps.length) { var p = ps[0], sw = (p.tags || []).indexOf('Meal swipes') >= 0; return [bot('**' + p.name + '** ' + (sw ? '**takes meal swipes**.' : 'is **not** listed as taking meal swipes' + (p.cat === 'dining' ? '; pay with Dining Dollars, USCard discretionary or card' + (p.village ? ' where accepted' : '') + '.' : '.')) + ((p.tags || []).length ? '\n\nTags: ' + p.tags.join(' · ') : ''), pSrc(p))]; }
      var sw2 = (TH.PLACES || []).filter(function (p) { return (p.tags || []).indexOf('Meal swipes') >= 0; });
      return [bot('**Meal swipes** work at:\n' + list(sw2.map(function (p) { return p.name; })) + '\n\nRetail spots (Seeds, Panda, Trojan Grounds…) take **Dining Dollars** or USCard discretionary instead.', [SRC.meal, SRC.hours])];
    }, function (t, raw) { if (!/\b(swipes?|meal swipe)\b/.test(t) || !/\b(where|which|take|accept|use|work)\b/.test(t) || /\b(my|left|how many|remaining|guest)\b/.test(t)) return null; var ps = findPlaces(raw); return ps.length ? { place: ps[0].id } : {}; });

  F('dining.order', 'Mobile order-ahead spots on campus with estimated kitchen wait (Est., simulated). "where can i order ahead", "how long is the wait at panda", "fastest food right now". place?',
    ['place'], function (a) {
      var ps = (a.place ? findPlaces(a.place) : (TH.PLACES || [])).filter(function (p) { return p.order || (TH.ORDER_MENUS || {})[p.id]; });
      if (!ps.length) return [bot((a.place ? '**' + a.place + '** isn’t' : 'No place is') + ' set up for order-ahead in Trojan Hub. Order-ahead spots: ' + Object.keys(TH.ORDER_MENUS || {}).map(function (k) { return (P(k) || {}).name; }).filter(Boolean).join(', ') + '.')];
      var at = now(), rows = ps.map(function (p) { var o = TH.openFor(p, at, 0) === true, w = TH.kitchenWait(p, at); return { p: p, o: o, w: w }; }).sort(function (x, y) { return (y.o - x.o) || (x.w - y.w); });
      return [bot('**Order ahead** (Est. wait right now):\n' + list(rows.map(function (r) { return '**' + r.p.name + '** · ' + (r.o ? '~' + r.w + ' min (Est.)' : 'closed now'); }), 12) + '\n\n_Wait times are estimates (Simulated from typical rush hours), not live data._', [{ url: 'https://hospitality.usc.edu/mobile-ordering/', title: 'Mobile Ordering – USC Hospitality' }], [go('Order food', 'order')])];
    });

  F('dining.menu', 'Link to the posted menu for a USC dining hall or café (menus change daily; Tommy doesn’t carry dishes). "what’s on the menu at evk", "parkside menu today". place',
    ['place'], function (a) {
      var ps = findPlaces(a.place || 'dining hall').filter(function (p) { return p.cat === 'dining'; }); if (!ps.length) ps = halls();
      return [bot('Menus change every day, so I don’t carry them. Posted menus:\n' + list(ps.map(function (p) { return '**' + p.name + '**: ' + (p.menuUrl || (TH.MENU_URLS || {})[p.id] || p.url); })), ps.map(function (p) { return srcOf(p.menuUrl || (TH.MENU_URLS || {})[p.id] || p.url, p.name); }).slice(0, 3))];
    }, function (t, raw) { if (!/\b(menu|whats for (lunch|dinner|breakfast)|whats being served|serving)\b/.test(t)) return null; var ps = findPlaces(raw).filter(function (p) { return p.cat === 'dining'; }); return ps.length ? { place: ps[0].id } : null; });

  F('dining.gameday', 'Dining and campus changes on the next home football game day (hours, Lyft, shuttle, parking, clear bag). "game day hours", "is evk open on game day", "what changes for the maryland game". topic?',
    ['topic'], function () {
      var g = (TH.SAFETY || {}).gameDay || {}, T = (TH.TRANSPORT || {}).gameDay || {}, days = TH.gameDays ? TH.gameDays() : [];
      return [bot('**Next home game:** ' + (g.nextHomeGame || days[0] || 'not listed') + '\n\n**What changes:**\n' + list((g.changes || T.changes || []).concat(T.shuttle ? [T.shuttle] : [])) + (g.clearBag ? '\n\n**Clear bag rule:** ' + g.clearBag : ''), [SRC.gameday, SRC.hours])];
    }, function (t) { return /\bgame ?day\b/.test(t) && !/\b(plan|my)\b/.test(t) ? {} : null; });

  // ============================================================================================ OFFICES (data/research/facts places.json + safety.json)
  var OFFICES = [{"id": "bookstore", "name": "USC Bookstore (UPC)", "al": ["bookstore", "book store"], "phone": "(800) 447-8620", "address": "840 Childs Way, Los Angeles, CA 90089", "hours": {"mon": "07:45-20:00", "tue": "07:45-20:00", "wed": "07:45-20:00", "thu": "07:45-20:00", "fri": "07:45-20:00", "sat": "09:00-17:00", "sun": "10:00-17:00"}, "note": "Nov 21 (game day) hours \"to be announced\". Call to verify.", "src": ["https://www.uscbookstore.com/usc-store-locations", "https://software.usc.edu/free-to-campus/"]}, {"id": "career", "name": "USC Career Center", "al": ["career center", "career services", "careers"], "phone": "(213) 740-9111", "address": "3601 Trousdale Parkway, Los Angeles, CA 90089", "hours": {"mon": "08:30-17:00", "tue": "08:30-17:00", "wed": "08:30-17:00", "thu": "08:30-17:00", "fri": "08:30-17:00", "sat": "closed", "sun": "closed"}, "src": ["https://careers.usc.edu/front-page/learn-about-the-career-center/", "https://careers.usc.edu/channels/appointments"]}, {"id": "finaid", "name": "Financial Aid Office", "al": ["financial aid", "fin aid", "finaid"], "phone": "(213) 740-4444", "address": "700 Childs Way, Los Angeles, CA 90089-0914", "hours": {"mon": "09:00-17:00", "tue": "09:00-17:00", "wed": "09:00-17:00", "thu": "09:00-17:00", "fri": "09:00-17:00", "sat": "closed", "sun": "closed"}, "note": "Phone Mon-Fri 9-5 PT; in-person advising is walk-in only, usually Mon-Fri 9-5. Scheduled in-person appointments are not offered.", "src": ["https://financialaid.usc.edu/help-contact/", "https://ask.usc.edu/s/article/000001461"]}, {"id": "osas", "name": "Office of Student Accessibility Services (OSAS)", "al": ["osas", "accessibility services", "disability services", "student accessibility"], "phone": "(213) 740-0776", "address": "3601 Watt Way, Los Angeles, CA 90089", "email": "OSASFrontDesk@usc.edu", "hours": {"mon": "08:30-17:00", "tue": "08:30-17:00", "wed": "08:30-17:00", "thu": "08:30-17:00", "fri": "08:30-17:00", "sat": "closed", "sun": "closed"}, "src": ["https://osas.usc.edu/about/contact-location-hours/"]}, {"id": "its", "name": "ITS Service Desk (Customer Support Center)", "al": ["its", "it help", "tech support", "service desk", "help desk", "it service desk", "its service desk"], "phone": "(213) 740-5555, option 2 (Brightspace: option 1)", "email": "consult@usc.edu", "hours": {"mon": "00:00-24:00", "tue": "00:00-24:00", "wed": "00:00-24:00", "thu": "00:00-24:00", "fri": "00:00-24:00", "sat": "00:00-24:00", "sun": "00:00-24:00"}, "note": "Phone/online support 24 hours a day, 365 days a year. Walk-in help: see ITS computing centers (study_spaces).", "src": ["https://itservices.usc.edu/about/contact/", "https://itservices.usc.edu/its-computing-centers/"]}, {"id": "mailstop", "name": "The Mail Stop (send mail and packages)", "al": ["mail stop", "mailstop", "mail room", "send a package", "ship a package"], "phone": "(213) 740-2467", "address": "620 McCarthy Way, Los Angeles, CA 90089", "src": ["https://housing.usc.edu/index.php/publication/resident-information-for-2026-2027/", "https://mycard.usc.edu/accepted-locations/"]}, {"id": "packages", "name": "Package pickup for USC Housing residents", "al": ["package pickup", "my package", "packages", "package"], "src": ["https://housing.usc.edu/index.php/csc/", "https://families.usc.edu/sending-mail-to-my-trojan/"]}, {"id": "housing", "name": "USC Housing Services Office", "al": ["housing office", "housing services", "usc housing"], "phone": "(213) 740-2546", "address": "620 McCarthy Way, Los Angeles, CA 90089", "hours": {"mon": "08:30-17:00", "tue": "08:30-17:00", "wed": "08:30-17:00", "thu": "08:30-17:00", "fri": "08:30-17:00", "sat": "closed", "sun": "closed"}, "src": ["https://housing.usc.edu/index.php/csc/"]}, {"id": "transportation_office", "name": "USC Transportation office", "al": ["transportation office", "usc transportation", "parking office", "transportation"], "phone": "(213) 740-3575", "address": "620 McCarthy Way, Los Angeles, CA 90089", "email": "auxtrans@usc.edu", "src": ["https://transnet.usc.edu/index.php/student-u-pass/", "https://transnet.usc.edu/index.php/contact-us/"]}, {"id": "lostfound", "name": "DPS Lost and Found", "al": ["lost and found", "lost item", "lost my", "found item"], "phone": "(213) 740-9759", "address": "3667 McClintock Ave (DPS station, Parking Structure A)", "email": "lostandfound@dps.usc.edu", "src": ["https://dps.usc.edu/services/lost-and-found/"]}, {"id": "engemann", "name": "Engemann Student Health Center", "al": ["student health", "health center", "engemann", "shc"], "phone": "(213) 740-9355 (WELL), answers 24/7", "address": "1031 West 34th Street, Los Angeles, CA 90089", "note": "USC says hours may change; check MySHR for open appointments or call 213-740-9355. Thanksgiving/finals hours not found.", "src": ["https://studenthealth.usc.edu/hours/", "https://studenthealth.usc.edu/myshr/"]}, {"id": "pharmacy", "name": "USC Pharmacy (UPC)", "al": ["pharmacy"], "phone": "(213) 821-6100", "address": "1025 West 34th Street, Suite 105, Los Angeles, CA 90089", "hours": {"mon": "09:00-18:00", "tue": "09:00-18:00", "wed": "09:00-18:00", "thu": "09:00-18:00", "fri": "09:00-18:00", "sat": "closed", "sun": "closed"}, "note": "Fall semester hours; holiday hours vary.", "src": ["https://pharmacies.usc.edu/locations/", "https://pharmacies.usc.edu/prescriptions/"]}, {"id": "ericcohen", "name": "Eric Cohen Student Health Center (HSC)", "al": ["eric cohen", "hsc health center", "hsc student health"], "phone": "(213) 740-9355", "address": "1510 San Pablo Street, Suite 104 (HC1), Los Angeles, CA 90033", "src": ["https://studenthealth.usc.edu/hours/"]}, {"id": "hscpharmacy", "name": "USC Medical Plaza Pharmacy (HSC)", "al": ["hsc pharmacy", "medical plaza pharmacy"], "phone": "(323) 442-5770", "address": "1510 San Pablo St. #144, Los Angeles, CA 90033", "hours": {"mon": "08:30-18:00", "tue": "08:30-18:00", "wed": "08:30-18:00", "thu": "08:30-18:00", "fri": "08:30-18:00", "sat": "09:00-12:00, 12:40-15:00", "sun": "closed"}, "src": ["https://pharmacies.usc.edu/locations/"]}, {"id": "hmaint", "name": "Housing Maintenance (24/7)", "al": ["housing maintenance", "maintenance", "fix my room", "broken in my room", "work order"], "phone": "(213) 740-4646", "note": null, "src": ["https://dps.usc.edu/contact/"]}, {"id": "rr", "name": "USC Report & Response", "al": ["report and response", "report & response"], "phone": "(213) 740-2500", "note": null, "src": ["https://dps.usc.edu/contact/"]}, {"id": "ocrc", "name": "Office of Civil Rights Compliance (OCRC)", "al": ["ocrc", "civil rights", "title ix office", "title ix"], "phone": "(213) 740-5086", "note": null, "src": ["https://dps.usc.edu/contact/"]}, {"id": "dps-bike", "name": "DPS bike registration questions", "al": ["bike registration"], "phone": "(213) 740-5519", "note": null, "src": ["https://dps.usc.edu/contact/"]}, {"id": "emerinfo", "name": "USC emergency info line (campus-wide emergencies)", "al": ["emergency info line", "campus emergency info"], "phone": "(213) 740-9233", "note": null, "src": ["https://dps.usc.edu/contact/"]}];
  var DAY3 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function officeFind(q) {
    var t = ' ' + norm(q) + ' ', best = null, bl = 0;
    OFFICES.forEach(function (o) { o.al.forEach(function (al) { if (t.indexOf(' ' + al + ' ') >= 0 && al.length > bl) { bl = al.length; best = o; } }); });
    return best;
  }
  X.officeFind = officeFind;
  function hm(s) { var m = /^(\d{2}):(\d{2})$/.exec(s); return m ? TA.fmtTime(s) : s; }
  function officeHours(o, d) { var h = o.hours && o.hours[DAY3[d.getDay()]]; return h == null ? null : h === 'closed' ? 'closed' : h.split(', ').map(function (r) { var p = r.split('-'); return hm(p[0]) + ' – ' + hm(p[1]); }).join(', '); }
  function officeAnswer(o, what, day) {
    var d = day || dayArg(''), h = officeHours(o, d.d), p = P(o.id);
    var md = '**' + o.name + '**\n' + list([
      o.phone ? 'Phone: **' + o.phone + '**' : null, o.email ? 'Email: ' + o.email : null,
      o.address ? 'Where: ' + o.address : (p && p.address ? 'Where: ' + p.address : null),
      o.hours ? 'Hours ' + d.label + ': **' + (h || 'not published') + '**' + (d.today && p && p.hours ? ' · ' + (TH.status(p, now()).open ? 'open now' : 'closed now') : '') : (o.note ? o.note : null),
      o.hours && o.note ? '_' + o.note + '_' : null
    ]);
    if (what === 'hours' && o.hours) md += '\n\nWeek: ' + ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(function (k) { var v = o.hours[k]; return cap(k) + ' ' + (v === 'closed' ? 'closed' : v ? v.split(', ').map(function (r) { var q = r.split('-'); return hm(q[0]) + '–' + hm(q[1]); }).join(', ') : '?'); }).join(' · ');
    return [bot(md, (o.src || []).map(function (u) { return srcOf(u, o.name); }), p ? [go('See on the map', 'map', p.id)] : [])];
  }
  F('office.info', 'Contact, location and hours of a USC office: financial aid, career center, OSAS, ITS help desk, housing, transportation, mail stop, packages, lost and found, bookstore, student health, pharmacy, housing maintenance, OCRC. "financial aid office hours", "where is the career center", "its help desk number". office; what? contact|hours|where; day?',
    ['office', 'what', 'day'], function (a) {
      var o = officeFind(a.office);
      if (!o) { var ps = findPlaces(a.office).filter(function (p) { return p.cat === 'service' || p.cat === 'health'; }); if (ps.length) return [bot(hoursMd(ps[0], dayArg(a.day)) + (ps[0].phone ? '\nPhone: **' + ps[0].phone + '**' : ''), pSrc(ps[0]))]; return [bot('I don’t have contact details for **' + (a.office || 'that office') + '**. Offices I carry: ' + OFFICES.map(function (x) { return x.name; }).join(', ') + '.')]; }
      return officeAnswer(o, norm(a.what), dayArg(a.day));
    }, function (t, raw) {
      if (!/\b(office|desk|center|stop|lost and found|maintenance|bookstore|pharmacy)\b/.test(t) || !/\b(hours|open|close|closes|phone|number|call|contact|email|where|located|location)\b/.test(t)) return null;
      if (/\b(my|office hours (for|of)|professor|prof|ta|advisor|dean)\b/.test(t)) return null;
      var o = officeFind(raw); if (!o) return null;
      return { office: o.id, what: /\b(hours|open|close|closes)\b/.test(t) ? 'hours' : /\bwhere|located|location\b/.test(t) ? 'where' : 'contact' };
    });

  F('office.list', 'List the USC offices and service desks Tommy has contact details for. "what offices can you help with", "list of campus offices". (no args)',
    [], function () { return [bot('Offices I have phone numbers and locations for:\n' + list(OFFICES.map(function (o) { return '**' + o.name + '**' + (o.phone ? ' · ' + o.phone : ''); }), 30), [SRC.dps])]; });

  // ============================================================================================ TRANSPORT
  var T = function () { return TH.TRANSPORT || {}; };
  function busFind(q) {
    var t = norm(q), B = T().buses || [];
    var want = /union|station|amtrak|metrolink/.test(t) ? /union/ : /hsc|health sci|keck|medical/.test(t) ? /hsc|health/ : /weekend/.test(t) ? /weekend/ : /ics|intercampus/.test(t) ? /intercampus|ics/ : /village/.test(t) ? /village/ : null;
    var fromUS = /from (union|the station|hsc)|to (upc|campus|usc)\b/.test(t);
    var hits = B.filter(function (b) { return !want || want.test(norm(b.name + ' ' + b.short + ' ' + b.id)); });
    if (fromUS) { var h2 = hits.filter(function (b) { return /^(us|hsc)-/.test(b.id) || /→ upc|to upc/i.test(b.name); }); if (h2.length) hits = h2; }
    else { var h3 = hits.filter(function (b) { return !/^(us|hsc)-upc/.test(b.id); }); if (h3.length) hits = h3; }
    return hits;
  }
  F('bus.next', 'Next USC bus departures (published schedules): UPC ↔ Union Station, Intercampus Shuttle to HSC, weekend shuttle. "when is the next bus to union station", "next shuttle to hsc", "when does the tram come". route?; at? time',
    ['route', 'at'], function (a) {
      var bs = busFind(a.route), d = now(), m = minOf(d), out = [];
      bs.forEach(function (b) { var dep = (TH.busUpcoming ? TH.busUpcoming(b.id, 0, d, m) : []).slice(0, 3); out.push('**' + b.name + '** from ' + (b.stops[0] || {}).name + ': ' + (dep.length ? dep.map(function (x) { return fmtMin(x.at) + (x.end ? '–' + fmtMin(x.end) + ' (Est.)' : '') + (x.at - m < 60 ? ' (in ' + (x.at - m) + ' min)' : ''); }).join(', ') : 'no more trips today' + (b.days && b.days.indexOf(d.getDay()) < 0 ? ' (doesn’t run today)' : ''))); });
      if (!out.length) return [bot('I don’t have a USC bus matching **' + a.route + '**.', [SRC.bus])];
      return [bot('Next USC bus departures (' + TA.fmtTime(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')) + '):\n' + list(out, 8) + '\n\n_Published Fall 2026 schedules; no service on university holidays. Live positions: ETA SPOT app._', [SRC.bus], [go('Bus map', 'map', 'transit')])];
    });

  F('bus.routes', 'USC bus and shuttle routes with their stops and days. "what usc buses are there", "where does the ics stop", "does the shuttle run on weekends". route?',
    ['route'], function (a) {
      var bs = a.route ? busFind(a.route) : (T().buses || []);
      return [bot('**USC buses**' + (T().busRules ? ' (' + T().busRules.id + ')' : '') + ':\n' + list(bs.map(function (b) { return '**' + b.name + '** · ' + (b.days || []).map(function (x) { return TH.DAYS3 ? TH.DAYS3[x] : x; }).join('/') + ' · stops: ' + b.stops.map(function (s) { return s.name; }).join(' → ') + (b.note ? ' _' + b.note + '_' : ''); }), 14) + '\n\n' + ((T().busRules || {}).holidays || ''), [SRC.bus])];
    });

  F('bus.schedule', 'Full day timetable for a USC bus route from its first stop. "union station shuttle schedule", "ics times today", "bus schedule tomorrow". route; day?',
    ['route', 'day'], function (a) {
      var bs = busFind(a.route).slice(0, 2), day = dayArg(a.day);
      if (!bs.length) return [bot('Which route? Union Station, Intercampus (HSC) or the weekend shuttle.', [SRC.bus])];
      return [bot(bs.map(function (b) { var t = (TH.busDepartures ? TH.busDepartures(b.id, 0, day.d) : []); return '**' + b.name + '** · ' + day.label + ' from ' + (b.stops[0] || {}).name + ':\n' + (t.length ? t.map(function (x) { return fmtMin(x.at) + (x.end ? '–' + fmtMin(x.end) + ' (Est.)' : ''); }).join(', ') : 'no service'); }).join('\n\n') + '\n\n_Published Fall 2026 schedule._', [SRC.bus])];
    });

  F('lyft.status', 'Is free USC Lyft running now, its hours (UPC 7 PM–2 AM; HSC weekdays), and game-day timing. "is usc lyft running", "what time does free lyft start", "lyft hours". campus? upc|hsc',
    ['campus'], function () {
      var L = T().lyft || {}, o = TH.lyftOpen ? TH.lyftOpen(now()) : null;
      return [bot((o === true ? '🟢 **Free USC Lyft is running now.**' : o === null ? '🟡 **It’s a game day:** free Lyft starts 5 hours after kickoff.' : '🔴 **Free USC Lyft isn’t running right now.**') + '\n' + list(['UPC: **' + (L.hoursText || '7 PM – 2 AM daily') + '**', L.hsc ? 'HSC: ' + L.hsc : null, L.gameDay ? 'Game days: ' + L.gameDay : null, 'Cost: ' + (L.cost || 'free if the ride qualifies')]), [SRC.lyft], [go('Request a ride', 'lyft')])];
    }, function (t) { return /\b(lyft|free ride|free rides|safe ride|saferide)\b/.test(t) && /\b(running|working|available|open|on|start|starts|hours|what time|when|now)\b/.test(t) && !/\b(rules|zone|boundary|cover|limit|cap|how many|cost|order|get me|call|request|book)\b/.test(t) ? {} : null; });

  F('lyft.rules', 'USC Lyft rules: boundary zone, Shared rides only, monthly cap, what isn’t covered, how to set it up. "where can i take usc lyft", "is lyft free to the airport", "how many free lyft rides". topic?',
    ['topic'], function () {
      var L = T().lyft || {}, b = L.boundary || {};
      return [bot('**USC Lyft Rides Program**\n' + list([L.eligibility ? 'Who: ' + L.eligibility : null, 'Zone: ' + (b.text || ''), L.limitText || null, 'Cost: ' + (L.cost || '')].concat(L.rules || []), 10), [SRC.lyft])];
    }, function (t) { return /\b(usc )?lyft\b/.test(t) && /\b(rules|zone|boundary|boundaries|cover|covered|limit|cap|how many|how far|airport|lax|where can|setup|set up|not showing|missing)\b/.test(t) ? {} : null; });

  F('metro.info', 'Metro rail near campus (E Line, J Line stations) and how to get to LAX by transit. "closest metro station", "how do i take the train to lax", "which metro line goes to usc". topic?',
    ['topic'], function (a) {
      var M = T().metro || {};
      return [bot('**Metro near the University Park Campus:**\n' + list((M.stations || []).map(function (s) { return s.name + ' · ' + s.line; })) + (M.toLAX ? '\n\n**To LAX:** ' + M.toLAX : '') + '\n\n' + (M.note || '') + '\n\nRide free with a **Metro U-Pass**.', [SRC.upass, srcOf('https://www.metro.net/', 'LA Metro')], [go('Metro on the map', 'map', 'transit')])];
    }, function (t) { return /\b(metro|e line|expo line|j line|light rail|subway|train station)\b/.test(t) && !/\b(u ?pass|upass|metrolink|card)\b/.test(t) && /\b(where|closest|nearest|which|how|line|station|lax|airport|get to)\b/.test(t) ? {} : null; });

  F('upass.info', 'Metro U-Pass for USC students: eligibility, cost, how to get or renew it. "how do i get a u-pass", "is the u-pass free", "renew upass for spring". topic?',
    ['topic'], function () {
      var U = T().upass || {};
      return [bot('**Metro U-Pass**\n' + list([U.eligibility ? 'Who: ' + U.eligibility : null, U.cost ? 'Cost: ' + U.cost : null, U.term || null, U.card || null], 6) + ((U.steps || []).length ? '\n\n**Steps:**\n' + U.steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') : ''), [SRC.upass], [go('U-Pass in Wallet', 'wallet')])];
    });

  F('zipcar.info', 'Zipcar and rental cars for USC students (membership, rates, Enterprise). "zipcar at usc", "how much is zipcar for students", "can i rent a car under 21". topic?',
    ['topic'], function () { var Z = T().zipcar || {}; return [bot('**Zipcar at USC**\n' + Z.text + (Z.enterprise ? '\n\n' + Z.enterprise : ''), [SRC.zipcar])]; });

  F('metrolink.info', 'Metrolink student discount (50% off) and how to set it up. "metrolink student discount", "does u-pass work on metrolink". (no args)',
    [], function () { return [bot('**Metrolink:** ' + (T().metrolink || ''), [SRC.metrolink])]; });

  F('parking.info', 'Parking at USC: student permit types and prices, visitor daily/hourly rates, structures, game-day parking. "how much is a parking permit", "where can visitors park", "cheapest parking near usc". topic?',
    ['topic'], function (a) {
      var PP = (TA.POLICY || {}).parking || {}, TP = T().parking || {}, t = norm(a.topic);
      var md = '';
      if (!/visitor|guest|daily|hour|public|cheap/.test(t)) md += '**Student permits** (per semester):\n' + list((PP.permits || []).map(function (p) { return '**' + p.name + '** · ' + money(p.price) + ' · ' + p.where; }), 10) + '\n\n';
      var R = TP.rates || {};
      md += '**Visitors / daily:**\n' + list(Object.keys(R).map(function (k) { return cap(k) + ': ' + R[k]; }), 6);
      md += '\n\n**Structures:** ' + (TP.structures || []).map(function (id) { return (P(id) || {}).name; }).filter(Boolean).join(', ');
      return [bot(md, [SRC.parking, { url: 'https://transnet.usc.edu/index.php/daily-and-hourly-parking/', title: 'Daily and Hourly Parking – USC Transportation' }], [go('Parking on the map', 'map', 'parking')])];
    });

  F('bike.info', 'Bikes, scooters and skateboards: required DPS registration, parking/racks, bike share stations. "do i need to register my bike", "where can i park my bike", "metro bike share near usc". topic?',
    ['topic'], function () {
      var Bk = T().bikes || {};
      return [bot('**Bikes at USC**\n' + list([Bk.text, Bk.parking, Bk.bikeShare ? 'Metro Bike Share near UPC: ' + (Bk.bikeShare.stations_near_UPC || []).join(', ') + '. ' + (Bk.bikeShare.note || '') : null], 5), [SRC.bikes], [say('Nearest bike rack', 'nearest bike rack')])];
    });

  F('transport.fee', 'The mandatory Student Transportation Fee: amount and what it pays for. "what is the transportation fee", "can i waive the transportation fee". (no args)',
    [], function () { return [bot('**Student Transportation Fee:** ' + (T().fee || ''), [SRC.fee])]; });

  F('transport.lax', 'Getting to/from LAX: USC break shuttles (when posted), Metro to LAX, FlyAway from Union Station. "how do i get to lax", "is there a shuttle to the airport for thanksgiving". (no args)',
    [], function () {
      var M = T().metro || {}, us = (T().buses || []).filter(function (b) { return /union/i.test(b.name) && b.note; })[0];
      return [bot('**To LAX**\n' + list(['USC shuttles: ' + (T().lax || 'not posted'), M.toLAX ? 'Metro: ' + M.toLAX : null, us ? 'From Union Station: ' + us.note : null, 'Free USC Lyft does not go to LAX (outside its zone).']), [SRC.bus, SRC.lyft])];
    }, function (t) { return /\b(lax|airport)\b/.test(t) && /\b(get to|go to|shuttle|ride|how|to the|from)\b/.test(t) && !/\b(book|order|request|call me)\b/.test(t) ? {} : null; });

  F('transport.hsc', 'Getting between the University Park Campus (UPC) and the Health Sciences Campus (HSC). "how do i get to hsc", "shuttle to the health sciences campus". (no args)',
    [], function () {
      var ics = (T().buses || []).filter(function (b) { return /intercampus|ics/i.test(b.name); });
      return [bot('**UPC ↔ HSC**\n' + list(ics.map(function (b) { return b.name + ' · ' + b.stops.map(function (s) { return s.name; }).join(' → '); }).concat([T().hsc, 'Free USC Lyft does not cover rides between UPC and HSC.'])), [SRC.bus], [say('Next shuttle to HSC', 'next shuttle to hsc')])];
    }, function (t) { return /\b(get to|go to|travel to|commute to|shuttle to|bus to)\b.{0,10}\b(hsc|health sciences campus|keck|medical campus)\b/.test(t) && !/\b(next|when)\b/.test(t) ? {} : null; });

  // ============================================================================================ SAFETY (information only; crisis handling stays first in Trojan Assist)
  var SF = function () { return TH.SAFETY || {}; };
  F('safety.contacts', 'USC safety and support phone numbers: DPS emergency and non-emergency (UPC/HSC), Student Health 24/7, lost and found, housing maintenance. "dps phone number", "non emergency number", "hsc dps". topic?',
    ['topic'], function (a) {
      var t = norm(a.topic), ph = SF().phones || [];
      var sel = t ? ph.filter(function (p) { return words(t).some(function (w) { return w.length > 2 && norm(p.label).indexOf(w) >= 0; }); }) : [];
      var L = sel.length ? sel : ph.slice(0, 10);
      return [bot('🚨 **Emergency: call 911 or DPS (213) 740-4321.**\n\n' + list(L.map(function (p) { return p.label + ': **' + p.number + '**' + (p.note && !/^http/.test(p.note) ? ' · ' + p.note : ''); }), 16), [SRC.dps])];
    }, function (t) { return /\b(dps|public safety|campus police)\b/.test(t) && /\b(phone|number|call|contact)\b/.test(t) && !/\b(i need|help me|someone|now)\b/.test(t) ? {} : null; });

  F('campus.access', 'Campus access rules: open to the public by day, controlled access 9 PM–6 AM (only McCarthy and McClintock gates), guest registration. "when does campus close", "can my friend come on campus at night", "which gates are open after 9". topic?',
    ['topic'], function () {
      var A = SF().access || {}, g = (A.after9 || []).map(P).filter(Boolean).map(function (p) { return p.name; });
      return [bot('**Campus access (UPC)**\n' + list([A.daytime, 'From **' + (A.idCheck || '9 PM – 6 AM') + '**: controlled access; open gates: ' + (g.join(' and ') || 'McCarthy and McClintock') + '.', 'Guests after hours: ' + (A.guests || 'register them in advance') + '.']), [SRC.access], [say('Register a guest', 'register a guest for tonight'), say('Which gates are open?', 'which gates are open')])];
    }, function (t) { return /\b(campus (close|closes|closing|access|hours)|when does campus close|is campus open|campus open to (the )?public|after 9 ?pm|after hours access)\b/.test(t) && !/\b(register|sign in my|guest pass for)\b/.test(t) ? {} : null; });

  F('safety.programs', 'USC safety programs and apps: LiveSafe (SafeWalk), TrojansAlert, free Lyft, DPS escorts, Security Ambassadors (yellow jackets), blue light phones. "safe walk", "how do i get an escort at night", "what is livesafe", "who are the yellow jackets". program?',
    ['program'], function (a) {
      var t = norm(a.program), Pg = SF().programs || [];
      var sel = Pg.filter(function (p) { return t && (norm(p.name).indexOf(t) >= 0 || t.indexOf(norm(p.name)) >= 0 || (/walk|escort/.test(t) && /livesafe|escort|lyft/i.test(p.name + p.text))); });
      var L = sel.length ? sel : Pg;
      return [bot('🚨 **In danger now: call 911 or DPS (213) 740-4321.**\n\n' + list(L.map(function (p) { return '**' + p.name + '**: ' + p.text; }), 8), L.map(function (p) { return srcOf(p.url, p.name); }).filter(Boolean).slice(0, 3).concat([SRC.dps]))];
    });

  F('safety.alerts', 'Recent DPS Timely Warnings and crime alerts posted by USC DPS (titles, dates, links). "any dps alerts", "recent crime alerts near campus", "latest timely warning". (no args)',
    [], function () {
      var al = (TH.DPS_ALERTS || []).filter(function (x) { return !x.sensitive; }).slice(0, 5);
      if (!al.length) return [bot('No recent DPS alerts in my data.', [SRC.dps])];
      return [bot('**Recent DPS alerts:**\n' + list(al.map(function (x) { return '**' + x.kind + ': ' + x.title + '** · ' + TH.fmtDate(new Date(x.date)) + (x.where ? ' · ' + x.where : '') + ' · ' + x.url; })) + '\n\n_From dps.usc.edu. Reports, not proof a crime occurred._', al.slice(0, 2).map(function (x) { return srcOf(x.url, 'DPS: ' + x.title); }).concat([SRC.dps]), [go('Safety map', 'safety')])];
    }, function (t) { return /\b(dps alerts?|crime alerts?|timely warnings?|safety alerts?|recent crimes?)\b/.test(t) && !/\b(sign me up|subscribe|enroll)\b/.test(t) ? {} : null; });

  F('safety.lostfound', 'DPS Lost and Found: where it is and how to report or claim an item. "where is lost and found", "i lost my wallet on campus", "turn in a phone i found". (no args)',
    [], function () { var o = officeFind('lost and found'); return o ? officeAnswer(o, 'contact') : [bot('DPS Lost and Found: (213) 740-9759.', [SRC.dps])]; },
    function (t) { return /\blost (and|&|n) found\b/.test(t) || /\b(lost|left) my (wallet|phone|keys|laptop|airpods|backpack|bag|id|uscard|water bottle)\b/.test(t) && !/\b(stolen|robbed|someone took)\b/.test(t) ? {} : null; });

  F('safety.gameday', 'Game-day safety and logistics: clear bag rule, Lyft and shuttle changes, parking. "clear bag policy", "what can i bring to the coliseum". (no args)',
    [], function () { var g = SF().gameDay || {}; return [bot('**Game day**\n' + list([g.clearBag ? 'Clear bag: ' + g.clearBag : null].concat(g.changes || [])), [SRC.gameday])]; },
    function (t) { return /\b(clear bag|bag policy|bring to the coliseum)\b/.test(t) ? {} : null; });

  // ============================================================================================ ACADEMIC CALENDAR (TA.POLICY.cal, holidays, finals)
  var CAL = function () { return (TA.POLICY || {}).cal || {}; };
  function termFor(v) { var t = norm(v); if (/spring|2027|next/.test(t)) return '20271'; if (/fall|2026|this|current/.test(t)) return '20263'; return null; }
  function rel(k) { var d = iso2date(String(k).slice(0, 10)), n = Math.round((d - dayStart(now())) / 864e5); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? 'in ' + n + ' days' : n === -1 ? 'yesterday' : Math.abs(n) + ' days ago'; }
  function calRow(k, label) { return label + ': **' + TA.fmtDate(k) + '** (' + rel(k) + ')'; }
  var CALK = { classesBegin: 'Classes begin', lastAddRefund: 'Last day to add / drop for a refund', lastDropNoW: 'Last day to drop without a W', lastWithdraw: 'Last day to withdraw (with a W)', classesEnd: 'Last day of classes', settle: 'Fees due (settlement)', apptAvailable: 'Registration appointments posted', regBegins: 'Registration begins' };
  F('cal.deadlines', 'Key academic deadlines for a term (session 001): add/drop, refund, drop without W, withdraw, classes begin/end, finals. "last day to drop a class", "when is the withdraw deadline", "spring 2027 add deadline". term?; which? add|drop|withdraw|start|end|finals|registration',
    ['term', 'which'], function (a) {
      var id = termFor(a.term) || '20263', c = CAL()[id] || {}, w = norm(a.which);
      var keys = Object.keys(CALK).filter(function (k) { return c[k]; });
      if (w) { var pick = keys.filter(function (k) { return (/withdraw/.test(w) && k === 'lastWithdraw') || (/drop|w\b/.test(w) && /lastDropNoW|lastAddRefund|lastWithdraw/.test(k)) || (/add|refund/.test(w) && k === 'lastAddRefund') || (/start|begin|first/.test(w) && k === 'classesBegin') || (/end|last day of class/.test(w) && k === 'classesEnd') || (/regist/.test(w) && /reg|appt/i.test(k)) || (/fee|pay|settle/.test(w) && k === 'settle'); }); if (pick.length) keys = pick; }
      var md = '**' + c.label + '** (session 001):\n' + list(keys.map(function (k) { return calRow(c[k], CALK[k]); }), 10) + (c.finals && (!w || /final/.test(w)) ? '\n- Finals: **' + c.finals + '**' : '');
      return [bot(md + '\n\n_Other sessions have their own dates (see the course’s calendar icon in the Schedule of Classes)._', [SRC.cal, SRC.soc])];
    }, function (t) {
      if (!/\b(last day|deadline|when is the last|when can i (still )?(drop|add|withdraw))\b/.test(t) || !/\b(drop|add|withdraw|withdrawal|refund|w)\b/.test(t)) return null;
      if (/\b(meal|housing|parking|fafsa|aid|application|apply|scholarship|insurance|waive|pass|p\/np|pass no pass|grade option|money back|after the deadline|petition|missed|late)\b/.test(t)) return null;
      return { term: /\bspring\b/.test(t) ? 'spring' : undefined, which: (/(withdraw|drop|add|refund)/.exec(t) || [])[1] };
    });

  F('cal.term', 'When a semester starts and ends, and how many days/weeks are left. "when does spring semester start", "when is the last day of classes", "how many weeks left in the semester". term?',
    ['term'], function (a) {
      var id = termFor(a.term) || (dk(now()) > (CAL()['20263'] || {}).classesEnd ? '20271' : '20263'), c = CAL()[id] || {};
      return [bot('**' + c.label + '**\n' + list([calRow(c.classesBegin, 'Classes begin'), calRow(c.classesEnd, 'Classes end'), c.finals ? 'Finals: **' + c.finals + '**' : null]), [SRC.cal])];
    }, function (t) { return /\b(when (does|do|is) (the )?(spring|fall|next|this)? ?(semester|term|classes|school) (start|begin|end|over)|first day of (classes|school|spring|fall)|last day of (classes|school|the semester)|weeks? left in the (semester|term)|when is the semester over)\b/.test(t) ? { term: /\bspring|next\b/.test(t) ? 'spring' : /\bfall|this\b/.test(t) ? 'fall' : undefined } : null; });

  F('cal.holidays', 'University holidays and recesses (no classes) for Fall 2026 and Spring 2027, and whether a given day has class. "is there class on veterans day", "university holidays this semester", "do we have school on mlk day". day?',
    ['day'], function (a) {
      var Hd = (TA.POLICY || {}).holidays || {};
      if (a.day) { var dd = dayArg(a.day), k = dk(dd.d); return [bot('**' + TA.fmtDate(k) + '**: ' + (Hd[k] ? '**' + Hd[k] + '** — university holiday, no classes.' : 'not a university holiday, so classes meet as scheduled (check your instructor for cancellations).'), [SRC.cal])]; }
      var seen = {}, rows = [];
      Object.keys(Hd).sort().forEach(function (k) { var nm = Hd[k]; if (seen[nm]) { seen[nm].to = k; return; } seen[nm] = { from: k, to: k }; rows.push(nm); });
      return [bot('**University holidays (no classes):**\n' + list(rows.map(function (nm) { var r = seen[nm]; return nm + ': **' + TA.fmtDate(r.from) + (r.to !== r.from ? ' – ' + TA.fmtDate(r.to) : '') + '** (' + rel(r.from) + ')'; }), 12), [SRC.cal])];
    }, function (t) { return /\b(university holidays?|school holidays?|days off|no class|no school|class on|school on|classes on)\b/.test(t) && /\b(holiday|veterans|mlk|martin luther|presidents|labor day|thanksgiving|is there|do we have|days off|no class|no school)\b/.test(t) && !/\b(my )?(dining|gym|library|bus|hours)\b/.test(t) ? { day: (/(veterans day|mlk day|presidents day|labor day)/.exec(t) || [])[1] ? { 'veterans day': '2026-11-11', 'mlk day': '2027-01-18', 'presidents day': '2027-02-15', 'labor day': '2026-09-07' }[(/(veterans day|mlk day|presidents day|labor day)/.exec(t) || [])[1]] : undefined } : null; });

  F('cal.finals', 'When finals week is and how the final exam slot is set (by class meeting time); study days. "when are finals", "when does finals week start", "spring 2027 finals dates". term?',
    ['term'], function (a) {
      var id = termFor(a.term) || '20263', Fi = (TA.FINALS || {})[id] || {}, c = CAL()[id] || {};
      var md = '**' + c.label + ' finals: ' + (Fi.dates || c.finals) + '**' + (c.classesEnd ? ' (classes end ' + TA.fmtDate(c.classesEnd) + ')' : '') + '\n\nYour slot depends on your class’s regular days and start time. Ask me “when is the final for CSCI 104” for a specific class.';
      return [bot(md, [SRC.finals])];
    });

  F('cal.countdown', 'How many days until a date or campus milestone (Thanksgiving, finals, last day of classes, spring semester, next home game). "how many days until thanksgiving break", "days until finals", "countdown to winter break". what',
    ['what'], function (a) {
      var t = norm(a.what), c = CAL(), Hd = (TA.POLICY || {}).holidays || {}, k = null, lab = '';
      if (/thanksgiving/.test(t)) { k = Object.keys(Hd).sort().filter(function (x) { return /thanksgiving/i.test(Hd[x]); })[0]; lab = 'Thanksgiving recess'; }
      else if (/final/.test(t)) { k = '2026-12-09'; lab = 'Fall 2026 finals'; }
      else if (/winter|end of (the )?semester|last day of class/.test(t)) { k = c['20263'].classesEnd; lab = 'Last day of Fall 2026 classes'; }
      else if (/spring|next semester/.test(t)) { k = c['20271'].classesBegin; lab = 'Spring 2027 classes begin'; }
      else if (/spring break|spring recess/.test(t)) { k = Object.keys(Hd).sort().filter(function (x) { return /spring recess/i.test(Hd[x]); })[0]; lab = 'Spring recess'; }
      else if (/game|football/.test(t)) { k = (TH.gameDays ? TH.gameDays() : [])[0]; lab = 'Next home football game'; }
      else { var d0 = dayArg(a.what); if (!d0.today) { k = dk(d0.d); lab = d0.label; } }
      if (!k) return [bot('Countdown to what? Try “Thanksgiving”, “finals”, “last day of classes”, “spring semester” or “the next home game”.')];
      return [bot('**' + lab + '**: ' + TA.fmtDate(k) + ' · **' + rel(k) + '**.', [/game/.test(lab) ? SRC.gameday : SRC.cal])];
    }, function (t) { var m = /\b(?:how many (?:days|weeks)|how long) (?:until|till|til|before|left until) (.{3,40})$/.exec(t) || /\bcountdown (?:to|until) (.{3,40})$/.exec(t); return m && /\b(thanksgiving|finals?|winter|break|spring|semester|game|last day)\b/.test(m[1]) ? { what: m[1] } : null; });

  F('cal.registration', 'Spring 2027 registration timeline (appointments posted, registration begins, D-clearance removal note) and the student’s own appointment. "when does registration open", "when can i register for spring", "registration dates". (no args)',
    [], function () {
      var c = CAL()['20271'] || {}, mine = signedIn() && D().academics && D().academics.regAppointment;
      return [bot('**Spring 2027 registration**\n' + list([c.apptAvailable ? calRow(c.apptAvailable, 'Registration appointments posted') : null, c.regBegins ? calRow(c.regBegins, 'Registration begins') : null, c.lastAddRefund ? calRow(c.lastAddRefund, 'Last day to add') : null, mine ? 'Your appointment: **' + fdt(mine) + '** (on this device)' : null]), [SRC.cal, { url: 'https://arr.usc.edu/web-registration/', title: 'Web Registration – USC Registrar' }])];
    }, function (t) { return /\b(when (does|is) (spring )?registration( open| start| begin)?|registration dates?|when can i (start )?register(ing)? for (spring|next semester|classes))\b/.test(t) && !/\bmy\b/.test(t) ? {} : null; });

  F('cal.tuition', 'Tuition and mandatory fees for the year (flat rate 12–18 units, per-unit, fees) and the payment plan. "how much is tuition", "cost per unit", "what fees do i pay", "payment plan fee". topic?',
    ['topic'], function () {
      var Pl = TA.POLICY || {}, Tu = Pl.tuition || {}, Fe = Pl.fees || {}, Pp = Pl.paymentPlan || {};
      return [bot('**Tuition (per semester, 2026–27)**\n' + list(['Flat rate (' + Tu.flatMin + '–' + Tu.flatMax + ' units): **' + money(Tu.flat) + '**', 'Per unit (outside flat range): **' + money(Tu.unit) + '**', 'Max units without approval: ' + Pl.maxUnits]) + '\n\n**Mandatory fees:**\n' + list(Object.keys(Fe).map(function (k) { return cap(k.replace(/([A-Z])/g, ' $1').toLowerCase()) + ': ' + money(Fe[k]); })) + (Pp.fee ? '\n\n**Payment plan:** ' + money(Pp.fee) + ' fee, ' + Pp.installments + ' installments.' : ''), [SRC.tuition, SRC.fee])];
    }, function (t) { return /\b(how much is tuition|tuition cost|cost per unit|per unit cost|tuition per semester|what is tuition)\b/.test(t) ? {} : null; });

  F('cal.transcript', 'Official transcript fees (PDF, paper, overnight, international express). "how much is a transcript", "official transcript cost". (no args)',
    [], function () { var Tr = (TA.POLICY || {}).transcripts || {}; return [bot('**Official transcripts:**\n' + list(['Electronic PDF: ' + money(Tr.pdf), 'Paper: ' + money(Tr.paper), 'Overnight: ' + money(Tr.overnight), 'International express: ' + money(Tr.intlExpress)]), [{ url: 'https://arr.usc.edu/transcripts/', title: 'Transcripts – USC Registrar' }])]; },
    function (t) { return /\btranscripts?\b/.test(t) && /\b(cost|how much|fee|price)\b/.test(t) ? {} : null; });

  F('uscard.info', 'USCard (student ID) basics: replacement fee, where to get it, phone, reporting a lost card. "how much to replace my uscard", "lost my student id what do i do", "uscard office phone". topic?',
    ['topic'], function () { var U = (TA.POLICY || {}).uscard || {}; return [bot('**USCard**\n' + list(['Replacement fee: **' + money(U.replacementFee) + '**', 'USCard Services: **' + U.phone + '**', 'Lost card after hours: DPS ' + U.dpsPhone, 'You can deactivate a lost card and add funds in the USCard portal.']), [SRC.uscard, { url: 'https://mycard.usc.edu/contact/', title: 'Contact – USCard Services' }], [say('Replace my USCard', 'replace my uscard')])]; },
    function (t) { return /\b(uscard|usc card|student id|id card)\b/.test(t) && /\b(replace|replacement|lost|cost|fee|phone|office|how much)\b/.test(t) && !/\b(order|request|get me|for me|my balance|on my|in my|balance)\b/.test(t) ? {} : null; });

  // ============================================================================================ MORE SAFETY / PARKING (data/research/facts safety.json, places.json)
  var EXTRA = {"night_rides_and_escorts": {"lyft": "Free USC Lyft Shared rides 7 PM-2 AM daily inside the UPC geofence (HSC 5 PM-2 AM Mon-Fri). See transport.json lyft.", "after_lyft_hours": "From 2 AM to 6 AM DPS may be able to provide an escort within the designated boundaries (call (213) 740-6000).", "blue_light_escort": "Blue light phones can be used to request an escort; USC Safety says \"an escort will meet you within minutes.\"", "livesafe_safewalk": "LiveSafe SafeWalk lets friends or family virtually escort you.", "campus_cruiser": "Suspended.", "src": ["https://transnet.usc.edu/", "https://safety.usc.edu/services/"]}, "security_ambassadors": {"name": "Security Ambassadors (\"Yellow Jackets\")", "who": "Unarmed security officers from Allied Universal Security, contracted by USC; bright yellow jackets.", "what": "Posted on street corners in neighborhoods around campus, especially near USC-owned housing; eyes and ears of DPS with a direct line to DPS.", "posts_note": "DPS does not publish post locations or shift hours (\"routinely evaluates where Yellow Jackets are posted\"). The current Trojan Hub posts and \"6 PM-3 AM\" hours are unverified.", "src": ["https://dps.usc.edu/safety-tips/getting-around/", "https://dps.usc.edu/contact/report/"]}, "blue_light_phones": {"count": "nearly 300", "where": "Around UPC and HSC, in many buildings, and on each level of every parking structure", "how_it_works": "Connects directly to DPS 24-hour communications center and identifies the phone location even if you cannot speak. Use to request help or an escort, report suspicious activity or a crime. Emergencies only.", "locations_note": "Exact coordinates not obtained: the PDF host is not on the allowlist and the OSM Overpass mirror timed out. The map research task may supply them from Concept3D.", "src": ["https://dps.usc.edu/services/blue-light-phones/"]}, "reporting": {"ways": ["Call DPS 24/7", "LiveSafe app (incl. anonymous)", "Blue light phones", "Campus Security Authorities", "Crime Stoppers (completely anonymous)"], "noise_complaints": "DPS non-emergency (213) 740-6000", "src": ["https://dps.usc.edu/contact/report/", "https://dps.usc.edu/loud-or-unruly-gathering-ordinance/"]}, "dps": {"operates": "24 hours a day, 365 days a year; patrols ~2.5 sq mi around UPC and ~1 sq mi around HSC, including off-campus neighborhoods.", "stations": [{"name": "UPC station", "address": "3667 McClintock Ave, Los Angeles, CA 90089 (Parking Structure A, PSA)"}, {"name": "USC Village sub-station", "address": "3131 South Hoover Street, Suite 1300"}, {"name": "HSC station", "address": "2001 Soto Street, Los Angeles, CA 90032"}], "community_service_officers": "Patrol USC Housing facilities from 8 PM until dawn (24 h during semester and spring breaks).", "src": ["https://dps.usc.edu/contact/", "https://ask.usc.edu/s/article/000002171"]}, "village": {"text": "USC Village (Jefferson Blvd between Hoover St and McClintock Ave) has Trader Joe's, Target, a FedEx Office Mail Center (929 W Jefferson Blvd Suite 1670), an Amazon hub with lockers, and other restaurants. Of the Village restaurants, USCard discretionary is accepted at City Tacos and Rock & Reilly's. Store hours for these private tenants were NOT found on allowed hosts.", "src": ["https://village.usc.edu/about/facts/", "https://mycard.usc.edu/accepted-locations/"]}, "parking": [{"id": "p-mccarthy", "name": "McCarthy Way Parking Structure (PSX)", "address": "620 McCarthy Way, Los Angeles, CA 90089", "access": "Via McCarthy Way Entrance (24/7, staffed)", "public_parking": "$20/day (Text2Park adds one-time $0.50; Pay-by-Plate station in NW corner charges no fee)", "permits": ["UPC Gold"], "src": ["https://transnet.usc.edu/index.php/contact-us/", "https://transnet.usc.edu/index.php/daily-and-hourly-parking/"]}, {"id": "p-figueroa", "name": "Figueroa St. Structure", "address": "3520 S Figueroa St, Los Angeles CA 90007", "public_parking": "$4/hour (up to 4 h on Text2Park; 5+ h = $20 daily)", "permits": ["UPC Gold"], "hours": "Weekdays 6am-8pm staffed (24 h with USC ID at entrances); weekends/holidays 24 h USC ID access only", "src": ["https://transnet.usc.edu/index.php/about-us/entrance-hours/", "https://transnet.usc.edu/index.php/daily-and-hourly-parking/"]}, {"id": "p-shrine", "name": "USC Shrine Structure", "address": "686 W 32nd St, Los Angeles CA 90007 (alt. entrance, USCard required: 645 W Jefferson Blvd)", "public_parking": "$4/hour", "permits": ["UPC Gold", "USC Village residents park here by permit"], "hours": "Weekdays 6am-6pm; after hours/weekends/holidays 24 h with USC ID at the Jefferson entrance", "src": ["https://transnet.usc.edu/index.php/about-us/entrance-hours/", "https://transnet.usc.edu/index.php/daily-and-hourly-parking/"]}, {"id": "p-grand", "name": "Grand Ave. Structure (formerly USC Parking Center / UPX)", "address": "357 W 35th St, Los Angeles CA 90007 (corner of Jefferson Blvd and Grand Ave)", "public_parking": "Cheapest: $2/hour or $14/day", "permits": ["UPC Cardinal ($477/semester)"], "hours": "Weekdays 6am-6pm; after hours/weekends/holidays 24 h USC ID access only", "src": ["https://transnet.usc.edu/index.php/about-us/entrance-hours/", "https://transnet.usc.edu/index.php/daily-and-hourly-parking/"]}, {"id": "p-flower", "name": "Flower St. Structure", "address": "3701 Flower St, Los Angeles CA 90007", "public_parking": "No general public parking (game days included)", "permits": ["UPC Gold"], "hours": "24 h, USC ID access only (USCard required)", "src": ["https://transnet.usc.edu/index.php/about-us/entrance-hours/", "https://transnet.usc.edu/index.php/gameday/"]}, {"id": "p-jefferson", "name": "Jefferson Structure", "public_parking": "$4/hour after 12 PM", "permits": ["UPC Gold"], "src": ["https://transnet.usc.edu/index.php/daily-and-hourly-parking/", "https://transnet.usc.edu/index.php/parking-rates/"]}, {"id": "p-downey", "name": "Downey Structure", "access": "Downey Way Entrance (Vermont at 36th Pl) per entrance list; not confirmed which entrance serves the structure", "permits": ["UPC Gold"], "src": ["https://transnet.usc.edu/index.php/parking-rates/"]}, {"id": "p-royal", "name": "Royal Street Structure", "permits": ["UPC Gold"], "src": ["https://transnet.usc.edu/index.php/parking-rates/"]}, {"id": "p-psa", "name": "Parking Structure A (PSA)", "address": "3667 McClintock Ave, Los Angeles, CA 90089", "note": "Houses the DPS UPC station. Public parking rates not found.", "src": ["https://dps.usc.edu/contact/"]}, {"id": "p-village", "name": "USC Village underground garage", "address": "Navigate to 3215 South Hoover Street", "public_parking": "Hourly; validated parking available for shoppers. Unpaid/unvalidated parking is an $80 violation. \"First 30 minutes free\" is NOT stated in any source.", "src": ["https://village.usc.edu/map-and-directions/", "https://transnet.usc.edu/index.php/parking-violations/"]}]};
  function exSrc(o, t) { return (o.src || []).map(function (u) { return srcOf(u, t); }); }
  F('safety.escort', 'Getting home safely at night: free Lyft hours, DPS escort 2–6 AM, blue light escort, LiveSafe SafeWalk. "can dps walk me home", "safe way home at 3am", "night escort". (no args)',
    [], function () { var N = EXTRA.night_rides_and_escorts; return [bot('🚨 **In danger now: call 911 or DPS (213) 740-4321.**\n\n' + list([N.lyft, N.after_lyft_hours, N.blue_light_escort, N.livesafe_safewalk]), exSrc(N, 'USC safety services'), [say('Is Lyft running?', 'is usc lyft running')])]; },
    function (t) { return /\b(escort|walk me home|safe ?walk|safe way home|get home safe(ly)?|walking home at night)\b/.test(t) && !/\b(someone|following|scared|afraid|unsafe|now|help me)\b/.test(t) ? {} : null; });
  F('safety.bluelight', 'Blue light emergency phones: how many, where, how they work. "what are blue light phones", "where are the blue lights". (no args)',
    [], function () { var Bl = EXTRA.blue_light_phones; return [bot('**Blue light phones**\n' + list(['About ' + Bl.count + ', ' + Bl.where + '.', Bl.how_it_works]), exSrc(Bl, 'Blue light phones – DPS'), [say('Nearest blue light', 'nearest blue light phone')])]; },
    function (t) { return /\bblue ?lights?\b/.test(t) && /\b(what|how|where are|work)\b/.test(t) && !/\b(nearest|closest)\b/.test(t) ? {} : null; });
  F('safety.ambassadors', 'Security Ambassadors (“yellow jackets”) around campus: who they are and what they do. "who are the yellow jackets", "security guards in yellow". (no args)',
    [], function () { var A2 = EXTRA.security_ambassadors; return [bot('**' + A2.name + '**\n' + list([A2.who, A2.what, A2.posts_note]), exSrc(A2, 'Getting around – DPS'))]; },
    function (t) { return /\b(yellow jackets?|security ambassadors?)\b/.test(t) ? {} : null; });
  F('safety.report', 'Ways to report a crime or suspicious activity to USC DPS (including anonymous), and noise complaints. "how do i report a crime", "anonymous tip to dps", "noise complaint number". (no args)',
    [], function () { var R2 = EXTRA.reporting; return [bot('🚨 **Happening now: call 911 or DPS (213) 740-4321.**\n\n**Ways to report to DPS:**\n' + list(R2.ways) + '\n\nNoise complaints: ' + R2.noise_complaints, exSrc(R2, 'Report a crime – DPS'), [say('Report something', 'report a problem')])]; });
  F('safety.dps', 'About USC DPS: hours, patrol area, station addresses, community service officers. "where is the dps station", "does dps patrol off campus". (no args)',
    [], function () { var Dp = EXTRA.dps; return [bot('**USC Department of Public Safety**\n' + list([Dp.operates].concat((Dp.stations || []).map(function (s) { return s.name + ': ' + s.address; })).concat([Dp.community_service_officers])), exSrc(Dp, 'DPS'))]; },
    function (t) { return /\b(where is (the )?dps|dps station|dps (patrol|area)|does dps patrol)\b/.test(t) ? {} : null; });
  F('parking.structure', 'One parking structure: address, access, public rates, permits, what else is inside. "where is the mccarthy structure", "how much to park at the shrine structure", "royal street structure hours". structure',
    ['structure'], function (a) {
      var t = ' ' + norm(a.structure) + ' ', L = EXTRA.parking, hit = L.filter(function (p) { return words(p.name).some(function (w) { return w.length > 4 && !/^(parking|structure|street|garage|entrance)$/.test(w) && t.indexOf(' ' + w + ' ') >= 0; }); })[0];
      if (!hit) return [bot('Which structure? ' + L.map(function (p) { return p.name; }).join(', ') + '.', [SRC.parking])];
      return [bot('**' + hit.name + '**\n' + list([hit.address, hit.access, hit.hours, hit.public_parking ? 'Public: ' + hit.public_parking : null, (hit.permits || []).length ? 'Permits: ' + hit.permits.join(', ') : null, hit.note]), exSrc(hit, hit.name), [go('Show on the map', 'map', hit.id)])];
    }, function (t, raw) { return /\b(structure|garage|psx|psa)\b/.test(t) && /\b(where|how much|cost|rate|hours|open|park)\b/.test(t) && !/\bmy\b/.test(t) ? { structure: raw } : null; });
  F('dining.village', 'USC Village stores and food (Trader Joe’s, Target, FedEx, Amazon lockers) and where USCard discretionary works there. "can i use my uscard at the village", "what stores are in the village". (no args)',
    [], function () { return [bot('**USC Village**\n' + EXTRA.village.text, exSrc(EXTRA.village, 'USC Village'))]; },
    function (t) { return /\b(village)\b/.test(t) && /\b(stores?|shops?|uscard|discretionary|what is in|whats in)\b/.test(t) ? {} : null; });

  // ============================================================================================ CLUBS (EngageSC: TH.CLUBS)
  var CI = null;
  function clubIndex() { if (CI) return CI; CI = (TH.CLUBS || []).map(function (c) { return { c: c, n: ' ' + norm(c.name) + ' ', w: words(c.name).filter(function (w) { return w.length > 2 && !/^(usc|the|and|club|society|association|student|students|of|at|for|trojan|trojans|organization|council|group|team)$/.test(w); }) }; }); return CI; }
  function findClubs(q, n) {
    var t = ' ' + norm(q).replace(/\b(club|clubs|org|orgs|organization|society|team|the|usc|at|join|meet|meets|meeting|when|does|do|how|is|are|what|where|contact|email|events?)\b/g, ' ').replace(/\s+/g, ' ') + ' ';
    var tw = words(t).filter(function (w) { return w.length > 2; }); if (!tw.length) return [];
    var full = clubIndex().filter(function (x) { return t.indexOf(x.n) >= 0 || x.n.indexOf(t) >= 0 && t.trim().length > 5; });
    if (full.length) return full.map(function (x) { return x.c; }).slice(0, n || 3);
    var sc = clubIndex().map(function (x) { var h = x.w.filter(function (w) { return tw.indexOf(w) >= 0 || tw.some(function (q2) { return q2.length > 4 && w.indexOf(q2) === 0; }); }).length; return { c: x.c, s: h ? h / Math.max(1, x.w.length) + h + (x.c.registered === false ? -0.5 : 0) + (x.c.events ? 0.2 : 0) : 0 }; }).filter(function (x) { return x.s > 0; });
    sc.sort(function (a, b) { return b.s - a.s; });
    return sc.slice(0, n || 3).map(function (x) { return x.c; });
  }
  X.findClubs = findClubs;
  function cSrc(c) { var u = c.engage || (c.slug ? 'https://engage.usc.edu/' + c.slug + '/' : null); return [srcOf(u || c.url || SRC.engage.url, c.name + (u ? ' – EngageSC' : ''))]; }
  function clubEvs(c) {
    return (TH.clubEvents ? TH.clubEvents(c.id) : []).map(function (x) { var e = TH.eventById ? TH.eventById(x.id) : null; return e && e.s ? e : Object.assign({}, x, { s: new Date(x.start), e: new Date(x.end || x.start) }); })
      .filter(function (e) { return !(e.e < now()); }).sort(function (a, b) { return a.s - b.s; });
  }
  function engageUrl(c) { return c.engage || (c.slug ? 'https://engage.usc.edu/' + c.slug + '/' : null); }
  function meetTxtC(c) { var m = c.meeting; if (!m) return null; return (m.days || []).join('/') + (m.start ? ' ' + TA.fmtTime(m.start) + (m.end ? '–' + TA.fmtTime(m.end) : '') : '') + (m.place ? ' · ' + m.place : '') + (m.note ? ' (' + m.note + ')' : '') + (m.quote ? '\n> “' + m.quote + '”' : ''); }
  F('club.meets', 'When and where a USC club meets: posted meeting time if the club lists one, else its next EngageSC events. "when does the robotics club meet", "nikkei student union meeting time", "where does dragon boat practice". club',
    ['club'], function (a) {
      var cs = findClubs(a.club, 3); if (!cs.length) return [bot('I couldn’t find **' + (a.club || 'that club') + '** on EngageSC. Try its full name.', [SRC.engage])];
      return [bot(cs.map(function (c) { var m = meetTxtC(c), ev = clubEvs(c).slice(0, 2); return '**' + c.name + '**\n' + (m ? '- Meets: ' + m : '- No regular meeting time is posted on its EngageSC page.') + (ev.length ? '\n- Next events: ' + ev.map(function (e) { return e.title + ' · ' + evWhen(e); }).join('; ') : '\n- No upcoming public events listed.'); }).join('\n\n') + '\n\n_From EngageSC; officers can change times, so check the club page._', cSrc(cs[0]), [say('How do I join?', 'how do i join ' + cs[0].name)])];
    }, function (t, raw) { if (!/\b(when|where|what time|what day)\b.{0,60}\b(meet|meets|meeting|meetings|practice|practices|gbm|general meeting)\b/.test(t) || /\b(my club|class|course|office hours|advisor|professor)\b/.test(t)) return null; var full = clubIndex().filter(function (x) { return (' ' + norm(raw) + ' ').indexOf(x.n) >= 0 && x.n.trim().length > 4; }).sort(function (a, b) { return b.n.length - a.n.length; })[0]; if (full) return { club: full.c.name }; if (!/\b(club|society|association|team|org|union|council|chapter)\b/.test(t)) return null; var cs = findClubs(raw, 1); return cs.length ? { club: cs[0].name } : null; });

  F('club.join', 'How to join a specific USC club (EngageSC page, whether online joining is open, registration status). "how do i join the trojan chess club", "is the hackathon club accepting members". club',
    ['club'], function (a) {
      var cs = findClubs(a.club, 1); if (!cs.length) return [bot('Find clubs and join on **EngageSC** (engage.usc.edu): search the directory, open the group, and click Join. Tell me a club name and I’ll check it.', [SRC.engage])];
      var c = cs[0];
      return [bot('**' + c.name + '** · ' + (c.cats || [c.cat]).join(', ') + '\n' + list([c.open === false ? 'Online joining is **closed** on EngageSC; officers may ask you to reach out directly.' : engageUrl(c) ? 'Join on its EngageSC page: ' + engageUrl(c) : 'Find it on EngageSC (engage.usc.edu) and click Join', c.url && c.url !== engageUrl(c) ? 'Club website: ' + c.url : null, c.registered === false ? 'EngageSC marks it **not registered yet** for this year.' : 'Registered student organization.', meetTxtC(c) ? 'Meets: ' + meetTxtC(c).split('\n')[0] : null]), cSrc(c), [{ label: 'Join in Trojan Hub', value: 'join ' + c.name, kind: 'action' }])];
    }, function (t, raw) { if (!/\b(how (do|can) i join|how to join|joining|accepting (new )?members|can i join)\b/.test(t) || /\b(a club|clubs|any club|greek|frat|sorority|band|team usc)\b/.test(t)) return null; var cs = findClubs(raw, 1); return cs.length ? { club: cs[0].name } : null; });

  F('club.find', 'Find USC clubs by interest or keyword (EngageSC directory). "clubs about chess", "any k-pop dance clubs", "pre-law organizations", "clubs for cs majors". topic; open? yes',
    ['topic', 'open'], function (a) {
      var tw = words(a.topic).filter(function (w) { return w.length > 2 && !/^(club|clubs|org|orgs|organization|organizations|for|about|any|and|the|usc|groups?)$/.test(w); });
      if (!tw.length) return [bot('What are you into? For example “clubs about chess” or “pre-law organizations”.', [SRC.engage])];
      var hits = (TH.CLUBS || []).map(function (c) { var nm = norm(c.name), ds = norm((c.cats || []).join(' ') + ' ' + c.desc); var s = tw.reduce(function (n, w) { return n + (nm.indexOf(w) >= 0 ? 3 : 0) + (ds.indexOf(w) >= 0 ? 1 : 0); }, 0); return { c: c, s: s + (c.events ? 0.3 : 0) - (c.registered === false ? 0.5 : 0) }; })
        .filter(function (x) { return x.s >= tw.length && (!/^y/i.test(String(a.open || '')) || x.c.open !== false); }).sort(function (x, y) { return y.s - x.s; });
      if (!hits.length) return [bot('No EngageSC groups match **' + a.topic + '**. Try a broader word.', [SRC.engage])];
      return [bot('EngageSC groups for **' + a.topic + '** (' + hits.length + '):\n' + list(hits.map(function (x) { var c = x.c; return '**' + c.name + '** · ' + (c.cats || [c.cat]).slice(0, 2).join(', ') + (c.events ? ' · ' + c.events + ' upcoming events' : '') + (c.open === false ? ' · joining closed' : ''); }), 8), [SRC.engage], [go('Browse clubs', 'clubs')])];
    }, function (t) { var m = /^(?:are there |is there |find |show me |any |list )?(?:any |some )?(?:clubs?|orgs?|organizations?|student groups?) (?:about|for|on|related to|that do|into|with) (.{3,40})$/.exec(t) || /^(?:any |find |show me )?(.{3,30}) (?:clubs|organizations|orgs)(?: at usc)?$/.exec(t); return m && !/\b(my|join|joined|most active|busiest|biggest|popular|how many)\b/.test(t) ? { topic: m[1] } : null; });

  F('club.about', 'What a USC club does (EngageSC description, categories, status). "what is the whine and cheese club", "tell me about nikkei student union". club',
    ['club'], function (a) {
      var cs = findClubs(a.club, 1); if (!cs.length) return [bot('I couldn’t find **' + (a.club || 'that club') + '** on EngageSC.', [SRC.engage])];
      var c = cs[0]; return [bot('**' + c.name + '** · ' + (c.cats || [c.cat]).join(', ') + ' · ' + (c.type || '') + '\n\n' + (c.desc || 'No description on EngageSC.') + (c.events ? '\n\n' + c.events + ' upcoming public events.' : ''), cSrc(c), [say('When do they meet?', 'when does ' + c.name + ' meet')])];
    });

  F('club.events', 'Upcoming public events of a USC club or organization (EngageSC). "what events does viterbi career connections have", "visions and voices events", "next ksa event". club',
    ['club'], function (a) {
      var cs = findClubs(a.club, 3), evs = []; cs.forEach(function (c) { clubEvs(c).forEach(function (e) { evs.push(e); }); });
      if (!evs.length) { var t = norm(a.club); evs = (TH.events() || []).filter(function (e) { return e.e >= now() && t.length > 3 && norm(e.org).indexOf(t) >= 0; }); }
      if (!cs.length && !evs.length) return [bot('I couldn’t find **' + (a.club || 'that organization') + '** on EngageSC.', [SRC.engage])];
      if (!evs.length) return [bot('**' + cs[0].name + '** has no upcoming public events on EngageSC.', cSrc(cs[0]))];
      evs.sort(function (x, y) { return x.s - y.s; });
      return [bot('Upcoming events from **' + (evs[0].org || cs[0].name) + '**:\n' + list(evs.map(function (e) { return '**' + e.title + '** · ' + evWhen(e) + (evWhere(e) ? ' · ' + evWhere(e) : ''); }), 8), [srcOf(evs[0].url, evs[0].title)].concat(cs.length ? cSrc(cs[0]) : []), [go('Events', 'events')])];
    });

  F('club.category', 'Clubs in an EngageSC category (Academic, Cultural, Recreation, Professional, Religious, Social, Service, Sports, Arts…), with counts. "list cultural clubs", "how many clubs are there", "religious organizations at usc". cat?',
    ['cat'], function (a) {
      var cnt = {}; (TH.CLUBS || []).forEach(function (c) { (c.cats || [c.cat]).forEach(function (k) { if (k) cnt[k] = (cnt[k] || 0) + 1; }); });
      var t = norm(a.cat), k = Object.keys(cnt).filter(function (x) { return t && (norm(x).indexOf(t.slice(0, 5)) >= 0 || t.indexOf(norm(x)) >= 0); })[0];
      if (!k) return [bot('**' + (TH.CLUBS || []).length + ' EngageSC groups** in Trojan Hub, by category:\n' + list(Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; }).map(function (x) { return x + ': ' + cnt[x]; }), 25), [SRC.engage], [go('Browse clubs', 'clubs')])];
      var cs = (TH.CLUBS || []).filter(function (c) { return (c.cats || [c.cat]).indexOf(k) >= 0; }).sort(function (x, y) { return (y.events || 0) - (x.events || 0); });
      return [bot('**' + k + '** groups (' + cs.length + '), most active first:\n' + list(cs.map(function (c) { return c.name + (c.events ? ' · ' + c.events + ' events' : ''); }), 15), [SRC.engage], [go('Browse clubs', 'clubs')])];
    }, function (t) { return /^how many (clubs|student (orgs|organizations)|organizations) (are there|does usc have)/.test(t) ? {} : null; });

  F('club.recommend', 'Clubs picked for the student from their interests, major and career goals (on device). "what clubs should i join", "recommend clubs for me", "clubs that match my interests". (no args)',
    [], function () {
      if (!TH.clubMatch) return [bot('Club matching isn’t available right now.')];
      var r = (TH.CLUBS || []).map(function (c) { var m = TH.clubMatch(c) || {}; return { c: c, m: m }; }).filter(function (x) { return x.m.score > 0; }).sort(function (x, y) { return y.m.score - x.m.score; }).slice(0, 6);
      if (!r.length) return [bot('Tell me your interests in your profile and I’ll match clubs to you.', [SRC.engage], [go('Edit my profile', 'profile')])];
      return [bot('**Clubs that match you** (from your profile, on this device):\n' + list(r.map(function (x) { return '**' + x.c.name + '**' + ((x.m.why || []).length ? ' · ' + x.m.why.slice(0, 2).join(', ') : ''); })), [SRC.engage], [go('Browse clubs', 'clubs')])];
    }, function (t) { return /\b(what|which) clubs? should i join\b|\brecommend (me )?(some )?clubs\b|\bclubs? (for me|that match me|matching my interests)\b/.test(t) ? {} : null; });

  // ============================================================================================ EVENTS (EngageSC public events: TH.events())
  function evsBetween(a0, b0, f) { return (TH.events() || []).filter(function (e) { return !e.multiDay && e.e >= a0 && e.s < b0 && (!f || f(e)); }).sort(function (x, y) { return x.s - y.s; }); }
  function evTime(e) { return e.allDay ? 'All day' : TH.fmtTime(e.s) + (e.e && +e.e !== +e.s ? '–' + TH.fmtTime(e.e) : ''); }
  function evWhen(e) { return TH.fmtDate(e.s) + ', ' + evTime(e); }
  function evWhere(e) { return e.location ? String(e.location).split(',')[0].trim() : ''; }
  function evLine(e) { return '**' + evTime(e) + '** ' + e.title + (e.org ? ' · ' + e.org : '') + (evWhere(e) ? ' · ' + evWhere(e) : '') + (e.food ? ' · 🍕 food' : ''); }
  function evDays(a) {
    var day = dayArg(a.day), s = dayStart(day.d), e = addDays(s, day.weekend ? 2 : 1);
    if (day.today) s = now();
    if (/tonight/.test(norm(a.day))) { s = new Date(Math.max(+now(), +new Date(dayStart(now()).getTime() + 17 * 3600e3))); }
    return { s: s, e: e, label: day.weekend ? 'this weekend' : /tonight/.test(norm(a.day)) ? 'tonight' : day.label };
  }
  function evAnswer(evs, title, src, empty) {
    if (!evs.length) return [bot(empty, [SRC.engage], [go('All events', 'events')])];
    var byDay = {}; evs.forEach(function (e) { (byDay[e.dkey] = byDay[e.dkey] || []).push(e); });
    var md = title + '\n' + Object.keys(byDay).sort().slice(0, 3).map(function (k) { return (Object.keys(byDay).length > 1 ? '\n**' + TH.fmtDate(iso2date(k)) + '**\n' : '') + list(byDay[k].map(evLine), 8); }).join('\n');
    return [bot(md + '\n\n_Public EngageSC events._', [srcOf(evs[0].url, evs[0].title), SRC.engage], [go('All events', 'events')])];
  }
  F('events.day', 'Public campus events on a day or tonight/this weekend (EngageSC). "events today", "what’s happening tomorrow", "anything going on tonight", "events this weekend". day? today|tonight|tomorrow|weekday|weekend',
    ['day'], function (a) { var r = evDays(a), evs = evsBetween(r.s, r.e); return evAnswer(evs, 'Public events **' + r.label + '** (' + evs.length + '):', null, 'No public EngageSC events listed ' + r.label + '.'); },
    function (t) { var m = /^(?:any |are there any |what |whats |show me |list )?(?:events?|things to do|stuff to do|whats happening|what is happening|whats going on|anything going on|anything happening)(?: on campus)? (today|tonight|tomorrow|this weekend|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))(?: on campus)?$/.exec(t); return m ? { day: m[1].replace(/^on /, '') } : null; });

  F('events.food', 'Campus events with free food, on a day or soon (EngageSC). "free food today", "where can i get free food this week", "events with pizza tomorrow". day?',
    ['day'], function (a) {
      var r = a.day ? evDays(a) : { s: now(), e: addDays(dayStart(now()), 7), label: 'in the next 7 days' }, evs = evsBetween(r.s, r.e, function (e) { return e.food; });
      return evAnswer(evs, '🍕 Events with food **' + r.label + '** (' + evs.length + '):', null, 'No public events with food listed ' + r.label + '. If you need food help, USC Student Basic Needs offers support.');
    });

  F('events.now', 'Public events happening right now on campus. "what’s happening right now", "any events going on now". (no args)',
    [], function () { var n = now(), evs = evsBetween(n, new Date(+n + 1), function (e) { return e.s <= n; }); return evAnswer(evs, 'Happening **now** (' + evs.length + '):', null, 'No public events are happening right now. Ask “events tonight” for later.'); },
    function (t) { return /^(?:what|whats|anything|any events?) (?:is )?(?:happening|going on) (?:right )?now(?: on campus)?$/.test(t) ? {} : null; });

  F('events.search', 'Search upcoming public events by topic, org or place within a date range. "career fairs this week", "hackathons in november", "events at the coliseum", "film screenings tomorrow". q; day?; days? number of days ahead',
    ['q', 'day', 'days'], function (a) {
      var q = words(a.q).filter(function (w) { return w.length > 2 && !/^(events?|the|and|for|any|campus|usc)$/.test(w); });
      var r = a.day ? evDays(a) : { s: now(), e: addDays(dayStart(now()), +a.days > 0 ? +a.days : 30), label: 'in the next ' + (+a.days > 0 ? a.days : 30) + ' days' };
      var evs = evsBetween(r.s, r.e, function (e) { var h = norm(e.title + ' ' + (e.org || '') + ' ' + (e.cats || []).join(' ') + ' ' + (e.location || '') + ' ' + (e.type || '') + ' ' + (e.desc || '').slice(0, 300)); return q.every(function (w) { return h.indexOf(w.replace(/s$/, '')) >= 0; }); });
      return evAnswer(evs, 'Events matching **' + (a.q || '') + '** ' + r.label + ' (' + evs.length + '):', null, 'No public events match **' + (a.q || '') + '** ' + r.label + '.');
    });

  F('event.info', 'Details of one named campus event: when, where, host, description, RSVP link. "tell me about the world food day market", "when is the sweater weather screening". title',
    ['title'], function (a) {
      var tw = words(a.title).filter(function (w) { return w.length > 2; }), best = null, bs = 0;
      (TH.events() || []).forEach(function (e) { if (e.e < now()) return; var h = norm(e.title), s = tw.filter(function (w) { return h.indexOf(w) >= 0; }).length / Math.max(1, tw.length); if (s > bs) { bs = s; best = e; } });
      if (!best || bs < 0.6) return [bot('I couldn’t find an upcoming event called **' + (a.title || '') + '**.', [SRC.engage], [go('All events', 'events')])];
      var e = best;
      return [bot('**' + e.title + '**\n' + list([evWhen(e), e.location ? 'Where: ' + e.location : null, e.org ? 'Host: ' + e.org : null, e.food ? 'Food listed' : null, 'RSVP / details: ' + e.url]) + (e.desc ? '\n\n' + String(e.desc).slice(0, 400) : ''), [srcOf(e.url, e.title)], [{ label: 'Add to my calendar', value: 'add ' + e.title + ' to my calendar', kind: 'action' }])];
    });

  F('events.week', 'Overview of public events this week or next: count per day and highlights. "what’s happening this week", "events next week", "busy days on campus this week". which? this|next',
    ['which'], function (a) {
      var base = dayStart(now()), s = /next/.test(norm(a.which)) ? addDays(base, 7 - base.getDay() + 1) : now(), e = addDays(dayStart(s), /next/.test(norm(a.which)) ? 7 : 8 - base.getDay());
      var evs = evsBetween(s, e), by = {}; evs.forEach(function (x) { (by[x.dkey] = by[x.dkey] || []).push(x); });
      if (!evs.length) return [bot('No public events listed for that week.', [SRC.engage])];
      return [bot('**' + evs.length + ' public events** ' + (/next/.test(norm(a.which)) ? 'next week' : 'the rest of this week') + ':\n' + list(Object.keys(by).sort().map(function (k) { return '**' + TH.fmtDate(iso2date(k)) + '** · ' + by[k].length + ' events, e.g. ' + by[k].slice(0, 2).map(function (x) { return x.title; }).join('; '); }), 8), [SRC.engage], [go('All events', 'events')])];
    }, function (t) { return /^(?:what|whats|anything) (?:is )?(?:happening|going on) (this|next) week(?: on campus)?$|^events (this|next) week$/.test(t) ? { which: /next/.test(t) ? 'next' : 'this' } : null; });

  // ============================================================================================ THE STUDENT'S OWN ACCOUNT (TA.State.d / TH.H(): read on this device only)
  var MYC = /\b(my|mine|i have|do i have|am i|have i|ive got|i got|me)\b/;
  function mine(name, about, args, run, re, not) {
    F(name, about + ' Account data stays on this device.', args, function (a) { return signedIn() ? run(a) : needSignIn(); },
      re ? function (t, raw) { return re.test(t) && (MYC.test(t) || (re.bare && re.bare.test(t))) && !(not && not.test(t)) ? (typeof re.args === 'function' ? re.args(t, raw) : {}) : null; } : null);
  }
  function curTerm() { return ((TA.POLICY || {}).terms || {}).current ? TA.POLICY.terms.current.code : '20263'; }
  function nextTerm() { return ((TA.POLICY || {}).terms || {}).next ? TA.POLICY.terms.next.code : '20271'; }
  function myCourses(term) { return (TA.State.termCourses(term) || []).slice(); }
  function secTxt(x) { return x[1] + ' ' + (x[2] ? TA.fmtDays(x[2]) + ' ' : '') + (x[3] ? TA.fmtTime(x[3]) + '–' + TA.fmtTime(x[4]) : 'TBA') + (x[5] ? ' · ' + x[5] : ''); }
  function aSrc() { return [ACCT]; }

  mine('my.classes', 'The student’s own classes this term or next, with times and instructors. "what classes am i taking", "my spring schedule", "list my courses".', ['term'], function (a) {
    var id = termFor(a.term) || curTerm(), cs = myCourses(id);
    if (!cs.length) return [bot('You have no classes on your ' + ((CAL()[id] || {}).label || '') + ' schedule yet.', aSrc(), [go('Academics', 'academics')])];
    return [bot('**Your ' + (CAL()[id] || {}).label + ' classes** (' + TA.State.termUnits(id) + ' units):\n' + list(cs.map(function (c) { return '**' + c.code + '** ' + c.title + ' · ' + c.units + 'u\n  ' + (c.sections || []).map(secTxt).join('\n  '); }), 10), aSrc(), [go('Academics', 'academics')])];
  }, (function () { var r = /\b(what (classes|courses) am i (taking|in|enrolled in)|my (classes|courses|class schedule|course schedule|spring schedule|fall schedule)|list my (classes|courses))\b/; r.args = function (t) { return { term: /\bspring|next\b/.test(t) ? 'spring' : undefined }; }; return r; })(), /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next class|grades?|homework|final|exam|drop|add|register)\b/);

  mine('my.classes_on', 'The student’s classes on a given day. "what classes do i have tomorrow", "do i have class on friday", "my classes today".', ['day'], function (a) {
    var day = dayArg(a.day), L = TH.classesOn ? TH.classesOn(day.d) : [], hol = ((TA.POLICY || {}).holidays || {})[dk(day.d)];
    if (!L.length) return [bot('No classes ' + day.label + (hol ? ' (' + hol + ')' : '') + '.', aSrc())];
    return [bot('**Your classes ' + day.label + ':**\n' + list(L.map(function (c) { return '**' + fmtMin(c.start) + '–' + fmtMin(c.end) + '** ' + c.code + ' ' + (c.type || '') + (c.instr ? ' · ' + c.instr : ''); })), aSrc(), [go('My Day', 'plans')])];
  }, (function () { var r = /\b((what|which) (classes|class) do i have|do i have (class|classes|school)|my classes) (today|tomorrow|tmrw|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/; r.args = function (t) { return { day: (/(today|tomorrow|tmrw|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(t) || [])[1] }; }; return r; })());

  mine('my.next_class', 'The student’s next class from now: what, when, how long until. "when is my next class", "what class do i have next".', [], function () {
    for (var i = 0; i < 8; i++) {
      var d = addDays(dayStart(now()), i), L = (TH.classesOn ? TH.classesOn(d) : []).filter(function (c) { return i > 0 || c.start > minOf(now()); });
      if (L.length) { L.sort(function (x, y) { return x.start - y.start; }); var c = L[0]; return [bot('Your next class: **' + c.code + ' ' + (c.type || '') + '** · ' + (i === 0 ? 'today' : dLabel(d)) + ' **' + fmtMin(c.start) + '–' + fmtMin(c.end) + '**' + (i === 0 ? ' (in ' + (c.start - minOf(now())) + ' min)' : '') + (c.instr ? ' · ' + c.instr : ''), aSrc(), [go('My Day', 'plans')])]; }
    }
    return [bot('No more classes this week.', aSrc())];
  }, /\b(when is my next class|what (class|classes) do i have next|my next class|next class i have)\b/);

  mine('my.units', 'How many units the student is taking this term or next, vs. the flat-rate range. "how many units am i taking", "am i full time".', ['term'], function (a) {
    var id = termFor(a.term) || curTerm(), u = TA.State.termUnits(id), Tu = (TA.POLICY || {}).tuition || {};
    return [bot('You’re registered for **' + u + ' units** in ' + (CAL()[id] || {}).label + '. ' + (u >= (Tu.flatMin || 12) && u <= (Tu.flatMax || 18) ? 'That’s in the flat-rate tuition range (' + Tu.flatMin + '–' + Tu.flatMax + ' units).' : u < (Tu.flatMin || 12) ? 'That’s below the ' + Tu.flatMin + '-unit flat-rate range.' : 'That’s above ' + Tu.flatMax + ' units (per-unit charges apply).'), aSrc().concat([SRC.tuition]))];
  }, /\bhow many units (am i|do i have|i am)\b|\bmy (total )?units\b|\bam i full ?time\b/);

  mine('my.profs', 'Who teaches the student’s classes (instructors on the student’s own sections). "who are my professors", "who teaches my math class".', ['term'], function (a) {
    var id = termFor(a.term) || curTerm();
    return [bot('**Your instructors (' + (CAL()[id] || {}).label + '):**\n' + list(myCourses(id).map(function (c) { var n = Array.from(new Set((c.sections || []).map(function (x) { return x[5]; }).filter(Boolean))); return '**' + c.code + '** ' + c.title + ': ' + (n.join(', ') || 'not listed'); })), aSrc())];
  }, /\b(who are my (professors|profs|instructors|teachers)|my (professors|profs|instructors|teachers))\b/, /\b(email|contact|office hours|reach|message|rate|rating)\b/);

  mine('my.finals', 'The student’s own final exam schedule for this term, from their class times (Registrar rules). "when are my finals", "my final exam schedule".', ['term'], function (a) {
    var id = termFor(a.term) || curTerm(), rows = [];
    myCourses(id).forEach(function (c) { var lec = (c.sections || []).filter(function (x) { return /lec/i.test(x[1]); })[0] || (c.sections || [])[0]; if (!lec) return; var f = SOC.finalFor(id, c.code, lec[2], lec[3], lec[4]); rows.push('**' + c.code + '**: ' + (f ? f.day + ', ' + f.hour : 'not set by the grid (ask your instructor)')); });
    return [bot('**Your ' + (CAL()[id] || {}).label + ' finals** (' + ((TA.FINALS || {})[id] || {}).dates + '):\n' + list(rows) + '\n\n_Worked out from your class times and the Registrar’s final exam schedule; your instructor confirms the room._', aSrc().concat([SRC.finals]))];
  }, /\b(when are my finals|my finals?( schedule| exam schedule)?|my final exams?)\b/, /\b(grade|need|study)\b/);

  mine('my.registration', 'The student’s registration appointment, holds and D-clearances. "when is my registration appointment", "do i have any holds", "my d clearances".', ['what'], function (a) {
    var Ac = D().academics || {}, t = norm(a.what);
    var rows = [Ac.regAppointment ? 'Registration appointment: **' + fdt(Ac.regAppointment) + '**' : 'No registration appointment on file', (Ac.holds || []).length ? '**Holds:** ' + Ac.holds.map(function (h) { return h.name || h.type || h; }).join(', ') : 'Holds: **none**', (Ac.dclearances || []).length ? 'D-clearances: ' + Ac.dclearances.map(function (x) { return x.code || x; }).join(', ') : 'D-clearances: none'];
    if (/hold/.test(t)) rows = [rows[1]]; else if (/clear/.test(t)) rows = [rows[2]]; else if (/appoint|when/.test(t)) rows = [rows[0]];
    return [bot(list(rows), aSrc(), [go('Academics', 'academics')])];
  }, (function () { var r = /\b(registration (appointment|time|date)|reg appointment|holds?|d ?clearances?)\b/; r.args = function (t) { return { what: /hold/.test(t) ? 'holds' : /clearance/.test(t) ? 'clearance' : 'appointment' }; }; return r; })(), /\b(place|put|release|remove|lift)\b/);

  mine('my.completed', 'Courses the student has already completed (on their record). "what classes have i taken", "did i take csci 103".', ['course'], function (a) {
    var C = (D().academics || {}).completed || [], code = (TA.NLU.parse(String(a.course || '')).courses || [])[0];
    if (code) return [bot(C.indexOf(code) >= 0 ? 'Yes, **' + code + '** is on your record as completed.' : '**' + code + '** isn’t on your completed list.', aSrc())];
    return [bot('**Completed courses** (' + C.length + '):\n' + list(C, 30), aSrc())];
  }, (function () { var r = /\b(what (classes|courses) have i (taken|completed|done)|my completed (classes|courses)|did i (already )?(take|complete|pass))\b/; r.args = function (t, raw) { return { course: (TA.NLU.parse(raw).courses || [])[0] }; }; return r; })());

  mine('my.advisor', 'The student’s academic advisor and advising appointments. "who is my advisor", "my advising appointment".', [], function () {
    var Ac = D().academics || {}, ad = Ac.advisor, ap = ((D().advising || {}).appointments || []);
    return [bot(list([ad ? 'Advisor: **' + (ad.name || ad) + '**' + (ad.email ? ' · ' + ad.email : '') + (ad.office ? ' · ' + ad.office : '') : 'No advisor on file', ap.length ? 'Appointments: ' + ap.map(function (x) { return (x.type || 'Advising') + ' · ' + fdt(x.at); }).join('; ') : 'No advising appointments booked']), aSrc(), [{ label: 'Book advising', value: 'book an advising appointment', kind: 'action' }])];
  }, /\b(who is my (academic )?advisor|my (academic )?advisor|my advising appointment)\b/);

  mine('my.dining', 'The student’s meal plan: swipes left, Dining Dollars, guest swipes. "how many swipes do i have left", "dining dollars balance", "my meal plan".', [], function () {
    var d = D().dining || {}, mp = TA.State.mealPlan();
    return [bot('**Your meal plan' + (mp ? ': ' + mp.name : '') + '**\n' + list(['Meal swipes left: **' + d.swipesLeft + '** of ' + d.swipesTotal, 'Dining Dollars: **' + money(d.diningDollars) + '**', 'Guest swipes left: **' + d.guestLeft + '**', mp ? mp.short : null]), aSrc().concat([SRC.meal]), [{ label: 'Add Dining Dollars', value: 'add dining dollars', kind: 'action' }, go('Order food', 'order')])];
  }, (function () { var r = /\b(swipes?|dining dollars|meal plan|guest swipes?|dd balance)\b/; r.bare = /^(how many )?(meal )?(swipes?|dining dollars|dd)( balance| left| remaining| do i have)?$/; return r; })(), /\b(change|switch|cancel|upgrade|add|buy|which|what are the|options|prices?|cost|where|how do)\b/);

  mine('my.uscard', 'The student’s USCard status and discretionary balance. "how much is on my uscard", "is my id card active".', [], function () {
    var u = D().uscard || {}; return [bot('**Your USCard:** ' + (u.status || 'active') + ' · discretionary balance **' + money(u.discretionary) + '**' + (u.replacement ? ' · replacement ' + (u.replacement.status || 'requested') : ''), aSrc().concat([SRC.uscard]), [{ label: 'Add funds', value: 'add money to my uscard', kind: 'action' }])];
  }, /\b(uscard|usc card|student id|discretionary)\b.{0,30}\b(balance|how much|money|funds|active|status)\b|\b(balance|how much|money) (is )?on my (uscard|usc card|id|card)\b/);

  mine('my.balance', 'The student’s account balance, due date, payment plan and recent charges/payments. "what do i owe", "when is my bill due", "my tuition balance", "show my charges".', ['what'], function (a) {
    var b = D().billing || {}, t = norm(a.what);
    var md = 'Balance due: **' + money(b.balance) + '**' + (b.due ? ' by **' + TA.fmtDate(b.due) + '** (' + rel(b.due) + ')' : '') + (b.paymentPlan ? '\nPayment plan: ' + (b.paymentPlan.name || 'enrolled') : '');
    if (/charge|item|statement|break|detail/.test(t) || !t) md += '\n\n**Recent items:**\n' + list((b.items || []).slice(-8).map(function (x) { return TA.fmtDate(x.date) + ' · ' + x.desc + ' · ' + (x.amt < 0 ? '−' + money(-x.amt) : money(x.amt)); }), 8);
    return [bot(md, aSrc(), [{ label: 'Make a payment', value: 'pay my balance', kind: 'action' }])];
  }, (function () { var r = /\b(what do i owe|how much do i owe|my (account )?balance|my bill|bill due|my tuition (bill|balance)|my charges|my statement|when is my (bill|payment|tuition) due)\b/; r.args = function (t) { return { what: /charge|statement|item/.test(t) ? 'charges' : 'balance' }; }; return r; })(), /\b(uscard|dining|swipes|library|fine|fees? (are|on)|besides|what is (the|a)|why|explain|charge (for|on)|finance charge|escheat|credit)\b/);

  mine('my.housing', 'The student’s housing: building, room type, front desk (CSC) contact, open requests. "where do i live", "my housing info", "my csc phone number".', [], function () {
    var h = D().housing || {}, ci = h.cscInfo || {};
    return [bot('**Your housing** (' + (h.term || '') + ')\n' + list([h.building ? 'Building: **' + h.building + '**' : null, h.room ? 'Room: ' + h.room : null, h.address ? 'Address: ' + h.address : null, ci.name ? 'Front desk: ' + ci.name + (ci.where ? ' (' + ci.where + ')' : '') + ' · ' + (ci.phone || '') : h.csc, (h.requests || []).length ? 'Open requests: ' + h.requests.length : null]), aSrc().concat([srcOf('https://housing.usc.edu/index.php/csc/', 'Customer Service Centers – USC Housing')]), [{ label: 'Report a maintenance issue', value: 'submit a maintenance request', kind: 'action' }])];
  }, /^(what is |whats |where is |show me |tell me )?(my (housing|dorm|room|building|apartment)( info| assignment| details| address)?|where do i live|what (dorm|building) (am i in|do i live in)|my (csc|front desk)( phone| number| phone number)?)$/);

  mine('my.parking', 'The student’s parking permit (if any). "do i have a parking permit", "my parking permit".', [], function () {
    var p = (D().parking || {}).permit || (H().parking); return [bot(p ? 'Your permit: **' + (p.name || p.type || p.id) + '**' + (p.term ? ' · ' + p.term : '') + (p.where ? ' · ' + p.where : '') : 'You don’t have a parking permit on file.', aSrc().concat([SRC.parking]), [say('Permit prices', 'parking permit prices')])];
  }, /\bmy (parking )?permit\b|\bdo i have a (parking )?permit\b/);

  mine('my.library', 'The student’s library loans (due dates, renewals) and room reservations. "when are my library books due", "my library loans", "do i have overdue books".', [], function () {
    var L = D().library || {}, lo = L.loans || [], rs = L.reservations || [];
    return [bot('**Library loans** (' + lo.length + '):\n' + list(lo.map(function (b) { return '**' + b.title + '** · due ' + TA.fmtDate(b.due) + ' (' + rel(b.due) + ')' + (b.renewals ? ' · renewed ' + b.renewals + '×' : ''); })) + (rs.length ? '\n\n**Room reservations:**\n' + list(rs.map(function (r) { return (r.lib || 'Library') + ' · ' + fdt(r.at); })) : ''), aSrc(), [{ label: 'Renew my books', value: 'renew my library books', kind: 'action' }])];
  }, /\b(library (books?|loans?)|books? (are )?due|overdue books?|checked out books?)\b/, /\b(renew|return|reserve|book a)\b/);

  mine('my.health', 'The student’s health appointments, prescriptions and insurance status. "do i have a doctor appointment", "my prescriptions", "is my insurance waived".', [], function () {
    var h = D().health || {};
    return [bot('**Your health records on this device**\n' + list(['Appointments: ' + ((h.appointments || []).length ? h.appointments.map(function (x) { return (x.type || 'Visit') + ' · ' + fdt(x.at); }).join('; ') : 'none booked'), 'Prescriptions: ' + ((h.prescriptions || []).length ? h.prescriptions.map(function (x) { return x.name + ' (' + x.refills + ' refills, ' + x.pharmacy + ')'; }).join('; ') : 'none'), 'Insurance: ' + (h.insurance || 'not on file')]), aSrc(), [{ label: 'Book an appointment', value: 'book a health appointment', kind: 'action' }])];
  }, /\b(my (health|medical|doctor|doctors) appointments?|my prescriptions?|my (health )?insurance|is my insurance waived)\b/);

  mine('my.appointments', 'All the student’s upcoming appointments: health, advising, career. "what appointments do i have", "my upcoming appointments".', [], function () {
    var rows = []; [['Health', (D().health || {}).appointments], ['Advising', (D().advising || {}).appointments], ['Career', (D().careers || {}).appointments]].forEach(function (k) { (k[1] || []).forEach(function (x) { rows.push({ at: x.at, s: '**' + k[0] + '**' + (x.type ? ' · ' + x.type : '') + ' · ' + fdt(x.at) + (x.kind ? ' (' + x.kind + ')' : '') }); }); });
    rows.sort(function (x, y) { return x.at < y.at ? -1 : 1; });
    return [bot(rows.length ? '**Your appointments:**\n' + list(rows.map(function (r) { return r.s; })) : 'You have no health, advising or career appointments booked.', aSrc())];
  }, /\b(what appointments do i have|my (upcoming )?appointments|any appointments)\b/);

  mine('my.orders', 'The student’s mobile food orders (simulated): status, pickup time, order code. "where is my food order", "my orders", "is my order ready".', [], function () {
    var o = (H().orders || []).slice().reverse();
    if (!o.length) return [bot('You have no food orders yet.', aSrc(), [go('Order food', 'order')])];
    return [bot('**Your orders** (Simulated):\n' + list(o.slice(0, 5).map(function (x) { var p = P(x.at) || {}; var e = TH.orderEta ? (function () { try { return TH.orderEta(x); } catch (er) { return null; } })() : null; return '**' + (p.name || x.at) + '** · code ' + x.code + ' · pickup ' + fmtMin(x.window) + '–' + fmtMin(x.window + 10) + ' · ' + (x.state === 'picked' ? 'picked up' : e && e.stage === 2 ? 'ready' : x.state) + ' · ' + money(x.total); })), aSrc(), [go('Open orders', 'order')])];
  }, /\b(my (food )?orders?|is my (food |order )?(order )?ready|where is my (food|order))\b/);

  mine('my.bookings', 'The student’s bookings and reservations: study rooms/courts (Trojan Pass), virtual lines, Zipcar, library rooms (simulated). "my bookings", "what did i reserve", "am i in any lines".', [], function () {
    var Hh = H(), rows = [];
    (Hh.passes || []).forEach(function (b) { var def = (TH.PASSES || []).find(function (x) { return x.id === b.id; }) || {}; rows.push('**' + (def.name || b.id) + '** · ' + TA.fmtDate(b.day) + ' ' + fmtMin(b.start)); });
    (Hh.lines || []).filter(function (l) { return l.state === 'waiting'; }).forEach(function (l) { var q = (TH.QUEUES || []).find(function (x) { return x.id === l.id; }) || {}; rows.push('In line: **' + (q.name || l.id) + '** · #' + l.pos); });
    (Hh.zips || []).forEach(function (z) { rows.push('**Zipcar** · ' + TA.fmtDate(z.day) + ' ' + fmtMin(z.start) + ' for ' + z.hours + ' h'); });
    ((D().library || {}).reservations || []).forEach(function (r) { rows.push('**' + (r.lib || 'Library room') + '** · ' + fdt(r.at)); });
    return [bot(rows.length ? '**Your bookings** (Simulated):\n' + list(rows, 12) : 'You have no bookings, reservations or virtual lines right now.', aSrc(), [go('Passes', 'passes')])];
  }, /\b(my (bookings?|reservations?|passes|trojan pass(es)?)|what did i (book|reserve)|am i in (any|a) (line|queue)|my (spot|place) in line)\b/);

  mine('my.ride', 'The student’s current USC Lyft ride (simulated) and Lyft credit used this month. "where is my ride", "is my lyft here", "how much lyft have i used".', [], function () {
    var r = H().ride, used = H().lyftUsedUSD || 0, cap2 = (T().lyft || {}).monthlyCapUSD;
    return [bot((r && r.state !== 'done' ? 'Your ride to **' + r.to + '** is **' + r.state + '**' + (r.left ? ' (~' + r.left + ' min)' : '') + ' · ' + r.car + ' ' + r.plate + ' (Simulated).' : 'You don’t have an active ride.') + '\nUSC Lyft used this month: **' + money(used) + '**' + (cap2 ? ' of the ' + money(cap2) + ' program cap' : '') + '.', aSrc().concat([SRC.lyft]), [go('Lyft', 'lyft')])];
  }, /\b(where is my (ride|lyft|driver)|is my (ride|lyft|driver) here|my (lyft|ride) status|how much lyft have i used)\b/);

  mine('my.upass', 'The student’s Metro U-Pass status (simulated in this demo). "do i have a u-pass", "is my upass active".', [], function () {
    var u = H().upass; return [bot(u ? 'Your U-Pass: **' + (u.status || 'requested') + '**' + (u.term ? ' · ' + u.term : '') + ' (Simulated).' : 'You haven’t requested a Metro U-Pass in Trojan Hub.', aSrc().concat([SRC.upass]), [{ label: 'Get a U-Pass', value: 'get me a u-pass', kind: 'action' }])];
  }, /\b(my u ?pass|is my u ?pass|do i have a u ?pass)\b/);

  mine('my.clubs', 'Clubs the student joined in Trojan Hub and their next events. "what clubs am i in", "my clubs", "next meeting for my clubs".', [], function () {
    var cs = H().clubs || [];
    if (!cs.length) return [bot('You haven’t joined any clubs in Trojan Hub yet.', aSrc(), [go('Browse clubs', 'clubs')])];
    return [bot('**Your clubs:**\n' + list(cs.map(function (c) { var full = TH.clubById ? TH.clubById(c.id) : null, ev = full ? clubEvs(full)[0] : null; return '**' + c.name + '**' + (ev ? ' · next: ' + ev.title + ' (' + evWhen(ev) + ')' : ''); })), aSrc().concat([SRC.engage]), [go('Clubs', 'clubs')])];
  }, /\b(what clubs am i (in|a member of)|my clubs|clubs i joined|clubs im in)\b/);

  mine('my.calendar', 'Events the student saved to their Trojan Hub calendar. "what events did i save", "my saved events", "what’s on my calendar this week".', ['day'], function (a) {
    var cal = (H().calendar || []).filter(function (c) { return !c.end || new Date(c.end) >= now(); }).sort(function (x, y) { return x.start < y.start ? -1 : 1; });
    if (a.day) { var dd = dk(dayArg(a.day).d); cal = cal.filter(function (c) { return String(c.start).slice(0, 10) === dd; }); }
    return [bot(cal.length ? '**Your saved events:**\n' + list(cal.map(function (c) { return '**' + c.title + '** · ' + TH.fmtDate(TH.laDate(c.start)) + ' ' + TH.fmtTime(TH.laDate(c.start)) + (c.org ? ' · ' + c.org : ''); }), 10) : 'No saved events' + (a.day ? ' that day' : '') + '.', aSrc(), [go('My Day', 'plans')])];
  }, /\b(my saved events|events i saved|what events did i (save|rsvp)|events i rsvpd|my rsvps|whats on my calendar)\b/);

  mine('my.activity', 'What Tommy has done on the student’s account recently (audit log with confirmation numbers). "what have you done for me", "my recent activity", "show my audit log".', [], function () {
    var L = (D().log || []).slice(0, 8);
    return [bot(L.length ? '**Recent activity** (newest first):\n' + list(L.map(function (x) { return x.action + (x.detail ? ': ' + x.detail : '') + ' · ' + fdt(x.at) + (x.conf ? ' · #' + x.conf : ''); })) : 'Nothing yet.', aSrc())];
  }, /\b(what have you done (for me|on my account)|my (recent )?activity|audit log|history of (my )?actions)\b/);

  mine('my.profile', 'The student’s profile: name, major, school, year, NetID, USC ID. "what’s my usc id", "what is my major", "my netid".', ['what'], function (a) {
    var p = D().profile || {}, t = norm(a.what);
    var rows = [['Name', (p.first || '') + ' ' + (p.last || '')], ['Major', p.major], ['School', p.school], ['Year', p.year || p.level], ['NetID', p.netid], ['USC ID', p.uscid || (TH.student ? TH.student().uscid : '')], ['Email', p.email]].filter(function (r) { return r[1]; });
    var sel = rows.filter(function (r) { return t && norm(r[0]).indexOf(t.replace(/^(my |usc )/, '').split(' ')[0]) >= 0; });
    return [bot(list((sel.length ? sel : rows).map(function (r) { return r[0] + ': **' + r[1] + '**'; })), aSrc(), [go('Profile', 'profile')])];
  }, (function () { var r = /\b(whats|what is) my (usc id|id number|student id number|netid|net id|major|school|year|email)\b|\bmy (usc id|netid|net id) (number)?$/; r.args = function (t) { return { what: (/(usc id|id number|netid|net id|major|school|year|email)/.exec(t) || [])[1] }; }; return r; })());

  mine('my.free', 'When the student is free on a day (gaps between their classes and saved plans). "when am i free tomorrow", "do i have time between classes today".', ['day'], function (a) {
    var day = dayArg(a.day), L = (TH.classesOn ? TH.classesOn(day.d) : []).map(function (c) { return [c.start, c.end, c.code]; });
    (H().calendar || []).forEach(function (c) { if (String(c.start).slice(0, 10) === dk(day.d)) { var s = TH.laDate(c.start), e = TH.laDate(c.end || c.start); L.push([minOf(s), Math.max(minOf(e), minOf(s) + 30), c.title]); } });
    L.sort(function (x, y) { return x[0] - y[0]; });
    var from = day.today ? Math.max(480, minOf(now())) : 480, gaps = [], cur = from;
    L.forEach(function (b) { if (b[0] - cur >= 30) gaps.push([cur, b[0]]); cur = Math.max(cur, b[1]); }); if (1320 - cur >= 30) gaps.push([cur, 1320]);
    return [bot('**Free ' + day.label + '** (8 AM – 10 PM):\n' + list(gaps.map(function (g) { return fmtMin(g[0]) + '–' + fmtMin(g[1]) + ' (' + Math.round((g[1] - g[0]) / 6) / 10 + ' h)'; })) + (L.length ? '\n\nBusy: ' + L.map(function (b) { return b[2] + ' ' + fmtMin(b[0]); }).join(', ') : ''), aSrc(), [say('Plan my day', 'plan ' + (day.today ? 'my day' : day.label))])];
  }, (function () { var r = /\b(when am i free|am i free|my free time|free time (today|tomorrow)|time between (my )?classes)\b/; r.args = function (t) { return { day: (/(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(t) || [])[1] }; }; return r; })());

  mine('my.guestswipes', 'Guest meal swipes the student has left and how they work. "how many guest swipes do i have", "can i swipe in a friend".', [], function () {
    var d = D().dining || {}; return [bot('You have **' + d.guestLeft + ' guest swipes** left this semester. A guest swipe brings a friend into a dining hall on your meal plan.', aSrc().concat([SRC.meal]))];
  }, /\bguest swipes?\b|\bswipe (in )?(a )?friend\b/);

  // ============================================================================================ MISC
  F('usc.facts', 'Verified fun facts and history about USC (founding, Tommy Trojan, Traveler, traditions). "tell me a fun fact about usc", "when was usc founded", "who is traveler". topic?',
    ['topic'], function (a) {
      var Fs = TH.FACTS || [], tw = words(a.topic).filter(function (w) { return w.length > 3 && !/^(fact|facts|about|tell|random|usc)$/.test(w); });
      var hit = tw.length ? Fs.filter(function (f) { var h = norm(f.text); return tw.some(function (w) { return h.indexOf(w) >= 0; }); }) : [];
      var L = hit.length ? hit.slice(0, 3) : [Fs[(new Date()).getMinutes() % Math.max(1, Fs.length)]];
      return [bot(list(L.map(function (f) { return f.text; })), L.map(function (f) { return srcOf(f.url, 'USC'); }).slice(0, 2), [say('Another fact', 'another usc fun fact')])];
    }, function (t) { var m = /\b(fun fact|random fact|trivia|another usc fun fact)\b/.test(t) || /\b(when was usc founded|who (is|was) traveler|who is tommy trojan|usc history)\b/.exec(t); return m ? { topic: (/(traveler|tommy|founded|band|history)/.exec(t) || [])[1] } : null; });

  F('time.today', 'Today’s date, time and what kind of day it is on campus (holiday, finals, game day). "what’s today’s date", "what day is it", "is today a holiday". (no args)',
    [], function () {
      var d = now(), k = dk(d), Hd = ((TA.POLICY || {}).holidays || {})[k], gd = (TH.gameDays ? TH.gameDays() : []).indexOf(k) >= 0;
      return [bot('It’s **' + TA.fmtLongDate(TA.today()) + '**, ' + TA.fmtTime(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')) + ' campus time' + (Hd ? ' · **' + Hd + '** (university holiday)' : '') + (gd ? ' · **home game day**' : '') + '.\n\n_The demo is pinned to Nov 9, 2026._', [SRC.cal])];
    }, function (t) { return /^(what is |whats )?(todays date|the date today|the date|what day is it( today)?|what day is today)$/.test(t) ? {} : null; });

  F('tommy.topics', 'What Ask Tommy can answer: the command families by topic. "what can you do", "what can i ask you", "help me use tommy". (no args)',
    [], function () {
      var g = {}; X.names.forEach(function (n) { var k = n.split('.')[0]; (g[k] = g[k] || []).push(n); });
      var lab = { course: 'Classes (Schedule of Classes)', place: 'Places & hours', open: 'Open now', dining: 'Dining', office: 'Offices', bus: 'USC buses', lyft: 'Free Lyft', metro: 'Metro', upass: 'U-Pass', parking: 'Parking', safety: 'Safety info', campus: 'Campus access', cal: 'Academic calendar', club: 'Clubs', events: 'Events', event: 'Events', my: 'Your account (on device)' };
      return [bot('I can look these up from USC’s own data:\n' + list(Object.keys(lab).filter(function (k) { return g[k]; }).map(function (k) { return '**' + lab[k] + '**: ' + g[k].length + ' kinds of questions'; }), 20) + '\n\nTry “is evk open”, “who teaches CSCI 104”, “free food today” or “how many swipes do I have”.', [SRC.soc])];
    });

  // ============================================================================================ MORE FAMILIES
  // ---- courses
  F('course.code', 'The course code for a USC course name (Schedule of Classes). "what’s the course code for data structures", "what is intro to psychology called on the schedule". name; term?',
    ['name', 'term'], function (a) {
      var r = findCourse(a.name, a.term); if (!r || !r.list.length) return [bot('I couldn’t find a course called **' + (a.name || '') + '** in Fall 2026 or Spring 2027.', [SRC.soc])];
      var seen = {}, rows = r.list.filter(function (f) { if (seen[f.c.code]) return false; seen[f.c.code] = 1; return f.hit >= r.list[0].hit; }).slice(0, 5);
      return [bot(rows.length === 1 ? '**' + rows[0].c.title + '** is **' + rows[0].c.code + '** (' + rows[0].c.units + ' units).' : 'Courses matching **' + a.name + '**:\n' + list(rows.map(function (f) { return '**' + f.c.code + '** ' + f.c.title; })), [SRC.soc])];
    }, function (t) { var m = /^(?:what is |whats )?(?:the )?(?:course code|class code|course number) (?:for|of) (.{4,50})$/.exec(t); return m ? { name: m[1] } : null; });

  function minArg(v) { var m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(String(v || '')); if (!m) return null; var h = +m[1] % 12 + (/pm/i.test(m[3] || '') || (!m[3] && +m[1] < 8) ? 12 : 0); return h * 60 + +(m[2] || 0); }
  F('course.bytime', 'USC courses on a topic that start after / end before a time, optionally on certain days. "psych classes after 2pm", "no 8am math classes", "film classes that end before noon on tuesdays". topic; after? like "10am"; before? like "5pm"; days? like "TH"; term?',
    ['topic', 'after', 'before', 'days', 'term'], function (a) {
      if (!SOC || !SOC.ready) return [bot('The class schedule is still loading.')];
      var id = termIds(a.term || 'spring')[0], af = minArg(a.after), bf = minArg(a.before), dset = String(a.days || '').toUpperCase().replace(/[^MTWHF]/g, ''), out = [];
      SOC.search(id, String(a.topic || ''), { limit: 40 }).forEach(function (c) {
        var ok = lectures(c).filter(function (s) { return (s.meets || []).length && s.meets.every(function (m) { var st = TA.minutes(m.start), en = TA.minutes(m.end); return st != null && (af == null || st >= af) && (bf == null || en <= bf) && (!dset || dset.split('').every(function (ch) { return String(m.days).indexOf(ch) >= 0; })); }); });
        if (ok.length) out.push({ c: c, s: ok[0], n: ok.length });
      });
      var cond = [af != null ? 'starting at/after ' + fmtMin(af) : '', bf != null ? 'ending by ' + fmtMin(bf) : '', dset ? 'on ' + TA.fmtDays(dset) : ''].filter(Boolean).join(', ');
      if (!out.length) return [bot('No ' + SOC.label(id) + ' **' + a.topic + '** lectures ' + cond + '.', [SRC.soc])];
      return [bot('**' + SOC.label(id) + '** · ' + a.topic + ' · ' + cond + ':\n' + list(out.map(function (x) { return '**' + x.c.code + '** ' + x.c.title + ' · ' + meetTxt(x.s) + (x.n > 1 ? ' (+' + (x.n - 1) + ')' : ''); }), 10) + SOC_NOTE, socSrc(id))];
    });

  F('course.byunits', 'USC courses on a topic with a given number of units (e.g. 1-, 2- or 4-unit classes). "2 unit classes in spring", "1 unit fun classes", "4 unit econ courses". units; topic?; term?',
    ['units', 'topic', 'term'], function (a) {
      var u = String((/(\d)/.exec(String(a.units || '')) || [])[1] || ''), id = termIds(a.term || 'spring')[0], mp = allCourses(id), out = [], tw = words(a.topic).filter(function (w) { return w.length > 2 && !/^(class|classes|course|courses|unit|units|fun|easy)$/.test(w); });
      if (!u || !mp) return [bot('How many units? For example “2 unit classes”.')];
      mp.forEach(function (c) { if (String(c.units).split(/[-–, ]/)[0] !== u || !live(c).length) return; var h = norm(c.code + ' ' + c.title + ' ' + (c.desc || '')); if (tw.length && !tw.every(function (w) { return h.indexOf(w) >= 0; })) return; out.push(c); });
      if (!out.length) return [bot('No ' + u + '-unit ' + (a.topic || '') + ' courses in ' + SOC.label(id) + '.', [SRC.soc])];
      return [bot('**' + out.length + ' ' + u + '-unit' + (tw.length ? ' ' + a.topic : '') + ' courses** in ' + SOC.label(id) + ':\n' + list(out.map(function (c) { return '**' + c.code + '** ' + c.title; }), 15) + SOC_NOTE, socSrc(id))];
    });

  F('course.compare', 'Compare two USC courses side by side: units, times, instructors, seats, prereqs. "csci 103 vs csci 104", "compare math 125 and math 126". a; b; term?',
    ['a', 'b', 'term'], function (a) {
      var rows = [a.a, a.b].map(function (q) { var r = findCourse(q, a.term || 'spring'); return r && r.list[0]; });
      if (!rows[0] || !rows[1]) return [bot('I need two courses I can find, like **CSCI 103** and **CSCI 104**.', [SRC.soc])];
      return [bot(rows.map(function (f) { var c = f.c, L = lectures(c); return head(c, f.term) + '\n- ' + c.units + ' units · ' + L.length + ' lecture section' + (L.length === 1 ? '' : 's') + '\n- e.g. ' + (L[0] ? meetTxt(L[0]) + ' · ' + (L[0].instr || 'TBA') : 'TBA') + '\n- Seats open: ' + L.reduce(function (n, s) { return n + SOC.seatsLeft(s); }, 0) + '\n- Prereq: ' + (c.prereq && c.prereq.length ? c.prereq.map(function (g) { return g.join(' or '); }).join(' and ') : 'none'); }).join('\n\n') + SOC_NOTE, [SRC.soc])];
    }, function (t, raw) { if (!/\b(vs|versus|compare|or|difference between)\b/.test(t) || !/\d{3}.*\d{3}/.test(t) || /\b(register|my|drop|swap)\b/.test(t)) return null; var cs = codesIn(raw); return cs.length === 2 ? { a: cs[0], b: cs[1] } : null; });

  F('course.count', 'How many courses or sections USC offers in a term, overall or for a prefix. "how many csci classes are there in spring", "how many courses does usc offer". prefix?; term?',
    ['prefix', 'term'], function (a) {
      var id = termIds(a.term || 'spring')[0], mp = allCourses(id), pre = String(a.prefix || '').toUpperCase().replace(/[^A-Z]/g, ''), n = 0, s = 0;
      if (mp) mp.forEach(function (c, k) { if (pre && k.split(' ')[0] !== pre) return; var L = live(c); if (L.length) { n++; s += L.length; } });
      return [bot('**' + SOC.label(id) + '**: **' + n + ' ' + (pre ? pre + ' ' : '') + 'courses** with **' + s + ' sections** in the Schedule of Classes I carry.' + SOC_NOTE, socSrc(id))];
    });

  F('course.gecat', 'What a USC GE category is (A–H titles) and where its course list is. "what is ge-c", "what does ge h mean", "list the ge categories". cat?',
    ['cat'], function (a) {
      var L = TA.GE_LISTS || {}, k = ((/\b([a-h])\b/i.exec(String(a.cat || '').replace(/^ge[- ]?/i, ' ')) || [])[1] || '').toUpperCase();
      var ks = k && L[k] ? [k] : Object.keys(L).sort();
      return [bot('**USC GE categories:**\n' + list(ks.map(function (x) { return '**' + L[x].title + '** · ' + L[x].codes.length + ' courses on its list'; }), 10), ks.map(function (x) { return { url: L[x].url, title: L[x].title }; }).slice(0, 2))];
    }, function (t) { var m = /^(?:what is|whats|what does|what are) (?:a |the )?ge[- ]?([a-h])(?: mean| stand for| category)?$/.exec(t) || /^(?:what are the|list the|list of) ge categories$/.exec(t); return m ? { cat: m[1] } : null; });

  // ---- places
  F('place.search', 'Find campus places by what they offer, from their descriptions and features: gluten free, vegan, boba, smoothies, printing, pool, quiet study, microwaves, 24-hour. "where can i get boba", "gluten free food on campus", "where can i print". what',
    ['what'], function (a) {
      var tw = words(a.what).filter(function (w) { return w.length > 2 && !/^(where|can|get|find|campus|usc|the|place|places|food|near|any|some|there|with)$/.test(w); });
      if (!tw.length) return [bot('What are you looking for? For example “boba”, “gluten free” or “printing”.')];
      var hits = (TH.PLACES || []).filter(function (p) { var h = norm(p.name + ' ' + (p.desc || '') + ' ' + (p.tags || []).join(' ') + ' ' + (p.features || []).join(' ') + ' ' + (p.services || []).join(' ')); return tw.every(function (w) { return h.indexOf(w.replace(/s$/, '')) >= 0; }); });
      if (!hits.length) return [bot('None of the campus places I carry mention **' + a.what + '**.', [SRC.hours])];
      return [bot('Places that mention **' + a.what + '**:\n' + list(hits.map(function (p) { return '**' + p.name + '**' + (p.hours ? ' · ' + (TH.status(p, now()).open ? 'open now' : 'closed now') : ''); }), 10), pSrc(hits[0]), [go('Open the map', 'map', hits[0].id)])];
    }, function (t) { var m = /^where (?:can i|do i|to) (?:get|find|buy) (boba|smoothies?|juice|tea|gluten.?free (?:food)?|vegan (?:food)?|vegetarian (?:food)?|halal (?:food)?|pizza|tacos|burgers?|sushi|coffee)(?: on campus)?$/.exec(t); return m ? { what: m[1] } : null; });

  function lateList(c, d) {
    return (TH.PLACES || []).filter(function (p) { return inCat(p, c) && p.hours; }).map(function (p) { var r = hoursOn(p, d); if (!r || !r.length) return null; var close = Math.max.apply(null, r.map(function (x) { return x[1]; })); return { p: p, close: close }; }).filter(Boolean).sort(function (x, y) { return y.close - x.close; });
  }
  F('open.late', 'Which campus places stay open latest tonight (or on a day), by category: food, coffee, libraries, gyms. "what’s open latest tonight", "latest food on campus", "which library is open the latest", "anything open 24 hours". cat?; day?',
    ['cat', 'day'], function (a) {
      var c = catOf(a.cat || 'dining') || 'dining', day = dayArg(a.day), L = lateList(c, day.d).slice(0, 8);
      if (!L.length) return [bot('Nothing in that category has posted hours ' + day.label + '.', [SRC.hours])];
      return [bot('**Open latest ' + day.label + '** (' + c + '):\n' + list(L.map(function (x) { return '**' + x.p.name + '** · until ' + (x.close >= 1440 ? (x.close === 1440 ? 'midnight' : fmtMin(x.close - 1440) + ' (after midnight)') : fmtMin(x.close)); })) + '\n\n_Posted USC hours._', c === 'study' ? [SRC.lib] : c === 'fitness' ? [SRC.rec] : [SRC.hours])];
    }, function (t) { return /\b(open (the )?latest|latest (food|place|dining|coffee|library|gym)|open (24|twenty four) (hours|7)|24 hour (food|library|study|place))\b/.test(t) ? { cat: catOf(t) || (/librar|study/.test(t) ? 'study' : 'dining') } : null; });

  F('place.crowd', 'How busy a dining hall or gym usually is now and later today (Est., from typical patterns, not live). "how busy is evk right now", "when is the lyon center least crowded", "is parkside packed". place',
    ['place'], function (a) {
      var p = findPlaces(a.place).filter(function (x) { return x.crowd; })[0];
      if (!p) return [bot('I only have typical-busyness estimates for: ' + (TH.PLACES || []).filter(function (x) { return x.crowd; }).map(function (x) { return x.name; }).join(', ') + '.')];
      var h = now().getHours(), cur = p.crowd[h], quiet = [], peak = [];
      for (var i = h; i < 23; i++) { if (p.crowd[i] > 0 && p.crowd[i] <= 30) quiet.push(i); if (p.crowd[i] >= 80) peak.push(i); }
      var hr = function (x) { return fmtMin(x * 60); };
      return [bot('**' + p.name + '** right now: **' + (cur >= 80 ? 'very busy' : cur >= 50 ? 'busy' : cur > 0 ? 'not too busy' : 'closed or empty') + '** (Est. ' + cur + '/100).' + (peak.length ? '\nUsually busiest later today: ' + peak.map(hr).join(', ') + '.' : '') + (quiet.length ? '\nQuieter: ' + quiet.slice(0, 4).map(hr).join(', ') + '.' : '') + '\n\n_Est.: typical busyness by hour, not live counts._', pSrc(p))];
    }, function (t, raw) { if (!/\b(how busy|crowded|packed|busy right now|line long|least busy|least crowded)\b/.test(t)) return null; var p = findPlaces(raw).filter(function (x) { return x.crowd; })[0]; return p ? { place: p.id } : null; });

  F('restroom.allgender', 'All-gender / gender-neutral restrooms on campus from the map data. "all gender bathrooms", "gender neutral restroom near me". (no args)',
    [], function () { var L = (TH.PLACES || []).filter(function (p) { return p.allGender; }); return [bot('**All-gender / gender-neutral restrooms:**\n' + list(L.map(function (p) { return p.name; })), pSrc(L[0] || {}), [go('Restrooms on the map', 'map', 'restroom')])]; },
    function (t) { return /\b(all.?gender|gender.?neutral|unisex)\b.{0,12}\b(restrooms?|bathrooms?)\b/.test(t) ? {} : null; });

  F('open.weekend', 'What’s open this Saturday and Sunday by category, with hours: food, coffee, libraries, gyms, offices. "what dining is open on the weekend", "libraries open sunday", "is anything open saturday morning". cat?',
    ['cat'], function (a) {
      var c = catOf(a.cat || 'dining') || 'dining', sat = dayArg('saturday').d, sun = addDays(sat, 1);
      var ps = (TH.PLACES || []).filter(function (p) { return inCat(p, c) && p.hours; });
      var row = function (p) { return '**' + p.name + '**: Sat ' + rangesTxt(hoursOn(p, sat)) + ' · Sun ' + rangesTxt(hoursOn(p, sun)); };
      return [bot('**This weekend** (' + c + '):\n' + list(ps.filter(function (p) { var x = hoursOn(p, sat), y = hoursOn(p, sun); return (x && x.length) || (y && y.length); }).map(row), 14), c === 'study' ? [SRC.lib] : c === 'fitness' ? [SRC.rec] : [SRC.hours])];
    }, function (t) { return /\b(open|hours)\b.{0,20}\b(weekend|on saturday|on sunday|this saturday|this sunday)\b/.test(t) && /\b(what|whats|which|anything|any)\b/.test(t) && catOf(t) ? { cat: catOf(t) } : null; });

  F('landmark.facts', 'Facts about a USC landmark (Tommy Trojan, Traveler statue, Bovard, Coliseum, Galen Center, Hecuba…). "tell me about tommy trojan", "what is the hecuba statue", "history of bovard". place',
    ['place'], function (a) {
      var p = findPlaces(a.place).filter(function (x) { return x.cat === 'landmark'; })[0];
      if (!p) return [bot('Landmarks I know: ' + (TH.PLACES || []).filter(function (x) { return x.cat === 'landmark'; }).map(function (x) { return x.name; }).join(', ') + '.')];
      return [bot('**' + p.name + '**\n' + (p.desc || '') + ((p.facts || []).length ? '\n\n' + list(p.facts) : ''), pSrc(p), [go('Show on the map', 'map', p.id)])];
    }, function (t, raw) { if (!/\b(tell me about|history of|what is|who is|facts about)\b/.test(t)) return null; var p = findPlaces(raw).filter(function (x) { return x.cat === 'landmark'; })[0]; return p && p.id !== 'mccarthyquad' ? { place: p.id } : null; });

  F('open.closing', 'Campus places closing soon (within the next hour) by category. "what’s closing soon", "is anything about to close", "food closing soon". cat?',
    ['cat'], function (a) {
      var c = catOf(a.cat || 'dining') || 'dining', n = now(), m = minOf(n);
      var L = (TH.PLACES || []).filter(function (p) { return inCat(p, c) && p.hours && TH.openFor(p, n, 0) === true; }).map(function (p) { var st = TH.status(p, n); return { p: p, left: st && st.left }; }).filter(function (x) { return x.left != null && x.left <= 60; }).sort(function (x, y) { return x.left - y.left; });
      return [bot(L.length ? '**Closing within the hour** (' + c + '):\n' + list(L.map(function (x) { return '**' + x.p.name + '** · closes ' + fmtMin(m + x.left) + ' (in ' + x.left + ' min)'; })) : 'Nothing in ' + c + ' closes within the next hour.', [SRC.hours])];
    }, function (t) { return /\b(closing soon|about to close|closes soon)\b/.test(t) ? { cat: catOf(t) || 'dining' } : null; });

  // ---- transport
  F('bus.holidays', 'USC bus service on university holidays (no service) and which days have no buses. "do the buses run on thanksgiving", "is the shuttle running on veterans day". day?',
    ['day'], function (a) {
      var Hs = T().holidays || [], dd = a.day ? dayArg(a.day) : null;
      if (dd) { var k = dk(dd.d), off = Hs.indexOf(k) >= 0, runs = (T().buses || []).filter(function (b) { return (b.days || []).indexOf(dd.d.getDay()) >= 0; }); return [bot('**' + dd.label + '**: ' + (off ? 'university holiday, **no USC bus service**.' : runs.length ? runs.length + ' USC routes run that day: ' + runs.map(function (b) { return b.short || b.name; }).join(', ') + '.' : 'no USC routes run that day.'), [SRC.bus])]; }
      return [bot('**No USC bus service** on university holidays: ' + Hs.map(function (k) { return TA.fmtDate(k); }).join(', ') + '.\n' + ((T().busRules || {}).holidays || ''), [SRC.bus])];
    }, function (t) { return /\b(bus|buses|shuttle|tram|ics)\b/.test(t) && /\b(holiday|thanksgiving|veterans day|christmas|running on|run on)\b/.test(t) ? { day: (/(thanksgiving|veterans day|christmas|saturday|sunday)/.exec(t) || [])[1] } : null; });

  F('transport.cruiser', 'Campus Cruiser status (suspended; replaced by free USC Lyft). "is campus cruiser still a thing", "campus cruiser number". (no args)',
    [], function () { return [bot('**Campus Cruiser:** ' + (T().campusCruiser || 'suspended') + '\n\nUse free **USC Lyft** (' + ((T().lyft || {}).hoursText || '7 PM – 2 AM') + ') instead.', [srcOf('https://transnet.usc.edu/index.php/campus-cruiser-program/', 'Campus Cruiser – USC Transportation'), SRC.lyft])]; },
    function (t) { return /\bcampus cruiser\b/.test(t) ? {} : null; });

  F('bus.stop', 'Which USC buses stop at a stop and its next departures (Jefferson turnout, Leavey, Vivian Hall, 34th & McClintock). "what buses stop at leavey", "next bus at the jefferson turnout". stop',
    ['stop'], function (a) {
      var t = norm(a.stop), stops = (TH.PLACES || []).filter(function (p) { return /^stop-/.test(p.id); }), s = stops.filter(function (p) { return words(p.name).some(function (w) { return w.length > 4 && t.indexOf(w) >= 0; }); })[0];
      if (!s) return [bot('USC bus stops I know: ' + stops.map(function (p) { return p.name.replace(/^USC bus: /, ''); }).join(', ') + '.', [SRC.bus])];
      var nb = TH.nextBuses ? TH.nextBuses(s.id, now(), null, 6) : [];
      return [bot('**' + s.name + '**' + (s.desc ? '\n' + s.desc : '') + '\n\nNext departures: ' + (nb.length ? nb.map(function (x) { return x.short + ' ' + fmtMin(x.at) + (x.est ? ' (Est.)' : ''); }).join(', ') : 'none listed for the rest of today'), [SRC.bus], [go('Show on the map', 'map', s.id)])];
    });

  F('lyft.zone', 'Whether free USC Lyft covers a destination (must start and end inside the boundary; LAX, HSC and far trips are not covered). "can i take usc lyft to lax", "does lyft cover koreatown", "is santa monica in the lyft zone". to',
    ['to'], function (a) {
      var L = T().lyft || {}, b = (L.boundary || {}).text || '', to = String(a.to || ''), out = TH.lyftOutOfZone ? TH.lyftOutOfZone(to) : false, onCampus = findPlaces(to).length > 0;
      return [bot('**' + (to || 'That trip') + '**: ' + (out ? '**not covered** by free USC Lyft (outside the boundary).' : onCampus ? 'on or near campus, so it’s inside the boundary as long as you start inside it too.' : 'I can’t confirm it from the boundary alone.') + '\n\nBoundary: ' + b, [SRC.lyft])];
    }, function (t) { var m = /\b(?:can i (?:take|use) (?:usc |free )?lyft to|does (?:usc |free )?lyft (?:cover|go to)|is (.{3,30}) (?:in|inside) the lyft (?:zone|boundary))\s*(.{3,40})?$/.exec(t); return m ? { to: (m[1] || m[2] || '').trim() } : null; });

  F('parking.visitor', 'Where visitors and guests can park at USC and what it costs (daily/hourly, Text2Park, cheapest option). "where can my parents park", "visitor parking cost", "cheapest parking for a guest". (no args)',
    [], function () { var R = (T().parking || {}).rates || {}; return [bot('**Visitor parking**\n' + list(Object.keys(R).map(function (k) { return cap(k) + ': ' + R[k]; })) + '\n\nOn game days parking is cashless and $50.', [{ url: 'https://transnet.usc.edu/index.php/daily-and-hourly-parking/', title: 'Daily and Hourly Parking – USC Transportation' }, SRC.gameday], [go('Parking on the map', 'map', 'parking')])]; },
    function (t) { return /\b(visitor|guest|parents?|family|friend)s?\b.{0,20}\bpark(ing)?\b/.test(t) && !/\b(register|pass for)\b/.test(t) ? {} : null; });

  // ---- safety
  F('safety.trojansalert', 'TrojansAlert emergency notifications: who gets them, how to update your number, how parents sign up. "how do i get usc emergency alerts", "sign my parents up for trojansalert". (no args)',
    [], function () { var p = (SF().programs || []).filter(function (x) { return /trojansalert/i.test(x.name); })[0] || {}; return [bot('**TrojansAlert**\n' + (p.text || ''), [srcOf(p.url || 'https://dps.usc.edu/services/trojans-alerts/', 'TrojansAlert – DPS')])]; },
    function (t) { return /\btrojans? ?alerts?\b|\bemergency (alerts|texts|notifications)\b/.test(t) && !/\b(any|recent|latest|today)\b/.test(t) ? {} : null; });
  F('safety.livesafe', 'The LiveSafe safety app: what it does (call DPS, anonymous tips, SafeWalk) and how to set it up. "what is livesafe", "how do i use safewalk", "usc safety app". (no args)',
    [], function () { var p = (SF().programs || []).filter(function (x) { return /livesafe/i.test(x.name); })[0] || {}; return [bot('**LiveSafe**\n' + (p.text || '') + '\n\nSet up: download **LiveSafe**, create a profile, choose **University of Southern California**.', [srcOf(p.url || 'https://dps.usc.edu/services/safety-app/', 'LiveSafe – DPS')])]; },
    function (t) { return /\blive ?safe\b|\busc safety app\b/.test(t) ? {} : null; });

  // ---- calendar
  F('cal.day', 'What’s on the academic calendar on a date: deadlines, holidays, finals, game days, and the student’s classes that day. "what’s happening academically on nov 13", "anything due on the 25th", "what is december 4". day',
    ['day'], function (a) {
      var dd = dayArg(a.day), k = dk(dd.d), rows = [], c = CAL();
      Object.keys(c).forEach(function (id) { Object.keys(CALK).forEach(function (f) { if (c[id][f] === k) rows.push(c[id].label + ': ' + CALK[f]); }); });
      var Hd = ((TA.POLICY || {}).holidays || {})[k]; if (Hd) rows.push('University holiday: ' + Hd);
      if (k >= '2026-12-09' && k <= '2026-12-16') rows.push('Fall 2026 finals week');
      if ((TH.gameDays ? TH.gameDays() : []).indexOf(k) >= 0) rows.push('Home football game day');
      if (signedIn() && D().billing && D().billing.due === k) rows.push('Your bill is due (' + money(D().billing.balance) + ')');
      return [bot('**' + TA.fmtDate(k) + '** (' + rel(k) + '):\n' + (rows.length ? list(rows) : '- Nothing on the academic calendar.'), [SRC.cal])];
    });

  F('cal.upcoming', 'Upcoming academic milestones in the next few weeks (deadlines, holidays, last day of classes, finals, registration). "what deadlines are coming up", "anything important in the next two weeks", "upcoming academic dates". days?',
    ['days'], function (a) {
      var n = Math.min(120, +a.days > 0 ? +a.days : 30), k0 = dk(now()), k1 = dk(addDays(dayStart(now()), n)), rows = [], c = CAL(), Hd = (TA.POLICY || {}).holidays || {};
      Object.keys(c).forEach(function (id) { Object.keys(CALK).forEach(function (f) { var v = c[id][f]; if (v && v >= k0 && v <= k1) rows.push([v, c[id].label + ': ' + CALK[f]]); }); });
      Object.keys(Hd).forEach(function (k) { if (k >= k0 && k <= k1) rows.push([k, Hd[k] + ' (holiday)']); });
      if ('2026-12-09' >= k0 && '2026-12-09' <= k1) rows.push(['2026-12-09', 'Fall 2026 finals begin']);
      (TH.gameDays ? TH.gameDays() : []).forEach(function (k) { if (k >= k0 && k <= k1) rows.push([k, 'Home football game']); });
      rows.sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
      return [bot('**Next ' + n + ' days:**\n' + (rows.length ? list(rows.map(function (r) { return '**' + TA.fmtDate(r[0]) + '** (' + rel(r[0]) + ') · ' + r[1]; }), 14) : '- Nothing on the academic calendar.'), [SRC.cal])];
    }, function (t) { return /\b(upcoming (academic )?(dates|deadlines)|deadlines (coming up|this month)|what deadlines are coming|important dates)\b/.test(t) && !/\bmy\b/.test(t) ? {} : null; });

  // ---- clubs & events
  F('club.active', 'The most active USC clubs right now (most upcoming EngageSC events), optionally in a category. "most active clubs", "which clubs have the most events", "active cultural orgs". cat?',
    ['cat'], function (a) {
      var t = norm(a.cat), cs = (TH.CLUBS || []).filter(function (c) { return c.events > 0 && (!t || norm((c.cats || []).join(' ')).indexOf(t.slice(0, 5)) >= 0); }).sort(function (x, y) { return y.events - x.events; }).slice(0, 10);
      return [bot(cs.length ? '**Most active' + (t ? ' ' + a.cat : '') + ' groups** (upcoming EngageSC events):\n' + list(cs.map(function (c) { return '**' + c.name + '** · ' + c.events + ' events'; })) : 'No groups with upcoming events' + (t ? ' in ' + a.cat : '') + '.', [SRC.engage], [go('Browse clubs', 'clubs')])];
    }, function (t) { return /\b(most active|most events|busiest) (clubs|orgs|organizations|groups)\b/.test(t) ? {} : null; });

  F('events.cat', 'Upcoming public events in an EngageSC category (Arts, Social, Academics, Service, Sustainability, Spiritual, Research, Tour, Late Night ’SC…) over the next week. "arts events this week", "service events", "late night sc events". cat; days?',
    ['cat', 'days'], function (a) {
      var t = norm(a.cat).replace(/s$/, ''), n = +a.days > 0 ? +a.days : 7;
      var evs = evsBetween(now(), addDays(dayStart(now()), n), function (e) { return (e.cats || []).some(function (c) { return norm(c).indexOf(t) >= 0; }) || norm(e.type || '').indexOf(t) >= 0; });
      return evAnswer(evs, '**' + cap(a.cat || '') + '** events in the next ' + n + ' days (' + evs.length + '):', null, 'No public **' + (a.cat || '') + '** events in the next ' + n + ' days.');
    });

  F('events.where', 'Upcoming public events at a place or building (Coliseum, Tutor Campus Center, Bovard, HSC, Village…). "events at the coliseum", "what’s happening at tcc this week", "events in the village". place; days?',
    ['place', 'days'], function (a) {
      var tw = words(a.place).filter(function (w) { return w.length > 2 && !/^(the|at|in|on|campus|usc)$/.test(w); }), n = +a.days > 0 ? +a.days : 14;
      var evs = evsBetween(now(), addDays(dayStart(now()), n), function (e) { var h = norm(e.location || ''); return h && tw.every(function (w) { return h.indexOf(w) >= 0; }); });
      return evAnswer(evs, 'Events at **' + (a.place || '') + '** in the next ' + n + ' days (' + evs.length + '):', null, 'No public events listed at **' + (a.place || '') + '** in the next ' + n + ' days.');
    });

  F('events.next', 'The very next public campus event(s) starting soon. "what’s the next event on campus", "anything starting soon". (no args)',
    [], function () { var n = now(), evs = evsBetween(n, addDays(dayStart(n), 3), function (e) { return e.s >= n; }).slice(0, 4); return evAnswer(evs, '**Starting next:**', null, 'No public events in the next 3 days.'); },
    function (t) { return /\b(next event|events? starting soon|anything starting soon|whats next on campus)\b/.test(t) && !/\bmy\b/.test(t) ? {} : null; });

  F('events.ongoing', 'Ongoing multi-day campus events and exhibits (running across several days). "ongoing exhibits", "multi day events", "what exhibitions are on". (no args)',
    [], function () {
      var n = now(), L = (TH.events() || []).filter(function (e) { return e.multiDay && e.e >= n && e.s <= addDays(dayStart(n), 7); }).slice(0, 8);
      return [bot(L.length ? '**Ongoing / multi-day:**\n' + list(L.map(function (e) { return '**' + e.title + '** · until ' + TH.fmtDate(e.e) + (e.org ? ' · ' + e.org : ''); })) : 'No ongoing multi-day events.', [SRC.engage], [go('All events', 'events')])];
    }, function (t) { return /\b(ongoing (events|exhibits?|exhibitions?)|multi.?day events|exhibitions? (on|open) (now|right now))\b/.test(t) ? {} : null; });

  // ---- the student's account
  mine('my.week', 'The student’s week at a glance: classes, things due, saved events and bookings per day. "what does my week look like", "my week", "how busy am i this week".', [], function () {
    var rows = [];
    for (var i = 0; i < 7; i++) { var items = []; try { items = TH.dayItems(i) || []; } catch (e) { items = []; } var d = addDays(dayStart(now()), i); if (items.length) rows.push('**' + (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : TH.fmtDate(d)) + '** · ' + items.length + ' item' + (items.length > 1 ? 's' : '') + ': ' + items.slice(0, 4).map(function (x) { return x.title; }).join(', ') + (items.length > 4 ? '…' : '')); }
    return [bot(rows.length ? '**Your next 7 days:**\n' + list(rows, 7) : 'Nothing on your calendar this week.', aSrc(), [say('Plan my week', 'plan my week'), go('My Day', 'plans')])];
  }, /\b(what does my week look like|my week( ahead)?$|how busy am i this week|my week at a glance)\b/);

  mine('my.notifications', 'The student’s Trojan Hub notifications (unread first). "any notifications", "do i have new alerts", "my notifications".', [], function () {
    var N = (H().notes || []).slice().sort(function (x, y) { return (x.read - y.read) || (y.at - x.at); });
    return [bot(N.length ? '**Notifications** (' + N.filter(function (n) { return !n.read; }).length + ' unread):\n' + list(N.map(function (n) { return (n.read ? '' : '🔵 ') + '**' + n.title + '** · ' + n.body; }), 8) : 'No notifications.', aSrc(), [go('Alerts', 'alerts')])];
  }, /\b(any (new )?notifications|my notifications|do i have (new |any )?(alerts|notifications))\b/);

  mine('my.reports', 'Reports the student submitted in Trojan Hub (simulated routing) and their status. "status of my report", "my reports", "did my maintenance report go through".', [], function () {
    var R = ((H().x || {}).reports || []).slice().reverse();
    return [bot(R.length ? '**Your reports** (Simulated routing):\n' + list(R.map(function (r) { return '**' + (r.type || r.kind || 'Report') + '**' + (r.conf ? ' · #' + r.conf : '') + (r.status ? ' · ' + r.status : '') + (r.at ? ' · ' + TH.fmtDate(new Date(r.at)) : ''); }), 8) : 'You haven’t submitted any reports.', aSrc(), [say('Report something', 'report a problem')])];
  }, /\b(my reports?|status of my report|did my report go through)\b/);

  mine('my.wallet', 'What’s in the student’s Trojan Hub wallet: USCard, U-Pass, Apple Wallet pass, balances. "what’s in my wallet", "is my id in apple wallet".', [], function () {
    var u = D().uscard || {}, d = D().dining || {};
    return [bot('**Your wallet**\n' + list(['USCard: ' + (u.status || 'active') + ' · ' + money(u.discretionary) + ' discretionary', 'Dining Dollars: ' + money(d.diningDollars) + ' · ' + d.swipesLeft + ' swipes', 'Metro U-Pass: ' + (H().upass ? (H().upass.status || 'requested') : 'not added'), 'Apple Wallet pass: ' + (H().walletPass ? 'added (Simulated)' : 'not added')]), aSrc(), [go('Wallet', 'wallet')])];
  }, /\b(whats in my wallet|my wallet|is my (id|uscard|card) in (apple )?wallet)\b/, /\b(add|put)\b/);

  mine('my.prefs', 'The student’s saved preferences used for recommendations: interests, career goals, diet, allergies, minor. "what are my interests set to", "what allergies did i save", "my preferences".', [], function () {
    var p = TH.prefs ? TH.prefs() : {}, f = function (x) { return (x || []).length ? x.join(', ') : 'not set'; };
    return [bot('**Your preferences** (on this device)\n' + list(['Interests: ' + f(p.interests), 'Career interests: ' + f(p.careerInterests), 'Career goals: ' + f(p.careerGoals), 'Club types: ' + f(p.clubTypes), 'Diet: ' + f(p.diet), 'Allergies: ' + f(p.allergies), 'Major: ' + (p.major || 'not set'), 'Minor: ' + (p.minor || 'not set')]), aSrc(), [go('Edit profile', 'profile')])];
  }, /\b(my (preferences|interests|allergies|diet)|what (are my interests|allergies did i))\b/, /\b(change|update|set|add|remove)\b/);

  mine('my.final_conflicts', 'Whether any of the student’s finals fall in the same slot or on the same day. "do any of my finals conflict", "do i have two finals on the same day".', [], function () {
    var id = curTerm(), slots = {};
    myCourses(id).forEach(function (c) { var lec = (c.sections || []).filter(function (x) { return /lec/i.test(x[1]); })[0] || (c.sections || [])[0]; if (!lec) return; var f = SOC.finalFor(id, c.code, lec[2], lec[3], lec[4]); if (f) (slots[f.day] = slots[f.day] || []).push(c.code + ' ' + f.hour); });
    var same = Object.keys(slots).filter(function (k) { return slots[k].length > 1; });
    return [bot(same.length ? '**Finals on the same day:**\n' + list(same.map(function (k) { return k + ': ' + slots[k].join(' · '); })) + '\n\nTwo finals at the **same time** can be rescheduled; the Registrar says to check with your instructors and Academic Counseling.' : 'None of your Fall 2026 finals share a day.', aSrc().concat([SRC.finals]))];
  }, /\b(finals? (conflict|overlap|clash)|two finals (on )?the same day|finals on the same day)\b/);

  mine('my.deadlines', 'The student’s own upcoming deadlines: bill due date, library books due, withdraw deadline, registration. "what are my deadlines", "anything i need to do this week", "what’s due for me".', [], function () {
    var rows = [], b = D().billing || {}, k0 = dk(now());
    if (b.due && b.balance > 0) rows.push([b.due, 'Pay ' + money(b.balance) + ' balance']);
    ((D().library || {}).loans || []).forEach(function (l) { rows.push([l.due, 'Return/renew “' + l.title + '”']); });
    var c = CAL()[curTerm()] || {}; ['lastWithdraw', 'classesEnd'].forEach(function (f) { if (c[f] && c[f] >= k0) rows.push([c[f], CALK[f]]); });
    rows = rows.filter(function (r) { return r[0] >= k0; }).sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
    return [bot('**Your upcoming deadlines:**\n' + list(rows.map(function (r) { return '**' + TA.fmtDate(r[0]) + '** (' + rel(r[0]) + ') · ' + r[1]; }), 10) + '\n\nFor homework and exams, ask “what’s due this week”.', aSrc().concat([SRC.cal]))];
  }, /\b(my (upcoming )?deadlines|what deadlines do i have|deadlines for me)\b/);

  // ---- about Tommy
  F('tommy.sources', 'Where Tommy’s answers come from and how current they are (USC pages, Schedule of Classes, EngageSC, hours; collected Nov 2026). "where do you get your info", "how accurate are you", "is this data live". (no args)',
    [], function () {
      var M = TA.KB_META || {};
      return [bot('My answers come only from data on this device:\n' + list(['**USC pages**: ' + (M.pages || '31,000+') + ' pages from ' + ((M.hostList || []).length || 'many') + ' USC sites, collected ' + (M.date || 'Nov 2026'), '**Schedule of Classes**: Fall 2026 and Spring 2027 (classes.usc.edu)', '**Places and hours**: USC Hospitality, Libraries, Rec Sports, Transportation pages', '**Clubs and events**: EngageSC public listings', '**Your account**: the demo student, stored only on this device']) + '\n\nNothing is live: seats, hours and events can change, so check the source links.', [SRC.soc, SRC.engage])];
    }, function (t) { return /\b(where do you get (your )?(info|information|data|answers)|how accurate are you|is (this|your) data (live|real|current|up to date))\b/.test(t) ? {} : null; });

  F('tommy.privacy', 'What the AI translator sees (only your words, never your account or results) and what stays on the device. "does the ai see my grades", "is my data private", "who can see my messages". (no args)',
    [], function () { return [bot('**Privacy in Ask Tommy**\n' + list(['Your message is turned into a script command. When the AI translator is on, it sees **only your words** (and your last few commands), never your account or any result.', 'The command runs **on this device**, which is where your account data lives.', 'Crisis, safety, health and other personal messages are **never sent to the AI**.', 'Settings can turn the AI translator off and hide the script line.']), [SRC.soc], [{ label: 'Settings', value: '@go:assistant', kind: '' }])]; },
    function (t) { return /\b(does (the )?ai see|can (the )?ai see|is my data (private|safe)|who can see my (messages|data)|do you store my)\b/.test(t) ? {} : null; });

  // ============================================================================================ extra on-device matchers (narrow; checked against the sample)
  var DAYL = { monday: 'M', mondays: 'M', tuesday: 'T', tuesdays: 'T', wednesday: 'W', wednesdays: 'W', thursday: 'H', thursdays: 'H', friday: 'F', fridays: 'F' };
  var EVT = null;
  function setMatch(name, fn) { if (TS.cmds[name]) TS.cmds[name].match = function (t, raw) { try { return fn(t, raw); } catch (e) { return null; } }; }
  // only when the student adds a filter the knowledge-base search can't apply (days, open seats)
  setMatch('course.find', function (t) {
    var m = /^(?:are there |is there )?(?:any |some |find |show me |list )*(.{3,30}?) (?:classes|courses|class)(?: (?:in|for) (spring|fall))?(?: (?:that meet |meeting )?on (mondays?|tuesdays?|wednesdays?|thursdays?|fridays?)| with (?:open )?seats| that (?:are|arent) full| that (?:still )?have (?:open )?seats| (?:that are )?(?:still )?open)(?: (?:in|for) (spring|fall))?$/.exec(t);
    if (!m || /\b(my|register|drop)\b/.test(t)) return null;
    var o = { topic: m[1].replace(/^(any|some)\s+/, '') }, d = /(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?)/.exec(t);
    if (d) o.days = DAYL[d[1]]; if (/\b(open|seats|full)\b/.test(t)) o.open = 'yes'; if (m[2] || m[3]) o.term = m[2] || m[3];
    return o;
  });
  setMatch('course.byunits', function (t) { var m = /^(?:any |are there (?:any )?|find |show me |list )?(\d)[ -]?units? (.{0,30}?)(?:classes|courses)(?: (?:in|for) (spring|fall))?$/.exec(t); return m ? { units: m[1], topic: m[2].trim() || undefined, term: m[3] } : null; });
  setMatch('course.dept', function (t) {
    var m = /^(?:what|which|list(?: of)?|all|show me)(?: the)? ([a-z]{2,4}) (?:classes|courses)(?: are)?(?: (?:offered|available))?(?: (?:in|for|next) (spring|fall|semester))?$/.exec(t);
    if (!m) return null; var pre = m[1].toUpperCase(); return SOC && SOC.prefixes && (SOC.prefixes[pre] || (SOC.prefixes.indexOf && SOC.prefixes.indexOf(pre) >= 0)) || allCourses('20271').has(pre + ' 101') || Array.from(allCourses('20271').keys()).some(function (k) { return k.indexOf(pre + ' ') === 0; }) ? { prefix: pre, term: m[2] === 'fall' ? 'fall' : 'spring' } : null;
  });
  setMatch('event.info', function (t, raw) {
    var m = /^(?:tell me about|what is|whats|when is|where is|info on|details (?:on|for|about)) (?:the )?(.{8,70})$/.exec(t); if (!m) return null;
    if (!EVT) EVT = (TH.events() || []).map(function (e) { return { e: e, w: words(e.title).filter(function (w) { return w.length > 2; }) }; }).filter(function (x) { return x.w.length >= 2; });
    var q = ' ' + norm(m[1]) + ' ', n0 = now(), hit = EVT.filter(function (x) { return !(x.e.e < n0) && x.w.every(function (w) { return q.indexOf(' ' + w + ' ') >= 0; }); }).map(function (x) { return x.e; })[0];
    return hit ? { title: hit.title } : null;
  });
  setMatch('events.cat', function (t) { var m = /^(?:any |are there (?:any )?|show me |list )?([a-z' ]{3,25}?) events (?:this week|in the next week|this weekend|soon|coming up)$/.exec(t); if (!m) return null; var c = norm(m[1]).replace(/s$/, ''); return (TH.EVENT_CATS || []).some ? ((TH.events() || []).some(function (e) { return (e.cats || []).some(function (k) { return norm(k).indexOf(c) === 0; }); }) ? { cat: m[1] } : null) : null; });
  setMatch('events.food', function (t) { var m = /^(?:where (?:can i|to) (?:get|find) |any |is there (?:any )?|wheres (?:the )?)?free food(?: on campus| events?)?(?: (today|tonight|tomorrow|this week|this weekend|right now|now))?$/.exec(t); return m ? (m[1] && !/week$/.test(m[1]) || m[1] === 'this weekend' ? { day: m[1].replace(/right now|now/, 'today') } : {}) : null; });
  setMatch('club.events', function (t, raw) { var m = /^(?:what|any|which) events (?:does|is|are) (.{4,60}?) (?:have|having|hosting|doing|putting on)(?: this week| soon| coming up)?$/.exec(t) || /^(?:upcoming |next )?events (?:from|by|for) (.{4,60})$/.exec(t); if (!m) return null; var cs = findClubs(m[1], 1); return cs.length || (TH.events() || []).some(function (e) { return norm(e.org).indexOf(norm(m[1])) >= 0; }) ? { club: cs.length ? cs[0].name : m[1] } : null; });
  setMatch('my.calendar', function (t) { return /\b(what (did i|have i) (save|saved|add|added|rsvp|rsvpd)( to my calendar)?|my saved events|events i (saved|rsvpd)|whats on my calendar)\b/.test(t) && signedIn() ? {} : null; });

  // a few older read commands claimed wording that belongs to a Part 7 family: let the family answer instead
  function deferTo(oldName, mine2) {
    var o = TS.cmds[oldName]; if (!o) return;
    var m0 = o.match;
    o.match = function (t, raw) { try { if (mine2.some(function (k) { return TS.cmds[k] && TS.cmds[k].match(t, raw); })) return null; } catch (e) { /* fall through */ } return m0.apply(this, arguments); };
  }
  deferTo('events.recommend', ['club.events', 'events.food', 'events.cat']);
  deferTo('events.find', ['events.cat', 'events.food', 'club.events', 'my.calendar', 'event.info', 'events.ongoing', 'events.next']);
  deferTo('grades.show', ['tommy.privacy', 'my.profs']);
  // "who can see my grades" / "units for research" are policy questions, not a grade lookup
  (function () { var g = TS.cmds['grades.show']; if (!g) return; var m0 = g.match; g.match = function (t, raw) { if (/\b(who can see|can (anyone|my parents|parents) see|ferpa|units? for|credit for|research|privacy|private)\b/.test(t)) return null; return m0.apply(this, arguments); }; })();
  // course.who couldn't read some course codes ("ACCT 410": the NLU reads "acct" as slang); answer those from the schedule
  (function () {
    var w = TS.cmds['course.who']; if (!w) return; var r0 = w.run;
    w.run = function (a) {
      var out = r0.apply(this, arguments);
      try {
        if (out && out[0] && /couldn.t find/.test(out[0].md || '')) {
          var r = findCourse(a.course, a.term); if (r && r.list.length) {
            var f = r.list[0], c = f.c, L = live(c), n = []; L.forEach(function (s) { String(s.instr || '').split(/\s*,\s*/).forEach(function (x) { if (x && n.indexOf(x) < 0) n.push(x); }); });
            return [bot(head(c, f.term) + (n.length ? ' is taught by **' + n.slice(0, 4).join(', ') + '**' + (n.length > 4 ? ' and others' : '') + '.' : ': USC hasn’t listed an instructor yet.') + '\n\n' + list(L.map(function (s) { return s.type + ' ' + s.id + ' · ' + meetTxt(s) + ' · ' + (s.instr || 'instructor not listed yet'); }), 6) + SOC_NOTE, socSrc(f.term))];
          }
        }
      } catch (e) { /* keep the original answer */ }
      return out;
    };
  })();

  // ============================================================================================ fixes for two older read commands (wrapped, not edited)
  // hours.check looked places up in TH.DATA (which this app doesn't have), so "is evk open" failed; events.find read
  // "events today" as a keyword search. Give those messages to place.hours / events.* instead, and repair hours.check's
  // run for the AI path.
  (function () {
    var hc = TS.cmds['hours.check'], ph = TS.cmds['place.hours'];
    if (hc && ph) {
      var m0 = hc.match, r0 = hc.run;
      hc.match = function (t, raw) { try { if (ph.match(t, raw) || TS.cmds['open.now'].match(t, raw) || TS.cmds['dining.halls'].match(t, raw)) return null; } catch (e) { /* fall through */ } return m0.apply(this, arguments); };
      hc.run = function (a) { return findPlaces(a && a.place).length ? ph.run({ place: a.place, day: a.day }) : r0.apply(this, arguments); };
      if (hc.args.indexOf('day') < 0) hc.args = hc.args.concat(['day']);
    }
    var ef = TS.cmds['events.find'];
    if (ef) {
      var e0 = ef.match;
      ef.match = function (t, raw) {
        try { if (['events.day', 'events.now', 'events.week', 'club.find', 'club.meets'].some(function (k) { return TS.cmds[k] && TS.cmds[k].match(t, raw); })) return null; } catch (e) { /* fall through */ }
        if (/\bfree food\b/.test(t)) return null;
        return e0.apply(this, arguments);
      };
    }
  })();

  // keep the read commands from Part 7 after the older ones (insertion order = compile order), and expose for tests
  X.count = X.names.length;
})();
