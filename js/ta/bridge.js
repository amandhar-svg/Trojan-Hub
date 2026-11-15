/* js/ta/bridge.js */
/* js/ta/bridge.js — glue between Trojan Assist (TA) and Trojan Hub (TH). Load last (after ai-sample.js),
 * before the inline `TA.boot({kbLater:true}); TH.boot();`. Nothing here touches the DOM or TA.State at load.
 *  - one clock: TA.now() follows TH.clock (demo-time override), date pinned to Mon Nov 9, 2026 unless TA.settings.realDate
 *  - one subscription: TA.State.on -> re-render the Hub screen that shows account state (not while a sheet is open
 *    or an input is focused), so Tommy's actions, Undo and native TH.commit() all show up in Home/My Day/Wallet…
 *  - TH.loadTommyKB(): lazy-loads js/ta/blob-kb.js once and starts TA's search worker
 *  - TH.askTommy(text): open Ask Tommy and ask */
(function () {
  'use strict';
  var TA = window.TA, TH = window.TH || (window.TH = {});

  // ---------------------------------------------------------------- one clock
  var now0 = TA.now;
  TA.now = function () {
    if (!(TH.clock && typeof TH.clock.now === 'function')) return now0();
    var c = TH.clock.now();
    if ((TA.settings && TA.settings.realDate) || TH.clock.realDate) return c;
    return new Date(TA.DEMO_DAY.y, TA.DEMO_DAY.m, TA.DEMO_DAY.d, c.getHours(), c.getMinutes(), c.getSeconds());
  };

  // ---------------------------------------------------------------- re-render Hub screens on account changes
  var LIVE = { home: 1, plans: 1, wallet: 1, clubs: 1, food: 1, pass: 1, queue: 1, rides: 1, upass: 1, events: 1, alerts: 1 };
  var queued = false, deferred = false;
  function busyUI() {
    if (document.querySelector('.sheet-wrap')) return true;                                   // a Trojan Hub sheet is open
    var a = document.activeElement;
    return !!(a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('.ta-root'));
  }
  function rerender() {
    queued = false;
    var r = TH.state && TH.state.route;
    if (!r || !LIVE[r] || typeof TH.render !== 'function') return;
    if (busyUI()) { if (!deferred) { deferred = true; setTimeout(function () { deferred = false; rerender(); }, 1500); } return; }
    try { TH.render(true); } catch (e) { console.error(e); }
  }
  TH.onTAStateChange = function () { if (queued) return; queued = true; (window.queueMicrotask || setTimeout)(rerender); };

  // ---------------------------------------------------------------- knowledge base (9 MB) — load once, after first paint
  var kbLoading = null;
  TH.loadTommyKB = function (src) {
    if (kbLoading) return kbLoading;
    kbLoading = new Promise(function (resolve) {
      if (TA.Search && (TA.Search.ready || TA.Search.worker || TA.Search.started)) return resolve();
      var start = function () { try { if (window.TA_BLOBS && TA_BLOBS['ta-kb']) { TA.Search.init(TA_BLOBS['ta-kb']); delete TA_BLOBS['ta-kb']; } else if (!TA.Search.ready) TA.Search.failed = 'Knowledge base missing'; } catch (e) { console.error(e); TA.Search.failed = 'Knowledge base failed to load'; } resolve(); };
      if (window.TA_BLOBS && TA_BLOBS['ta-kb']) return start();
      var s = document.createElement('script'); s.src = src || 'js/ta/blob-kb.js'; s.async = true;
      s.onload = start; s.onerror = function () { TA.Search.failed = 'Couldn’t load the USC knowledge base'; try { TA.emit('kb-failed', TA.Search.failed); } catch (e) { } resolve(); };
      document.head.appendChild(s);
    });
    return kbLoading;
  };

  TH.askTommy = function (text) { if (TH.go) TH.go('assistant', text ? { arg: String(text) } : null); };

  // ---------------------------------------------------------------- after TA.boot()
  var boot0 = TA.boot;
  TA.boot = function (opts) {
    var r = boot0.apply(this, arguments);
    TA.State.on(TH.onTAStateChange);                      // the ONE subscription (TA.State has no off())
    if (TA.AI && TA.AI.sampleReady) TA.AI.sampleReady();  // resolve claude.use('sample') once, in the background
    return r;
  };
})();

