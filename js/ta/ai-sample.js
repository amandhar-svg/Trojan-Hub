/* js/ta/ai-sample.js */
/* js/ta/ai-sample.js — the AI TRANSLATOR for Ask Tommy (claude.ai artifact runtime, window.claude.use('sample')).
 *
 * Ask Tommy runs on scripts (js/ta/script.js): every message is compiled into one script command and the command
 * runs on this device. The AI is only the fallback translator for messages the compiler cannot read:
 *     student text  ──►  AI  ──►  {"cmd": "...", "args": {...}}  ──►  script runs locally  ──►  result shown
 * The AI gets the command catalogue and the student's words. It has NO tools, never sees the student's account,
 * and never sees what a script returned (grades, balances, passes…). It cannot answer the student; anything that
 * is not a valid command is discarded. Crisis and safety messages never reach it.
 * Runs on the VIEWER's own claude.ai account; publish the page with capabilities: { sample: {} }.
 * Load after app.js, hub-actions.js and embed.js; before script.js and TA.boot(). */
(function () {
  'use strict';
  var TA = window.TA, AI = TA.AI, UI = TA.UI;
  var S = { fn: null, off: false, offWhy: '', ctl: null, checked: false };
  var ready = null;
  function init() { // resolve the capability once (lazily, so nothing runs at script load)
    if (ready) return ready;
    ready = (window.claude && typeof window.claude.use === 'function')
      ? Promise.resolve().then(function () { return window.claude.use('sample'); }).then(function (f) { S.fn = f || null; }).catch(function () { S.fn = null; })
      : Promise.resolve();
    return ready.then(function () { S.checked = true; if (UI && UI.renderMode) UI.renderMode(); });
  }
  AI.sampleReady = function () { return init(); };
  AI.sampleState = function () { return { available: !!S.fn, off: S.off, why: S.offWhy, checked: S.checked }; };
  // TA.settings.claude: undefined/true = translator on whenever it is available (default ON), false = off
  AI.enabled = function () { return TA.settings.claude !== false && !!S.fn && !S.off; };
  AI.reset = function () { };
  AI.stop = function () { if (S.ctl) S.ctl.abort(); };

  var RULES = [
    'You are a TRANSLATOR inside Trojan Hub, a USC student app. You convert ONE student message into ONE script command. You never answer the student, never explain, and never see any result: a script on the student’s phone runs your command and shows the result to them.',
    'Reply with a single line of JSON and nothing else: {"cmd":"<name>","args":{...}}',
    'Pick the command from COMMANDS. Use only argument names listed for it; omit arguments the student did not give. Never invent names, dates, amounts, course codes or places.',
    'If the student wants something DONE that is not a listed command, use {"cmd":"do","args":{"action":"<id from ACTIONS>","request":"<one plain imperative sentence with every detail the student gave>"}}.',
    'If it is a question about USC (policies, deadlines, offices, costs, places, hours), use {"cmd":"ask","args":{"q":"<the question rewritten as a short, clear, standalone question in plain words>"}}.',
    'If it has nothing to do with USC or student life, or you cannot tell what they want, use {"cmd":"none","args":{}}.',
    'Requests to plan, organize or fill a day, evening, weekend or week ("help me figure out my Thursday", "what\'s the move tonight", "map out my weekend") use plan.day or plan.week; requests for trips, outings, hikes, beach days or getting off campus use plan.outings. Questions about HOW to plan something at USC (semester schedules, club trip policies) are ask.',
    'EARLIER lists the student’s previous messages with the command each became (no results). Use it only to resolve words like "it", "that one" or "and physics?".'
  ].join('\n');

  // text -> {cmd, args} | null. `ctx` = { commands, actions, earlier: [{text, line}], now }
  AI.translate = async function (text, ctx) {
    await init();
    if (!AI.enabled()) return null;
    ctx = ctx || {};
    var prompt = RULES + '\n\nCOMMANDS\n' + (ctx.commands || '') + '\n\nACTIONS (id = what it does)\n' + (ctx.actions || '') +
      '\n\nNOW: ' + (ctx.now || '') +
      '\n\nEARLIER\n' + ((ctx.earlier || []).map(function (e) { return '- "' + String(e.text).slice(0, 200) + '" -> ' + e.line; }).join('\n') || '(nothing yet)') +
      '\n\nSTUDENT MESSAGE\n' + String(text).slice(0, 1000);
    S.ctl = new AbortController();
    try {
      var out = await S.fn([{ role: 'user', content: prompt }], { modelTier: 'quick', signal: S.ctl.signal });
      var raw = String((out && out.text) || ''), a = raw.indexOf('{'), b = raw.lastIndexOf('}');
      if (a < 0 || b <= a) return null;
      var obj = JSON.parse(raw.slice(a, b + 1));
      if (!obj || typeof obj.cmd !== 'string') return null;
      return { cmd: obj.cmd.trim(), args: obj.args && typeof obj.args === 'object' ? obj.args : {} };
    } catch (e) {
      var code = (e && e.code) || '';
      if (/^(not_granted|sampling_disabled|not_declared|capability_disabled|capability_removed|session_expired)$/.test(code)) { S.off = true; S.offWhy = code; if (UI.renderMode) UI.renderMode(); }
      return null;
    } finally { S.ctl = null; }
  };

  // ---- Settings sheet ----
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  UI.sheets.settings = function () {
    var ICONS = TA.ICONS, st = AI.sampleState(), on = TA.settings.claude !== false;
    var avail = !st.checked ? 'Checking whether the AI translator is available…' : st.off ? 'The AI translator was declined or isn’t available for this account, so I’m running on scripts alone.' : st.available ? 'The AI translator is available in this view.' : 'The AI translator isn’t available in this view (it works when this page is opened on claude.ai). Scripts handle everything they can read.';
    return '<div class="ta-sheet-h"><h2>Settings</h2><button type="button" class="ta-icon" data-close aria-label="Close">' + ICONS.close + '</button></div>' +
      '<section class="ta-set"><h3>' + ICONS.spark + ' How Tommy works</h3>' +
      '<p class="ta-fine"><strong>1. Your message becomes a script.</strong> “What are my grades in math?” compiles to <code>grades.show course="MATH 226"</code>. <strong>2. The script runs on this device</strong> with access to your account, and can act for you after you confirm.</p>' +
      '<label class="ta-check"><input type="checkbox" id="ta-claude-on"' + (on ? ' checked' : '') + '> Use AI when a script can’t read my message</label>' +
      '<p class="ta-fine">The AI only rewrites your words into a script command. It has no access to your account and <strong>never sees what the script returns</strong>. It runs on your own claude.ai account. Crisis and safety messages are always handled on this device.</p>' +
      '<label class="ta-check"><input type="checkbox" id="ta-show-script"' + (TA.settings.showScript !== false ? ' checked' : '') + '> Show the script under each answer</label>' +
      '<p class="ta-fine">' + esc(avail) + '</p>' +
      '<div class="ta-card-actions"><button type="button" class="ta-btn primary" data-save-claude>Save</button></div></section>' +
      '<section class="ta-set"><h3>Demo</h3><p class="ta-fine">The demo runs on <strong>' + esc(TA.fmtLongDate(TA.today())) + '</strong> so USC deadlines line up with the data collected that day. Account actions are simulated on the demo student.</p><div class="ta-card-actions"><button type="button" class="ta-btn" data-reset-demo>Reset demo account</button><button type="button" class="ta-btn" data-clear-chat>Clear conversation</button></div></section>';
  };
  var sheetClick0 = UI.onSheetClick;
  UI.onSheetClick = function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (b && b.hasAttribute('data-save-claude')) {
      var on = document.getElementById('ta-claude-on'), sh = document.getElementById('ta-show-script');
      TA.settings.claude = !!(on && on.checked); TA.settings.showScript = !!(sh && sh.checked);
      try { TA.saveSettings(); } catch (er) { /* storage may be blocked */ }
      UI.renderMode(); UI.closeSheet(); if (UI.renderAll) UI.renderAll();
      UI.push([{ role: 'bot', md: TA.settings.claude ? (AI.enabled() ? '**AI translator on.** It only turns messages I can’t read into script commands. It never sees your account or my answers.' : 'The AI translator is switched on, but it isn’t available in this view, so I’ll run on scripts alone.') : '**AI translator off.** I’ll run on scripts alone.' }]);
      return;
    }
    return sheetClick0.call(UI, e);
  };
})();
