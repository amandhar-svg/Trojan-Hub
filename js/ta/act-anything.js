/* js/ta/act-anything.js */
/* js/ta/act-anything.js — Tommy acts on (almost) anything.
 *
 * Adds, on top of Tommy Script (js/ta/script.js):
 *   - hub_request:  the catch-all. Any "do this for me" message that no specific action covers becomes a request to
 *                   the right USC office: Tommy asks what the office would ask (when, purpose/details), shows a
 *                   confirm card, submits it (simulated), and gives a confirmation number, an ETA and Undo.
 *   - hub_email:    drafts and "sends" an email to a professor, advisor, TA or RA from the student's account.
 *   - hub_pay_dues: pays a club's dues (simulated Venmo).
 *   - join a club:  acronyms work ("join EWB"), and after joining Tommy explains how the club works, what dues are
 *                   owed and to whom, and shows the latest weekly newsletter.
 * Privacy: all of this runs on the device. The AI translator only ever turns the student's words into a command.
 * Sample data (labeled in the answers): club dues and Venmo handles, office reply times.
 * Load after script.js; before bridge.js and TA.boot().
 */
(function () {
  'use strict';
  var TA = window.TA, TH = window.TH, B = TA.Brain, TS = TA.Script;
  var D = function () { return TA.State.d; };
  var now = function () { return TA.now(); };
  function hub() { var h = TA.hub(); if (!Array.isArray(h.requests)) h.requests = []; if (!Array.isArray(h.outbox)) h.outbox = []; return h; }
  function go(label, screen, arg) { return { label: label, value: '@go:' + screen + (arg != null ? ':' + arg : ''), kind: '' }; }
  function act(label, value) { return { label: label, value: value, kind: 'action' }; }
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function me() { var p = D().profile; return (p.preferred || p.first) + ' ' + p.last; }

  // ===================================================================================================
  // CLUBS: acronyms, dues (sample), briefing after joining
  // ===================================================================================================
  var SKIPW = { of: 1, the: 1, and: 1, at: 1, for: 1, in: 1, on: 1, a: 1, an: 1, to: 1, '&': 1, '-': 1 };
  function initials(name) { return String(name).replace(/[^A-Za-z0-9& -]+/g, ' ').split(/[\s-]+/).filter(function (w) { return w && !SKIPW[w.toLowerCase()]; }).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  var initCache = null;
  function byAcronym(tok) {
    tok = String(tok || '').toUpperCase(); if (tok.length < 2 || tok.length > 7) return [];
    if (!initCache) initCache = (TH.CLUBS || []).map(function (c) { return [c, initials(c.name)]; });
    var hits = initCache.filter(function (x) { return x[1].indexOf(tok) === 0 || new RegExp('\\b' + tok + '\\b').test(x[0].name.toUpperCase()); }).map(function (x) { return x[0]; });
    // prefer names where the acronym is the whole "core" (before USA / USC / chapter words), then clubs with events
    return hits.sort(function (a, b) { return (b.events || 0) - (a.events || 0) || a.name.length - b.name.length; });
  }
  var CLUBCMD = /^(?:please |can you |could you |hey tommy,? |tommy,? )*(join|sign me up for|sign up for|become a member of|add me to|get me into|leave|quit|follow|subscribe to|pay (?:my )?dues (?:for|to)|tell me about|what is|whats)\s+(?:the\s+)?(.+?)\s*(?:club|org|organization|chapter|team)?\s*(?:newsletter)?[.!?]*$/i;
  // "join EWB club" -> "join @club:35803"; "tell me about EWB" -> "tell me about Engineers Without Borders…"
  function expandClub(text) {
    var m = CLUBCMD.exec(String(text || '')); if (!m) return text;
    var name = m[2].trim(); if (/@club:|\s/.test(name) || name.length > 7 || !/^[A-Za-z0-9&]+$/.test(name)) return text;
    var lower = name.toLowerCase();
    if ((TH.CLUBS || []).some(function (c) { return c.name.toLowerCase() === lower; })) return text;
    var c = byAcronym(name); if (!c.length) return text;
    var verb = m[1].toLowerCase();
    if (/^(join|sign|become|add me|get me)/.test(verb)) return 'join @club:' + c[0].id;
    if (/^(leave|quit)/.test(verb)) return 'leave @club:' + c[0].id;
    if (/^pay/.test(verb)) return 'pay dues @dues:' + c[0].id;
    return String(text).replace(name, c[0].name);
  }
  TS.expandClub = expandClub;
  // EngageSC does not publish dues, so the amount and payee are SAMPLE values (stable per club)
  TH.clubDues = function (c) {
    var h = hash('dues' + c.id), amt = [0, 10, 15, 20, 20, 25, 30, 40][h % 8], ac = initials(String(c.name).split(/\s+-\s+|\bUSA\b|\bUSC\b|\bat\b|\(/)[0]).slice(0, 5) || initials(c.name).slice(0, 4) || 'CLUB';
    if (/government|residential|department|office|center/i.test(c.type + ' ' + c.name)) amt = 0;
    return { amount: amt, per: 'semester', handle: '@' + ac + '-USC', payee: 'the ' + (/chapter/i.test(c.name) ? 'chapter' : 'club') + ' treasurer' };
  };
  function memberRec(id) { return (hub().clubs || []).find(function (x) { return String(x.id) === String(id); }) || null; }
  function briefing(c) {
    var d = TH.clubDues(c), m = c.meeting, is = TH.news.issue(c.id), rec = memberRec(c.id), L = [];
    var desc = c.desc ? (c.desc.length > 260 ? c.desc.slice(0, 257).replace(/\s+\S*$/, '') + '…' : c.desc) : 'They haven’t posted a description on EngageSC.';
    L.push('**How ' + c.name + ' works**');
    L.push('- **What they do:** ' + desc);
    L.push('- **Kind of group:** ' + [c.type, (c.cats || [c.cat]).filter(Boolean).slice(0, 2).join(' / ')].filter(Boolean).join(' · '));
    L.push('- **Meetings:** ' + (m ? [(m.days || []).join(' & '), m.time, m.place].filter(Boolean).join(' · ') : 'Not public. Times go out to members through EngageSC and the group chat.'));
    L.push('- **Getting involved:** ' + (c.open === false ? 'EngageSC shows online joining as closed, so the officers approve members themselves. I sent your request; expect a message from them.' : 'Open membership. Show up to a meeting or event, and you’re on the roster.'));
    L.push('');
    L.push(d.amount ? '**Dues:** **$' + d.amount + '** per ' + d.per + '. Venmo **' + d.handle + '** (' + d.payee + ') with your name and USC email in the note.' + (rec && rec.duesPaid ? ' _You’ve paid._' : '') + ' _Sample amount and handle: EngageSC doesn’t list dues, so confirm with the officers._'
      : '**Dues:** none listed. _Sample: EngageSC doesn’t list dues, so confirm with the officers._');
    L.push('');
    var wk = 'Week of ' + TH.MONTHS[is.week.getMonth()].slice(0, 3) + ' ' + is.week.getDate();
    L.push('**Latest newsletter (' + wk + '):** ' + is.headline);
    is.thisWk.slice(0, 3).forEach(function (e) { L.push('- This week: ' + e.title + ' · ' + TH.when(e) + (e.food ? ' · free food' : '')); });
    is.nextWk.slice(0, 2).forEach(function (e) { L.push('- Next week: ' + e.title + ' · ' + TH.when(e)); });
    if (!is.thisWk.length && !is.nextWk.length) L.push('- No public events in the next two weeks.');
    L.push('_You’ll get their newsletter every Monday._');
    var chips = [];
    if (d.amount && !(rec && rec.duesPaid)) chips.push(act('Pay $' + d.amount + ' dues', 'pay dues @dues:' + c.id));
    chips.push(go('Read the newsletter', 'news'), go('Club page', 'club', c.id), go('My Day', 'plans'));
    return { role: 'bot', kind: 'c', md: L.join('\n'), chips: chips };
  }
  TS.clubBriefing = briefing;
  // after "join" is confirmed, add the briefing under the receipt
  var execute0 = B.execute;
  B.execute = function (p) {
    var before = (TA.hub().clubs || []).map(function (c) { return String(c.id); });
    var out = execute0.apply(this, arguments);
    try {
      if (p && p.aid === 'join_org') {
        var added = (TA.hub().clubs || []).filter(function (c) { return before.indexOf(String(c.id)) < 0; })[0], c = added && TH.clubById(added.id);
        if (c) out = out.concat([briefing(c)]);
      }
    } catch (e) { console.error(e); }
    return out;
  };

  function chk0() { return { block: [], warn: [], offers: [] }; }
  TA.registerHubAction({
    id: 'hub_pay_dues', title: 'Pay club dues (Venmo)', scope: 'campuslife', icon: 'card', system: 'Venmo (simulated payment)',
    detect: function (n) { if (/@dues:\d+/.test(n.raw || '')) return 0.97; return /\b(pay|venmo|send)\b.{0,30}\b(dues|membership fee|club fee)\b/.test(n.t) && !/^(how|what|when|why|do i)\b/.test(n.t) ? 0.92 : 0; },
    init: function (n) {
      var m = /@dues:(\d+)/.exec(n.raw || ''), id = m ? +m[1] : null;
      if (!id) { var c = (TH.CLUBS || []).filter(function (x) { return memberRec(x.id) && n.t.indexOf(x.name.toLowerCase()) >= 0; })[0]; if (c) id = c.id; }
      if (!id) { var owe = (hub().clubs || []).filter(function (x) { var cl = TH.clubById(x.id); return cl && !x.duesPaid && TH.clubDues(cl).amount; }); if (owe.length === 1) id = owe[0].id; }
      return { clubId: id };
    },
    next: function (s) { if (s.clubId) return null; var mine = (hub().clubs || []).filter(function (x) { return !x.duesPaid; }); return { slot: 'clubId', md: mine.length ? 'Dues for which club?' : 'You haven’t joined a club that has dues waiting. Which club?', options: mine.slice(0, 5).map(function (x) { return { label: x.name, value: '@dues:' + x.id }; }) }; },
    fill: function (name, n, s, text) { var m = /@(?:dues|club):(\d+)/.exec(text || ''); if (m) { s.clubId = +m[1]; return true; } var c = byAcronym(String(text || '').trim())[0] || (TH.CLUBS || []).find(function (x) { return x.name.toLowerCase().indexOf(String(text || '').toLowerCase().trim()) >= 0; }); if (c && String(text || '').trim().length > 1) { s.clubId = c.id; return true; } return false; },
    check: function (s) {
      var o = chk0(), c = TH.clubById(s.clubId); if (!c) { o.block.push('I couldn’t find that club.'); return o; }
      var d = TH.clubDues(c), r = memberRec(c.id);
      if (!r) { o.block.push('You’re not a member of **' + c.name + '** yet.'); o.offers.push({ label: 'Join ' + c.name.slice(0, 24), value: 'join @club:' + c.id, kind: 'action' }); return o; }
      if (!d.amount) o.block.push('**' + c.name + '** has no dues listed.');
      if (r.duesPaid) o.block.push('You already paid this semester’s dues to **' + c.name + '**.');
      o.warn.push('The amount and Venmo handle are sample values. Confirm them with the club before paying for real.');
      return o;
    },
    preview: function (s) { var c = TH.clubById(s.clubId), d = TH.clubDues(c); return { title: 'Pay $' + d.amount + ' in dues?', rows: [['Club', c.name], ['Amount', '$' + d.amount + '.00 · ' + d.per], ['To', d.handle + ' (' + d.payee + ')'], ['Note', me() + ' · ' + D().profile.email + ' · dues'], ['From', 'Your linked Venmo']], notes: ['I’ll save the receipt in your Wallet activity.'], fine: ['Simulated: no money moves and Venmo isn’t contacted.'] }; },
    run: function (s) { var c = TH.clubById(s.clubId), d = TH.clubDues(c), r = memberRec(c.id); r.duesPaid = { amount: d.amount, at: now().getTime(), to: d.handle }; return { title: 'Dues paid: ' + c.name, rows: [['Paid', '$' + d.amount + '.00 to ' + d.handle], ['Covers', 'Fall 2026'], ['Membership', 'Active, dues current']], log: 'Paid $' + d.amount + ' dues to ' + c.name + ' via Venmo (simulated)' }; }
  }, function () { return [go('My clubs', 'clubs'), go('Wallet activity', 'wallet')]; });

  // ===================================================================================================
  // EMAIL a professor / advisor / TA / RA
  // ===================================================================================================
  var WHO = /\b(professor|prof|instructor|teacher|lecturer|ta|teaching assistant|advisor|adviser|ra|resident assistant)\b/;
  var EMAILV = /^(?:please |can you |could you |hey tommy,? |tommy,? )*(?:send (?:an? )?(?:email|e-mail|message|note) to|shoot (?:an? )?(?:email|message) to|email|e-mail|message|write(?: to)?|tell|let|notify|ask|inform)\s+(?:my |the |our )?/;
  function coursesList() { return TA.State.termCourses(TA.POLICY.terms.current.code); }
  function lecturer(c) { var s = (c.sections || []).find(function (x) { return /lecture/i.test(x[1]) && x[5]; }) || (c.sections || []).find(function (x) { return x[5]; }); return s ? s[5] : ''; }
  function recipient(kind, code) {
    var p = D();
    if (kind === 'advisor') { var a = p.academics.advisor || {}; return { name: a.name || 'your academic advisor', role: a.title || 'Academic advisor', greet: (a.name || 'Advisor').split(' ')[0] }; }
    if (kind === 'ra') return { name: 'your Resident Assistant', role: 'RA · ' + ((p.housing || {}).building || 'your building'), greet: 'RA' };
    var c = coursesList().find(function (x) { return x.code === code; }); if (!c) return null;
    if (kind === 'ta') return { name: 'the ' + c.code + ' teaching team', role: 'TAs · ' + c.code, greet: c.code + ' TAs', course: c.code };
    var nm = lecturer(c);
    return { name: nm ? 'Prof. ' + nm : 'the ' + c.code + ' instructor', role: 'Instructor · ' + c.code + ' ' + c.title, greet: nm ? 'Professor ' + nm.split(' ').slice(-1)[0] : 'Professor', course: c.code };
  }
  function whoKind(t) { var m = WHO.exec(t); if (!m) return null; var w = m[1]; return /advis/.test(w) ? 'advisor' : /^(ra|resident)/.test(w) ? 'ra' : /^(ta|teaching)/.test(w) ? 'ta' : 'prof'; }
  function bodyFrom(raw) {
    var m = /\b(?:that|saying|to say|to let (?:him|her|them) know|letting (?:him|her|them) know|about|to ask(?: (?:him|her|them))?(?: if| whether| for)?|asking(?: if| whether| for)?)\s+(.+)$/i.exec(String(raw || ''));
    if (!m) { // "tell my RA my roommate is too loud": everything after the recipient
      var rest = String(raw || '').replace(/^.*?\b(professor|prof|instructor|teacher|lecturer|ta|teaching assistant|advisor|adviser|ra|resident assistant)\b[\s,:]*/i, '').replace(/[.!]+$/, '').trim();
      if (rest.split(/\s+/).length < 3 || /^(an? )?(email|message|note)$/i.test(rest)) return '';
      return cap(rest.replace(/\bi\b/g, 'I')) + '.';
    }
    var s = m[1].trim().replace(/[.!]+$/, '');
    var ask = /\b(to ask|asking)\b/i.test(m[0]);
    s = s.replace(/\bi\b/g, 'I').replace(/\bim\b/gi, 'I’m').replace(/\bi'm\b/gi, 'I’m').replace(/\bcant\b/gi, 'can’t').replace(/\bwont\b/gi, 'won’t');
    if (ask && !/^(if|whether|for)\b/i.test(s)) s = (/\b(to ask|asking)\s+(?:him |her |them )?(if|whether|for)\b/i.exec(m[0]) || [0, 0, 'if'])[2] + ' ' + s;
    return ask ? 'I wanted to ask ' + s.replace(/^I wanted to ask /, '') + '.' : cap(s) + '.';
  }
  function subjectFor(body, rc, n) {
    var t = body.toLowerCase(), day = n && n.dates && n.dates[0] ? ' on ' + TA.fmtDate(n.dates[0], { noYear: true }) : /tomorrow/.test(t) ? ' tomorrow' : /today/.test(t) ? ' today' : '';
    var topic = /\b(miss|absent|absence|can’t make|cant make|won’t be|wont be|sick|ill)\b/.test(t) ? 'Absence' + day : /\b(extension|extend|late)\b/.test(t) ? 'Extension request' : /\boffice hours?\b/.test(t) ? 'Office hours' : /\b(grade|regrade|score)\b/.test(t) ? 'Question about a grade' : /\b(meet|meeting|appointment)\b/.test(t) ? 'Meeting request' : 'Question from ' + me();
    return (rc.course ? rc.course + ': ' : '') + topic;
  }
  TA.registerHubAction({
    id: 'hub_email', title: 'Email my professor, TA, advisor or RA', scope: 'records', icon: 'send', system: 'USC email (simulated send)',
    detect: function (n) { var t = n.t; if (/^(how|what|when|why|should i|do i)\b/.test(t)) return 0; return EMAILV.test(t) && WHO.test(t.replace(EMAILV, '').split(/\b(that|saying|about|to ask|if)\b/)[0]) ? 0.95 : 0; },
    init: function (n) {
      var kind = whoKind(n.t), code = TH.acad.resolveCourse(n.raw), body = bodyFrom(n.raw);
      if (!code && (kind === 'prof' || kind === 'ta')) { // "…miss class tomorrow": the classes that day
        var day = n.dates && n.dates[0] ? n.dates[0] : /\btomorrow\b/.test(n.t) ? TA.addDays(TA.today(), 1) : /\b(today|tonight|class)\b/.test(n.t) ? TA.today() : null;
        if (day && TH.classesOn) { var cs = TH.classesOn(day).map(function (x) { return x.code; }).filter(function (v, i, a) { return a.indexOf(v) === i; }); if (cs.length === 1) code = cs[0]; else if (cs.length > 1) var opts = cs; }
      }
      return { kind: kind, code: code || null, opts: opts || null, body: body, n0: { dates: n.dates } };
    },
    next: function (s) {
      if ((s.kind === 'prof' || s.kind === 'ta') && !s.code) { var list = (s.opts || coursesList().map(function (c) { return c.code; })); return { slot: 'code', md: 'Which class?' + (s.opts ? ' You have ' + s.opts.length + ' that day.' : ''), options: list.map(function (c) { var rc = recipient(s.kind, c); return { label: c + (s.kind === 'prof' && rc ? ' · ' + rc.name : ''), value: '@course:' + c }; }).concat(s.opts && s.opts.length > 1 ? [{ label: 'All of them', value: '@course:all' }] : []) }; }
      if (!s.body) return { slot: 'body', md: 'What should the email say? Tell me in your own words and I’ll write it up.' };
      return null;
    },
    fill: function (name, n, s, text) {
      if (name === 'code') { var m = /@course:(all|[A-Z]{2,4} \d{3}[A-Z]?)/.exec(text || ''); if (m) { s.code = m[1]; return true; } var c = TH.acad.resolveCourse(text); if (c) { s.code = c; return true; } return false; }
      if (name === 'body') { var v = String(text || '').trim(); if (v.length < 4) return false; s.body = cap(v.replace(/\bi\b/g, 'I').replace(/[.!]+$/, '')) + '.'; return true; }
      return false;
    },
    check: function (s) { var o = chk0(); if (s.code !== 'all' && !recipient(s.kind, s.code)) o.block.push('I couldn’t work out who to send that to.'); o.warn.push('Sent from ' + D().profile.email + '. Replies go to your USC inbox.'); return o; },
    preview: function (s) {
      var codes = s.code === 'all' ? (s.opts || []) : [s.code], rcs = codes.map(function (c) { return recipient(s.kind, c); }), rc = rcs[0];
      var msg = 'Dear ' + (rcs.length > 1 ? 'Professor' : rc.greet) + ', ' + s.body + ' Thank you, ' + me() + ' (USC ID ' + D().profile.uscid + ')';
      return { title: 'Send this email?', rows: [['To', rcs.map(function (r) { return r.name; }).join('; ')], ['From', me() + ' · ' + D().profile.email], ['Subject', subjectFor(s.body, rcs.length > 1 ? {} : rc, s.n0)], ['Message', msg]], notes: ['Say “change it to …” to cancel and reword, or confirm to send.'], fine: ['Simulated: no email leaves this device.'] };
    },
    run: function (s) {
      var codes = s.code === 'all' ? (s.opts || []) : [s.code], rcs = codes.map(function (c) { return recipient(s.kind, c); }), subj = subjectFor(s.body, rcs.length > 1 ? {} : rcs[0], s.n0);
      rcs.forEach(function (r) { hub().outbox.unshift({ to: r.name, subject: subj, body: s.body, at: now().getTime() }); });
      return { title: 'Email sent to ' + rcs.map(function (r) { return r.name; }).join(' and '), rows: [['Subject', subj], ['Sent', TA.fmtDateTime(now())], ['Copy', 'In your USC Sent folder']], log: 'Emailed ' + rcs.map(function (r) { return r.name; }).join(', ') + ': ' + subj + ' (simulated)' };
    }
  }, function () { return [go('My Day', 'plans')]; });

  // ===================================================================================================
  // THE CATCH-ALL: any other "do this for me" becomes a request to the right office
  // ===================================================================================================
  var OFFICES = [
    ['rec', 'USC Recreational Sports', /\b(gym|lyon|locker|intramural|tennis|court|pool|swim|racquetball|basketball|volleyball|soccer|fitness class|yoga|climbing|rec sports?|workout|personal train\w*|field|pickleball|squash)\b/, 'recsports.usc.edu', '1 business day'],
    ['tickets', 'USC Ticket Office', /\b(tickets?|season pass|student section|football game|basketball game|galen|coliseum)\b/, 'usctrojans.com/tickets', 'right away'],
    ['housing', 'USC Housing', /\b(housing|dorm|room change|roommate|ra\b|resident|lockout|key|move ?(in|out)|apartment|lease|mattress|sublet|lounge)\b/, 'housing.usc.edu', '2 business days'],
    ['dining', 'USC Hospitality', /\b(dining|meal|swipe|catering|cater|food allerg\w*|dietitian|menu|dining dollars)\b/, 'hospitality.usc.edu', '1 business day'],
    ['health', 'USC Student Health', /\b(health|doctor|nurse|vaccine|flu|covid|test|therapy|therapist|counsel\w*|prescription|pharmacy|std|sti|physical|immuniz\w*|x-?ray|dental|vision|insurance waiver)\b/, 'studenthealth.usc.edu', 'same day'],
    ['registrar', 'Office of the Registrar', /\b(transcript|enrollment|verification|withdraw\w*|petition|diploma|degree|graduation application|grade option|registration|leave of absence|residency|name change|records?)\b/, 'arr.usc.edu', '3–5 business days'],
    ['finaid', 'USC Financial Aid', /\b(financial aid|fafsa|scholarship|loan|grant|work[- ]study|aid appeal|css profile)\b/, 'financialaid.usc.edu', '5–7 business days'],
    ['bursar', 'Student Financial Services', /\b(tuition|bill|refund|payment plan|fee|1098|late fee|epay|charge)\b/, 'sfs.usc.edu', '2–3 business days'],
    ['advising', 'your academic advisor', /\b(major|minor|advis\w*|degree plan|course plan|d-?clearance|overload|prerequisite|waiver|stars report|study abroad|double major)\b/, 'undergrad.usc.edu', '2 business days'],
    ['its', 'USC ITS Service Desk', /\b(wifi|wi-fi|password|netid|duo|email account|software|laptop|printing|print credit|printer|vpn|zoom|brightspace|blackboard|computer)\b/, 'itservices.usc.edu', 'a few hours'],
    ['library', 'USC Libraries', /\b(library|librar\w*|book|interlibrary|study room|carrel|laptop loan|course reserve|scan)\b/, 'libraries.usc.edu', '1 business day'],
    ['transport', 'USC Transportation', /\b(parking|permit|citation|shuttle|bus|bike|bicycle|scooter|zipcar|u-?pass|tap card|ev charg\w*|carpool)\b/, 'transnet.usc.edu', '1–2 business days'],
    ['card', 'USCard Services', /\b(uscard|usc card|student id|id card|card reader|door access|discretionary)\b/, 'mycard.usc.edu', '1 business day'],
    ['career', 'USC Career Center', /\b(career|resume|résumé|internship|job|interview|handshake|recruit\w*|headshot|linkedin|cover letter)\b/, 'careers.usc.edu', '1–2 business days'],
    ['bookstore', 'USC Bookstore', /\b(bookstore|textbook|gown|regalia|cap and gown|merch|sweatshirt|hoodie|apparel|course materials?)\b/, 'uscbookstore.com', '1 business day'],
    ['mail', 'USC Mail Stop', /\b(package|mail|ship|shipping|parcel|po box|stamp|fedex|ups)\b/, 'businessservices.usc.edu', 'same day'],
    ['osas', 'Office of Student Accessibility Services', /\b(accommodat\w*|osas|accessib\w*|extended time|note ?taker|disability)\b/, 'osas.usc.edu', '3–5 business days'],
    ['dps', 'USC Department of Public Safety', /\b(dps|lost and found|lost my|stolen|theft|escort|safety|noise complaint|suspicious)\b/, 'dps.usc.edu', 'right away'],
    ['events', 'Trojan Event Services', /\b(event space|book a room for|reserve (a )?(room|space|quad|lawn)|table on trousdale|tabling|banner|venue|av equipment)\b/, 'trojaneventservices.usc.edu', '2–3 business days'],
    ['intl', 'Office of International Services', /\b(visa|i-?20|opt|cpt|sevis|travel signature|international student)\b/, 'ois.usc.edu', '5 business days'],
    ['campus', 'Campus Activities', /\b(club|student org|organization|volunteer|leadership|greek|fraternity|sorority|rso)\b/, 'campusactivities.usc.edu', '2 business days'],
  ];
  var FALLBACK = ['ask', 'askUSC (student services help desk)', null, 'ask.usc.edu', '1–2 business days'];
  function officeFor(t) { for (var i = 0; i < OFFICES.length; i++) if (OFFICES[i][2].test(t)) return OFFICES[i]; return FALLBACK; }
  var CMDV = /^(?:please |pls |can you |could you |would you |will you |hey tommy,? |tommy,? |i need you to |i want you to |i need to |i want to |id like to |i would like to |help me |go ahead and )*(book|reserve|schedule|sign me up|sign up|register me|enroll me|enroll|apply|request|order|buy|purchase|get me|get|grab|rent|renew|cancel|change|update|submit|file|report|pay|add|drop|switch|send|ship|print|declare|replace|extend|appeal|reset|activate|set up|setup|put|make|arrange|claim|pick up|check out|checkout|borrow|return|transfer|upgrade|waive|dispute|fix|unlock|open|close|start|stop|sign|notify|tell|ask|remove|swap|move|donate|nominate|rsvp|invite|upload|download|loan|lend)\b/;
  function isCommand(n) {
    var t = n.t || ''; if (!CMDV.test(t)) return false;
    if (/^(tell me|show me|ask me|get directions|open the map|start over|stop$|make sure)\b/.test(t)) return false;
    if (/^(?:can|could|would|will) (?:i|we|students?)\b/.test(t)) return false;
    return t.split(' ').length >= 2;
  }
  TS.isCommand = isCommand;
  var BOOKV = /\b(book|reserve|schedule|rent|appointment|sign me up|sign up|court|room|session|slot|test|class|lesson|pickup|pick up)\b/, PAYV = /\b(buy|purchase|order|pay|rent|ticket|permit|add \$?\d+|credit|fee)\b/;
  function tidy(raw) { return cap(String(raw || '').replace(/^(please |pls |can you |could you |would you |will you |hey tommy,? |tommy,? |i need you to |i want you to |go ahead and |help me )+/i, '').replace(/\s+(for me|please|pls|thanks|thank you)[.!?]*$/i, '').replace(/[.!?]+$/, '').replace(/\bmy\b/g, 'my').slice(0, 140)); }
  function whenText(n) {
    var d = n.dates && n.dates[0], tm = n.times && n.times[0], out = [];
    if (d) out.push(TA.fmtDate(d, { noYear: true })); else if (/\btonight\b/.test(n.t)) out.push('Tonight'); else if (/\btoday\b/.test(n.t)) out.push('Today');
    if (tm) out.push(TA.fmtTime(String(tm.h).padStart(2, '0') + ':' + String(tm.m || 0).padStart(2, '0'))); else if (n.dayPart) out.push(n.dayPart);
    return out.join(' at ').replace(' at morning', ' morning').replace(' at afternoon', ' afternoon').replace(' at evening', ' evening');
  }
  TA.registerHubAction({
    id: 'hub_request', title: 'Do anything else for me: send a request to the right USC office', scope: 'campuslife', icon: 'send', system: 'USC office request (simulated)',
    detect: function (n) { return /^@req\b/.test(n.raw || '') ? 0.99 : 0; },          // started by Tommy Script, never by keyword
    init: function (n) {
      // a message typed while the confirm card is open is extra detail for the office, not a new request
      if (B.pending && B.pending.aid === 'hub_request' && B.pending.slots && B.pending.slots.task && !/^@req\b/.test(n.raw || '')) { var keep = Object.assign({}, B.pending.slots); keep.note = [keep.note, cap(String(n.raw || '').slice(0, 200))].filter(Boolean).join('; '); keep.when = keep.when || whenText(n); return keep; }
      var raw = String(n.raw || '').replace(/^@req\s*/, ''), n2 = raw === n.raw ? n : TA.NLU.parse(raw), o = officeFor(n2.t);
      return { text: raw, task: tidy(raw), office: o[0], when: whenText(n2), needWhen: BOOKV.test(n2.t), pay: PAYV.test(n2.t), src: TS._reqSrc || null };
    },
    next: function (s) {
      if (s.needWhen && !s.when) return { slot: 'when', md: 'When works for you?', options: [{ label: 'As soon as possible', value: 'As soon as possible' }, { label: 'Tomorrow', value: 'Tomorrow' }, { label: 'This weekend', value: 'This weekend' }, { label: 'Next week', value: 'Next week' }] };
      if (!s.asked) return { slot: 'note', md: 'Anything the office should know? (purpose, who it’s for, a preference)', options: [{ label: 'No, send it as is', value: '@skip' }] };
      return null;
    },
    fill: function (name, n, s, text) {
      var v = String(text || '').trim();
      if (name === 'when') { if (!v) return false; s.when = whenText(n) || cap(v.slice(0, 60)); return true; }
      if (name === 'note') { s.asked = true; if (!/^@skip|^(no|nope|nothing|skip|none|n\/a|send it)\b/i.test(v)) s.note = cap(v.slice(0, 200)); return true; }
      return false;
    },
    check: function (s) { var o = chk0(), of = OFFICES.find(function (x) { return x[0] === s.office; }) || FALLBACK; o.warn.push('This goes to ' + of[1] + ' as a request. They confirm by email, usually within ' + of[4] + '.'); if (s.pay) o.warn.push('Nothing is charged until the office confirms the amount with you.'); return o; },
    preview: function (s) {
      var of = OFFICES.find(function (x) { return x[0] === s.office; }) || FALLBACK, p = D().profile;
      var rows = [['Request', s.task], ['Goes to', of[1]]]; if (s.when) rows.push(['When', s.when]);
      rows.push(['From', me() + ' · ' + p.email + ' · USC ID ' + p.uscid]); if (s.pay) rows.push(['Payment', 'USCard discretionary, or the card on file']);
      return { title: 'Send this request?', rows: rows, notes: ['I fill in your name, USC ID and contact details from your account.'], fine: ['Simulated: no USC office is contacted.'], sources: s.src ? [s.src] : [{ url: 'https://' + of[3], title: of[1] }] };
    },
    run: function (s) {
      var of = OFFICES.find(function (x) { return x[0] === s.office; }) || FALLBACK;
      hub().requests.unshift({ id: TA.uid(), task: s.task, office: of[1], when: s.when || null, note: s.note || null, status: 'Submitted', at: now().getTime() });
      return { title: 'Request sent: ' + s.task, rows: [['Sent to', of[1]], ['Status', 'Submitted'], ['Reply expected', 'Within ' + of[4] + ', to ' + D().profile.email]].concat(s.when ? [['Requested for', s.when]] : [], [['Their site', of[3]]]), log: 'Sent a request to ' + of[1] + ': ' + s.task + ' (simulated)' };
    }
  }, function () { return [go('Wallet activity', 'wallet'), { label: 'What’s the status?', value: 'what is the status of my requests', kind: '' }]; });

  TS.cmds['requests.list'] = {
    name: 'requests.list', about: 'List the requests and emails Tommy has sent for the student, with their status.', args: [],
    match: function (t) { return /\b(status of my requests?|my requests?|what (have|did) you (sent?|submit\w*|done|do) for me|pending requests?|my sent emails?|did (it|that|they) (go through|reply|respond))\b/.test(t) ? {} : null; },
    run: function () {
      var R = hub().requests, O = hub().outbox;
      if (!R.length && !O.length) return [{ role: 'bot', kind: 'c', md: 'I haven’t sent any requests or emails for you yet. Ask me to do something, like “reserve a tennis court tomorrow at 5” or “email my professor that I’ll miss class”.', chips: [] }];
      var L = R.slice(0, 8).map(function (r) { return '- **' + r.task + '** → ' + r.office + ' · ' + r.status + ' ' + TA.fmtDate(new Date(r.at), { noYear: true }) + (r.when ? ' · for ' + r.when : ''); });
      var E = O.slice(0, 5).map(function (e) { return '- Email to **' + e.to + '**: ' + e.subject + ' · sent ' + TA.fmtDate(new Date(e.at), { noYear: true }); });
      return [{ role: 'bot', kind: 'c', md: (L.length ? 'Requests I’ve sent for you:\n' + L.join('\n') : '') + (E.length ? (L.length ? '\n\n' : '') + 'Emails:\n' + E.join('\n') : '') + '\n\n_All simulated on the demo account._', chips: [go('Wallet activity', 'wallet')] }];
    }
  };

  // ===================================================================================================
  // PART 6: "Add these to My Day" for Tommy's plan (js/planner.js). Confirm card first; Brain.execute snapshots for Undo.
  // ===================================================================================================
  var ADD_PLAN = /^(?:please |ok |okay |yes,? |sure,? |great,? |tommy,? )*(?:add|put|save|book|schedule|lock in)\s+(?:all\s+(?:of\s+)?)?(?:these|them|it|this|that|those|the plan|this plan|that plan|my plan|your plan|the picks|those picks|everything|all of (?:it|them)|it all)(?:\s+all)?\s+(?:to|on|in|into)\s+my\s+(?:day|calendar|schedule|plans?)\b/;
  function planKey(n) { var m = /@plan:(\d{4}-\d{2}-\d{2})(?::(evening|afternoon|morning))?/.exec(n.raw || ''); if (m) return { key: m[1], focus: m[2] || null }; var l = TH.plan && TH.plan.last(); return l ? { key: l.key, focus: l.focus } : null; }
  TA.registerHubAction({
    id: 'hub_plan_add', title: 'Add Tommy’s day plan (meals, study blocks, events) to My Day', scope: 'campuslife', icon: 'calendar', system: 'Trojan Hub My Day (Tommy’s plan)',
    detect: function (n) {
      if (!TH.plan) return 0;
      if (/@plan:\d{4}-\d{2}-\d{2}/.test(n.raw || '')) return 0.98;
      return ADD_PLAN.test(n.t || '') && TH.plan.last() ? 0.95 : 0;
    },
    init: function (n) {
      var pk = planKey(n); if (!pk) return { key: null, blocks: [] };
      var blocks = []; try { blocks = TH.plan.addable(pk.key, pk.focus); } catch (e) { blocks = []; }
      return { key: pk.key, focus: pk.focus, blocks: blocks };
    },
    next: function () { return null; }, fill: function () { return false; },
    check: function (s) {
      var o = chk0();
      if (!s.key) { o.block.push('I don’t have a plan to add yet. Say “plan my day” first.'); o.offers.push({ label: 'Plan my day', value: 'plan my day', kind: '' }); return o; }
      var r = TH.act.check.addPlan(s.key, s.blocks); o.block = r.block.slice(); o.warn = r.warn.slice();
      if (!s.blocks.length) o.offers.push({ label: 'Open the plan', value: '@go:plan:' + s.key, kind: '' });
      return o;
    },
    preview: function (s) {
      var d = TH.parseKey(s.key), rows = s.blocks.slice(0, 8).map(function (b) { return [TH.fmtMin(b.start), b.title + (b.eventId ? ' · RSVP' : b.placeLabel ? ' · ' + b.placeLabel : '')]; });
      if (s.blocks.length > 8) rows.push(['…', (s.blocks.length - 8) + ' more']);
      return { title: 'Add ' + (s.blocks.length === 1 ? 'this' : 'these ' + s.blocks.length) + ' to My Day · ' + TH.fmtDate(d), rows: rows, notes: ['Events are RSVP’d and the rest show on My Day as Tommy’s plan. You can remove any of them later.', 'Say “undo” right after to take it all back.'], fine: ['Simulated on the demo account: nothing is booked with USC or EngageSC. Walk times and lines are estimates.'] };
    },
    run: function (s) { return TH.act.addPlan(s.key, s.blocks); }
  }, function () { var l = TH.plan && TH.plan.last(); return [go('Open My Day', 'plans'), go('Open the plan', 'plan', l ? l.key : undefined), { label: 'Plan tomorrow', value: 'plan tomorrow', kind: '' }]; });

  // ---------- wire into the pipeline ----------
  function hasCard(out) { return (out || []).some(function (m) { return m && m.card; }); }
  function isMiss(out) { return !out || !out.length || out.some(function (m) { return m && (m.kind === 'none' || m.kind === 'off'); }); }
  var handle0 = TS.handle;
  TS.handle = async function (text) {
    var pBefore = B.pending, t2 = /^@/.test(text) ? text : expandClub(text);
    var out = await handle0.call(TS, t2);
    try {
      if (pBefore || B.pending || hasCard(out) || /^@/.test(text)) return out;
      var n = TA.NLU.parse(text);
      if (!isCommand(n) || n.yes || n.no || n.cancel || n.undo || n.greet) return out;
      var spec = TA.Actions.detect(n);                                                             // a specific action looked at it and said no (hours, limits…): its answer stands
      if (spec && spec.score >= 0.8 && spec.action.id !== 'hub_request') return out;
      if (/\b(I can’t|I can't|can’t request|isn’t running|is closed|already)\b/.test(JSON.stringify(out || [])) && !/I can’t send emails/.test(JSON.stringify(out || []))) return out;
      var first = (out || []).find(function (m) { return m && m.role === 'bot'; });
      if (first && first.script && !/^ask\b/.test(first.script.line)) return out;                 // a read command or action already handled it
      if ((out || []).some(function (m) { return m && m.priority; }) || /213-740-(4321|9355|2500)|\b988\b/.test(JSON.stringify(out || []))) return out; // safety answers stand alone
      // keep USC's own explanation (if there was one) as background, then act
      var info = isMiss(out) ? [] : out.map(function (m) { var c = Object.assign({}, m); delete c.chips; delete c.script; if (c.md) c.md = c.md.replace(/^I can’t send emails for you\.[^\n]*\n?/, ''); return c; }).filter(function (m) { return m.md || m.card; });
      var src = null; (out || []).forEach(function (m) { if (!src && m && m.sources && m.sources[0]) src = m.sources[0]; });
      TS._reqSrc = isMiss(out) ? null : src;
      var started = B.start(TA.Actions.get('hub_request'), TA.NLU.parse('@req ' + text));
      if (B.persist) B.persist();
      var of = officeFor(n.t);
      if (started[0]) { started[0].md = (info.length ? 'That’s how it works at USC. I can take care of it with **' + of[1] + '**. ' : 'I can take care of that with **' + of[1] + '**. ') + (started[0].md || ''); started[0].script = { line: 'do action=hub_request office=' + of[0] + ' request="' + tidy(text).replace(/"/g, '\\"') + '"', via: (first && first.script && first.script.via) || 'script' }; }
      return info.concat(started);
    } catch (e) { console.error(e); return out; }
  };
})();
