/* js/hub2a.js — Trojan Hub, student side additions (all account actions SIMULATED on the demo student):
 * report a problem (photos, location, routed to the right office), profile, For You recommendations with
 * thumbs feedback, event requests, dues + members-only chats, connections + notification routing,
 * Tommy Everywhere, flagged unanswered questions, and a voice call with Tommy.
 * State lives in TH.H().x (inside Trojan Assist's store, so "Reset demo account" clears it).
 * Load after js/ta/bridge.js and before TA.boot()/TH.boot(). Shared helpers are exported on TH.x for hub2b.js. */
(function (TH) {
  'use strict';
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hub = () => TH.H();
  // Saves the account (Trojan Assist's store). Returns false when the write didn't reach this device's storage (full or
  // blocked), so a caller can say "Couldn't save" instead of "Saved". TA.store.set reports that and TA.State.save drops it,
  // so the result of the last write of the account is remembered here.
  let lastWrite = true;
  try { if (window.TA && TA.store && !TA.store._xTrack) { const set0 = TA.store.set; TA.store.set = function (k) { const ok = set0.apply(this, arguments); if (k === 'state') lastWrite = ok !== false; return ok; }; TA.store._xTrack = true; } } catch (e) { /* keep TA's own store */ }
  const save = () => { try { lastWrite = true; TA.State.save(); return lastWrite; } catch (e) { return false; } };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : TH.fmtDelta(m) + ' ago'; };
  const sim = t => `<p class="simnote">${icon('info')}<span>${t}</span></p>`;
  const top = (t, right) => TH.ui.topbar(t, true, right || '');
  const row = (attrs, ic, title, sub, color, side) => `<button class="row" ${attrs} style="--rc:${color || 'var(--cardinal)'}"><span class="rico">${icon(ic)}</span><span class="rmain"><span class="rtitle wrap">${title}</span><span class="rsub wrap">${sub}</span></span>${side == null ? icon('chev', 'chev') : side}</button>`;
  const typing = () => { const a = document.activeElement; return a && /INPUT|SELECT|TEXTAREA/.test(a.tagName); };

  Object.assign(TH.iconPaths, {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    up: '<path d="M7 11v9H4v-9zM7 11l4-8c1.500 0 2.500 1 2.500 2.500V9h5a2 2 0 0 1 2 2.300l-1.200 7a2 2 0 0 1-2 1.700H7"/>',
    dn: '<path d="M7 13V4H4v9zM7 13l4 8c1.500 0 2.500-1 2.500-2.500V15h5a2 2 0 0 0 2-2.300l-1.200-7a2 2 0 0 0-2-1.700H7"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
    megaphone: '<path d="M4 10v4h3l8 4V6l-8 4zM18 9a4 4 0 0 1 0 6M7 14l1 6h3l-1-5"/>',
    dollar: '<circle cx="12" cy="12" r="9"/><path d="M15 9.500c-.5-1-1.600-1.500-3-1.500-1.700 0-3 .8-3 2s1 1.700 3 2 3 .8 3 2-1.300 2-3 2c-1.400 0-2.500-.5-3-1.500M12 6v12"/>',
    building: '<path d="M5 21V4h10v17M15 9h4v12M3 21h18M8 8h1M11 8h1M8 12h1M11 12h1M8 16h1M11 16h1"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.500 3 14.500 0 18M12 3c-3 3.500-3 14.500 0 18"/>',
  });

  // ---------- state ----------
  const NCATS = [
    ['dps', 'DPS safety alerts', 'Always on, in both places', true],
    ['receipts', 'Dining receipts', 'Mobile orders and Dining Dollars'],
    ['news', 'Club newsletters', 'From clubs you join or follow'],
    ['events', 'Events', 'Reminders, requested events, room bookings'],
    ['dues', 'Dues and payments', 'Receipts and reminders'],
    ['recs', 'Recommendations', 'Clubs, events and Handshake picks'],
    ['reports', 'Problem reports', 'Status updates on what you reported'],
    ['classes', 'Classes and grades', 'Due dates, new grades'],
    ['tommy', 'Tommy follow-ups', 'Answers to questions that were flagged'],
  ];
  // Defaults are filled in on the stored objects themselves, never by swapping in a copy: X() runs every few seconds
  // (tick), so a sheet that read X().profile when it opened must still be saving into the live account when you tap Save.
  // Part 6 keys are added lazily, so nothing a student already entered is lost.
  const PROFILE0 = { snacks: [], drinks: [], diet: [], hobbies: [], goals: [], careerInterests: [], clubTypes: [], foods: [], allergies: [], shareFood: true, shareHobbies: true, shareGoals: false, major: '', minor: '', year: '', onboarded: false };
  const CONN0 = { gmail: true, gcal: false, acal: false, slack: false, groupme: false, handshake: false };
  const EVERY0 = { ext: false, chatgpt: false, claude: false, gemini: false, siri: false };
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  function fill(o, defs) { Object.keys(defs).forEach(k => { const d = defs[k]; if (Array.isArray(d)) { if (!Array.isArray(o[k])) o[k] = []; } else if (typeof o[k] !== typeof d) o[k] = d; }); return o; }
  function X() {
    const h = hub(), x = h.x || (h.x = {});
    if (!isObj(x.profile)) x.profile = {}; fill(x.profile, PROFILE0);
    ['reports', 'evreqs', 'gaps', 'mail'].forEach(k => { if (!Array.isArray(x[k])) x[k] = []; });
    ['fb', 'votes', 'chats', 'orgs'].forEach(k => { if (!x[k] || typeof x[k] !== 'object') x[k] = {}; });
    if (!isObj(x.w)) x.w = {}; if (!isObj(x.w.tag)) x.w.tag = {}; if (!isObj(x.w.org)) x.w.org = {};
    if (!isObj(x.conn)) x.conn = {}; fill(x.conn, CONN0);
    if (!isObj(x.every)) x.every = {}; fill(x.every, EVERY0);
    if (!isObj(x.notif)) x.notif = {};
    NCATS.forEach(([k]) => { if (!isObj(x.notif[k])) x.notif[k] = { app: true, email: k === 'dps' || k === 'receipts' || k === 'classes' }; });
    if (!x.seeded) { x.seeded = true; seed(x); }
    if (!x.seed2) { x.seed2 = true; const sc = similarClubs(primaryClub()), t = Date.now(); [['Hackathon kickoff mixer', 'Social', 27, sc[0], 'Friday night'], ['Mock interview night', 'Career', 19, sc[1], 'Weeknight evening'], ['Grad school panel', 'Speaker', 14, null, 'Weekday afternoon']].forEach(([title, type, votes, c, when], i) => x.evreqs.push({ id: 'rs' + i, title, type, votes, clubId: c ? c.id : null, when, note: '', mine: false, status: 'open', at: t - (i + 2) * 5e7 })); }
    return x;
  }
  // the club the demo student helps run (a real EngageSC group with public events; every number about it is sample data)
  let PRIMARY;
  function primaryClub() {
    if (PRIMARY !== undefined) return PRIMARY;
    const n = {}, t = TH.clock.now();
    (TH.CLUB_EVENTS || []).forEach(e => { if (e.start && TH.laDate(e.start) >= t) n[e.orgId] = (n[e.orgId] || 0) + 1; });
    const cats = c => (c.cats || []).join(' ') + ' ' + (c.cat || ''), ok = (TH.CLUBS || []).filter(c => c.registered && n[c.id] && !/department|residential|student life|government|spiritual|political|greek|fraternity|sorority|council|ethnic|cultural/i.test(cats(c)));
    const pref = ok.filter(c => /academic|career|pre-professional|recreation|service|viterbi|design team/i.test(cats(c)));
    const c = (pref.length ? pref : ok).sort((a, b) => (n[b.id] - n[a.id]) || String(a.id).localeCompare(String(b.id)))[0];
    return (PRIMARY = c || (TH.CLUBS || [])[0] || null);
  }
  const catsOf = c => (c && c.cats && c.cats.length ? c.cats : [c && c.cat]).filter(Boolean);
  function similarClubs(c) { if (!c) return []; const mine = new Set(catsOf(c)); return (TH.CLUBS || []).filter(o => String(o.id) !== String(c.id) && o.registered && catsOf(o).some(k => mine.has(k))).sort((a, b) => hash(a.id) - hash(b.id)).slice(0, 4); }
  function seed(x) {
    const p = primaryClub(), pid = p ? p.id : null, t = Date.now();
    x.evreqs = [
      ['Late-night study break with boba', 'Social', 41, pid, 'Weeknight evening'], ['Movie night on McCarthy Quad', 'Social', 35, null, 'Friday night'],
      ['Resume workshop with alumni', 'Career', 23, pid, 'Weekday afternoon'], ['Beach cleanup day', 'Service', 17, null, 'Weekend morning'],
      ['Intro to investing night', 'Workshop', 12, null, 'Weeknight evening'],
    ].map(([title, type, votes, clubId, when], i) => ({ id: 'rq' + i, title, type, votes, clubId, when, note: '', mine: false, status: 'open', at: t - (i + 1) * 864e5 }));
    x.gaps = [{ id: 'g0', q: 'Which laundry rooms take Apple Pay?', why: 'Tommy had no answer', at: t - 5 * 36e5, status: 'open', answer: null, sample: true }];
  }

  // ---------- notifications routed by the student's settings ----------
  function note(cat, title, body, go) {
    const x = X(), n = x.notif[cat] || { app: true, email: false };
    if (n.email) { x.mail.unshift({ cat, title, at: Date.now() }); if (x.mail.length > 30) x.mail.length = 30; }
    if (n.app) TH.notify(title, body, go);
    else if (n.email) TH.toast('Emailed to you: ' + title, 'mail');
    save();
  }

  // ---------- AI helper: Claude writes when the viewer allows it, otherwise an on-device summary ----------
  async function ai(el, prompt, fallback) {
    if (!el) return;
    el.innerHTML = '<span class="muted">Writing the summary…</span>';
    let txt = null;
    try { const s = window.claude && window.claude.use ? await window.claude.use('sample') : null; if (s) { const r = await s(prompt, { modelTier: 'quick' }); txt = r && r.text; } } catch (e) { txt = null; }
    if (!el.isConnected) return;
    el.innerHTML = `<p style="white-space:pre-line">${esc(txt || fallback)}</p><span class="muted tiny">${txt ? 'Written by AI from the totals shown on this screen. No names are sent.' : 'Summarized on this device. AI writing isn’t available in this view.'}</span>`;
  }

  // =====================================================================
  // PROFILE
  // =====================================================================
  const PF = [
    ['snacks', 'Favorite snacks', ['Chips & salsa', 'Fruit', 'Cookies', 'Pizza', 'Boba', 'Trail mix', 'Donuts', 'Hummus & pita']],
    ['drinks', 'Favorite drinks', ['Water', 'Sparkling water', 'Coffee', 'Iced tea', 'Lemonade', 'Soda', 'Matcha', 'Energy drinks']],
    ['diet', 'Dietary needs', ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Nut allergy']],
    ['hobbies', 'Hobbies and interests', ['Hiking', 'Film', 'Gaming', 'Music', 'Dance', 'Coding', 'Volunteering', 'Basketball', 'Cooking', 'Photography', 'Startups', 'Art']],
    ['goals', 'Career goals', ['Software engineering', 'Consulting', 'Finance', 'Medicine', 'Law', 'Film & TV', 'Research', 'Design', 'Marketing', 'Public service', 'Entrepreneurship', 'Education']],
  ];
  const filled = () => PF.filter(([k]) => X().profile[k].length).length;
  function sharedLine(p) {
    const bits = [];
    if (p.shareFood && (p.snacks.length || p.drinks.length)) bits.push('Likes ' + [...p.snacks, ...p.drinks].slice(0, 4).join(', '));
    const diet = p.diet.filter(v => v !== 'None'), al = (p.allergies || []).filter(v => v !== 'None');
    if (p.shareFood && diet.length) bits.push(diet.join(', '));
    if (p.shareFood && al.length) bits.push('Allergic to ' + al.join(', ').toLowerCase());
    if (p.shareHobbies && p.hobbies.length) bits.push('Into ' + p.hobbies.slice(0, 3).join(', '));
    if (p.shareGoals && p.goals.length) bits.push('Career: ' + p.goals.slice(0, 2).join(', '));
    return bits.join(' · ');
  }
  // The Profile screen itself lives in js/p6-profile.js (Part 6: onboarding, completeness, thumbs).

  // =====================================================================
  // FOR YOU: recommendations from the profile, what you joined and saved, and your thumbs
  // =====================================================================
  // Keywords match whole words, so "band" never matches "Broadband" and "coding" never matches "Decoding":
  //   'word' = that word (plural -s/-es ok) · 'stem*' = any word starting with it · '~word' = weak, only counts next to another hit.
  // A hit in the title, host or categories counts double a hit deep in the description (evid below).
  const KW = {
    'Software engineering': ['software', 'coding', 'coder*', 'programmer*', 'programming language*', 'computer programming', 'competitive programming', 'hackathon*', 'hack night*', 'developer*', 'web dev*', 'app dev*', 'computer science', 'swe', 'tech career*', 'tech industry', 'tech talk*', 'big tech', 'machine learning', 'artificial intelligence', 'data science', 'data scientist*', 'cybersecurity', 'cyber security', 'leetcode', 'github', '~ai', '~tech', '~data', '~computer*', '~computing'], // not "engineering": every Viterbi listing has it
    Consulting: ['consulting', 'consultancy', 'management consult*', 'strategy consult*', 'case comp*', 'case competition*', 'case interview*', '~consultant*', '~business', '~strategy'], Finance: ['finance', 'fintech', 'banking', 'investment bank*', 'investing', 'investment*', 'investor*', 'trading', 'wall street', 'private equity', 'venture capital', 'hedge fund*', 'asset management', 'accounting', '~financial*'],
    Medicine: ['medic*', 'pre-med', 'premed', 'pre-health', 'clinical', 'physician*', 'mcat', 'nursing', 'hospital', 'healthcare', '~clinic', 'health care', 'surgeon*', 'surgery', '~health', '~patient*', '~doctor*'], Law: ['law', 'lawyer*', 'legal', 'mock trial', 'pre-law', 'prelaw', 'lsat', 'attorney*', '~policy', '~policies', '~justice'],
    'Film & TV': ['film*', 'cinema*', 'cinematic', 'movie*', 'screenwrit*', 'screenplay*', 'television', 'tv', 'documentar*', 'showrunner*', '~media', '~entertainment'], Research: ['research*', 'lab', 'laboratory', 'laboratories', '~scholars', '~science*', '~scientist*'],
    Design: ['design', 'designer*', 'designing', 'ux', 'user experience', 'figma', '~creative*'], Marketing: ['marketing', 'advertis*', 'branding', '~brand'], 'Public service': ['public service', 'volunteer*', 'civic*', 'nonprofit*', 'non-profit*', 'public policy', '~government', '~community', '~service'],
    Entrepreneurship: ['entrepreneur*', 'startup*', 'start-up*', 'founder*', 'venture capital', 'pitch competition*', '~innovation', '~venture*', '~pitch*'], Education: ['teaching', 'teacher*', 'teach for america', 'education', 'educator*', 'k-12', '~classroom*', '~tutoring', '~tutors', '~mentor*', '~school*'],
    Hiking: ['hik*', 'outdoor*', 'adventure*', 'trail', 'trailhead*', 'backpacking', 'camping', 'national park*'], Film: ['film*', 'movie*', 'cinema*', 'cinematic'], Gaming: ['gaming', 'gamer*', 'game night*', 'esports', 'e-sports', 'video game*', 'board game*', 'nintendo', 'smash bros'],
    Music: ['music*', 'band', 'choir*', 'a cappella', 'acappella', 'concert*', 'orchestra*', 'symphon*', 'jazz', 'singing', 'singer*', 'songwrit*', 'dj', 'beatmaking', 'thornton', '~song*'], Dance: ['danc*', 'ballet', 'hip hop', 'hip-hop', 'k-pop', 'salsa night*'],
    Coding: ['coding', 'coder*', 'hackathon*', 'hack night*', 'programmer*', 'programming language*', 'computer programming', 'competitive programming', 'software', 'leetcode', 'github', 'python', 'javascript', '~developer*'],
    Volunteering: ['volunteer*', 'community service', '~service'], Basketball: ['basketball*'], Cooking: ['cooking', 'cook', 'cook-off*', 'culinary', 'baking', 'recipe*', 'chef*', '~bake'], Photography: ['photography', 'photographer*', 'photoshoot*', 'photo walk*', '~camera*', '~photo'],
    Startups: ['startup*', 'start-up*', 'entrepreneur*', 'founder*', 'venture capital', 'pitch competition*', '~pitch*', '~venture*'], Art: ['art', 'artist*', 'artwork*', 'painting*', 'paint', 'sketch*', 'gallery', 'galleries', 'museum*', 'ceramic*', 'printmaking', '~drawing*', '~exhibit*'],
    Fitness: ['fitness', 'workout*', 'yoga', 'run club*', 'gym', 'pilates', 'strength training', 'hiit', 'zumba', 'spin class*'], Reading: ['book club*', 'book talk*', 'book signing*', 'literature', 'literary', 'poetry', '~reading', '~books', '~author*', '~novel*'],
    Fashion: ['fashion*', 'thrift*', 'clothing swap*', 'streetwear', '~style', '~styling'], Travel: ['travel', 'traveling', 'travelling', 'study abroad', 'abroad', 'trip', 'road trip*', '~tour'], Theater: ['theat*', 'improv', 'improvisation*', 'drama', 'musical', 'broadway', 'comedy', 'stand-up'],
    Writing: ['creative writing', 'writing workshop*', 'writer*', 'poetry', 'poet', 'zine*', 'storytelling', '~writing', '~essay*'], 'Sports games': ['game day', 'gameday', 'tailgat*', 'football game*', 'basketball game*', 'watch party', 'watch parties', 'trojan football', 'usc football'],
  };
  const kws = v => KW[v] || [String(v).toLowerCase()];
  const hayCache = new Map();
  const hay = (id, parts) => { let h = hayCache.get(id); if (!h) { h = (' ' + parts.filter(Boolean).join(' ') + ' ').toLowerCase(); hayCache.set(id, h); } return h; };
  // one compiled whole-word pattern per keyword (see the grammar above KW)
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reCache = new Map();
  function kre(k) {
    let r = reCache.get(k); if (r) return r;
    let w = String(k).toLowerCase().trim(); const weak = w[0] === '~'; if (weak) w = w.slice(1);
    const stem = w.endsWith('*'); if (stem) w = w.slice(0, -1);
    r = { re: new RegExp((/^\w/.test(w) ? '\\b' : '') + escRe(w).replace(/\s+/g, '\\s+') + (stem || !/\w$/.test(w) ? '' : '(?:s|es)?\\b'), 'i'), weak, word: w };
    if (reCache.size > 4000) reCache.clear(); reCache.set(k, r); return r;
  }
  // how strongly a listing fits one answer: a title/host/category hit is 2, a description hit 1, weak words 0.5 / 0.34. 1 or more is a match.
  function evid(head, body, list) { let ev = 0; for (const k of list || []) { const r = kre(k); if (r.re.test(head)) ev += r.weak ? 0.5 : 2; else if (body && r.re.test(body)) ev += r.weak ? 0.34 : 1; } return ev; }
  const pts = (ev, full) => ev >= 2 ? full : ev >= 1 ? full * 0.6 : 0; // description-only matches count for less
  const has = (h, list) => (list || []).some(k => kre(k).re.test(h));

  // ---------- Part 6: one preferences object (TH.prefs), matching tokens, and a thumbs score ----------
  // career interests = what the student wants right now; career goals (x.profile.goals) = where they want to end up
  const CI_KW = {
    Internships: ['internship*', 'intern', 'recruiter*', 'recruiting', 'career fair*', 'employer*', 'hiring', '~recruit*', '~info session*', '~information session*'], Research: ['research*', 'lab', 'laboratory', '~scholars', '~science*'],
    Networking: ['networking', 'alumni', 'mixer*', 'industry night*', 'meet and greet', 'coffee chat*', '~mentor*'],
    'Grad school': ['grad school', 'graduate school', 'graduate program*', 'pre-med', 'pre-law', 'mcat', 'lsat', 'gre', 'phd', 'ph.d', '~masters', '~master’s'], 'Start a company': ['startup*', 'start-up*', 'entrepreneur*', 'founder*', 'venture capital', '~pitch*', '~venture*'],
    'Hackathons & case comps': ['hackathon*', 'hack night*', 'case comp*', 'case competition*', 'datathon*', 'ideathon*', '~competition*'], 'Build a portfolio': ['portfolio*', 'design team*', 'build night*', 'project team*', '~project*', '~workshop*'],
    'Study abroad': ['study abroad', 'abroad', 'exchange program*', 'overseas'], 'Part-time job': ['job fair*', 'hiring', 'work-study', 'work study', 'part-time', 'student job*', 'student worker*'], Leadership: ['leadership', 'executive board*', 'e-board', '~officer*'],
  };
  // club types the student likes → EngageSC categories (regex on club.cats) + listing keywords
  const CT = {
    'Tech & engineering': [/viterbi|design team/i, ['engineering', 'coding', 'robot*', 'computer*', 'hackathon*', 'software']], 'Career & pre-professional': [/career|pre-professional/i, ['career*', 'professional*']],
    Academic: [/academic/i, ['academic*', 'honor society', 'honors society', '~study']], Cultural: [/ethnic|cultural/i, ['cultural*', 'heritage', 'culture*']],
    'Arts & performance': [/visual|performing/i, ['music*', 'danc*', 'theat*', 'a cappella', 'film*', 'gallery']], 'Service & volunteering': [/service|civic/i, ['volunteer*', 'community service', '~service', '~community']],
    'Sports & recreation': [/club sport|recreation/i, ['sport*', 'recreation*', 'outdoor*', 'hiking', 'climb*', 'intramural*']], Social: [/^social$/i, ['social', 'mixer*', 'game night*']],
    'Health & wellness': [/health/i, ['wellness', 'mental health', 'yoga', 'fitness']], 'Faith & spiritual': [/spiritual/i, ['faith*', 'fellowship', 'worship*', 'interfaith']],
    'Advocacy & politics': [/political|social awareness|government/i, ['advocacy', 'politic*', 'policy', 'justice']], 'Media & publications': [/media|publication/i, ['magazine*', 'journal', 'radio', 'newspaper*', 'podcast*']],
    Environment: [/environment|sustainab/i, ['sustainab*', 'environment*', 'climate']], 'Greek life': [/fraternity|sorority|panhellenic|pan-hellenic|interfraternity|greek|omega/i, ['fraternit*', 'sororit*']],
  };
  // major/minor name (regex) → words that mean an event is really about that subject. Bare "programming" (as in "La Mesa
  // programming") and school names ("Viterbi" is on every engineering listing) are not evidence; see schoolKey for the school.
  const MAJ = [
    [/\bcomputer|software|\bdata sci|informatics|\bcs\b/, ['computer science', 'cs', 'csci', 'coding', 'software', 'programmer*', 'programming language*', 'computer programming', 'hackathon*', 'machine learning', 'artificial intelligence', 'data science', 'algorithm*', 'cybersecurity', 'developer*', 'leetcode', '~ai', '~data', '~tech', '~computer*', '~computing']],
    [/business|account|financ|marketing|entrepreneur/, ['business', 'marshall', 'finance', 'consulting', 'marketing', 'entrepreneur*', 'accounting']], [/engineer/, ['robot*', 'engineering design', '~engineer*']],
    [/biolog|neuro|chem|health|pre-?med|kinesiology/, ['biology', 'biolog*', 'pre-med', 'premed', 'pre-health', 'medic*', 'neuro*', 'chemistry', '~health', '~research*']], [/\becon/, ['econ*', 'finance', '~policy']],
    [/cinema|\bfilm|media arts/, ['film*', 'cinema*', 'cinematic', 'screenwrit*', 'movie*']], [/journal|communication|annenberg/, ['annenberg', 'journalis*', 'newsroom*', 'communication*', '~media']], [/psych/, ['psych*', 'mental health']],
    [/music|thornton/, ['music*', 'concert*', 'thornton']], [/\barts?\b|design|architect/, ['design', 'designer*', 'art', 'artist*', 'architect*', 'gallery', 'galleries']], [/politic|international relations|public policy|\blaw\b/, ['policy', 'policies', 'politic*', 'law', 'government', 'legal']],
    [/\bmath|statistic|physics/, ['math', 'mathemat*', 'physics', 'statistic*']], [/\bgame|interactive/, ['game', 'gaming', 'game design*', 'interactive']], [/environment|sustainab/, ['sustainab*', 'environment*', 'climate']],
  ];
  const FOOD_KW = { Pizza: ['pizza'], Tacos: ['taco'], Burgers: ['burger'], Sushi: ['sushi'], Ramen: ['ramen', 'noodle'], 'Boba': ['boba', 'milk tea'], Donuts: ['donut', 'doughnut'], Cookies: ['cookie'], 'Ice cream': ['ice cream', 'gelato'], Coffee: ['coffee', 'latte', 'espresso'], 'Chips & salsa': ['chips', 'salsa'], Fruit: ['fruit'], 'Korean BBQ': ['korean bbq', 'kbbq'], Thai: ['thai'], Indian: ['indian', 'curry', 'samosa'], Mediterranean: ['mediterranean', 'falafel', 'shawarma', 'hummus'], Sandwiches: ['sandwich', 'sub'], Desserts: ['dessert', 'cake', 'cupcake', 'brownie'], Bagels: ['bagel'], 'Hummus & pita': ['hummus', 'pita'], 'Trail mix': ['trail mix'] };
  const ALLERGEN_KW = { Peanuts: ['peanut'], 'Tree nuts': ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'nutella'], Dairy: ['cheese', 'milk', 'ice cream', 'dairy', 'boba', 'gelato', 'butter'], Eggs: [' egg', 'eggs'], 'Gluten / wheat': ['pizza', 'bread', 'bagel', 'donut', 'cookie', 'pasta', 'sandwich', 'baked', 'gluten'], Soy: ['soy', 'tofu', 'edamame'], Shellfish: ['shrimp', 'crab', 'lobster', 'shellfish'], Fish: ['fish', 'sushi', 'salmon', 'tuna'], Sesame: ['sesame', 'tahini', 'hummus'] };
  const majorKw = str => { const s = String(str || '').toLowerCase(); if (!s.trim()) return []; const out = []; MAJ.forEach(([re, k]) => { if (re.test(s)) out.push(...k); }); if (!out.length) out.push(...s.replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(w => w.length > 4 && !/science|studies|bachelor|master|minor/.test(w))); return out; };
  const shortMajor = m => String(m || '').replace(/\s*\(.*\)$/, '').replace(/^Computer Science$/, 'CS');
  const P6_EMPTY = { interests: [], careerInterests: [], careerGoals: [], clubTypes: [], foods: [], snacks: [], drinks: [], diet: [], allergies: [], major: '', minor: '', year: '', onboarded: false };
  let PV = 1, tokCache = null, recCache = new Map();
  function prefsOf() {
    if (!(window.TA && TA.State && TA.State.d)) return Object.assign({}, P6_EMPTY);
    const p = X().profile, ta = TA.State.d.profile || {};
    return { interests: p.hobbies.slice(), careerInterests: p.careerInterests.slice(), careerGoals: p.goals.slice(), clubTypes: p.clubTypes.slice(), foods: p.foods.slice(), snacks: p.snacks.slice(), drinks: p.drinks.slice(), diet: p.diet.filter(v => v !== 'None'), allergies: p.allergies.filter(v => v !== 'None'), major: p.major || ta.major || '', minor: p.minor || ta.minor || '', year: p.year || ta.standing || '', onboarded: !!p.onboarded };
  }
  TH.prefs = () => { try { return prefsOf(); } catch (e) { return Object.assign({}, P6_EMPTY); } };
  TH.prefsChanged = () => { PV++; tokCache = null; recCache.clear(); return PV; };
  TH.prefsVersion = () => PV;
  TH.prefTokens = function () {
    if (tokCache && tokCache.v === PV) return tokCache.t;
    const p = TH.prefs(), raw = [];
    [...p.interests, ...p.careerGoals].forEach(v => raw.push(v, ...kws(v)));
    p.careerInterests.forEach(v => raw.push(...(CI_KW[v] || [v])));
    p.clubTypes.forEach(v => raw.push(...((CT[v] || [])[1] || [v])));
    raw.push(...majorKw(p.major), ...majorKw(p.minor));
    // public set: plain lowercase words (no ~ / * markers) and no 2–3 letter fragments that would match inside other words
    const t = [...new Set(raw.map(w => String(w).toLowerCase().replace(/^~/, '').replace(/\*$/, '')).filter(w => w.trim().length >= 4 || (w.trim().length === 3 && w === w.trim())).map(w => w.trim()))];
    t.has = w => t.includes(String(w).toLowerCase()); Object.defineProperty(t, 'size', { get: () => t.length });
    tokCache = { v: PV, t }; return t;
  };
  // −1..+1: thumbs on this item, its club, its categories and hashtags
  TH.likeScore = function (item) {
    try {
      if (!item) return 0; const x = X(), isEv = item.orgId !== undefined || item.start !== undefined; let r = 0;
      const own = x.fb[(isEv ? 'e' : 'c') + item.id]; if (own) r += own.v * 3;
      r += (x.w.org[isEv ? item.orgId : item.id] || 0) * 0.5;
      (item.cats || []).forEach(c => { r += (x.w.tag[c] || 0) * 0.4; });
      if (isEv && TH.getEventHashtags && x.w.hashtag) { const hw = x.w.hashtag; (TH.getEventHashtags(item) || []).forEach(h => { r += (hw[h] || 0) * 0.15; }); }
      return Math.max(-1, Math.min(1, Math.tanh(r / 3)));
    } catch (e) { return 0; }
  };
  const inc = (h, list) => list.some(k => h.includes(k)); // plain substring on purpose: allergy heads-ups may over-warn, never miss
  // the student's school from their USC record ("Viterbi School of Engineering" → "Viterbi"): its own listings get a small, honest reason
  const schoolKey = () => { try { const s = String((TA.State.d.profile || {}).school || '').replace(/^USC\s+/i, '').trim(), m = /^(?:school|college) (?:of|for) (.+)$/i.exec(s), k = (m ? m[1].replace(/\s*,.*$/, '') : s.split(/\s+/)[0] || '').trim(); return k.length >= 4 ? k : ''; } catch (e) { return ''; } };
  // score one listing against everything the student told us; returns points, why chips and which answers matched.
  // h = the whole listing text; o.head = only its title, host and categories (a hit there weighs double a hit deep in the description)
  function scoreHay(h, o) {
    const p = TH.prefs(), why = [], hits = new Set(), head = o.head || h, body = o.head ? h : ''; let s = 0;
    const fit = (v, list, full, label) => { const ev = evid(head, body, list); if (ev < 1) return; s += pts(ev, full); hits.add(v); why.push(label); };
    p.interests.forEach(v => fit(v, kws(v), 3, 'You like ' + v.toLowerCase()));
    p.careerGoals.forEach(v => fit(v, kws(v), 3, 'Career: ' + v));
    p.careerInterests.forEach(v => fit(v, CI_KW[v] || [v.toLowerCase()], 2.5, v));
    const cats = (o.cats || []).join(' ');
    p.clubTypes.forEach(v => { const d = CT[v]; if (!d) return; if (d[0].test(cats)) { s += o.club ? 3 : 2; hits.add(v); why.push(v + (o.club ? '' : ' club')); } else if (!o.strictType) fit(v, d[1], o.club ? 3 : 2, v + (o.club ? '' : ' club')); });
    fit('major', majorKw(p.major), o.club ? 1.5 : 2.5, 'For ' + shortMajor(p.major) + ' majors');
    if (p.minor) fit('minor', majorKw(p.minor), 2, 'Fits your ' + shortMajor(p.minor) + ' minor');
    const sk = !hits.has('major') && schoolKey();
    if (sk && kre(sk).re.test(head)) { s += o.club ? 0.5 : 1; hits.add('school'); why.push('From ' + sk + ', your school'); }
    return { s, why, hits };
  }
  // does this event really fit the student's major? (Home "For … majors" row and Tommy's "my major" search use this too)
  const evHead = e => hay('e' + e.id + '|h', [e.title, e.org, (e.cats || []).join(' ')]), evHay = e => hay('e' + e.id, [e.title, e.org, (e.cats || []).join(' '), e.desc]);
  function majorFits(e) { const m = TH.prefs().major; return !!(e && m) && evid(evHead(e), evHay(e), majorKw(m)) >= 1; }
  function foodNotes(e, h) {
    const p = TH.prefs(), out = { s: 0, why: [], warn: [] }; if (!e.food) return out;
    const fav = [...p.foods, ...p.snacks].filter(v => has(h, FOOD_KW[v] || [v.toLowerCase()]));
    if (fav.length) { out.s += 2.5; out.why.push('Free ' + fav[0].toLowerCase() + '!'); } else if (p.foods.length || p.snacks.length) { out.s += 1; out.why.push('Free food'); }
    if (p.diet.some(d => /vegan|vegetarian/i.test(d)) && /vegan|vegetarian|plant-based/.test(h)) { out.s += 1; out.why.push('Veg options listed'); }
    const al = p.allergies.filter(a => inc(h, ALLERGEN_KW[a] || [a.toLowerCase()]));
    if (al.length) out.warn.push('Listing mentions food with ' + al.join(', ').toLowerCase() + '. Check before you eat.');
    else if (p.allergies.length) out.warn.push('Menu isn’t listed. Ask the hosts about ' + p.allergies.join(', ').toLowerCase() + '.');
    return out;
  }
  const fbStamp = () => { let t = 0; Object.values(X().fb).forEach(f => { t += (f.at || 0) % 1e7 + f.v; }); return t; };
  function matchReasons(h) { return [...scoreHay(h, {}).hits].filter(v => v !== 'major' && v !== 'minor' && v !== 'school'); }
  function recEvents(n) {
    const x = X(), joined = new Set(hub().clubs.map(c => String(c.id))), nm = TH.minOfDay(TH.clock.now());
    const key = 'e|' + PV + '|' + fbStamp() + '|' + [...joined].join(',') + '|' + TH.dkey(TH.clock.now()) + nm;
    let all = recCache.get(key);
    if (!all) {
      all = [];
      x.w.hashtag = x.w.hashtag || {};
      TH.events().forEach(e => {
        if (e.off < 0 || e.off > 14 || (e.off === 0 && e.end <= nm) || e.multiDay) return;
        const f = x.fb['e' + e.id]; if (f && f.v < 0) return;
        const club = TH.clubById(e.orgId), h = evHay(e);
        const m = scoreHay(h, { head: evHead(e), cats: [...(e.cats || []), ...((club && club.cats) || [])], strictType: true }), why = m.why.slice(); let s = m.s;
        if (joined.has(String(e.orgId))) { s += 4; why.unshift('From a club you joined'); }
        const fd = foodNotes(e, h); s += fd.s; why.push(...fd.why);
        const eHashtags = TH.getEventHashtags ? TH.getEventHashtags(e) : [];
        const hw = eHashtags.reduce((acc, tag) => acc + (x.w.hashtag[tag] || 0), 0);
        if (hw > 0) { s += hw * 4; why.push('Because you like ' + eHashtags.filter(t => (x.w.hashtag[t] || 0) > 0).slice(0, 2).join(' ')); }
        (e.cats || []).forEach(c => { s += x.w.tag[c] || 0; }); s += x.w.org[e.orgId] || 0;
        const ls = TH.likeScore(e); s += ls * 4;
        if (ls > 0.15 || (x.w.org[e.orgId] || 0) > 0 || (e.cats || []).some(c => (x.w.tag[c] || 0) > 0)) why.push('Like ones you gave a thumbs up');
        if (s > 0) all.push({ e, s, why: [...new Set(why)], hits: m.hits, warn: fd.warn });
      });
      all.sort((a, b) => b.s - a.s || a.e.s - b.e.s);
      if (recCache.size > 20) recCache.clear(); recCache.set(key, all);
    }
    return all.slice(0, n);
  }
  const GRAD_RE = /\b(law students?|medical students?|mba|graduate students?|grad students?|ph\.?d|doctoral|keck|gould|dental|pharmacy|postdoc)/i; // professional-school groups sink for undergrads
  function recClubs(n) {
    const x = X(), joined = new Set(hub().clubs.map(c => String(c.id)));
    const key = 'c|' + PV + '|' + fbStamp() + '|' + [...joined].join(',');
    let all = recCache.get(key);
    if (!all) {
      all = []; const undergrad = !/grad/i.test(TH.prefs().year);
      (TH.CLUBS || []).forEach(c => {
        if (joined.has(String(c.id))) return; const f = x.fb['c' + c.id]; if (f && f.v < 0) return;
        const m = scoreHay(hay('c' + c.id, [c.name, (c.cats || []).join(' '), c.desc]), { head: hay('c' + c.id + '|h', [c.name, (c.cats || []).join(' ')]), cats: c.cats || [c.cat], club: true }), ls = TH.likeScore(c);
        const s = m.s + ls * 4 + (m.s ? (c.registered ? 1 : 0) + (c.open ? 0.5 : 0) + Math.min(1, (c.events || 0) / 5) : 0) - (undergrad && GRAD_RE.test(c.name) ? 4 : 0), why = m.why.slice();
        if (ls > 0.15) why.push('Like ones you gave a thumbs up');
        if (s >= 2.5) all.push({ c, s, why, hits: m.hits });
      });
      all.sort((a, b) => b.s - a.s || hash(a.c.id) - hash(b.c.id));
      if (recCache.size > 20) recCache.clear(); recCache.set(key, all);
    }
    return all.slice(0, n);
  }
  // the reasons one event is recommended (for the event sheet), or null
  function whyEvent(id) { const r = recEvents(400).find(o => String(o.e.id) === String(id)); return r || null; }
  const HS = [
    ['Software Engineering Intern, Summer 2027', 'LA tech company', 'Software engineering'], ['Business Analyst Intern', 'Consulting firm', 'Consulting'], ['Summer Analyst', 'Investment bank', 'Finance'],
    ['Clinical Research Assistant', 'Medical center', 'Medicine'], ['Legal Intern', 'Public interest law office', 'Law'], ['Post-production Intern', 'Film studio', 'Film & TV'],
    ['Undergraduate Research Fellow', 'University lab', 'Research'], ['Product Design Intern', 'Design studio', 'Design'], ['Marketing Intern', 'Consumer brand', 'Marketing'],
    ['City Government Fellow', 'City office', 'Public service'], ['Venture Fellow', 'Startup accelerator', 'Entrepreneurship'], ['Summer Teaching Assistant', 'Education nonprofit', 'Education'],
  ];
  function recJobs() { const x = X(), g = x.profile.goals; return HS.map((j, i) => ({ id: 'h' + i, j })).filter(o => g.includes(o.j[2]) && !(x.fb[o.id] && x.fb[o.id].v < 0)); }
  const thumbs = (id, meta) => { const v = (X().fb[id] || {}).v || 0; return `<span class="x-thumbs" data-fbid="${esc(id)}" data-meta="${esc(JSON.stringify(meta || {}))}"><button class="up" data-th="1" aria-pressed="${v > 0}" aria-label="More like this">${icon('up')}</button><button class="down" data-th="-1" aria-pressed="${v < 0}" aria-label="Not for me">${icon('dn')}</button></span>`; };
  const WHY = ['Not my kind of thing', 'Bad time for me', 'Too far away', 'Already been', 'Too many like this'];
  function setFb(id, v, meta) {
    const x = X(), prev = (x.fb[id] || {}).v || 0; if (prev === v) v = 0;
    const d = v - prev; (meta.tags || []).forEach(t => { x.w.tag[t] = (x.w.tag[t] || 0) + d; }); if (meta.org != null) x.w.org[meta.org] = (x.w.org[meta.org] || 0) + d * 2;
    x.w.hashtag = x.w.hashtag || {};
    const eHtags = meta.hashtags || (id.startsWith("e") && TH.getEventHashtags ? TH.getEventHashtags(TH.eventById(id.slice(1))) : []);
    (eHtags || []).forEach(h => { x.w.hashtag[h] = (x.w.hashtag[h] || 0) + d * 3; });
    x.fb[id] = { v, at: Date.now(), title: meta.title || '', org: meta.org == null ? null : meta.org, tags: (meta.tags || []).slice(0, 6) }; save(); if (TH.prefsChanged) TH.prefsChanged();
    if (v < 0) TH.sheet(`<div class="stack"><div class="sheet-head"><h2>What was off?</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div><p class="muted">One tap helps your next recommendations. Organizers only ever see totals.</p><div class="x-chips">${WHY.map(w => `<button class="chip" data-why="${esc(w)}">${esc(w)}</button>`).join('')}</div></div>`, w => w.addEventListener('click', e => { const b = e.target.closest('[data-why]'); if (!b) return; X().fb[id].why = b.dataset.why; save(); TH.closeSheet(); TH.toast('Got it. You’ll see fewer like that.'); TH.render(true); }));
    else TH.toast(v > 0 ? 'Thanks. You’ll see more like this.' : 'Feedback removed', 'up');
    TH.render(true);
  }
  function bindThumbs(root) {
    root.addEventListener('click', e => { const b = e.target.closest('[data-th]'); if (!b) return; e.stopPropagation(); const w = b.closest('[data-fbid]'); let meta = {}; try { meta = JSON.parse(w.dataset.meta || '{}'); } catch (er) { /* keep empty */ } setFb(w.dataset.fbid, +b.dataset.th, meta); }, true);
  }

  // =====================================================================
  // REPORT A PROBLEM: what, where, photos → routed to the specific office and desk
  // =====================================================================
  const RC = {
    facilities: ['Something broken in a building', 'building', 'Facilities Planning & Management', 'Customer Resource Center work-order desk', '1 business day', /\b(broken|leak|light|lights|door|elevator|air condition|ac|heat|water fountain|toilet|sink|outlet|window|ceiling|flood)/],
    clean: ['Cleanliness or trash', 'trash', 'FPM Custodial Services', 'the custodial supervisor for that building', 'same day', /\b(trash|spill|dirty|smell|graffiti|overflow|mess|soap|paper towel)/],
    safety: ['Safety concern (not an emergency)', 'shield', 'USC Department of Public Safety', 'DPS non-emergency dispatch', 'right away', /\b(suspicious|unsafe|stolen|theft|harass|followed|dark path|street ?light|blue light)/],
    housing: ['Housing and residence halls', 'home', 'USC Housing', 'your building’s Customer Service Center', '1–2 business days', /\b(dorm|roommate|my room|apartment|laundry|suite|residence hall|lockout)/],
    it: ['Wi-Fi, IT or classroom tech', 'bolt', 'USC ITS', 'the ITS Service Desk', 'a few hours', /\b(wi-?fi|eduroam|projector|printer|brightspace|login|duo|password|internet)/],
    dining: ['Dining', 'fork', 'USC Hospitality', 'the manager on duty at that venue', 'same day', /\b(food|dining|menu|allerg|order|swipe|undercooked|cafe)/],
    access: ['Accessibility barrier', 'access', 'OSAS with FPM', 'the campus accessibility coordinators', '1 business day', /\b(wheelchair|ramp|accessib|braille|ada|automatic door|step-free)/],
    transport: ['Buses, Lyft, parking, bikes', 'bus', 'USC Transportation', 'transit dispatch and parking operations', '1 business day', /\b(bus|shuttle|parking|lyft|bike|scooter|driver|permit)/],
    app: ['Trojan Hub or Tommy got it wrong', 'sparkle', 'Trojan Hub team', 'the app and Tommy answer team', 'within hours', /\b(app|tommy|wrong answer|bug|crash|glitch)/],
    diningrec: ['Dining hall recommendation', 'fork', 'USC Hospitality', 'the dining hall’s guest feedback team', '2–3 business days', null],
    idea: ['Campus idea or feedback', 'megaphone', 'Undergraduate Student Government', 'the USG student feedback inbox', '1 week', null],
    other: ['Something else', 'info', 'askUSC', 'the student services help desk, who forward it', '1–2 business days', null],
  };
  const STAT = ['Received', 'Routed', 'In progress', 'Resolved'];
  const isHousing = name => /residen|apartment|housing|village|parkside|birnkrant|marks tower|pardee|new north|cardinal gardens|century|webb tower|fluor|cale|irani|mccarthy honors|cowlings|ilium|nemirovsky|bohnett/i.test(name || '');
  function routeFor(d) {
    let cat = d.cat || guessCat(d.desc) || 'other';
    if (cat === 'facilities' && isHousing(d.place)) cat = 'housing';
    const r = RC[cat];
    return { cat, office: r[2], team: r[3] + (d.place && /building|venue/.test(r[3]) ? '' : ''), eta: r[4], where: [d.place, d.room].filter(Boolean).join(', ') };
  }
  function guessCat(t) { t = String(t || '').toLowerCase(); if (t.length < 4) return ''; for (const k of Object.keys(RC)) if (RC[k][5] && RC[k][5].test(t)) return k; return ''; }
  // "Use my location" for reports and SOS: the place the demo position is labeled with ("You (Tutor Campus Center)"), so the button,
  // the report and the alert all name the spot the rest of the app uses ("from TCC"). Without a label: the nearest place with rooms
  // (never a gate, restroom, statue or lawn).
  const NO_ROOMS = p => p.cat === 'landmark' && (/statue|\bquad\b|lawn|garden|\bpark\b|plaza/i.test(p.name) || /\bstatue\b|sculpt/i.test(p.desc || ''));
  function nearestPlace() {
    const me = TH.ME || { x: 0, y: 0 }, lab = (/\(([^)]+)\)\s*$/.exec(String(me.label || '')) || [])[1];
    if (lab && lab.trim().length > 2) return { id: 'here', name: lab.trim(), x: me.x, y: me.y, here: true };
    let best = null, bd = 1e12; (TH.PLACES || []).forEach(p => { if (p.x == null || /gate|parking|transit|restroom|safety/.test(p.cat || '') || p.inferred || NO_ROOMS(p)) return; const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < bd) { bd = d; best = p; } }); return best;
  }
  // photo → JPEG data URI kept on this device (never uploaded anywhere): longest side ≤ 800 px, quality 0.7 stepping down,
  // and at most 150 KB of text whatever a caller asks for, so a few report or SOS photos can't fill the browser's ~5 MB
  // storage (a caller may ask for less). Transparent images get a white background instead of black.
  const PHOTO_KB = 150;
  function shrink(file, maxKB) {
    const cap = Math.min(PHOTO_KB, +maxKB > 0 ? +maxKB : PHOTO_KB) * 1024;
    return new Promise(res => {
      if (!file) return res(null);
      const fr = new FileReader(); fr.onerror = () => res(null);
      fr.onload = () => { const im = new Image(); im.onerror = () => res(null); im.onload = () => {
        let side = 800, q = 0.7, out = null;
        try {
          for (let i = 0; i < 12 && side >= 160; i++) {
            const k = Math.min(1, side / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
            const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q); c.width = c.height = 0;
            if (out.length <= cap) break; if (q > 0.55) q = Math.round((q - 0.1) * 10) / 10; else side = Math.round(Math.min(side, Math.max(im.width, im.height)) * 0.8);
          }
        } catch (e) { out = null; }
        res(out && out.length <= cap ? out : null);
      }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  const repRow = r => `<button class="row" data-rep="${esc(r.id)}" style="--rc:var(--c-safety)"><span class="rico">${icon(RC[r.cat] ? (RC[r.cat][1] === 'trash' ? 'trash' : RC[r.cat][1]) : 'flag')}</span><span class="rmain"><span class="rtitle wrap">${esc(r.desc.slice(0, 60))}${r.desc.length > 60 ? '…' : ''}</span><span class="rsub wrap">${esc(r.id)} · ${esc(r.office)} · ${ago(r.at)}</span><span class="x-steps">${STAT.map((s, i) => `<i class="${i <= r.status ? 'on' : ''}"></i>`).join('')}</span></span><span class="rside"><span class="pill ${r.status === 3 ? 'ok' : 'warn'}">${STAT[r.status]}</span></span></button>`;
  function openReport(id) {
    const r = X().reports.find(q => q.id === id); if (!r) return;
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">Report ${esc(r.id)}</span><h2>${esc(RC[r.cat][0])}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <p>${esc(r.desc)}</p>${r.photos.length ? `<div class="x-photos">${r.photos.map(p => `<img src="${p}" alt="Attached photo">`).join('')}</div>` : ''}
      <dl class="kv"><dt>Where</dt><dd>${esc(r.where || 'Not given')}</dd><dt>Sent to</dt><dd>${esc(r.office)}</dd><dt>Handled by</dt><dd>${esc(r.team)}</dd><dt>Status</dt><dd>${STAT[r.status]}${r.urgent ? ' · urgent' : ''}</dd><dt>Sent</dt><dd>${ago(r.at)}</dd></dl>
      <div class="rows">${STAT.map((s, i) => `<div class="row"><span class="rico" style="--rc:${i <= r.status ? 'var(--ok)' : 'var(--c-service)'}">${icon(i <= r.status ? 'check' : 'clock')}</span><span class="rmain"><span class="rtitle">${s}</span><span class="rsub wrap">${['Your report and photos were saved.', `Sent to ${esc(r.team)}.`, 'Someone is working on it.', r.reply ? esc(r.reply) : 'You’ll get a note when it’s fixed.'][i]}</span></span></div>`).join('')}</div>
      ${sim('Simulated. In a real launch this would file the work order or ticket with that office.')}</div>`);
  }
  // The Report screen and the guided report sheet live in js/p6-profile.js (Part 6).

  // =====================================================================
  // REQUEST AN EVENT: requests go to club organizers, ranked by votes; requesters get first RSVP
  // =====================================================================
  const RTYPES = ['Social', 'Career', 'Workshop', 'Service', 'Speaker', 'Sports', 'Food', 'Study'];
  const RWHEN = ['Weekday afternoon', 'Weeknight evening', 'Friday night', 'Weekend morning', 'Weekend afternoon', 'Any time'];
  const clubName = id => id == null ? 'Any club' : (TH.clubById(id) || { name: 'A club' }).name;
  let rqType = 'Social';
  function reqRow(r) {
    const voted = !!X().votes[r.id] || r.mine;
    return `<div class="row" style="align-items:flex-start"><button class="x-vote" data-vote="${esc(r.id)}" aria-pressed="${voted}" aria-label="${voted ? 'You want this' : 'I want this too'}: ${r.votes} votes" ${r.mine ? 'disabled' : ''}>${r.votes}<small>${voted ? 'voted' : 'vote'}</small></button><span class="rmain"><span class="rtitle wrap">${esc(r.title)}</span><span class="rsub wrap">${esc(r.type)} · ${esc(r.when)} · to ${esc(clubName(r.clubId))}${r.mine ? ' · you asked' : ''}</span>${r.status === 'scheduled' ? `<span class="cbadges"><span class="pill ok">${icon('check')}Scheduled${voted ? ' · you get first RSVP' : ''}</span></span>` : ''}</span></div>`;
  }
  TH.screens.requests = {
    render() {
      const x = X(), arg = TH.state.params && TH.state.params.arg, p = primaryClub();
      const opts = [[String(arg && TH.clubById(arg) ? arg : ''), arg && TH.clubById(arg) ? TH.clubById(arg).name : null], ...hub().clubs.map(c => [String(c.id), c.name]), p ? [String(p.id), p.name] : null].filter(o => o && o[1]).filter((o, i, a) => a.findIndex(q => q[0] === o[0]) === i);
      const list = x.evreqs.slice().sort((a, b) => b.votes - a.votes);
      return `<div class="screen">${top('Request an Event')}<div class="pad screen-body stack">
        <p class="muted" style="font-size:13.5px">Tell clubs what you’d show up for. Organizers see requests ranked by votes, and when one gets scheduled the people who asked for it get first RSVP.</p>
        <form class="card stack" id="rq-form">
          <div class="field"><label for="rq-title">What event do you want?</label><input id="rq-title" maxlength="70" placeholder="e.g. Pickup volleyball and pizza"></div>
          <div class="field"><label>Type</label><div class="x-chips">${RTYPES.map(t => `<button type="button" class="chip" data-rqt="${t}" aria-pressed="${rqType === t}">${t}</button>`).join('')}</div></div>
          <div class="grid2"><div class="field"><label for="rq-club">Send to</label><select id="rq-club"><option value="">Any club that fits</option>${opts.map(([id, n], i) => `<option value="${esc(id)}" ${i === 0 && arg ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
            <div class="field"><label for="rq-when">Best time</label><select id="rq-when">${RWHEN.map(w => `<option>${w}</option>`).join('')}</select></div></div>
          <div class="err" hidden></div><button class="btn block">${icon('megaphone')} Send request</button>
        </form>
        <div class="section"><div class="section-head"><h2>What students are asking for</h2></div><div class="rows">${list.map(reqRow).join('')}</div>
          <span class="muted tiny">Requests you didn’t write are samples so the list isn’t empty. Vote for any you’d attend.</span></div>
      </div></div>`;
    },
    mount(host) {
      if (TH.state.params) TH.state.params = {};
      host.addEventListener('click', e => {
        const t = e.target.closest('[data-rqt]'); if (t) { rqType = t.dataset.rqt; $$('[data-rqt]', host).forEach(b => b.setAttribute('aria-pressed', String(b === t))); return; }
        const v = e.target.closest('[data-vote]'); if (!v) return; const x = X(), r = x.evreqs.find(q => q.id === v.dataset.vote); if (!r) return;
        if (x.votes[r.id]) { delete x.votes[r.id]; r.votes--; } else { x.votes[r.id] = true; r.votes++; TH.toast('Vote counted. Organizers see the total.', 'up'); } save(); TH.render(true);
      });
      $('#rq-form', host).addEventListener('submit', e => {
        e.preventDefault(); const title = $('#rq-title', host).value.trim(), er = $('.err', host);
        if (title.length < 4) { er.hidden = false; er.textContent = 'Give the event a short name.'; return; }
        const cid = $('#rq-club', host).value, c = cid ? TH.clubById(cid) : null;
        X().evreqs.unshift({ id: 'rq' + uid(), title, type: rqType, votes: 1, clubId: c ? c.id : null, when: $('#rq-when', host).value, mine: true, status: 'open', at: Date.now() });
        TH.commit(`Requested an event: ${title}`); TH.toast(`Sent to ${c ? c.name + '’s organizers' : 'club organizers'}`); TH.render();
      });
    },
  };

  // =====================================================================
  // DUES + CHATS (club members-only chats unlock when dues are paid; Slack and GroupMe show up here once connected)
  // =====================================================================
  const NAMES = ['Maya R.', 'Dev P.', 'Sofia L.', 'Marcus T.', 'Aiko N.', 'Leila H.', 'Noah B.', 'Priya S.', 'Diego M.', 'Hannah K.', 'Omar F.', 'Chloe W.', 'Tyler J.', 'Nia A.', 'Ethan C.', 'Grace Y.', 'Kenji O.', 'Isabel V.', 'Sam D.', 'Zoe E.'];
  const member = id => hub().clubs.find(m => String(m.id) === String(id)) || null;
  const duesOf = c => { const o = X().orgs[c.id]; return o && typeof o.dues === 'number' ? o.dues : ((TH.clubDues ? TH.clubDues(c).amount : 0) || 0); };
  const chatOpen = c => { const m = member(c.id); return !!m && (!duesOf(c) || !!m.duesPaid); };
  function payDues(c) {
    const amt = duesOf(c), m = member(c.id);
    if (!m) return TH.toast('Join the club first, then pay dues', 'info');
    TH.sheet(`<div class="stack"><div class="sheet-head"><h2>Pay dues to ${esc(c.name)}</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <dl class="kv"><dt>Amount</dt><dd>${TH.money(amt)} per semester</dd><dt>Goes to</dt><dd>${esc(c.name)} club account</dd><dt>You get</dt><dd>Member status + members-only chat</dd></dl>
      <div class="field"><label for="du-pay">Pay with</label><select id="du-pay"><option>Apple Pay</option><option>USCard Discretionary</option><option>Debit card ending 4242 (sample)</option></select></div>
      <div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="du-ok">Pay ${TH.money(amt)}</button></div>
      ${sim('Simulated payment. No money moves. Dues amounts are sample values; EngageSC doesn’t publish them.')}</div>`, w => {
      $('#du-ok', w).onclick = () => { m.duesPaid = true; m.duesAt = Date.now(); m.duesVia = $('#du-pay', w).value; TH.commit(`Paid ${TH.money(amt)} dues to ${c.name}`); TH.closeSheet(); note('dues', `Dues paid: ${c.name}`, `${TH.money(amt)} receipt saved. You were added to the members-only chat.`, 'chats'); TH.render(true); };
    });
  }
  const seedMsgs = (id, title) => { const h = hash(id), t = Date.now(); return [['Welcome! Events and updates get posted here first.', 50], ['Is anyone carpooling to the next one?', 31], ['I can drive 3 people. Meet at the Tommy Trojan statue.', 22]].map(([text, m], i) => ({ who: NAMES[(h + i * 7) % NAMES.length], text: i === 0 ? `Welcome to ${title}. Events and updates get posted here first.` : text, at: t - m * 60000, sample: true })); };
  function chatList() {
    const x = X(), out = [];
    hub().clubs.forEach(m => { const c = TH.clubById(m.id); if (!c) return; out.push({ id: 'club:' + c.id, title: c.name + ' members', sub: chatOpen(c) ? 'Members-only chat' : `Pay ${TH.money(duesOf(c))} dues to join this chat`, locked: !chatOpen(c), club: c, src: 'Trojan Hub' }); });
    if (x.conn.slack) [['slack:general', '#general'], ['slack:events', '#events']].forEach(([id, t]) => out.push({ id, title: t, sub: 'Slack · sample workspace', src: 'Slack' }));
    if (x.conn.groupme) out.push({ id: 'gm:floor', title: 'Floor 4 group chat', sub: 'GroupMe · sample group', src: 'GroupMe' });
    return out;
  }
  const chatMsgs = ch => [...seedMsgs(ch.id, ch.title), ...(X().chats[ch.id] || [])].sort((a, b) => a.at - b.at);
  function threadHTML(ch, backTitle) {
    const st = TH.student();
    return `<div class="screen">${top(ch.title)}<div class="pad screen-body x-thread stack"><span class="muted tiny" style="text-align:center">${esc(ch.src)}${ch.src === 'Trojan Hub' ? ' · only members who paid dues are in this chat; anyone who pays later is added automatically' : ' · mirrored here; replies post back to ' + esc(ch.src)}</span>
      <div class="chat">${chatMsgs(ch).map(m => `<div class="msg ${m.me ? 'me' : 'bot'}">${m.me ? '' : `<small>${esc(m.who)}${m.sample ? ' · sample' : ''}</small>`}${esc(m.text)}</div>`).join('')}</div></div></div>
      <div class="composer pad"><form id="ch-form"><label class="sr" for="ch-in">Message</label><input id="ch-in" maxlength="300" placeholder="Message as ${esc(st.first)}" autocomplete="off"><button class="send" aria-label="Send">${icon('send')}</button></form></div>`;
  }
  function threadMount(host, ch) {
    const sc = host; sc.scrollTop = sc.scrollHeight;
    $('#ch-form', host.parentNode).addEventListener('submit', e => { e.preventDefault(); const v = $('#ch-in').value.trim(); if (!v) return; const x = X(); (x.chats[ch.id] || (x.chats[ch.id] = [])).push({ me: true, who: TH.student().first, text: v, at: Date.now() }); save(); TH.render(); });
  }
  TH.screens.chats = {
    render() {
      const arg = TH.state.params && TH.state.params.arg, list = chatList(), ch = arg && list.find(c => c.id === arg && !c.locked);
      if (ch) return threadHTML(ch);
      const x = X();
      return `<div class="screen">${top('Chats')}<div class="pad screen-body stack">
        ${list.length ? `<div class="rows">${list.map(c => c.locked ? row(`data-pay="${esc(c.club.id)}"`, 'lock', esc(c.title), esc(c.sub), 'var(--c-service)', `<span class="pill gold">Pay dues</span>`) : row(`data-go="chats:${esc(c.id)}"`, 'chat', esc(c.title), esc(c.sub), c.src === 'Slack' ? '#611f69' : c.src === 'GroupMe' ? '#00aff0' : 'var(--c-fitness)')).join('')}</div>`
          : `<div class="empty">${icon('chat')}<b>No chats yet</b><span>Join a club and pay its dues to get its members-only chat, or connect Slack or GroupMe.</span></div>`}
        <div class="btn-row"><button class="btn ghost" data-go="clubs">${icon('users')} Find clubs</button><button class="btn ghost" data-go="connect">${icon('link')} ${x.conn.slack || x.conn.groupme ? 'Manage connections' : 'Connect Slack or GroupMe'}</button></div>
        ${sim('Chats are simulated. Other people’s messages are samples; yours stay on this device.')}
      </div></div>`;
    },
    mount(host) {
      const arg = TH.state.params && TH.state.params.arg, ch = arg && chatList().find(c => c.id === arg && !c.locked);
      if (ch) return threadMount(host, ch);
      host.addEventListener('click', e => { const b = e.target.closest('[data-pay]'); if (b) payDues(TH.clubById(b.dataset.pay)); });
    },
  };
  // club sheet: dues, chat and "request an event" (wraps the newsletter wrapper in feed.js)
  const openClub0 = TH.openClub;
  TH.openClub = function (id) {
    openClub0.apply(this, arguments);
    const c = TH.clubById(id), sheet = $('.sheet .club-sheet'); if (!c || !sheet) return;
    const m = member(c.id), amt = duesOf(c), div = document.createElement('div'); div.className = 'stack'; div.style.gap = '10px';
    div.innerHTML = `${m ? `<div class="card flat" style="display:flex;gap:12px;align-items:center">${icon('dollar')}<span style="flex:1"><b>Dues: ${amt ? TH.money(amt) + ' per semester' : 'none'}</b><br><span class="muted" style="font-size:12.5px">${!amt ? 'Every member is in the club chat.' : m.duesPaid ? 'Paid. You’re in the members-only chat.' : 'Pay in the app to join the members-only chat.'}</span></span>${amt && !m.duesPaid ? `<button class="btn sm" id="x-pay">Pay</button>` : `<button class="btn sm ghost" id="x-chat">Chat</button>`}</div>` : ''}
      <button class="btn ghost block" id="x-req">${icon('megaphone')} Request an event from this club</button>`;
    const anchor = $('.nl-toggle', sheet) || $('#club-join, #club-leave', sheet);
    if (anchor) anchor.insertAdjacentElement('afterend', div); else sheet.appendChild(div);
    const pay = $('#x-pay', div), chat = $('#x-chat', div);
    if (pay) pay.onclick = () => payDues(c);
    if (chat) chat.onclick = () => TH.go('chats', { arg: 'club:' + c.id });
    $('#x-req', div).onclick = () => TH.x.requestSheet(c.id);
  };
  // event sheet: thumbs + "request more like this"; also opens events that organizers scheduled in the app
  const openEvent0 = TH.openEvent;
  TH.openEvent = function (id) {
    if (/^x-/.test(String(id))) {
      const ev = Object.values(X().orgs).flatMap(o => o.events || []).find(e => 'x-' + e.id === String(id)); if (!ev) return TH.toast('That event is no longer listed', 'alert');
      const s = TH.laDate(ev.start);
      return TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">Scheduled from a student request</span><h2>${esc(ev.title)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
        <dl class="kv"><dt>When</dt><dd>${esc(TH.fmtDate(s, true))} · ${TH.fmtTime(s)}</dd><dt>Where</dt><dd>${esc(ev.where || 'To be announced')}</dd><dt>Host</dt><dd>${esc(ev.org)}</dd></dl>
        ${ev.priority ? `<div class="banner ok">${icon('star')}<div><b>You have first RSVP</b><span>You asked for this event, so your spot is held until the day before.</span></div></div>` : ''}${sim('Created in the organizer side of this prototype.')}</div>`);
    }
    openEvent0.apply(this, arguments);
    const e = TH.eventById(id), sheet = $('.sheet .stack'); if (!e || !sheet) return;
    const div = document.createElement('div'); div.className = 'card flat'; div.style.cssText = 'display:flex;gap:12px;align-items:center';
    div.innerHTML = `<span style="flex:1"><b>Is this your kind of event?</b><br><span class="muted" style="font-size:12.5px">Your thumbs tune what Trojan Hub recommends.</span></span>${thumbs('e' + e.id, { tags: e.tags || [], org: e.orgId, title: e.title })}`;
    const r = whyEvent(e.id);
    if (r && (r.why.length || r.warn.length)) { const w = document.createElement('div'); w.className = 'p6-whycard'; w.innerHTML = `${r.why.length ? `<span class="eyebrow">${icon('sparkle')} Why you’re seeing this</span><div class="p6-why">${r.why.slice(0, 5).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}${r.warn.map(t => `<p class="p6-warn">${icon('alert')}<span>${esc(t)}</span></p>`).join('')}<button class="linkbtn" data-go="profile">Tune your picks in Profile</button>`; sheet.appendChild(w); }
    sheet.appendChild(div); bindThumbs(div);
    if (TH.clubById(e.orgId)) { const b = document.createElement('button'); b.className = 'btn ghost block'; b.innerHTML = `${icon('megaphone')} Request more events like this`; b.onclick = () => TH.x.requestSheet(e.orgId); sheet.appendChild(b); }
  };

  // =====================================================================
  // CONNECTIONS + NOTIFICATION ROUTING
  // =====================================================================
  const CONN = [
    ['gmail', 'Gmail', 'mail', 'Club newsletters you send or receive also go out as email', '#d93025'],
    ['gcal', 'Google Calendar', 'calendar', 'My Day and your calendar stay in step', '#1a73e8'],
    ['acal', 'Apple Calendar', 'calendar-plus', 'My Day shows up in the Calendar app on your phone', '#6b6f7a'],
    ['slack', 'Slack', 'chat', 'Your workspaces’ channels appear in Chats', '#611f69'],
    ['groupme', 'GroupMe', 'users', 'Your group chats appear in Chats', '#00aff0'],
    ['handshake', 'Handshake', 'bag', 'Jobs and career events arrive in For You, not email', '#b48300'],
  ];
  const calItems = () => hub().calendar.map(x => ({ title: x.title, start: x.start, end: x.end, where: x.where, org: x.org, url: x.url }));
  TH.screens.connect = {
    render() {
      const x = X();
      return `<div class="screen">${top('Connections & Alerts')}<div class="pad screen-body stack">
        <div class="section"><div class="section-head"><h2>Connected apps</h2></div><div class="rows">${CONN.map(([k, n, ic, sub, col]) => `<div class="row" style="--rc:${col}"><span class="rico">${icon(ic)}</span><span class="rmain"><span class="rtitle">${n}</span><span class="rsub wrap">${sub}</span></span><button class="btn sm x-toggle ${x.conn[k] ? 'line' : ''}" data-conn="${k}">${x.conn[k] ? 'Connected' : 'Connect'}</button></div>`).join('')}</div>
          ${x.conn.gcal || x.conn.acal ? `<button class="btn ghost block" id="cn-export">${icon('calendar-plus')} Send My Day to my phone calendar now</button>` : ''}</div>
        <div class="section"><div class="section-head"><h2>Where each alert goes</h2></div>
          <div class="card"><div class="x-matrix"><span></span><span class="h">App</span><span class="h">Email</span>
            ${NCATS.map(([k, n, sub, lock]) => `<span><b>${n}</b><small>${sub}</small></span><input type="checkbox" data-nc="${k}" data-ch="app" aria-label="${n} in the app" ${x.notif[k].app ? 'checked' : ''} ${lock ? 'disabled' : ''}><input type="checkbox" data-nc="${k}" data-ch="email" aria-label="${n} by email" ${x.notif[k].email ? 'checked' : ''} ${lock ? 'disabled' : ''}>`).join('')}</div></div>
          <span class="muted tiny">Tick both, one or neither. Moving dining receipts to App only stops the receipt emails. ${x.mail.length ? `${x.mail.length} message${x.mail.length === 1 ? '' : 's'} went to email this session.` : ''}</span></div>
        ${row('data-go="everywhere"', 'globe', 'Tommy Everywhere', 'USC answers in Google and other AI assistants', 'var(--gold-ink)')}
        ${sim('Connections are simulated: no account is linked and no email is sent. The phone-calendar export is real.')}
      </div></div>`;
    },
    mount(host) {
      host.addEventListener('click', e => { const b = e.target.closest('[data-conn]'); if (!b) return; const x = X(), k = b.dataset.conn; x.conn[k] = !x.conn[k]; save(); TH.toast(`${CONN.find(c => c[0] === k)[1]} ${x.conn[k] ? 'connected' : 'disconnected'} (simulated)`, 'link'); TH.render(true); });
      host.addEventListener('change', e => { const c = e.target.closest('[data-nc]'); if (!c) return; X().notif[c.dataset.nc][c.dataset.ch] = c.checked; save(); });
      const ex = $('#cn-export', host); if (ex) ex.onclick = () => TH.exportCalendar(calItems(), 'trojan-hub-my-day');
    },
  };

  // =====================================================================
  // ASK TOMMY: programmatic ask, flagged gaps, thumbs in chat, Tommy Everywhere
  // =====================================================================
  const plain = md => String(md || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`#>|]/g, '').replace(/^\s*-\s+/gm, '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  function flagGap(q, why, given) {
    const x = X(), k = norm(q); if (!k) return null;
    let g = x.gaps.find(o => norm(o.q) === k && !o.answer);
    if (!g) { g = { id: 'g' + uid(), q: String(q).slice(0, 200), why, given: given ? String(given).slice(0, 300) : null, at: Date.now(), status: 'open', answer: null }; x.gaps.unshift(g); save(); }
    return g;
  }
  const isMiss = out => !out || !out.length || (out.some(m => m && m.kind === 'none') && !out.some(m => m && m.card));
  // does Tommy's own safety check fire on this message? (crisis, emergency, distress, threats, hazing, harassment…)
  const risky = text => { try { const n = TA.NLU.parse(String(text || '')), H = TA.Hub || {}; return !!(n.crisis || n.emergency || n.distress || n.threatMe || (H.flagged && H.flagged(n)) || (H.dangerText && H.dangerText(n))); } catch (e) { return true; } };
  function wrapTommy() {
    const TS = window.TA && TA.Script, UI = window.TA && TA.UI; if (!TS || !TS.handle || TS._xWrapped) return; TS._xWrapped = true;
    const handle0 = TS.handle;
    TS.handle = async function (text) {
      // an answer the Tommy team published for a flagged question never stands in for Tommy's safety check
      const k = norm(text); let g = /^@/.test(text) ? null : X().gaps.find(o => o.answer && norm(o.q) === k);
      if (g && risky(text)) g = null;
      if (g) return [{ role: 'bot', kind: 'c', md: g.answer + '\n\n_This question was flagged when I couldn’t answer it, and the Tommy team added the answer._' }];
      const out = await handle0.call(TS, text);
      // a safety message is never sent to the Tommy team's queue (it stays on this device)
      try { if (!/^@/.test(text) && k.split(' ').length >= 3 && isMiss(out) && !(TA.Brain && TA.Brain.pending) && !risky(text)) { flagGap(text, 'Tommy had no answer'); (out || []).push({ role: 'bot', md: '**I flagged this for the Tommy team.** A question without an answer gets fixed, and you’ll get a note when I can answer it. Track it under Report a Problem.' }); } } catch (e) { console.error(e); }
      return out;
    };
    // thumbs under each answer: "Not what I asked" files the question for a fix
    const render0 = UI.renderMsg;
    UI.renderMsg = function (m) {
      const el = render0.call(UI, m);
      try {
        if (m && m.role === 'bot' && m.md && !m.card && !m.error && m.id && (m.script || m.sources)) {
          const d = document.createElement('div'); d.className = 'x-fb'; d.dataset.mid = m.id;
          d.innerHTML = `<button type="button" data-xfb="-1" aria-pressed="${m.xfb === -1}">Not what I asked</button>`;
          el.appendChild(d);
        }
      } catch (e) { /* leave the message as is */ }
      return el;
    };
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-xfb]'); if (!b) return; const wrap = b.closest('.x-fb'), msgs = UI.msgs || [], i = msgs.findIndex(m => m.id === wrap.dataset.mid); if (i < 0) return;
      const m = msgs[i], v = +b.dataset.xfb; if (m.xfb === v) return; m.xfb = v;
      $$('[data-xfb]', wrap).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.xfb === v)));
      try { TA.store.set('convo', msgs.slice(-80)); } catch (er) { /* storage unavailable */ }
      if (v < 0) { let q = ''; for (let j = i - 1; j >= 0; j--) if (msgs[j].role === 'user') { q = msgs[j].md; break; } if (q) { flagGap(q, 'Student said: not what I asked', plain(m.md)); UI.push([{ role: 'bot', md: 'Thanks for telling me. **I flagged that question and my answer for the Tommy team** so it gets fixed. You’ll get a note when it is.' }]); } }
      else TH.toast('Thanks for the feedback', 'up');
    });
  }
  // Ask Tommy from outside the chat (Call Tommy, the Tommy Everywhere search, organizer Tommy). Only a confirm card means
  // "approve it in the chat". Crisis, emergency and support replies carry their real numbers in a resources card: those
  // are read out with the answer (text) and returned as tap targets (res: [{label, value, href}]).
  const resItems = m => m && m.card && m.card.type === 'resources' && Array.isArray(m.card.items) ? m.card.items : [];
  const resLine = i => { const l = String(i.label || '').trim(), v = String(i.value || '').trim(); return !l ? v : !v ? l : l + (/[?!.:]$/.test(l) ? ' ' : ': ') + v + (/[.!?]$/.test(v) ? '' : '.'); };
  async function askTommy(text, inChat) {
    const TS = TA.Script, B = TA.Brain, UI = TA.UI, pend = B.pending; let out = null;
    try { out = await TS.handle(text); } catch (e) { console.error(e); }
    const bots = (out || []).filter(m => m && m.role !== 'user'), type = t => bots.some(m => m.card && m.card.type === t);
    const card = type('confirm'), signin = bots.some(m => m.card && m.card.type === 'signin' && m.card.status !== 'done'), other = bots.some(m => m.card && !/^(confirm|signin|resources)$/.test(m.card.type));
    // an ask from outside the chat never leaves a request waiting in it (the chat doesn't show that card)
    if (inChat) { try { UI.push([{ role: 'user', md: text }]); UI.push(out || []); if (B.persist) B.persist(); } catch (e) { console.error(e); } }
    else if (card || signin || B.pending !== pend) { B.pending = pend; try { if (B.persist) B.persist(); } catch (e) { /* session storage unavailable */ } }
    const res = bots.flatMap(resItems), tones = bots.map(m => resItems(m).length ? m.card.tone || 'help' : null).filter(Boolean);
    return {
      text: bots.map(m => [plain(m.md), ...resItems(m).map(resLine)].filter(Boolean).join(' ')).filter(Boolean).join(' '),
      lead: bots.map(m => plain(m.md)).filter(Boolean).join(' '),
      card, signin, other, res, tone: tones.includes('emergency') ? 'emergency' : tones.includes('crisis') ? 'crisis' : tones[0] || '',
      miss: isMiss(out), src: (bots.find(m => m.sources && m.sources[0]) || {}).sources,
    };
  }
  const EV = [['ext', 'Browser extension', 'USC questions you type into Google get Tommy’s checked answer on top'], ['chatgpt', 'ChatGPT', 'Tommy connector'], ['claude', 'Claude', 'Tommy connector'], ['gemini', 'Gemini', 'Tommy connector'], ['siri', 'Siri and Shortcuts', '“Hey Siri, ask Tommy…”']];
  let lastSearch = null;
  TH.screens.everywhere = {
    render() {
      const x = X();
      return `<div class="screen">${top('Tommy Everywhere')}<div class="pad screen-body stack">
        <p class="muted" style="font-size:13.5px">Wherever you ask a USC question, the answer comes from Tommy’s checked USC sources. Search engines and other AI assistants hand the question to Tommy instead of guessing.</p>
        <div class="rows">${EV.map(([k, n, sub]) => `<div class="row" style="--rc:var(--gold-ink)"><span class="rico">${icon(k === 'ext' ? 'globe' : 'sparkle')}</span><span class="rmain"><span class="rtitle">${n}</span><span class="rsub wrap">${sub}</span></span><button class="btn sm x-toggle ${x.every[k] ? 'line' : ''}" data-ev="${k}">${x.every[k] ? 'On' : 'Turn on'}</button></div>`).join('')}</div>
        <div class="section"><div class="section-head"><h2>Try it</h2><span class="pill mute">Demo search page</span></div>
          <div class="x-search"><form id="ev-form" class="searchbox" style="display:flex;gap:8px"><label class="sr" for="ev-q">Search the web</label><input id="ev-q" type="search" placeholder="Search the web: when does Leavey close?" style="flex:1;min-width:0;height:44px;border-radius:22px;border:1.5px solid var(--line);background:var(--bg);padding:0 14px" value="${esc(lastSearch ? lastSearch.q : '')}"><button class="btn sm" style="flex:none;min-height:44px">Search</button></form>
            <div id="ev-out">${lastSearch ? searchHTML(lastSearch) : `<span class="muted tiny">Type a USC question to see what a search result looks like with Tommy on.</span>`}</div></div></div>
        <div class="card flat"><b>No question goes unanswered</b><p class="muted" style="font-size:13px;margin-top:4px">If Tommy can’t answer, or you tap “Not what I asked”, the question is flagged for the Tommy team right away. ${x.gaps.filter(g => !g.answer && !g.sample).length} of yours are open now.</p></div>
        ${sim('The extension and connectors are a design for launch; the toggles here are simulated. The demo search runs the real Ask Tommy engine in this app.')}
      </div></div>`;
    },
    mount(host) {
      host.addEventListener('click', e => { const b = e.target.closest('[data-ev]'); if (!b) return; const x = X(); x.every[b.dataset.ev] = !x.every[b.dataset.ev]; save(); TH.render(true); });
      $('#ev-form', host).addEventListener('submit', async e => {
        e.preventDefault(); const q = $('#ev-q', host).value.trim(); if (!q) return; const out = $('#ev-out', host); out.innerHTML = '<span class="muted">Asking Tommy…</span>';
        const r = await askTommy(q, false); lastSearch = Object.assign({ q }, r); if (out.isConnected) out.innerHTML = searchHTML(lastSearch);
      });
    },
  };
  // the numbers in an answer as tap targets: one target per number ("Call 911 or DPS at 213-740-4321" is two), and a
  // crisis or emergency answer always offers 911 and DPS
  const CHIP = { 'tel:911': 'Call 911', 'tel:+12137404321': 'DPS 213-740-4321', 'tel:+12137409355': 'Counseling 213-740-9355', 'tel:+13234421000': 'Health Sciences DPS 323-442-1000', 'tel:+12137406000': 'DPS non-emergency 213-740-6000' };
  function numChips(r) {
    const out = [], add = (href, text) => { if (href && text && !out.some(o => o.href === href)) out.push({ href, text }); };
    (r.res || []).forEach(i => {
      const h = String(i.href || ''), v = String(i.value || '').trim(); if (!/^(tel|sms):/.test(h) || !v) return;
      if (h !== 'tel:911' && /\b911\b/.test(v)) add('tel:911', CHIP['tel:911']);
      add(h, CHIP[h] || v);
    });
    if (r.tone === 'emergency' || r.tone === 'crisis') { add('tel:911', CHIP['tel:911']); add('tel:+12137404321', CHIP['tel:+12137404321']); }
    const rank = o => o.href === 'tel:911' ? 0 : o.href === 'tel:+12137404321' ? 1 : 2;
    if (r.tone === 'emergency') out.sort((a, b) => rank(a) - rank(b));
    return out.slice(0, 6);
  }
  function searchHTML(r) {
    const body = r.card ? 'That’s something Tommy can do for you. Open Ask Tommy to confirm it.' : r.miss ? 'Tommy doesn’t have a checked answer yet. The question was flagged for the Tommy team, so the web results below are unverified.' : r.text.slice(0, 420) + (r.text.length > 420 ? '…' : '');
    // crisis and emergency answers: the real numbers as tap targets, right in the result
    const nums = numChips(r);
    return `<div class="x-ai"><span class="eyebrow">${icon('verified')} Tommy · ${r.miss ? 'no checked answer yet' : 'answer from USC sources'}</span><span>${esc(body)}</span>${nums.length ? `<span class="x-ai-nums">${nums.map(i => `<a href="${esc(i.href)}">${icon(/^sms:/.test(i.href) ? 'chat' : 'phone')}${esc(i.text)}</a>`).join('')}</span>` : ''}${r.src && r.src[0] && r.src[0].url ? TH.ui.src(r.src[0].url) : ''}<button class="linkbtn" data-go="assistant:${esc(r.q)}" style="color:var(--cardinal-ink);font-weight:650">Open in Ask Tommy</button></div>
      <div class="x-other" aria-hidden="true"><span>Other web results</span><i style="width:80%"></i><i style="width:95%"></i><i style="width:60%"></i></div>`;
  }

  // =====================================================================
  // CALL TOMMY: talk, hear the answer. Uses the viewer's dictation and read-aloud when available,
  // the browser's own speech features in the standalone file, and typing everywhere.
  // =====================================================================
  const V = { dict: null, tts: null, ready: false, sr: null };
  function initVoice() {
    if (V.ready) return; V.ready = true;
    const use = n => { try { return window.claude && window.claude.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
    use('dictation').then(d => { V.dict = d || null; if (d) { d.onPartial(o => call && call.onPartial(o.text)); d.onFinal(o => call && call.onFinal(o.text)); d.onState(o => call && call.onDictState(o)); } if (call) call.paint(); });
    use('tts').then(t => { V.tts = t || null; });
    V.sr = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  const canListen = () => !!(V.dict || (!window.claude && V.sr));
  // ---------- safety first, on this device ----------
  // When Tommy's own language check reads an emergency or a crisis, a call shows and reads out the real numbers right away,
  // before anything else runs, as big tap targets. Nothing is ever "transferred" or "connected": this prototype can't place
  // calls or reach DPS, and the screen says so. Distress follows the chat's rule: "this exam is killing me" is school stress.
  const IDIOM = /\b(is|are|'s|was) (killing|destroying|murdering|wrecking) me\b|\bkicking my (ass|butt)\b|\b(killing|destroying) me\b/;
  const SCHOOL = /\b(class|classes|course|exam|exams|midterm|midterms|final|finals|homework|hw|problem set|pset|lab|professor|semester|quiz|reading|readings|workload)\b/;
  // happening-now emergencies the language check can miss: someone following a friend, a friend bleeding or hurt after a
  // fall, someone at the door who won't leave, lost on a hike after dark
  // (a person is the one followed, never "people are following our club on Instagram"; a person is bleeding, not gums)
  const WHO = '(?:me|us|her|him|them|(?:my|our)\\s+(?:friends?|roommates?|suitemates?|girlfriend|boyfriend|partner|sister|brother|classmates?|teammates?|kids?|son|daughter|mom|dad)|(?:a|this|that|some)\\s+(?:girl|guy|woman|man|student|kid|person|friend))';
  const NOW_NET = [
    new RegExp('\\b(?:is|are|keeps?|kept|has been|have been|been)\\s+(?:following|stalking|chasing)\\s+' + WHO + '\\b(?!\\s+(?:on|back on)\\s+(?:insta\\w*|ig|twitter|x|tiktok|snap\\w*|social|linkedin|facebook|spotify|github|here|the app)\\b)'),
    /\b(?:he|she|they|friend|roommate|suitemate|someone|somebody|person|guy|girl|man|woman|kid)\b[^.!?]{0,30}\b(?:is|are|'s|keeps?|still|started)\s+bleeding\b|\b(?:i'?m|im|i am|i keep|i'?ve been)\s+(?:still\s+)?bleeding\b|\bwon'?t stop bleeding\b|\bbleeding\s+(?:a lot|badly|heavily|everywhere|out)\b/,
    /\bfell\b[^.!?]{0,40}\b(bleed\w*|unconscious|not moving|can'?t move|cant move|not breathing|won'?t wake|wont wake|passed out)\b/,
    /\b(outside|at|banging on)\s+(my|our|the)\s+(door|window|room|dorm|apartment)\b[^.!?]{0,30}\b(won'?t|wont|will not|refuses? to)\s+(leave|go away|stop)\b/,
    /\b(lost|stranded|stuck)\b[^.!?]{0,40}\b(hike|hiking|trail|woods|mountains?|canyon)\b[^.!?]{0,40}\b(dark|night|help|hurt|injured|bleeding)\b/,
  ];
  function callSafety(q) {
    let n = null; try { n = TA.NLU.parse(q); } catch (e) { n = null; }
    try { const dz = n && TA.Hub && TA.Hub.dangerText ? TA.Hub.dangerText(n) : null; if (dz) n = dz; } catch (e) { /* keep the first reading */ }
    n = n || { t: String(q).toLowerCase() };
    const t = String(n.t || q).toLowerCase(), raw = String(q).toLowerCase();
    let school = false; try { school = !n.crisis && IDIOM.test(t) && (SCHOOL.test(t) || !!(n.courses && n.courses.length)) && !TA.NLU.parse(t.replace(IDIOM, ' ')).distress; } catch (e) { school = false; }
    const crisis = !!n.crisis || (!!n.distress && !school);
    const emerg = !!(n.emergency || n.threatMe) || NOW_NET.some(re => re.test(raw) || re.test(t));
    return crisis || emerg ? { n, crisis, emerg, soft: !n.crisis } : null;
  }
  // the real numbers, as Tommy's crisis and emergency cards give them
  const LINES = {
    n911: { key: 'n911', href: 'tel:911', big: 'Call 911', small: 'Police, fire, medical', cls: 'x-num-911' },
    dps: { key: 'dps', href: 'tel:+12137404321', big: 'Call DPS', small: '213-740-4321 · USC Public Safety' },
    n988: { key: 'n988', href: 'tel:988', big: 'Call 988', small: 'Suicide & Crisis Lifeline' },
    well: { key: 'well', href: 'tel:+12137409355', big: '213-740-9355', small: 'Call USC counseling, 24/7' },
    text: { key: 'text', href: 'sms:741741?&body=TROJAN', big: 'Text TROJAN to 741741', small: 'Crisis Text Line, 24/7', cls: 'x-num-wide' },
  };
  const HELP_SETS = { emergency: ['n911', 'dps'], crisis: ['n988', 'well', 'text', 'n911', 'dps'], both: ['n911', 'dps', 'n988', 'well', 'text'] };
  const SAY_EMERG = 'This sounds like an emergency. This prototype can’t call DPS for you. Call 911 or DPS at 213-740-4321 now.';
  const SAY_CRISIS = 'Call or text 988, or call USC’s 24/7 counseling line at 213-740-9355. You can also text TROJAN to 741741. If you’re in danger right now, call 911 or DPS at 213-740-4321.';
  const SAY_CRISIS_ALSO = 'You can also call or text 988, call USC’s 24/7 counseling line at 213-740-9355, or text TROJAN to 741741.';
  const SIM_DPS = 'Simulated — DPS was not contacted';
  // the USC safety and support numbers Tommy's answers use: links in the call log, tap targets when an answer gives 911 or DPS
  const TEL = { '213-740-4321': 'tel:+12137404321', '213-740-9355': 'tel:+12137409355', '323-442-1000': 'tel:+13234421000', '213-740-6000': 'tel:+12137406000', '213-740-0411': 'tel:+12137400411', '213-740-2500': 'tel:+12137402500', '911': 'tel:911', '988': 'tel:988', '741741': 'sms:741741?&body=TROJAN' };
  const TEL_LABEL = { '323-442-1000': 'Call DPS, Health Sciences Campus', '213-740-6000': 'Call DPS non-emergency', '213-740-0411': 'Call Campus Support & Intervention', '213-740-2500': 'Call USC Report & Response, 24/7' };
  const NUM_RE = /\b(213-740-4321|213-740-9355|323-442-1000|213-740-6000|213-740-0411|213-740-2500|911|988|741741)\b/g;
  const numsIn = t => [...new Set(String(t || '').match(NUM_RE) || [])].map(v => ({ href: TEL[v], value: v, label: TEL_LABEL[v] || '' }));
  // read numbers digit by digit ("2 1 3, 7 4 0, 4 3 2 1"), the way people dial them
  const forSpeech = t => String(t).replace(/\b(\d{3})-(\d{3})-(\d{4})\b/g, (m, a, b, c) => [a, b, c].map(g => g.split('').join(' ')).join(', ')).replace(/\b(911|988|741741)\b/g, m => m.split('').join(' '));
  const mdText = md => String(md || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`#>|]/g, '').replace(/^\s*[-•]\s+/gm, '• ').replace(/\n{3,}/g, '\n\n').trim();
  let call = null;
  TH.callTommy = function () {
    const dev = $('.device'); if (!dev || call) return; initVoice(); TH.closeSheet();
    dev.insertAdjacentHTML('beforeend', `<div class="x-call" role="dialog" aria-modal="true" aria-label="Call with Tommy" data-st="idle">
      <div class="x-call-top"><span class="eyebrow" style="color:var(--gold)">Voice call · Ask Tommy</span><div class="x-call-av" aria-hidden="true">T</div><b style="font:800 22px var(--f-display)">Tommy</b><span class="x-call-st" role="status"></span></div>
      <div class="x-call-log" aria-live="polite"></div>
      <div class="x-call-ctl"><div class="x-call-help" role="group" aria-label="Call or text for help" hidden></div><form><label class="sr" for="x-call-in">Type to Tommy</label><input id="x-call-in" placeholder="Or type your question" autocomplete="off" maxlength="300"><button class="btn sm gold" style="flex:none;min-height:44px">Ask</button></form>
        <div class="x-call-btns"><button class="mic" aria-pressed="false" aria-label="Talk">${icon('mic')}</button><button class="end" aria-label="End call">${icon('phone')}</button></div></div></div>`);
    const el = $('.x-call', dev), log = $('.x-call-log', el), stEl = $('.x-call-st', el), mic = $('.mic', el), helpBox = $('.x-call-help', el);
    let st = 'idle', buf = '', tmr = null, rec = null, live = null, alive = true, sticky = '';
    const say = (cls, t) => {
      const p = document.createElement('p'); p.className = cls; t = String(t || '');
      if (/\bbot\b/.test(cls)) { let i = 0; t.replace(NUM_RE, (m, g, at) => { if (at > i) p.appendChild(document.createTextNode(t.slice(i, at))); const a = document.createElement('a'); a.href = TEL[m]; a.textContent = m; p.appendChild(a); i = at + m.length; return m; }); if (i < t.length) p.appendChild(document.createTextNode(t.slice(i))); }
      else p.textContent = t;
      log.appendChild(p); log.scrollTop = log.scrollHeight; return p;
    };
    const label = s => s === 'listening' ? 'Listening…' : s === 'thinking' ? 'Tommy is checking USC sources…' : sticky || (s === 'speaking' ? 'Tommy is talking. Tap the mic to interrupt.' : canListen() ? 'Tap the mic and ask' : 'Voice isn’t available in this view. Type your question.');
    const set = s => { st = s; el.dataset.st = s; mic.setAttribute('aria-pressed', String(s === 'listening')); mic.disabled = s === 'thinking' || !canListen(); const v = label(s); if (stEl.textContent !== v) stEl.textContent = v; };
    const stopSpeak = () => { try { if (V.tts) V.tts.stop(); else if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* nothing playing */ } };
    const speak = t => { t = forSpeech(t).slice(0, 1800); if (V.tts) return V.tts.speak(t).catch(() => null); if (!window.claude && window.speechSynthesis) return new Promise(res => { const u = new SpeechSynthesisUtterance(t); u.onend = u.onerror = () => res(); speechSynthesis.speak(u); }); return Promise.resolve(); };
    // big tap targets for the numbers; once on screen they stay for the rest of the call (911 and DPS lead after an emergency)
    const lines = []; let emergOn = false, crisisOn = false;
    function showHelp(kind, items) {
      if (kind === 'emergency' || kind === 'both') emergOn = true; if (kind === 'crisis' || kind === 'both') crisisOn = true;
      (HELP_SETS[kind] || []).forEach(k => { if (!lines.some(l => l.href === LINES[k].href)) lines.push(LINES[k]); });
      (items || []).forEach(i => {
        const h = String(i.href || ''), v = String(i.value || '').trim(), same = Object.values(LINES).find(l => l.href === h); if (!/^(tel|sms):/.test(h) || !v || lines.some(l => l.href === h)) return;
        lines.push(same || (/^[\d()+ -]{3,}$/.test(v) ? { href: h, big: v, small: String(i.label || '').replace(/[?:]\s*$/, '') || (/^sms:/.test(h) ? 'Text' : 'Call') } : { href: h, big: v, small: String(i.label || '').replace(/[?:]\s*$/, '') }));
      });
      if (!lines.length) return;
      const rank = l => l.key === 'n911' ? 0 : l.key === 'dps' ? 1 : 2;
      if (emergOn || !crisisOn) lines.sort((a, b) => rank(a) - rank(b));
      const note = emergOn ? `${SIM_DPS}. Tap to call 911 or DPS yourself.` : crisisOn ? 'Free and confidential, 24/7. Tap to call or text.' : 'Tap a number to call. Tommy can’t place calls for you.';
      helpBox.innerHTML = `<p class="x-call-note${emergOn ? ' sim' : ''}">${icon(emergOn ? 'alert' : 'info')}<span>${esc(note)}</span></p><div class="x-call-nums">${lines.slice(0, emergOn || crisisOn ? 6 : 4).map(l => `<a class="x-num${l.cls ? ' ' + l.cls : ''}" href="${esc(l.href)}">${icon(/^sms:/.test(l.href) ? 'chat' : 'phone')}<span><b>${esc(l.big)}</b>${l.small ? `<small>${esc(l.small)}</small>` : ''}</span></a>`).join('')}</div>`;
      helpBox.hidden = false; el.dataset.help = emergOn ? 'emergency' : crisisOn ? 'crisis' : 'numbers';
      sticky = emergOn ? SIM_DPS : crisisOn ? 'Help is available 24/7. Tap a number below.' : sticky;
    }
    async function helpNow(sf, q) {
      stopListen();
      const B = TA.Brain, msgs = [];
      // Tommy's own cards also go into the Ask Tommy chat, so the numbers are there after the call. A request that was
      // waiting for a yes is dropped, as Tommy does in the chat for any safety message.
      try { if (B.pending && B.pending.aid !== 'book_health') B.dropPending([], true); } catch (e) { /* nothing waiting */ }
      try { if (sf.emerg) { msgs.push(B.emergency(sf.n)); if (B.emergencyGuide) msgs.push(B.emergencyGuide(sf.n)); } if (sf.crisis) msgs.push(B.crisis(sf.soft && !sf.emerg ? 'distress' : false)); } catch (e) { console.error(e); }
      const shown = msgs.filter(Boolean);
      try { TA.UI.push([{ role: 'user', md: q }, ...shown]); if (B.persist) B.persist(); } catch (e) { console.error(e); }
      const lead = sf.emerg ? SAY_EMERG + (sf.crisis ? ' ' + SAY_CRISIS_ALSO : '') : (plain((shown.find(m => m.card && m.card.tone === 'crisis') || {}).md) || 'You don’t have to handle this alone.') + ' ' + SAY_CRISIS;
      showHelp(sf.emerg ? (sf.crisis ? 'both' : 'emergency') : 'crisis');
      say('bot', lead);
      const guide = sf.emerg ? shown.find(m => !m.card && m.md) : null; if (guide) say('bot guide', mdText(guide.md));
      set('speaking'); await speak(lead); if (!alive) return;
      if (st === 'speaking') set('idle');
    }
    async function ask(q) {
      q = String(q || '').trim(); if (!q || !alive) return set('idle');
      if (live) { live.remove(); live = null; } say('me', q);
      const sf = callSafety(q); if (sf) return helpNow(sf, q);
      set('thinking');
      const r = await askTommy(q, true); if (!alive) return;
      // the brain can still answer with safety numbers (support lines, an emergency it read): show them as tap targets
      const said = /\b(911|213-740-4321)\b/.test(r.text) ? numsIn(r.text) : [];
      if (r.res.length || said.length) showHelp(r.tone === 'emergency' ? 'emergency' : r.tone === 'crisis' ? 'crisis' : '', [...r.res, ...said]);
      const hint = r.card ? ' I put a confirm card in our chat. Open the chat to approve it.' : r.signin ? ' Open the chat to sign in first.' : r.other ? ' The details are in our chat.' : '';
      const body = r.text || 'I didn’t find an answer for that.';
      // on screen: the answer, plus any of its resources that aren't already a button below (all of them are read out)
      const onBtn = new Set($$('a.x-num', helpBox).map(a => a.getAttribute('href'))), rest = r.res.filter(i => !onBtn.has(String(i.href || ''))).map(resLine);
      say('bot', (r.res.length && r.lead ? [r.lead, ...rest].join(' ') : body) + hint); set('speaking'); await speak(body + hint); if (!alive) return;
      if (st === 'speaking') { set('idle'); if (!V.dict && !window.claude && V.sr && !lines.length) listen(); }
    }
    function listen() {
      stopSpeak(); buf = '';
      if (V.dict) { set('listening'); V.dict.start().catch(e => { set('idle'); stEl.textContent = e && e.code === 'not_granted' ? 'Microphone is off for this page. Type your question.' : 'Couldn’t start listening. Try again or type.'; }); return; }
      if (!window.claude && V.sr) { try { rec = new V.sr(); rec.lang = 'en-US'; rec.interimResults = true; rec.onresult = e => { const r = e.results[e.results.length - 1]; if (r.isFinal) { const t = r[0].transcript; rec = null; ask(t); } else call.onPartial(r[0].transcript); }; rec.onerror = () => { rec = null; if (st === 'listening') set('idle'); }; rec.onend = () => { if (rec && st === 'listening') set('idle'); rec = null; }; rec.start(); set('listening'); } catch (e) { set('idle'); } }
    }
    const stopListen = () => { clearTimeout(tmr); try { if (V.dict) V.dict.stop().catch(() => null); else if (rec) rec.stop(); } catch (e) { /* not listening */ } };
    call = {
      paint: () => set(st),
      onPartial(t) { if (st !== 'listening') return; if (!live) live = say('me live', ''); live.textContent = (buf + ' ' + t).trim(); log.scrollTop = log.scrollHeight; },
      onFinal(t) { if (st !== 'listening') return; buf = (buf + ' ' + t).trim(); if (!live) live = say('me live', ''); live.textContent = buf; clearTimeout(tmr); tmr = setTimeout(() => { const q = buf; buf = ''; stopListen(); ask(q); }, 1300); },
      onDictState(o) { if (o.state === 'idle' && st === 'listening') { clearTimeout(tmr); if (buf) { const q = buf; buf = ''; ask(q); } else set('idle'); } },
    };
    mic.onclick = () => { if (st === 'listening') { const q = buf; buf = ''; stopListen(); if (q) ask(q); else set('idle'); } else listen(); };
    $('form', el).addEventListener('submit', e => { e.preventDefault(); const i = $('#x-call-in', el), q = i.value; i.value = ''; stopSpeak(); if (st === 'listening') stopListen(); ask(q); });
    $('.end', el).onclick = () => { alive = false; stopSpeak(); stopListen(); el.remove(); call = null; TH.toast('Call ended. The conversation is saved in Ask Tommy.', 'phone'); };
    set('idle'); say('bot', `Hi ${TH.student().first}, it’s Tommy. Ask me anything about USC, or tell me what to do.`);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-xcall]')) TH.callTommy(); });
  // styles for the call's tap-to-call numbers and the Tommy Everywhere result's numbers (the call screen is dark in both themes)
  try {
    if (!document.getElementById('x-help-css')) {
      const css = document.createElement('style'); css.id = 'x-help-css';
      css.textContent = `.x-call[data-help] .x-call-av{width:60px;height:60px;font-size:28px;margin-top:2px}
.x-call-help{display:grid;gap:8px}.x-call-help[hidden]{display:none}
.x-call-note{display:flex;gap:8px;align-items:center;margin:0;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font-size:13.5px;font-weight:650;line-height:1.3}
.x-call-note .ic{width:18px;height:18px;flex:none}.x-call-note.sim{background:rgba(255,204,0,.18);color:#ffe9a8}
.x-call-nums{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.x-num{display:flex;align-items:center;gap:10px;min-height:58px;padding:8px 12px;border-radius:16px;background:#fff;color:#1f1718;text-decoration:none;text-align:left;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.x-num .ic{width:22px;height:22px;flex:none;color:#990000}.x-num b{display:block;font:800 16px/1.15 var(--f-display,inherit)}
.x-num small{display:block;font-size:12px;line-height:1.25;color:#5b4a4b;margin-top:2px}
.x-num-911{background:#b3232a;color:#fff}.x-num-911 .ic,.x-num-911 small{color:#fff}.x-num-wide{grid-column:1/-1}
.x-num:focus-visible{outline:3px solid var(--gold,#ffcc00);outline-offset:2px}.x-num:active{transform:scale(.98)}
@media (prefers-reduced-motion:reduce){.x-num:active{transform:none}}
.x-call-log p.bot a{color:#990000;font-weight:800;text-decoration:underline;text-underline-offset:2px;white-space:nowrap}
.x-call-log p.guide{white-space:pre-line;font-size:13.5px}
.x-ai-nums{display:flex;flex-wrap:wrap;gap:8px}
.x-ai-nums a{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:22px;background:var(--bad-bg);color:var(--bad);font-weight:750;text-decoration:none}
.x-ai-nums .ic{width:18px;height:18px}`;
      document.head.appendChild(css);
    }
  } catch (e) { /* unstyled numbers still work */ }

  // =====================================================================
  // SHELL: Home and More additions, club newsletters from officers, call button in the chat, ticks
  // =====================================================================
  const home0 = TH.screens.home.render;
  TH.screens.home.render = function () {
    let h = home0.call(this);
    return h;
  };
  const more0 = TH.screens.more.render;
  TH.screens.more.render = function () {
    const x = X(), open = x.reports.filter(r => r.status < 3).length;
    let h = more0.call(this);
    h = h.replace('class="card profile" data-go="wallet"', () => 'class="card profile" data-go="profile"');
    h = h.replace('<div class="rows">', m => `<div class="x-modebar"><span class="x-mb-main"><b>Student side</b><span style="font-size:13px">Run a club or a USC office? Switch sides any time.</span></span><button class="btn sm gold" data-go="org">${icon('swap')} Organizer</button></div>
      <div class="rows">
        ${row('data-go="profile"', 'user', 'My Profile', `${filled()} of 5 sections · snacks, dietary needs, interests, career goals`, 'var(--cardinal)')}
        ${row('data-go="report"', 'flag', 'Reports', open ? `${open} open · report something, track it, SOS alerts` : 'Report something with a photo · track it · SOS alerts', 'var(--c-safety)')}
        ${row('data-go="chats"', 'chat', 'Club Messages', 'Your club group chats and everything clubs send out', 'var(--c-study)')}
        ${row('data-xcall', 'phone', 'Call Tommy', 'Talk to Tommy and hear the answer', 'var(--c-health)')}
        ${row('data-go="connect"', 'link', 'Connections & Alerts', 'Gmail, calendars, Slack, Handshake; app or email for each alert', 'var(--c-transit)')}
      </div>` + m);
    return h;
  };
  if (TH.screens.news) {
    const news0 = TH.screens.news.render, newsM0 = TH.screens.news.mount;
    const sent = () => Object.entries(X().orgs).flatMap(([id, o]) => (o.sent || []).map(n => Object.assign({ orgId: id }, n))).sort((a, b) => b.at - a.at);
    TH.screens.news.render = function () {
      const s = sent(); let h = news0.call(this);
      if (s.length) h = h.replace('<div class="pad screen-body stack">', m => m + `<div class="section"><div class="section-head"><h2>From club officers</h2></div><div class="rows">${s.map(n => row(`data-xnl="${esc(n.id)}"`, 'megaphone', esc(n.subject), `${esc(n.org)} · ${ago(n.at)} · also emailed`, 'var(--cardinal)')).join('')}</div></div>`);
      return h;
    };
    TH.screens.news.mount = function (host) {
      newsM0 && newsM0.call(this, host);
      host.addEventListener('click', e => { const b = e.target.closest('[data-xnl]'); if (!b) return; e.stopPropagation(); const n = sent().find(q => q.id === b.dataset.xnl); if (!n) return; TH.sheet(`<div class="stack newsletter"><div class="sheet-head"><div><span class="eyebrow">${esc(n.org)} · newsletter</span><h2>${esc(n.subject)}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div><p style="white-space:pre-line">${esc(n.body)}</p><span class="muted tiny">Sent in Trojan Hub and by email ${ago(n.at)}.</span></div>`); }, true);
    };
  }
  if (TH.screens.assistant) {
    const am0 = TH.screens.assistant.mount;
    TH.screens.assistant.mount = function (host) {
      am0.call(this, host);
      const menu = document.getElementById('ta-menu-btn'); if (!menu || document.getElementById('x-call-btn')) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ta-icon'; b.id = 'x-call-btn'; b.setAttribute('aria-label', 'Call Tommy'); b.innerHTML = icon('phone'); b.onclick = () => TH.callTommy();
      menu.parentNode.insertBefore(b, menu);
    };
  }

  // Report status steps and space approvals are simulated, and every notification and toast they make says so (they sit
  // next to real DPS alerts). A safety report repeats the real numbers, since nothing reached DPS.
  const SAFETY_TAIL = ' In danger now? Call 911 or DPS at 213-740-4321.';
  function tick() {
    if (!(window.TA && TA.State && TA.State.d)) return; const x = X(); let changed = false;
    x.reports.forEach(r => {
      const age = Date.now() - r.at, office = r.office || 'the right office', tail = r.cat === 'safety' || /public safety|\bdps\b/i.test(office + ' ' + (r.team || '')) ? SAFETY_TAIL : '';
      if (r.status === 0 && age > 12000) { r.status = 1; changed = true; note('reports', `Report ${r.id} routed (simulated)`, `In a real launch it would go to ${office}${r.team ? ` (${r.team})` : ''}. Nothing was sent from this prototype.${tail}`, 'report'); }
      else if (r.status === 1 && age > 50000) { r.status = 2; changed = true; note('reports', `Report ${r.id} in progress (simulated)`, `Sample status only. Nothing was sent to ${office} from this prototype.${tail}`, 'report'); }
    });
    Object.values(x.orgs).forEach(o => (o.bookings || []).forEach(b => { if (b.status === 'pending' && Date.now() - b.at > 20000) { b.status = 'approved'; changed = true; note('events', `Space approved: ${b.place} (simulated)`, `${b.org} · ${b.when}`, 'orgspace'); } }));
    if (changed) { save(); if (!$('.sheet-wrap') && !typing() && ['report', 'orgspace', 'org', 'orginbox'].includes(TH.state.route)) TH.render(true); }
  }

  const reqFor = (r, id) => r.clubIds ? r.clubIds.map(String).includes(String(id)) : (r.clubId == null || String(r.clubId) === String(id));
  const reqTo = r => r.clubIds ? (r.clubIds.length ? `sent to ${r.clubIds.length} relevant club${r.clubIds.length === 1 ? '' : 's'}` : 'sent to Campus Activities') : r.clubId == null ? 'to any club' : 'to ' + clubName(r.clubId);
  TH.x = { reqFor, reqTo, recEvents, recClubs, whyEvent, scoreHay, foodNotes, majorKw, majorFits, evid, kre, shortMajor, CI_KW, CT, FOOD_KW, ALLERGEN_KW, routeFor, guessCat, shrink, openReport, repRow, isHousing, recJobs, matchReasons, hay, thumbs, bindThumbs, chatOpen, payDues, RTYPES, RWHEN, filled, nearestPlace, askTommy, similarClubs, X, save, uid, hash, ago, sim, top, row, note, ai, primaryClub, NAMES, PF, member, duesOf, STAT, RC, flagGap, chatMsgs, threadHTML, threadMount, clubName, sharedLine, tick, wrapTommy, initVoice, typing, lastSaveOk: () => lastWrite, PHOTO_KB, callSafety };
})(window.TH = window.TH || {});
