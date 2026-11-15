/* js/ta/embed.js */
/* js/ta/embed.js — run Trojan Assist's chat ("Ask Tommy") full-screen inside Trojan Hub's assistant screen.
 * Load AFTER js/ta/app.js and hub-actions.js, BEFORE TA.boot(). No launcher, no floating panel, no host dashboard;
 * TA.Embed.mount()/unmount() can be called every time the screen renders. The conversation (UI.msgs,
 * localStorage "ta:convo"), Brain.pending and in-flight replies survive navigation: replies that land while
 * unmounted are stored and shown on the next mount. "@go:<screen>[:arg]" chips call TA.Embed.onGo.
 * Based on research/tacode/ref/embed.js; adds one-tap sign-in on the chat's sign-in card and a Stop button. */
(function () {
  'use strict';
  var TA = window.TA, UI = TA.UI, ICONS = TA.ICONS;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var STOP_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';
  var MARKUP =
    '<div id="ta-root" class="ta-root embed" data-state="open">' +
    '<section id="ta-panel" class="ta-panel" aria-label="Ask Tommy chat">' +
    '<div class="ta-head"><button type="button" class="ta-icon" data-ta-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<div class="ta-avatar" aria-hidden="true">T</div>' +
    '<div class="ta-title"><strong>Ask Tommy</strong><span class="ta-sub" id="ta-sub">USC sites only · Prototype</span></div>' +
    '<button type="button" class="ta-acct" id="ta-acct">Sign in</button>' +
    '<button type="button" class="ta-icon" id="ta-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="ta-menu" aria-label="More options">' + ICONS.more + '</button></div>' +
    '<div class="ta-menu" id="ta-menu" role="menu" hidden></div>' +
    '<div class="ta-status" id="ta-status" role="status" hidden></div>' +
    '<div class="ta-log" id="ta-log" aria-label="Conversation"></div>' +
    '<div class="sr-only" id="ta-live" aria-live="polite" aria-atomic="true"></div>' +
    '<form class="ta-compose" id="ta-form" autocomplete="off"><label class="sr-only" for="ta-input">Message Tommy</label>' +
    '<textarea id="ta-input" rows="1" maxlength="1000" placeholder="Ask Tommy, or tell him what to do…" enterkeyhint="send"></textarea>' +
    '<button type="button" class="ta-send ta-stop" id="ta-stop" aria-label="Stop" hidden>' + STOP_IC + '</button>' +
    '<button type="submit" class="ta-send" id="ta-send" aria-label="Send message" disabled>' + ICONS.send + '</button></form>' +
    '<div class="ta-foot">Answers from verified public USC sources (accurate, not modeled) · account actions simulated</div>' +
    '<div class="ta-sheet" id="ta-sheet" hidden role="dialog" aria-modal="true" aria-label="Ask Tommy panel"></div>' +
    '<div class="ta-toast" id="ta-toast" role="status" hidden></div>' +
    '</section></div>';

  var E = TA.Embed = { mounted: false, onBack: null, onGo: null, onUnread: null };
  var started = false;

  // ---- one-tap sign-in: the same path as the consent sheet's "Continue as …" (scopes as currently set) ----
  E.signIn = function () {
    if (TA.State.d.signedIn) return;
    TA.State.signIn();
    UI.closeSheet && E.mounted && UI.closeSheet();
    if (E.mounted) document.querySelectorAll('.ta-card.signin').forEach(function (el) { el.setAttribute('data-status', 'done'); el.querySelectorAll('button').forEach(function (x) { x.disabled = true; }); var st = el.querySelector('.ta-card-status'); if (st) st.textContent = 'Signed in'; });
    UI.msgs.forEach(function (m) { if (m.card && m.card.type === 'signin') m.card.status = 'done'; });
    UI.push([{ role: 'user', md: 'Signed in (demo)' }]);
    UI.setBusy(true);
    Promise.resolve(TA.Brain.resumeAfterSignIn()).then(function (out) { UI.setBusy(false); UI.applyStatus(out); UI.push(out); TA.Brain.persist(); }).catch(function (er) { console.error(er); UI.setBusy(false); });
  };
  var signin0 = UI.cards.signin;
  UI.cards.signin = function (c) {
    var done = TA.State.d.signedIn || c.status === 'done', p = TA.State.d.profile || {};
    if (done) return signin0.call(UI.cards, c);
    return '<div class="ta-card signin" data-card="' + esc(c.id) + '" data-status="pending"><div class="ta-card-head"><span class="ta-card-ic" aria-hidden="true">' + ICONS.lock + '</span><div><div class="ta-card-kicker">Delegated access</div><div class="ta-card-title">Sign in with USC</div></div><span class="ta-card-status"></span></div>' +
      '<p class="ta-fine">You choose what I’m allowed to do, every action needs your <strong>Confirm</strong>, and everything is logged with Undo. <strong>Demo:</strong> this signs in the sample student ' + esc((p.first || '') + ' ' + (p.last || '')) + ' and never asks for a password.</p>' +
      '<div class="ta-card-actions"><button type="button" class="ta-btn primary" data-ta-signin1>' + ICONS.lock + 'Continue as ' + esc(p.first || 'demo student') + ' (demo)</button><button type="button" class="ta-btn" data-signin>Review permissions</button></div></div>';
  };

  // ---- replaces UI.init (document-level work happens once, element listeners on every mount) ----
  function once() {
    if (started) return; started = true;
    UI.msgs = TA.store.get('convo', []) || []; if (!Array.isArray(UI.msgs)) UI.msgs = [];
    UI.unread = UI.unread || 0;
    document.addEventListener('click', function (e) { var m = $('ta-menu'); if (m && !m.hidden && !m.contains(e.target) && e.target.id !== 'ta-menu-btn') UI.toggleMenu(false); });
    TA.State.on(function () { if (E.mounted) UI.renderAcct(); setTimeout(E.syncUndo, 0); });
    // launcher-era methods: no launcher, no badge element, no page scroll lock
    UI.open = function () { UI.opened = true; UI.unread = 0; UI.badge(); };
    UI.close = function () { if (E.onBack) E.onBack(); else if (window.TH && TH.back) TH.back(); };
    UI.badge = function () { if (E.onUnread) E.onUnread(UI.unread); };
    // methods that touch #ta-* elements must survive replies arriving while unmounted
    var push0 = UI.push, setBusy0 = UI.setBusy, stream0 = UI.streamDelta, mode0 = UI.renderMode, acct0 = UI.renderAcct, toast0 = UI.toast, sheet0 = UI.sheet, menu0 = UI.toggleMenu, close0 = UI.closeSheet, typing0 = UI.typing, status0 = UI.setCardStatus;
    UI.push = function (list, opt) {
      if (E.mounted && $('ta-log')) { document.querySelectorAll('#ta-log .ta-msg.typing').forEach(function (x) { x.remove(); }); var r0 = push0.call(UI, list, opt); E.syncUndo(); return r0; }
      UI.streamEl = null;
      (list || []).forEach(function (m) { if (!m) return; m.ts = m.ts || Date.now(); m.id = m.id || TA.uid(); UI.msgs.push(m); if (m.role === 'bot') UI.unread++; });
      if (UI.msgs.length > 120) UI.msgs = UI.msgs.slice(-120);
      TA.store.set('convo', UI.msgs.slice(-80)); UI.badge();
    };
    UI.setBusy = function (b) {
      UI.busy = b;
      if (E.mounted && $('ta-send')) { setBusy0.call(UI, b); var st = $('ta-stop'); if (st) { st.hidden = !(b && TA.AI && TA.AI.enabled && TA.AI.enabled() && TA.AI.stop); $('ta-send').hidden = !st.hidden; } }
    };
    UI.typing = function (on, el) { if (E.mounted && $('ta-log')) return typing0.call(UI, on, el); return null; };
    UI.setCardStatus = function (id, st) { if (E.mounted && $('ta-log')) return status0.call(UI, id, st); UI.msgs.forEach(function (m) { if (m.card && m.card.id === id) m.card.status = st; }); TA.store.set('convo', UI.msgs.slice(-80)); };
    UI.streamDelta = function (t) { if (E.mounted && $('ta-log')) return stream0.call(UI, t); };
    UI.renderMode = function () { if (E.mounted && $('ta-root')) mode0.call(UI); };
    UI.renderAcct = function () { if (E.mounted && $('ta-acct')) acct0.call(UI); };
    UI.toast = function (m) { if (E.mounted && $('ta-toast')) toast0.call(UI, m); else if (window.TH && TH.toast) TH.toast(m); };
    UI.sheet = function (k) { if (E.mounted && $('ta-sheet')) sheet0.call(UI, k); };
    UI.closeSheet = function () { if (E.mounted && $('ta-sheet')) close0.call(UI); };
    UI.toggleMenu = function (f) { if (E.mounted && $('ta-menu')) menu0.call(UI, f); };
    UI.scroll = function () { var log = $('ta-log'); if (log) requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; }); };
  }

  function bind(root) {
    $('ta-menu-btn').addEventListener('click', function (e) { e.stopPropagation(); UI.toggleMenu(); });
    $('ta-acct').addEventListener('click', function () { if (TA.State.d.signedIn) UI.sheet('account'); else UI.sheet('consent'); });
    $('ta-menu').addEventListener('click', function (e) { var b = e.target.closest('[data-menu]'); if (!b) return; UI.toggleMenu(false); UI.menuAction(b.getAttribute('data-menu')); });
    $('ta-menu').addEventListener('keydown', UI.menuKeys);
    root.querySelector('[data-ta-back]').addEventListener('click', function () { UI.close(); });
    var input = $('ta-input');
    $('ta-form').addEventListener('submit', function (e) { e.preventDefault(); UI.submit(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); UI.submit(); } });
    input.addEventListener('input', UI.autosize);
    $('ta-stop').addEventListener('click', function () { if (TA.AI && TA.AI.stop) TA.AI.stop(); });
    $('ta-panel').addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // keep Trojan Hub's document Escape handler from also firing
      if (!$('ta-sheet').hidden) UI.closeSheet(); else if (!$('ta-menu').hidden) UI.toggleMenu(false);
    });
    // "@go:<screen>[:arg]" chips navigate Trojan Hub instead of being sent to the brain; one-tap sign-in
    $('ta-log').addEventListener('click', function (e) {
      if (e.target.closest('[data-ta-signin1]')) { e.stopImmediatePropagation(); e.preventDefault(); if (!UI.busy) E.signIn(); return; }
      var b = e.target.closest('[data-send]'); if (!b) return;
      var v = b.getAttribute('data-send'); if (v === '@noop') { e.stopImmediatePropagation(); e.preventDefault(); return; }
      if (v.indexOf('@go:') !== 0) return;
      e.stopImmediatePropagation(); e.preventDefault();
      var g = v.slice(4).split(':'); E.go(g[0], g.slice(1).join(':') || undefined);
    }, true);
    $('ta-log').addEventListener('click', UI.onLogClick);
    $('ta-sheet').addEventListener('click', UI.onSheetClick);
  }
  E.go = function (screen, arg) {
    if (E.onGo) return E.onGo(screen, arg);
    if (window.TH && TH.go) TH.go(TH.screens && TH.screens[screen] ? screen : 'home', arg ? { arg: arg } : null);
  };

  // ---- Undo buttons: only the receipt of the change that can still be undone keeps a live "Undo" ----
  // (B.undo only reverses the latest logged change; a newer action, a native Trojan Hub change, an undo
  // or a reload all invalidate older receipts' buttons)
  var B = TA.Brain;
  function undoLive() { var u = B.lastUndo, L = (TA.State.d && TA.State.d.log) || []; return u && L.length && L[0].id === u.logId ? u.logId : null; }
  var exec0 = B.execute;
  B.execute = function () {
    var out = exec0.apply(this, arguments), tag = function (list) { (list || []).forEach(function (m) { if (m && m.chips && m.chips.some(function (c) { return c.value === 'undo'; })) m.undoLog = B.lastUndo ? B.lastUndo.logId : null; }); return list; };
    return out && typeof out.then === 'function' ? out.then(tag) : tag(out);
  };
  var undo0 = B.undo;
  B.undo = function () { var id = B.lastUndo && B.lastUndo.logId, out = undo0.apply(this, arguments); if (id && !B.lastUndo) (UI.msgs || []).forEach(function (m) { if (m.undoLog === id) m.undoDone = true; }); return out; };
  E.syncUndo = function () {
    if (!UI.msgs) return;
    var live = undoLive(), liveIx = -1, changed = false;
    if (live) UI.msgs.forEach(function (m, i) { if (m.undoLog === live) liveIx = i; });
    UI.msgs.forEach(function (m, i) {
      if (!m.chips || !m.chips.some(function (c) { return c.value === 'undo'; })) return;
      if (live && liveIx >= 0 && i >= liveIx) return;
      m.chips = m.chips.filter(function (c) { return c.value !== 'undo'; }); changed = true;
      if (m.undoDone) m.chips.unshift({ label: '✓ Undone', value: '@noop', kind: 'ghost done' });
      var el = E.mounted && document.querySelector('#ta-log [data-id="' + m.id + '"]');
      if (el) el.querySelectorAll('[data-send="undo"]').forEach(function (b) { if (m.undoDone) { b.disabled = true; b.textContent = '✓ Undone'; b.setAttribute('data-send', '@noop'); } else b.remove(); });
    });
    if (changed) TA.store.set('convo', UI.msgs.slice(-80));
    if (E.mounted) document.querySelectorAll('#ta-log [data-send="@noop"]').forEach(function (b) { b.disabled = true; });
  };

  // boot() (main.js) calls these; in Trojan Hub the panel mounts later, and there is no #dash
  UI.init = function () { once(); };
  TA.Host.init = function () { };

  function kbStatus() {
    var st = $('ta-status'); if (!st || !TA.Search) return;
    if (TA.Search.ready) { st.hidden = true; return; }
    if (TA.Search.failed) { st.hidden = false; st.textContent = TA.Search.failed; return; }
    st.hidden = false; st.textContent = 'Loading the USC knowledge base… (questions you ask now are answered as soon as it’s ready)';
    TA.Search.whenReady().then(kbStatus, kbStatus);
  }

  // One student, one store: Trojan Hub already acts as the demo student everywhere, so Tommy starts signed in
  // (no separate login). Per-action Confirm cards stay. Signing out from Tommy's account sheet is respected.
  E.autoSignIn = function () {
    var d = TA.State.d; if (d.signedIn || TA.store.get('hubSignedOut', false)) return;
    d.signedIn = true; TA.State.save();
  };
  if (!E._soWrapped) {
    E._soWrapped = true;
    var so0 = TA.State.signOut, si0 = TA.State.signIn;
    TA.State.signOut = function () { TA.store.set('hubSignedOut', true); return so0.apply(this, arguments); };
    TA.State.signIn = function () { TA.store.set('hubSignedOut', false); return si0.apply(this, arguments); };
  }
  E.mount = function (container, opts) {
    opts = opts || {};
    once();
    E.autoSignIn();
    container.innerHTML = MARKUP;
    E.mounted = true;
    bind(container);
    E.syncUndo(); UI.renderAll(); E.syncUndo(); UI.renderAcct(); UI.renderMode();
    UI.opened = true; UI.unread = 0; UI.badge();
    if (!UI.msgs.length) UI.welcome();
    kbStatus();
    if (UI.busy) { UI.typing(true); UI.setBusy(true); } // a reply is still on its way
    // land on the latest message instantly (no smooth scroll through history, no re-played entrance animations)
    var root = $('ta-root'), log = $('ta-log'); root.classList.add('ta-mounting'); log.style.scrollBehavior = 'auto'; log.scrollTop = log.scrollHeight;
    requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; setTimeout(function () { log.style.scrollBehavior = ''; root.classList.remove('ta-mounting'); }, 60); });
    $('ta-send').disabled = true;
    if (opts.ask && !UI.busy) UI.send(String(opts.ask));
    else if (opts.focus !== false && window.innerWidth > 640) setTimeout(function () { var i = $('ta-input'); if (i) i.focus({ preventScroll: true }); }, 30);
  };
  E.unmount = function () { if (!E.mounted) return; E.mounted = false; UI.opened = false; UI.streamEl = null; };
  E.ask = function (text) { return UI.send(text); };
})();

