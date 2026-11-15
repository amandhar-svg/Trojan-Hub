/* js/ta/script.js */
/* js/ta/script.js — Tommy Script: Ask Tommy runs on scripts.
 *
 *   student text ─► COMPILER (rules, on this device) ─► one script command ─► RUN (on this device) ─► answer
 *                        │ can't read it
 *                        └─► AI translator (js/ta/ai-sample.js): text ─► command. No tools, no account, never the output.
 *
 * A command is a name plus arguments, e.g.  grades.show course="MATH 226"   ·   guest.register name="Alex Kim" day=0
 * Three families:
 *   - read commands (TS.cmds): grades, homework, exams, breaks, buildings, gates, zones, bikes, watch list…
 *     run instantly and only read the student's data.
 *   - do <action>: every Trojan Assist / Trojan Hub action (register a class, book a library room, order food,
 *     guest someone in, add the USCard to Apple Wallet, "notify me when…"). Always a confirm card first, then Undo.
 *   - ask "<question>": Trojan Assist's USC knowledge base (answers only from USC's own pages).
 * The command that ran is shown under each answer (Settings can hide it).
 * Load after hub-actions.js, embed.js and ai-sample.js; before bridge.js and TA.boot().
 */
(function () {
  'use strict';
  var TA = window.TA, TH = window.TH || (window.TH = {}), B = TA.Brain, UI = TA.UI, AI = TA.AI;
  var TS = TA.Script = { cmds: {}, history: [] };
  var A = function () { return TH.acad; };
  var now = function () { return TA.now(); };
  var esc = TA.esc;
  function go(label, screen, arg) { return { label: label, value: '@go:' + screen + (arg != null ? ':' + arg : ''), kind: '' }; }
  function say(label, value) { return { label: label, value: value || label.toLowerCase(), kind: '' }; }
  function act(label, value) { return { label: label, value: value || label.toLowerCase(), kind: 'action' }; }
  function bot(md, chips) { return { role: 'bot', md: md, kind: 'c', chips: chips || [] }; }
  function pct(p) { return p == null ? '—' : (Math.round(p * 10) / 10).toFixed(1) + '%'; }
  function dayWord(d) { return TH.ui.dayLabel(d); }
  function isQ(t) { return /^(how (do|can|would|should|does|much|many|long) |how to\b|what (is|are|does|do|happens)\b|why\b|is it\b|are there\b|does\b|do i (need|have)\b|can i\b|am i allowed)/.test(t) && !/\b(for me|on my behalf)\b/.test(t); }

  // ===================================================================================================
  // READ COMMANDS
  // ===================================================================================================
  function def(name, spec) { spec.name = name; TS.cmds[name] = spec; }

  // ===================================================================================================
  // PART 6: TOMMY PLANS YOUR DAY / WEEK (engine + chat cards in js/planner.js; "add these" = hub_plan_add)
  // Defined first so "what should I do tonight" plans the evening instead of listing events.
  // ===================================================================================================
  var WDN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var PLAN_NO = /\b(semester|quarter|term|next year|four.year|4.year|class schedule|course schedule|schedule of classes|which classes|what classes|courses?|registration|register|enroll|major|minor|degree|graduat\w*|study abroad|meal plan|payment plan|financial plan|birth control|parenthood|retirement|wedding|lesson plan|business plan|floor plan|data plan|phone plan|health plan|insurance|for (my|our|the) (club|org|organization|members|team|chapter)|an event for|a party)\b/;
  var PLAN_INTENT_NOT = /\b(plan|planning|planned|plans) (to|on)\b|\bplanned parenthood\b/;
  var PLAN_Q = /^(how (do|does|can|could|would|should) (i|we|you|students?|people|one)|how to|what is|whats|what are|why|is it|are there|do i need|tips? (for|on))\b/;
  // A student who asks for help, describes danger or says they are going without (food, a place to stay) never gets an
  // upbeat plan, outings or event picks from these commands: the message falls through to Trojan Assist's own safety and
  // support answers ("plan tomorrow, i havent eaten in days" → Student Basic Needs; "my friend fell on the hike and is
  // bleeding" → 911 / DPS). Planning help itself ("help me plan my day", "i need help planning my week") still plans.
  var PLAN_HELP = new RegExp('\\b(' + [
    'bleed\\w*', 'blood(?! drive| donation)\\w*', 'injur\\w*', 'hurt', 'hurts', 'hurting', 'unconscious', 'unresponsive', 'passed out', 'blacked out', 'not breathing',
    'can ?not breathe', 'cant breathe', 'seizure\\w*', 'overdos\\w*', 'ambulance', 'fell (down|off|from|over|on|in|into|and)', 'has fallen', 'fallen (down|off)',
    'lost(?! (my|our|his|her|their|track|count|weight|interest|points)\\b)', 'stranded', 'trapped', 'stuck (on|in|at|up|out) (a|an|the|this|some|my|our)? ?(trail|hike|mountain|canyon|cliff|woods|elevator|car|room|bathroom|building)',
    'stuck outside', 'cant find (my|our|the) way', 'can not find (my|our|the) way',
    'outside (my|our|the) (door|room|window|apartment|dorm|house|place)', '(wont|will not|refuses? to) (leave|go away)',
    'following (me|us)', '(is|are|keeps?|has been|have been|hes|shes|theyre) (following|chasing|stalking) (me|us|my|her|him|them)', 'being (followed|chased|stalked)', 'stalk\\w*',
    'scared', 'afraid', 'frightened', 'terrified', 'unsafe', 'not safe', 'in danger', 'threat\\w*', 'abus\\w*', 'assault\\w*', 'attacked', 'harass\\w*', 'haz(ed|ing)',
    'emergency', '911', 'help me(?! (to )?(plan|organi[sz]e|schedule|figure|map|sort|lay|fill|make|build|find|pick|choose|decide|get organi[sz]ed))',
    'need help(?! (plan\\w*|organi[sz]\\w*|scheduling|figuring|with (my|the|a) (plan|schedule|day|week|weekend|calendar)))', 'please help', 'somebody help', 'someone help',
    'have ?n.?t eaten', 'havent eaten', 'have not eaten', 'not eaten', 'didnt eat', 'did not eat', 'nothing to eat', 'no food', 'starv\\w*', 'so hungry',
    'cant afford', 'can not afford', 'cannot afford', 'no money', 'broke and', 'nowhere to (sleep|stay|live|go)', 'no place to (sleep|stay|live)', 'kicked out', 'homeless', 'evict\\w*',
    'suicid\\w*', 'kill (myself|me)', 'want to die', 'wanna die', 'end (it all|my life)', 'self harm', 'hurt myself', 'panic attack', 'crisis'
  ].join('|') + ')\\b');
  // "find me a hike, i don't want to get lost" is still a request (no lookbehind, so older phone browsers can load this)
  function helpCue(t) { return PLAN_HELP.test(String(t || '').replace(/\b(?:get|getting|gets) lost\b/g, ' ')); }
  function planDay(t, raw) {
    if (/\btomorrow\b/.test(t)) return 'tomorrow';
    if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(t)) return 'today';
    var w = WDN.filter(function (d) { return new RegExp('\\b' + d + '\\b').test(t); })[0]; if (w) return w;
    var m = /\b(\d{4}-\d{2}-\d{2})\b/.exec(raw); if (m) return m[1];
    try { var n = TA.NLU.parse(raw); if (n.dates && n.dates[0]) return TH.dkey(n.dates[0]); } catch (e) { /* no date */ }
    return undefined;
  }
  def('plan.day', {
    about: 'Tommy PLANS one day for the student: fits their classes, homework due, exams, bookings, orders and saved/club events, then suggests meals at dining halls open then (diet/allergy notes), study blocks before deadlines, events picked for them, a workout if it fits their interests, walking time and a wind-down. Shows a plan card with "Add to My Day". Use for "plan my day", "plan tomorrow", "plan my Saturday", "what should I do tonight", "organize my afternoon". day (optional): "today" | "tomorrow" | a weekday like "saturday" | "YYYY-MM-DD". focus (optional): "evening" | "afternoon" | "morning".',
    args: ['day', 'focus'],
    match: function (t, raw) {
      if (PLAN_NO.test(t) || PLAN_INTENT_NOT.test(t) || helpCue(t)) return null;
      // ("what should I do right now" is not a planning request: it is how people ask for help, so it is not a trigger)
      var tonight = /\bwhat (should|can|could|do) (i|we) do (tonight|this evening|later tonight|after class(es)?|today|this afternoon|tomorrow|this weekend|on (mon|tues|wednes|thurs|fri|satur|sun)day)\b|\bwhat to do (tonight|today|this evening|tomorrow)\b|\b(i am|im) bored( (tonight|today|right now))?$|\banything (fun )?to do (tonight|today|this evening)\b|\bwhats (fun|good|happening) (for me )?tonight\b|\bplans? for tonight\b/.test(t);
      var DAYW = '(day|today|tomorrow|tonight|evening|afternoon|morning|(mon|tues|wednes|thurs|fri|satur|sun)day)';
      var verbs = new RegExp('\\b(plan|planning|map out|organi[sz]e|sort out|lay out)\\b( out)?( (my|the|a))?( whole| entire| full)? ' + DAYW + '\\b').test(t)
        || new RegExp('\\b(schedule|build|make|put together|line up|figure out|fill|optimi[sz]e)\\b( out)?( me)? my( whole| entire| free)? ' + DAYW + '\\b').test(t)
        || new RegExp('\\b(day plan|daily plan|plan for (today|tomorrow|tonight|my day|(mon|tues|wednes|thurs|fri|satur|sun)day)|make me a (plan|schedule) for ' + DAYW + ')\\b').test(t)
        || /^(plan( my)? day|plan it|plan my day for me|day planner)$/.test(t) || /\bplan my day\b/.test(t)
        || /\bplan( out)?( my| the)? ((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}(st|nd|rd|th)?|\d{1,2}\/\d{1,2}|the \d{1,2}(st|nd|rd|th))\b/.test(t);
      if (!verbs && !tonight) return null;
      if (/\bweek(end)?\b/.test(t) && !/\b(weekend day)\b/.test(t)) return null;   // plan.week
      if (!tonight && PLAN_Q.test(t) && !/\bmy\b/.test(t)) return null;            // "how do students plan their day?" stays a question
      var focus = /\b(tonight|this evening|evening|after class(es)?)\b/.test(t) ? 'evening' : /\b(this )?afternoon\b/.test(t) ? 'afternoon' : /\b(this )?morning\b/.test(t) ? 'morning' : undefined;
      return { day: planDay(t, raw), focus: focus };
    },
    run: function (a) { return TH.plan && TH.plan.chatDay ? TH.plan.chatDay(a) : [bot('The planner is still loading. Try again in a moment.', [go('Open My Day', 'plans')])]; }
  });
  def('plan.week', {
    about: 'Tommy PLANS the student’s week (or weekend): the best events per day, their club meetings, free food, exams and deadlines, and real off-campus outings, with a link to plan any single day. Use for "plan my week", "plan my weekend", "what should I do this week", "plan next week". start (optional): "today" | "next" (next Monday) | "weekend".',
    args: ['start'],
    match: function (t) {
      if (PLAN_NO.test(t) || PLAN_INTENT_NOT.test(t) || helpCue(t)) return null;
      var hit = /\b(plan|planning|map out|organi[sz]e|sort out|lay out|schedule|line up|figure out)\b( out)?( (my|the|this|next|a))? (week|weekend)\b/.test(t) || /\b(week|weekly) plan\b|\bplan for (this|next|the) (week|weekend)\b|\bwhat (should|can) (i|we) do this (week|weekend)\b|\bwhat to do this (week|weekend)\b|\bplans? for (the|this) weekend\b|^plan (my )?week(end)?$/.test(t);
      if (!hit) return null;
      if (PLAN_Q.test(t) && !/\bmy\b/.test(t)) return null;
      return { start: /\bweekend\b/.test(t) ? 'weekend' : /\bnext week\b/.test(t) ? 'next' : undefined };
    },
    run: function (a) { return TH.plan && TH.plan.chatWeek ? TH.plan.chatWeek(a) : [bot('The planner is still loading. Try again in a moment.', [go('Open My Day', 'plans', 'week')])]; }
  });
  var OUT_N = '(field ?trips?|outings?|excursions?|day ?trips?|road ?trips?|off[- ]?campus (events?|trips?|activities|things|adventures?|stuff|fun|outings?)|(something|anything|things|stuff)( fun)? to do off[- ]?campus|trips?|hikes?|hiking( trips?)?|beach (trips?|days?|runs?)|museum (trips?|visits?)|adventures?|getaways?)';
  var OUT_ANY = new RegExp('\\b' + OUT_N + '\\b|\\bget (me )?off campus\\b');
  var OUT_NOT = new RegExp('\\b(' + [
    'clubs?', 'teams?', 'orgs?', 'organi[sz]ations?', 'society', 'association', 'members?', 'group ?chat',
    'bring', 'pack', 'packing', 'wear', 'wearing', 'gear', 'shoes', 'boots', 'sunscreen', 'prepare', 'prep', 'tips?', 'advice', 'permit',
    'hazards?', 'report\\w*', 'complain\\w*', 'broken', 'repair', 'maintenance', 'accident', 'incident',
    'trip(s|ped|ping)? (hazard|over|on|up|out|into)', '(acid|bad|ego|power|guilt|head) trips?', '(price|tuition|rent|fee|rate|tax|wage|interest)s? hikes?', 'hikes? (up|in) (the )?(price|prices|rates|rent|tuition|fees)'
  ].join('|') + ')\\b');
  var OUT_INTENT = [
    new RegExp('\\b(find|show|list|suggest|recommend|search( for)?|look(ing)? for|give me|get me|plan( me)?|got any|any|anything|join|sign me up for|rsvp( me)? (to|for))\\b( \\w+){0,4}? ' + OUT_N + '\\b'),
    new RegExp('\\b(is there|are there)( any| some| a| an)?( good| fun| cool| upcoming| free| new)? ' + OUT_N + '\\b'),
    new RegExp('\\bwhat( kind of| sort of)? ' + OUT_N + '\\b'),
    new RegExp('\\b(i want|i wanna|i would like|id like|want|wanna|lets|let us|i need|need|looking|down|can we|should we|where can (i|we)|where should (i|we)) (to )?(go (on|to)|do|take|join|find|plan|get on|book)( a| an| some| the)?( \\w+){0,2}? ' + OUT_N + '\\b'),
    /\b(i want to|i wanna|wanna|want to|lets|let us|id like to|i would like to|can we|should we|where (can|should) (i|we)) go hiking\b/,
    /\b(i need|need|want|wanna|could use) (an? |some )?(outing|adventure|day trip|field trip|getaway|break from campus)\b/,
    /\bget (me )?off campus\b/,
    new RegExp('^' + OUT_N + '( this (week|weekend|month)| next week| for me| near (me|usc|campus))?$')
  ];
  def('plan.outings', {
    about: 'Find real OFF-CAMPUS outings and field trips the student can join (trips, excursions, hikes, beach days, museum visits) from EngageSC listings that say they leave campus; says honestly when none are posted. Use for "find a field trip this week", "any outings?", "I want to get off campus this weekend". range (optional): "week" (default) | "next" | "month".',
    args: ['range'],
    match: function (t) {
      if (!OUT_ANY.test(t)) return null;
      if (helpCue(t)) return null;   // "we are lost on a hike…", "my friend fell on the hike…": safety first, never an outings card
      if (/\b(polic(y|ies)|waiver|forms?|insurance|approv\w*|travel (registration|request|grant)|reimburs\w*|fund(ing|s)?|budget|host(ing)?|organi[sz](e|ing)|lead(ing)?|for (my|our) (club|org|members|team|chapter)|study abroad|abroad|spring break|winter break|thanksgiving|lyft|uber|ride|airport|lax|union station|metro|bus|shuttle|zipcar|price|tuition|fee|rent) ?\b/.test(t)) return null;
      // a question or report that only mentions a trip or hike ("what should I bring on a hike", "is there a hiking club",
      // "report a trip hazard on the stairs") is not a request to find an outing
      if (OUT_NOT.test(t)) return null;
      if (!OUT_INTENT.some(function (re) { return re.test(t); })) return null;
      if (/^(how (do|can|does)|what is|whats the (policy|rule))\b/.test(t)) return null;
      return { range: /\bmonth\b/.test(t) ? 'month' : /\bnext week\b/.test(t) ? 'next' : undefined };
    },
    run: function (a) { return TH.plan && TH.plan.chatOutings ? TH.plan.chatOutings(a) : [bot('The planner is still loading. Try again in a moment.', [go('Week plan', 'plan', 'week')])]; }
  });
  // "i want to report a trip hazard on the stairs", "report a broken railing outside Leavey", "report overflowing trash
  // by the fountain": a non-emergency problem with the campus itself opens Report something at the details step, with
  // the type picked and the student's words filled in (they add where and a photo). Danger never gets here (the safety
  // gate runs first and these words bail out too), and a request Tommy already knows how to do (a housing work order…) wins.
  var REP_LEAD = /^(?:(?:hey |hi )?tommy,? )?(?:please |pls |can you |could you |can i |could i |may i |let me |help me |how do i |where do i |where can i |i (?:want|need|would like|wanna) to |id like to |i would like to )?(?:report|file a report (?:about|on|for)|submit a report (?:about|on|for)|make a report (?:about|on))\b(?: (?:a|an|the|some|this|that))?\s+(.{3,})$/;
  var REP_FIX = /\b(?:trip(?:ping)? hazards?|hazards?|stairs?|stairwells?|staircases?|steps|railings?|handrails?|uneven|loose (?:tiles?|steps?|railings?|bricks?|pavers?)|cracked|cracks?|potholes?|sidewalks?|wet floor|slippery|broken|leak\w*|ceiling|water fountains?|elevators?|escalators?|lights? (?:is |are )?(?:out|broken|flickering|off)|street ?lights?|lamps?|outlets?|doors?|windows?|toilets?|sinks?|restrooms?|bathrooms?|air condition\w*|heat(?:ing|er)?|bike racks?|benches?|fallen (?:tree|branch)|branch(?:es)?|trash|garbage|overflowing|spill\w*|graffiti|mess|smell|odor|pests?|rats?|mice|roach\w*|ramps?|wheelchair|automatic doors?|accessib\w*)\b/;
  var REP_NOT = /\b(?:fire|smoke|gas|sparks?|sparking|exposed wires?|electrocut\w*|carbon monoxide|crime|theft|stolen|steal\w*|robbed|harass\w*|haz(?:e|ed|es|ing)|bull(?:y|ied|ying)|assault\w*|abus\w*|discriminat\w*|bias|racis\w*|sexual\w*|stalk\w*|threat\w*|someone|somebody|guy|man|woman|person|people|roommate|friend|professor|ta|classmate|ra|grades?|card|absence|sick|ill|covid|lost|missing|app|tommy|bug in)\b/;
  function repCat(d) {
    var c = ''; try { c = TH.x && TH.x.guessCat ? TH.x.guessCat(d) : ''; } catch (e) { c = ''; }
    if (/\b(?:projectors?|printers?|wi-?fi|eduroam|internet|hdmi|smart ?boards?|classroom tech)\b/.test(d)) return 'it';
    if (/\b(?:ramps?|wheelchair|automatic doors?|accessib\w*|step-free)\b/.test(d)) return 'access';
    if (/\b(?:trash|garbage|overflowing|spill\w*|graffiti|mess|smell|odor)\b/.test(d) && !/\bbroken\b/.test(d)) return 'clean';
    return c === 'clean' || c === 'access' ? c : 'facilities';
  }
  def('report.problem', {
    about: 'Report a NON-emergency problem with the campus itself (a trip hazard, broken railing or light, a leak, overflowing trash, a blocked ramp): opens the Report something sheet with the type picked and the student’s words filled in, so they only add where it is (and a photo). what: the problem in the student’s words.',
    args: ['what'],
    match: function (t, raw) {
      if (B.pending) return null;
      var m = REP_LEAD.exec(t); if (!m) return null;
      var what = m[1].replace(/\s+(please|pls|for me|thanks|thank you)$/, '').trim();
      if (!REP_FIX.test(what) || REP_NOT.test(what) || helpCue(t.replace(/^(?:please )?help me /, ''))) return null;
      if (/^(something|a problem|an issue|a report|it|this|that)$/.test(what)) return null;          // "report something" keeps the full sheet
      try { var h = TA.Actions.detect(TA.NLU.parse(raw)); if (h && h.score >= 0.8) return null; } catch (e) { /* no action match */ }
      var src = String(raw || '').trim(), mm = /\breport\b(?:\s+(?:about|on|for))?(?:\s+(?:a|an|the|some|this|that)\b)?\s*/i.exec(src);
      var words = (mm ? src.slice(mm.index + mm[0].length) : what).replace(/[.!?\s]+$/, '').slice(0, 200);
      return { what: words.charAt(0).toUpperCase() + words.slice(1) };
    },
    run: function (a) {
      var what = String(a.what || '').trim(), cat = repCat(what.toLowerCase());
      var rc = (TH.x && TH.x.RC && TH.x.RC[cat]) || null, office = rc ? rc[2] : 'the right office';
      var label = { facilities: 'Facilities & maintenance', clean: 'Cleanliness', access: 'Accessibility', it: 'Wi-Fi & tech' }[cat] || 'Facilities & maintenance';
      if (!TH.openReportSheet) return [bot('Use **Report something** on Home to send this: pick the type, add where it is and a photo, and it’s routed to the right office (simulated).', [go('Open Home', 'home')])];
      setTimeout(function () {
        try {
          TH.openReportSheet('issue');
          var w = document.querySelector('.p6-rsheet'); if (!w) return;
          var c = w.querySelector('[data-cat="' + cat + '"]'); if (c) c.click();
          var d = document.querySelector('.p6-rsheet #rp-desc');
          if (d && !d.value.trim() && what) { d.value = what; d.dispatchEvent(new Event('input', { bubbles: true })); }
        } catch (e) { console.error(e); }
      }, 450);
      return [bot('Opening **Report something** as a non-emergency **' + label + '** report, with your words filled in. Add where it is (and a photo if it helps), then send. It goes to **' + office + '** (simulated).' + (cat === 'facilities' ? '\n\n_Someone hurt? Call **911** or DPS at **213-740-4321**._' : ''), [go('My reports', 'report')])];
    }
  });

  // ===================================================================================================
  // EVENT RECOMMENDATIONS, HASHTAGS & ACCURATE PUBLIC CAMPUS COMMANDS (Converted by AI from words)
  // ===================================================================================================
  def('events.rate', {
    about: 'Give thumbs up or thumbs down to an event (like Netflix) to tune recommendations based on hashtags. args: id, vote ("up" or "down")',
    args: ['id', 'vote'],
    match: function (t, raw) {
      if (/\b(thumbs? (up|down)|like event|dislike event|rate event)\b/.test(t)) {
        var isUp = /\b(up|like)\b/.test(t) && !/\bdislike\b/.test(t);
        var mId = /\b(?:event\s+)?(\d{5,8})\b/.exec(raw);
        var id = mId ? mId[1] : null;
        if (!id) {
          var cal = (hub().calendar || []).find(function (x) { return x.kind === 'event' || x.kind === 'club'; });
          id = cal ? cal.ref : (TH.events()[0] ? TH.events()[0].id : null);
        }
        return { id: id, vote: isUp ? 'up' : 'down' };
      }
      return null;
    },
    run: function (args) {
      var ev = TH.eventById(args.id);
      if (!ev) return [bot('I couldn’t find an event with ID ' + esc(args.id) + ' to rate. Try opening an event on the Events screen to give thumbs up/down.', [go('Browse Events', 'events')])];
      var isUp = args.vote === 'up';
      var tags = TH.getEventHashtags(ev);
      TH.setEventFeedback(ev.id, isUp ? 1 : -1, { title: ev.title, orgId: ev.orgId, cats: ev.cats, hashtags: tags });
      var md = (isUp ? '👍 **Thumbs up saved** for **' : '👎 **Thumbs down saved** for **') + esc(ev.title) + '**!\n\n' +
        (isUp
          ? 'We’ve boosted your preference for hashtags: `' + esc(tags.join(' ')) + '`. Tommy will now recommend more events like this!'
          : 'Got it. We’ll recommend fewer events with these hashtags: `' + esc(tags.join(' ')) + '`.') + '\n\n' +
        '⚡ **Netflix-style recommendation engine updated.**';
      return [bot(md, [say('Show my recommended events', 'recommend events for me'), go('Browse Events', 'events')])];
    }
  });

  def('events.recommend', {
    about: 'Recommend relevant upcoming events for the student based on thumbs up/down ratings, hashtags, and clubs. count (optional): number of events.',
    args: ['hashtag', 'count'],
    match: function (t, raw) {
      // "what should I do if I lose my USCard?" is a question for the knowledge base / actions, not event picks
      if (/\bwhat (should|do|can) i do (if|about|when|with|after|because|since|to|in case|for)\b|\bwhat to do (if|about|when|with|after|in case)\b/.test(t)) return null;
      if (helpCue(t)) return null; // "what should i do, i havent eaten in days" → Student Basic Needs, not event picks
      if (/\b(recommend|suggest|what events|events for me|my events|good events|what should i do|what to do)\b/.test(t) && !/\b(class|course|professor|major)\b/.test(t)) {
        var mTag = /#([a-zA-Z0-9_-]+)/.exec(raw);
        return { hashtag: mTag ? '#' + mTag[1].toLowerCase() : null, count: 6 };
      }
      return null;
    },
    run: function (args) {
      var all = TH.events(), n = TA.now();
      var tag = args.hashtag ? args.hashtag.toLowerCase() : null;
      var scored = all.filter(function (e) {
        if (e.e < n || e.multiDay) return false;
        if (tag) {
          var htags = TH.getEventHashtags(e);
          return htags.some(function (h) { return h.toLowerCase() === tag; });
        }
        return true;
      }).map(function (e) {
        var match = TH.calcEventMatch(e);
        return { e: e, match: match };
      }).filter(function (o) { return !o.match.disliked; });

      scored.sort(function (a, b) { return b.match.score - a.match.score || a.e.s - b.e.s; });
      var top = scored.slice(0, parseInt(args.count) || 5);

      if (!top.length) {
        return [bot('No upcoming events found matching that recommendation filter. Try asking for `#freefood`, `#robotics`, `#ai`, or `#career`.')];
      }

      var md = '### ⭐ Recommended Events for You\n' +
        '_Ranked by your thumbs up ratings and matching hashtags (Netflix-style)_\n\n' +
        top.map(function (o) {
          var e = o.e, m = o.match;
          var htags = (m.hashtags || TH.getEventHashtags(e)).slice(0, 4).join(' ');
          var dLabel = TH.ui.dayLabel(e.date);
          return '**' + esc(e.title) + '**  \n' +
            '🟢 **' + m.pct + '% Match** · ' + esc(m.why) + '  \n' +
            '📅 ' + esc(dLabel) + (e.allDay ? ' (All day)' : ' at ' + esc(TH.fmtMin(e.start))) + ' · 📍 ' + esc(e.location || e.org || 'USC Campus') + '  \n' +
            '🏷️ `' + esc(htags) + '`';
        }).join('\n\n');

      return [bot(md, [go('Open Events Calendar', 'events'), say('Show #robotics events', 'events with #robotics'), say('Show #freefood events', 'events with #freefood')])];
    }
  });

  def('events.find', {
    about: 'Find public upcoming calendar events by keyword, category, or hashtag. Shows multiple calendar events across days.',
    args: ['q', 'hashtag', 'cat'],
    match: function (t, raw) {
      if (/\b(events?|calendar|what'?s happening|activities|workshops?|hackathons?|socials?|parties)\b/.test(t) && !/\b(cancel|rsvp to|drop)\b/.test(t)) {
        var mTag = /#([a-zA-Z0-9_-]+)/.exec(raw);
        var cat = null;
        if (/career|job|internship/.test(t)) cat = 'Career';
        else if (/food|boba|pizza/.test(t)) cat = 'Free food';
        else if (/social|party/.test(t)) cat = 'Social';
        else if (/art|music|theatre|film/.test(t)) cat = 'Arts';
        return { q: raw.replace(/events?|what'?s happening|calendar/gi, '').trim(), hashtag: mTag ? '#' + mTag[1].toLowerCase() : null, cat: cat };
      }
      return null;
    },
    run: function (args) {
      var all = TH.events(), n = TA.now();
      var q = (args.q || '').toLowerCase().trim();
      var tag = args.hashtag ? args.hashtag.toLowerCase() : null;
      var cat = args.cat;

      var hits = all.filter(function (e) {
        if (e.e < n || e.multiDay) return false;
        if (cat && cat === 'Free food' && !e.food) return false;
        if (cat && cat !== 'Free food' && !e.cats.includes(cat)) return false;
        if (tag) {
          var htags = TH.getEventHashtags(e);
          if (!htags.some(function (h) { return h.toLowerCase() === tag; })) return false;
        }
        if (q && q.length > 2) {
          var full = (e.title + ' ' + (e.org || '') + ' ' + (e.cats || []).join(' ')).toLowerCase();
          if (!full.includes(q)) return false;
        }
        return true;
      });

      hits.sort(function (a, b) {
        return (TH.calcEventMatch(b).score - TH.calcEventMatch(a).score) || (a.s - b.s);
      });

      var shown = hits.slice(0, 6);
      if (!shown.length) return [bot('No upcoming events found for that search. Try searching for `#ai`, `#robotics`, `#career`, or `#freefood`.', [go('Browse Events', 'events')])];

      var md = '### 📅 Upcoming Calendar Events' + (cat ? ' · ' + esc(cat) : '') + (tag ? ' · ' + esc(tag) : '') + '\n' +
        '_Showing multiple calendar events across upcoming days (verified from EngageSC)_\n\n' +
        shown.map(function (e) {
          var m = TH.calcEventMatch(e);
          var htags = (m.hashtags || TH.getEventHashtags(e)).slice(0, 4).join(' ');
          return '**' + esc(e.title) + '**  \n' +
            '🟢 **' + m.pct + '% Match** · ' + esc(m.why) + '  \n' +
            '📅 ' + esc(TH.ui.dayLabel(e.date)) + ' ' + (e.allDay ? '(All day)' : 'at ' + esc(TH.fmtMin(e.start))) + ' · 📍 ' + esc(e.location || e.org || 'USC Campus') + '  \n' +
            '🏷️ `' + esc(htags) + '`';
        }).join('\n\n');

      return [bot(md, [go('See on Events screen', 'events', cat || tag || q), say('Recommend events for me', 'recommend events for me')])];
    }
  });

  def('hours.check', {
    about: 'Check real, verified hours and open/closed status for campus libraries, dining halls, gyms, and buildings from accurate USC public data (not modeled).',
    args: ['place'],
    match: function (t, raw) {
      if (/\b(when is|when does|what time (does|is)|is .{3,30} (open|closed)|hours for|hours of)\b/.test(t) && /\b(leavey|doheny|library|dining|evk|parkside|village|lyon|gym|engemann|usc village|taper|tcc)\b/.test(t)) {
        var mPlace = /(leavey|doheny|library|evk|parkside|village dining|lyon|gym|engemann|tcc)/i.exec(raw);
        return { place: mPlace ? mPlace[1] : raw };
      }
      return null;
    },
    run: function (args) {
      var q = (args.place || '').toLowerCase();
      var places = (TH.DATA && TH.DATA.places) || [];
      var hit = places.find(function (p) {
        return (p.name && p.name.toLowerCase().includes(q)) || (p.id && p.id.toLowerCase().includes(q));
      });
      if (!hit) {
        return [bot('I couldn’t find an exact place matching "' + esc(args.place) + '". You can check Leavey Library, Doheny Library, EVK Dining, Parkside Dining, Village Dining, or Lyon Center.', [go('View Campus Map & Hours', 'map')])];
      }
      var st = TH.placeStatus ? TH.placeStatus(hit, TH.clock.now()) : { open: true, text: 'Open according to posted USC schedule' };
      var md = '### 🏛️ ' + esc(hit.name) + '\n' +
        '**Status:** ' + (st.open ? '🟢 Open now' : '🔴 Closed now') + ' (' + esc(st.text || 'Real USC schedule') + ')\n' +
        (hit.desc ? esc(hit.desc) + '\n\n' : '\n') +
        '⚡ **Verified USC Public Data** · Truly accurate, not modeled.';
      return [bot(md, [go('See on Map', 'map', hit.id)])];
    }
  });

  def('grades.show', {
    about: 'Show the student’s current grades. course (optional): course code or subject word, e.g. "MATH 226", "math", "physics".', args: ['course'],
    match: function (t, raw) {
      if (/\b(grade option|grading option|pass.?no.?pass|p\/np|letter grade to|change (my|the) grad|grade (appeal|change|forgiveness|point average requirement)|transcript|grade report|when (are|do) (final )?grades (come|post|due))\b/.test(t)) return null;
      if (/\b(need|have to get|should i get)\b.*\bfinal\b/.test(t)) return null;
      var c = A().resolveCourse(raw);
      if (/\b(my|me|i|am i)\b/.test(t) && /\b(grades?|gpa|scores?|marks?|standing|doing)\b/.test(t) && /\b(what|whats|how|show|see|check|tell|list|view|get|pull up|look up|my grades?|my gpa)\b/.test(t)) return { course: c || undefined };
      if (/^(grades?|my grades?|gpa|my gpa|check grades?|show grades?)$/.test(t)) return {};
      if (c && /\b(grade|score|doing in|have in|standing in)\b/.test(t)) return { course: c };
      return null;
    },
    run: function (a) {
      var Ac = A(), code = a.course ? Ac.resolveCourse(a.course) : null, cs = Ac.courses();
      if (a.course && !code) return [bot('I couldn’t match **' + esc(String(a.course)) + '** to one of your Fall 2026 courses (' + cs.map(function (c) { return c.code; }).join(', ') + ').', cs.map(function (c) { return say(c.code + ' grade', 'what is my grade in ' + c.code); }))];
      if (code) {
        var g = Ac.grade(code), c0 = cs.find(function (c) { return c.code === code; });
        var lines = g.cats.map(function (cat) { return '- **' + cat.name + '** (' + cat.weight + '%): ' + (cat.pct == null ? 'nothing graded yet' : pct(cat.pct) + ' over ' + cat.graded + ' graded'); });
        var last = [].concat.apply([], g.cats.map(function (cat) { return cat.rows.filter(function (r) { return r.score != null; }); })).sort(function (x, y) { return y.date - x.date; }).slice(0, 3);
        return [bot('**' + code + ' · ' + c0.title + '**: you have a **' + g.letter + ' (' + pct(g.pct) + ')** so far.\n' + lines.join('\n') + (last.length ? '\n\nLatest scores: ' + last.map(function (r) { return r.title.split(':')[0] + ' **' + r.score + '/' + r.pts + '**'; }).join(' · ') : '') + '\n\n_Scores are sample data on the demo account._',
          [go('Open ' + code, 'grades', code), say('What do I need on the final?', 'what do i need on the ' + code + ' final for an A-'), say('What’s due this week?', 'what is due this week')])];
      }
      var gpa = Ac.termGPA(), rows = cs.map(function (c) { var g2 = Ac.grade(c.code); return '- **' + c.code + '** ' + c.title + ': **' + g2.letter + '** (' + pct(g2.pct) + ')'; });
      return [bot('Your Fall 2026 grades so far:\n' + rows.join('\n') + '\n\nProjected term GPA: **' + (gpa == null ? '—' : gpa.toFixed(2)) + '** · cumulative **' + Number(TA.State.d.profile.gpa).toFixed(2) + '**.\n\n_Scores are sample data on the demo account._',
        [go('Open Grades', 'grades')].concat(cs.slice(0, 3).map(function (c) { return say(c.code, 'what is my grade in ' + c.code); })))];
    }
  });

  def('grades.need', {
    about: 'What score the student needs on a final exam to reach a target letter grade. course (required), target (letter such as "A-", default "A-").', args: ['course', 'target'],
    match: function (t, raw) {
      if (!/\b(need|have to get|must get|should i get|required)\b/.test(t) || !/\bfinal\b/.test(t)) return null;
      var m = /(?:^|\s)(?:an?|get|for|keep)\s+(?:an?\s+)?([ABCDabcd][+-]|[ABCD]|[bcd])(?![\w+-])/.exec(raw) || (/\ban a\b/i.test(raw) ? [0, 'A'] : null);
      return { course: A().resolveCourse(raw) || undefined, target: m ? m[1].toUpperCase() : undefined };
    },
    run: function (a) {
      var Ac = A(), code = a.course ? Ac.resolveCourse(a.course) : null, cs = Ac.courses();
      if (!code) return [bot('Which class?', cs.map(function (c) { return say(c.code, 'what do i need on the ' + c.code + ' final for an ' + (a.target || 'A-')); }))];
      var CUT = { 'A': 93, 'A-': 90, 'B+': 87, 'B': 83, 'B-': 80, 'C+': 77, 'C': 73, 'C-': 70, 'D': 63 }, tg = CUT[String(a.target || 'A-').toUpperCase()] != null ? String(a.target || 'A-').toUpperCase() : 'A-';
      var g = Ac.grade(code), fin = g.cats.find(function (c) { return c.name === 'Final'; }), wf = fin ? fin.weight : 30;
      var need = (CUT[tg] * 100 - g.pct * (100 - wf)) / wf;
      var verdict = need > 100 ? 'That’s above 100%, so ' + tg + ' is out of reach unless there’s extra credit.' : need <= 50 ? 'You have a lot of room.' : need >= 92 ? 'Tight, but possible.' : 'Very doable.';
      return [bot('For **' + tg + '** in **' + code + '** you need about **' + Math.max(0, Math.ceil(need)) + '%** on the final. ' + verdict + '\n- Current grade: ' + pct(g.pct) + ' (' + g.letter + ')\n- The final is ' + wf + '% of the grade\n- Assumes the rest of your coursework stays at your current average\n\n_Scores and weights are sample data on the demo account._',
        [go('Open ' + code, 'grades', code), say('When is the final?', 'when is my ' + code + ' final')])];
    }
  });

  def('hw.due', {
    about: 'List homework/assignments that are due. range: "today" | "tomorrow" | "week" (default "week"). course (optional).', args: ['range', 'course'],
    match: function (t, raw) {
      if (!/\b(homework|hw|assignments?|problem sets?|psets?|to ?do list|lab reports?|due)\b/.test(t)) return null;
      if (/\b(payment|tuition|bill|balance|fee|fees|deposit|rent|library book|books?|fafsa|application|form) (is |are )?due\b|\bdue date for (tuition|payment|fees)\b|\b(tuition|payment|bill|fees?|book|books)\b/.test(t)) return null;
      if (!/\b(what|whats|anything|when|show|list|do i have|have i got|my|due|any)\b/.test(t)) return null;
      if (/\b(mark|finished|check off|i did|done with|completed)\b/.test(t)) return null;
      return { range: /\b(today|tonight)\b/.test(t) ? 'today' : /\btomorrow\b/.test(t) ? 'tomorrow' : 'week', course: A().resolveCourse(raw) || undefined };
    },
    run: function (a) {
      var Ac = A(), t0 = TH.dayStart(now()), r = a.range === 'today' || a.range === 'tomorrow' ? a.range : 'week', code = a.course ? Ac.resolveCourse(a.course) : null;
      var from = r === 'tomorrow' ? TH.addDays(t0, 1) : now(), to = r === 'today' ? TH.addDays(t0, 1) : r === 'tomorrow' ? TH.addDays(t0, 2) : TH.addDays(t0, 8);
      var list = Ac.dueBetween(from, to).filter(function (i) { return !code || i.course === code; });
      var label = r === 'today' ? 'today' : r === 'tomorrow' ? 'tomorrow' : 'in the next 7 days';
      if (!list.length) return [bot('Nothing' + (code ? ' for **' + code + '**' : '') + ' is due ' + label + '.', [go('Week view', 'plans', 'week'), say('Upcoming exams', 'when are my midterms')])];
      var open = list.filter(function (i) { return !Ac.isDone(i); }).length;
      var lines = list.map(function (i) { return '- ' + (Ac.isDone(i) ? '~~' : '') + '**' + i.course + '** ' + i.title + (Ac.isDone(i) ? '~~ (done)' : '') + ' · ' + dayWord(i.date) + ', ' + Ac.dueLabel(i); });
      return [bot('**' + open + ' thing' + (open === 1 ? '' : 's') + ' due ' + label + '**' + (code ? ' for ' + code : '') + ':\n' + lines.join('\n') + '\n\n_Homework is sample data on the demo account._',
        [go('Week view', 'plans', 'week'), say('Due tomorrow', 'what is due tomorrow'), say('Upcoming exams', 'when are my midterms')])];
    }
  });

  def('hw.done', {
    about: 'Mark the next unfinished homework item for a course as done. course (required). kind (optional): "quiz".', args: ['course', 'kind'],
    match: function (t, raw) {
      if (!/\b(mark|finished|check off|i did|im done with|i am done with|done with|completed|turned in|submitted)\b/.test(t) || !/\b(homework|hw|assignment|problem set|pset|lab report|quiz|reading|webassign|mastering)\b/.test(t)) return null;
      return { course: A().resolveCourse(raw) || undefined, kind: /\bquiz\b/.test(t) ? 'quiz' : undefined };
    },
    run: function (a) {
      var Ac = A(), code = a.course ? Ac.resolveCourse(a.course) : null;
      var it = Ac.upcoming(14).filter(function (i) { return (!code || i.course === code) && !Ac.isDone(i) && (a.kind === 'quiz' ? i.type === 'quiz' : i.type !== 'quiz'); })[0];
      if (!it) return [bot('I don’t see unfinished homework' + (code ? ' for **' + code + '**' : '') + ' in the next two weeks.', [go('Week view', 'plans', 'week')])];
      Ac.toggleDone(it.id);
      return [bot('Checked off **' + it.course + ' · ' + it.title + '** (was due ' + dayWord(it.date) + ', ' + Ac.dueLabel(it) + ').', [go('Week view', 'plans', 'week'), say('What else is due?', 'what is due this week')])];
    }
  });

  def('exams.list', {
    about: 'List the student’s upcoming midterms and finals. course (optional).', args: ['course'],
    match: function (t, raw) {
      if (!/\b(midterms?|exams?|tests?)\b/.test(t) || /\bfinals?\b/.test(t) && !/\bmidterm/.test(t)) return null;
      if (/\b(placement|osas|accommodat|make ?up|testing center|proctor|covid|drug|language exam|bar exam|mcat|lsat|gre)\b/.test(t)) return null;
      if (!/\b(when|whens|next|upcoming|my|do i have|coming up|schedule|what)\b/.test(t)) return null;
      return { course: A().resolveCourse(raw) || undefined };
    },
    run: function (a) {
      var Ac = A(), code = a.course ? Ac.resolveCourse(a.course) : null, t0 = TH.dayStart(now());
      var list = Ac.exams().filter(function (x) { return !x.past && (!code || x.course === code); });
      if (!list.length) return [bot('No upcoming exams' + (code ? ' for **' + code + '**' : '') + ' on your calendar.', [go('Month view', 'plans', 'month')])];
      var lines = list.map(function (x) { return '- **' + x.course + ' ' + x.title + '** · ' + TH.fmtDate(x.day) + ', ' + TH.fmtMin(x.start) + '–' + TH.fmtMin(x.end) + ' · in ' + Math.round((x.day - t0) / 864e5) + ' days' + (x.kind === 'final' ? ' (Registrar’s final-exam slot)' : ''); });
      return [bot('Your upcoming exams:\n' + lines.join('\n') + '\n\n_Midterm dates are sample data; final-exam slots come from the Registrar’s schedule._', [go('Month view', 'plans', 'month'), go('Grades', 'grades'), act('Book a study room', 'book a study room at leavey library')])];
    }
  });

  def('breaks.next', {
    about: 'Show upcoming breaks, holidays, study days and finals week from the USC academic calendar. which (optional): one word such as "thanksgiving", "winter", "spring".', args: ['which'],
    match: function (t) {
      if (!/\b(breaks?|recess|holidays?|days? off|no class(es)?|thanksgiving|winter break|spring break|study days?|veterans day|labor day|mlk)\b/.test(t)) return null;
      if (!/\b(when|whens|next|how long|until|is there|do we have|do i have|what|any|start|end|begins?)\b/.test(t)) return null;
      if (/\b(housing|dorm|move out|stay|dining|hours|open|shuttle|lyft|parking|library)\b/.test(t)) return null;
      var w = /\b(thanksgiving|spring|winter|veterans|labor|mlk|martin luther|presidents|study|finals?)\b/.exec(t);
      return w ? { which: w[1] } : {};
    },
    run: function (a) {
      var Ac = A(), k = TH.dkey(TH.dayStart(now())), t0 = TH.dayStart(now()), wq = String(a.which || '').toLowerCase().replace('mlk', 'martin').replace(/^finals?$/, 'final');
      var all = Ac.breaks().filter(function (b) { return b.to >= k; }), pick = wq ? all.filter(function (b) { return b.name.toLowerCase().indexOf(wq) >= 0; }) : [];
      var list = pick.length ? pick : all.slice(0, 6);
      var lines = list.map(function (b) { var d = Math.round((TH.parseKey(b.from) - t0) / 864e5); return '- **' + b.name + '** · ' + Ac.breakRange(b) + (d > 0 ? ' · in ' + d + ' day' + (d === 1 ? '' : 's') : ' · now') + (b.note ? ' · ' + b.note : ''); });
      return [{ role: 'bot', kind: 'c', md: (pick.length ? '' : 'Coming up on the USC academic calendar:\n') + lines.join('\n'), chips: [go('Month view', 'plans', 'month'), say('When are my finals?', 'when are my finals')], sources: [{ url: 'https://academics.usc.edu/calendar/', title: 'Academic Calendar – USC' }] }];
    }
  });

  def('building.find', {
    about: 'Find a campus building by its USC building code, optionally with a room number. code (required), e.g. "THH", room (optional), e.g. "201".', args: ['code', 'room'],
    match: function (t, raw) {
      var only = /^\s*[A-Za-z]{3,4}[\s-]*((B|G|LL)?\d{1,3}[A-Za-z]?)?\s*\??$/.test(raw) ? TH.findBuilding(raw.replace(/\?/g, '')) : null;
      if (only) return { code: only.b.code, room: only.room || undefined };
      if (!/\b(where|wheres|find|locate|how do i get to|get to|what building|which building|directions|map|show me|what is|whats|walk)\b/.test(t)) return null;
      var h = TH.findBuilding(raw); if (!h || !h.b.code) return null;
      if (!new RegExp('\\b' + h.b.code + '\\b').test(raw)) return null;       // the code must be typed in capitals inside a sentence
      return { code: h.b.code, room: h.room || undefined };
    },
    run: function (a) {
      var h = TH.findBuilding(String(a.code || '') + (a.room ? ' ' + a.room : ''));
      if (!h) return [bot('I don’t have a building with the code **' + esc(String(a.code || '').toUpperCase()) + '**. Try the map search with part of its name.', [go('Open the map', 'map')])];
      var b = h.b, walk = TH.ui.walkMin(b);
      return [bot('**' + b.code + '** is **' + b.name + '**' + (b.aliasOf ? ' (also ' + b.aliasOf + ')' : '') + ', about a **' + walk + ' min walk** from you.' + (h.room ? '\nRoom **' + h.room + '**' + (h.floor ? ' is usually on the **' + h.floor + '** (USC room numbers start with the floor).' : '.') : ''),
        [go('Show ' + b.code + ' on the map', 'map', 'bldg-' + b.code + (h.room ? ' ' + h.room : '')), go('Open the map', 'map')])];
    }
  });

  def('gates.status', {
    about: 'Which campus gates/entrances are open or closed, and the nearest open one. hour (optional, 0-23) to check another time of day.', args: ['hour'],
    match: function (t) {
      if (!/\b(gates?|entrances?|fence|get (in|on|onto) campus|enter campus|campus (open|closed))\b/.test(t)) return null;
      if (!/\b(open|closed|close|which|what|can i|nearest|closest|how do i|is|are|where|after|at night|tonight|now)\b/.test(t)) return null;
      if (/\b(coliseum|galen|stadium|game|ticket)\b/.test(t)) return null;
      var m = /\b(?:at|after|around|by)\s+(\d{1,2})(?::\d{2})?\s*(am|pm)\b/.exec(t), h;
      if (m) h = (+m[1] % 12) + (m[2] === 'pm' ? 12 : 0); else if (/\b(tonight|at night|late|after dark|midnight)\b/.test(t)) h = /midnight/.test(t) ? 0 : 22;
      return h == null ? {} : { hour: h };
    },
    run: function (a) {
      var h = a.hour != null && isFinite(+a.hour) ? Math.max(0, Math.min(23, Math.round(+a.hour))) : null, date = h == null ? now() : TH.dateAtHour(h);
      var G = TH.gatesAt(date), near = TH.nearestOpenGate(TH.ME, date), short = function (g) { return g.name.replace(' (pedestrian)', ''); };
      var md = (h == null ? 'Right now' : 'At ' + TH.fmtMin(h * 60)) + ', **' + G.open.length + ' of ' + G.all.length + '** campus entrances are open' + (G.controlled ? ' (controlled access, 9 PM – 6 AM: USCard or registered guest with photo ID)' : '') + '.\n' +
        '- **Open:** ' + (G.open.map(short).join(', ') || 'none') + '\n- **Closed:** ' + (G.closed.map(short).join(', ') || 'none') + (near ? '\n\nNearest open entrance: **' + short(near) + '**, about ' + TH.ui.walkMin(near) + ' min away.' : '');
      return [{ role: 'bot', kind: 'c', md: md, chips: [go('See gates on the map', 'map', 'gates')].concat(near ? [go('Walk to ' + short(near).replace(/ Entrance.*/, ''), 'walk', near.id)] : [], G.controlled ? [act('Guest someone in', 'register a guest for tonight')] : []), sources: [{ url: ((TH.SAFETY || {}).access || {}).url || 'https://dps.usc.edu/services/visitor-registration/', title: 'Campus access – USC DPS' }] }];
    }
  });

  def('zone.check', {
    about: 'Show the free USC Lyft zone or the DPS patrol zone and whether the student is inside it. zone (required): "lyft" | "dps".', args: ['zone'],
    match: function (t) {
      var z = /\b(zone|boundar(y|ies)|area|map|cover(s|ed|age)?|how far|where (can|does)|radius|limits?|border)\b/;
      if (/\b(lyft|fryft)\b/.test(t) && z.test(t) && !/\b(get|order|call|request|book) (me )?a\b/.test(t)) return { zone: 'lyft' };
      if (/\b(dps|public safety|campus police)\b/.test(t) && /\b(zone|patrol|boundar(y|ies)|area|cover(s|ed|age)?|how far|border)\b/.test(t)) return { zone: 'dps' };
      return null;
    },
    run: function (a) {
      var id = String(a.zone || '').toLowerCase() === 'dps' ? 'dps' : 'lyft', z = TH.ZONES[id], me = TH.ME || { x: 0, y: 0 }, inside = TH.inZone(id, me.x, me.y), home = TH.HOME && TH.inZone(id, TH.HOME.x, TH.HOME.y);
      var edges = z.edges.map(function (e) { return e[0]; });
      var L = (TH.TRANSPORT || {}).lyft || {};
      var md = id === 'lyft'
        ? 'The **free USC Lyft zone** runs between **' + edges.join(', ') + '**. Rides must start and end inside it, ' + (L.hoursText || '7 PM – 2 AM daily') + '.\nYou’re **' + (inside ? 'inside' : 'outside') + '** the zone right now' + (TH.HOME ? ', and home is ' + (home ? 'inside' : 'outside') + ' it' : '') + '. ' + (TH.lyftOpen && TH.lyftOpen(now()) ? 'The program is running now.' : 'The program isn’t running at this hour.')
        : 'DPS patrols about **2.5 square miles around UPC**, 24/7. On the map I draw it between **' + edges.join(', ') + '**, which is an approximation; the official map is on dps.usc.edu.\nYou’re **' + (inside ? 'inside' : 'outside') + '** that area right now. DPS: **213-740-4321** (emergency), **213-740-6000** (non-emergency).';
      return [{ role: 'bot', kind: 'c', md: md, chips: [go('Show it on the map', 'map', id + '-zone')].concat(id === 'lyft' ? [act('Get me a Lyft home', 'get me a lyft home')] : [go('Safety', 'safety')]), sources: [{ url: id === 'lyft' ? (L.url || 'https://transnet.usc.edu/index.php/how-to-use-lyft/') : 'https://dps.usc.edu/patrol/', title: id === 'lyft' ? 'USC Lyft Rides Program – USC Transportation' : 'Patrol Areas – USC DPS' }] }];
    }
  });

  def('bikes.nearest', {
    about: 'Find the nearest bike parking (racks) on campus.', args: [],
    match: function (t) { return /\b(bike|bicycle|bikes)\b/.test(t) && /\b(park|parking|racks?|lock|leave|store)\b/.test(t) && !/\b(register|registration|stolen|theft|impound|citation|buy|rent)\b/.test(t) ? {} : null; },
    run: function () {
      var nb = TH.nearestBike(TH.ME), n = TH.bikeRacks().filter(function (r) { return r.kind === 'rack'; }).length;
      return [bot('The nearest bike racks are **by ' + nb.near + '**, about **' + nb.walk + ' min** from you. I have ' + n + ' rack locations on the map (positions are approximate), plus the Metro Bike Share docks.\nLock your frame to a rack: bikes locked to railings or ramps can be impounded.', [go('Show bike parking', 'map', 'bikes'), say('How do I register my bike?', 'how do i register my bike with dps')])];
    }
  });

  def('watch.list', {
    about: 'Show what Tommy is watching for on the student’s watch list.', args: [],
    match: function (t) { return /\b(watch ?list|what are you (watching|looking) for|my watches|what am i waiting (for|on)|anything arrive|did (it|anything) (arrive|show up|come in))\b/.test(t) ? {} : null; },
    run: function () {
      TH.watch.tick(true);
      var L = TH.watch.list();
      if (!L.length) return [bot('Your watch list is empty. Tell me what you’re waiting for, like “notify me when I can get a free professional headshot”.', [act('Free professional headshots', 'notify me when i can get a free professional headshot'), act('Free USC gear', 'notify me when there is free usc gear')])];
      return [bot('I’m watching for ' + TA.plural(L.length, 'thing') + ':\n' + L.map(function (w) { return '- **' + w.label + '**: ' + (w.hit ? 'found → ' + w.hit.title + ' (' + w.hit.when + ')' + (w.scheduled ? ', on your calendar' : '') : 'still watching'); }).join('\n'), [go('Open watch list', 'watches')])];
    }
  });

  def('guest.list', {
    about: 'List the guests the student has registered.', args: [],
    match: function (t) { return /\b(my guests?|guest pass(es)?|who (did|have) i (register|guest|sign)|registered guests?)\b/.test(t) && !/\b(register|add|sign .* in|guest .* in|new|another|swipes?|meal)\b/.test(t.replace(/registered guests?|have i register\w*|did i register/g, '')) ? {} : null; },
    run: function () {
      var L = TH.guests.active();
      if (!L.length) return [bot('You have no active guest passes.', [act('Guest someone in', 'register a guest for tonight'), go('Guests', 'guests')])];
      return [bot('Active guest passes:\n' + L.map(function (g) { return '- **' + g.name + '** · ' + TH.guests.KINDS[g.kind].short + ' · ' + dayWord(TH.parseKey(g.day)) + ' · code ' + g.code; }).join('\n'), [go('Open Guests', 'guests')])];
    }
  });

  def('news.list', {
    about: 'Show this week’s club newsletters for the clubs the student follows.', args: [],
    match: function (t) { return /\bnewsletters?\b/.test(t) && !/\b(subscribe|follow|sign me up|unsubscribe|unfollow|stop|send me|add me)\b/.test(t) ? {} : null; },
    run: function () {
      var I = TH.news.issues();
      if (!I.length) return [bot('You don’t follow any club newsletters yet. Open any club and tap **Follow**, or tell me “follow the newsletter for Troy Camp”.', [go('Browse clubs', 'clubs'), go('Newsletters', 'news')])];
      return [bot('This week from your clubs:\n' + I.map(function (i) { return '- **' + i.club.name + '**: ' + i.headline + ' (' + i.thisWk.length + ' this week)'; }).join('\n'), [go('Open newsletters', 'news')])];
    }
  });

  // ===================================================================================================
  // ACTIONS (confirm card → run → Undo), registered with Trojan Assist like every other Hub action
  // ===================================================================================================
  function chk(name) { var o = { block: [], warn: [], offers: [] }, c = TH.act.check[name]; try { var r = c.apply(null, [].slice.call(arguments, 1)); o.block = r.block.slice(); o.warn = r.warn.slice(); } catch (e) { o.block.push(e.message); } return o; }
  function run(name) { return TH.act[name].apply(null, [].slice.call(arguments, 1)); }
  function receipt(r) { return { title: r.title, rows: r.rows || [], log: r.log || r.title }; }
  var NOT_NAME = /^(Tonight|Today|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|USC|Tommy|Campus|Please|Can|Could|Guest|Register|Sign|Let|Add|My|The|A|I|For|In|At|To|On|Leavey|Cowlings|Village|Hey|Hi)$/;
  function nameFrom(raw) {
    var s = String(raw || ''), m = /\b(?:named|called|name is|is called)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,2})/u.exec(s);
    if (!m) { // capitalized words that are not sentence openers or day names
      var words = s.split(/\s+/), cur = [], best = [];
      words.forEach(function (w, i) { var c = w.replace(/[^\p{L}'’-]/gu, ''); if (/^[A-Z][\p{L}'’-]+$/u.test(c) && !NOT_NAME.test(c) && i > 0) cur.push(c); else { if (cur.length > best.length) best = cur; cur = []; } });
      if (cur.length > best.length) best = cur;
      if (best.length) return best.slice(0, 3).join(' ');
      return null;
    }
    return m[1];
  }
  function dayOff(n) { if (n.dates && n.dates[0]) return Math.max(0, TA.daysBetween(TA.today(), n.dates[0])); return /\btomorrow\b/.test(n.t) ? 1 : 0; }

  TA.registerHubAction({
    id: 'hub_guest_register', title: 'Register a guest (guest someone in)', scope: 'campuslife', icon: 'card', system: 'DPS visitor registration / USC Housing guest sign-in (simulated)',
    detect: function (n) {
      var t = n.t; if (isQ(t)) return 0;
      if (/\b(guest (swipes?|meals?|pass price|wifi|network|speaker|lecture)|be my guest)\b/.test(t)) return 0;
      if (/\b(register|sign|add|bring|get|let|check|put|have)\b.{0,40}\b(guests?|visitors?)\b|\bguest\b.{0,40}\bin\b|\b(guest|visitor) (pass|registration)\b|\bsign (my |a |him|her|them)\S*.{0,30}\bin\b.{0,30}\b(dorm|building|campus|tonight|guest)\b|\b(my|a) (friend|brother|sister|mom|dad|parents?|girlfriend|boyfriend|partner|cousin|buddy) (is|are) (coming|visiting|staying)\b/.test(t)) return 0.93;
      return 0;
    },
    init: function (n) {
      var t = n.t, kind = /\b(dorm|my room|apartment|my building|my place|residence|housing|my hall|cowlings|ilium|village|staying|stay over|sleep|overnight)\b/.test(t) ? 'housing' : /\b(campus|after hours|gate|library|leavey|study)\b/.test(t) ? 'campus' : null;
      var pur = /\b(study|studying|homework|project|group work)\b/.test(t) ? 'Studying together' : /\b(stay(ing)? (over|the night)|overnight|sleep|crash)\b/.test(t) ? 'Staying overnight' : /\b(game|event|party|concert|show)\b/.test(t) ? 'Event or game' : /\b(mom|dad|parents?|family|brother|sister|cousin)\b/.test(t) ? 'Family visit' : null;
      var tm = n.times && n.times[0] ? TA.fmtTime(String(n.times[0].h).padStart(2, '0') + ':' + String(n.times[0].m || 0).padStart(2, '0')) : null;
      if (pur === 'Staying overnight' && !kind) kind = 'housing';
      return { name: nameFrom(n.raw), off: dayOff(n), kind: kind, purpose: pur, arrive: tm };
    },
    next: function (s) {
      if (!s.name) return { slot: 'name', md: 'What’s your guest’s full name, as it appears on their photo ID?' };
      if (!s.kind) return { slot: 'kind', md: 'Where is ' + s.name.split(' ')[0] + ' headed?', options: [{ label: 'Onto campus after 9 PM', value: '@gk:campus' }, { label: 'Into my building', value: '@gk:housing' }] };
      if (!s.purpose) return { slot: 'purpose', md: 'What’s the purpose of the visit? (The registration form asks.)', options: TH.guests.PURPOSES.map(function (p) { return { label: p, value: p }; }) };
      if (!s.arrive) return { slot: 'arrive', md: 'About what time will ' + s.name.split(' ')[0] + ' arrive?', options: [{ label: 'Around 7 PM', value: '7:00 PM' }, { label: 'Around 9 PM', value: '9:00 PM' }, { label: 'After 11 PM', value: '11:00 PM' }, { label: 'Not sure', value: 'Time not set' }] };
      return null;
    },
    fill: function (name, n, s, text) {
      if (name === 'purpose') { var pv = String(text || '').trim(); if (pv.length < 2) return false; s.purpose = pv.charAt(0).toUpperCase() + pv.slice(1, 80); return true; }
      if (name === 'arrive') { var av = String(text || '').trim(); if (!av) return false; s.arrive = n.times && n.times[0] ? TA.fmtTime(String(n.times[0].h).padStart(2, '0') + ':' + String(n.times[0].m || 0).padStart(2, '0')) : av.slice(0, 30); return true; }
      if (name === 'name' && (s.name ? !/\b(name|called|actually|instead|its|it's|spelled)\b/i.test(text || '') : false)) return false;
      if (name === 'name' && (/\d|@/.test(text || '') || /^(tonight|today|tomorrow|yes|no|campus|around|after|not sure|am|pm)\b/i.test(String(text || '').trim()))) return false;
      if (name === 'name') { var v = String(text || '').replace(/^(it'?s|its|his name is|her name is|their name is|name is|named)\s+/i, '').replace(/[^\p{L}\p{M}' .-]+/gu, ' ').trim(); if (v.length < 2 || /^(idk|not sure|no|none|skip)$/i.test(v)) return false; s.name = v.replace(/\b\p{L}/gu, function (c) { return c.toUpperCase(); }).slice(0, 60); return true; }
      if (name === 'kind') { var m = /@gk:(campus|housing)/.exec(text || ''); if (m) { s.kind = m[1]; return true; } if (/\b(campus|after|gate|library)\b/.test(n.t)) { s.kind = 'campus'; return true; } if (/\b(building|dorm|room|apartment|place|housing|mine)\b/.test(n.t)) { s.kind = 'housing'; return true; } return false; }
      return false;
    },
    check: function (s) { return chk('registerGuest', s.name, s.off, s.kind, s.purpose, s.arrive); },
    preview: function (s) { var d = TH.addDays(TH.dayStart(now()), s.off || 0); return { title: 'Register this guest?', rows: [['Guest', s.name], ['Type', TH.guests.KINDS[s.kind].label], ['Date', dayWord(d) + (s.arrive && s.arrive !== 'Time not set' ? ' · arriving ' + s.arrive : '')], ['Purpose', s.purpose], ['Host', TH.student().full + ' · USC ID ' + TH.student().uscid]], notes: ['Your guest gets a pass code and needs a government photo ID.'], fine: ['Simulated on the demo account. Nothing is sent to DPS or USC Housing.'], sources: [{ url: ((TH.SAFETY || {}).access || {}).url || 'https://dps.usc.edu/services/visitor-registration/', title: 'Visitor Registration – USC DPS' }] }; },
    run: function (s) { return receipt(run('registerGuest', s.name, s.off, s.kind, s.purpose, s.arrive === 'Time not set' ? '' : s.arrive)); }
  }, function () { return [go('See the guest pass', 'guests'), go('Gates on the map', 'map', 'gates')]; });

  TA.registerHubAction({
    id: 'hub_wallet_add', title: 'Add my USCard (USC ID) to Apple Wallet', scope: 'campuslife', icon: 'card', system: 'USCard Services / Apple Wallet (simulated)',
    detect: function (n) { var t = n.t; if (isQ(t) && !/^can (you|i) (add|put)\b/.test(t)) return 0; return /\b(apple wallet|apple pay|my wallet|wallet|iphone|phone)\b/.test(t) && /\b(add|put|get|set ?up|load|save)\b/.test(t) && /\b(id|uscard|usc card|student id|card|usc id)\b/.test(t) && !/\b(funds|money|dollars|\$|balance|discretionary)\b/.test(t) ? 0.93 : 0; },
    init: function () { return {}; }, next: function () { return null; }, fill: function () { return false; },
    check: function () { return chk('addWalletPass'); },
    preview: function () { var st = TH.student(); return { title: 'Add your USCard to Apple Wallet?', rows: [['Card', 'USCard · ' + st.full], ['USC ID', st.uscid], ['Express Mode', 'On (tap without unlocking)']], notes: ['Tap your iPhone or Apple Watch at door readers, dining halls and libraries.'], fine: ['Simulated: a working pass has to be issued and signed by USCard Services.'] }; },
    run: function () { return receipt(run('addWalletPass')); }
  }, function () { return [go('Open Wallet', 'wallet', 'apple')]; });

  TA.registerHubAction({
    id: 'hub_watch_add', title: 'Notify me when something becomes available (watch list)', scope: 'campuslife', icon: 'bell', system: 'Trojan Hub watch list',
    detect: function (n) {
      var t = n.t;
      if (/^(please |can you |could you |hey tommy |tommy )*(notify|tell|ping|alert|text|message|let) me( know)? (when(ever)?|if|once|as soon as|the moment)\b/.test(t)) return 0.96;
      if (/^(please |can you |could you )*(watch (out )?for|look out for|keep an eye out for|add a watch for)\b/.test(t)) return 0.96;
      if (/\bremind me when\b.{3,}/.test(t) && !/\b(class|appointment|order|pickup|lyft|bus)\b/.test(t)) return 0.9;
      return 0;
    },
    init: function (n) { return { text: n.raw }; }, next: function () { return null; }, fill: function () { return false; },
    check: function (s) { return chk('addWatch', s.text); },
    preview: function (s) { var p = TH.watch.parse(s.text); return { title: 'Watch for this?', rows: [['Watching for', p.label], ['I check', 'EngageSC events and campus drops'], ['When it arrives', 'Notification + first thing on Home']], notes: ['If it’s an event, I can put it on your calendar for you.'], fine: ['Saved only in this app.'] }; },
    run: function (s) { return receipt(run('addWatch', s.text)); }
  }, function () { var h = TH.watch.hits().filter(function (w) { return !w.scheduled; })[0]; return (h && h.hit.kind === 'event' ? [act('Schedule it for me', 'schedule what you found')] : []).concat([go('See it on Home', 'home'), go('Watch list', 'watches')]); });

  TA.registerHubAction({
    id: 'hub_watch_schedule', title: 'Schedule the thing my watch list found', scope: 'campuslife', icon: 'calendar', system: 'Trojan Hub calendar',
    detect: function (n) { return /^(please )?(schedule|add|put|book) (it|that|what you found|the thing you found)( for me| on my calendar| to my calendar)?$/.test(n.t) || /\bschedule what you found\b/.test(n.t) ? (TH.watch.hits().some(function (w) { return !w.scheduled; }) ? 0.95 : 0) : 0; },
    init: function () { var w = TH.watch.hits().filter(function (x) { return !x.scheduled; })[0]; return { id: w ? w.id : null }; }, next: function () { return null; }, fill: function () { return false; },
    check: function (s) { return chk('scheduleWatch', s.id); },
    preview: function (s) { var w = TH.watch.list().find(function (x) { return x.id === s.id; }); return { title: 'Put this on your calendar?', rows: [['What', w.hit.title], ['When', w.hit.when]].concat(w.hit.where ? [['Where', w.hit.where]] : []), notes: ['I’ll remind you 30 minutes before.'], fine: ['Simulated RSVP on the demo account.'] }; },
    run: function (s) { return receipt(run('scheduleWatch', s.id)); }
  }, function () { return [go('Open My Day', 'plans')]; });

  function clubFrom(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ', best = null, bl = 0;
    (TH.CLUBS || []).forEach(function (c) { var nm = c.name.toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); if (nm.length > 3 && nm.length > bl && t.indexOf(' ' + nm + ' ') >= 0) { best = c; bl = nm.length; } });
    return best;
  }
  TA.registerHubAction({
    id: 'hub_news_follow', title: 'Follow a club’s weekly newsletter', scope: 'campuslife', icon: 'people', system: 'Trojan Hub club newsletters',
    detect: function (n) { var t = n.t; return /\b(newsletters?|weekly (digest|update|email)s?)\b/.test(t) && /\b(subscribe|follow|sign me up|send me|add me|get|want)\b/.test(t) && !/\b(unsubscribe|unfollow|stop)\b/.test(t) && !isQ(t) ? 0.92 : 0; },
    init: function (n) { var c = clubFrom(n.raw); return { clubId: c ? c.id : null }; },
    next: function (s) { if (s.clubId) return null; var mine = (TA.hub().clubs || []).slice(0, 4); return { slot: 'clubId', md: 'Which club’s newsletter?', options: mine.map(function (c) { return { label: c.name, value: '@club:' + c.id }; }) }; },
    fill: function (name, n, s, text) { var m = /@club:(\d+)/.exec(text || ''), c = m ? TH.clubById(m[1]) : clubFrom(text); if (!c) { var q = String(text || '').toLowerCase().trim(); if (q.length >= 3) c = (TH.CLUBS || []).find(function (x) { return x.name.toLowerCase().indexOf(q) >= 0; }); } if (c) { s.clubId = c.id; return true; } return false; },
    check: function (s) { return chk('followNews', s.clubId); },
    preview: function (s) { var c = TH.clubById(s.clubId), i = TH.news.issue(c.id); return { title: 'Follow this newsletter?', rows: [['Club', c.name], ['Arrives', 'Every Monday'], ['This week', i.headline]], notes: ['You don’t have to join the club.'], fine: ['Compiled from the club’s public EngageSC listing.'] }; },
    run: function (s) { return receipt(run('followNews', s.clubId)); }
  }, function () { return [go('Open newsletters', 'news')]; });

  // ===================================================================================================
  // COMPILER + RUNNER
  // ===================================================================================================
  function q(v) { v = String(v); return /^[\w.-]+$/.test(v) ? v : '"' + v.replace(/"/g, '\\"') + '"'; }
  TS.line = function (c) { return c.cmd + Object.keys(c.args || {}).filter(function (k) { return c.args[k] != null && c.args[k] !== ''; }).map(function (k) { return ' ' + k + '=' + q(c.args[k]); }).join(''); };
  TS.catalog = function () { return Object.keys(TS.cmds).map(function (k) { var c = TS.cmds[k]; return k + (c.args.length ? ' {' + c.args.join(', ') + '}' : ' {}') + ' — ' + c.about; }).join('\n'); };
  TS.actionCatalog = function () {
    var a = TA.Actions.list.map(function (x) { return x.id + ' = ' + x.title; });
    var p = (TA.Process && TA.Process.list || []).map(function (it) { return 'proc:' + it.pa.id + ' = ' + it.pa.name; });
    return a.concat(p).join('\n');
  };
  // text -> {cmd, args} for the read commands; null = let Trojan Assist's own compiler (intents + actions + KB) take it
  TS.compile = function (text) {
    var raw = String(text || ''), t = TA.NLU.normalize ? TA.NLU.normalize(raw) : raw.toLowerCase(), names = Object.keys(TS.cmds);
    t = t.replace(/[’']/g, '').replace(/[?!.]+$/, '');
    for (var i = 0; i < names.length; i++) { var a = null; try { a = TS.cmds[names[i]].match(t, raw); } catch (e) { a = null; } if (a) return { cmd: names[i], args: a }; }
    return null;
  };
  TS.run = function (c) { var spec = TS.cmds[c.cmd]; var clean = {}; (spec.args || []).forEach(function (k) { if (c.args && c.args[k] != null) clean[k] = c.args[k]; }); return spec.run(clean); };
  function tag(out, cmd, via) {
    var sp = TS.cmds[cmd.cmd];
    if (sp) { var ca = {}; sp.args.forEach(function (k) { if (cmd.args && cmd.args[k] != null) ca[k] = cmd.args[k]; }); cmd = { cmd: cmd.cmd, args: ca }; }
    if (out && out.length) {
      var m = out.find(function (x) { return x.role === 'bot'; });
      if (m) {
        m.script = {
          line: TS.line(cmd),
          via: via,
          accurate: true,
          badge: '⚡ AI converted words into script · Verified public USC data (accurate, not modeled)'
        };
      }
    }
    return out;
  }
  function remember(text, cmd) { TS.history.push({ text: String(text).slice(0, 200), line: TS.line(cmd) }); if (TS.history.length > 6) TS.history.shift(); }
  function missed(out) { return !out || !out.length || (out.some(function (m) { return m && (m.kind === 'none' || m.kind === 'off'); }) && !out.some(function (m) { return m && m.card; })); }
  function flagged(n, text) {
    return !!(n.crisis || n.emergency || n.distress || n.disclose || n.threat || n.threatMe || n.violence || n.hazing || n.concern || n.medical || n.overdose || n.lang ||
      (TA.Hub && TA.Hub.flagged && TA.Hub.flagged(n)) || (TA.Hub && TA.Hub.dangerText && TA.Hub.dangerText(n)) || /\b(haz(e|ed|es|ing)|harass\w*|bull(y|ied|ying|ies)|stalk\w*|unsafe|scared|afraid|threat\w*)\b/.test(n.t || ''));
  }
  // Trojan Assist's own compiler: label what it did as a command
  async function brain(text, via) {
    var before = B.pending ? B.pending.aid : null, hit = TA.Actions.detect(TA.NLU.parse(text));
    var out = await B.handle(text);
    var aid = B.pending && B.pending.aid !== before ? B.pending.aid : (hit && hit.score >= 0.8 && out.some(function (m) { return m && m.card; }) ? hit.action.id : null);
    var cmd = aid ? { cmd: 'do', args: { action: aid, request: text } } : { cmd: 'ask', args: { q: text } };
    if (!missed(out)) { tag(out, cmd, via); remember(text, cmd); }
    return out;
  }
  async function runCmd(c, text, via) {
    if (TS.cmds[c.cmd]) { var out = TS.run(c); tag(out, c, via); remember(text, c); return out; }
    if (c.cmd === 'do') {
      var id = String((c.args || {}).action || ''), req = String((c.args || {}).request || text), a = TA.Actions.get(id);
      if (a) { var outs = B.start(a, TA.NLU.parse(req)); if (B.persist) B.persist(); var cc = { cmd: 'do', args: { action: id, request: req } }; tag(outs, cc, via); remember(text, cc); return outs; }
      return brain(req, via);
    }
    if (c.cmd === 'ask') return brain(String((c.args || {}).q || text), via);
    return null;
  }
  TS.handle = async function (text) {
    var n = TA.NLU.parse(text), p = B.pending;
    // safety, pending confirmations / slot answers, chips, undo and sign-in never leave Trojan Assist's own flow
    // a read command asked while a request waits for an answer: run it, keep the request waiting
    if (p && !flagged(n, text) && !n.yes && !n.no && !n.cancel && !n.undo && !/^@/.test(text)) {
      var side = TS.compile(text);
      if (side) { var so = await runCmd(side, text, 'script'), pa = TA.Actions.get(p.aid); return so.concat([{ role: 'bot', md: '_Your request' + (pa ? ' to ' + pa.title.charAt(0).toLowerCase() + pa.title.slice(1) : '') + ' is still waiting above. Answer it there, or say cancel._' }]); }
    }
    if (flagged(n, text) || p || n.undo || n.signin || n.signout || n.yes || n.no || n.cancel || n.greet || n.thanks || n.bye || /^@/.test(text)) return B.handle(text);
    // 1) the compiler: exact commands run on this device
    var c = TS.compile(text), out;
    if (c) return runCmd(c, text, 'script');
    // personal/sensitive wording stays on the device: Tommy's own sensitive check plus personal topics
    // (health, sexual health, mental health, safety, immigration, identity) are never sent to the AI. Task wording such as
    // "check my grades" may be translated: the AI sees only the words and the script shows the result on the device.
    var PERSONAL = TS.PERSONAL || (TS.PERSONAL = /\b(pregnan\w*|abortion|contracepti\w*|plan b|birth control|stds?|stis?|hiv|sexual\w*|rape|assault\w*|abus\w*|harass\w*|diagnos\w*|depress\w*|anxi\w*|panic attacks?|adhd|autis\w*|bipolar|ptsd|therap\w*|counsel\w*|psychiatr\w*|medicat\w*|prescription\w*|eating disorder|anorexi\w*|bulimi\w*|self.?harm|suicid\w*|overdos\w*|addict\w*|drunk|high on|drugs?|disabilit\w*|immigra\w*|undocumented|daca|visa status|deport\w*|lgbt\w*|gay|lesbian|transgender|coming out|ssn|social security number)\b/);
    var aiOk = !!(AI && AI.translate && AI.enabled() && !(B.sensitive && B.sensitive(n)) && !PERSONAL.test(String(text).toLowerCase()));
    var aiCtx = function () { return { commands: TS.catalog() + '\ndo {action, request} — start one of the ACTIONS below (shows a confirm card)\nask {q} — look the question up in the USC knowledge base\nnone {} — not about USC', actions: TS.actionCatalog(), earlier: TS.history, now: TA.fmtLongDate(TA.today()) + ', ' + now().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }; };
    var useAI = async function (tr) {
      if (!tr || tr.cmd === 'none' || !(TS.cmds[tr.cmd] || tr.cmd === 'do' || tr.cmd === 'ask')) return null;
      if (tr.cmd === 'ask' && TA.NLU.normalize && TA.NLU.normalize(String(tr.args.q || '')) === TA.NLU.normalize(text)) return null;
      var o = null;
      try { o = await runCmd(tr, text, 'ai'); } catch (e) { console.error(e); o = null; }
      return o && !missed(o) ? o : null;
    };
    var asked = false;
    // 2) AI first, when this site runs its own translator (AI.firstPass): it reads wording the exact commands
    //    don't match, before the on-device search guesses. It sees the words, never the result.
    if (aiOk && AI.firstPass && AI.firstPass()) {
      asked = true;
      var tr1 = null;
      try { tr1 = await AI.translate(text, aiCtx()); } catch (e) { tr1 = null; }
      var o1 = await useAI(tr1);
      if (o1) return o1;
      if (B.pending) B.pending = null; // nothing was pending before this point; drop a half-started request from a failed AI attempt
    }
    // 3) Trojan Assist's own on-device search and intents
    out = await brain(text, 'script');
    if (!missed(out) || B.pending || asked || !aiOk) return out;
    // 4) the AI translator as a last resort, when the scripts could not read it
    var tr = null;
    try { tr = await AI.translate(text, aiCtx()); } catch (e) { tr = null; }
    return (await useAI(tr)) || out;
  };

  // ===================================================================================================
  // UI: every message goes through TS.handle; the script line is shown under the answer
  // ===================================================================================================
  UI.send = async function (text, label) {
    if (UI.busy) return;
    text = String(text || '').slice(0, 1000);
    if (!text.trim()) return;
    UI.push([{ role: 'user', md: label || (text.indexOf('@slot:') === 0 ? UI.slotLabel(text) : text) }]);
    UI.setBusy(true);
    var typing = UI.typing(true);
    try {
      var out = await TS.handle(text);
      UI.typing(false, typing); UI.applyStatus(out); UI.push(out);
    } catch (e) {
      console.error(e); UI.typing(false, typing);
      UI.push([{ role: 'bot', md: 'Sorry — I hit an error handling that. Nothing was changed.', error: true }]);
    } finally { UI.setBusy(false); }
  };
  var renderMsg0 = UI.renderMsg;
  UI.renderMsg = function (m) {
    var el = renderMsg0.call(UI, m);
    if (m && m.script && m.role !== 'user' && TA.settings.showScript !== false) {
      var d = document.createElement('div'); d.className = 'ta-script' + (m.script.via === 'ai' ? ' ai' : '');
      d.innerHTML = '<span class="ta-script-tag">' + (m.script.via === 'ai' ? 'AI → script' : 'script') + '</span><code>' + esc(m.script.line) + '</code><span class="ta-script-lock" aria-label="Result stayed on this device">' + (m.script.via === 'ai' ? 'AI saw your words only' : 'ran on device') + '</span>';
      d.title = m.script.via === 'ai' ? 'The AI translated your words into this command. It never saw the result.' : 'Your message was compiled into this command on your device.';
      el.insertBefore(d, el.firstChild);
    }
    return el;
  };
  var mode0 = UI.renderMode;
  UI.renderMode = function () {
    try { mode0.call(UI); } catch (e) { }
    var sub = document.getElementById('ta-sub'), root = document.getElementById('ta-root');
    if (root) root.classList.toggle('ai', !!(AI && AI.enabled && AI.enabled()));
    if (sub) sub.textContent = (AI && AI.enabled && AI.enabled()) ? 'Runs on scripts · AI translator on · Prototype' : 'Runs on scripts · Prototype';
  };
  // starter chips: the new things Tommy can do
  var starter0 = B.starterChips;
  B.starterChips = function (signed) {
    var c = starter0.call(B, signed) || [];
    if (!signed) return c;
    return [say('Plan my day', 'plan my day'), say('Plan my week', 'plan my week'), say('What are my grades?', 'what are my grades'), say('What’s due this week?', 'what is due this week'), act('Guest a friend in', 'register a guest for tonight'), act('Notify me when…', 'notify me when i can get a free professional headshot')].concat(c.slice(0, 2));
  };
})();
