/* js/p7-howto.js — Part 7: "How Tommy works", a one-screen explainer (route `howtommy`).
 *
 * A two-lane flow: what happens on the student's phone (left) and what Claude sees (right), with a dashed
 * "privacy line" between them, then a summary of what Claude can see vs. what stays on the phone.
 * Reachable from: Ask Tommy's ⋯ menu ("How Tommy works"), More → Help, and the desktop side panel.
 * The copy lives in STEPS below so it can be tuned in one place. No stats beyond the real command count.
 * Loads after js/p7-student.js.
 */
(function (TH) {
  'use strict';
  if (!TH || !TH.screens) return;
  const esc = s => TH.esc(s), icon = (n, c) => TH.icon(n, c);
  const $ = (s, r = document) => r.querySelector(s);

  const PHONE = 'phone', CLAUDE = 'claude';
  const STEPS = [
    { lane: PHONE, ic: 'chat', t: 'You type anything', d: 'Questions, plans, “book me a room”, in your own words.' },
    { lane: PHONE, ic: 'shield', t: 'Safety first, on your phone', d: 'Crisis and personal messages never leave the device. Tommy answers right away with real help.', sos: true },
    { lane: CLAUDE, ic: 'sparkle', t: 'Claude Haiku understands and plans', d: 'It picks from 180 verified campus tools: class schedule, hours, map, clubs and events, dining, transport, wallet and more.' },
    { lane: CLAUDE, ic: 'book', t: 'Public questions: USC sources only', d: 'Claude writes the answer only from USC data and USC pages, with sources, and an automatic fact check runs. No tool for it? Claude searches usc.edu only.' },
    { lane: PHONE, ic: 'lock', t: 'Your account stays on your phone', d: 'Grades, bookings, guest passes, orders: the tool runs on your phone. Claude only sees your words, never the results.', note: 'Claude sees your words only' },
    { lane: CLAUDE, ic: 'refresh', t: 'Tommy keeps learning', d: 'When Tommy can’t answer, Claude proposes a new tool, and the team approves it before anyone uses it.' },
  ];
  const SEES = ['Your words', 'Public USC information'];
  const STAYS = ['Your account: grades, bookings, passes, orders, Dining Dollars', 'Crisis and personal topics'];

  function step(s, i) {
    return `<li class="ht-step ${s.lane}${i && STEPS[i - 1].lane !== s.lane ? ' swap' : ''}" style="--i:${i}">
      <span class="ht-num" aria-hidden="true">${i + 1}</span>
      <div class="ht-card">
        <span class="ht-lane">${s.lane === PHONE ? `${icon('phone')} On your phone` : `${icon('sparkle')} Claude`}</span>
        <span class="ht-ic" aria-hidden="true">${icon(s.ic)}</span>
        <b>${esc(s.t)}</b>
        <p>${esc(s.d)}</p>
        ${s.sos ? `<span class="ht-sos"><a href="tel:911">911</a><a href="tel:2137404321">DPS 213-740-4321</a><a href="tel:988">988</a></span>` : ''}
        ${s.note ? `<span class="ht-note">${icon('eye')}${esc(s.note)}</span>` : ''}
      </div></li>`;
  }

  TH.screens.howtommy = {
    render() {
      return `<div class="screen ht-screen">${TH.ui.topbar('How Tommy works')}
        <div class="pad screen-body stack">
          <div class="ht-hero"><span class="ht-av" aria-hidden="true">T</span><div><span class="eyebrow">Ask Tommy</span><h2>Here’s what happens to your words.</h2></div></div>
          <div class="ht-lanes" aria-hidden="true"><span class="phone">${icon('phone')} Your phone</span><span class="line">Privacy line</span><span class="claude">${icon('sparkle')} Claude</span></div>
          <ol class="ht-flow" aria-label="How Tommy answers, step by step">${STEPS.map(step).join('')}</ol>
          <div class="ht-split" role="group" aria-label="The privacy line">
            <div class="ht-col phone"><h3>${icon('lock')} Stays on your phone</h3><ul>${STAYS.map(x => `<li>${icon('lock')}${esc(x)}</li>`).join('')}</ul></div>
            <div class="ht-col claude"><h3>${icon('eye')} Claude can see</h3><ul>${SEES.map(x => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul></div>
          </div>
          <button class="btn block" data-go="assistant">${icon('chat')} Ask Tommy</button>
          <p class="muted tiny" style="text-align:center;padding-bottom:70px">Account actions in this prototype are simulated on a demo student.</p>
        </div></div>`;
    },
  };

  // ---------- entry points ----------
  // 1) Ask Tommy's ⋯ menu
  const UI = window.TA && TA.UI;
  if (UI && UI.renderMenu && UI.menuAction) {
    const rm0 = UI.renderMenu, ma0 = UI.menuAction;
    UI.renderMenu = function () {
      const r = rm0.apply(this, arguments), m = document.getElementById('ta-menu');
      if (m && !m.querySelector('[data-menu="howtommy"]')) m.insertAdjacentHTML('afterbegin', '<button type="button" role="menuitem" data-menu="howtommy">How Tommy works</button>');
      return r;
    };
    UI.menuAction = function (k) { if (k === 'howtommy') { TH.go('howtommy'); return; } return ma0.apply(this, arguments); };
  }
  // 2) More → Help (row added to the student More render from js/p7-student.js)
  const more = TH.screens.more, mr0 = more && more.render;
  if (mr0) more.render = function () {
    const h = mr0.apply(this, arguments), row = `<button class="row" data-go="howtommy" style="--rc:var(--gold-ink)"><span class="rico">${icon('sparkle')}</span><span class="rmain"><span class="rtitle">How Tommy works</span><span class="rsub">What Claude sees, and what stays on your phone</span></span>${icon('chev', 'chev')}</button>`;
    const i = h.indexOf('data-p7help'); if (i < 0) return h;
    const s = h.lastIndexOf('<button', i);
    return h.slice(0, s) + row + h.slice(s);
  };
  // 3) the desktop side panel
  const boot0 = TH.boot;
  TH.boot = function () {
    const r = boot0.apply(this, arguments);
    const ul = $('.pitch ul');
    if (ul && !$('.pitch .ht-pitch')) {
      ul.insertAdjacentHTML('afterend', `<button class="ht-pitch" type="button">${icon('sparkle')}<span><b>How Tommy works</b><small>What Claude sees, what stays on your phone</small></span>${icon('chev')}</button>`);
      $('.pitch .ht-pitch').onclick = () => TH.go('howtommy');
    }
    return r;
  };
})(window.TH);
