/* js/clubs.js */
/* Trojan Hub — Explore Clubs (2,000 real EngageSC groups) and the club sheet.
 *
 * Data: TH.CLUBS / TH.CLUB_CATS / TH.CLUB_EVENTS (js/clubs-data.js, EngageSC public directory and
 * public events feed, snapshot Nov 9, 2026); TH.CLUB_PHOTOS (js/club-photos.js, real EngageSC logos and
 * event photos). Joining is SIMULATED on the demo student through TH.act.joinClub (js/actions.js), which
 * puts the club's real upcoming events on My Day.
 *
 * Part 6: the list is a scroll of compact, fun cards (cover/logo, name, one short tagline, ≤2 chips, a match
 * badge) with snap rails on top (For you, Meets this week, Free food, categories), sticky search + filters,
 * personal filters (For you / Career / Your major, from TH.clubMatch in js/p6-clubs.js) and lazy loading of
 * all 2,000 groups. The club sheet opens on a swipeable photo hero.
 * Side-effect free at load: defines TH.screens.clubs, TH.openClub and small helpers.
 */
(function (TH) {
  'use strict';
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasTA = () => !!(window.TA && TA.State && TA.State.d);
  const hub = () => (hasTA() ? TH.H() : { calendar: [], clubs: [] });
  const CHUNK = 30;
  const DIRECTORY = 'https://engage.usc.edu/club_signup?view=all&';

  // ---------- friendly category groups (built from EngageSC's own category names) ----------
  const GROUPS = [
    ['academic', 'Academic', 'book', ['Academic']],
    ['career', 'Career & pre-pro', 'bag', ['Career', 'Pre-Professional']],
    ['social', 'Social', 'users', ['Social']],
    ['culture', 'Culture', 'globe', ['Ethnic/Cultural']],
    ['service', 'Service', 'health', ['Service', 'Civic Engagement', 'Social Awareness']],
    ['arts', 'Arts & media', 'sparkle', ['Visual & Performing Arts', 'Media/Publications']],
    ['sports', 'Sports & rec', 'dumbbell', ['Club Sport', 'Recreation']],
    ['health', 'Wellness', 'health', ['Health & Wellness']],
    ['faith', 'Faith', 'star', ['Spiritual']],
    ['politics', 'Politics', 'info', ['Political']],
    ['gov', 'Student government', 'users', ['Student Government', 'Undergraduate Student Government']],
    ['greek', 'Greek life', 'users', ['Fraternity & Sorority Life', 'Multicultural Greek Council', 'Panhellenic Council', 'National Pan-Hellenic Council', 'Interfraternity Council', 'Asian Greek Council', 'Order of Omega']],
    ['eng', 'Engineering', 'bolt', ['Viterbi Student Organization', 'Design Team']],
    ['green', 'Sustainability', 'sun', ['Environmental/Sustainability']],
    ['dept', 'USC departments', 'info', ['Campus Department', 'Residential Education', 'Student Life']],
  ];
  const GHUE = { academic: 222, career: 38, social: 330, culture: 14, service: 152, arts: 280, sports: 170, health: 350, faith: 48, politics: 205, gov: 0, greek: 262, eng: 196, green: 120, dept: 20 };
  TH.CLUB_GROUPS = GROUPS;
  const groupOf = {}; GROUPS.forEach(([k, , , cats]) => cats.forEach(c => { groupOf[c] = k; }));
  TH.clubCatLabel = function (cat) { const k = groupOf[cat]; const g = GROUPS.find(x => x[0] === k); return g ? g[1] : (!cat || cat === 'Other' ? 'Student organization' : cat); };
  const clubGroups = c => { const s = new Set(); (c.cats && c.cats.length ? c.cats : [c.cat]).forEach(x => { if (groupOf[x]) s.add(groupOf[x]); }); return s; };
  TH.clubGroupsOf = clubGroups;
  const SHORT = { 'Student government': 'Student gov', 'Student organization': 'Club' };
  const shortCat = c => { let k = groupOf[c.cat]; if (!k) k = [...clubGroups(c)][0]; const g = GROUPS.find(x => x[0] === k), l = g ? g[1] : 'Student organization'; return SHORT[l] || l; };

  // ---------- lazy indexes ----------
  let IDX = null;
  function index() {
    // keyed on the (demo) clock minute: upcoming counts and order depend on "now", which can move back and forth
    const now = TH.clock.now(), key = (TH.CLUBS || []).length + '|' + (TH.CLUB_EVENTS || []).length + '|' + TH.dkey(now) + '|' + TH.minOfDay(now);
    if (IDX && IDX.key === key) return IDX;
    const evBy = {}; // every dated event per group; upcomingFor() filters by the current time
    (TH.CLUB_EVENTS || []).forEach(e => { if (e.start) (evBy[e.orgId] || (evBy[e.orgId] = [])).push(e); });
    Object.values(evBy).forEach(a => a.sort((p, q) => TH.laDate(p.start) - TH.laDate(q.start)));
    const wk = TH.addDays(now, 7), two = TH.addDays(now, 14), act = {};
    const rows = (TH.CLUBS || []).map(c => {
      const evs = (evBy[c.id] || []).filter(e => TH.laDate(e.end || e.start) >= now);
      const single = evs.filter(e => !e.multiDay && !e.allDay).map(e => [e, TH.laDate(e.start)]).filter(([, s]) => s >= now);
      const week = single.find(([, s]) => s <= wk), food = single.find(([e, s]) => e.food && s <= two);
      act[c.id] = { up: evs.length, week: week ? { e: week[0], s: week[1] } : null, weekN: single.filter(([, s]) => s <= wk).length, food: food ? { e: food[0], s: food[1] } : null };
      return { c, g: clubGroups(c), hay: (c.name + ' ' + (c.cats || []).join(' ') + ' ' + (c.type || '') + ' ' + (c.desc || '')).toLowerCase(), name: c.name.toLowerCase(), up: evs.length };
    });
    // registered first, then groups with upcoming events, then A–Z
    rows.sort((a, b) => (b.c.registered === true) - (a.c.registered === true) || (b.up > 0) - (a.up > 0) || a.name.localeCompare(b.name));
    const counts = {}; rows.forEach(r => r.g.forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
    IDX = { key, n: (TH.CLUBS || []).length, rows, evBy, counts, act, day: TH.dkey(now) };
    return IDX;
  }
  const upcomingFor = id => (index().evBy[id] || []).filter(e => TH.laDate(e.end || e.start) >= TH.clock.now());
  TH.clubActivity = id => index().act[id] || { up: 0, week: null, weekN: 0, food: null };

  // ---------- small pieces ----------
  const initials = name => String(name || '?').replace(/^(The|USC|Trojan)\s+/i, '').split(/[\s\-–&/]+/).filter(w => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const hue = id => { let s = 0; for (const ch of String(id)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return s % 360; };
  // Real EngageSC logo (bundled as a data URI in js/club-photos.js) when we have one, initials otherwise.
  function logo(c, size = 'md') {
    if (TH.clubThumb) return TH.clubThumb(c, size);
    return `<span class="club-logo ${size}" style="--lh:${hue(c.id)}" aria-hidden="true"><b>${esc(initials(c.name))}</b></span>`;
  }
  // Logos fade in once loaded; a broken image is removed so the initials underneath show.
  function bindLogos(root) {
    const isLogo = t => t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList.contains('club-logo');
    root.addEventListener('error', e => { if (isLogo(e.target)) e.target.remove(); }, true);
  }
  TH.bindClubLogos = bindLogos;
  const engageUrl = c => c.engage || (c.url && /engage\.usc\.edu/.test(c.url) ? c.url : null);
  const isJoined = id => hub().clubs.some(m => String(m.id) === String(id));
  const tagline = c => (TH.clubTagline ? TH.clubTagline(c) : (c.desc || '').slice(0, 58));
  const match = c => (TH.clubMatch ? TH.clubMatch(c) : { score: 0, why: [] });
  const cover = (c, o) => (TH.clubCover ? TH.clubCover(c, o) : `<span class="ccv gen p0 ${o && o.size || 'md'}" style="--h:${hue(c.id)}"><b>${esc(initials(c.name))}</b></span>`);
  const hasImg = c => !!(TH.clubPhotos && TH.clubPhotos(c).length);
  const when = s => `${TH.ui.dayLabel(s)} · ${TH.fmtTime(s)}`;
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const shortDay = s => { const d = TH.ui.dayLabel(s); return /^(Today|Tomorrow|Tonight)$/i.test(d) ? d : DOW[s.getDay()] + ' ' + s.getDate(); };
  // ≤ 2 chips: the category + the single most useful "why now"
  function chips(c, a) {
    const out = [`<span class="cl-chip" style="--gh:${GHUE[[...clubGroups(c)][0]] ?? hue(c.id)}">${esc(shortCat(c))}</span>`];
    if (a.food) out.push(`<span class="cl-chip food">★ Free food soon</span>`);
    else if (a.week || c.meeting) out.push(`<span class="cl-chip week">${icon('calendar')}Meets this week</span>`);
    else if (c.open) out.push(`<span class="cl-chip join">${icon('users')}Join online</span>`);
    return out.join('');
  }
  const badge = (m, joined, big) => joined ? `<span class="cl-badge joined">${icon('check')}Joined</span>`
    : m && m.score >= 3 ? `<span class="cl-badge match ${m.score >= 8 ? 'top' : ''}" title="${esc(m.why.join(' · '))}">${icon('sparkle')}${m.score >= 8 && big ? 'Top match' : 'Match'}</span>` : '';

  // under a personal filter, the one-liner says WHY this club is on YOUR list ("Your goal: Software engineering")
  // Personal filters have their own keys ('mycareer', 'mymajor') so they never collide with EngageSC's
  // "Career & pre-pro" category group ('career').
  const isMe = f => f === 'foryou' || f === 'mycareer' || f === 'mymajor';
  const kindOf = f => (f === 'mycareer' ? 'career' : f === 'mymajor' ? 'major' : 'foryou');
  function whyLine(m, f) {
    if (!m || !m.why || !m.why.length) return '';
    const pick = re => m.why.find(x => re.test(x)) || '';
    const w = f === 'mycareer' ? pick(/^(Matched|Related) to your goal: /) : f === 'mymajor' ? pick(/^(Fits|Related to) your (major|minor): /) : m.why[0];
    return w.replace(/^Matched to your goal: /, 'Your goal: ').replace(/^Related to your goal: /, 'Related to: ')
      .replace(/^Fits your (major|minor): /, 'Your $1: ').replace(/^Related to your (major|minor): /, 'Related to your $1: ');
  }
  // a compact list card (the whole 2,000 scroll is these). No per-row animation or containment: rows are
  // grouped in chunks (see chunkHTML) so a long scroll stays cheap.
  function clubRow(r) {
    const c = r.c, a = TH.clubActivity(c.id), joined = isJoined(c.id), m = match(c), f = UI().f;
    const wl = isMe(f) ? whyLine(m, f) : '';
    return `<button class="cl-row" data-club="${esc(c.id)}">${logo(c, 'md')}
      <span class="cl-main"><span class="cl-name">${esc(c.name)}</span>
        ${wl ? `<span class="cl-tag cl-wl">${icon('sparkle')}${esc(wl)}</span>` : `<span class="cl-tag">${esc(tagline(c))}</span>`}
        <span class="cl-chips">${chips(c, a)}</span></span>
      <span class="cl-side">${wl && !joined ? '' : badge(m, joined)}${icon('chev', 'chev')}</span></button>`; // under a personal filter every row matches: the reason line replaces the badge
  }
  // one chunk of rows; the browser skips layout and paint for chunks that are off screen (content-visibility on
  // ~67 chunk wrappers instead of 2,000 rows). Under Career / Your major the weaker matches sit under "Also related".
  function chunkHTML(L, from, to) {
    const rows = L.rows.slice(from, to);
    let html = '';
    rows.forEach((r, k) => {
      const i = from + k;
      if (L.tiers && L.strong > 0 && L.tiers[i] === 2 && (i === 0 || L.tiers[i - 1] === 1)) html += `<p class="cl-also"><b>Also related</b><span>${L.kind === 'major' ? 'Weaker matches for your major, and grad-student groups' : 'Weaker matches for your goals, and grad-student groups'}</span></p>`;
      html += clubRow(r);
    });
    return `<div class="cl-chunk ${from ? '' : 'first'}" style="contain-intrinsic-size:auto ${rows.length * 92}px">${html}</div>`;
  }
  // a rail card: cover on top, then name + one line
  function railCard(c, o = {}) {
    const a = TH.clubActivity(c.id), m = match(c), joined = isJoined(c.id);
    const over = o.ev ? `<span class="cl-when ${o.ev.e.food ? 'food' : ''}">${o.ev.e.food ? '★ ' : ''}${esc(shortDay(o.ev.s))} · ${esc(TH.fmtTime(o.ev.s))}</span>` : '';
    const line = o.ev ? o.ev.e.title : tagline(c);
    return `<button class="cl-card" data-club="${esc(c.id)}">
      <span class="cl-cv">${cover(c, { size: 'card' })}${over}${o.badge !== false ? badge(m, joined, true) : ''}</span>
      <span class="cl-cbody"><span class="cl-cname">${hasImg(c) ? logo(c, 'sm') : ''}<b>${esc(c.name)}</b></span>
        <span class="cl-cline">${esc(line)}</span>
        ${o.why && m.why[0] ? `<span class="cl-why">${icon('sparkle')}${esc(m.why[0].replace(/^Matched to your goal: /, 'Your goal: ').replace(/^Related to your goal: /, 'Related to: '))}</span>` : `<span class="cl-chips">${chips(c, a)}</span>`}</span></button>`;
  }
  const rail = (title, sub, cards, more) => cards.length ? `<section class="cl-rail"><div class="section-head"><h2>${title}</h2>${more || ''}</div>${sub ? `<p class="cl-sub">${sub}</p>` : ''}<div class="carousel cl-cards">${cards.join('')}</div></section>` : '';

  // ---------- filters ----------
  const PERSONAL = [['foryou', 'For you', 'sparkle'], ['mycareer', 'Career', 'bag'], ['mymajor', 'Your major', 'book']];
  const QUICK = [['week', 'This week', 'calendar'], ['food', 'Free food', 'star'], ['open', 'Join online', 'users']];
  const UI = () => { const u = TH.state.clubs || (TH.state.clubs = {}); if (u.f == null) { u.f = u.cat && u.cat !== 'all' ? u.cat : (u.open ? 'open' : 'all'); } if (u.q == null) u.q = ''; return u; };
  // the filtered list is computed once per redraw and reused by every "load more" (it used to be recomputed per chunk)
  let LIST = null;
  function listFor(fresh) {
    const U = UI(), key = U.f + '|' + U.q;
    if (!fresh && LIST && LIST.key === key) return LIST;
    const { rows, info } = filtered();
    const tiers = info && (info.kind === 'career' || info.kind === 'major') ? info.rows.map(o => o.tier || 1) : null;
    LIST = { key, rows, info, tiers, strong: tiers ? tiers.filter(t => t === 1).length : 0, kind: info && info.kind };
    return LIST;
  }
  function filtered() {
    const U = UI(), I = index(), q = U.q.trim().toLowerCase(), f = U.f;
    const words = q ? q.split(/\s+/).filter(Boolean) : [];
    let rows, info = null;
    if (isMe(f)) {
      info = TH.clubPersonal ? TH.clubPersonal(kindOf(f)) : { ok: false, rows: [], values: [] };
      const byId = new Map(I.rows.map(r => [r.c.id, r]));
      if (words.length) info = Object.assign({}, info, { rows: info.rows.filter(o => byId.has(o.c.id) && words.every(w => byId.get(o.c.id).hay.includes(w))) });
      rows = info.rows.map(o => byId.get(o.c.id)).filter(Boolean);
      return { rows, info }; // personal lists keep their strongest-first order (and their "Also related" split) while searching
    } else {
      rows = I.rows.filter(r => f === 'all' ? true : f === 'week' ? !!(I.act[r.c.id].week || r.c.meeting) : f === 'food' ? !!I.act[r.c.id].food : f === 'open' ? r.c.open : r.g.has(f));
      if (f === 'week') rows.sort((a, b) => (I.act[a.c.id].week ? I.act[a.c.id].week.s : 9e15) - (I.act[b.c.id].week ? I.act[b.c.id].week.s : 9e15));
      if (f === 'food') rows.sort((a, b) => I.act[a.c.id].food.s - I.act[b.c.id].food.s);
    }
    if (words.length) {
      rows = rows.filter(r => words.every(w => r.hay.includes(w)));
      rows = rows.map(r => [r, (r.name.startsWith(q) ? 3 : r.name.includes(q) ? 2 : 0) + (r.c.registered ? 1 : 0)]).sort((a, b) => b[1] - a[1]).map(x => x[0]); // stable within ties
    }
    return { rows, info };
  }
  const filterLabel = f => ([...PERSONAL, ...QUICK].find(x => x[0] === f) || GROUPS.find(g => g[0] === f) || [f, f])[1];

  // explanation banner for personal filters (and the empty state that sends you to onboarding)
  function explain(f, info) {
    if (!info) return '';
    const k = kindOf(f), ico = icon(k === 'career' ? 'bag' : k === 'major' ? 'book' : 'sparkle');
    const edit = `<button class="linkbtn cl-edit" data-cl-profile>${icon('user')}Edit profile</button>`;
    if (!info.ok) {
      const what = k === 'career' ? 'your career goals' : k === 'major' ? 'your major and intended minor' : 'what you’re into';
      return `<div class="cl-explain empty-p"><span class="cl-ex-ico">${ico}</span>
        <div><b>Tell us ${what}</b><span>Takes a minute. Then this filter shows clubs picked for <em>you</em>, and your thumbs up and down keep tuning it.</span>
        <button class="btn sm" data-cl-onboard>${icon('sparkle')} Personalize my clubs</button></div></div>`;
    }
    const head = k === 'career' ? `Matched to your goal${info.values.length > 1 ? 's' : ''}: <b>${esc(info.values.join(', '))}</b>`
      : k === 'major' ? `Matched to your major: <b>${esc(info.values.join(' + '))}</b>`
      : `Picked from ${info.values.length ? `<b>${esc(info.values.join(', '))}</b>` : 'your profile'} and your thumbs`;
    return `<div class="cl-explain"><span class="cl-ex-ico">${ico}</span><div><span>${head}</span>${edit}</div></div>`;
  }

  function listHTML() {
    const U = UI(), L = listFor(true), { rows, info } = L, shown = Math.min(rows.length, CHUNK);
    const ex = explain(U.f, info);
    if (info && !info.ok) return ex;
    if (!rows.length) return `${ex}<div class="empty">${icon('search')}<b>No clubs match</b><span>${U.q ? 'Try a shorter word or another filter.' : U.f === 'week' || U.f === 'food' ? 'Nothing listed on EngageSC for this yet. Check back Monday.' : 'Try another filter.'}</span><button class="btn sm ghost" id="club-clear">Clear filters</button></div>`;
    const order = L.tiers ? (L.strong ? ` · ${L.strong.toLocaleString()} strong match${L.strong === 1 ? '' : 'es'} first` : ' · related clubs, no strong match yet') : info || U.q ? ' · best match first' : U.f === 'all' ? ' · registered first' : '';
    return `${ex}<p class="cl-count" aria-live="polite"><b>${rows.length.toLocaleString()}</b> club${rows.length === 1 ? '' : 's'}${U.q ? ` for “${esc(U.q)}”` : ''}${U.f !== 'all' ? ` · ${esc(filterLabel(U.f))}` : ''}${order}</p>
      <div class="cl-list" data-total="${rows.length}" data-shown="${shown}">${chunkHTML(L, 0, shown)}</div>
      ${rows.length > shown ? `<div class="cl-more" id="club-more" role="status"><span class="cl-skel"></span><span class="cl-skel"></span><button class="btn ghost block" id="club-more-btn">${icon('down')} Show more</button></div>` : `<p class="cl-end">${icon('check')} That’s all ${rows.length.toLocaleString()}.</p>`}`;
  }

  // ---------- rails (browse mode) ----------
  function railsHTML() {
    const I = index(), joined = new Set(hub().clubs.map(m => String(m.id)));
    const out = [];
    const mine = hub().clubs.map(m => TH.clubById(m.id) || { id: m.id, name: m.name }).filter(Boolean);
    if (mine.length) out.push(`<section class="cl-rail"><div class="section-head"><h2>My clubs</h2><button data-go="plans:week">Calendar</button></div>
      <div class="carousel myclubs">${mine.map(c => `<button class="myclub" data-club="${esc(c.id)}">${logo(c, 'lg')}<span>${esc(c.name)}</span></button>`).join('')}</div></section>`);
    // For you
    const fy = TH.clubPersonal ? TH.clubPersonal('foryou') : { ok: false, rows: [] };
    if (fy.ok && fy.rows.length) {
      const pick = fy.rows.filter(o => !joined.has(String(o.c.id))).slice(0, 12).map(o => railCard(o.c, { why: true }));
      out.push(rail(`${icon('sparkle')} For you`, `From ${fy.values.length ? esc(fy.values.slice(0, 3).join(', ')) : 'your profile'} and your thumbs. <button class="linkbtn" data-cl-profile>Tune it</button>`, pick, `<button data-clf="foryou">See all</button>`));
    } else {
      out.push(`<button class="cl-promo" data-cl-onboard><span class="cl-promo-art" aria-hidden="true"><i></i><i></i><i></i></span><span><b>Find your people</b><span>Tell us your interests, career goals and major, and we’ll line up clubs made for you.</span></span>${icon('chev', 'chev')}</button>`);
    }
    // Meets this week
    const wk = I.rows.filter(r => I.act[r.c.id].week && r.c.registered).sort((a, b) => I.act[a.c.id].week.s - I.act[b.c.id].week.s);
    const seenWk = new Set();
    out.push(rail('Meets this week', 'Public EngageSC events in the next 7 days.', wk.filter(r => { const k = r.c.id; if (seenWk.has(k)) return false; seenWk.add(k); return true; }).slice(0, 14).map(r => railCard(r.c, { ev: I.act[r.c.id].week })), `<button data-clf="week">See all</button>`));
    // Free food
    const fd = I.rows.filter(r => I.act[r.c.id].food).sort((a, b) => I.act[a.c.id].food.s - I.act[b.c.id].food.s);
    out.push(rail('★ Free food soon', 'Events that say food is provided, per EngageSC. Next 2 weeks.', fd.slice(0, 14).map(r => railCard(r.c, { ev: I.act[r.c.id].food })), `<button data-clf="food">See all</button>`));
    // categories: tiles, then two category rails tuned to the student
    out.push(`<section class="cl-rail"><div class="section-head"><h2>Browse by vibe</h2></div><div class="carousel cl-tiles">${GROUPS.filter(g => I.counts[g[0]] && g[0] !== 'dept').map(g => `<button class="cl-tile" data-clf="${g[0]}" style="--gh:${GHUE[g[0]]}">${icon(g[2])}<b>${esc(g[1])}</b><span>${I.counts[g[0]].toLocaleString()}</span></button>`).join('')}</div></section>`);
    const p = (TH.prefs ? (() => { try { return TH.prefs(); } catch (e) { return {}; } })() : {}) || {};
    const want = [];
    (p.clubTypes || []).forEach(t => { const g = GROUPS.find(x => x[1].toLowerCase().startsWith(String(t).toLowerCase().slice(0, 4))); if (g) want.push(g[0]); });
    ['eng', 'culture', 'arts', 'sports'].forEach(k => want.push(k));
    [...new Set(want)].slice(0, 3).forEach(k => {
      const g = GROUPS.find(x => x[0] === k); if (!g) return;
      const rs = I.rows.filter(r => r.g.has(k) && r.c.registered).sort((a, b) => (I.act[b.c.id].up > 0) - (I.act[a.c.id].up > 0) || (TH.clubPhotos && TH.clubPhotos(b.c).length > 0) - (TH.clubPhotos && TH.clubPhotos(a.c).length > 0) || match(b.c).score - match(a.c).score).slice(0, 12);
      out.push(rail(esc(g[1]), '', rs.map(r => railCard(r.c)), `<button data-clf="${k}">All ${I.counts[k]}</button>`));
    });
    return out.join('');
  }

  TH.screens = TH.screens || {};
  TH.screens.clubs = {
    render() {
      const U = UI(), I = index(), arg = TH.state.params && TH.state.params.arg;
      if (arg && !TH.clubById(arg) && typeof arg === 'string') { U.q = arg; U.f = 'all'; }
      const browse = !U.q && U.f === 'all';
      const chipsRow = [['all', 'All', 'layers'], ...PERSONAL, ...QUICK].map(([k, l, ic]) => `<button class="chip cl-f ${PERSONAL.some(x => x[0] === k) ? 'me' : ''}" data-clf="${k}" aria-pressed="${U.f === k}">${icon(ic)}${esc(l)}</button>`).join('')
        + `<span class="cl-div" aria-hidden="true"></span>` + GROUPS.filter(g => I.counts[g[0]]).map(g => `<button class="chip cl-f" data-clf="${g[0]}" aria-pressed="${U.f === g[0]}">${esc(g[1])}</button>`).join('');
      return `<div class="screen" id="clubs-screen">${TH.ui.topbar('Explore Clubs')}
        <div class="cl-sticky pad">
          <label class="searchbox club-search">${icon('search')}<span class="sr">Search clubs</span><input id="club-q" type="search" placeholder="Search ${I.n.toLocaleString()} clubs: robotics, dance, Korean…" value="${esc(U.q)}" autocomplete="off" enterkeyhint="search"></label>
          <div class="chips cl-chiprow" role="toolbar" aria-label="Filter clubs">${chipsRow}</div>
        </div>
        <div class="pad screen-body cl-body">
          <div id="cl-rails" ${browse ? '' : 'hidden'}>${browse ? railsHTML() : ''}</div>
          <section class="cl-all"><div class="section-head"><h2 id="cl-title">${browse ? `All ${I.n.toLocaleString()} clubs` : 'Results'}</h2></div>
            <div id="club-list">${listHTML()}</div></section>
          <p class="muted tiny cl-foot">From the public EngageSC directory (engage.usc.edu), Nov 9, 2026. ${(() => { const st = TH.clubImageStats ? TH.clubImageStats() : null; return st && st.withPhoto ? `Photos are images ${st.withPhoto.toLocaleString()} clubs posted with their public EngageSC events; ${st.logoOnly.toLocaleString()} more show their EngageSC logo. Colorful initials are generated graphics, not photos.` : 'Logos and photos are the clubs’ own EngageSC images; colorful initials are generated graphics, not photos.'; })()} Joining here is simulated; join for real on EngageSC with your NetID. <a href="${esc(DIRECTORY)}" target="_blank" rel="noopener">Directory ↗</a></p>
        </div></div>`;
    },
    mount(host) {
      const U = UI();
      const list = $('#club-list', host), rails = $('#cl-rails', host), title = $('#cl-title', host);
      const sticky = $('.cl-sticky', host), tb = $('.topbar', host);
      if (tb) host.style.setProperty('--cl-top', tb.offsetHeight + 'px');
      let io = null;
      const more = () => {
        const el = $('.cl-list', list); if (!el) return;
        const L = listFor(), rows = L.rows, n = +el.dataset.shown, to = Math.min(rows.length, n + CHUNK);
        if (to > n) el.insertAdjacentHTML('beforeend', chunkHTML(L, n, to));
        el.dataset.shown = to;
        if (to >= rows.length) { const m = $('#club-more', list); if (m) m.outerHTML = `<p class="cl-end">${icon('check')} That’s all ${rows.length.toLocaleString()}.</p>`; if (io) io.disconnect(); }
      };
      const bindList = () => {
        if (io) io.disconnect();
        const m = $('#club-more', list);
        if (m) {
          $('#club-more-btn', m).onclick = more;
          if ('IntersectionObserver' in window) { io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) requestAnimationFrame(more); }, { root: host, rootMargin: '600px 0px' }); io.observe(m); m.classList.add('auto'); }
        }
        const clr = $('#club-clear', list); if (clr) clr.onclick = () => { U.q = ''; U.f = 'all'; TH.state.params = {}; TH.render(); };
      };
      const redraw = (toTop) => {
        const browse = !U.q && U.f === 'all';
        if (browse && !rails.innerHTML) rails.innerHTML = railsHTML();
        rails.hidden = !browse; title.textContent = browse ? `All ${index().n.toLocaleString()} clubs` : U.q ? 'Results' : filterLabel(U.f);
        list.innerHTML = listHTML(); bindList();
        $$('[data-clf]', sticky).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.clf === U.f)));
        if (toTop) host.scrollTop = 0;
      };
      bindList();
      bindLogos(host);
      const setF = f => { U.f = U.f === f && f !== 'all' ? 'all' : f; redraw(true); const b = $(`.cl-chiprow [data-clf="${U.f}"]`, sticky); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' }); };
      host.addEventListener('click', e => {
        const f = e.target.closest('[data-clf]'); if (f) { e.preventDefault(); setF(f.dataset.clf); return; }
        if (e.target.closest('[data-cl-onboard]')) { if (TH.openOnboarding) TH.openOnboarding(); else TH.go('profile'); return; }
        if (e.target.closest('[data-cl-profile]')) { TH.go('profile'); }
      });
      const q = $('#club-q', host); let tmr = null;
      q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { U.q = q.value; redraw(); }, 180); };
      q.onkeydown = e => { if (e.key === 'Enter') { clearTimeout(tmr); U.q = q.value; redraw(); q.blur(); } };
      const arg = TH.state.params && TH.state.params.arg;
      if (arg && TH.clubById(arg)) { TH.state.params = {}; setTimeout(() => TH.openClub(arg), 40); }
      else if (arg) TH.state.params = {};
      // keep the active chip in view after a re-render
      const act = $('.cl-chiprow [aria-pressed="true"]', sticky); if (act && U.f !== 'all') { const row = act.parentNode; row.scrollLeft = Math.max(0, act.offsetLeft - 40); }
    },
  };

  // ---------- club sheet ----------
  const MAX_EVENTS = 3;
  // Photos are the event covers the club posted on EngageSC (3:1 banners, stored 480×160). They are shown whole
  // (object-fit: contain, never upscaled past their stored size) over a blurred copy of themselves, and open full screen on tap.
  function hero(c) {
    const ph = TH.clubPhotos ? TH.clubPhotos(c) : [], photos = ph.filter(x => x.kind === 'photo'), lg = ph.find(x => x.kind === 'logo');
    const slides = photos.map((p, i) => `<figure class="cl-slide photo"><img class="cl-bg" src="${p.src}" alt="" aria-hidden="true" decoding="async"><span class="cl-zoom" role="button" tabindex="0" data-photo="${i}" aria-label="Open photo ${i + 1} of ${photos.length} full screen"><img src="${p.src}" alt="${esc(c.name)} photo ${i + 1} of ${photos.length}, posted on EngageSC" decoding="async"></span></figure>`);
    if (lg) slides.push(`<figure class="cl-slide logo" style="--h:${hue(c.id)}"><img src="${lg.src}" alt="${esc(c.name)} logo, from EngageSC"></figure>`);
    if (!slides.length) slides.push(`<figure class="cl-slide gen" role="img" aria-label="Generated cover graphic for ${esc(c.name)}. This club has no EngageSC photo yet.">${cover(c, { size: 'hero' })}</figure>`);
    const real = photos.length || lg;
    const credit = photos.length ? 'Photo: EngageSC · tap to enlarge' : lg ? 'Logo: EngageSC · no photos yet' : 'Generated graphic · no EngageSC photo yet';
    return `<div class="cl-hero ${real ? '' : 'gen'} ${photos.length ? 'has-photo' : ''}">
      <div class="cl-slides" tabindex="0" aria-label="${esc(c.name)}: ${photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}${lg ? ' and logo' : ''}` : lg ? 'logo' : 'generated cover graphic'}">${slides.join('')}</div>
      ${slides.length > 1 ? `<div class="cl-dots" aria-hidden="true">${slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><span class="cl-count-b">1/${slides.length}</span>` : ''}
      <button class="iconbtn cl-x" data-close aria-label="Close">${icon('x')}</button>
      <span class="cl-credit" title="${esc(photos.length ? 'From images the club posted with its public EngageSC events' : lg ? 'The club’s logo on EngageSC' : 'A generated graphic (colour and initials), not a photo')}">${icon(real ? 'camera' : 'sparkle')}${esc(credit)}</span></div>`;
  }
  // full-screen photo viewer (tap a hero photo): swipe between photos, close with ×, Esc or a tap on the dark area
  function openViewer(c, start) {
    const photos = (TH.clubPhotos ? TH.clubPhotos(c) : []).filter(x => x.kind === 'photo'); if (!photos.length) return;
    const dev = $('.device') || document.body, back = document.activeElement;
    $$('.cl-viewer', dev).forEach(n => n.remove());
    dev.insertAdjacentHTML('beforeend', `<div class="cl-viewer" role="dialog" aria-modal="true" aria-label="${esc(c.name)} photos">
      <div class="cl-v-top"><span class="cl-v-n" aria-live="polite">${start + 1} / ${photos.length}</span><button class="cl-v-rot" aria-pressed="false">${icon('refresh')}<span>Turn sideways</span></button><button class="cl-v-x" aria-label="Close photo">${icon('x')}</button></div>
      <div class="cl-v-track">${photos.map((p, i) => `<figure class="cl-v-slide" data-i="${i}"><img src="${p.src}" alt="${esc(c.name)} photo ${i + 1} of ${photos.length}, posted on EngageSC"></figure>`).join('')}</div>
      <p class="cl-v-cap">${icon('camera')}Posted by ${esc(c.name)} with a public EngageSC event</p></div>`);
    const v = $('.cl-viewer', dev), tr = $('.cl-v-track', v), n = $('.cl-v-n', v), x = $('.cl-v-x', v), rot = $('.cl-v-rot', v);
    const close = () => { v.classList.add('out'); setTimeout(() => v.remove(), 160); if (back && back.focus) back.focus({ preventScroll: true }); };
    // "Turn sideways": a 3:1 event banner is twice as big when it runs along the phone's long side
    const fit = () => {
      const on = v.classList.contains('rot');
      $$('.cl-v-slide img', v).forEach(im => {
        const sw = im.parentNode.clientWidth - 16, sh = im.parentNode.clientHeight - 16, ar = (im.naturalWidth || 3) / (im.naturalHeight || 1);
        im.style.width = on ? Math.round(Math.min(sh, sw * ar)) + 'px' : '';
      });
    };
    rot.onclick = () => { const on = v.classList.toggle('rot'); rot.setAttribute('aria-pressed', String(on)); $('span', rot).textContent = on ? 'Turn back' : 'Turn sideways'; fit(); };
    requestAnimationFrame(() => { tr.scrollLeft = start * tr.clientWidth; });
    tr.addEventListener('scroll', () => { const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); n.textContent = `${i + 1} / ${photos.length}`; }, { passive: true });
    x.onclick = close;
    v.addEventListener('click', e => { if (e.target === v || e.target.classList.contains('cl-v-slide')) close(); else if (e.target.tagName === 'IMG' && e.target.closest('.cl-v-slide')) rot.click(); });
    v.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); tr.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * tr.clientWidth, behavior: 'smooth' }); }
      else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === x ? rot : x).focus(); } // keep focus inside the viewer
    });
    x.focus({ preventScroll: true });
  }
  TH.openClubPhotos = (id, i = 0) => { const c = TH.clubById(id); if (c) openViewer(c, i); };
  // the viewer belongs to the club sheet: whatever closes the sheet closes the viewer too
  const closeSheet0 = TH.closeSheet;
  if (closeSheet0 && !closeSheet0.clViewer) {
    TH.closeSheet = function () { $$('.cl-viewer').forEach(n => n.parentNode && n.parentNode.removeChild(n)); return closeSheet0.apply(this, arguments); };
    TH.closeSheet.clViewer = true;
  }
  TH.openClub = function (id) {
    const c = TH.clubById(id);
    if (!c) { TH.toast('That group isn’t in the EngageSC directory', 'alert'); return; }
    const joined = isJoined(c.id), eng = engageUrl(c), site = c.url && c.url !== eng ? c.url : null;
    const evs = upcomingFor(c.id), a = TH.clubActivity(c.id), m = match(c);
    const addSet = new Set((TH.clubEvents ? TH.clubEvents(c.id) : []).map(e => String(e.id))); // what joining puts on My Day (next 6 weeks)
    const onCal = new Set(hub().calendar.map(x => String(x.ref)));
    const mt = c.meeting;
    const evRow = (e, i) => {
      const s = TH.laDate(e.start);
      return `<div class="club-ev ${i >= MAX_EVENTS ? 'cl-more-ev' : ''}" ${i >= MAX_EVENTS ? 'hidden' : ''}>
        <button class="ce-main" data-event="${esc(e.id)}"><span class="ce-date"><b>${s.getDate()}</b><span>${TH.MONTHS[s.getMonth()].slice(0, 3)}</span></span>
          <span class="ce-body"><span class="ce-title">${esc(e.title)}</span>
            <span class="ce-when">${esc(TH.when(e))}</span>
            ${e.location ? `<span class="ce-where">${icon('pin')}${esc(TH.shortLoc ? TH.shortLoc(e.location) : e.location)}</span>` : ''}
            <span class="cbadges">${e.food ? `<span class="pill gold">★ Free food</span>` : ''}${e.multiDay ? `<span class="pill mute">Multi-day</span>` : ''}${onCal.has(String(e.id)) ? `<span class="pill ok">${icon('check')}On My Day</span>` : !joined && addSet.has(String(e.id)) ? `<span class="pill mute">Added when you join</span>` : ''}</span></span></button>
        ${e.ical ? `<a class="ce-ics" href="${esc(e.ical)}" target="_blank" rel="noopener">${icon('calendar-plus')}Add to phone calendar</a>` : ''}</div>`;
    };
    const desc = c.desc || '';
    const thumbs = TH.x && TH.x.thumbs ? TH.x.thumbs('c' + c.id, { tags: c.cats || [], org: c.id, title: c.name }) : '';
    const html = `<div class="stack club-sheet cl-sheet">
      ${hero(c)}
      <div class="cl-sh-head">${logo(c, 'lg')}<div class="cl-sh-t"><h2>${esc(c.name)}</h2>${desc ? '' : `<span class="cl-sh-tag">${esc(tagline(c))}</span>`}</div></div>
      <div class="cl-sh-chips"><span class="cl-chip" style="--gh:${GHUE[[...clubGroups(c)][0]] ?? hue(c.id)}">${esc(TH.clubCatLabel(c.cat))}</span>
        ${c.registered ? `<span class="cl-chip reg">${icon('verified')}Registered</span>` : `<span class="cl-chip">Not registered yet</span>`}
        ${c.open ? `<span class="cl-chip join" title="EngageSC lets anyone request to join online">${icon('users')}Join online</span>` : ''}
        ${a.food ? `<span class="cl-chip food">★ Free food soon</span>` : a.week ? `<span class="cl-chip week">${icon('calendar')}${a.weekN} this week</span>` : ''}
        ${joined ? `<span class="cl-chip joined">${icon('check')}You’re a member</span>` : ''}</div>
      ${m.why && m.why.length ? `<div class="cl-sh-why">${icon('sparkle')}<span>${esc(m.why.slice(0, 2).join(' · '))}</span></div>` : ''}
      ${desc ? `<div class="cl-desc"><p>${esc(desc)}</p>${desc.length > 150 ? `<button class="linkbtn" id="cl-desc-more">Read more</button>` : ''}</div>` : `<p class="muted">This group hasn’t posted a description on EngageSC.</p>`}
      ${mt ? `<div class="card flat club-meet"><b>${icon('clock')} When they meet</b>
          <span>${esc([(mt.days || []).join(' & '), mt.time, mt.place].filter(Boolean).join(' · '))}${mt.note ? ` <span class="muted">(${esc(mt.note)})</span>` : ''}</span>
          ${mt.quote ? `<blockquote>“${esc(mt.quote)}”</blockquote>` : ''}
          ${TH.ui.src(mt.source || eng || DIRECTORY, 'the group’s EngageSC description')}</div>` : ''}
      ${joined ? `<button class="btn line block" id="club-leave">${icon('x')} Leave club</button>` : `<button class="btn block cl-join" id="club-join">${icon('users')} Join club${addSet.size ? `<small>adds ${addSet.size === 1 ? '1 event' : addSet.size + ' events'} to My Day</small>` : ''}</button>`}
      <div class="section"><div class="section-head"><h2>Upcoming</h2><span class="muted tiny">${evs.length ? `${evs.length} public event${evs.length === 1 ? '' : 's'}` : ''}</span></div>
        ${evs.length ? `<div class="club-evs">${evs.slice(0, 12).map(evRow).join('')}</div>${evs.length > MAX_EVENTS ? `<button class="btn ghost block sm" id="cl-ev-more">${icon('down')} Show all ${Math.min(evs.length, 12)}</button>` : ''}${evs.length > 12 ? `<p class="muted tiny">+${evs.length - 12} more on EngageSC.</p>` : ''}${evs.some(e => !e.location) ? `<p class="muted tiny" style="margin:0">EngageSC shows some locations only after you sign in there.</p>` : ''}`
        : `<p class="muted">No public events listed right now. Members-only events show up on EngageSC after you join there.</p>`}</div>
      ${thumbs ? `<div class="card flat cl-fb"><span><b>Your kind of club?</b><br><span class="muted">Thumbs tune your For you picks.</span></span>${thumbs}</div>` : ''}
      <div class="stack">
        ${eng ? `<a class="btn ghost block" href="${esc(eng)}" target="_blank" rel="noopener">${icon('external')} Open in EngageSC</a>` : `<a class="btn ghost block" href="${esc(DIRECTORY)}" target="_blank" rel="noopener">${icon('external')} Find it on EngageSC</a>`}
        <button class="btn ghost block" data-go="assistant:${esc('Tell me about ' + c.name)}">${icon('sparkle')} Ask Tommy about this club</button>
        ${site ? `<a class="linkbtn" href="${esc(site)}" target="_blank" rel="noopener">${icon('link')} Group website ↗</a>` : ''}
      </div>
      ${!c.open ? `<p class="muted tiny">EngageSC shows “Membership Closed” online for this group. That usually means joining happens through tryouts, recruitment, or after the group re-registers, not that it turns people away.</p>` : ''}
      <span class="muted tiny">Group info, images and events from EngageSC’s public directory and events feed, Nov 9, 2026.</span>
    </div>`;
    TH.sheet(html, w => {
      w.classList.add('cl-sheet-wrap');
      bindLogos(w);
      if (TH.x && TH.x.bindThumbs) TH.x.bindThumbs(w);
      const j = $('#club-join', w); if (j) j.onclick = () => confirmJoin(c);
      const l = $('#club-leave', w); if (l) l.onclick = () => confirmLeave(c);
      const dm = $('#cl-desc-more', w); if (dm) dm.onclick = () => { dm.parentNode.classList.add('open'); dm.remove(); };
      const em = $('#cl-ev-more', w); if (em) em.onclick = () => { $$('.cl-more-ev', w).forEach(x => { x.hidden = false; }); em.remove(); };
      const sl = $('.cl-slides', w), dots = $$('.cl-dots i', w), cnt = $('.cl-count-b', w);
      if (sl && dots.length) sl.addEventListener('scroll', () => { const i = Math.round(sl.scrollLeft / Math.max(1, sl.clientWidth)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); if (cnt) cnt.textContent = `${i + 1}/${dots.length}`; }, { passive: true });
      if (sl) {
        sl.addEventListener('click', e => { const z = e.target.closest('[data-photo]'); if (z) openViewer(c, +z.dataset.photo || 0); });
        sl.addEventListener('keydown', e => { const z = e.target.closest('[data-photo]'); if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openViewer(c, +z.dataset.photo || 0); } });
      }
    });
  };

  function confirmJoin(c) {
    const onCal = new Set(hub().calendar.map(x => String(x.ref)));
    const adds = (TH.clubEvents ? TH.clubEvents(c.id) : []).filter(e => !onCal.has(String(e.id)));
    const n = adds.length, eng = engageUrl(c) || DIRECTORY;
    const head = n ? `${n} upcoming event${n === 1 ? '' : 's'} added to My Day` : 'No upcoming events to add yet';
    const html = `<div class="join-list"><b>${icon('calendar-plus')} ${esc(head)}</b>
        ${n ? `<ul>${adds.map(e => `<li><span>${esc(e.title)}</span><small class="muted">${esc(TH.when(e))}${e.food ? ' · ★ Free food' : ''}</small></li>`).join('')}</ul>` : `<p class="muted tiny">When this group posts public events, add them from Events.</p>`}</div>
      <p class="simtag">${icon('info')} Simulated join — finish on EngageSC</p>`;
    TH.confirmAct('joinClub', [c.id], {
      title: `Join ${c.name}?`, ok: 'Join club', rows: [['Group', c.name], ['Category', TH.clubCatLabel(c.cat)]], html,
      url: eng, urlLabel: 'Finish on EngageSC', toast: n ? `Joined! ${head}.` : `Joined ${c.name}`,
    });
  }
  function confirmLeave(c) {
    const n = hub().calendar.filter(x => x.kind === 'club' && String(x.orgId) === String(c.id)).length;
    TH.confirmAct('leaveClub', [c.id], {
      title: `Leave ${c.name}?`, ok: 'Leave club',
      rows: [['Group', c.name], ['Removed from My Day', n ? `${n} club event${n === 1 ? '' : 's'}` : 'Nothing']],
      url: engageUrl(c) || DIRECTORY, urlLabel: 'Manage on EngageSC', toast: `You left ${c.name}`,
    });
  }
})(window.TH = window.TH || {});
