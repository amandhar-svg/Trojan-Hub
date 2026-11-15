window.__mock = { mode: 'ok', calls: [] };
window.claude = { use: async (cap) => {
  const f = async (input, opt) => {
    const m = window.__mock; const rec = { inputBytes: new TextEncoder().encode(input.map(t => t.content).join('')).length, nTurns: input.length, first: input[0].role, last: input[input.length - 1].role, tools: opt.tools.map(t => [t.name, t.description.length, JSON.stringify(t.inputSchema || {}).length]), cache: opt.cache, results: [] };
    m.calls.push(rec);
    if (m.mode === 'deny') throw { code: 'not_granted', message: 'no' };
    const tool = n => opt.tools.find(t => t.name === n);
    const r1 = await tool('search_usc').execute({ query: 'rsvp event engage' }, {}); rec.results.push(['search_usc', String(r1).length]);
    const r0 = await tool('get_my_account').execute({ section: 'schedule' }, {}); rec.results.push(['get_my_account', String(r0).length]);
    const r2 = await tool('search_classes').execute({ term: 'Spring 2027', query: 'CSCI 201' }, {}); rec.results.push(['search_classes', String(r2).length]);
    if (m.mode === 'act') { const ev = TH.CLUB_EVENTS.filter(e => new Date(e.start) > TA.now() && !(e.multi_day_span_days > 1))[2]; const r3 = await tool('start_action').execute({ action: 'hub_rsvp_event', request: 'RSVP to ' + ev.title }, {}); rec.results.push(['start_action', r3]);
      try { await tool('start_action').execute({ action: 'join_org', request: 'join x' }, {}); } catch (e) { rec.results.push(['second start_action threw', e.message]); }
      try { await tool('start_action').execute({ action: 'nope' }, {}); } catch (e) { rec.results.push(['bad id', e.message]); } }
    await tool('add_button').execute({ label: 'Open My Day', screen: 'plans' }, {});
    opt.onText({ text: 'Here you go [1].', delta: 'Here you go [1].' });
    if (m.mode === 'fail-after-action') throw { code: 'upstream_error', message: 'x', text: 'Here you go' };
    return { text: 'Here you go [1]. Review the card and confirm.', truncated: false, modelTierApplied: 'quick' };
  };
  f.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 16 } });
  return f;
} };
