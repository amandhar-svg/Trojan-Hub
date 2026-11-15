/* js/ta/embed.js — run Trojan Assist's chat full-screen inside a Trojan Hub screen.
 * Load AFTER js/ta/app.js (and hub-actions.js), BEFORE boot. No launcher, no floating panel,
 * no host dashboard; mount()/unmount() can be called every time the Ask Tommy screen renders.
 * The conversation (UI.msgs, localStorage "ta:convo"), Brain.pending and in-flight replies
 * survive navigation: replies that land while unmounted are stored and shown on the next mount. */
(function () {
  'use strict';
  var TA = window.TA, UI = TA.UI, ICONS = TA.ICONS;
  var $ = function (id) { return document.getElementById(id); };
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
    '<textarea id="ta-input" rows="1" maxlength="1000" placeholder="Ask about USC, or tell me what to do…" enterkeyhint="send"></textarea>' +
    '<button type="submit" class="ta-send" id="ta-send" aria-label="Send message" disabled>' + ICONS.send + '</button></form>' +
    '<div class="ta-foot">Answers only from USC websites · account actions are simulated</div>' +
    '<div class="ta-sheet" id="ta-sheet" hidden role="dialog" aria-modal="true" aria-label="Ask Tommy panel"></div>' +
    '<div class="ta-toast" id="ta-toast" role="status" hidden></div>' +
    '</section></div>';

  var E = TA.Embed = { mounted: false, onBack: null, onGo: null, onUnread: null };
  var started = false;

  // ---- replaces UI.init (document-level work happens once, element listeners on every mount) ----
  function once() {
    if (started) return; started = true;
    UI.msgs = TA.store.get('convo', []) || []; if (!Array.isArray(UI.msgs)) UI.msgs = [];
    document.addEventListener('click', function (e) { var m = $('ta-menu'); if (m && !m.hidden && !m.contains(e.target)) UI.toggleMenu(false); });
    TA.State.on(function () { if (E.mounted) UI.renderAcct(); });
    // launcher-era methods: no launcher, no badge element, no page scroll lock
    UI.open = function () { UI.opened = true; UI.unread = 0; UI.badge(); };
    UI.close = function () { if (E.onBack) E.onBack(); };
    UI.badge = function () { if (E.onUnread) E.onUnread(UI.unread); };
    // methods that touch #ta-* elements must survive replies arriving while unmounted
    var push0 = UI.push, setBusy0 = UI.setBusy, stream0 = UI.streamDelta, mode0 = UI.renderMode, acct0 = UI.renderAcct, toast0 = UI.toast, sheet0 = UI.sheet, menu0 = UI.toggleMenu;
    UI.push = function (list, opt) {
      if (E.mounted) { document.querySelectorAll('#ta-log .ta-msg.typing').forEach(function (x) { x.remove(); }); return push0.call(UI, list, opt); }
      UI.streamEl = null;
      (list || []).forEach(function (m) { if (!m) return; m.ts = m.ts || Date.now(); m.id = m.id || TA.uid(); UI.msgs.push(m); if (m.role === 'bot') UI.unread++; });
      if (UI.msgs.length > 120) UI.msgs = UI.msgs.slice(-120);
      TA.store.set('convo', UI.msgs.slice(-80)); UI.badge();
    };
    UI.setBusy = function (b) { if (E.mounted) return setBusy0.call(UI, b); UI.busy = b; };
    UI.streamDelta = function (t) { if (E.mounted) return stream0.call(UI, t); };
    UI.renderMode = function () { if (E.mounted) mode0.call(UI); };
    UI.renderAcct = function () { if (E.mounted) acct0.call(UI); };
    UI.toast = function (m) { if (E.mounted) toast0.call(UI, m); else if (window.TH && TH.toast) TH.toast(m); };
    UI.sheet = function (k) { if (E.mounted) sheet0.call(UI, k); };
    UI.toggleMenu = function (f) { if (E.mounted) menu0.call(UI, f); };
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
    $('ta-panel').addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // keep Trojan Hub's document Escape handler from also firing
      if (!$('ta-sheet').hidden) UI.closeSheet(); else if (!$('ta-menu').hidden) UI.toggleMenu(false);
    });
    // "@go:<screen>[:arg]" chips navigate Trojan Hub instead of being sent to the brain
    $('ta-log').addEventListener('click', function (e) {
      var b = e.target.closest('[data-send]'); if (!b) return;
      var v = b.getAttribute('data-send'); if (v.indexOf('@go:') !== 0) return;
      e.stopImmediatePropagation(); e.preventDefault();
      var g = v.slice(4).split(':'); if (E.onGo) E.onGo(g[0], g[1]);
    }, true);
    $('ta-log').addEventListener('click', UI.onLogClick);
    $('ta-sheet').addEventListener('click', UI.onSheetClick);
  }

  // boot() (main.js) calls these; in Trojan Hub the panel mounts later, and there is no #dash
  UI.init = function () { once(); };
  TA.Host.init = function () { };

  E.mount = function (container, opts) {
    opts = opts || {};
    once();
    container.innerHTML = MARKUP;
    E.mounted = true;
    bind(container);
    UI.renderAll(); UI.renderAcct(); UI.renderMode();
    UI.opened = true; UI.unread = 0; UI.badge();
    if (!UI.msgs.length) UI.welcome();
    if (TA.Search && !TA.Search.ready && !TA.Search.failed) { var st = $('ta-status'); st.hidden = false; st.textContent = 'Loading USC knowledge base…'; TA.Search.whenReady().then(function () { var s2 = $('ta-status'); if (s2) s2.hidden = !TA.Search.failed; if (s2 && TA.Search.failed) s2.textContent = TA.Search.failed; }); }
    if (UI.busy) UI.typing(true); // a reply is still on its way
    UI.scroll(true);
    $('ta-send').disabled = true;
    if (opts.ask) UI.send(opts.ask);
    else if (opts.focus !== false && window.innerWidth > 640) setTimeout(function () { var i = $('ta-input'); if (i) i.focus({ preventScroll: true }); }, 30);
  };
  E.unmount = function () { E.mounted = false; UI.opened = false; UI.streamEl = null; };
  E.ask = function (text) { return UI.send(text); };
})();
