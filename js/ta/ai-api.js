/* js/ta/ai-api.js */
/* js/ta/ai-api.js — Ask Tommy's AI translator through THIS SITE's own server (Netlify Function at /api/tommy).
 *
 * Used only when the page is NOT inside claude.ai (there, ai-sample.js runs the translator on the viewer's own
 * claude.ai account) and the site answers GET /api/tommy with {"ok": true}. Opened as a file (file://) it stays off
 * and Tommy runs on scripts alone, exactly as before.
 *
 * Same contract as ai-sample.js: the browser sends ONLY the student's words (plus the last few message → command
 * pairs, never results); the server owns the instructions, calls Claude with the API key it keeps secret, and
 * returns ONE Tommy command {cmd, args}. The key never reaches the browser. Crisis, safety and personal messages are
 * filtered in script.js before AI.translate is ever called, so they never leave the device.
 * Load right after ai-sample.js (it wraps AI.translate / AI.enabled / AI.sampleState and the Settings sheet). */
(function () {
  'use strict';
  var TA = window.TA, AI = TA && TA.AI, UI = TA && TA.UI;
  if (!AI || typeof AI.translate !== 'function') return;
  var ENDPOINT = (typeof window.TOMMY_API_URL === 'string' && window.TOMMY_API_URL) || '/api/tommy';
  var base = { translate: AI.translate, enabled: AI.enabled, sampleState: AI.sampleState, sampleReady: AI.sampleReady, stop: AI.stop };
  var A = { checked: false, ok: false, off: false, ctl: null, probe: null };

  function inClaude() { return !!(window.claude && typeof window.claude.use === 'function'); }
  function canTry() { return !inClaude() && (/^https?:$/.test(location.protocol) || !!window.TOMMY_API_URL); }
  function apiMode() { return A.ok && !A.off && !inClaude(); }
  function mode() { try { if (UI && UI.renderMode) UI.renderMode(); } catch (e) { /* UI not mounted yet */ } }

  // One GET per page load: is this site's translator configured?
  function check() {
    if (A.probe) return A.probe;
    if (!canTry() || typeof fetch !== 'function') { A.checked = true; A.probe = Promise.resolve(false); return A.probe; }
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    A.probe = fetch(ENDPOINT, { method: 'GET', headers: { accept: 'application/json' }, cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { A.ok = !!(j && j.ok === true); })
      .catch(function () { A.ok = false; })
      .then(function () { clearTimeout(t); A.checked = true; mode(); return A.ok; });
    return A.probe;
  }

  AI.sampleReady = function () { return Promise.all([base.sampleReady ? base.sampleReady() : null, check()]); };
  AI.enabled = function () { return apiMode() ? TA.settings.claude !== false : base.enabled(); };
  AI.sampleState = function () {
    if (canTry() && (apiMode() || !A.checked)) return { available: apiMode(), off: A.off, why: '', checked: A.checked, via: 'api' };
    return base.sampleState();
  };
  AI.stop = function () { if (A.ctl) A.ctl.abort(); if (base.stop) base.stop(); };
  // On this site's own translator, Tommy asks the AI first for wording that isn't an exact command (script.js TS.handle).
  AI.firstPass = function () { return apiMode() && TA.settings.claude !== false; };

  // Earlier messages go along only to resolve "it"/"that one". Leave out any that were crisis, emergency or
  // personal (the same check script.js uses before calling the AI), so they never leave the device later either.
  function privateText(t) {
    try {
      var s = String(t || ''), n = TA.NLU.parse(s), P = TA.Script && TA.Script.PERSONAL;
      return !!(n.crisis || n.emergency || (TA.Brain && TA.Brain.sensitive && TA.Brain.sensitive(n)) || (P && P.test(s.toLowerCase())));
    } catch (e) { return true; }
  }
  function safeEarlier(list) {
    return (list || []).filter(function (e) { return e && !privateText(e.text) && !privateText(e.line); });
  }

  // text -> {cmd, args} | null (null = let the scripts' own best answer stand)
  AI.translate = async function (text, ctx) {
    await check();
    ctx = Object.assign({}, ctx || {}, { earlier: safeEarlier(ctx && ctx.earlier) });
    if (!apiMode()) return base.translate(text, ctx);
    if (TA.settings.claude === false) return null;
    var body = {
      text: String(text == null ? '' : text).slice(0, 1000),
      now: String(ctx.now || '').slice(0, 80),
      earlier: (ctx.earlier || []).slice(-6).map(function (e) { return { text: String((e && e.text) || '').slice(0, 200), line: String((e && e.line) || '').slice(0, 200) }; })
    };
    A.ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (A.ctl) A.ctl.abort(); }, 25000);
    try {
      var r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: A.ctl ? A.ctl.signal : undefined });
      if (r.status === 503) { A.off = true; mode(); return null; } // the site has no API key set
      if (!r.ok) return null;
      var j = await r.json();
      if (!j || typeof j.cmd !== 'string' || !j.cmd.trim()) return null;
      return { cmd: j.cmd.trim(), args: j.args && typeof j.args === 'object' && !Array.isArray(j.args) ? j.args : {} };
    } catch (e) {
      return null; // offline, timeout or stopped: Tommy keeps the scripts' answer
    } finally { clearTimeout(t); A.ctl = null; }
  };

  // Settings sheet: say where the AI runs when it is this site's server
  if (UI && UI.sheets && typeof UI.sheets.settings === 'function') {
    var sheet0 = UI.sheets.settings;
    UI.sheets.settings = function () {
      var h = sheet0.apply(this, arguments);
      if (!canTry()) return h;
      if (apiMode()) {
        return h.replace('Use AI when a script can’t read my message', 'Use AI to read messages that aren’t exact commands')
          .replace('It runs on your own claude.ai account.', 'It runs on Claude through this site’s server, which keeps the API key; your account data never leaves this device.');
      }
      if (A.checked) {
        return h.replace('It runs on your own claude.ai account.', 'On this website it runs on Claude through the site’s server, once the site has an API key.')
          .replace(/(The AI translator isn’t available in this view[^<]*)/, 'The AI translator isn’t set up on this site yet (its server has no API key), so scripts handle everything they can read.');
      }
      return h;
    };
  }

  // Resolve once in the background after load, so the header shows "Claude" when it's on
  if (canTry()) setTimeout(function () { check(); }, 1200);
})();
