/* js/p6-profile.js — Part 6, profile agent: onboarding (TH.openOnboarding), the Profile screen (completeness, edit every
 * answer, how thumbs shaped picks), the Home report card + guided report sheet, the Report screen ("My reports" and SOS
 * alerts), Home entry points (avatar, "Plan my day with Tommy", finish-setup card) and Tommy shortcuts for the profile.
 * Preferences live in TH.H().x.profile (Trojan Assist's store); the API (TH.prefs, TH.prefTokens, TH.likeScore,
 * TH.prefsChanged) is in hub2a.js. Everything a student types or photographs stays on this device.
 * Load after hub2c.js. */
(function (TH) {
  'use strict';
  const { X, save, hash, ago, sim, top, RC, STAT, routeFor, guessCat, shrink, nearestPlace, recEvents, recClubs, CT } = TH.x;
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const changed = () => { TH.prefsChanged(); };
  const P = () => X().profile;

  Object.assign(TH.iconPaths, {
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
    heart: '<path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.600A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>',
    cup: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
    grad: TH.iconPaths.grad || '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
  });

  // =====================================================================
  // OPTIONS (shared by onboarding and the Profile editors)
  // =====================================================================
  const OPT = {
    hobbies: ['Hiking', 'Film', 'Gaming', 'Music', 'Dance', 'Coding', 'Volunteering', 'Basketball', 'Cooking', 'Photography', 'Startups', 'Art', 'Fitness', 'Reading', 'Fashion', 'Travel', 'Theater', 'Writing', 'Sports games'],
    goals: ['Software engineering', 'Consulting', 'Finance', 'Medicine', 'Law', 'Film & TV', 'Research', 'Design', 'Marketing', 'Public service', 'Entrepreneurship', 'Education'],
    careerInterests: Object.keys(TH.x.CI_KW),
    clubTypes: Object.keys(CT),
    foods: ['Pizza', 'Tacos', 'Burgers', 'Sushi', 'Ramen', 'Korean BBQ', 'Thai', 'Indian', 'Mediterranean', 'Sandwiches', 'Bagels', 'Desserts', 'Ice cream'],
    snacks: ['Chips & salsa', 'Fruit', 'Cookies', 'Boba', 'Trail mix', 'Donuts', 'Hummus & pita', 'Popcorn', 'Granola bars'],
    drinks: ['Water', 'Sparkling water', 'Coffee', 'Iced tea', 'Lemonade', 'Soda', 'Matcha', 'Energy drinks', 'Smoothies'],
    diet: ['None', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Pescatarian'],
    allergies: ['None', 'Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Gluten / wheat', 'Soy', 'Shellfish', 'Fish', 'Sesame'],
    year: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad student'],
  };
  const MINORS = ['Business', 'Computer Science', 'Data Science', 'Entrepreneurship', 'Economics', 'Psychology', 'Cinematic Arts', 'Music Industry', 'Game Design', 'Public Policy', 'Spanish', 'Mathematics', 'Communication Design', 'Health Care Studies', 'Environmental Studies', 'Law and Society'];
  const LABEL = { hobbies: 'Interests', goals: 'Career goals', careerInterests: 'Career interests', clubTypes: 'Club types', foods: 'Favorite foods', snacks: 'Snacks', drinks: 'Drinks', diet: 'Diet', allergies: 'Allergies' };
  const SEC_IC = { hobbies: 'heart', goals: 'compass', careerInterests: 'bag', clubTypes: 'users', foods: 'fork', snacks: 'star', drinks: 'cup', diet: 'leaf', allergies: 'alert', school: 'grad' };
  const HUES = { hobbies: 340, goals: 210, careerInterests: 265, clubTypes: 160, foods: 22, snacks: 42, drinks: 190, diet: 130, allergies: 0 };
  // a profile section counts as answered when anything is picked ("None" counts for diet and allergies)
  const SECTIONS = [['hobbies'], ['goals'], ['careerInterests'], ['clubTypes'], ['foods'], ['snacks', 'drinks'], ['diet'], ['allergies'], ['school']];
  const answered = sec => sec[0] === 'school' ? !!(TH.prefs().year || '').trim() : sec.some(k => (P()[k] || []).length);
  function completeness() { const done = SECTIONS.filter(answered).length; return { done, total: SECTIONS.length, pct: Math.round(done / SECTIONS.length * 100), next: (SECTIONS.find(s => !answered(s)) || [])[0] || null }; }
  TH.profileCompleteness = completeness;

  function toggleVal(k, v) {
    const a = P()[k], i = a.indexOf(v);
    if (i >= 0) a.splice(i, 1);
    else { if ((k === 'diet' || k === 'allergies')) { if (v === 'None') a.length = 0; else { const n = a.indexOf('None'); if (n >= 0) a.splice(n, 1); } } a.push(v); }
    changed(); return i < 0;
  }
  const chipList = (k, extra) => { const opts = OPT[k] || [], cur = P()[k] || []; return [...opts, ...cur.filter(v => !opts.includes(v))].concat(extra || []); };
  const chip = (k, v) => { const on = (P()[k] || []).includes(v); return `<button type="button" class="p6-chip" data-pk="${k}" data-v="${esc(v)}" aria-pressed="${on}" style="--h:${(HUES[k] + hash(v) % 40) % 360}"><span class="p6-tick" aria-hidden="true">${icon('check')}</span>${esc(v === 'None' ? (k === 'diet' ? 'No restrictions' : 'No allergies') : v)}</button>`; };
  const chipsHTML = k => `<div class="p6-chips" data-group="${k}">${chipList(k).map(v => chip(k, v)).join('')}</div>`;
  const addOwn = k => `<form class="p6-addown" data-addown="${k}"><label class="sr" for="ao-${k}">Add your own ${esc(LABEL[k] || '').toLowerCase()}</label><input id="ao-${k}" maxlength="30" placeholder="+ Add your own" autocomplete="off"><button class="btn sm ghost" aria-label="Add">${icon('plus')}</button></form>`;
  // one delegated handler for chip toggles + "add your own" inside any root
  function bindChips(root, after) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-pk]'); if (!b || !root.contains(b)) return;
      const k = b.dataset.pk, on = toggleVal(k, b.dataset.v);
      if (k === 'diet' || k === 'allergies') $$(`[data-pk="${k}"]`, root).forEach(c => c.setAttribute('aria-pressed', String(P()[k].includes(c.dataset.v))));
      else b.setAttribute('aria-pressed', String(on));
      if (on && !reduced()) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      after && after(k);
    });
    root.addEventListener('submit', e => {
      const f = e.target.closest('[data-addown]'); if (!f) return; e.preventDefault();
      const k = f.dataset.addown, inp = $('input', f), v = inp.value.trim().replace(/\s+/g, ' '); if (!v) return;
      if (!P()[k].includes(v)) { P()[k].push(v); changed(); }
      const g = $(`[data-group="${k}"]`, root); if (g) g.innerHTML = chipList(k).map(x => chip(k, x)).join('');
      inp.value = ''; after && after(k);
    });
  }

  // =====================================================================
  // ONBOARDING: Welcome → interests → career → club types → food → diet + allergies → studies → your picks
  // =====================================================================
  const STEPS = [
    { k: 'welcome' },
    { k: 'interests', kick: 'Interests', title: 'What are you into?', sub: 'Pick as many as you like. These shape the rows on your Home.', groups: [['hobbies']] },
    { k: 'career', kick: 'Career', title: 'Where are you headed?', sub: 'We’ll surface career events and clubs that get you there.', groups: [['goals', 'Fields I’m aiming for'], ['careerInterests', 'This year I want…']] },
    { k: 'clubs', kick: 'Clubs', title: 'What kind of clubs feel like you?', sub: 'There are 2,000 on EngageSC. This narrows them to yours.', groups: [['clubTypes']] },
    { k: 'food', kick: 'Food', title: 'Let’s talk food', sub: 'So we can point you to free food you’ll actually want.', groups: [['foods', 'Favorite foods'], ['snacks', 'Snacks'], ['drinks', 'Drinks']] },
    { k: 'diet', kick: 'Food safety', title: 'Anything to watch out for?', sub: 'We’ll flag events whose listing mentions food you avoid.', groups: [['diet', 'Diet'], ['allergies', 'Allergies']] },
    { k: 'school', kick: 'Studies', title: 'Your studies', sub: 'Your major comes from your USC record. Add a minor if you have one in mind.' },
    { k: 'done' },
  ];
  let OB = null; // { i, el }
  const stepCount = () => STEPS.length - 2; // question steps only
  function obHeader(i) {
    const q = i - 1, n = stepCount();
    return `<button class="p6-ob-back" data-ob="back" aria-label="Back" ${i === 0 ? 'hidden' : ''}>${icon('back')}</button>
      <div class="p6-dots" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${Math.max(0, Math.min(n, q))}" aria-label="Setup progress">${Array.from({ length: n }, (_, j) => `<i class="${j < q ? 'done' : j === q ? 'cur' : ''}"></i>`).join('')}</div>
      <button class="p6-ob-skip" data-ob="skip">${i === STEPS.length - 1 ? 'Close' : 'Skip for now'}</button>`;
  }
  // a varied handful: no two picks for the same top reason when there's a choice
  function vary(list, n) { const out = [], seen = new Set(); list.forEach(r => { if (out.length < n && !seen.has(r.why[0])) { out.push(r); seen.add(r.why[0]); } }); list.forEach(r => { if (out.length < n && !out.includes(r)) out.push(r); }); return out; }
  // club picks use the same model as Clubs → For you (TH.clubMatch, js/p6-clubs.js) so the reasons agree everywhere
  function clubRecs(n) {
    if (TH.clubPersonal) {
      try {
        const joined = new Set(TH.H().clubs.map(c => String(c.id))), fb = X().fb || {};
        return TH.clubPersonal('foryou').rows.filter(r => r.m.score >= 3 && !joined.has(String(r.c.id)) && !((fb['c' + r.c.id] || {}).v < 0)).slice(0, n)
          .map(r => ({ c: r.c, s: r.m.score, why: r.m.why.map(w => w.replace(/^Matched to your goal: /, 'Your goal: ')) }));
      } catch (e) { console.error(e); }
    }
    return recClubs(n) || [];
  }
  const pickIc = o => { const c = o.club && TH.clubById && TH.clubById(o.id); return c && TH.clubThumb ? TH.clubThumb(c, 'md') : `<span class="p6-pick-ic" style="--h:${hash(o.id) % 360}">${esc(String(o.title).replace(/^(The|USC|Trojan)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</span>`; };
  function picks(nc, ne) {
    const cl = vary(clubRecs(30), nc || 3).map(r => ({ id: r.c.id, title: r.c.name, why: r.why.slice(0, 2).join(' · '), club: true }));
    const ev = vary(recEvents(20) || [], ne == null ? 2 : ne).map(r => ({ id: r.e.id, title: r.e.title, sub: (TH.ui.dayLabel(r.e.date) + (r.e.allDay ? '' : ' · ' + TH.fmtMin(r.e.start))), why: r.why.slice(0, 2).join(' · ') }));
    return { cl, ev };
  }
  function obBody(i) {
    const s = STEPS[i], st = TH.student(), p = P();
    if (s.k === 'welcome') return `<div class="p6-ob-hello">
        <div class="p6-ob-art" aria-hidden="true"><span class="b1"></span><span class="b2"></span><span class="b3"></span><span class="t">T</span></div>
        <span class="p6-kick">60-second setup</span>
        <h1>Hey ${esc(st.first)}! Let’s make Trojan Hub <em>yours.</em></h1>
        <p>Tell us what you like, where you’re headed and what you eat. Your Home, club picks, events and Tommy’s plans all get smarter.</p>
        <ul class="p6-ob-perks"><li>${icon('sparkle')}<span>Picks with a reason you can see</span></li><li>${icon('fork')}<span>Free food you’ll want, allergy heads-ups</span></li><li>${icon('lock')}<span>Stays on this device. Change it anytime in Profile.</span></li></ul>
      </div>`;
    if (s.k === 'done') {
      const pk = picks(), c = completeness();
      return `<div class="p6-ob-done">
        <div class="p6-burst" aria-hidden="true">${Array.from({ length: 14 }, (_, j) => `<i style="--a:${j * 26}deg;--d:${(j % 4) * 40}ms"></i>`).join('')}<span>${icon('check')}</span></div>
        <h1>You’re all set, ${esc(st.first)}!</h1>
        <p class="muted">Profile ${c.pct}% filled in. ${c.pct < 100 ? 'Add more anytime in Profile for even sharper picks.' : 'Your picks are as sharp as they get.'} Thumbs up or down on anything to keep tuning.</p>
        <div class="p6-picks"><span class="p6-kick">Your picks</span>
          ${pk.cl.map(o => `<button class="p6-pick" data-club="${esc(o.id)}">${pickIc(o)}<span class="p6-pick-m"><b>${esc(o.title)}</b><span class="p6-whyline">${icon('sparkle')}${esc(o.why)}</span></span></button>`).join('')}
          ${pk.ev.map(o => `<button class="p6-pick" data-event="${esc(o.id)}"><span class="p6-pick-ic ev">${icon('calendar')}</span><span class="p6-pick-m"><b>${esc(o.title)}</b><span class="muted">${esc(o.sub)}</span><span class="p6-whyline">${icon('sparkle')}${esc(o.why)}</span></span></button>`).join('')}
          ${!pk.cl.length && !pk.ev.length ? '<p class="muted">Pick a few interests and your picks show up here.</p>' : ''}
        </div></div>`;
    }
    const head = `<span class="p6-kick">${esc(s.kick)} · ${i} of ${stepCount()}</span><h1>${esc(s.title)}</h1><p class="p6-ob-sub">${esc(s.sub)}</p>`;
    if (s.k === 'school') {
      const ta = (TA.State.d.profile) || {};
      return `${head}<div class="p6-form">
        <div class="field"><label for="ob-major">Major</label><input id="ob-major" maxlength="60" value="${esc(p.major || ta.major || '')}"><span class="muted tiny">From your USC record${ta.school ? ' · ' + esc(ta.school) : ''}</span></div>
        <div class="field"><label for="ob-minor">Intended minor <span class="muted">(optional)</span></label><input id="ob-minor" list="ob-minors" maxlength="60" placeholder="e.g. Business, Game Design" value="${esc(p.minor || ta.minor || '')}"><datalist id="ob-minors">${MINORS.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist></div>
        <div class="field"><label id="ob-yl">Year</label><div class="p6-seg" role="radiogroup" aria-labelledby="ob-yl">${OPT.year.map(y => `<button type="button" role="radio" data-year="${esc(y)}" aria-checked="${(p.year || ta.standing) === y}">${esc(y.replace(' student', ''))}</button>`).join('')}</div></div>
      </div>`;
    }
    return head + s.groups.map(([k, lab]) => `<section class="p6-ob-group">${lab ? `<h2>${esc(lab)}</h2>` : ''}${chipsHTML(k)}${addOwn(k)}</section>`).join('');
  }
  function obCount(i) { const s = STEPS[i]; if (!s.groups) return ''; const n = s.groups.reduce((a, [k]) => a + P()[k].length, 0); return n ? `<b>${n}</b> picked` : 'Pick a few, or skip'; }
  function obPaint(dir) {
    const { el, i } = OB, s = STEPS[i];
    $('.p6-ob-top', el).innerHTML = obHeader(i);
    const body = $('.p6-ob-body', el); body.innerHTML = `<div class="p6-ob-step ${dir ? 'in-' + dir : ''}">${obBody(i)}</div>`; body.scrollTop = 0;
    const foot = $('.p6-ob-foot', el);
    foot.innerHTML = s.k === 'welcome' ? `<button class="btn block gold p6-big" data-ob="next">Let’s go ${icon('chev')}</button>`
      : s.k === 'done' ? `<div class="p6-ob-two"><button class="btn line" data-ob="plan">${icon('sparkle')} Plan my day</button><button class="btn" data-ob="finish">Explore my Home</button></div>`
      : `<span class="p6-ob-count" aria-live="polite">${obCount(i)}</span><button class="btn p6-big" data-ob="next">${i === STEPS.length - 2 ? 'Finish' : 'Next'} ${icon('chev')}</button>`;
    P().obStep = i; if (s.k === 'done') { P().onboarded = true; P().obSkipped = 0; changed(); } save();
    setTimeout(() => { const h = $('.p6-ob-body h1', el); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }, 30);
  }
  function obSaveSchool() {
    const el = OB && OB.el; if (!el || STEPS[OB.i].k !== 'school') return;
    const p = P(), ta = TA.State.d.profile || {}, mj = $('#ob-major', el).value.trim(), mn = $('#ob-minor', el).value.trim();
    p.major = mj && mj !== ta.major ? mj : ''; p.minor = mn; changed();
  }
  function obClose(how) {
    if (!OB) return; obSaveSchool(); const el = OB.el; OB = null;
    if (how === 'skip' && !P().onboarded) { P().obSkipped = Date.now(); save(); TH.toast('No problem. Finish anytime from Home or your profile.', 'user'); }
    else save();
    el.classList.add('out'); setTimeout(() => el.remove(), reduced() ? 0 : 220);
    if (['home', 'profile', 'more'].includes(TH.state.route)) TH.render(true);
  }
  TH.openOnboarding = function (opts) {
    opts = opts || {}; const dev = $('.device'); if (!dev || !(window.TA && TA.State && TA.State.d)) return;
    if (OB) return; TH.closeSheet();
    const p = P(); let i = opts.step != null ? opts.step : opts.retake ? 1 : (!p.onboarded && p.obStep > 0 && p.obStep < STEPS.length - 1 ? p.obStep : 0);
    dev.insertAdjacentHTML('beforeend', `<div class="p6-ob" role="dialog" aria-modal="true" aria-label="Set up Trojan Hub"><div class="p6-ob-top"></div><div class="p6-ob-body"></div><div class="p6-ob-foot"></div></div>`);
    const el = $('.p6-ob', dev); OB = { el, i };
    TH.bindCommon(el);
    bindChips(el, () => { const c = $('.p6-ob-count', el); if (c) c.innerHTML = obCount(OB.i); });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-club],[data-event]')) { obClose('done'); return; }
      const y = e.target.closest('[data-year]'); if (y) { P().year = y.dataset.year; changed(); $$('[data-year]', el).forEach(b => b.setAttribute('aria-checked', String(b === y))); return; }
      const b = e.target.closest('[data-ob]'); if (!b) return; const a = b.dataset.ob;
      if (a === 'next') { obSaveSchool(); OB.i = Math.min(STEPS.length - 1, OB.i + 1); obPaint('r'); }
      else if (a === 'back') { obSaveSchool(); OB.i = Math.max(0, OB.i - 1); obPaint('l'); }
      else if (a === 'skip') obClose(OB.i === STEPS.length - 1 ? 'done' : 'skip');
      else if (a === 'finish') { obClose('done'); TH.go('home'); }
      else if (a === 'plan') { obClose('done'); goPlan(); }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); obClose(OB && OB.i === STEPS.length - 1 ? 'done' : 'skip'); } });
    obPaint();
  };
  TH.closeOnboarding = () => obClose('skip');
  const goPlan = () => { if (TH.screens.plan) TH.go('plan'); else TH.go('assistant', { arg: 'plan my day' }); };

  // =====================================================================
  // PROFILE screen
  // =====================================================================
  function ring(pct, size) { const r = 26, c = 2 * Math.PI * r; return `<svg class="p6-ring" viewBox="0 0 64 64" width="${size || 64}" height="${size || 64}" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="bg"/><circle cx="32" cy="32" r="${r}" class="fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg>`; }
  const initials = st => esc((st.first || 'S')[0]) + esc((st.last || '')[0] || '');
  function secRow(keys) {
    const k = keys[0];
    if (k === 'school') { const pr = TH.prefs(); return `<button class="p6-sec" data-edit="school" style="--h:${215}"><span class="p6-sec-ic">${icon('grad')}</span><span class="p6-sec-m"><b>Your studies</b><span class="p6-sec-v">${esc(pr.major || 'Major')}${pr.minor ? ' · ' + esc(pr.minor) + ' minor' : ''}${pr.year ? ' · ' + esc(pr.year) : ''}</span></span>${icon('pencil', 'chev')}</button>`; }
    const vals = keys.flatMap(x => P()[x] || []).map(v => v === 'None' ? (k === 'diet' ? 'No restrictions' : 'No allergies') : v);
    const title = keys.map(x => LABEL[x]).join(' & ');
    return `<button class="p6-sec ${vals.length ? '' : 'empty'}" data-edit="${keys.join(',')}" style="--h:${HUES[k]}"><span class="p6-sec-ic">${icon(SEC_IC[k])}</span><span class="p6-sec-m"><b>${esc(title)}</b>${vals.length ? `<span class="p6-mini">${vals.slice(0, 4).map(v => `<i>${esc(v)}</i>`).join('')}${vals.length > 4 ? `<i class="more">+${vals.length - 4}</i>` : ''}</span>` : `<span class="p6-sec-v add">${icon('plus')} Tap to add</span>`}</span>${icon(vals.length ? 'pencil' : 'chev', 'chev')}</button>`;
  }
  let thumbsUndo = null;
  function thumbsCard() {
    const x = X(), fb = Object.entries(x.fb).filter(([, f]) => f && f.v), up = fb.filter(([, f]) => f.v > 0), dn = fb.filter(([, f]) => f.v < 0);
    const tags = Object.entries(x.w.tag || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
    const less = Object.entries(x.w.tag || {}).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([t]) => t);
    const hs = Object.entries(x.w.hashtag || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    return `<section class="card p6-thumbs"><div class="p6-th-head"><h2>How your thumbs shape picks</h2></div>
      <div class="p6-th-n"><span class="up">${icon('up')}<b>${up.length}</b> more like this</span><span class="dn">${icon('dn')}<b>${dn.length}</b> not for me</span></div>
      ${fb.length ? `${tags.length || hs.length ? `<p class="p6-th-l">Showing you more</p><div class="p6-why">${[...hs, ...tags].map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        ${less.length ? `<p class="p6-th-l">Showing you less</p><div class="p6-why neg">${less.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        ${up.length ? `<p class="p6-th-l">You liked</p><ul class="p6-th-list">${up.slice(-4).reverse().map(([, f]) => `<li>${esc(f.title || 'An event or club')}</li>`).join('')}</ul>` : ''}
        <button class="btn sm line" id="pf-reset">${icon('refresh')} Reset thumbs</button>`
      : `<p class="muted" style="font-size:13.5px">Tap ${icon('up')} or ${icon('dn')} on any event or club. Each one nudges what Home and Tommy’s plans show you.</p>`}
      ${thumbsUndo ? `<div class="banner info p6-pundo">${icon('info')}<div><b>Thumbs reset</b><span>Your picks now come from your answers only.</span></div><button class="btn sm ghost" id="pf-undo">Undo</button></div>` : ''}
    </section>`;
  }
  TH.screens.profile = {
    render() {
      const st = TH.student(), c = completeness(), pr = TH.prefs(), pk = picks(3, 0), p = P();
      return `<div class="screen">${top('My Profile', `<button class="btn sm ghost" id="pf-retake">${icon('refresh')} Retake quiz</button>`)}<div class="pad screen-body stack p6-pro">
        <section class="p6-pro-hero">
          <span class="p6-av big">${initials(st)}</span>
          <div class="p6-pro-id"><b>${esc(st.full)}</b><span>${esc(pr.year || st.standing)} · ${esc(pr.major)}${pr.minor ? ` · ${esc(pr.minor)} minor` : ''}</span></div>
          <button class="p6-pro-wallet" data-go="wallet" aria-label="Open Trojan Wallet">${icon('wallet')}<span>Wallet</span></button>
          <div class="p6-pro-meter">${ring(c.pct, 64)}<span class="p6-pro-pct"><b>${c.pct}%</b></span>
            <span class="p6-pro-mt"><b>${c.pct >= 100 ? 'Fully tuned' : c.done ? 'The more you add, the better your picks' : 'Tell us about you'}</b><span>${c.done} of ${c.total} sections · thumbs keep tuning it</span></span></div>
          ${c.next ? `<button class="btn gold block" data-edit="${c.next === 'snacks' ? 'snacks,drinks' : c.next}">${icon('plus')} Add ${esc(c.next === 'school' ? 'your year' : (LABEL[c.next] || '').toLowerCase())} next</button>` : ''}
          ${!p.onboarded ? `<button class="btn block line onwhite-line" id="pf-ob">${icon('sparkle')} Finish the quick setup</button>` : ''}
        </section>
        <div class="section"><div class="section-head"><h2>About you</h2></div><div class="p6-secs">${SECTIONS.slice(0, 4).map(secRow).join('')}</div></div>
        <div class="section"><div class="section-head"><h2>Food</h2></div><div class="p6-secs">${SECTIONS.slice(4, 8).map(secRow).join('')}</div></div>
        <div class="section"><div class="section-head"><h2>School</h2></div><div class="p6-secs">${secRow(['school'])}</div></div>
        ${thumbsCard()}
        ${pk.cl.length ? `<div class="section"><div class="section-head"><h2>Picked for you right now</h2><button data-go="clubs">All clubs</button></div><div class="p6-picks">${pk.cl.map(o => `<button class="p6-pick" data-club="${esc(o.id)}">${pickIc(o)}<span class="p6-pick-m"><b>${esc(o.title)}</b><span class="p6-whyline">${icon('sparkle')}${esc(o.why)}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></div>` : ''}
        <div class="card flat stack" style="gap:10px"><b>What clubs can see when you sign up</b>
          <label class="check"><input type="checkbox" id="pf-shareFood" ${p.shareFood ? 'checked' : ''}><span>Food, diet and allergies, so the food fits who’s coming</span></label>
          <label class="check"><input type="checkbox" id="pf-shareHobbies" ${p.shareHobbies ? 'checked' : ''}><span>Interests</span></label>
          <label class="check"><input type="checkbox" id="pf-shareGoals" ${p.shareGoals ? 'checked' : ''}><span>Career goals, so clubs can plan events that help</span></label>
          <div class="x-route"><span class="muted tiny">Organizers see this when you RSVP</span><b style="font-size:14px">${esc(TH.x.sharedLine(p) || 'Nothing shared yet')}</b></div></div>
        <div class="banner ok">${icon('lock')}<div><b>Stays on this device</b><span>Your answers and thumbs are saved in this browser only and shape picks on this device. Trojan Hub never uses race, gender, financial aid or other USC records for recommendations.</span></div></div>
      </div></div>`;
    },
    mount(host) {
      const rt = $('#pf-retake', host); if (rt) rt.onclick = () => TH.openOnboarding({ retake: true });
      const ob = $('#pf-ob', host); if (ob) ob.onclick = () => TH.openOnboarding();
      host.addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) editSheet(b.dataset.edit); });
      ['shareFood', 'shareHobbies', 'shareGoals'].forEach(k => { const c = $('#pf-' + k, host); if (c) c.onchange = e => { P()[k] = e.target.checked; save(); TH.render(true); }; });
      const rs = $('#pf-reset', host); if (rs) rs.onclick = () => TH.sheet(`<div class="stack"><div class="sheet-head"><h2>Reset your thumbs?</h2><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div><p class="muted">Picks go back to using only your profile answers. Your answers stay. You can undo right after.</p><div class="btn-row"><button class="btn line" data-close>Keep them</button><button class="btn" id="rs-ok">Reset thumbs</button></div></div>`, w => {
        $('#rs-ok', w).onclick = () => { const x = X(); thumbsUndo = JSON.stringify({ fb: x.fb, w: x.w }); x.fb = {}; x.w = { tag: {}, org: {}, hashtag: {} }; changed(); TH.commit('Reset recommendation thumbs'); TH.closeSheet(); TH.render(true); };
      });
      const un = $('#pf-undo', host); if (un) un.onclick = () => { try { const o = JSON.parse(thumbsUndo); const x = X(); x.fb = o.fb; x.w = o.w; changed(); save(); TH.toast('Thumbs restored', 'up'); } catch (e) { /* nothing to restore */ } thumbsUndo = null; TH.render(true); };
      if (thumbsUndo) setTimeout(() => { if (TH.state.route !== 'profile') thumbsUndo = null; }, 15000);
    },
  };
  function editSheet(what) {
    if (what === 'school') {
      const p = P(), ta = TA.State.d.profile || {};
      return TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">Profile</span><h2>Your studies</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="field"><label for="ed-major">Major</label><input id="ed-major" maxlength="60" value="${esc(p.major || ta.major || '')}"><span class="muted tiny">From your USC record. Change it here if it’s out of date.</span></div>
        <div class="field"><label for="ed-minor">Intended minor</label><input id="ed-minor" list="ed-minors" maxlength="60" placeholder="e.g. Business" value="${esc(p.minor || ta.minor || '')}"><datalist id="ed-minors">${MINORS.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist></div>
        <div class="field"><label id="ed-yl">Year</label><div class="p6-seg" role="radiogroup" aria-labelledby="ed-yl">${OPT.year.map(y => `<button type="button" role="radio" data-year="${esc(y)}" aria-checked="${(p.year || ta.standing) === y}">${esc(y.replace(' student', ''))}</button>`).join('')}</div></div>
        <button class="btn block" id="ed-ok">Save</button></div>`, w => {
        let yr = p.year || ta.standing || '';
        w.addEventListener('click', e => { const y = e.target.closest('[data-year]'); if (!y) return; yr = y.dataset.year; $$('[data-year]', w).forEach(b => b.setAttribute('aria-checked', String(b === y))); });
        // write to the live profile object: hub2a's X() swaps x.profile for a fresh copy every few seconds, so the one
        // captured when the sheet opened may no longer be the one that gets saved
        $('#ed-ok', w).onclick = () => { const q = P(), mj = $('#ed-major', w).value.trim(); q.major = mj && mj !== ta.major ? mj : ''; q.minor = $('#ed-minor', w).value.trim(); q.year = yr; changed(); save(); TH.closeSheet(); TH.toast('Saved. Picks updated.', 'check'); TH.render(true); };
      });
    }
    const keys = what.split(',').filter(k => OPT[k]);
    TH.sheet(`<div class="stack p6-edit"><div class="sheet-head"><div><span class="eyebrow">Profile</span><h2>${esc(keys.map(k => LABEL[k]).join(' & '))}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${keys.map(k => `<section class="p6-ob-group">${keys.length > 1 ? `<h2>${esc(LABEL[k])}</h2>` : ''}${chipsHTML(k)}${addOwn(k)}</section>`).join('')}
      ${keys.includes('allergies') ? '<p class="muted tiny">We only flag what an event listing says. Always check with the hosts before you eat.</p>' : ''}
      <button class="btn block" data-close>Done</button></div>`, w => {
      bindChips(w); const obs = new MutationObserver(() => { if (!w.isConnected) { obs.disconnect(); save(); if (TH.state.route === 'profile') TH.render(true); } }); obs.observe(w.parentNode, { childList: true });
    });
  }
  TH.x.editProfileSection = editSheet;

  // =====================================================================
  // SAFETY GATE, shared by Tommy's profile/report shortcuts and the report sheet: the flags Tommy's own handling uses
  // (TA.NLU + TA.Hub) plus a few plain-word nets, so danger, distress and disclosures are never treated as a form.
  // =====================================================================
  const normT = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
  const CRISIS_RE = /\b(kill(ing)? myself|suicid\w*|(want|wanna|going) to die|end (it all|my life)|(don'?t|do not|dont) want to (be here|live|exist|wake up)|hurt(ing)? myself|self[- ]?harm\w*|cut(ting)? myself|starv(e|ing) myself)\b/;
  const SAFE_RE = /\b(haz(e|ed|es|ing)|harass\w*|bull(y|ied|ying|ies)|stalk\w*|unsafe|scared|afraid|threat\w*)\b/;
  const DANGER = [/\bbleed/, /\bblood\b(?! (drive|bank|test|donation|donor|pressure|type|work|sugar))/, /\b(unconscious|unresponsive)\b/, /\b(won'?t|wont|will not|isn'?t|is not|not) wak(e|ing) up\b/,
    /\b(can'?t|cannot|cant|couldn'?t|could not|not|trouble|hard to|struggling to) breath/, /\bchok(e|ed|es|ing)\b/, /\bpass(ed|es|ing)? out\b/, /\bfaint(ed|ing)\b/, /\bseizures?\b/, /\boverdos/, /\bcollaps/,
    /\b(i|he|she|they|we|someone|somebody|my \w+) (just )?(fell|has fallen|slipped|tripped)\b/, /\bhit by (a |an |the )?(car|bike|scooter|bus|truck|vehicle)\b/, /\ballergic reaction\b/, /\banaphyla/, /\bepi-?pen\b/, /\bthroat (is )?(closing|swelling)\b/,
    /\bfollow(ing|ed|s)? (me|us|my|her|him|them)\b/, /\bstalk/, /\b(won'?t|wont|will not|refuses? to) (leave|go away|stop)\b/, /\b(banging|pounding|knocking) on (my|our|the) (door|window)\b/,
    /\b(broke|break|breaking) in(to)?\b/, /\bbreak-?in\b/, /\bintruder/, /\bspark(s|ing)\b/, /\bgas (leak|smell)\b/, /\bsmell(s|ing)? (gas|smoke|burning)\b/, /\bon fire\b/, /\bfire\b(?! (alarm|drill|extinguisher|door|exit|escape|pit|lane|hydrant|safety))/, /\bsmoke\b(?! (detector|alarm))/, /\bflames?\b/, /\btrapped\b/, /\bstuck in (an |the )?elevator\b/, /\b(elevator|lift)\b[^.]{0,30}\bstuck\b[^.]{0,30}\b(people|person|someone|somebody|inside|in it|in there)\b/,
    /\b(weapons?|guns?|gunshots?|knife|knives|shooting|shooter|shots fired)\b/, /\bstab/, /\b(got|been|was|were|is|are|being) shot\b/, /\bshot (at|me|him|her|someone|somebody)\b/,
    /\battack/, /\bassault/, /\bgrab(bed|bing|s)? (me|my|her|him|us|them)\b/, /\bpunch(ed|ing)\b/, /\bbeat (me|her|him|us|them) up\b/, /\bthreat/, /\bkill(s|ed)? (me|myself|him|her|them|someone|somebody|us|you)\b/, /\b(rape|raped|rapist|molest\w*|grop\w*)\b/,
    /\bin danger\b/, /\bemergency\b(?! (exit|light|lights|phone|phones|button|door|kit|contact))/, /\bneed help (now|right now|immediately|asap)\b/, /\bsend help\b/, /\bcall (911|dps|the police|police)\b/];
  const GATE_FLAGS = ['crisis', 'emergency', 'distress', 'disclose', 'threat', 'threatMe', 'violence', 'hazing', 'concern', 'medical', 'injury', 'overdose', 'safetyInfo'];
  const parseN = text => { try { return TA.NLU.parse(String(text || '')); } catch (e) { return null; } };
  function flaggedN(n) {
    if (!n) return true; // can't read it: let Tommy's own handling decide
    if (GATE_FLAGS.some(k => n[k])) return true;
    const HB = (window.TA && TA.Hub) || {};
    try { return !!((HB.flagged && HB.flagged(n)) || (HB.dangerText && HB.dangerText(n)) || (HB.supportCue && HB.supportCue(n))); } catch (e) { return true; }
  }
  const dangerWords = t => CRISIS_RE.test(t) || SAFE_RE.test(t) || DANGER.some(re => re.test(t));
  // null, 'crisis' (self-harm or suicide words: 988 and counseling first) or 'danger' (911 / DPS first)
  function urgency(text) {
    const t = normT(text); if (t.length < 3) return null; const n = parseN(text);
    if ((n && n.crisis) || CRISIS_RE.test(t)) return 'crisis';
    return (n && flaggedN(n)) || dangerWords(t) ? 'danger' : null;
  }
  TH.x.reportUrgency = urgency;

  // =====================================================================
  // REPORT SOMETHING: kind → type → details + photo → where → review → sent (routing simulated)
  // The sheet always opens on the kind step (Emergency first, 911 / DPS one tap away) and offers to continue a draft
  // from there. Every step of a non-emergency report keeps the 911 / DPS line, and a description that sounds like
  // danger gets "This sounds urgent" (call, SOS, or file it anyway) before it can be filed.
  // =====================================================================
  const KINDS = [
    ['emergency', 'Emergency', 'Someone’s in danger or it’s happening now', 'alert', '#b3232a'],
    ['issue', 'Non-emergency', 'Broken, unsafe, dirty or blocked', 'flag', '#0d7d8c'],
    ['feedback', 'Feedback & ideas', 'Dining hall recommendations, campus ideas, the app', 'megaphone', '#8a6400'],
  ];
  const TYPES = {
    issue: [['facilities', 'Facilities & maintenance', 'building'], ['safety', 'Safety concern (not an emergency)', 'shield'], ['access', 'Accessibility', 'access'], ['transport', 'Transportation', 'bus'], ['housing', 'Housing', 'home'], ['clean', 'Cleanliness', 'trash'], ['it', 'Wi-Fi & tech', 'bolt'], ['dining', 'Dining issue', 'fork'], ['other', 'Other', 'info']],
    feedback: [['diningrec', 'Dining hall recommendation', 'fork'], ['dining', 'Dining feedback', 'star'], ['idea', 'Campus idea', 'sparkle'], ['app', 'Trojan Hub or Tommy', 'chat'], ['other', 'Other feedback', 'info']],
  };
  const STARTERS = {
    diningrec: ['More vegan options', 'Longer late-night hours', 'Bring back a dish', 'Halal station', 'Better allergen labels'], dining: ['Long wait', 'Food was cold', 'Great service', 'Missing allergen info'],
    facilities: ['Leak', 'Broken door', 'Lights out', 'Elevator down', 'Too hot or cold'], safety: ['Dark path', 'Broken blue-light phone', 'Suspicious activity', 'Unlocked door'],
    access: ['Ramp blocked', 'Auto door broken', 'Elevator out', 'No step-free route'], transport: ['Bus late', 'Bike rack full', 'Lyft pickup issue', 'Parking problem'],
    housing: ['Laundry broken', 'Noise', 'Lockout', 'Pest problem'], clean: ['Overflowing trash', 'Spill', 'Restroom needs supplies'], it: ['Wi-Fi down', 'Projector broken', 'Printer jam'],
    idea: ['More study spaces', 'More water refill stations', 'Late-night shuttle stop'], app: ['Tommy got it wrong', 'Feature idea', 'Something looks off'], other: [],
  };
  let RD = null;
  const newRD = () => ({ step: 'kind', kind: '', cat: '', desc: '', photos: [], place: '', room: '', urgent: false, dining: '', resume: '', okDesc: '' });
  const typeLabel = (kind, cat) => ((TYPES[kind] || []).find(t => t[0] === cat) || [cat, (RC[cat] || ['Report'])[0]])[1];
  const RSTEPS = ['kind', 'type', 'details', 'where', 'review'];
  // a physical problem needs a place so the office can send someone to it; feedback and ideas can skip it
  const NEEDS_PLACE = new Set(['facilities', 'clean', 'safety', 'access', 'transport', 'housing', 'dining', 'it']);
  const placeNeeded = () => RD.kind === 'issue' && NEEDS_PLACE.has(RD.cat);
  const PLACE_ASK = 'Where is it? Tap “Use my location” or pick a spot so the team can find it.';
  // a draft worth coming back to: a non-emergency report with anything picked, typed or photographed, not yet sent
  const drafty = r => !!(r && r.step !== 'sent' && (r.kind === 'issue' || r.kind === 'feedback') && (r.cat || (r.desc || '').trim() || (r.photos || []).length || (r.place || '').trim()));
  const resumeAt = r => (RSTEPS.indexOf(r.step) > 0 ? r.step : r.step === 'savefail' ? 'review' : r.resume || (r.cat ? 'details' : 'type'));
  const draftLine = r => [KINDS.find(k => k[0] === r.kind)[1], r.cat ? typeLabel(r.kind, r.cat) : '', (r.desc || '').trim() ? `“${r.desc.trim().slice(0, 38)}${r.desc.trim().length > 38 ? '…' : ''}”` : '', r.photos.length ? (r.photos.length === 1 ? '1 photo' : r.photos.length + ' photos') : ''].filter(Boolean).join(' · ');
  function nearbyPlaces(n) { const me = TH.ME || { x: 0, y: 0 }; return (TH.PLACES || []).filter(p => p.x != null && !/gate|parking|transit|restroom|safety/.test(p.cat || '') && !p.inferred).map(p => [p, Math.hypot(p.x - me.x, p.y - me.y)]).sort((a, b) => a[1] - b[1]).slice(0, n).map(a => a[0]); }
  const diningHalls = () => ['evk', 'parkside', 'villagedh'].map(id => (TH.byId || {})[id]).filter(Boolean);
  // the real numbers, one tap each (also on the Reports screen and the SOS record)
  const numLine = lead => `<div class="p6-numbers" role="group" aria-label="Call for help now">${icon('phone')}<span class="p6-num-l">${esc(lead || 'Danger right now? Call')}</span><span class="p6-tels"><a class="p6-tel" href="tel:911">911</a><a class="p6-tel" href="tel:+12137404321">DPS 213-740-4321</a></span></div>`;
  TH.x.numLine = numLine;
  const removedNote = r => (TH.x.photosRemovedNote ? TH.x.photosRemovedNote(r) : '');
  function rPhotos() { return `${RD.photos.map((p, i) => `<span class="x-ph"><img src="${p}" alt="Photo ${i + 1} attached"><button type="button" data-rmph="${i}" aria-label="Remove photo ${i + 1}">${icon('x')}</button></span>`).join('')}${RD.photos.length < 3 ? `<label class="p6-ph-add" for="rp-cam">${icon('camera')}<span>Take photo</span></label><label class="p6-ph-add" for="rp-lib">${icon('plus')}<span>Choose</span></label>` : ''}`; }
  function rHead(title, sub) {
    const s = RD.step, i = RSTEPS.indexOf(s), kc = KINDS.find(k => k[0] === RD.kind), back = s !== 'kind' && s !== 'sent';
    return `<div class="sheet-head"><div>${back ? `<button class="p6-rback" data-r="back">${icon('back')} Back</button>` : `<span class="eyebrow">Report something</span>`}<h2>${esc(title)}</h2>${sub ? `<p class="muted" style="font-size:13.5px;margin-top:2px">${sub}</p>` : ''}</div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      ${i >= 0 ? `<div class="p6-rprog" aria-hidden="true">${RSTEPS.map((x, j) => `<i class="${j <= i ? 'on' : ''}" style="${kc && j <= i ? `background:${kc[4]}` : ''}"></i>`).join('')}</div>` : ''}
      ${RD.kind === 'issue' && (i > 0 || s === 'savefail') ? numLine() : ''}`;
  }
  // "This sounds urgent": shown in place of Next (and before Send) when the student's own words read as danger or crisis.
  // One tap to call; filing the form anyway stays possible but comes last.
  function urgentHTML(u) {
    const what = RD.kind === 'feedback' ? 'feedback' : 'report';
    if (u === 'crisis') return `<div class="p6-urgent crisis" role="alert"><div class="p6-urgent-h" tabindex="-1"><span class="p6-urgent-ic">${icon('heart')}</span><span><b>You don’t have to handle this alone</b><small>Talk to someone now, any time, day or night. If you’re in danger, call 911.</small></span></div>
      <div class="p6-urgent-btns"><a class="btn p6-911" href="tel:988">${icon('phone')} Call or text 988</a><a class="btn p6-dpsb" href="tel:+12137409355">${icon('phone')} USC Counseling · 213-740-9355</a><a class="btn line" href="sms:741741?&body=TROJAN">${icon('chat')} Text TROJAN to 741741</a><a class="btn line" href="tel:911">${icon('phone')} Call 911</a></div>
      <button type="button" class="linkbtn" id="rp-anyway">Keep going with this ${what}</button></div>`;
    return `<div class="p6-urgent" role="alert"><div class="p6-urgent-h" tabindex="-1"><span class="p6-urgent-ic">${icon('alert')}</span><span><b>This sounds urgent</b><small>If anyone is in danger right now, call. It’s faster than a ${what}.</small></span></div>
      <div class="p6-urgent-btns"><a class="btn p6-911" href="tel:911">${icon('phone')} Call 911</a><a class="btn p6-dpsb" href="tel:+12137404321" aria-label="Call USC DPS, 213-740-4321">${icon('phone')} DPS <span class="mono">213-740-4321</span></a><button type="button" class="btn line" id="rp-usos">${icon('alert')} Send SOS with my location</button></div>
      <p class="muted tiny">SOS is simulated in this prototype: it doesn’t reach DPS. Calling reaches real help.</p>
      <button type="button" class="linkbtn" id="rp-anyway">File as ${RD.kind === 'feedback' ? 'feedback' : 'a non-emergency'} anyway</button></div>`;
  }
  function rBody() {
    const s = RD.step;
    if (s === 'kind') return `${rHead('What do you want to report?', 'Photo, a few words and where. We send it to the right USC office.')}
      <div class="p6-kinds">${KINDS.map(([k, l, sub, ic, col]) => `<button class="p6-kind" data-kind="${k}" style="--kc:${col}"><span class="p6-kind-ic">${icon(ic)}</span><span><b>${l}</b><small>${sub}</small></span>${icon('chev', 'chev')}</button>`).join('')}</div>
      ${numLine()}
      ${drafty(RD) ? `<div class="p6-draft"><span class="p6-draft-ic">${icon('pencil')}</span><span class="p6-draft-m"><b>Continue your draft</b><small>${esc(draftLine(RD))}</small></span><span class="p6-draft-b"><button class="btn" data-r="resume">Continue ${icon('chev')}</button><button class="linkbtn" data-r="fresh">Start fresh</button></span></div>` : ''}`;
    if (s === 'emergency') return `${rHead('Get help now')}
      <div class="p6-emerg"><a class="btn p6-911 block" href="tel:911">${icon('phone')} Call 911</a><a class="btn block p6-dpsb" href="tel:+12137404321">${icon('phone')} Call USC DPS · 213-740-4321</a>
        <button class="btn block line" id="rp-sos">${icon('alert')} Send SOS with my location</button>
        <p class="muted tiny">DPS (Department of Public Safety) answers 24/7. The SOS button is simulated in this prototype, so call if you need help.</p>
        <button class="linkbtn" data-kind="issue">It’s not urgent. File a non-emergency report instead.</button></div>`;
    if (s === 'type') return `${rHead(RD.kind === 'feedback' ? 'What kind of feedback?' : 'What kind of problem?')}
      <div class="p6-types">${TYPES[RD.kind].map(([k, l, ic]) => `<button class="p6-type" data-cat="${k}" aria-pressed="${RD.cat === k}">${icon(ic)}<span>${esc(l)}</span></button>`).join('')}</div>`;
    if (s === 'details') {
      const st = STARTERS[RD.cat] || [];
      return `${rHead(typeLabel(RD.kind, RD.cat), RD.kind === 'feedback' ? 'Say what you’d love to see. Specifics help.' : 'What’s wrong? A photo helps the team find it fast.')}
        ${RD.cat === 'diningrec' || RD.cat === 'dining' ? `<div class="field"><label>Which dining hall?</label><div class="x-chips">${diningHalls().map(p => `<button type="button" class="chip" data-dh="${esc(p.name)}" aria-pressed="${RD.dining === p.name}">${esc(p.name.replace(/ \(.*\)/, ''))}</button>`).join('')}</div></div>` : ''}
        ${st.length ? `<div class="x-chips p6-starters">${st.map(t => `<button type="button" class="chip" data-starter="${esc(t)}">${icon('plus')}${esc(t)}</button>`).join('')}</div>` : ''}
        <div class="field"><label for="rp-desc">${RD.kind === 'feedback' ? 'Your idea or feedback' : 'Describe it'}</label><textarea id="rp-desc" maxlength="500" rows="3" placeholder="${RD.cat === 'diningrec' ? 'e.g. Please add a build-your-own grain bowl at EVK on weeknights' : 'e.g. The second-floor water fountain is leaking onto the hallway'}">${esc(RD.desc)}</textarea></div>
        <div class="field"><label>Photo <span class="muted">(optional, up to 3)</span></label><div class="x-photos p6-photos" id="rp-photos">${rPhotos()}</div>
          <input type="file" id="rp-cam" accept="image/*" capture="environment" hidden><input type="file" id="rp-lib" accept="image/*" multiple hidden><span class="muted tiny">Shrunk and kept on this device only. Your 10 newest report and SOS photos are kept.</span></div>
        ${RD.kind === 'issue' ? `<label class="check"><input type="checkbox" id="rp-urgent" ${RD.urgent ? 'checked' : ''}><span>It needs attention today</span></label>` : ''}
        <div class="err" hidden></div><div id="rp-urgent-box" hidden></div><button class="btn block" data-r="next" id="rp-next">Next: where is it? ${icon('chev')}</button>`;
    }
    if (s === 'where') {
      const near = nearbyPlaces(4), here = nearestPlace(), need = placeNeeded();
      return `${rHead('Where is it?', need ? 'Pick a spot so the team knows where to go.' : 'Optional. Add a spot if it’s about one place.')}
        <button class="p6-here ${RD.place && here && RD.place === here.name ? 'on' : ''}" id="rp-here"><span class="p6-here-ic">${icon('locate')}</span><span><b>Use my location</b><small>${esc(here ? here.name : 'Your position')} · demo position</small></span>${icon('chev', 'chev')}</button>
        <div class="field"><label>Nearby</label><div class="x-chips">${near.map(p => `<button type="button" class="chip" data-pl="${esc(p.name)}" aria-pressed="${RD.place === p.name}">${icon('pin')}${esc(p.name.replace(/ \(.*\)/, ''))}</button>`).join('')}</div></div>
        <div class="field"><label for="rp-place">Or search a building</label><input id="rp-place" type="search" list="rp-places" maxlength="80" placeholder="Search buildings and places" value="${esc(RD.place)}"><datalist id="rp-places">${[...new Set((TH.PLACES || []).map(p => p.name))].sort().map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist></div>
        <div class="field"><label for="rp-room">Floor, room or exact spot <span class="muted">(optional)</span></label><input id="rp-room" maxlength="60" placeholder="e.g. 2nd floor by the elevators" value="${esc(RD.room)}"></div>
        <div class="err" role="alert" ${RD.placeErr ? '' : 'hidden'}>${RD.placeErr ? esc(PLACE_ASK) : ''}</div><button class="btn block" data-r="next">Review ${icon('chev')}</button>`;
    }
    if (s === 'review') {
      const r = routeFor({ cat: RD.cat, desc: RD.desc, place: RD.place, room: RD.room });
      return `${rHead('Look good?')}
        <div class="card p6-review"><span class="pill ${RD.kind === 'feedback' ? 'gold' : 'warn'}">${RD.kind === 'feedback' ? 'Feedback' : 'Non-emergency'}</span><b>${esc(typeLabel(RD.kind, RD.cat))}${RD.dining ? ' · ' + esc(RD.dining.replace(/ \(.*\)/, '')) : ''}</b>
          <p>${esc(RD.desc)}</p>${RD.photos.length ? `<div class="x-photos">${RD.photos.map(p => `<img src="${p}" alt="Attached photo">`).join('')}</div>` : ''}
          <span class="p6-rv-where">${icon('pin')}${esc(r.where || 'No location (optional for this one)')}</span></div>
        <div class="p6-route"><span class="p6-route-ic">${icon('send')}</span><span><small>Routes to · simulated</small><b>${esc(r.office)}</b><span>${esc(r.team)} · Est. first reply: ${esc(r.eta)}${RD.urgent ? ' · marked urgent' : ''}</span></span></div>
        <button class="btn block p6-big" data-r="submit">${icon('send')} Send ${RD.kind === 'feedback' ? 'feedback' : 'report'}</button>
        ${sim('Simulated: nothing is sent. Office routing and reply times are this prototype’s design and estimates, not an existing USC system.')}`;
    }
    if (s === 'savefail') return `${rHead('Couldn’t save your report')}
      <div class="banner">${icon('alert')}<div><b>This device’s storage is full</b><span>Your report wasn’t saved, so nothing was filed. Your words are still here. ${RD.photos.length ? 'Try sending it without photos, or close this and try later.' : 'Close this and try again later.'}</span></div></div>
      <div class="btn-row"><button class="btn line" data-r="nophotos" ${RD.photos.length ? '' : 'hidden'}>Send without photos</button><button class="btn" data-r="submit">Try again</button></div>`;
    if (s === 'sent') {
      const rep = X().reports.find(q => q.id === RD.sentId) || {};
      const warn = [RD.lostPhotos ? `Saved without your ${RD.lostPhotos === 1 ? 'photo' : 'photos'}: this device’s storage is full.` : '', RD.freed ? `To save space, ${RD.freed === 1 ? '1 photo was' : RD.freed + ' photos were'} removed from older reports. Your ${TH.x.PHOTO_KEEP || 10} newest photos are kept.` : ''].filter(Boolean);
      return `<div class="p6-sent"><div class="p6-burst sm" aria-hidden="true">${Array.from({ length: 10 }, (_, j) => `<i style="--a:${j * 36}deg;--d:${(j % 3) * 50}ms"></i>`).join('')}<span>${icon('check')}</span></div>
        <h2>${rep.kind === 'feedback' ? 'Thanks! Feedback sent' : 'Report sent'}</h2>
        <p class="muted">To <b>${esc(rep.office || '')}</b> (simulated). Est. first reply: ${esc(rep.eta || 'soon')}. You’ll get a note here when it moves.</p>
        <div class="p6-conf"><small>Confirmation</small><b class="mono">${esc(rep.id || '')}</b></div>
        ${warn.length ? `<div class="banner info p6-sent-warn">${icon('info')}<div><span>${esc(warn.join(' '))}</span></div></div>` : ''}
        <div class="btn-row"><button class="btn line" data-close>Done</button><button class="btn" id="rp-track">Track in My reports</button></div></div>
        ${rep.kind === 'issue' ? numLine() : ''}`;
    }
    return '';
  }
  function rPaint(w) { const box = $('.p6-rsheet', w); if (!box) return; box.innerHTML = rBody(); box.scrollTop = 0; const sh = box.closest('.sheet'); if (sh) sh.scrollTop = 0; }
  // the report screen and Home show a new report right away (behind the sheet), so "Done" lands on an up-to-date list
  const refreshBehind = () => { if (['report', 'home'].includes(TH.state.route)) { try { TH.render(true); } catch (e) { console.error(e); } } };
  TH.openReportSheet = function (kind) {
    const draft = drafty(RD) ? RD : null;
    if (kind === 'emergency') { RD = draft || newRD(); RD.resume = draft ? resumeAt(draft) : ''; RD.step = 'emergency'; }
    else if (kind === 'issue' || kind === 'feedback') { RD = draft && draft.kind === kind ? draft : Object.assign(newRD(), { kind }); RD.step = RSTEPS.indexOf(RD.step) > 0 ? RD.step : 'type'; RD.resume = ''; }
    else { RD = draft || newRD(); RD.resume = draft ? resumeAt(draft) : ''; RD.step = 'kind'; } // always the kind step first: Emergency and the numbers
    TH.sheet(`<div class="stack p6-rsheet"></div>`, w => {
      rPaint(w);
      const go = st => { RD.step = st; rPaint(w); };
      // no place for a physical problem: stay on Where, say why in friendly words, and point at "Use my location"
      const askPlace = () => { RD.placeErr = true; if (!$('#rp-here', w)) rPaint(w); const er = $('.err', w); if (er) { er.hidden = false; er.textContent = PLACE_ASK; } const h = $('#rp-here', w); if (h) { h.classList.remove('nudge'); void h.offsetWidth; if (!reduced()) h.classList.add('nudge'); h.focus({ preventScroll: false }); } };
      const placeOk = () => { RD.placeErr = false; const er = $('.err', w); if (er && RD.step === 'where') er.hidden = true; };
      const readDetails = () => { const d = $('#rp-desc', w); if (d) RD.desc = d.value; const u = $('#rp-urgent', w); if (u) RD.urgent = u.checked; const pl = $('#rp-place', w); if (pl) RD.place = pl.value.trim(); const rm = $('#rp-room', w); if (rm) RD.room = rm.value.trim(); };
      const showUrgent = u => {
        if (RD.step !== 'details') { RD.step = 'details'; rPaint(w); }
        const box = $('#rp-urgent-box', w), nx = $('#rp-next', w); if (!box) return;
        box.innerHTML = urgentHTML(u); box.hidden = false; if (nx) nx.hidden = true;
        const h = $('.p6-urgent-h', box); if (h) h.focus({ preventScroll: true }); try { box.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { /* old browsers */ }
      };
      const hideUrgent = () => { const box = $('#rp-urgent-box', w), nx = $('#rp-next', w); if (box && !box.hidden) { box.hidden = true; box.innerHTML = ''; if (nx) nx.hidden = false; } };
      const pickKind = k => {
        if (k === 'emergency') { if (drafty(RD) && !RD.resume) RD.resume = resumeAt(RD); return go('emergency'); } // a draft stays as it is
        if (RD.kind !== k) { RD.kind = k; RD.cat = ''; RD.dining = ''; } // words, photos and place come along
        RD.resume = ''; go('type');
      };
      function submit(noPhotos) {
        if (placeNeeded() && RD.place.trim().length < 2) { RD.step = 'where'; return askPlace(); }
        const u = urgency(RD.desc); if (u && RD.okDesc !== RD.desc.trim()) return showUrgent(u);
        if (noPhotos) RD.photos = [];
        const xs = TH.x, cap = xs.capPhotos || (() => 0), trySave = xs.trySave || (() => { save(); return true; }), commit = xs.commitChecked || (m => { TH.commit(m); return true; });
        const r = routeFor({ cat: RD.cat, desc: RD.desc, place: RD.place, room: RD.room });
        const rep = { id: (RD.kind === 'feedback' ? 'FB-' : 'TR-') + (1000 + hash(RD.desc + Date.now()) % 9000), kind: RD.kind, cat: r.cat, type: typeLabel(RD.kind, RD.cat), desc: RD.desc.trim(), where: r.where, office: r.office, team: r.team, eta: r.eta, photos: RD.photos.slice(), urgent: RD.urgent, at: Date.now(), status: 0, sim: true };
        const msg = `${rep.kind === 'feedback' ? 'Sent feedback' : 'Reported a problem'} to ${rep.office} (${rep.id}, simulated)`;
        X().reports.unshift(rep);
        let freed = cap(), lostPhotos = 0, ok = commit(msg); // only the newest photos stay on this device
        if (!ok && rep.photos.length) { lostPhotos = rep.photos.length; rep.photos = []; rep.photosRemoved = lostPhotos; ok = trySave(); } // the photos are what didn't fit
        if (!ok) { freed += cap(0); ok = trySave(); } // last resort: no photos at all, so the report itself is kept
        if (!ok) {
          // nothing could be written: take the report back out and keep the draft, so nothing says "sent" or "saved"
          const xr = X().reports, i = xr.indexOf(rep); if (i >= 0) xr.splice(i, 1);
          try { const L = TA.State.d.log; if (L && L[0] && L[0].action === msg) L.shift(); } catch (e) { /* log is optional */ }
          return go('savefail');
        }
        RD = Object.assign(newRD(), { step: 'sent', sentId: rep.id, lostPhotos, freed }); rPaint(w); refreshBehind();
      }
      w.addEventListener('click', e => {
        const k = e.target.closest('[data-kind]'); if (k) return pickKind(k.dataset.kind);
        const c = e.target.closest('[data-cat]'); if (c) { RD.cat = c.dataset.cat; return go('details'); }
        const dh = e.target.closest('[data-dh]'); if (dh) { RD.dining = RD.dining === dh.dataset.dh ? '' : dh.dataset.dh; if (RD.dining) RD.place = RD.dining; $$('[data-dh]', w).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dh === RD.dining))); return; }
        const sr = e.target.closest('[data-starter]'); if (sr) { const d = $('#rp-desc', w); d.value = (d.value.trim() ? d.value.trim() + '. ' : '') + sr.dataset.starter; RD.desc = d.value; hideUrgent(); d.focus(); return; }
        const rm = e.target.closest('[data-rmph]'); if (rm) { RD.photos.splice(+rm.dataset.rmph, 1); $('#rp-photos', w).innerHTML = rPhotos(); return; }
        const pl = e.target.closest('[data-pl]'); if (pl) { RD.place = pl.dataset.pl; $('#rp-place', w).value = RD.place; $$('[data-pl]', w).forEach(b => b.setAttribute('aria-pressed', String(b === pl))); $('#rp-here', w).classList.remove('on'); placeOk(); return; }
        if (e.target.closest('#rp-here')) { const p = nearestPlace(); if (!p) return TH.toast('Couldn’t find a place near you', 'alert'); RD.place = p.name; $('#rp-place', w).value = p.name; $('#rp-here', w).classList.add('on'); $$('[data-pl]', w).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pl === p.name))); placeOk(); return; }
        if (e.target.closest('#rp-sos, #rp-usos')) { readDetails(); TH.closeSheet(); TH.panic(); return; }
        if (e.target.closest('#rp-anyway')) { readDetails(); RD.okDesc = RD.desc.trim(); return go('where'); }
        if (e.target.closest('#rp-track')) { TH.closeSheet(); TH.go('report'); return; }
        const b = e.target.closest('[data-r]'); if (!b) return; const a = b.dataset.r;
        if (a === 'resume') { const st = RD.resume || resumeAt(RD); RD.resume = ''; return go(st); }
        if (a === 'fresh') { RD = newRD(); return rPaint(w); }
        if (a === 'back') { readDetails(); RD.placeErr = false; if (RD.step === 'emergency') return go('kind'); if (RD.step === 'savefail') return go('review'); const i = RSTEPS.indexOf(RD.step); return go(RSTEPS[Math.max(0, i - 1)]); }
        if (a === 'next') {
          readDetails();
          if (RD.step === 'details') {
            if (RD.desc.trim().length < 3) { const er = $('.err', w); er.hidden = false; er.textContent = RD.kind === 'feedback' ? 'Add a few words so the team knows what you mean.' : 'Describe it in a few words so the right team can act.'; $('#rp-desc', w).focus(); return; }
            // safety check on the student's own words before this becomes a form: call, SOS, or file it anyway
            const u = urgency(RD.desc); if (u && RD.okDesc !== RD.desc.trim()) return showUrgent(u);
            return go('where');
          }
          if (RD.step === 'where') { if (placeNeeded() && RD.place.trim().length < 2) return askPlace(); RD.placeErr = false; return go('review'); }
        }
        if (a === 'submit') return submit(false);
        if (a === 'nophotos') return submit(true);
      });
      w.addEventListener('input', e => { if (e.target.id === 'rp-desc') { RD.desc = e.target.value; const er = $('.err', w); if (er) er.hidden = true; hideUrgent(); } if (e.target.id === 'rp-place') { RD.place = e.target.value; if (RD.place.trim().length >= 2) placeOk(); } });
      w.addEventListener('change', async e => {
        if (e.target.id !== 'rp-cam' && e.target.id !== 'rp-lib') return;
        const files = [...e.target.files].slice(0, 3 - RD.photos.length); e.target.value = '';
        const shrinkIt = TH.x.shrinkPhoto || (f => shrink(f, 150));
        for (const f of files) { const d = await shrinkIt(f); if (d) RD.photos.push(d); else TH.toast('That file isn’t a photo this app can read', 'alert'); }
        const ph = $('#rp-photos', w); if (ph) ph.innerHTML = rPhotos();
      });
    });
  };
  TH.x.openReportSheet = TH.openReportSheet;

  // ---------- Report screen: start a report, My reports, SOS alerts, flagged Tommy questions ----------
  const statusPill = r => `<span class="pill ${r.status === 3 ? 'ok' : r.status === 0 ? 'mute' : 'warn'}">${STAT[r.status]}</span>`;
  const repCard = r => { const kc = (KINDS.find(k => k[0] === (r.kind || 'issue')) || KINDS[1]); return `<button class="p6-rep" data-rep="${esc(r.id)}" style="--kc:${kc[4]}"><span class="p6-rep-ic">${icon(RC[r.cat] ? RC[r.cat][1] : 'flag')}</span><span class="p6-rep-m"><span class="p6-rep-t"><b>${esc(r.type || (RC[r.cat] || ['Report'])[0])}</b>${statusPill(r)}</span><span class="p6-rep-d">${esc(r.desc.slice(0, 80))}${r.desc.length > 80 ? '…' : ''}</span><span class="p6-rep-s mono">${esc(r.id)} · ${esc(r.office)} · ${ago(r.at)} · simulated</span><span class="x-steps">${STAT.map((s, i) => `<i class="${i <= r.status ? 'on' : ''}"></i>`).join('')}</span></span>${r.photos && r.photos[0] ? `<img class="p6-rep-ph" src="${r.photos[0]}" alt="">` : ''}</button>`; };
  const SOS_ST = { sent: ['Sent · simulated', 'bad'], safe: ['Marked safe', 'ok'], cancelled: ['Cancelled', 'mute'] };
  const sosCard = a => { const st = SOS_ST[a.status || 'sent'] || SOS_ST.sent, W = TH.x.SOS_WHAT || []; return `<button class="p6-rep sos" data-sos="${esc(a.id || a.at)}" style="--kc:#b3232a"><span class="p6-rep-ic">${icon('alert')}</span><span class="p6-rep-m"><span class="p6-rep-t"><b>SOS alert</b><span class="pill ${st[1]}">${st[0]}</span></span><span class="p6-rep-d">${esc([(a.what || []).map(k => (W.find(w => w[0] === k) || [k, k])[1]).join(', '), a.note ? '“' + a.note.split('\n')[0].slice(0, 50) + '”' : ''].filter(Boolean).join(' · ') || 'No details added')}</span><span class="p6-rep-s mono">Near ${esc(a.loc)} · ${ago(a.at)} · simulated</span></span>${a.photos && a.photos[0] ? `<img class="p6-rep-ph" src="${a.photos[0]}" alt="">` : ''}</button>`; };
  function openRep(id) {
    const r = X().reports.find(q => q.id === id); if (!r) return; const rn = removedNote(r);
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${r.kind === 'feedback' ? 'Feedback' : 'Report'} ${esc(r.id)} · simulated</span><h2>${esc(r.type || (RC[r.cat] || ['Report'])[0])}</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <p>${esc(r.desc)}</p>${r.photos && r.photos.length ? `<div class="x-photos p6-big-ph">${r.photos.map(p => `<img src="${p}" alt="Attached photo">`).join('')}</div>` : ''}${rn ? `<p class="p6-phgone">${icon('info')}<span>${esc(rn)}</span></p>` : ''}
      <dl class="kv"><dt>Where</dt><dd>${esc(r.where || 'Not given')}</dd><dt>Sent to</dt><dd>${esc(r.office)} (simulated)</dd><dt>Handled by</dt><dd>${esc(r.team)}</dd>${r.eta ? `<dt>First reply</dt><dd>Est. ${esc(r.eta)}</dd>` : ''}<dt>Status</dt><dd>${STAT[r.status]}${r.urgent ? ' · urgent' : ''}</dd><dt>Sent</dt><dd>${ago(r.at)}</dd></dl>
      <div class="p6-track">${STAT.map((s, i) => `<div class="${i <= r.status ? 'on' : ''}"><i>${icon(i <= r.status ? 'check' : 'clock')}</i><span><b>${s}</b><small>${[r.photos && r.photos.length ? 'Your report and photos were saved on this device.' : 'Your report was saved on this device.', `Sent to ${esc(r.team)} (simulated).`, 'Someone is working on it (simulated).', r.reply ? esc(r.reply) : 'You’ll get a note when it’s done.'][i]}</small></span></div>`).join('')}</div>
      ${r.kind !== 'feedback' ? numLine() : ''}
      ${sim('Simulated. In a real launch this would file the work order or ticket with that office. Reply times are estimates.')}</div>`);
  }
  function openSos(id) {
    const a = (X().panic || []).find(q => String(q.id || q.at) === String(id)); if (!a) return; const W = TH.x.SOS_WHAT || [], rn = removedNote(a);
    TH.sheet(`<div class="stack"><div class="sheet-head"><div><span class="eyebrow">${esc(a.id || 'SOS')} · simulated</span><h2>SOS alert</h2></div><button class="iconbtn flat" data-close aria-label="Close">${icon('x')}</button></div>
      <dl class="kv"><dt>When</dt><dd>${a.time ? esc(a.time) + ' · ' : ''}${ago(a.at)}</dd><dt>Where</dt><dd>Near ${esc(a.loc)}${a.lat ? ` (${Number(a.lat).toFixed(4)}, ${Number(a.lon).toFixed(4)})` : ''}</dd><dt>How</dt><dd>${esc(a.how || 'Panic button')}</dd><dt>Status</dt><dd>${(a.status || 'sent') === 'sent' ? 'Sent (simulated: DPS was not contacted)' : (SOS_ST[a.status] || SOS_ST.sent)[0]}</dd></dl>
      ${(a.what || []).length ? `<div class="p6-why neg">${a.what.map(k => `<span>${esc((W.find(w => w[0] === k) || [k, k])[1])}</span>`).join('')}</div>` : ''}
      ${a.note ? `<p style="white-space:pre-line">${esc(a.note)}</p>` : ''}${a.photos && a.photos.length ? `<div class="x-photos p6-big-ph">${a.photos.map(p => `<img src="${p}" alt="Photo added to the alert">`).join('')}</div>` : ''}${rn ? `<p class="p6-phgone">${icon('info')}<span>${esc(rn)}</span></p>` : ''}
      ${(a.updates || []).length ? `<ol class="p6-sos-log light">${a.updates.map(u => `<li><span class="mono">${esc(u.time || '')}</span>${esc(u.text)}</li>`).join('')}</ol>` : ''}
      ${numLine('Need help now? Call')}
      ${sim('Simulated in this prototype: no alert reached DPS. The photo and note stay on this device.')}</div>`);
  }
  TH.screens.report = {
    render() {
      const x = X(), mine = x.reports, sos = (x.panic || []).slice(0, 5), gaps = x.gaps.filter(g => !g.sample), open = mine.filter(r => r.status < 3).length;
      return `<div class="screen">${top('Reports')}<div class="pad screen-body stack">
        <button class="p6-reportcta" id="rs-new"><span class="p6-rc-ic">${icon('camera')}</span><span><b>Report something</b><small>Photo + a few words + where. Emergency, problem or idea.</small></span>${icon('chev', 'chev')}</button>
        ${numLine('Emergency? Call')}
        <p class="p6-nonemerg muted">DPS non-emergency: <a href="tel:+12137406000">213-740-6000</a></p>
        ${sos.length ? `<div class="section"><div class="section-head"><h2>SOS alerts</h2></div><div class="p6-reps">${sos.map(sosCard).join('')}</div></div>` : ''}
        <div class="section"><div class="section-head"><h2>My reports</h2>${mine.length ? `<span class="pill ${open ? 'warn' : 'ok'}">${open} open</span>` : ''}</div>
          ${mine.length ? `<div class="p6-reps">${mine.map(repCard).join('')}</div>` : `<div class="empty">${icon('flag')}<b>Nothing reported yet</b><span>Spot something broken, unsafe or worth improving? Report it in under a minute.</span></div>`}</div>
        ${gaps.length ? `<div class="section"><div class="section-head"><h2>Questions Tommy is getting fixed</h2></div><div class="rows">${gaps.map(g => `<div class="row" style="--rc:var(--gold-ink)"><span class="rico">${icon('sparkle')}</span><span class="rmain"><span class="rtitle wrap">“${esc(g.q)}”</span><span class="rsub wrap">${g.answer ? 'Answered: ' + esc(g.answer) : esc(g.why) + ' · flagged ' + ago(g.at)}</span></span><span class="rside"><span class="pill ${g.answer ? 'ok' : 'warn'}">${g.answer ? 'Answered' : 'Flagged'}</span></span></div>`).join('')}</div></div>` : ''}
        ${sim('Reports and SOS alerts are simulated on the demo account and stay on this device, with your 10 newest photos. Office routing and reply times are this prototype’s design and estimates.')}
      </div></div>`;
    },
    mount(host) {
      $('#rs-new', host).onclick = () => TH.openReportSheet();
      host.addEventListener('click', e => { const b = e.target.closest('[data-rep]'); if (b) return openRep(b.dataset.rep); const s = e.target.closest('[data-sos]'); if (s) openSos(s.dataset.sos); });
    },
  };
  TH.x.openReport = openRep;

  // =====================================================================
  // HOME: avatar in the header, finish-setup card, Plan my day + Report something
  // =====================================================================
  const home0 = TH.screens.home.render, homeM0 = TH.screens.home.mount;
  function setupCard() {
    const p = P(); if (p.onboarded) return '';
    const step = Math.max(0, Math.min(stepCount(), (p.obStep || 1) - 1)), started = p.obStep > 0;
    return `<button class="p6-setup" id="hm-ob"><span class="p6-setup-ic">${ring(started ? step / stepCount() * 100 : 8, 46)}<i>${icon('sparkle')}</i></span><span class="p6-setup-m"><b>${started ? 'Finish setting up' : 'Make Trojan Hub yours'}</b><small>${started ? `${step} of ${stepCount()} done · ` : ''}60 seconds: interests, career, food, allergies. Better picks everywhere.</small></span><span class="btn sm gold">${started ? 'Resume' : 'Start'}</span></button>`;
  }
  function duo() {
    const x = X(), open = x.reports.filter(r => r.status < 3).length, firstName = TH.student().first;
    return `<div class="p6-duo">
      <button class="p6-plan" id="hm-plan"><span class="p6-plan-av" aria-hidden="true">T</span><span class="p6-plan-k">With Tommy</span><b>Plan my day</b><small>Classes, clubs, food and free time, sorted for ${esc(firstName)}</small><span class="p6-plan-go">Plan it ${icon('chev')}</span></button>
      <div class="p6-rcol">
        <button class="p6-report" id="hm-report"><span class="p6-rep-ic2">${icon('camera')}</span><b>Report something</b><small>Photo, place, sent to the right office</small></button>
        <button class="p6-myrep" data-go="report">${icon('flag')}<span>My reports</span>${open ? `<i>${open}</i>` : ''}</button>
      </div></div>`;
  }
  TH.screens.home.render = function () {
    let h = home0.call(this);
    const st = TH.student(), c = completeness();
    h = h.replace(/(<span class="hero-btns">[\s\S]*?)(<\/span><\/div>)/, (m, a, b) => a + `<button class="p6-hav" data-go="profile" aria-label="My profile, ${c.pct}% set up">${ring(c.pct, 38)}<span>${initials(st)}</span></button>` + b);
    h = h.replace(/(<nav class="quick"[\s\S]*?<\/nav>)/, m => m + setupCard() + duo());
    return h;
  };
  TH.screens.home.mount = function (host) {
    homeM0 && homeM0.call(this, host);
    const ob = $('#hm-ob', host); if (ob) ob.onclick = () => TH.openOnboarding();
    const pl = $('#hm-plan', host); if (pl) pl.onclick = goPlan;
    const rp = $('#hm-report', host); if (rp) rp.onclick = () => TH.openReportSheet();
  };

  // MORE: profile row shows how complete it is
  const more0 = TH.screens.more.render;
  TH.screens.more.render = function () {
    const c = completeness();
    return more0.call(this).replace(/(data-go="profile"[\s\S]*?<span class="rsub wrap">)[^<]*/, (m, a) => a + `${c.pct}% set up · interests, career, food, allergies, thumbs`);
  };

  // poster rows on Home show their reason ("why" chip) — hub2c draws the posters, this adds the chip after render
  function whyChips(host) {
    const map = new Map(); try { recEvents(80).forEach(o => map.set(String(o.e.id), o)); } catch (e) { return; }
    $$('.x-post[data-event]', host).forEach(b => { if ($('.p6-pw', b)) return; const o = map.get(String(b.dataset.event)); if (!o || !o.why.length) return; const pb = $('.pb', b); if (pb) pb.insertAdjacentHTML('beforeend', `<span class="p6-pw">${icon('sparkle')}${esc(o.why[0])}</span>`); });
  }
  const homeM1 = TH.screens.home.mount;
  TH.screens.home.mount = function (host) { homeM1.call(this, host); whyChips(host); };

  // =====================================================================
  // TOMMY: "edit my profile", "retake the quiz", "report something", "give feedback"
  // Only short whole commands open a screen. Anything longer, anything the safety gate flags (danger, crisis, distress,
  // disclosures, support cues) and anything said while Tommy waits on an answer goes to Tommy's own handling first,
  // so 911 / DPS / 988 answers always come before any sheet, screen or setup.
  // =====================================================================
  const LEAD = "(?:(?:hey |hi |ok |okay )?tommy )?(?:please |pls |can you |could you |can i |could i |may i |let me |help me |i (?:want|need|would like|wanna) to |i'?d like to |id like to )?";
  const TAIL = '(?: please| pls| for me| now)?';
  const T_QUIZ = new RegExp(`^${LEAD}(?:(?:retake|redo|re-do|restart|start over|go through)(?: the| my| that)? (?:quiz|onboarding|setup|set ?up|set-up|profile quiz|setup quiz|questions)(?: again| over)?|finish(?: my| the)? (?:setup|set ?up|onboarding)|personali[sz]e (?:the app|trojan hub|my app))${TAIL}$`);
  const T_PROFILE = new RegExp(`^${LEAD}(?:(?:edit|update|change|open|show|see|view|fix|check|go to)(?: me)? (?:my )?(?:profile|preferences|prefs|interests|hobbies|allergies|allergy info|dietary (?:needs|restrictions|preferences)|diet|food preferences|career goals|career interests|minor|intended minor|club types)|(?:my )?profile(?: page)?)${TAIL}$`);
  const T_FEEDBACK = new RegExp(`^${LEAD}(?:(?:give|leave|send|share|submit)(?: some| my)? (?:feedback|a suggestion|an idea)|(?:give |make |send |submit )?(?:a )?dining hall (?:suggestion|recommendation))${TAIL}$`);
  const T_REPORT = new RegExp(`^${LEAD}(?:report|submit|file|make|start)(?: a| an)? (?:something|issue|problem|report)${TAIL}$`);
  const cmdText = raw => normT(raw).replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  function tommyShortcut(raw) {
    if (/^\s*@/.test(raw)) return null;
    const t = cmdText(raw); if (!t || t.length > 60) return null;
    if (T_QUIZ.test(t)) return { act: () => TH.openOnboarding({ retake: true }), md: 'Opening the quick setup. Pick what you like, skip what you don’t, and your picks update right away.' };
    if (T_PROFILE.test(t)) return { act: () => TH.go('profile'), md: 'Opening your profile. Tap any section to edit it. The more you add, the better your picks get.' };
    if (T_FEEDBACK.test(t)) return { act: () => TH.openReportSheet('feedback'), md: 'Opening Report something for feedback: pick what it’s about, add a photo if it helps, and I’ll route it to the right office (simulated).' };
    if (T_REPORT.test(t)) return { act: () => TH.openReportSheet(), md: 'Opening Report something: pick the kind, add a photo and where, and I’ll route it to the right office (simulated).' };
    return null;
  }
  TH.x.tommyShortcut = raw => { const s = tommyShortcut(String(raw || '')); return s ? s.md : null; };
  function wrapTommyProfile() {
    const TS = window.TA && TA.Script; if (!TS || !TS.handle || TS._p6Profile) return; TS._p6Profile = true;
    const h0 = TS.handle;
    TS.handle = async function (text) {
      const raw = String(text || '');
      // 1) a waiting request (plan, order, join…) keeps its own flow; 2) safety first: anything the gate flags, or that
      // uses danger, crisis or support words, goes to Tommy's own handling; 3) only then a short whole command opens a screen
      if (window.TA && TA.Brain && TA.Brain.pending) return h0.call(TS, text);
      if (flaggedN(parseN(raw)) || dangerWords(normT(raw))) return h0.call(TS, text);
      const sc = tommyShortcut(raw); if (!sc) return h0.call(TS, text);
      setTimeout(() => { try { sc.act(); } catch (e) { console.error(e); } }, 500);
      return [{ role: 'bot', md: sc.md }];
    };
  }

  // =====================================================================
  // BOOT: first open (or first sign-in) runs onboarding; skippable and resumable
  // =====================================================================
  const boot0 = TH.boot;
  TH.boot = function () {
    boot0.apply(this, arguments);
    try { wrapTommyProfile(); } catch (e) { console.error(e); }
    // devices that saved more photos before the cap: keep the newest 10 so the account store has room again
    try { if (TH.x.capPhotos && TH.x.capPhotos() > 0 && TH.x.trySave) TH.x.trySave(); } catch (e) { /* storage check is optional */ }
    const auto = () => {
      try {
        if (OB || !(window.TA && TA.State && TA.State.d)) return; const p = P();
        if (p.onboarded || p.obSkipped || navigator.webdriver) return; // automated test browsers skip the auto-open; TH.openOnboarding() still works
        if ($('.x-panic') || $('.x-call') || $('.sheet-wrap')) return;
        TH.openOnboarding();
      } catch (e) { console.error(e); }
    };
    setTimeout(auto, 3300); // after the splash
    try { if (TA.State && TA.State.signIn && !TA.State._p6) { TA.State._p6 = true; const si = TA.State.signIn; TA.State.signIn = function () { const r = si.apply(this, arguments); setTimeout(() => { try { if (!P().onboarded) { P().obSkipped = 0; TH.openOnboarding(); } } catch (e) { /* not ready */ } }, 600); return r; }; } } catch (e) { /* sign-in hook is optional */ }
  };
})(window.TH = window.TH || {});
