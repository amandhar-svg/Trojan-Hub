/* js/ta/ai-sample.js — Claude mode through the claude.ai artifact runtime (window.claude.use('sample')).
 * Replaces the bring-your-own-key path in ai.js (no API key, no bundled SDK). Same grounding rules and the
 * same four tools (search_usc, get_my_account, search_classes, start_action) plus Trojan Hub tools.
 * The local brain still owns: crisis/emergency/sensitive messages, pending confirmations and slot answers,
 * undo/sign-in/sign-out, chip payloads (@slot:, @act:, @ev:), and every turn when sample is unavailable.
 * Publish the page with capabilities: { sample: {} }. Load after app.js (+ hub-actions.js, embed.js). */
(function () {
  'use strict';
  var TA = window.TA, AI = TA.AI, B = TA.Brain;
  var S = { fn: null, tools: false, maxTools: 0, off: false, turns: [], ctl: null, noted: false };
  var ready = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('sample').then(function (f) {
        S.fn = f || null;
        return f && f.limits ? f.limits().then(function (l) { S.tools = !!(l && l.tools); S.maxTools = l && l.tools ? l.tools.maxCount : 0; }).catch(function () { S.tools = false; }) : null;
      }).catch(function () { S.fn = null; })
    : Promise.resolve();
  AI.sampleReady = ready;

  var RULES = [
    'You are Tommy, the assistant inside Trojan Hub, a USC student app. You run on the Trojan Assist engine.',
    'GROUNDING: For USC facts (policies, deadlines, costs, offices) use ONLY the <usc_sources> passages and tool results. Never use outside knowledge. If they do not answer it, say you could not find it on USC’s websites and point to the most relevant office or askUSC (ask.usc.edu). Cite passages as [1], [2][3] right after the sentence they support; only cite numbers that exist.',
    'For campus places, hours, waits, rides, shuttles, events and safety routes, call the Trojan Hub tools and state only what they return.',
    'ACCOUNT: use get_my_account for the student’s own classes, balances, meal plan, appointments, clubs and calendar. Never invent account data.',
    'ACTIONS: when the student wants something done, call start_action ONCE with an id from the ACTIONS list and a complete one-sentence request containing every detail they gave. start_action never completes anything: it shows a confirmation card or a follow-up question. Then tell them briefly to review and confirm (or answer the question). Never say an action is done unless a tool result says it was completed.',
    'After answering, you may call add_button to offer the most useful Trojan Hub screen.',
    'STYLE: lead with the answer; under 120 words; short paragraphs or "- " bullets; **bold** key figures; no headings.',
    'SAFETY: if the student mentions self-harm, crisis or an emergency, give: USC Counseling & Mental Health 24/7 213-740-9355; 988 (call or text); Crisis Text Line (text TROJAN to 741741); emergencies 911 or USC DPS 213-740-4321.'
  ].join('\n');
  function catalog() {
    var a = TA.Actions.list.map(function (x) { return x.id + ' = ' + x.title; });
    var p = (TA.Process && TA.Process.list || []).map(function (it) { return 'proc:' + it.pa.id + ' = ' + it.pa.name; });
    return 'ACTIONS:\n' + a.concat(p).join('\n');
  }

  // ---- tools: TA's four (schemas trimmed to the 1 KB description / 4 KB schema limits) + Trojan Hub's ----
  function tools(side, sources, turn) {
    var run = function (name) { return function (input) { return AI.runTool(name, input || {}, side, sources); }; };
    var list = [
      { name: 'search_usc', description: 'Search official USC web pages and askUSC articles. Returns numbered passages to cite.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, execute: run('search_usc') },
      { name: 'get_my_account', description: 'Read the signed-in student’s (simulated) account. Returns JSON, or not_signed_in (a sign-in card is then shown).', inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['profile', 'schedule', 'dining', 'billing', 'housing', 'appointments', 'parking', 'library', 'dclearance', 'activity', 'holds', 'clubs', 'calendar'] } }, required: ['section'] },
        execute: function (i) { if (i.section === 'clubs' || i.section === 'calendar') { if (!TA.State.d.signedIn) return run('get_my_account')({ section: 'profile' }); var h = TA.hub ? TA.hub() : {}; return JSON.stringify(i.section === 'clubs' ? { requested: TA.State.d.life.orgs, joined: h.clubs } : h.calendar); } return run('get_my_account')(i); } },
      { name: 'search_classes', description: 'Look up courses and sections in the real USC Schedule of Classes (Fall 2026, Spring 2027). Also shows the student a course card.', inputSchema: { type: 'object', properties: { term: { type: 'string', enum: ['Spring 2027', 'Fall 2026'] }, query: { type: 'string' } }, required: ['term', 'query'] }, execute: run('search_classes') },
      { name: 'start_action', description: 'Begin an action for the student (ids are in the ACTIONS list in the instructions). Shows a confirmation card or a follow-up question; nothing runs until the student confirms. Returns the card status.', inputSchema: { type: 'object', properties: { action: { type: 'string', description: 'An id from ACTIONS' }, request: { type: 'string', description: 'One complete sentence with every detail' } }, required: ['action', 'request'] },
        execute: function (i) {
          if (!TA.Actions.get(String(i.action))) throw new Error('Unknown action id "' + i.action + '". Use an id from the ACTIONS list.');
          if (turn.started) throw new Error('Only one action per message. Tell the student you will do the next one after they confirm this one.');
          turn.started = true; return run('start_action')({ action: String(i.action), request: String(i.request || '') });
        } }
    ];
    // Trojan Hub's page tools (assistant.js T.*) — small plain-data results
    var T = (window.TH && TH.assistantTools) || {};
    if (T.find_places) list.push({ name: 'find_places', description: 'Campus places near the student with open status, walk minutes and live waits. Optional query, category, open_now.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, open_now: { type: 'boolean' } } }, execute: function (i) { return T.find_places(i); } });
    if (T.get_transport) list.push({ name: 'get_transport', description: 'Free Lyft status and rides left, next shuttles, Metro E Line, U-Pass status, Zipcars, parking.', execute: function () { return T.get_transport(); } });
    if (T.get_events) list.push({ name: 'get_events', description: 'Campus events for a day (day_offset 0-6), optional category.', inputSchema: { type: 'object', properties: { day_offset: { type: 'integer' }, category: { type: 'string' } } }, execute: function (i) { return T.get_events(i); } });
    if (T.get_safety) list.push({ name: 'get_safety', description: 'Safest vs fastest walking route to a destination ("home" or a place id) at an hour, risky streets, DPS alerts, whether free Lyft runs.', inputSchema: { type: 'object', properties: { destination: { type: 'string' }, hour: { type: 'number' } } }, execute: function (i) { return T.get_safety(i); } });
    if (T.get_my_day) list.push({ name: 'get_my_day', description: 'The student’s timeline for today: classes, reservations, lines, orders, saved events, rides.', execute: function () { return T.get_my_day(); } });
    list.push({ name: 'add_button', description: 'Show a button under your answer that opens a Trojan Hub screen (home, map, plans, rides, upass, food, pass, queue, safety, events, wallet) or a place (screen "place" + place_id). Returns "ok".', inputSchema: { type: 'object', properties: { label: { type: 'string' }, screen: { type: 'string' }, place_id: { type: 'string' } }, required: ['label', 'screen'] },
      execute: function (i) { turn.buttons.push({ label: String(i.label).slice(0, 40), value: '@go:' + String(i.screen) + (i.place_id ? ':' + String(i.place_id) : ''), kind: '' }); return 'ok'; } });
    return S.maxTools ? list.slice(0, S.maxTools) : list;
  }

  function summary(outs) { return (outs || []).map(function (m) { var s = m.md || ''; if (m.card) s += (s ? '\n' : '') + '[' + m.card.type + ': ' + (m.card.title || '') + (m.card.rows ? ' — ' + m.card.rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('; ') : '') + (m.card.conf ? ' — confirmation ' + m.card.conf : '') + ']'; return s; }).join('\n').slice(0, 1500) || '(handled)'; }
  function remember(text, outs) { S.turns.push({ role: 'user', content: 'Student: ' + text }, { role: 'assistant', content: summary(outs) }); if (S.turns.length > 16) S.turns = S.turns.slice(-16); }
  async function local(text, note) { var out = await B.handle(text); if (note && out[0]) out[0].md = '_' + note + '_\n\n' + (out[0].md || ''); remember(text, out); return out; }

  AI.enabled = function () { return TA.settings.claude !== false && !!S.fn && !S.off; };
  AI.reset = function () { S.turns = []; };
  AI.stop = function () { if (S.ctl) S.ctl.abort(); };
  AI.handle = async function (text, opts) {
    opts = opts || {};
    await ready;
    var n = TA.NLU.parse(text), p = B.pending;
    if (n.crisis || n.emergency || B.sensitive(n)) return local(text);
    if (p && (p.stage === 'confirm' || p.stage === 'slot' || p.stage === 'scope' || p.stage === 'auth') && (n.yes || n.no || n.cancel || p.stage === 'slot' || /^@/.test(text))) return local(text);
    if (n.undo || n.signin || n.signout || /^@/.test(text)) return local(text);
    if (!S.fn || S.off || !S.tools) return local(text);
    var hit = TA.Actions.detect(n); if (hit && hit.score >= 0.9 && !n.isQuestion) return local(text); // optional fast path: clear commands stay instant

    var side = [], sources = [], turn = { started: false, buttons: [] };
    var res = await TA.Search.query(text, { k: 8 });
    var R = (res.results || []).filter(function (r) { return r.cov >= 0.3; }).slice(0, 8);
    R.forEach(function (r) { sources.push({ url: r.url, title: r.t === 'f' ? r.ti + ' – askUSC' : (r.utitle || r.ti) }); });
    var ctx = '<context>' + AI.context() + (window.TH && TH.clock ? ' Clock: ' + TH.clock.now().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '.' : '') + '</context>\n<usc_sources>\n' + (R.length ? AI.formatSources(R, 1) : '(no matching USC passages found)') + '\n</usc_sources>';
    var input = [{ role: 'user', content: RULES + '\n\n' + catalog() }].concat(S.turns, [{ role: 'user', content: ctx + '\n\nStudent: ' + text }]);
    S.ctl = new AbortController();
    var out;
    try {
      out = await S.fn(input, { tools: tools(side, sources, turn), modelTier: 'quick', cache: false, signal: S.ctl.signal, onText: function (u) { if (opts.onDelta) opts.onDelta(u.text); } });
    } catch (e) {
      var code = e && e.code;
      if (/^(not_granted|sampling_disabled|not_declared|capability_disabled|capability_removed)$/.test(code)) S.off = true;
      if (code === 'tools_unavailable') S.tools = false;
      // a card start_action already produced must still be shown; never re-run the text locally then
      if (side.length) { var keep = side.concat(e && e.text && code !== 'refused' ? [{ role: 'bot', md: e.text, kind: 'ai' }] : []); remember(text, keep); return keep; }
      if (code === 'cancelled') return [{ role: 'bot', md: 'Stopped.' }];
      var why = S.off ? 'Claude isn’t available here, so I’m answering from my built-in USC index.' : code === 'rate_limited' ? 'Claude is busy right now, so I answered from my built-in USC index.' : 'Claude hit a problem, so I answered from my built-in USC index.';
      var first = S.off ? !S.noted : true; S.noted = true;
      return local(text, first ? why : null);
    }
    // [n] citations -> source chips (same as ai.js)
    var finalText = out.text || '', cited = [], seen = {};
    finalText.replace(/\[(\d+(?:\]\[\d+|\s*,\s*\d+)*)\]/g, function (m, g) { g.split(/\]\[|,/).forEach(function (x) { var k = +x.trim(); if (sources[k - 1] && !seen[k]) { seen[k] = 1; cited.push(sources[k - 1]); } }); return m; });
    var md = finalText.replace(/\s?\[(\d+(?:\]\[\d+|\s*,\s*\d+)*)\]/g, '').trim();
    var msgs = side.slice();
    if (md) msgs.push({ role: 'bot', md: md, sources: cited, kind: 'ai', chips: turn.buttons.slice(0, 3) });
    if (!msgs.length) msgs.push({ role: 'bot', md: 'I couldn’t find that on USC’s websites.', kind: 'ai' });
    remember(text, msgs);
    return msgs;
  };
})();
