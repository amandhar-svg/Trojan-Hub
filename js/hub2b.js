/* js/hub2b.js — Trojan Hub, ORGANIZER side (student clubs and USC offices). Everything here is sample data on
 * the demo account: member rosters, dues, budgets and RSVP tallies are generated, not real club records.
 * Screens: org (dashboard), orgreq (event requests), orgmem (members + dues), orgtools, orgnews (newsletter),
 * orgbudget (AI budget summary), orgspace (book classrooms / library rooms), orginsights (attendee + feedback
 * summaries), orgchat, orginbox (USC office: problem reports + flagged Tommy questions).
 * The app opens on the student side; the tab bar swaps when a route starts with "org". Load after hub2a.js. */
(function (TH) {
  'use strict';
  const { askTommy, similarClubs, X, save, uid, hash, ago, sim, top, row, note, ai, primaryClub, NAMES, PF, member, STAT, RC, clubName, sharedLine } = TH.x;
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c), money = n => '$' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hub = () => TH.H();

  // ---------- which organizations the demo student runs ----------
  function orgs() {
    const p = primaryClub(), out = [];
    if (p) out.push({ id: String(p.id), name: p.name, kind: 'club', role: 'Treasurer', club: p });
    out.push({ id: 'usc', name: 'USC Campus Activities', kind: 'usc', role: 'Staff' });
    return out;
  }
  const cur = () => { const l = orgs(); return l.find(o => o.id === TH.state.xorg) || l[0]; };
  function O(org) {
    const x = X(), o = x.orgs[org.id] || (x.orgs[org.id] = {});
    if (typeof o.dues !== 'number') o.dues = org.club ? ((TH.clubDues ? TH.clubDues(org.club).amount : 0) || 20) : 0;
    ['sent', 'bookings', 'events'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
    o.paid = o.paid || {}; o.via = o.via || {};
    // Part 6: organizer-managed roster (all simulated, on the demo account): members the treasurer added or removed,
    // and when / how much each member paid.
    ['paidAt', 'paidAmt', 'role'].forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; });
    if (!Array.isArray(o.added)) o.added = [];
    if (!Array.isArray(o.removed)) o.removed = [];
    if (!o.venmo) o.venmo = { on: true, handle: (org.club && TH.clubDues ? TH.clubDues(org.club).handle : '') || '@club-treasurer', at: Date.now() - 7 * 60000 };
    return o;
  }
  // Members: you (if you joined), members you added (newest first), then the generated sample roster minus anyone removed.
  // Each: { name, year, role, email?, paid, via, paidAt (ms, demo clock), amt, you?, added?, sample? }
  // the generated sample roster's names for this org (the same list roster() draws from)
  function sampleNames(org) { const h = hash(org.id), n = 12 + h % 7, out = []; for (let i = 0; i < n; i++) out.push(NAMES[(h + i * 3) % NAMES.length]); return out; }
  function roster(org) {
    const o = O(org), h = hash(org.id), n = 12 + h % 7, out = [], gone = new Set(o.removed), clock = TH.clock.now().getTime();
    const has = nm => out.some(m => m.name.toLowerCase() === String(nm).toLowerCase());
    const me = member(org.id), myName = TH.student().full + ' (you)';
    if (me) out.push({ name: myName, year: TH.student().standing, role: org.role || 'Member', paid: !!me.duesPaid, you: true, via: me.duesVia || 'Trojan Hub', paidAt: me.duesPaid ? Math.min(me.duesAt || clock, clock) : null, amt: me.duesPaid ? (o.paidAmt[myName] != null ? o.paidAmt[myName] : o.dues) : 0 });
    o.added.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach(a => {
      if (has(a.name)) return; const paid = !!o.paid[a.name];
      out.push({ name: a.name, email: a.email, year: a.year || '', role: o.role[a.name] || a.role || 'Member', added: true, at: a.at, paid, via: o.via[a.name] || 'marked by you', paidAt: paid ? (o.paidAt[a.name] || a.at || clock) : null, amt: paid ? (o.paidAmt[a.name] != null ? o.paidAmt[a.name] : o.dues) : 0 });
    });
    for (let i = 0; i < n; i++) {
      const name = NAMES[(h + i * 3) % NAMES.length]; if (has(name) || gone.has(name)) continue;
      const base = hash(name + org.id) % 3 !== 0, paid = o.paid[name] != null ? o.paid[name] : base;
      out.push({ name, year: ['First-year', 'Sophomore', 'Junior', 'Senior'][hash(name) % 4], role: o.role[name] || (i === 0 ? 'President' : i === 1 ? 'Vice President' : 'Member'), sample: true, paid, via: (o.via && o.via[name]) || (hash(name + 'v') % 3 ? 'Venmo' : 'Trojan Hub'),
        paidAt: paid ? (o.paidAt[name] || clock - (3 + hash(name + 'd' + org.id) % 55) * 864e5) : null, amt: paid ? (o.paidAmt[name] != null ? o.paidAmt[name] : o.dues) : 0 });
    }
    return out;
  }
  // collected = what paid members actually paid; outstanding = current dues × members who haven't paid
  function duesTotals(org, ms) {
    const o = O(org); ms = ms || roster(org);
    const paid = ms.filter(m => m.paid), un = ms.filter(m => !m.paid);
    return { n: ms.length, paid: paid.length, unpaid: un.length, collected: paid.reduce((s, m) => s + (+m.amt || 0), 0), outstanding: un.length * o.dues, un };
  }
  const reqsFor = org => X().evreqs.filter(r => org.kind === 'usc' || TH.x.reqFor(r, org.id)).sort((a, b) => b.votes - a.votes);
  const upcoming = org => org.club ? (TH.CLUB_EVENTS || []).filter(e => String(e.orgId) === org.id && e.start && TH.laDate(e.end || e.start) >= TH.clock.now()).sort((a, b) => TH.laDate(a.start) - TH.laDate(b.start)) : [];
  const header = org => `<div class="x-modebar">${icon('club')}<span class="x-mb-main"><b>Organizer side · ${esc(org.role)}</b><label class="sr" for="x-org">Organization</label><select id="x-org">${orgs().map(o => `<option value="${esc(o.id)}" ${o.id === org.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></span><button class="btn sm gold" data-go="home" style="flex:none">${icon('swap')} Student</button></div>`;
  function bindHeader(host) { const s = $('#x-org', host); if (s) s.onchange = () => { TH.state.xorg = s.value; TH.go(cur().kind === 'usc' && TH.state.route === 'orgmem' ? 'org' : TH.state.route); TH.render(); }; }
  const tile = (n, l, go) => `<button class="x-tile" ${go ? `data-go="${go}"` : ''}><span class="n">${n}</span><span class="l">${l}</span></button>`;
  const scr = (title, org, body, back) => `<div class="screen">${back ? top(title) : TH.ui.topbar(title, false)}<div class="pad screen-body stack">${header(org)}${body}</div></div>`;

  // =====================================================================
  // DASHBOARD
  // =====================================================================
  TH.screens.org = {
    render() {
      const org = cur(), x = X(), o = O(org), rq = reqsFor(org).filter(r => r.status === 'open');
      if (org.kind === 'usc') {
        const reps = [...x.reports, ...SAMPLE_REPORTS], openR = reps.filter(r => r.status < 3).length, gaps = x.gaps.filter(g => !g.answer);
        const types = {}; x.evreqs.forEach(r => { types[r.type] = (types[r.type] || 0) + r.votes; });
        const mx = Math.max(1, ...Object.values(types));
        return scr('Dashboard', org, `
          <div class="x-tiles">${tile(openR, 'Open problem reports', 'orginbox')}${tile(gaps.length, 'Tommy questions to answer', 'orginbox')}${tile(x.evreqs.length, 'Event requests campus-wide', 'orgreq')}${tile(x.evreqs.reduce((s, r) => s + r.votes, 0), 'Votes on those requests', 'orgreq')}</div>
          <div class="section"><div class="section-head"><h2>What students are asking for</h2><button data-go="orgreq">All requests</button></div>
            <div class="card stack" style="gap:8px">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, v]) => `<div class="x-bar"><span>${esc(t)}</span><span class="t"><i style="width:${Math.round(v / mx * 100)}%"></i></span><span>${v} votes</span></div>`).join('')}</div></div>
          <div class="rows">${row('data-go="orgtommy"', 'sparkle', 'Ask Tommy', 'What students want by major or career goal, open reports', 'var(--gold-ink)')}${row('data-go="orginbox"', 'flag', 'Reports and flagged questions', `${openR} report${openR === 1 ? '' : 's'} open · ${gaps.length} question${gaps.length === 1 ? '' : 's'} waiting`, 'var(--c-safety)')}${row('data-go="orgspace"', 'building', 'Space requests', 'Classrooms, library rooms, event spaces', 'var(--c-study)')}</div>
          ${sim('Staff view on the demo account. Student data shown here is what students chose to send: requests, reports and votes.')}`);
      }
      const ms = roster(org), tt = duesTotals(org, ms), paid = tt.paid, ev = upcoming(org).slice(0, 4), mine = o.events, bk = o.bookings;
      const cal = [...ev.map(e => ({ t: TH.laDate(e.start), title: e.title, sub: TH.when(e), attr: `data-event="${esc(e.id)}"`, pill: '' })), ...mine.map(e => ({ t: TH.laDate(e.start), title: e.title, sub: `${TH.fmtDate(TH.laDate(e.start))} · ${TH.fmtTime(TH.laDate(e.start))} · ${e.where || 'place to be set'}`, attr: `data-event="x-${esc(e.id)}"`, pill: `<span class="pill gold">Requested</span>` }))].sort((a, b) => a.t - b.t);
      return scr('Dashboard', org, `
        <div class="x-tiles">${tile(ms.length, 'Members', 'orgmem')}${tile(`${paid}/${ms.length}`, `Dues paid · ${money(tt.collected)} collected`, 'orgmem')}${tile(rq.length, 'Open event requests', 'orgreq')}${tile(rq.reduce((s, r) => s + r.votes, 0), 'Student votes on them', 'orgreq')}</div>
        <div class="section"><div class="section-head"><h2>Club calendar</h2><div style="display:flex;gap:6px;"><button class="btn line sm" id="org-create-ev">+ Create event</button><button data-go="orgspace">Book a space</button></div></div>
          ${cal.length ? `<div class="rows">${cal.slice(0, 6).map(c => row(c.attr, 'calendar', esc(c.title), esc(c.sub), 'var(--c-fitness)', c.pill || undefined)).join('')}</div>` : `<p class="muted">Nothing scheduled. Students have ${rq.length} open request${rq.length === 1 ? '' : 's'} you could turn into an event.</p>`}
          ${bk.length ? `<span class="muted tiny">${bk.filter(b => b.status === 'pending').length} space request${bk.filter(b => b.status === 'pending').length === 1 ? '' : 's'} waiting for approval.</span>` : ''}</div>
        ${rq[0] ? `<button class="card promo" data-go="orgreq" style="display:flex;gap:12px;align-items:center;text-align:left"><span class="qi">${icon('megaphone')}</span><span style="flex:1"><b>Most wanted: ${esc(rq[0].title)}</b><br><span class="muted" style="font-size:13px">${rq[0].votes} students asked for it. Schedule it and they get first RSVP.</span></span>${icon('chev')}</button>` : ''}
        <div class="rows">
          ${row('data-go="orgtommy"', 'sparkle', 'Ask Tommy', 'What members want, who has paid, what to order, USC rules for clubs', 'var(--gold-ink)')}
          ${row('data-go="orgnews"', 'mail', 'Send a newsletter', 'Posts in the app and emails members through Gmail', 'var(--cardinal)')}
          ${row('data-go="orgbudget"', 'dollar', 'AI budget summary', 'What past semesters say about this one', 'var(--ok)')}
          ${row('data-go="orginsights"', 'sparkle', 'Attendee insights', 'Snacks, dietary needs, goals and feedback, summarized by Tommy', 'var(--gold-ink)')}
        </div>
        ${sim(`You run ${esc(org.name)} in this demo. Members, dues and budget figures are generated samples, not the club’s real records.`)}`);
    },
    mount(host) {
      bindHeader(host);
      const btn = $("#org-create-ev", host);
      if (btn) btn.onclick = () => createClubEvent(cur());
    },
  };

  // =====================================================================
  // EVENT REQUESTS
  // =====================================================================
  // ---------- who is asking: sample breakdown of each request's voters (the demo student's own vote is real) ----------
  const MAJORS = ['Computer Science', 'Business Administration', 'Engineering', 'Biological Sciences', 'Communication', 'Economics', 'Cinematic Arts', 'Psychology'];
  const GOALS = PF.find(f => f[0] === 'goals')[2];
  const BIAS = { Career: { m: [0, 1, 2, 5], g: [0, 1, 2] }, Workshop: { m: [0, 1, 5], g: [2, 10, 0] }, Service: { m: [3, 7, 4], g: [9, 3] }, Social: { m: [4, 6, 7], g: [5, 8] }, Speaker: { m: [3, 5, 7], g: [6, 4, 3] } };
  function split(total, keys, seedKey, boost) {
    const w = keys.map((k, i) => 1 + hash(seedKey + k) % 5 + (boost.includes(i) ? 6 : 0)), sw = w.reduce((a, b) => a + b, 0), raw = w.map(v => total * v / sw), out = raw.map(Math.floor);
    raw.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).slice(0, total - out.reduce((a, b) => a + b, 0)).forEach(([, i]) => out[i]++);
    const o = {}; keys.forEach((k, i) => { if (out[i]) o[k] = out[i]; }); return o;
  }
  const myMajor = () => { const m = TH.student().major || ''; return MAJORS.find(v => m.startsWith(v)) || m.replace(/\s*\(.*\)$/, ''); };
  function bd(r, org) {
    const mine = r.mine || !!X().votes[r.id], base = Math.max(0, r.votes - (mine ? 1 : 0)), b = BIAS[r.type] || { m: [], g: [] }, club = org.kind !== 'usc', own = r.clubIds ? r.clubIds.map(String).includes(org.id) : String(r.clubId) === org.id;
    let members = club ? Math.min(base, Math.round(base * ((own ? 0.4 : 0.1) + (hash(r.id + 'm' + org.id) % 20) / 100))) : 0;
    const similar = club ? Math.min(base - members, Math.round(base * (0.15 + (hash(r.id + 's' + org.id) % 25) / 100))) : 0;
    const majors = split(base, MAJORS, r.id + 'mj', b.m), goals = split(Math.round(base * 0.65), GOALS, r.id + 'g', b.g);
    if (mine) { const mm = myMajor(), p = X().profile; if (mm) majors[mm] = (majors[mm] || 0) + 1; if (p.shareGoals) p.goals.forEach(g => { goals[g] = (goals[g] || 0) + 1; }); if (club && member(org.id)) members++; }
    return { members, similar, majors, goals };
  }
  const RQ = { scope: 'club', f: 'all', major: null, goal: null };
  const scopeOf = org => org.kind === 'usc' ? 'usc' : RQ.scope;
  const cnt = (r, org, F) => { const b = bd(r, org); return F.f === 'members' ? b.members : F.f === 'similar' ? b.similar : F.f === 'major' ? (b.majors[F.major] || 0) : F.f === 'goal' ? (b.goals[F.goal] || 0) : r.votes; };
  function ranked(org, F) {
    const sc = org.kind === 'usc' ? 'usc' : F.scope;
    return X().evreqs.filter(r => sc === 'usc' || TH.x.reqFor(r, org.id)).map(r => ({ r, n: cnt(r, org, F) })).filter(o => o.n > 0).sort((a, b) => b.n - a.n || b.r.votes - a.r.votes);
  }
  const whoLabel = (org, F) => F.f === 'members' ? `members of ${org.name}` : F.f === 'similar' ? `members of clubs like ${org.name}` : F.f === 'major' ? `${F.major} majors` : F.f === 'goal' ? `students aiming for ${F.goal.toLowerCase()}` : 'students';
  function reqSummary(org, F) {
    const list = ranked(org, F).filter(o => o.r.status === 'open'), who = whoLabel(org, F), where = (org.kind === 'usc' || F.scope === 'usc') ? 'Across all of USC' : `For ${org.name}`;
    if (!list.length) return `${where}: no open requests from ${who} yet.`;
    const byType = {}, byWhen = {}; list.forEach(o => { byType[o.r.type] = (byType[o.r.type] || 0) + o.n; byWhen[o.r.when] = (byWhen[o.r.when] || 0) + o.n; });
    const tt = Object.entries(byType).sort((a, b) => b[1] - a[1]), tw = Object.entries(byWhen).sort((a, b) => b[1] - a[1])[0], total = list.reduce((s, o) => s + o.n, 0), t0 = list[0];
    const tip = F.f === 'members' ? 'Your own members want it, so it is the safest first event to schedule.' : F.f === 'similar' ? 'Members of similar clubs want it too, so consider co-hosting to split the cost and double the turnout.' : F.f === 'major' ? `Hosting it is a direct way to reach ${F.major} majors; advertise it in their department channels.` : F.f === 'goal' ? `It fits students working toward ${F.goal.toLowerCase()}, so bring an alum or recruiter from that field.` : 'Scheduling it first reaches the most students.';
    return `${where}: ${total} vote${total === 1 ? '' : 's'} from ${who} across ${list.length} idea${list.length === 1 ? '' : 's'}. The most wanted is “${t0.r.title}” (${t0.n}${F.f === 'all' ? '' : ' of ' + t0.r.votes} votes). ${tt[0][0]} events lead with ${Math.round(tt[0][1] / total * 100)}%${tt[1] ? `, then ${tt[1][0].toLowerCase()}` : ''}, and most of them prefer a ${tw[0].toLowerCase()}. ${tip}`;
  }
  function createClubEvent(org) {
    const d = TH.addDays(TH.clock.now(), 3), dk = TH.dkey(d);
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${esc(org.name)}</span><h2>Create new event</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon("x")}</button></div>
      <div class="field"><label for="ev-cr-title">Event title</label><input id="ev-cr-title" maxlength="80" placeholder="e.g. AI & Robotics Hands-on Demo"></div>
      <div class="grid2"><div class="field"><label for="ev-cr-date">Date</label><input id="ev-cr-date" type="date" value="${dk}" min="${TH.dkey(TH.clock.now())}"></div><div class="field"><label for="ev-cr-time">Start</label><input id="ev-cr-time" type="time" value="18:30"></div></div>
      <div class="field"><label for="ev-cr-where">Where</label><input id="ev-cr-where" maxlength="60" placeholder="e.g. Ronald Tutor Campus Center (TCC)"></div>
      <div class="field"><label for="ev-cr-desc">Event details</label><textarea id="ev-cr-desc" rows="2" placeholder="Describe the event, who is welcome, food, activities..."></textarea></div>
      <div class="field">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label for="ev-cr-tags" style="font-weight:600;">Event Hashtags (for recommendations)</label>
          <button type="button" class="ai-gen-btn" id="ev-cr-ai-gen">${icon("sparkle")} AI Generate Hashtags</button>
        </div>
        <input id="ev-cr-tags" maxlength="120" placeholder="#robotics #ai #viterbi #freefood">
        <div id="ev-cr-ai-note" style="display:none; font-size:12px; color:var(--cardinal-ink); margin-top:4px; padding:4px 8px; background:var(--surface-2); border-radius:6px;"></div>
      </div>
      <div class="err" hidden></div>
      <div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="ev-cr-ok">Publish Event</button></div>
      <p class="muted tiny">Students with matching hashtag preferences will get recommended this event.</p>
    </div>`, w => {
      $("#ev-cr-ai-gen", w).onclick = () => {
        const title = $("#ev-cr-title", w).value.trim();
        const desc = $("#ev-cr-desc", w).value.trim();
        const tags = TH.ai.generateHashtags(title, desc, org.name);
        $("#ev-cr-tags", w).value = tags.join(" ");
        const note = $("#ev-cr-ai-note", w);
        note.style.display = "block";
        note.innerHTML = `⚡ <b>AI converted words into script:</b> <code>event.publish title="${esc(title)}" hashtags="${esc(tags.join(" "))}"</code>`;
        TH.toast("✨ AI converted words into hashtags!", "sparkle");
      };
      $("#ev-cr-ok", w).onclick = () => {
        const title = $("#ev-cr-title", w).value.trim();
        const dv = $("#ev-cr-date", w).value, tv = $("#ev-cr-time", w).value || "18:30", er = $(".err", w);
        if (!title) { er.hidden = false; er.textContent = "Please enter an event title."; return; }
        if (!dv) { er.hidden = false; er.textContent = "Pick a date."; return; }
        const rawTags = ($("#ev-cr-tags", w).value || "").match(/#[a-zA-Z0-9_-]+/g) || [];
        const hashtags = rawTags.length ? rawTags : TH.ai.generateHashtags(title, $("#ev-cr-desc", w).value, org.name);
        const ev = { id: uid(), title, start: `${dv}T${tv}:00`, where: $("#ev-cr-where", w).value.trim(), desc: $("#ev-cr-desc", w).value.trim(), hashtags, org: org.name, cats: ["Social", "Student Life"] };
        const end = TH.laDate(ev.start); end.setHours(end.getHours() + 2);
        (org.kind === "usc" ? O(orgs()[0]) : O(org)).events.push(ev);
        TH.H().eventHashtags = TH.H().eventHashtags || {};
        TH.H().eventHashtags[ev.id] = hashtags;
        hub().calendar.push({ ref: "x-" + ev.id, title: ev.title, start: ev.start, end: TH.laISO(end), where: ev.where, org: org.name, kind: "club" });
        TH.commit(`Created ${title} for ${org.name}`);
        TH.closeSheet();
        TH.toast(`Event created! Recommended to students who like ${hashtags.slice(0, 2).join(" ")}`);
        TH.render(true);
      };
    });
  }

  function schedule(org, r) {
    const d = TH.addDays(TH.clock.now(), 7), dk = TH.dkey(d);
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${r.votes} students asked for this</span><h2>Schedule “${esc(r.title)}”</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="grid2"><div class="field"><label for="sc-date">Date</label><input id="sc-date" type="date" value="${dk}" min="${TH.dkey(TH.clock.now())}"></div><div class="field"><label for="sc-time">Start</label><input id="sc-time" type="time" value="18:00"></div></div>
      <div class="field"><label for="sc-where">Where</label><input id="sc-where" maxlength="60" placeholder="e.g. Taper Hall 101, or book a space after this"></div>
      <div class="field"><label for="sc-desc">Event details</label><textarea id="sc-desc" rows="2" placeholder="Tell students what will happen at this event...">${esc(r.desc || '')}</textarea></div>
      <div class="field">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label for="sc-tags" style="font-weight:600;">Event Hashtags (for recommendations)</label>
          <button type="button" class="ai-gen-btn" id="sc-ai-gen">${icon('sparkle')} AI Generate Hashtags</button>
        </div>
        <input id="sc-tags" maxlength="120" placeholder="#robotics #ai #career #freefood #viterbi" value="${esc((r.hashtags || []).join(' '))}">
        <p class="muted tiny" style="margin-top:3px;">Students who give thumbs up to similar hashtags get recommended this event.</p>
        <div id="sc-ai-note" style="display:none; font-size:12px; color:var(--cardinal-ink); margin-top:4px; padding:4px 8px; background:var(--surface-2); border-radius:6px;"></div>
      </div>
      <div class="err" hidden></div><div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="sc-ok">Schedule and tell requesters</button></div>
      ${sim('Simulated. Requesters would be notified in the app or by email, whichever they chose.')}</div>`, w => {
      $('#sc-ai-gen', w).onclick = () => {
        const title = r.title;
        const desc = $('#sc-desc', w).value.trim();
        const tags = TH.ai.generateHashtags(title, desc, org.name, r.type);
        $('#sc-tags', w).value = tags.join(' ');
        const note = $('#sc-ai-note', w);
        note.style.display = 'block';
        note.innerHTML = `⚡ <b>AI converted words into script:</b> <code>event.tag hashtags="${esc(tags.join(' '))}"</code><br>Targeted tags: ${tags.join(', ')}`;
        TH.toast('✨ AI converted words into hashtags!', 'sparkle');
      };
      $('#sc-ok', w).onclick = () => {
        const dv = $('#sc-date', w).value, tv = $('#sc-time', w).value || '18:00', er = $('.err', w);
        if (!dv) { er.hidden = false; er.textContent = 'Pick a date.'; return; }
        const rawTags = ($('#sc-tags', w).value || '').match(/#[a-zA-Z0-9_-]+/g) || [];
        const hashtags = rawTags.length ? rawTags : TH.ai.generateHashtags(r.title, $('#sc-desc', w).value, org.name);
        const mineReq = r.mine || !!X().votes[r.id], ev = { id: uid(), title: r.title, start: `${dv}T${tv}:00`, where: $('#sc-where', w).value.trim(), desc: $('#sc-desc', w).value.trim(), hashtags: hashtags, org: org.name, req: r.id, priority: mineReq };
        TH.H().eventHashtags = TH.H().eventHashtags || {};
        TH.H().eventHashtags[ev.id] = hashtags;
        const end = TH.laDate(ev.start); end.setHours(end.getHours() + 2);
        (org.kind === 'usc' ? O(orgs()[0]) : O(org)).events.push(ev); r.status = 'scheduled';
        if (mineReq) hub().calendar.push({ ref: 'x-' + ev.id, title: ev.title, start: ev.start, end: TH.laISO(end), where: ev.where, org: org.name, kind: 'event' });
        TH.commit(`Scheduled ${r.title} for ${org.name}`); TH.closeSheet();
        if (mineReq) note('events', `It’s happening: ${r.title}`, `${org.name} scheduled the event you asked for. You have first RSVP, and it’s on My Day.`, 'plans');
        TH.toast(`Scheduled. ${r.votes} requester${r.votes === 1 ? '' : 's'} get first RSVP.`); TH.render(true);
      };
    });
  }
  const topKey = o => (Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [''])[0];
  TH.screens.orgreq = {
    render() {
      const org = cur(), club = org.kind !== 'usc'; if (!club && (RQ.f === 'members' || RQ.f === 'similar')) RQ.f = 'all';
      RQ.major = RQ.major || myMajor() || MAJORS[0]; RQ.goal = RQ.goal || GOALS[0];
      const list = ranked(org, RQ), sim2 = club ? similarClubs(org.club) : [];
      const majors = [...new Set([...MAJORS, RQ.major])];
      const chips = [['all', 'Everyone', 'users'], ...(club ? [['members', 'Our members', 'club']] : []), ['major', 'By major', 'grad'], ['goal', 'By career goal', 'bag'], ...(club ? [['similar', 'Similar clubs', 'layers']] : [])];
      return scr('Event Requests', org, `
        ${club ? `<div class="seg" role="group" aria-label="Whose requests"><button data-rqs="club" aria-pressed="${RQ.scope === 'club'}">This club</button><button data-rqs="usc" aria-pressed="${RQ.scope === 'usc'}">All of USC</button></div>` : ''}
        <div class="x-chips scroll">${chips.map(([k, l, ic]) => `<button class="chip" data-rqf="${k}" aria-pressed="${RQ.f === k}">${icon(ic)}${l}</button>`).join('')}</div>
        ${RQ.f === 'major' ? `<div class="field"><label for="rq-major">Requests from students majoring in</label><select id="rq-major">${majors.map(m => `<option ${m === RQ.major ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>` : ''}
        ${RQ.f === 'goal' ? `<div class="field"><label for="rq-goal">Requests from students whose career goal is</label><select id="rq-goal">${GOALS.map(g => `<option ${g === RQ.goal ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>` : ''}
        ${RQ.f === 'similar' ? `<span class="muted tiny">Clubs like yours: ${esc(sim2.map(c => c.name).join(', ') || 'none found')}. Counts are their members who voted.</span>` : ''}
        <div class="x-ai" id="rq-ai"><span class="eyebrow">${icon('sparkle')} Tommy’s read</span><span>${esc(reqSummary(org, RQ))}</span><span style="display:flex;gap:14px;flex-wrap:wrap"><button class="linkbtn" id="rq-ai-btn" style="color:var(--cardinal-ink);font-weight:650">Have Tommy write it up</button><button class="linkbtn" data-go="orgtommy" style="color:var(--cardinal-ink);font-weight:650">Ask Tommy a follow-up</button></span></div>
        <div class="rows">${list.length ? list.map(({ r, n }) => { const b = bd(r, org); return `<div class="row" style="align-items:flex-start"><span class="x-vote" aria-label="${n} votes">${n}<small>${RQ.f === 'all' ? 'votes' : 'of ' + r.votes}</small></span><span class="rmain"><span class="rtitle wrap">${esc(r.title)}</span><span class="rsub wrap">${esc(r.type)} · ${esc(r.when.toLowerCase())} · ${esc(TH.x.reqTo(r))}</span><span class="rsub wrap">${club ? `${b.members} of your members · ` : ''}mostly ${esc(topKey(b.majors) || 'mixed')} majors${topKey(b.goals) ? ` · ${esc(topKey(b.goals).toLowerCase())}` : ''}</span></span><span class="rside">${r.status === 'scheduled' ? `<span class="pill ok">${icon('check')}Scheduled</span>` : `<button class="btn sm" data-sched="${esc(r.id)}">Schedule</button>`}</span></div>`; }).join('') : `<div class="empty">${icon('megaphone')}<b>No requests from this group yet</b><span>Try another filter, or look at all of USC.</span></div>`}</div>
        <span class="muted tiny">You see totals, never who voted. Majors come from students’ USC records and career goals only from students who chose to share them. The breakdowns here are sample data.</span>`);
    },
    mount(host) {
      bindHeader(host);
      host.addEventListener('click', e => {
        const b = e.target.closest('[data-sched]'), s2 = e.target.closest('[data-rqs]'), f = e.target.closest('[data-rqf]');
        if (b) { const r = X().evreqs.find(q => q.id === b.dataset.sched); if (r) schedule(cur(), r); }
        else if (s2) { RQ.scope = s2.dataset.rqs; TH.render(true); } else if (f) { RQ.f = f.dataset.rqf; TH.render(true); }
      });
      const mj = $('#rq-major', host), gl = $('#rq-goal', host);
      if (mj) mj.onchange = () => { RQ.major = mj.value; TH.render(true); }; if (gl) gl.onchange = () => { RQ.goal = gl.value; TH.render(true); };
      $('#rq-ai-btn', host).onclick = () => { const org = cur(), open = ranked(org, RQ).filter(o => o.r.status === 'open'); ai($('#rq-ai', host), `You are Tommy, the USC campus assistant, advising ${org.kind === 'usc' ? 'a USC Campus Activities staff member' : 'an officer of the student club ' + org.name}. In 3 short sentences, summarize what ${whoLabel(org, RQ)} are requesting (${scopeOf(org) === 'usc' ? 'across all of USC' : 'for this club'}) and recommend what to schedule first and how. Plain text, no lists.\n\nREQUESTS (title | type | preferred time | votes from this group | total votes)\n` + open.map(o => `${o.r.title} | ${o.r.type} | ${o.r.when} | ${o.n} | ${o.r.votes}`).join('\n'), reqSummary(org, RQ)); };
    },
  };

  // =====================================================================
  // TOMMY FOR ORGANIZERS: answers from the club's own numbers, and from USC sources for everything else
  // =====================================================================
  const TM = {};
  const SUGG = { club: ['What should we host next?', 'What do our members want?', 'What are CS majors asking for?', 'Who hasn’t paid dues?', 'How is our budget?', 'What food should I order?', 'How do I reserve a table on Trousdale?'], usc: ['What are students asking for across USC?', 'What do Business majors want?', 'How many problem reports are open?', 'Which Tommy questions need answers?'] };
  function orgFacts(q, org) {
    const t = ' ' + q.toLowerCase() + ' ', club = org.kind !== 'usc', acts = [];
    const F = { scope: /\b(usc|campus|everyone|all students|across)\b/.test(t) ? 'usc' : 'club', f: 'all', major: null, goal: null };
    const mj = MAJORS.find(m => t.includes(m.toLowerCase()) || t.includes(' ' + m.toLowerCase().split(' ')[0] + ' ')) || (/\bcs\b/.test(t) ? 'Computer Science' : /\bbio\b/.test(t) ? 'Biological Sciences' : /\bfilm\b/.test(t) ? 'Cinematic Arts' : null);
    const gl = GOALS.find(g => t.includes(g.toLowerCase()) || t.includes(g.toLowerCase().split(' ')[0] + ' '));
    if (/\bmajors?\b/.test(t) && mj || (mj && !gl)) { F.f = 'major'; F.major = mj; } else if (gl) { F.f = 'goal'; F.goal = gl; } else if (club && /similar|like ours|other clubs|clubs like/.test(t)) F.f = 'similar'; else if (club && /\b(our|my|the) members|members want|people in (the|our) club/.test(t)) F.f = 'members';
    if (/dues|paid|unpaid|owe/.test(t) && club) { const ms = roster(org), tt = duesTotals(org, ms), un = tt.un, o = O(org); return { text: `${tt.paid} of ${ms.length} members have paid ${money(o.dues)} dues, so ${money(tt.collected)} is collected and ${money(tt.outstanding)} is outstanding. Unpaid: ${un.map(m => m.name).join(', ') || 'nobody'}. They join the members chat automatically once they pay.`, acts: [['Members & dues', 'orgmem']] }; }
    if (/budget|spend|spent|money|cost|afford|funding/.test(t) && club) return { text: budgetFacts(budget(org)).join(' '), acts: [['Budget summary', 'orgbudget']] };
    if (/food|snack|drink|diet|allerg|order|cater|who.?s coming|attendee|rsvp/.test(t) && club) return { text: insightText(insights(org)), acts: [['Attendee insights', 'orginsights']] };
    if (/feedback|thumbs|rating|liked|went well/.test(t) && club) return { text: feedback(org).text, acts: [['Feedback', 'orginsights']] };
    if (/newsletter|announce/.test(t) && club) return { text: 'I can draft this week’s newsletter from your calendar, your top request and your dues. Open the newsletter, tap “Draft with AI”, edit it, and one send posts it in the app and emails your members.', acts: [['Open newsletter', 'orgnews']] };
    if (/report/.test(t) && !club) { const reps = [...X().reports, ...SAMPLE_REPORTS], open = reps.filter(r => r.status < 3); return { text: `${open.length} of ${reps.length} problem reports are open. ${open.slice(0, 3).map(r => `${r.id}: ${r.desc} (${r.office}, ${STAT[r.status].toLowerCase()})`).join('. ')}.`, acts: [['Inbox', 'orginbox']] }; }
    if (/tommy|unanswered|flagged|questions need/.test(t) && !club) { const g = X().gaps.filter(o => !o.answer); return { text: g.length ? `${g.length} question${g.length === 1 ? '' : 's'} I couldn’t answer are waiting: ${g.map(o => `“${o.q}”`).join(', ')}. Publish an answer and I’ll use it from then on.` : 'Nothing is waiting. Every flagged question has an answer.', acts: [['Inbox', 'orginbox']] }; }
    if (/request|host|event|want|asking|plan|schedule|next|popular|idea/.test(t) || F.f !== 'all') { RQ.scope = F.scope; RQ.f = F.f; if (F.major) RQ.major = F.major; if (F.goal) RQ.goal = F.goal; return { text: reqSummary(org, F), acts: [['See these requests', 'orgreq'], ...(club ? [['Book a space', 'orgspace']] : [])] }; }
    return null;
  }
  async function tommyAsk(q, org) {
    q = String(q || '').trim(); if (!q) return; const log = TM[org.id] || (TM[org.id] = []);
    log.push({ me: true, text: q }); const m = { text: 'Checking…', wait: true }; log.push(m); if (TH.state.route === 'orgtommy') TH.render();
    const f = orgFacts(q, org); let text, acts = [], src = '';
    if (f) {
      acts = f.acts; text = f.text; src = org.kind === 'usc' ? 'From the requests, reports and flags students sent' : `From ${org.name}’s numbers in Trojan Hub (sample data)`;
      try { const s = window.claude && window.claude.use ? await window.claude.use('sample') : null; if (s) { const r = await s(`You are Tommy, the USC campus assistant, talking with ${org.kind === 'usc' ? 'a USC Campus Activities staff member' : 'an officer of the student club ' + org.name}. Answer their question in 2 to 4 friendly sentences using ONLY the facts below. Plain text.\n\nQUESTION: ${q}\n\nFACTS: ${f.text}`, { modelTier: 'quick' }); if (r && r.text) text = r.text; } } catch (e) { /* keep the on-device answer */ }
    } else {
      const r = await askTommy(q, false);
      text = r.card ? 'That one is an action on your own student account. Switch to the student side and ask me there, and I’ll set it up for you to confirm.' : r.miss ? 'I don’t have a checked answer for that yet, so I flagged it for the Tommy team. Ask me about your requests, members, dues, budget or attendees and I can answer from your club’s numbers.' : r.text.slice(0, 700) + (r.text.length > 700 ? '…' : '');
      src = r.miss || r.card ? '' : 'From USC sources';
    }
    Object.assign(m, { text, acts, src, wait: false }); if (TH.state.route === 'orgtommy') TH.render();
  }
  TH.screens.orgtommy = {
    render() {
      const org = cur(), log = TM[org.id] || [], sg = SUGG[org.kind === 'usc' ? 'usc' : 'club'];
      return `<div class="screen">${TH.ui.topbar('Ask Tommy', false)}<div class="pad screen-body x-thread stack">${header(org)}
        <div class="chat"><div class="msg bot">Hi ${esc(TH.student().first)}. I’m Tommy on the organizer side. Ask me what students want, who has paid, how the budget looks or what to order${org.kind === 'usc' ? '' : ' for ' + esc(org.name)}, and anything about USC rules for clubs.</div>
          ${log.map(m => m.me ? `<div class="msg me">${esc(m.text)}</div>` : `<div class="msg bot ${m.wait ? 'thinking' : ''}">${esc(m.text)}${m.src ? `<small style="margin-top:6px;font-weight:600">${esc(m.src)}</small>` : ''}${m.acts && m.acts.length ? `<div class="acts">${m.acts.map(([l, g]) => `<button data-go="${g}">${icon('chev')}${esc(l)}</button>`).join('')}</div>` : ''}</div>`).join('')}</div>
        <div class="x-chips">${sg.map(q => `<button class="chip" data-otq="${esc(q)}">${esc(q)}</button>`).join('')}</div></div></div>
        <div class="composer pad"><form id="ot-form"><label class="sr" for="ot-in">Ask Tommy</label><input id="ot-in" maxlength="300" placeholder="Ask Tommy about ${esc(org.kind === 'usc' ? 'campus requests' : 'your club')}" autocomplete="off"><button class="send" aria-label="Send">${icon('send')}</button></form></div>`;
    },
    mount(host) {
      bindHeader(host); host.scrollTop = host.scrollHeight;
      const arg = TH.state.params && TH.state.params.arg; if (arg) { TH.state.params = {}; tommyAsk(arg, cur()); }
      host.addEventListener('click', e => { const b = e.target.closest('[data-otq]'); if (b) tommyAsk(b.dataset.otq, cur()); });
      $('#ot-form', host.parentNode).addEventListener('submit', e => { e.preventDefault(); const i = $('#ot-in'), v = i.value; i.value = ''; tommyAsk(v, cur()); });
    },
  };

  // =====================================================================
  // MEMBERS + DUES (Part 6): add / remove members, tap to mark paid or unpaid (amount + date), All / Paid / Unpaid,
  // search, collected vs outstanding, remind unpaid. Simulated on the demo account and saved in TH.H().x.orgs.
  // =====================================================================
  const ROLES = ['Member', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Social chair'];
  const YEARS = ['First-year', 'Sophomore', 'Junior', 'Senior', 'Grad student'];
  const AVC = ['#990000', '#c4501b', '#138a72', '#1e66c9', '#7a4fc2', '#a87a00', '#d23d64', '#445a77'];
  const USC_EMAIL = /^[a-z0-9._%+-]+@usc\.edu$/i;
  const initials = nm => String(nm).replace(/\s*\(you\)\s*/i, '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const shortDay = ts => { const d = new Date(ts); return `${TH.MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };
  const clockMs = () => TH.clock.now().getTime();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const MF = () => TH.state.p6mem || (TH.state.p6mem = { f: 'all', q: '' });
  const avatar = (m, cls = '') => `<span class="p6m-av ${cls}" style="--av:${AVC[hash(m.name) % AVC.length]}" aria-hidden="true">${esc(initials(m.name))}${m.paid ? icon('check') : ''}</span>`;
  const viaText = v => !v ? '' : /trojan hub/i.test(v) ? 'paid in the app' : /marked by you/i.test(v) ? 'marked paid by you' : 'via ' + v;

  // toast with an Undo button (6 s); any regular toast replaces it
  let undoT = null;
  function undoToast(msg, ic, fn) {
    const dev = $('.device'); if (!dev) return;
    $$('.toast, .p6-undo', dev).forEach(n => n.remove()); clearTimeout(undoT);
    dev.insertAdjacentHTML('beforeend', `<div class="p6-undo" role="status">${icon(ic || 'check')}<span>${esc(msg)}</span><button type="button">Undo</button></div>`);
    const t = $('.p6-undo', dev);
    t.querySelector('button').onclick = () => { clearTimeout(undoT); t.remove(); fn(); };
    undoT = setTimeout(() => t.remove(), 6000);
  }
  const toast0 = TH.toast;
  TH.toast = function () { $$('.p6-undo').forEach(n => n.remove()); return toast0.apply(this, arguments); };

  function memRow(org, o, m) {
    const key = esc(m.name), just = TH.state.p6memJust === m.name;
    const chip = m.you ? `<span class="p6m-role you">You · ${esc(m.role || 'Member')}</span>` : m.role && m.role !== 'Member' ? `<span class="p6m-role">${esc(m.role)}</span>` : '';
    const sub = [m.year, m.email, m.paid ? viaText(m.via) : (o.reminded ? 'nudged ' + ago(o.reminded) : 'not paid yet')].filter(Boolean).map(esc).join(' · ');
    const amt = m.paid ? `${money(m.amt)} · ${shortDay(m.paidAt)}` : 'owes ' + money(o.dues);
    const side = m.you
      ? (m.paid ? `<span class="p6m-pay paid"><span class="t">${icon('check')}Paid</span><small>${amt}</small></span>` : `<button class="p6m-pay unpaid" data-club="${esc(org.id)}"><span class="t">Pay now</span><small>${amt}</small></button>`)
      : `<button class="p6m-pay ${m.paid ? 'paid' : 'unpaid'}${just ? ' just' : ''}" data-p6pay="${key}" aria-pressed="${m.paid}" aria-label="${esc(m.name)}: ${m.paid ? `paid ${money(m.amt)} on ${shortDay(m.paidAt)}. Tap to mark unpaid` : `owes ${money(o.dues)}. Tap to mark paid`}"><span class="t">${m.paid ? `${icon('check')}Paid` : 'Mark paid'}</span><small>${amt}</small></button><button class="p6m-del" data-p6del="${key}" aria-label="Remove ${esc(m.name)}">${icon('trash')}</button>`;
    return `<div class="row${m.paid ? ' is-paid' : ''}" data-mem="${key}">${avatar(m)}<span class="rmain"><span class="rtitle">${esc(m.name.replace(/\s*\(you\)$/, ''))}${chip}</span><span class="rsub">${sub}</span></span><span class="p6m-side">${side}</span></div>`;
  }
  function listHTML(org) {
    const o = O(org), F = MF(), q = F.q.trim().toLowerCase();
    const ms = roster(org).filter(m => (F.f === 'all' || (F.f === 'paid') === !!m.paid) && (!q || [m.name, m.email, m.role, m.year].join(' ').toLowerCase().includes(q)));
    if (!ms.length) return `<div class="p6m-empty">${q ? `<b>No one matches “${esc(F.q.trim())}”</b>Try a first name or a role.` : F.f === 'unpaid' ? `<b>Everyone has paid</b>Dues are all in. Nice work, treasurer.` : F.f === 'paid' ? `<b>No payments yet</b>Tap “Mark paid” when someone pays you in person.` : `<b>No members yet</b>Add your first member above.`}</div>`;
    return ms.map(m => memRow(org, o, m)).join('');
  }
  const chipsHTML = (tt) => [['all', 'All', tt.n], ['paid', 'Paid', tt.paid], ['unpaid', 'Unpaid', tt.unpaid]].map(([k, l, n]) => `<button data-p6f="${k}" aria-pressed="${MF().f === k}">${l}<b>${n}</b></button>`).join('');

  const clearUndo = () => { clearTimeout(undoT); $$('.p6-undo').forEach(n => n.remove()); };
  // a member's per-name roster fields (role, dues), read before an add and written back by its Undo
  const MEM_MAPS = ['role', 'paid', 'paidAt', 'paidAmt', 'via'];
  const memMaps = (o, name) => MEM_MAPS.reduce((a, k) => { a[k] = Object.prototype.hasOwnProperty.call(o[k], name) ? o[k][name] : undefined; return a; }, {});
  const putMaps = (o, name, prev) => MEM_MAPS.forEach(k => { if (prev[k] === undefined) delete o[k][name]; else o[k][name] = prev[k]; });
  function addSheet(org) {
    const o = O(org); let role = 'Member', touched = {}; clearUndo();
    TH.sheet(`<div class="stack p6m-form">
      <div class="sheet-head"><div style="flex:1;min-width:0;display:grid;gap:3px"><h2>Add a member</h2><p class="muted" style="font-size:13px">${esc(org.name)}</p></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field" id="am-nf"><label for="am-name">Name</label><input id="am-name" autocomplete="off" maxlength="40" placeholder="e.g. Alex Kim"><span class="ferr" id="am-ne" aria-live="polite"></span></div>
      <div class="field" id="am-ef"><label for="am-email">USC email</label><input id="am-email" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="ttrojan@usc.edu"><span class="ferr" id="am-ee" aria-live="polite"></span></div>
      <div class="field"><span class="flabel">Role <span class="muted" style="font-weight:500">(optional)</span></span><div class="p6m-roles" role="group" aria-label="Role">${ROLES.map(r => `<button type="button" data-role="${esc(r)}" aria-pressed="${r === role}">${esc(r)}</button>`).join('')}</div></div>
      <div class="field"><label for="am-year">Year</label><select id="am-year">${YEARS.map(y => `<option${y === 'First-year' ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
      ${o.dues ? `<label class="p6m-paidq"><input type="checkbox" id="am-paid"><span><b>Already paid ${money(o.dues)} dues</b><span>Marks them paid today and adds them to the members chat</span></span></label>` : ''}
      <button class="btn block" id="am-ok" disabled>${icon('plus')} Add member</button>
      ${sim('Simulated: added to this demo roster on your device only. No email is sent.')}
    </div>`, w => {
      const nm = $('#am-name', w), em = $('#am-email', w), ok = $('#am-ok', w);
      const read = () => ({ name: nm.value.trim().replace(/\s+/g, ' '), email: em.value.trim().toLowerCase() });
      const check = () => {
        const v = read(), ms = roster(org);
        const ne = !v.name ? 'Add their name.' : v.name.length < 2 || !/[a-z]/i.test(v.name) ? 'Use at least 2 letters.' : ms.some(m => m.name.replace(/\s*\(you\)$/, '').toLowerCase() === v.name.toLowerCase()) ? `${v.name} is already on the roster.` : '';
        const ee = !v.email ? 'Add their USC email.' : !USC_EMAIL.test(v.email) ? 'Use a USC email that ends in @usc.edu.' : ms.some(m => (m.email || '').toLowerCase() === v.email) ? 'Someone on the roster already uses that email.' : '';
        $('#am-ne', w).textContent = touched.n ? ne : ''; $('#am-ee', w).textContent = touched.e ? ee : '';
        $('#am-nf', w).classList.toggle('bad', !!(touched.n && ne)); $('#am-ef', w).classList.toggle('bad', !!(touched.e && ee));
        ok.disabled = !!(ne || ee);
        ok.innerHTML = `${icon('plus')} ${v.name && !ne ? `Add ${esc(v.name.split(' ')[0])}` : 'Add member'}`;
        return !(ne || ee);
      };
      nm.addEventListener('input', () => { if (nm.value.trim().length > 1) touched.n = true; check(); });
      em.addEventListener('input', () => { if (/@/.test(em.value)) touched.e = true; check(); });
      nm.addEventListener('blur', () => { if (nm.value.trim()) touched.n = true; check(); });
      em.addEventListener('blur', () => { if (em.value.trim()) touched.e = true; check(); });
      w.addEventListener('click', e => { const r = e.target.closest('[data-role]'); if (!r) return; role = r.dataset.role; $$('[data-role]', w).forEach(b => b.setAttribute('aria-pressed', String(b === r))); });
      w.addEventListener('keydown', e => { if (e.key === 'Enter' && /INPUT/.test(e.target.tagName) && e.target.type !== 'checkbox') { e.preventDefault(); if (e.target === nm) em.focus(); else ok.click(); } });
      ok.onclick = () => {
        touched = { n: true, e: true }; if (!check()) return;
        const v = read(), paid = !!($('#am-paid', w) || {}).checked, rec = { name: v.name, email: v.email, role, year: $('#am-year', w).value, at: clockMs() };
        // the new member is a row of their own: a sample member removed earlier under the same name stays removed (it is
        // not brought back), and what this add writes under that name is remembered, so Remove and Undo leave no ghost row
        const prev = memMaps(o, v.name);
        o.added.push(rec); o.role[v.name] = role; o.paid[v.name] = paid;
        if (paid) { o.paidAt[v.name] = rec.at; o.paidAmt[v.name] = o.dues; o.via[v.name] = 'marked by you'; } else { delete o.paidAt[v.name]; delete o.paidAmt[v.name]; delete o.via[v.name]; }
        TH.commit(`Added ${v.name} (${role}) to ${org.name}${paid ? `, dues ${money(o.dues)} marked paid` : ''} (simulated roster)`);
        TH.closeSheet(); MF().q = ''; if (MF().f !== 'all' && MF().f !== (paid ? 'paid' : 'unpaid')) MF().f = 'all';
        TH.state.p6memJust = v.name; TH.render(true); TH.state.p6memJust = null;
        undoToast(`${v.name} added${paid ? ' · paid' : ''}. Welcome aboard!`, 'users', () => { o.added = o.added.filter(x => x !== rec); putMaps(o, v.name, prev); save(); TH.render(true); TH.toast(`Took ${v.name} back off the roster`, 'swap'); });
      };
      check();
    });
  }
  function removeSheet(org, name) {
    const o = O(org), m = roster(org).find(x => x.name === name); if (!m || m.you) return; clearUndo();
    TH.sheet(`<div class="stack">
      <div class="sheet-head"><div style="flex:1;min-width:0;display:grid;gap:3px"><h2>Remove this member?</h2><p class="muted" style="font-size:13px">${esc(org.name)}</p></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p6m-who">${avatar(m)}<span><b>${esc(m.name)}</b><span class="muted">${esc([m.role, m.year, m.email].filter(Boolean).join(' · '))}</span></span></div>
      <p class="muted" style="font-size:13.5px;margin:0">They leave the roster and the members chat. ${m.paid ? `Their ${money(m.amt)} payment comes off your collected total.` : `Their ${money(o.dues)} comes off what’s outstanding.`} You can undo right after.</p>
      <div class="btn-row"><button class="btn line" data-close>Keep ${esc(m.name.split(' ')[0])}</button><button class="btn" id="rm-ok" style="background:var(--risk-high);color:#fff">${icon('trash')} Remove</button></div>
      ${sim('Simulated roster on the demo account. Nothing is sent to the member.')}
    </div>`, w => {
      $('#rm-ok', w).onclick = () => {
        let undo;
        if (m.added) {
          const rec = o.added.find(x => x.name === name), i = o.added.indexOf(rec); o.added.splice(i, 1);
          // a sample member with the same name (shown again by an older add) leaves with them, so Remove really removes
          const twin = sampleNames(org).find(nm => nm.toLowerCase() === name.toLowerCase() && !o.removed.includes(nm));
          if (twin) o.removed.push(twin);
          undo = () => { o.added.splice(Math.min(i, o.added.length), 0, rec); if (twin) o.removed = o.removed.filter(x => x !== twin); };
        }
        else { if (!o.removed.includes(name)) o.removed.push(name); undo = () => { o.removed = o.removed.filter(x => x !== name); }; }
        TH.commit(`Removed ${name} from ${org.name} (simulated roster)`); TH.closeSheet(); TH.render(true);
        undoToast(`${name} removed`, 'trash', () => { undo(); save(); TH.state.p6memJust = name; TH.render(true); TH.state.p6memJust = null; TH.toast(`${name} is back on the roster`, 'users'); });
      };
    });
  }
  function togglePaid(org, name) {
    const o = O(org), m = roster(org).find(x => x.name === name); if (!m || m.you) return;
    const prev = { paid: o.paid[name], at: o.paidAt[name], amt: o.paidAmt[name], via: o.via[name] }, to = !m.paid;
    o.paid[name] = to;
    if (to) { o.paidAt[name] = clockMs(); o.paidAmt[name] = o.dues; o.via[name] = 'marked by you'; } else { delete o.paidAt[name]; delete o.paidAmt[name]; }
    TH.commit(to ? `Marked ${name} paid: ${money(o.dues)} dues to ${org.name} (simulated)` : `Marked ${name} unpaid in ${org.name} (simulated)`);
    TH.state.p6memJust = name; TH.render(true); TH.state.p6memJust = null;
    undoToast(to ? `${name} paid ${money(o.dues)}. Added to the members chat.` : `${name} marked unpaid`, to ? 'dollar' : 'clock', () => {
      [['paid', 'paid'], ['paidAt', 'at'], ['paidAmt', 'amt'], ['via', 'via']].forEach(([k, pk]) => { if (prev[pk] === undefined) delete o[k][name]; else o[k][name] = prev[pk]; });
      save(); TH.render(true);
    });
  }
  function remindSheet(org) {
    const o = O(org), un = roster(org).filter(m => !m.paid); if (!un.length) return; clearUndo();
    TH.sheet(`<div class="stack">
      <div class="sheet-head"><div style="flex:1;min-width:0;display:grid;gap:3px"><h2>Nudge ${plural(un.length, 'member')}</h2><p class="muted" style="font-size:13px">${money(o.dues)} dues · ${money(un.length * o.dues)} outstanding</p></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="p6m-to">${un.map(m => `<span>${esc(m.name.replace(/\s*\(you\)$/, ' (you)'))}</span>`).join('')}</div>
      <div class="p6m-msg">Hi! Friendly reminder from ${esc(org.name)}: dues are <b>${money(o.dues)}</b> this semester. Pay in Trojan Hub${o.venmo && o.venmo.on ? ` or on Venmo ${esc(o.venmo.handle)}` : ''} and you’re in the members chat right away. Fight on! ${esc(TH.student().first)}</div>
      <button class="btn block" id="rm-send">${icon('bell')} Send to ${plural(un.length, 'member')}</button>
      ${sim('Simulated: the reminder goes out in the app on this demo account. Nothing is emailed.')}
    </div>`, w => {
      $('#rm-send', w).onclick = () => {
        o.reminded = Date.now(); TH.commit(`Sent a dues reminder to ${plural(un.length, 'member')} of ${org.name} (simulated)`);
        if (un.some(m => m.you)) note('dues', `Dues reminder: ${org.name}`, `${money(o.dues)} for this semester. Pay in the app to join the members chat.`, 'clubs:' + org.id);
        TH.closeSheet(); TH.render(true); TH.toast(`Reminder sent to ${plural(un.length, 'member')} (simulated)`, 'bell');
      };
    });
  }

  TH.screens.orgmem = {
    render() {
      const org = cur();
      if (org.kind === 'usc') return scr('Members', org, `<div class="empty">${icon('users')}<b>USC offices don’t have dues</b><span>Switch to a club above to manage members and dues.</span></div>`);
      const o = O(org), ms = roster(org), tt = duesTotals(org, ms), base = tt.collected + tt.outstanding, F = MF();
      const pc = base ? Math.round(tt.collected / base * 100) : 0;
      return scr('Members & Dues', org, `
        <div class="card p6m-sum">
          <div class="p6m-tot"><div><span class="l"><i></i>Collected</span><b>${money(tt.collected)}</b><small>${tt.paid} of ${tt.n} paid</small></div><div class="out"><span class="l"><i></i>Outstanding</span><b>${money(tt.outstanding)}</b><small>${tt.unpaid ? `${plural(tt.unpaid, 'member')} owe${tt.unpaid === 1 ? 's' : ''} ${money(o.dues)}` : 'All paid up!'}</small></div></div>
          <div class="p6m-split" role="img" aria-label="${pc}% of dues collected"><i style="width:${pc}%"></i><i style="width:${base ? 100 - pc : 0}%"></i></div>
          <div class="p6m-dues" id="p6m-dues">${F.editDues ? `<form id="du-form"><label class="sr" for="du-amt">Dues per semester in dollars</label><b>$</b><input id="du-amt" type="number" min="0" max="500" step="1" inputmode="numeric" value="${o.dues}"><button class="btn sm">Save</button><button type="button" class="btn sm line" id="du-cancel">Cancel</button></form>`
            : `<span>Dues <b>${money(o.dues)}</b> per semester</span><button class="btn sm ghost" id="du-edit">${icon('pencil')} Edit</button>`}</div>
        </div>
        <div class="p6m-acts"><button class="btn" id="p6m-add">${icon('plus')} Add member</button><button class="btn line" id="du-remind" ${tt.unpaid ? '' : 'disabled'}>${icon('bell')} Remind ${tt.unpaid} unpaid</button></div>
        <div class="rows">
          <div class="row" style="--rc:#008cff"><span class="rico">${icon('dollar')}</span><span class="rmain"><span class="rtitle wrap">Venmo ${o.venmo.on ? 'linked · ' + esc(o.venmo.handle) : 'not linked'}</span><span class="rsub wrap">${o.venmo.on ? `Payments there are matched to members automatically. Checked ${ago(o.venmo.at)}.` : 'Link the club’s Venmo so payments there mark members paid here.'}</span></span><span class="rside">${o.venmo.on ? `<button class="btn sm ghost" id="vm-sync">Check now</button>` : `<button class="btn sm" id="vm-link">Link</button>`}</span></div>
          ${row('data-go="orgchat"', 'chat', 'Members chat', `${plural(tt.paid, 'paid member')} ${tt.paid === 1 ? 'is' : 'are'} in it`, 'var(--c-fitness)')}
        </div>
        <div class="p6m-tools">
          <div class="p6m-search">${icon('search')}<input id="p6m-q" type="search" placeholder="Search ${plural(tt.n, 'member')}" aria-label="Search members" autocomplete="off" value="${esc(F.q)}"></div>
          <div class="p6m-chips" role="group" aria-label="Show members" id="p6m-chips">${chipsHTML(tt)}</div>
        </div>
        <div class="rows p6m-list" id="p6m-list" aria-live="polite">${listHTML(org)}</div>
        ${sim(`Sample roster: names, years and payments are generated for this demo, not ${esc(org.name)}’s real records. Members you add or remove and paid marks are simulated and saved on this device.`)}`);
    },
    mount(host) {
      bindHeader(host); const org = cur(); if (org.kind === 'usc') return;
      const F = MF(), list = $('#p6m-list', host);
      const ed = $('#du-edit', host); if (ed) ed.onclick = () => { F.editDues = true; TH.render(true); setTimeout(() => { const i = $('#du-amt'); if (i) { i.focus(); i.select(); } }, 30); };
      const dc = $('#du-cancel', host); if (dc) dc.onclick = () => { F.editDues = false; TH.render(true); };
      const df = $('#du-form', host); if (df) df.addEventListener('submit', e => { e.preventDefault(); const v = Math.max(0, Math.min(500, Math.round(+$('#du-amt', host).value || 0))), o = O(org);
        roster(org).forEach(m => { if (m.paid && o.paidAmt[m.name] == null) o.paidAmt[m.name] = m.amt; }); // payments already made keep their amount
        o.dues = v; F.editDues = false; save(); TH.toast(`Dues set to ${money(v)} per semester`, 'dollar'); TH.render(true); });
      $('#du-remind', host).onclick = () => remindSheet(org);
      $('#p6m-add', host).onclick = () => addSheet(org);
      const vs = $('#vm-sync', host), vl = $('#vm-link', host);
      if (vl) vl.onclick = () => { const o = O(org); o.venmo.on = true; o.venmo.at = Date.now(); save(); TH.toast('Venmo linked (simulated)', 'link'); TH.render(true); };
      if (vs) vs.onclick = () => { const o = O(org), nx = roster(org).find(m => !m.paid && !m.you); o.venmo.at = Date.now(); if (nx) { o.paid[nx.name] = true; o.via[nx.name] = 'Venmo'; o.paidAt[nx.name] = clockMs(); o.paidAmt[nx.name] = o.dues; TH.state.p6memJust = nx.name; } save(); TH.render(true); TH.state.p6memJust = null; TH.toast(nx ? `New Venmo payment matched: ${nx.name}. Added to the members chat.` : 'No new Venmo payments', 'dollar'); };
      const q = $('#p6m-q', host); q.addEventListener('input', () => { F.q = q.value; list.innerHTML = listHTML(org); });
      $('#p6m-chips', host).addEventListener('click', e => { const b = e.target.closest('[data-p6f]'); if (!b) return; F.f = b.dataset.p6f; $$('[data-p6f]', host).forEach(x => x.setAttribute('aria-pressed', String(x === b))); list.innerHTML = listHTML(org); });
      list.addEventListener('click', e => {
        const pb = e.target.closest('[data-p6pay]'), db = e.target.closest('[data-p6del]');
        if (pb) togglePaid(org, pb.dataset.p6pay); else if (db) removeSheet(org, db.dataset.p6del);
      });
    },
  };
  TH.screens.orgchat = {
    render() { const org = cur(), ch = { id: 'club:' + org.id, title: org.name + ' members', src: 'Trojan Hub' }; return TH.x.threadHTML(ch); },
    mount(host) { const org = cur(); TH.x.threadMount(host, { id: 'club:' + org.id, title: org.name + ' members', src: 'Trojan Hub' }); },
  };

  // =====================================================================
  // TOOLS
  // =====================================================================
  TH.screens.orgtools = {
    render() {
      const org = cur(), x = X();
      const body = org.kind === 'usc'
        ? `<div class="rows">${row('data-go="orginbox"', 'flag', 'Problem reports', 'See, route and resolve what students report', 'var(--c-safety)')}${row('data-go="orginbox"', 'sparkle', 'Flagged Tommy questions', `${x.gaps.filter(g => !g.answer).length} waiting for an answer`, 'var(--gold-ink)')}${row('data-go="orgreq"', 'megaphone', 'Event request data', 'What students want, campus-wide', 'var(--c-fitness)')}${row('data-go="orgspace"', 'building', 'Space requests', 'Classrooms, library rooms, event spaces', 'var(--c-study)')}</div>`
        : `<div class="rows">${row('data-go="orgnews"', 'mail', 'Newsletter', 'Write once: posts in the app and emails through Gmail', 'var(--cardinal)')}${row('data-go="orgbudget"', 'dollar', 'AI budget summary', 'Past semesters, summarized, with a plan for this one', 'var(--ok)')}${row('data-go="orgspace"', 'building', 'Book a space', 'Classrooms, library rooms, event spaces, with priority', 'var(--c-study)')}${row('data-go="orginsights"', 'sparkle', 'Attendee insights', 'Favorite snacks, dietary needs, goals and feedback', 'var(--gold-ink)')}${row('data-go="orgchat"', 'chat', 'Members chat', 'Only members who paid dues', 'var(--c-fitness)')}${row(`data-club="${esc(org.id)}"`, 'club', 'Club profile', 'What students see: about, calendar, dues, join', 'var(--c-landmark)')}</div>`;
      return scr('Tools', org, body + `<button class="btn line block" data-go="home">${icon('swap')} Back to the student side</button>`);
    },
    mount(host) { bindHeader(host); },
  };

  // =====================================================================
  // NEWSLETTER (in-app + Gmail)
  // =====================================================================
  let nl = null;
  function nlDraft(org) {
    const ev = upcoming(org).slice(0, 3), rq = reqsFor(org).find(r => r.status === 'open'), o = O(org);
    return { subject: `${org.name}: this week`, body: `Hi everyone,\n\n${ev.length ? 'Coming up:\n' + ev.map(e => `• ${e.title}, ${TH.when(e)}`).join('\n') : 'No events on the calendar yet. Tell us what you want to do.'}\n\n${rq ? `You asked, we heard: “${rq.title}” has ${rq.votes} votes and we’re working on a date.\n\n` : ''}${o.dues ? `Dues are ${money(o.dues)} this semester. Pay in Trojan Hub to join the members chat.\n\n` : ''}Fight on,\n${TH.student().first}` };
  }
  TH.screens.orgnews = {
    render() {
      const org = cur(), o = O(org), ms = roster(org), x = X(); nl = nl && nl.org === org.id ? nl : Object.assign({ org: org.id }, nlDraft(org));
      const gm = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(nl.subject)}&body=${encodeURIComponent(nl.body)}`;
      return scr('Newsletter', org, `
        <form class="card stack" id="nl-form">
          <div class="field"><label for="nl-sub">Subject</label><input id="nl-sub" maxlength="90" value="${esc(nl.subject)}"></div>
          <div class="field"><label for="nl-body">Message</label><textarea id="nl-body" style="height:220px" maxlength="3000">${esc(nl.body)}</textarea></div>
          <div class="field"><label for="nl-to">Send to</label><select id="nl-to"><option value="all">All ${ms.length} members</option><option value="paid">${ms.filter(m => m.paid).length} members who paid dues</option><option value="unpaid">${ms.filter(m => !m.paid).length} members who haven’t paid</option></select></div>
          <div class="btn-row"><button type="button" class="btn ghost" id="nl-ai">${icon('sparkle')} Draft with AI</button><button class="btn">${icon('send')} Send</button></div>
          <span class="muted tiny">${x.conn.gmail ? `One send does both: it posts in each member’s Club Newsletters and emails them from ${esc(TH.student().email || 'your USC Gmail')}.` : 'Gmail isn’t connected, so this will only post in the app.'} Each member’s alert settings decide which one they see.</span>
          <a class="btn line block" href="${esc(gm)}" target="_blank" rel="noopener" id="nl-gmail">${icon('external')} Open this draft in Gmail</a>
        </form>
        ${o.sent.length ? `<div class="section"><div class="section-head"><h2>Sent</h2></div><div class="rows">${o.sent.map(n => `<div class="row" style="--rc:var(--cardinal)"><span class="rico">${icon('mail')}</span><span class="rmain"><span class="rtitle wrap">${esc(n.subject)}</span><span class="rsub wrap">${ago(n.at)} · ${n.count} in the app${n.emailed ? ` · ${n.count} emails` : ''}</span></span></div>`).join('')}</div></div>` : ''}
        ${sim('Sending is simulated: nothing leaves this device. “Open this draft in Gmail” is a real link that opens Gmail with the subject and message filled in.')}`, true);
    },
    mount(host) {
      bindHeader(host); const org = cur();
      const sync = () => { nl.subject = $('#nl-sub', host).value; nl.body = $('#nl-body', host).value; $('#nl-gmail', host).href = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(nl.subject)}&body=${encodeURIComponent(nl.body)}`; };
      $('#nl-sub', host).oninput = sync; $('#nl-body', host).oninput = sync;
      $('#nl-ai', host).onclick = async () => {
        const b = $('#nl-ai', host), base = nlDraft(org); b.disabled = true; b.textContent = 'Drafting…'; let txt = null;
        try { const s = window.claude && window.claude.use ? await window.claude.use('sample') : null; if (s) { const r = await s(`Write a short, warm weekly newsletter email from a USC student club officer named ${TH.student().first} to club members. Under 140 words, plain text, no subject line, no placeholders. Use only these facts:\n\n${base.body}`, { modelTier: 'quick' }); txt = r && r.text; } } catch (e) { txt = null; }
        if (!host.isConnected) return; nl.body = txt || base.body; if (!txt) nl.subject = base.subject; TH.toast(txt ? 'AI draft ready. Edit before sending.' : 'Drafted from your calendar and requests', 'sparkle'); TH.render(true);
      };
      $('#nl-form', host).addEventListener('submit', e => {
        e.preventDefault(); sync(); if (nl.body.trim().length < 10) return TH.toast('Write a message first', 'alert');
        const ms = roster(org), to = $('#nl-to', host).value, list = ms.filter(m => to === 'all' || (to === 'paid') === m.paid), x = X();
        O(org).sent.unshift({ id: uid(), subject: nl.subject, body: nl.body, at: Date.now(), count: list.length, emailed: x.conn.gmail, org: org.name });
        TH.commit(`Sent a newsletter for ${org.name}`); nl = null;
        note('news', `New from ${org.name}`, 'A newsletter from the club’s officers is in Club Newsletters.', 'news');
        TH.toast(`Sent to ${list.length} members${x.conn.gmail ? ' in the app and by email' : ' in the app'} (simulated)`); TH.render(true);
      });
    },
  };

  // =====================================================================
  // AI BUDGET SUMMARY (generated sample ledger)
  // =====================================================================
  function budget(org) {
    const r = k => (hash(org.id + ':' + k) % 100) / 100, R = n => Math.round(n / 5) * 5;
    return ['Fall 2025', 'Spring 2026', 'Fall 2026 so far'].map((name, i) => {
      const k = [1, 1.18, 0.55][i];
      const income = { Dues: R((380 + r('d' + i) * 420) * k), 'USG funding': R((500 + r('u' + i) * 700) * k), Fundraising: R((120 + r('f' + i) * 380) * k) };
      const spend = { Food: R((420 + r('fo' + i) * 380) * k), 'Venue and AV': R((150 + r('v' + i) * 300) * k), Supplies: R((90 + r('s' + i) * 160) * k), Marketing: R((40 + r('m' + i) * 120) * k), Travel: R(r('t' + i) * 260 * k) };
      const events = Math.max(2, Math.round((5 + r('e' + i) * 5) * k)), heads = Math.round(events * (22 + r('h' + i) * 26));
      const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
      return { name, income, spend, events, heads, inTotal: sum(income), outTotal: sum(spend) };
    });
  }
  function budgetFacts(B) {
    const [a, b, c] = B, top = o => Object.entries(o).sort((x, y) => y[1] - x[1])[0], tb = top(b.spend), tc = top(c.spend);
    const chg = Math.round((b.outTotal - a.outTotal) / a.outTotal * 100), per = s => s.outTotal / Math.max(1, s.heads), proj = Math.round(c.outTotal / 0.55 / 5) * 5, room = c.inTotal / 0.55 - proj;
    return [
      `Spending went ${chg >= 0 ? 'up' : 'down'} ${Math.abs(chg)}% from ${a.name} (${money(a.outTotal)}) to ${b.name} (${money(b.outTotal)}).`,
      `${tb[0]} was the biggest cost last semester at ${money(tb[1])}, ${Math.round(tb[1] / b.outTotal * 100)}% of spending. It leads again this semester (${money(tc[1])} so far).`,
      `Each attendee cost about ${money(Math.round(per(b) * 100) / 100)} last semester across ${b.events} events and ${b.heads} check-ins.`,
      `Dues covered ${Math.round(b.income.Dues / b.inTotal * 100)}% of income last semester; USG funding covered ${Math.round(b.income['USG funding'] / b.inTotal * 100)}%.`,
      `At this pace you will spend about ${money(proj)} by the end of ${c.name.replace(' so far', '')}, ${room >= 0 ? `leaving roughly ${money(Math.round(room / 5) * 5)} unspent` : `about ${money(Math.round(-room / 5) * 5)} over projected income`}.`,
      room >= 0 ? `Suggestion: put the cushion toward the most requested student event, and keep ${tc[0].toLowerCase()} under ${money(Math.round(tb[1] * 1.05 / 5) * 5)}.` : `Suggestion: trim ${tc[0].toLowerCase()} or apply for more USG funding before the next event.`,
    ];
  }
  TH.screens.orgbudget = {
    render() {
      const org = cur(); if (org.kind === 'usc') return scr('Budget', org, `<div class="empty">${icon('dollar')}<b>Pick a club</b><span>Budget summaries are for student clubs.</span></div>`, true);
      const B = budget(org), mx = Math.max(...B.flatMap(s => [s.inTotal, s.outTotal])), facts = budgetFacts(B);
      return scr('AI Budget Summary', org, `
        <div class="x-ai" id="bg-ai"><span class="eyebrow">${icon('sparkle')} Tommy on your budget</span><ul>${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button class="linkbtn" id="bg-ai-btn" style="color:var(--cardinal-ink);font-weight:650">Write this up with AI</button></div>
        <div class="section"><div class="section-head"><h2>Money in and out</h2></div><div class="card stack" style="gap:12px">${B.map(s => `<div class="stack" style="gap:5px"><b style="font-size:13.5px">${esc(s.name)}</b><div class="x-bar"><span>Income</span><span class="t"><i class="in" style="width:${Math.round(s.inTotal / mx * 100)}%"></i></span><span>${money(s.inTotal)}</span></div><div class="x-bar"><span>Spent</span><span class="t"><i style="width:${Math.round(s.outTotal / mx * 100)}%"></i></span><span>${money(s.outTotal)}</span></div></div>`).join('')}</div></div>
        ${B.slice(1).map(s => { const m2 = Math.max(...Object.values(s.spend), 1); return `<div class="section"><div class="section-head"><h2>${esc(s.name)}: spending</h2><span class="muted tiny">${s.events} events · ${s.heads} check-ins</span></div><div class="card stack" style="gap:8px">${Object.entries(s.spend).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="x-bar"><span>${esc(k)}</span><span class="t"><i style="width:${Math.round(v / m2 * 100)}%"></i></span><span>${money(v)}</span></div>`).join('')}</div></div>`; }).join('')}
        ${sim('Sample ledger generated for this demo. In a real launch the numbers come from dues paid in the app and the expenses officers log.')}`, true);
    },
    mount(host) {
      bindHeader(host); const b = $('#bg-ai-btn', host); if (!b) return;
      b.onclick = () => { const B = budget(cur()), facts = budgetFacts(B); ai($('#bg-ai', host), 'You advise a university student club treasurer. Write a 4-sentence budget summary and one concrete recommendation for the current semester, using only the facts and ledger below. Plain text.\n\nFACTS\n' + facts.join('\n') + '\n\nLEDGER\n' + B.map(s => `${s.name}: income ${JSON.stringify(s.income)}, spending ${JSON.stringify(s.spend)}, ${s.events} events, ${s.heads} check-ins`).join('\n'), facts.join('\n')); };
    },
  };

  // =====================================================================
  // BOOK A SPACE: classrooms and library rooms, with priority
  // =====================================================================
  const SPACES = { Classroom: ['Taper Hall (THH)', 'Von KleinSmid Center (VKC)', 'Grace Ford Salvatori Hall (GFS)', 'Kaprielian Hall (KAP)', 'Seeley G. Mudd (SGM)'], 'Library room': ['Leavey Library group study room', 'Doheny Library meeting room'], 'Event space': ['Tutor Campus Center room', 'McCarthy Quad', 'Trousdale Parkway table'] };
  let spType = 'Classroom';
  function priority(org, reqId, heads) {
    const r = reqId ? X().evreqs.find(q => q.id === reqId) : null; let pts = org.kind === 'usc' ? 3 : (org.club && org.club.registered ? 2 : 1); const why = [org.kind === 'usc' ? 'USC office' : org.club && org.club.registered ? 'Registered student organization' : 'Not registered yet'];
    if (r) { pts += r.votes >= 20 ? 2 : 1; why.push(`Students asked for it (${r.votes} votes)`); }
    if (heads >= 40) { pts += 1; why.push('Large turnout expected'); }
    return { label: pts >= 4 ? 'High' : pts >= 3 ? 'Medium' : 'Standard', tone: pts >= 4 ? 'ok' : pts >= 3 ? 'gold' : 'mute', why };
  }
  TH.screens.orgspace = {
    render() {
      const org = cur(), o = O(org), rq = reqsFor(org).filter(r => r.status === 'open').slice(0, 6), dk = TH.dkey(TH.addDays(TH.clock.now(), 7));
      return scr('Book a Space', org, `
        <form class="card stack" id="sp-form">
          <div class="seg" role="group" aria-label="Kind of space">${Object.keys(SPACES).map(t => `<button type="button" data-spt="${t}" aria-pressed="${spType === t}">${t}</button>`).join('')}</div>
          <div class="field"><label for="sp-place">Where</label><select id="sp-place">${SPACES[spType].map(p => `<option>${esc(p)}</option>`).join('')}</select></div>
          <div class="grid2"><div class="field"><label for="sp-date">Date</label><input id="sp-date" type="date" value="${dk}" min="${TH.dkey(TH.clock.now())}"></div><div class="field"><label for="sp-time">Start</label><input id="sp-time" type="time" value="18:00"></div></div>
          <div class="grid2"><div class="field"><label for="sp-len">Length</label><select id="sp-len"><option>1 hour</option><option selected>2 hours</option><option>3 hours</option></select></div><div class="field"><label for="sp-heads">People expected</label><input id="sp-heads" type="number" min="2" max="500" value="30"></div></div>
          <div class="field"><label for="sp-req">For a requested event (raises priority)</label><select id="sp-req"><option value="">Not tied to a request</option>${rq.map(r => `<option value="${esc(r.id)}">${esc(r.title)} · ${r.votes} votes</option>`).join('')}</select></div>
          <div class="x-route" id="sp-pri"></div>
          <button class="btn block">${icon('building')} Request this space</button>
        </form>
        ${o.bookings.length ? `<div class="section"><div class="section-head"><h2>Your space requests</h2></div><div class="rows">${o.bookings.map(b => `<div class="row" style="--rc:var(--c-study)"><span class="rico">${icon('building')}</span><span class="rmain"><span class="rtitle wrap">${esc(b.place)}</span><span class="rsub wrap">${esc(b.when)} · ${b.heads} people · ${esc(b.pri)} priority</span></span><span class="rside"><span class="pill ${b.status === 'approved' ? 'ok' : 'warn'}">${b.status === 'approved' ? 'Approved' : 'Pending'}</span></span></div>`).join('')}</div></div>` : ''}
        ${sim('Simulated. Classroom requests would go to Classroom Scheduling, library rooms to USC Libraries and event spaces to Trojan Event Services. The priority rules are this prototype’s proposal.')}`, true);
    },
    mount(host) {
      bindHeader(host); const org = cur();
      const pri = () => { const p = priority(org, $('#sp-req', host).value, +$('#sp-heads', host).value || 0); $('#sp-pri', host).innerHTML = `<span class="muted tiny">Priority for this request</span><b>${p.label} <span class="pill ${p.tone}" style="vertical-align:2px">${p.label === 'High' ? 'Reviewed first' : p.label === 'Medium' ? 'Reviewed soon' : 'Standard queue'}</span></b><span style="font-size:13px">${esc(p.why.join(' · '))}</span>`; return p; };
      pri(); $('#sp-req', host).onchange = pri; $('#sp-heads', host).oninput = pri;
      host.addEventListener('click', e => { const b = e.target.closest('[data-spt]'); if (b) { spType = b.dataset.spt; TH.render(true); } });
      $('#sp-form', host).addEventListener('submit', e => {
        e.preventDefault(); const dv = $('#sp-date', host).value, tv = $('#sp-time', host).value || '18:00'; if (!dv) return TH.toast('Pick a date', 'alert');
        const d = TH.laDate(`${dv}T${tv}:00`), p = pri();
        O(org).bookings.unshift({ id: uid(), type: spType, place: $('#sp-place', host).value, when: `${TH.fmtDate(d)} · ${TH.fmtTime(d)} · ${$('#sp-len', host).value}`, heads: +$('#sp-heads', host).value || 0, pri: p.label, status: 'pending', at: Date.now(), org: org.name });
        TH.commit(`Requested ${$('#sp-place', host).value} for ${org.name}`); TH.toast(`Requested with ${p.label.toLowerCase()} priority. You’ll get a note when it’s approved.`); TH.render(true);
      });
    },
  };

  // =====================================================================
  // ATTENDEE INSIGHTS + FEEDBACK (AI-summarized totals; never demographics)
  // =====================================================================
  function tally(org, key, n, opts) { const out = {}; for (let i = 0; i < n; i++) { const h = hash(org.id + key + i); if (key === 'diet' && h % 3) continue; const v = opts[h % opts.length]; out[v] = (out[v] || 0) + 1; if (key !== 'diet' && h % 5 === 0) { const v2 = opts[(h >>> 3) % opts.length]; out[v2] = (out[v2] || 0) + 1; } } return out; }
  function insights(org) {
    const n = 18 + hash(org.id) % 20, p = X().profile, me = !!member(org.id), T = {};
    PF.forEach(([k, , opts]) => { T[k] = tally(org, k, k === 'goals' ? Math.round(n * 0.6) : n, opts); });
    if (me) { if (p.shareFood) ['snacks', 'drinks', 'diet'].forEach(k => p[k].forEach(v => { T[k][v] = (T[k][v] || 0) + 1; })); if (p.shareHobbies) p.hobbies.forEach(v => { T.hobbies[v] = (T.hobbies[v] || 0) + 1; }); if (p.shareGoals) p.goals.forEach(v => { T.goals[v] = (T.goals[v] || 0) + 1; }); }
    const topN = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
    return { n: n + (me ? 1 : 0), T, topN, me };
  }
  function insightText(I) {
    const t = (k, n) => I.topN(I.T[k], n), d = t('diet', 4);
    return `Of ${I.n} people signed up, most would be happy with ${t('snacks', 2).map(x => x[0].toLowerCase()).join(' and ')}, with ${t('drinks', 2).map(x => x[0].toLowerCase()).join(' and ')} to drink. ${d.length ? `Plan for ${d.map(x => `${x[1]} ${x[0].toLowerCase()}`).join(', ')}, and label the food.` : 'No dietary needs were shared.'} Among those who shared career goals, ${t('goals', 2).map(x => x[0].toLowerCase()).join(' and ')} come up most, so a speaker or workshop in those areas should land well. Common interests: ${t('hobbies', 3).map(x => x[0].toLowerCase()).join(', ')}.`;
  }
  function feedback(org) {
    const h = hash(org.id + 'fb'), up = 30 + h % 40, down = 4 + h % 9, x = X();
    const mine = Object.values(x.fb).filter(f => String(f.org) === org.id && f.v);
    const whys = { 'Bad time for me': 2 + h % 4, 'Too far away': 1 + h % 3, 'Not my kind of thing': 1 + (h >>> 2) % 3 };
    mine.forEach(f => { if (f.v < 0 && f.why) whys[f.why] = (whys[f.why] || 0) + 1; });
    const u = up + mine.filter(f => f.v > 0).length, d = down + mine.filter(f => f.v < 0).length, tw = Object.entries(whys).sort((a, b) => b[1] - a[1]);
    return { up: u, down: d, whys: tw, text: `${Math.round(u / (u + d) * 100)}% of ${u + d} ratings were a thumbs up. The most common reason for a thumbs down is “${tw[0][0].toLowerCase()}” (${tw[0][1]}), so try a different time slot before changing the event itself.` };
  }
  TH.screens.orginsights = {
    render() {
      const org = cur(); if (org.kind === 'usc') return scr('Insights', org, `<div class="empty">${icon('sparkle')}<b>Pick a club</b><span>Attendee insights are for club events.</span></div>`, true);
      const I = insights(org), F = feedback(org), ev = upcoming(org)[0];
      const block = (k, label) => { const rows = I.topN(I.T[k], 5), mx = Math.max(1, ...rows.map(r => r[1])); return `<div class="section"><div class="section-head"><h2>${label}</h2></div><div class="card stack" style="gap:8px">${rows.length ? rows.map(([v, c]) => `<div class="x-bar"><span>${esc(v)}</span><span class="t"><i style="width:${Math.round(c / mx * 100)}%"></i></span><span>${c}</span></div>`).join('') : '<span class="muted">Nobody shared this.</span>'}</div></div>`; };
      return scr('Attendee Insights', org, `
        <p class="muted" style="font-size:13.5px">${ev ? `For <b>${esc(ev.title)}</b>, ${esc(TH.when(ev))}.` : 'For your next event.'} ${I.n} signed up.</p>
        <div class="x-ai" id="in-ai"><span class="eyebrow">${icon('sparkle')} Tommy on who’s coming</span><span>${esc(insightText(I))}</span><button class="linkbtn" id="in-ai-btn" style="color:var(--cardinal-ink);font-weight:650">Rewrite with AI</button></div>
        ${block('snacks', 'Favorite snacks')}${block('drinks', 'Favorite drinks')}${block('diet', 'Dietary needs')}${block('goals', 'Career goals')}
        <div class="section"><div class="section-head"><h2>Feedback on past events</h2><span class="muted tiny">${F.up} up · ${F.down} down</span></div>
          <div class="x-ai"><span class="eyebrow">${icon('sparkle')} Tommy on the feedback</span><span>${esc(F.text)}</span></div>
          <div class="card stack" style="gap:8px">${F.whys.map(([w, c]) => `<div class="x-bar"><span>${esc(w)}</span><span class="t"><i style="width:${Math.round(c / F.whys[0][1] * 100)}%"></i></span><span>${c}</span></div>`).join('')}</div></div>
        <div class="banner ok">${icon('lock')}<div><b>Only what students chose to share</b><span>Totals come from profile answers students opted to share with clubs they sign up for. No race, gender or other demographic data is collected or shown.${I.me ? ' Your own shared answers are counted in.' : ''}</span></div></div>
        ${sim('Sample totals generated for this demo, plus the demo student’s own shared profile and thumbs.')}`, true);
    },
    mount(host) {
      bindHeader(host); const b = $('#in-ai-btn', host); if (!b) return;
      b.onclick = () => { const I = insights(cur()); ai($('#in-ai', host), 'You help a university club officer plan an event. In 3 short sentences say what food and drinks to order, which dietary needs to plan for, and what kind of programming fits attendees’ career goals. Plain text. Use only these totals.\n\n' + PF.map(([k, label]) => `${label}: ${I.topN(I.T[k], 6).map(x => `${x[0]} ${x[1]}`).join(', ')}`).join('\n') + `\nSigned up: ${I.n}`, insightText(I)); };
    },
  };

  // =====================================================================
  // USC OFFICE INBOX: problem reports + flagged Tommy questions
  // =====================================================================
  const SAMPLE_REPORTS = [
    { id: 'TR-2041', cat: 'facilities', desc: 'Elevator in Leavey Library stuck on the second floor', where: 'Leavey Library', office: RC.facilities[2], team: RC.facilities[3], at: Date.now() - 3 * 36e5, status: 2, photos: [], sample: true },
    { id: 'TR-2038', cat: 'it', desc: 'eduroam keeps dropping in Taper Hall lecture rooms', where: 'Taper Hall', office: RC.it[2], team: RC.it[3], at: Date.now() - 9 * 36e5, status: 1, photos: [], sample: true },
  ];
  function answerGap(g) {
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${esc(g.why)}</span><h2>“${esc(g.q)}”</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${g.given ? `<div class="card flat"><b>What Tommy said</b><p class="muted" style="font-size:13px;margin-top:4px">${esc(g.given)}</p></div>` : ''}
      <div class="field"><label for="gp-a">The correct answer, with its USC source</label><textarea id="gp-a" maxlength="600" placeholder="Write the checked answer Tommy should give from now on"></textarea></div>
      <div class="err" hidden></div><div class="btn-row"><button class="btn line" data-close>Cancel</button><button class="btn" id="gp-ok">Publish answer</button></div>
      ${sim('Publishing teaches Tommy this answer in this demo and notifies the student who asked.')}</div>`, w => {
      $('#gp-ok', w).onclick = () => { const a = $('#gp-a', w).value.trim(), er = $('.err', w); if (a.length < 10) { er.hidden = false; er.textContent = 'Write the full answer.'; return; } g.answer = a; g.status = 'answered'; g.answeredAt = Date.now(); save(); TH.closeSheet(); if (!g.sample) note('tommy', 'Tommy can answer your question now', `“${g.q}”: ${a.slice(0, 80)}`, 'assistant:' + g.q); TH.toast('Published. Tommy now answers this.'); TH.render(true); };
    });
  }
  TH.screens.orginbox = {
    render() {
      const org = cur(), x = X(), reps = [...x.reports, ...SAMPLE_REPORTS], gaps = x.gaps;
      return scr('Inbox', org, `
        <div class="section"><div class="section-head"><h2>Problem reports</h2><span class="muted tiny">${reps.filter(r => r.status < 3).length} open</span></div>
          <div class="rows">${reps.map(r => `<div class="row" style="--rc:var(--c-safety);align-items:flex-start"><span class="rico">${r.photos && r.photos[0] ? `<img src="${r.photos[0]}" alt="Photo from the report" style="width:38px;height:38px;object-fit:cover;border-radius:12px">` : icon('flag')}</span><span class="rmain"><span class="rtitle wrap">${esc(r.desc)}</span><span class="rsub wrap">${esc(r.id)} · ${esc(r.where || 'no location')} · to ${esc(r.office)} · ${ago(r.at)}${r.urgent ? ' · urgent' : ''}${r.sample ? ' · sample' : ''}</span></span><span class="rside">${r.status < 3 ? `<button class="btn sm line" data-adv="${esc(r.id)}">${['Route', 'Start work', 'Resolve'][r.status]}</button>` : `<span class="pill ok">Resolved</span>`}</span></div>`).join('')}</div></div>
        <div class="section"><div class="section-head"><h2>Questions Tommy couldn’t answer</h2><span class="muted tiny">Target: answered within 24 hours</span></div>
          <div class="rows">${gaps.length ? gaps.map(g => `<div class="row" style="--rc:var(--gold-ink);align-items:flex-start"><span class="rico">${icon('sparkle')}</span><span class="rmain"><span class="rtitle wrap">“${esc(g.q)}”</span><span class="rsub wrap">${esc(g.why)} · open ${ago(g.at).replace(' ago', '')}${g.sample ? ' · sample' : ''}${g.answer ? ' · ' + esc(g.answer.slice(0, 70)) : ''}</span></span><span class="rside">${g.answer ? `<span class="pill ok">Answered</span>` : `<button class="btn sm" data-gap="${esc(g.id)}">Answer</button>`}</span></div>`).join('') : `<div class="empty">${icon('check')}<b>Nothing waiting</b><span>Every question students asked has an answer.</span></div>`}</div></div>
        ${sim('Staff view on the demo account. Advancing a report updates the student’s tracker and notifies them the way they chose.')}`, true);
    },
    mount(host) {
      bindHeader(host);
      host.addEventListener('click', e => {
        const a = e.target.closest('[data-adv]'), g = e.target.closest('[data-gap]');
        if (g) { const gap = X().gaps.find(q => q.id === g.dataset.gap); if (gap) answerGap(gap); return; }
        if (!a) return; const r = X().reports.find(q => q.id === a.dataset.adv) || SAMPLE_REPORTS.find(q => q.id === a.dataset.adv); if (!r) return;
        r.status = Math.min(3, r.status + 1); if (r.status === 3) r.reply = 'Fixed. Thanks for reporting it.'; save();
        if (!r.sample) note('reports', `Report ${r.id}: ${STAT[r.status].toLowerCase()}`, r.status === 3 ? `${r.office} marked it fixed.` : `${r.office} updated your report.`, 'report');
        TH.toast(`${r.id} is now ${STAT[r.status].toLowerCase()}`); TH.render(true);
      });
    },
  };

  // =====================================================================
  // SHELL: organizer tab bar, side switching, boot
  // =====================================================================
  const OTAB = { orgtommy: 'orgtommy', org: 'org', orgreq: 'orgreq', orgmem: 'orgmem', orgchat: 'orgmem', orgtools: 'orgtools', orgnews: 'orgtools', orgbudget: 'orgtools', orgspace: 'orgtools', orginsights: 'orgtools', orginbox: 'orgtools' };
  function syncNav() {
    const isOrg = /^org/.test(TH.state.route), sn = $('.tabbar:not(.x-org)'), on = $('.tabbar.x-org'); if (!sn || !on) return;
    sn.hidden = isOrg; on.hidden = !isOrg;
    $$('[data-otab]', on).forEach(b => b.dataset.otab === OTAB[TH.state.route] ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  }
  TH.xo = { cur, O, scr, header, bindHeader, priority, reqsFor, orgs, roster, duesTotals, money, upcoming };
  const boot0 = TH.boot;
  TH.boot = function () {
    if (/^#org/.test(location.hash)) { try { location.hash = '#home'; } catch (e) { /* stay */ } } // the app always opens on the student side
    boot0.apply(this, arguments);
    const dev = $('.device'); if (!dev || $('.tabbar.x-org', dev)) return;
    dev.insertAdjacentHTML('beforeend', `<nav class="tabbar x-org" aria-label="Organizer" hidden>
      <button data-otab="org">${icon('grid')}Dashboard</button><button data-otab="orgreq">${icon('megaphone')}Requests</button><button data-otab="orgtommy">${icon('sparkle')}Tommy</button><button data-otab="orgmem">${icon('users')}Members</button><button data-otab="orgtools">${icon('layers')}Tools</button></nav>`);
    $$('.tabbar.x-org [data-otab]').forEach(b => b.onclick = () => { if (b.dataset.otab === '@student') { TH.go('home'); TH.toast('Student side', 'swap'); } else TH.go(b.dataset.otab); });
    const host = $('#screen-host'); if (host) new MutationObserver(syncNav).observe(host, { childList: true });
    syncNav();
    try { TH.x.wrapTommy(); TH.x.initVoice(); } catch (e) { console.error(e); }
    setInterval(() => { try { TH.x.tick(); } catch (e) { console.error(e); } }, 4000);
  };
})(window.TH = window.TH || {});
