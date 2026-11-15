/* js/ta/course-info.js */
/* js/ta/course-info.js — Tommy answers "who teaches …?" from the real USC Schedule of Classes it already carries
 * (TA.SOC: Fall 2026 + Spring 2027 sections from classes.usc.edu): the course, and each section's instructor,
 * days and times, and open seats. Adds the Tommy Script command course.who {course, term}; the AI translator sees it
 * in the command catalogue automatically. Answers come only from that schedule, never from the AI.
 * Load after script.js. */
(function () {
  'use strict';
  var TA = window.TA, TS = TA && TA.Script, SOC = TA && TA.SOC;
  if (!TS || !TS.cmds || !SOC) return;

  var SRC_URL = 'https://classes.usc.edu/';
  var WHO = /\b(who|whos|which (prof|professor|instructor|teacher|lecturer)s?)\b.{0,40}\b(teach|teaches|teaching|taught|instructs?|lectures?)\b/;
  var PROF_OF = /\b(prof|professor|instructor|teacher|lecturer)s?\s+(for|of|in|teaching)\b|\b(who|whos)\b.{0,12}\b(prof|professor|instructor|teacher|lecturer)\b/;
  var STOP = /\b(who|whos|who's|which|teach|teaches|teaching|taught|instructs?|lectures?|prof|profs|professor|professors|instructor|instructors|teacher|teachers|lecturer|lecturers|the|for|of|in|at|usc|class|classes|course|courses|this|next|semester|term|fall|spring|2026|2027|does|do|is|are|what|currently|right|now|it|by|my|me|tell|please|can|you|u|ur|going|to|be|will|was)\b/g;

  function bot(md, sources) { return { role: 'bot', kind: 'c', md: md, chips: [], sources: sources || [{ url: SRC_URL, title: 'USC Schedule of Classes' }] }; }
  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean); }
  function topic(q) { return String(q || '').toLowerCase().replace(/[’']/g, '').replace(/[?.!,]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim(); }

  function termIds(term) {
    var ids = Object.keys(SOC.terms || {}).sort(), t = String(term || '').toLowerCase();
    if (/spring|2027/.test(t)) return ids.filter(function (id) { return /spring/i.test(SOC.label(id)); });
    if (/fall|2026/.test(t)) return ids.filter(function (id) { return /fall/i.test(SOC.label(id)); });
    return ids;
  }
  // title match quality: how many query words the title has, and how many extra words it adds
  function score(c, q) {
    var qw = words(q).map(function (w) { return w === 'intro' ? 'introduction' : w; }), tw = words(c.title);
    var has = function (x) { return qw.some(function (w) { return x === w || x.indexOf(w) === 0; }); };
    var hit = qw.filter(function (w) { return tw.some(function (x) { return x === w || x.indexOf(w) === 0; }); }).length;
    var extra = tw.filter(function (x) { return !/^(to|and|of|the|in|for|a|an|i|ii|iii|iv)$/.test(x) && !has(x); }).length;
    return { hit: hit, extra: extra, ok: hit > 0 && hit >= Math.min(2, qw.length) };
  }
  function when(s) {
    if (!s.meets || !s.meets.length) return 'time TBA';
    return s.meets.map(function (m) { return (m.days ? TA.fmtDays(m.days) + ' ' : '') + (m.start && m.start !== 'TBA' ? TA.fmtTime(m.start) + '–' + TA.fmtTime(m.end) : 'time TBA'); }).join('; ');
  }
  function sectionLine(s) {
    var seats = s.seats ? ' · ' + SOC.seatsLeft(s) + ' of ' + s.seats + ' seats open' : '';
    return '- ' + s.type + ' ' + s.id + ' · ' + when(s) + ' · ' + (s.instr ? '**' + s.instr + '**' : 'instructor not listed yet') + seats;
  }

  TS.cmds['course.who'] = {
    name: 'course.who',
    about: 'WHO TEACHES a USC course, from the real Schedule of Classes (Fall 2026 and Spring 2027): each section’s instructor, days and times, and open seats. Use for "who teaches CSCI 104", "who’s the professor for intro to civil engineering", "which instructor teaches WRIT 150 in spring". course: a course code like "CE 106" or the course name as the student said it. term (optional): "fall" | "spring".',
    args: ['course', 'term'],
    match: function (t, raw) {
      if ((!WHO.test(t) && !PROF_OF.test(t)) || /\b(club|clubs|org|organization|team|ta|tas)\b/.test(t)) return null;
      var codes = (TA.NLU.parse(raw).courses || []);
      var q = codes.length ? codes[0] : topic(raw);
      if (!q || q.length < 3) return null;
      var term = /\bspring\b/.test(t) ? 'spring' : /\bfall\b/.test(t) ? 'fall' : undefined;
      return term ? { course: q, term: term } : { course: q };
    },
    run: function (a) {
      if (!SOC.ready) return [bot('The class schedule is still loading. Ask me again in a moment.')];
      var q = String(a.course || '').trim(), ids = termIds(a.term);
      if (!q) return [bot('Which class? Tell me the code (like **CE 106**) or its name.')];
      var codes = TA.NLU.parse(q).courses || [], found = [], tq = topic(q) || q;
      ids.forEach(function (term, ti) {
        if (codes.length) {
          codes.forEach(function (code) { var c = SOC.course(term, code); if (c) found.push({ term: term, c: c, hit: 9, extra: 0, ti: ti }); });
          return;
        }
        SOC.search(term, tq, { limit: 12 }).forEach(function (c) { var sc = score(c, tq); if (sc.ok) found.push({ term: term, c: c, hit: sc.hit, extra: sc.extra, ti: ti }); });
      });
      // best title match across both terms; on a tie the earlier term first
      found.sort(function (a, b) { return b.hit - a.hit || a.extra - b.extra || a.ti - b.ti || (a.c.code < b.c.code ? -1 : 1); });
      var termNames = ids.map(function (id) { return SOC.label(id); }).join(' and ');
      if (!found.length) {
        return [bot('I couldn’t find **' + q + '** in USC’s Schedule of Classes for ' + termNames + '. Try the course code (like **CE 106**), or search classes.usc.edu.')];
      }
      var best = found[0], others = found.slice(1).filter(function (f) { return f.hit >= best.hit && !(f.c.code === best.c.code && f.term === best.term); });
      var secs = best.c.sections.filter(function (s) { return !s.cancelled; });
      var instrs = [];
      secs.forEach(function (s) { String(s.instr || '').split(/\s*,\s*/).forEach(function (n) { if (n && instrs.indexOf(n) < 0) instrs.push(n); }); });
      var md = '**' + best.c.code + ' · ' + best.c.title + '** (' + SOC.label(best.term) + ')' +
        (!instrs.length ? ': USC hasn’t listed an instructor yet.' : instrs.length > 4 ? ' has **' + instrs.length + ' instructors** across ' + secs.length + ' sections, including **' + instrs.slice(0, 3).join(', ') + '**.' : ' is taught by **' + instrs.join(', ') + '**.') +
        '\n\n' + secs.slice(0, 6).map(sectionLine).join('\n') + (secs.length > 6 ? '\n- …and ' + (secs.length - 6) + ' more sections' : '');
      var rel = others.slice(0, 3).map(function (f) {
        var n = []; f.c.sections.forEach(function (s) { String(s.instr || '').split(/\s*,\s*/).forEach(function (x) { if (x && !s.cancelled && n.indexOf(x) < 0) n.push(x); }); });
        return '- ' + f.c.code + ' · ' + f.c.title + ' (' + SOC.label(f.term) + '): ' + (n.length ? n.join(', ') : 'instructor not listed yet');
      });
      if (rel.length) md += '\n\n**Also matches:**\n' + rel.join('\n');
      md += '\n\n_From USC’s Schedule of Classes as collected Nov 9, 2026. Instructors can change, so check classes.usc.edu before you register._';
      return [bot(md, [{ url: SRC_URL, title: 'USC Schedule of Classes – ' + SOC.label(best.term) }])];
    }
  };
})();
