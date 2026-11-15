/* js/academics.js */
/* Trojan Hub — academics: coursework (homework due), midterms/finals, breaks, grades.
 *
 * What is real: the four Fall 2026 courses and their sections (USC Schedule of Classes, via Trojan Assist),
 * the academic calendar (holidays, recesses, study days, finals week: TA.POLICY) and each course's final-exam slot
 * (Registrar's final exam grid, TA.SOC.finalFor).
 * What is SAMPLE data for the demo student (Jordan Rivera): the homework list, midterm dates and every score.
 * A real build would read those from Brightspace; nothing here is sent anywhere.
 *
 * API: TH.acad.courses() .items() .dueOn(key) .dueBetween(a, b) .exams() .examsOn(key) .breaks() .breakOn(key)
 *      .grade(code) .termGPA() .resolveCourse(text) .isDone(item) .toggleDone(id) .color(code)
 * Screen: TH.screens.grades
 */
(function (TH) {
  'use strict';
  const esc = TH.esc, icon = (n, c) => TH.icon(n, c);
  const TERM = '20263';
  const pad = x => String(x).padStart(2, '0');
  const D = () => (window.TA && TA.State && TA.State.d) || null;
  const hub = () => { try { return TH.H(); } catch (e) { return {}; } };

  // ---------- extra icons (the sprite is built at TH.boot, so adding here is enough) ----------
  Object.assign(TH.iconPaths, {
    grad: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c1.8 1.6 3.8 2.4 6 2.4s4.2-.8 6-2.4v-4.5M22 9v6"/>',
    gift: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v8h14v-8M12 9v12M12 9c-1.5-4-6-4-5.5-1.5C7 9 10 9 12 9zm0 0c1.500-4 6-4 5.500-1.500C17 9 14 9 12 9z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.500 16c.6-1.600 1.700-2.300 3-2.300s2.400.7 3 2.300M14 10h5M14 14h4"/>',
    eye: '<path d="M2 12s3.500-6.500 10-6.500S22 12 22 12s-3.500 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.800"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.500 5l-3 14"/>',
    pencil: '<path d="M4 20l1-4L16.500 4.500l3 3L8 19zM14 7l3 3"/>',
    fence: '<path d="M4 21V7l2-3 2 3v14M10 21V7l2-3 2 3v14M16 21V7l2-3 2 3v14M2 11h20M2 16h20"/>',
    shirt: '<path d="M8 4l4 2 4-2 5 3-2 4-3-1v10H8V10l-3 1-2-4z"/>',
    zone: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" stroke-dasharray="3 2.500"/>',
  });

  // ---------- course catalogue for grading (weights are sample syllabi) ----------
  const COURSES = {
    'CSCI 104': { color: '#7a4fc2', nick: ['cs', 'cs104', 'csci', 'data structures', 'coding', 'programming', 'comp sci', 'computer science'], mean: 88, weights: { Homework: 30, Labs: 5, Midterms: 30, Final: 35 } },
    'MATH 226': { color: '#1e66c9', nick: ['math', 'calc', 'calculus', 'calc 3', 'calc iii', 'multivariable'], mean: 91, weights: { Homework: 15, Quizzes: 15, Midterms: 40, Final: 30 } },
    'PHYS 151': { color: '#138a72', nick: ['phys', 'physics', 'mechanics'], mean: 83, weights: { Homework: 15, Labs: 20, Midterms: 35, Final: 30 } },
    'PSYC 100': { color: '#c4501b', nick: ['psych', 'psyc', 'psychology'], mean: 93, weights: { Quizzes: 20, Paper: 15, Participation: 5, Midterms: 35, Final: 25 } },
  };
  const TOPICS = {
    'CSCI 104|hw': ['Linked lists & recursion', 'Stacks, queues & runtime analysis', 'Heaps & priority queues', 'Graph search (BFS / DFS)', 'Hash tables', 'Balanced BSTs (AVL)', 'Tries & the final project'],
    'MATH 226|hw': ['§12.1–12.3 Vectors & dot product', '§12.4–12.5 Cross product, lines & planes', '§13.1–13.2 Vector functions', '§13.3–13.4 Arc length & motion', '§14.1–14.3 Partial derivatives', '§14.4–14.5 Tangent planes & chain rule', '§14.6 Gradient & directional derivatives', '§14.7–14.8 Extrema & Lagrange multipliers', '§15.1–15.2 Double integrals', '§15.3–15.4 Polar coordinates', '§15.6–15.8 Triple integrals', '§16.1–16.2 Vector fields & line integrals', '§16.3–16.4 Green’s theorem', '§16.5–16.7 Curl, divergence & surface integrals', '§16.8–16.9 Stokes’ & divergence theorems'],
    'PHYS 151|hw': ['Units & 1-D kinematics', 'Vectors & 2-D motion', 'Newton’s laws', 'Friction & circular motion', 'Work & kinetic energy', 'Potential energy & conservation', 'Momentum & collisions', 'Rotation of rigid bodies', 'Torque & angular momentum', 'Equilibrium & elasticity', 'Gravitation', 'Periodic motion', 'Mechanical waves', 'Sound & superposition', 'Review set'],
    'PSYC 100|quiz': ['Research methods', 'Neuroscience & behavior', 'Sensation & perception', 'Consciousness', 'Learning', 'Memory', 'Thinking & language', 'Intelligence', 'Motivation & emotion', 'Development', 'Personality', 'Social psychology', 'Psychological disorders', 'Therapy'],
  };
  // weekly rules: [type, label, dow (0=Sun), dueMin, firstWeek, everyNWeeks, points, category]
  const RULES = {
    'CSCI 104': [['hw', 'HW', 5, 1439, 2, 2, 100, 'Homework'], ['lab', 'Lab check-off', 1, 720, 1, 1, 10, 'Labs']],
    'MATH 226': [['hw', 'WebAssign HW', 4, 1439, 0, 1, 20, 'Homework'], ['quiz', 'Discussion quiz', 4, 600, 1, 2, 25, 'Quizzes']],
    'PHYS 151': [['hw', 'Mastering Physics', 0, 1439, 1, 1, 30, 'Homework'], ['lab', 'Lab report', 2, 480, 2, 1, 40, 'Labs']],
    'PSYC 100': [['quiz', 'Reading quiz', 1, 825, 1, 1, 10, 'Quizzes']],
  };
  const ONE_OFF = [
    { course: 'PSYC 100', type: 'paper', title: 'Research article summary (draft)', date: '2026-10-16', min: 1439, pts: 50, cat: 'Paper' },
    { course: 'PSYC 100', type: 'paper', title: 'Research article summary (final)', date: '2026-11-18', min: 1439, pts: 100, cat: 'Paper' },
    { course: 'PSYC 100', type: 'hw', title: 'SONA research participation (4 credits)', date: '2026-12-04', min: 1020, pts: 20, cat: 'Participation' },
    { course: 'CSCI 104', type: 'hw', title: 'Final project checkpoint', date: '2026-11-25', min: 1439, pts: 50, cat: 'Homework', keepOnHoliday: true },
  ];
  // sample midterms (finals come from the Registrar's grid)
  const MIDTERMS = [
    { course: 'PSYC 100', title: 'Midterm 1', date: '2026-10-05', start: 840, end: 920, where: 'In lecture', score: 93 },
    { course: 'CSCI 104', title: 'Midterm 1', date: '2026-10-02', start: 1140, end: 1250, where: 'In your Friday quiz section', score: 84 },
    { course: 'MATH 226', title: 'Midterm 1', date: '2026-10-07', start: 600, end: 650, where: 'In lecture', score: 91 },
    { course: 'PHYS 151', title: 'Midterm 1', date: '2026-10-09', start: 510, end: 590, where: 'In lecture', score: 78 },
    { course: 'CSCI 104', title: 'Midterm 2', date: '2026-11-13', start: 1140, end: 1250, where: 'In your Friday quiz section' },
    { course: 'PSYC 100', title: 'Midterm 2', date: '2026-11-16', start: 840, end: 920, where: 'In lecture' },
    { course: 'MATH 226', title: 'Midterm 2', date: '2026-11-18', start: 600, end: 650, where: 'In lecture' },
    { course: 'PHYS 151', title: 'Midterm 2', date: '2026-11-20', start: 510, end: 590, where: 'In lecture' },
  ];

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const holidays = () => (window.TA && TA.POLICY && TA.POLICY.holidays) || {};
  const cal = () => (window.TA && TA.POLICY && TA.POLICY.cal && TA.POLICY.cal[TERM]) || { classesBegin: '2026-08-24', classesEnd: '2026-12-04' };
  const myCodes = () => { const d = D(); const list = d ? ((d.academics.terms || {})[TERM] || []) : []; return list.map(c => c.code).filter(c => COURSES[c]); };
  const now = () => TH.clock.now();

  const A = TH.acad = {};
  A.color = code => (COURSES[code] || {}).color || 'var(--cardinal)';
  A.courses = function () {
    const d = D(); if (!d) return [];
    return ((d.academics.terms || {})[TERM] || []).filter(c => COURSES[c.code]).map(c => ({ code: c.code, title: c.title, units: c.units, color: COURSES[c.code].color, instructor: ((c.sections || []).find(s => /lecture/i.test(s[1])) || [])[5] || '' }));
  };

  // ---------- coursework ----------
  let itemCache = null, itemKey = '';
  A.items = function () {
    const codes = myCodes(), key = codes.join('|') + '@' + TH.dkey(now());
    if (itemCache && itemKey === key) return itemCache;
    const begin = TH.parseKey(cal().classesBegin), end = TH.parseKey(cal().classesEnd), hol = holidays(), out = [];
    codes.forEach(code => {
      (RULES[code] || []).forEach(([type, label, dow, min, first, every, pts, cat]) => {
        let n = 0;
        for (let w = first; w < 16; w += every) {
          const monday = TH.addDays(begin, w * 7), day = TH.addDays(monday, (dow + 6) % 7), k = TH.dkey(day);
          if (day > end && !(dow === 0 && TH.addDays(day, -2) <= end)) break;
          if (hol[k]) continue;                                   // nothing is due on a university holiday
          n++;
          const topic = (TOPICS[code + '|' + type] || [])[n - 1];
          out.push({ id: `${code.replace(' ', '')}-${type}${n}`, course: code, type, cat, title: `${label} ${n}${topic ? ': ' + topic : ''}`, key: k, min, pts });
        }
      });
    });
    ONE_OFF.filter(o => codes.includes(o.course)).forEach((o, i) => out.push({ id: `${o.course.replace(' ', '')}-x${i}`, course: o.course, type: o.type, cat: o.cat, title: o.title, key: o.date, min: o.min, pts: o.pts }));
    // scores for work that is already due (deterministic sample); the last few days are still being graded
    const today = TH.dayStart(now());
    out.forEach(it => {
      it.date = TH.parseKey(it.key); it.at = new Date(it.date); it.at.setMinutes(it.min);
      it.color = A.color(it.course);
      it.past = it.at < now();
      if (!it.past) return;
      const ageDays = (today - it.date) / 864e5, h = hash(it.id);
      if (ageDays < (it.type === 'quiz' || it.type === 'lab' ? 2 : 5)) { it.pending = true; return; }
      const mean = COURSES[it.course].mean, spread = it.type === 'lab' ? 8 : 14;
      const pct = Math.max(52, Math.min(100, mean + ((h % 1000) / 1000 - 0.42) * spread * 2));
      it.score = Math.round(pct / 100 * it.pts * 2) / 2;
    });
    out.sort((a, b) => a.at - b.at);
    itemCache = out; itemKey = key;
    return out;
  };
  A.dueOn = key => A.items().filter(i => i.key === key);
  A.dueBetween = (a, b) => A.items().filter(i => i.at >= a && i.at < b);
  A.isDone = it => !!it.past || !!((hub().hwDone || {})[it.id]);
  A.toggleDone = function (id) {
    const h = hub(); if (!h.hwDone) h.hwDone = {};
    if (h.hwDone[id]) delete h.hwDone[id]; else h.hwDone[id] = true;
    if (window.TA && TA.State) TA.State.save();
    return !!h.hwDone[id];
  };
  A.upcoming = (days = 7) => { const n = now(), lim = TH.addDays(TH.dayStart(n), days + 1); return A.items().filter(i => i.at >= n && i.at < lim); };

  // ---------- exams ----------
  const MON = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function finalsFor(code) { // the Registrar's final-exam grid applied to the student's real lecture section
    try {
      const c = TA.State.findCourse(TERM, code), lec = c.sections.find(x => /lecture/i.test(x[1])) || c.sections[0];
      const r = TA.SOC.finalFor(TERM, code, lec[2], lec[3], lec[4]); if (!r || !r.day) return null;
      const dm = /([A-Za-z]+) (\d{1,2})\s*$/.exec(r.day), mi = dm ? MON.indexOf(dm[1].toLowerCase()) : -1; if (mi < 0) return null;
      const tm = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(r.hour || ''); if (!tm) return null;
      const to24 = (h, ap) => (h % 12) + (/pm/i.test(ap) ? 12 : 0);
      const end = to24(+tm[4], tm[6]) * 60 + +(tm[5] || 0); let start = to24(+tm[1], tm[3] || tm[6]) * 60 + +(tm[2] || 0); if (start > end) start -= 720;
      return { date: `2026-${pad(mi + 1)}-${pad(+dm[2])}`, start, end, text: `${r.day} · ${r.hour}` };
    } catch (e) { return null; }
  }
  let examCache = null, examKey = '';
  A.exams = function () {
    const codes = myCodes(), key = codes.join('|') + '@' + TH.dkey(now());
    if (examCache && examKey === key) return examCache;
    const out = MIDTERMS.filter(m => codes.includes(m.course)).map((m, i) => Object.assign({ id: 'mt' + i, kind: 'midterm', sample: true }, m));
    codes.forEach(code => { const f = finalsFor(code); if (f) out.push({ id: 'fin-' + code.replace(' ', ''), kind: 'final', course: code, title: 'Final exam', date: f.date, start: f.start, end: f.end, where: 'Room announced by the instructor', real: true }); });
    out.forEach(x => { x.day = TH.parseKey(x.date); x.at = new Date(x.day); x.at.setMinutes(x.start); x.color = A.color(x.course); x.past = x.at < now(); if (!x.past) delete x.score; });
    out.sort((a, b) => a.at - b.at);
    examCache = out; examKey = key;
    return out;
  };
  A.examsOn = key => A.exams().filter(x => x.date === key);
  A.nextExams = (n = 4) => A.exams().filter(x => !x.past).slice(0, n);

  // ---------- breaks & holidays (USC Academic Calendar 2026–27, as collected in TA.POLICY) ----------
  let breakCache = null;
  A.breaks = function () {
    if (breakCache) return breakCache;
    const P = (window.TA && TA.POLICY) || {}, hol = P.holidays || {}, c = P.cal || {};
    const out = [], keys = Object.keys(hol).sort();
    // merge consecutive holiday dates with the same name into one range
    keys.forEach(k => {
      const last = out[out.length - 1];
      if (last && last.name === hol[k] && TH.dkey(TH.addDays(TH.parseKey(last.to), 1)) === k) last.to = k;
      else out.push({ name: hol[k], from: k, to: k, kind: 'holiday' });
    });
    out.forEach(b => { // recesses run through the weekend
      if (/thanksgiving/i.test(b.name)) { b.name = 'Thanksgiving recess'; b.to = TH.dkey(TH.addDays(TH.parseKey(b.to), 2)); b.kind = 'recess'; }
      if (/spring recess/i.test(b.name)) { b.from = TH.dkey(TH.addDays(TH.parseKey(b.from), -1)); b.to = TH.dkey(TH.addDays(TH.parseKey(b.to), 2)); b.kind = 'recess'; }
    });
    const fall = c['20263'], spring = c['20271'];
    if (fall && fall.classesEnd) {
      const endC = TH.parseKey(fall.classesEnd);
      out.push({ name: 'Study days', from: TH.dkey(TH.addDays(endC, 1)), to: '2026-12-08', kind: 'study', note: 'No classes; finals start Dec 9' });
      out.push({ name: 'Final exams', from: '2026-12-09', to: '2026-12-16', kind: 'finals', note: fall.finals || '' });
      if (spring && spring.classesBegin) out.push({ name: 'Winter recess', from: '2026-12-17', to: TH.dkey(TH.addDays(TH.parseKey(spring.classesBegin), -1)), kind: 'recess', note: 'Spring classes begin ' + TH.fmtDate(TH.parseKey(spring.classesBegin), true) });
    }
    out.sort((a, b) => a.from < b.from ? -1 : 1);
    breakCache = out;
    return out;
  };
  A.breakOn = key => A.breaks().find(b => key >= b.from && key <= b.to) || null;
  A.breakRange = b => { const a = TH.parseKey(b.from), z = TH.parseKey(b.to); return b.from === b.to ? TH.fmtDate(a) : `${TH.MONTHS[a.getMonth()].slice(0, 3)} ${a.getDate()} – ${a.getMonth() === z.getMonth() ? '' : TH.MONTHS[z.getMonth()].slice(0, 3) + ' '}${z.getDate()}`; };

  // ---------- grades ----------
  const LETTERS = [[93, 'A', 4], [90, 'A-', 3.7], [87, 'B+', 3.3], [83, 'B', 3], [80, 'B-', 2.7], [77, 'C+', 2.3], [73, 'C', 2], [70, 'C-', 1.7], [67, 'D+', 1.3], [63, 'D', 1], [60, 'D-', 0.7], [0, 'F', 0]];
  A.letter = pct => LETTERS.find(l => pct >= l[0]) || LETTERS[LETTERS.length - 1];
  A.grade = function (code) {
    const C = COURSES[code]; if (!C) return null;
    const items = A.items().filter(i => i.course === code), exams = A.exams().filter(x => x.course === code);
    const cats = Object.keys(C.weights).map(name => {
      let rows = [];
      if (name === 'Midterms') rows = exams.filter(x => x.kind === 'midterm').map(x => ({ title: x.title, date: x.day, score: x.score, pts: 100, pending: x.past && x.score == null, future: !x.past }));
      else if (name === 'Final') rows = exams.filter(x => x.kind === 'final').map(x => ({ title: x.title, date: x.day, score: null, pts: 100, future: true }));
      else rows = items.filter(i => i.cat === name).map(i => ({ title: i.title, date: i.date, score: i.score, pts: i.pts, pending: !!i.pending, future: !i.past }));
      const graded = rows.filter(r => r.score != null), earned = graded.reduce((a, r) => a + r.score, 0), poss = graded.reduce((a, r) => a + r.pts, 0);
      return { name, weight: C.weights[name], rows, graded: graded.length, pct: poss ? earned / poss * 100 : null };
    });
    const live = cats.filter(c => c.pct != null), wsum = live.reduce((a, c) => a + c.weight, 0);
    const pct = wsum ? live.reduce((a, c) => a + c.pct * c.weight, 0) / wsum : null;
    const L = pct == null ? null : A.letter(pct);
    return { code, pct, letter: L ? L[1] : '—', points: L ? L[2] : null, cats, gradedWeight: wsum };
  };
  A.termGPA = function () {
    let u = 0, p = 0;
    A.courses().forEach(c => { const g = A.grade(c.code); if (g && g.points != null) { u += c.units; p += c.units * g.points; } });
    return u ? p / u : null;
  };
  // "math" / "calc" / "cs 104" / "physics" / "PSYC100" → one of the student's course codes (or null)
  A.resolveCourse = function (text) {
    const t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ', codes = myCodes();
    for (const code of codes) { const [dep, num] = code.toLowerCase().split(' '); if (t.includes(` ${dep} ${num} `) || t.includes(` ${dep}${num} `) || t.includes(` ${num} `)) return code; }
    for (const code of codes) { const dep = code.split(' ')[0].toLowerCase(); if (t.includes(` ${dep} `)) return code; }
    let best = null, bl = 0;
    codes.forEach(code => COURSES[code].nick.forEach(nk => { if (t.includes(` ${nk} `) && nk.length > bl) { best = code; bl = nk.length; } }));
    return best;
  };
  A.dueLabel = it => it.min >= 1430 ? '11:59 PM' : TH.fmtMin(it.min);
  A.typeLabel = t => ({ hw: 'Homework', lab: 'Lab', quiz: 'Quiz', paper: 'Paper' })[t] || 'Due';

  // =====================================================================
  // GRADES screen
  // =====================================================================
  const pctTxt = p => p == null ? '—' : (Math.round(p * 10) / 10).toFixed(1) + '%';
  const tone = p => p == null ? '' : p >= 90 ? '' : p >= 80 ? 'warn' : 'bad';
  TH.screens = TH.screens || {};
  TH.screens.grades = {
    render() {
      const S = TH.state, open = S.params && S.params.arg ? A.resolveCourse(S.params.arg) || S.gradesOpen : S.gradesOpen;
      S.gradesOpen = open || null;
      const cs = A.courses(), st = TH.student(), d = D(), gpa = A.termGPA(), cum = d && d.profile ? d.profile.gpa : null;
      const next = A.nextExams(3);
      const cards = cs.map(c => {
        const g = A.grade(c.code), isOpen = open === c.code;
        const body = !isOpen ? '' : `<div class="gr-body">${g.cats.map(cat => `
            <div class="gr-cat"><div class="gr-cat-h"><b>${esc(cat.name)}</b><span class="muted">${cat.weight}% of grade</span><span class="mono">${pctTxt(cat.pct)}</span></div>
              ${cat.rows.length ? `<ul class="gr-items">${cat.rows.map(r => `<li class="${r.future ? 'future' : ''}"><span>${esc(r.title)}<small>${esc(TH.fmtDate(r.date))}</small></span><span class="mono">${r.score != null ? `${r.score}<small>/${r.pts}</small>` : r.pending ? '<small>Being graded</small>' : '<small>Upcoming</small>'}</span></li>`).join('')}</ul>` : '<p class="muted tiny">Nothing here yet.</p>'}
            </div>`).join('')}
            <div class="btn-row"><button class="btn sm ghost" data-go="assistant:${esc('What do I need on the ' + c.code + ' final to get an A-?')}">${icon('sparkle')} Ask Tommy what I need on the final</button></div></div>`;
        return `<div class="card gr-card ${isOpen ? 'open' : ''}" style="--gc:${c.color}">
          <button class="gr-head" data-grade="${esc(c.code)}" aria-expanded="${isOpen}">
            <span class="gr-letter">${esc(g.letter)}</span>
            <span class="gr-main"><b>${esc(c.code)}</b><span class="muted">${esc(c.title)}</span>
              <span class="meter"><i class="${tone(g.pct)}" style="width:${Math.max(4, Math.min(100, g.pct || 0))}%"></i></span></span>
            <span class="gr-pct mono">${pctTxt(g.pct)}<small>${c.units} units</small></span>${icon(isOpen ? 'down' : 'chev', 'chev')}</button>${body}</div>`;
      }).join('');
      return `<div class="screen">${TH.ui.topbar('Grades')}<div class="pad screen-body stack">
        <div class="grid2"><div class="card flat"><span class="muted" style="font-size:12px">Fall 2026 so far</span><div class="big-num" style="font-size:30px">${gpa == null ? '—' : gpa.toFixed(2)}</div><span class="muted tiny">Projected term GPA</span></div>
          <div class="card flat"><span class="muted" style="font-size:12px">Cumulative</span><div class="big-num" style="font-size:30px">${cum == null ? '—' : Number(cum).toFixed(2)}</div><span class="muted tiny">${esc(st.standing || '')} · ${d && d.profile ? d.profile.unitsEarned : '—'} units earned</span></div></div>
        ${cs.length ? cards : `<div class="empty">${icon('grad')}<b>No Fall 2026 courses</b><span>Register for classes and your grades show up here.</span></div>`}
        ${next.length ? `<div class="section"><div class="section-head"><h2>Next exams</h2><button data-go="plans:month">Month view</button></div><div class="rows">${next.map(x => `<div class="row" style="--rc:${x.color}"><span class="rico">${icon('pencil')}</span><span class="rmain"><span class="rtitle">${esc(x.course)} ${esc(x.title)}</span><span class="rsub">${esc(TH.fmtDate(x.day))} · ${TH.fmtMin(x.start)} – ${TH.fmtMin(x.end)} · ${esc(x.where)}</span></span><span class="rside"><span class="pill ${x.kind === 'final' ? 'gold' : 'mute'}">${Math.max(0, Math.round((x.day - TH.dayStart(now())) / 864e5))} d</span></span></div>`).join('')}</div></div>` : ''}
        <p class="simnote">${icon('info')}<span>Scores, homework and midterm dates are sample data for the demo student. Courses, sections, the academic calendar and final-exam slots are real USC data. A live build would read grades from Brightspace.</span></p>
      </div></div>`;
    },
    mount(host) {
      host.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => { const S = TH.state; S.gradesOpen = S.gradesOpen === b.dataset.grade ? null : b.dataset.grade; S.params = {}; TH.render(true); });
    },
  };
})(window.TH = window.TH || {});
