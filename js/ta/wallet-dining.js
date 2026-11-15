/* js/ta/wallet-dining.js — Dining Dollars pace (Part 7).
 *
 * TH.ddPace() → the numbers the Wallet card, its detail sheet and Tommy share:
 *   { balance, planName, included, blocks, start, deadline, deadlineLabel, daysLeft, needPerDay,
 *     recent:[{at, where, amount, sim}], recentDays, recentSum, pacePerDay, projectedLeft, runOutDate, onTrack,
 *     classesEnd, needByClassesEnd, rules, sources }
 * Tommy Script command wallet.dining {} answers "how much should I spend on dining dollars per day",
 * "am I on track with my dining dollars", "dining dollars per day". It runs on this device from the demo
 * account; it's an account answer, never the AI.
 *
 * Truthfulness:
 * - The balance and plan come from the demo account (TA.State.d.dining). Picked-up mobile orders are real
 *   simulated debits. The other purchases in the "recent" list are SIMULATED (the demo account stores no card
 *   history), use the app's sample menu prices at venues where the app's own mobile order already charges
 *   Dining Dollars, and are labeled Simulated; the spending pace built on them is labeled Est.
 * - USC publishes no separate Dining Dollars cutoff date. USC Hospitality says Flex/Trojan/block Dining Dollars
 *   don't roll over and are forfeited at the end (last day) of the semester; we use the Fall 2026 semester end
 *   from USC's academic calendar (finals end Wed, Dec 16, 2026; TA.POLICY.cal) and say so.
 * Load after js/ta/course-info.js.
 */
(function () {
  'use strict';
  var TH = window.TH || (window.TH = {});
  var TA = window.TA;
  var DAY = 864e5;

  var SOURCES = [
    { url: 'https://hospitality.usc.edu/frequently-asked-questions/', title: 'USC Hospitality – Frequently asked questions' },
    { url: 'https://hospitality.usc.edu/meal-plan-options/', title: 'USC Hospitality – Meal plan options' },
    { url: 'https://mycard.usc.edu/meal-plans/', title: 'USCard Services – Meal plans' },
    { url: 'https://www.usc.edu/academic-calendar/', title: 'USC Academic Calendar (Fall 2026 finals end Dec 16)' }
  ];
  var RULES = [
    'Dining Dollars on the Trojan Plan, Flex120 Plan and Dining Dollar Blocks don’t roll over and aren’t refunded.',
    'Unused Flex120 Dining Dollars are forfeited at the end of the semester; block Dining Dollars on the last day of the semester.',
    'USC doesn’t publish a separate Dining Dollars cutoff date, so this uses the last day of the Fall 2026 semester: finals end Wed, Dec 16, 2026 (USC academic calendar).',
    'You can donate unused Dining Dollars to USC programs for food-insecure students. Your separate USCard discretionary balance does roll over.'
  ];

  function pol() { return (TA && TA.POLICY) || {}; }
  function D() { return TA && TA.State && TA.State.d; }
  function now() { return TH.clock ? TH.clock.now() : new Date(); }
  function dayStart(d) { return TH.dayStart ? TH.dayStart(d) : new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function key(s) { return TH.parseKey ? TH.parseKey(s) : new Date(s + 'T00:00:00'); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function seed(str) { var s = 0; for (var i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // the semester's last day from TA.POLICY.cal ("Dec 9–16, 2026" → Dec 16, 2026)
  function semesterEnd(cal) {
    var m = String(cal.finals || '').match(/([A-Z][a-z]{2})\w*\s+(\d+)\s*[–-]\s*(?:([A-Z][a-z]{2})\w*\s+)?(\d+),\s*(\d{4})/);
    if (!m) return cal.classesEnd ? key(cal.classesEnd) : null;
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[3] || m[1]);
    return new Date(+m[5], mon, +m[4]);
  }
  function includedDD(plan) {
    if (!plan) return 0;
    var m = String(plan.short || '').match(/\$([\d,]+)\s*(worth of\s*)?Dining Dollars/i);
    return m ? +m[1].replace(/,/g, '') : 0;
  }
  function fmtDay(d) { return TH.fmtDate ? TH.fmtDate(d) : d.toDateString().slice(0, 10); }
  function money(n) { return TH.money ? TH.money(n) : '$' + (+n).toFixed(2); }

  // Simulated recent purchases (deterministic for the demo date) + real simulated mobile-order pickups.
  function recentTx(days, maxTotal) {
    var t0 = dayStart(now()), from = new Date(t0.getTime() - days * DAY), out = [];
    var hubOrders = (TH.H && D() ? (TH.H().orders || []) : []);
    hubOrders.forEach(function (o) {
      if (o && o.state === 'picked' && o.pickedAt && o.pickedAt >= from.getTime()) out.push({ at: new Date(o.pickedAt), where: placeName(o.at), amount: +o.total || 0, sim: false, order: o.code });
    });
    var venues = (TH.PLACES || []).filter(function (p) { return p.order && (TH.ORDER_MENUS || {})[p.id]; });
    if (venues.length) {
      var rnd = seed('dd|' + (TH.dkey ? TH.dkey(t0) : t0.toDateString())), sum = 0, n = 4;
      for (var i = 0; i < n; i++) {
        var back = 1 + Math.floor(rnd() * (days - 1)), v = venues[Math.floor(rnd() * venues.length)], menu = TH.ORDER_MENUS[v.id];
        var pick = menu.filter(function (it, j) { return j === 0 ? rnd() < 0.45 : rnd() < 0.6; });
        if (!pick.length) pick = [menu[menu.length - 1]];
        var amt = r2(pick.reduce(function (s, it) { return s + (+it[1] || 0); }, 0));
        if (sum + amt > maxTotal) continue;
        sum += amt;
        var at = new Date(t0.getTime() - back * DAY + (11 + Math.floor(rnd() * 8)) * 3600e3 + Math.floor(rnd() * 4) * 15 * 60e3);
        out.push({ at: at, where: v.name.replace(/ \(.*\)/, ''), amount: amt, sim: true, items: pick.map(function (it) { return String(it[0]).replace(/ \(sample item\)/, ''); }) });
      }
    }
    return out.sort(function (a, b) { return b.at - a.at; });
  }
  function placeName(id) { var p = (TH.byId || {})[id]; return p ? p.name.replace(/ \(.*\)/, '') : String(id || 'Mobile order'); }

  TH.ddPace = function () {
    var d = D(), dn = (d && d.dining) || {}, P = pol(), term = (P.terms && P.terms.current && P.terms.current.code) || '20263';
    var cal = (P.cal || {})[term] || {}, plan = (TA && TA.State && TA.State.mealPlan) ? TA.State.mealPlan() : null;
    var balance = +dn.diningDollars || 0, blocks = (dn.ddBlocks || []).reduce(function (s, b) { return s + (+b.amount || 0); }, 0);
    var included = includedDD(plan), today = dayStart(now());
    var start = cal.classesBegin ? key(cal.classesBegin) : null, deadline = semesterEnd(cal);
    var classesEnd = cal.classesEnd ? key(cal.classesEnd) : null;
    var daysLeft = deadline ? Math.max(0, Math.round((deadline - today) / DAY) + 1) : null; // today through the last day
    var daysToClassesEnd = classesEnd ? Math.max(0, Math.round((classesEnd - today) / DAY) + 1) : null;
    var spentAll = Math.max(0, r2(included + blocks - balance));
    var RECENT = 14, recent = recentTx(RECENT, Math.min(spentAll, 40));
    var recentSum = r2(recent.reduce(function (s, x) { return s + x.amount; }, 0));
    var pace = r2(recentSum / RECENT);
    var need = daysLeft ? r2(balance / daysLeft) : null;
    var projectedLeft = daysLeft != null ? Math.max(0, r2(balance - pace * daysLeft)) : null;
    var runOut = pace > 0 ? new Date(today.getTime() + Math.ceil(balance / pace) * DAY) : null;
    return {
      balance: balance, planName: plan ? plan.name : (dn.plan || 'Meal plan'), included: included, blocks: blocks, spentAll: spentAll,
      start: start, deadline: deadline, deadlineLabel: deadline ? fmtDay(deadline) : 'not published',
      daysLeft: daysLeft, needPerDay: need, recent: recent, recentDays: RECENT, recentSum: recentSum, pacePerDay: pace,
      projectedLeft: projectedLeft, runOutDate: runOut, onTrack: need != null && pace >= need - 0.005,
      classesEnd: classesEnd, needByClassesEnd: daysToClassesEnd ? r2(balance / daysToClassesEnd) : null, daysToClassesEnd: daysToClassesEnd,
      semesterPct: start && deadline ? Math.max(0, Math.min(100, Math.round((today - start) / (deadline - start) * 100))) : null,
      usedPct: included + blocks > 0 ? Math.max(0, Math.min(100, Math.round(spentAll / (included + blocks) * 100))) : null,
      rules: RULES, sources: SOURCES
    };
  };
  TH.ddPace.SOURCES = SOURCES;
  TH.ddPace.RULES = RULES;

  // ---------- Tommy Script: wallet.dining ----------
  var TS = TA && TA.Script;
  if (!TS || !TS.cmds) return;
  var DD = /\b(dining dollars?|diningdollars|dining dollar balance|dd|dds|dining money)\b/;
  var PACE = /\b(per day|a day|each day|every day|daily|per week|a week|on track|pace|how much (should|can|do) i (spend|use)|spend(ing)?\b.*\b(day|week|rest|left)|use (them|it|they|my|all|up)|run out|running out|last (me|until|till|through)|left over|leftover|burn|budget|enough)\b/;
  function bot(md, chips, sources) { return { role: 'bot', kind: 'c', md: md, chips: chips || [], sources: sources || SOURCES }; }
  function go(label, screen, arg) { return { label: label, value: '@go:' + screen + (arg != null ? ':' + arg : ''), kind: '' }; }
  function say(label, value) { return { label: label, value: value || label.toLowerCase(), kind: '' }; }

  TS.cmds['wallet.dining'] = {
    name: 'wallet.dining',
    about: 'DINING DOLLARS PACE for the student’s own account: balance, how much they spend per day now (Est., from recent purchases) and how much per day they must spend to use the rest before Dining Dollars are forfeited at the end of the semester. Use for "how much should I spend on dining dollars per day", "am I on track with my dining dollars", "will my dining dollars run out", "dining dollars per day". No args.',
    args: [],
    match: function (t) {
      if (!DD.test(t)) return null;
      if (/\b(add|buy|purchase|load|top up|top-up|block)\b/.test(t) && !/\b(should i|do i need|need to)\b/.test(t)) return null;
      if (/\b(roll ?over|refund|transfer|donate|what are|where can|accepted|take dining)\b/.test(t) && !PACE.test(t)) return null;
      return PACE.test(t) ? {} : null;
    },
    run: function () {
      if (!TA.State || !TA.State.d || !TA.State.d.dining) return [bot('I can’t see a meal plan on this account.')];
      // account answer: respect an explicit sign-out (Trojan Hub otherwise signs Tommy in as the demo student)
      if (!TA.State.d.signedIn && TA.store && TA.store.get && TA.store.get('hubSignedOut', false)) return [bot('Sign in so I can check your Dining Dollars balance and pace. You signed out, so I can’t see your account right now.', [say('Sign in', 'sign in')])];
      var p = TH.ddPace(), m = money;
      if (p.balance <= 0) return [bot('You have **' + m(0) + '** Dining Dollars left on your ' + p.planName + ', so there’s nothing to pace. You can add a $250 or $500 block (10% off) if you need more.', [go('Open Wallet', 'wallet')])];
      var status = p.onTrack
        ? 'You’re **on track**: at your recent pace you’d use it all' + (p.runOutDate && p.deadline && p.runOutDate < p.deadline ? ' by about **' + fmtDay(p.runOutDate) + '**' : '') + '.'
        : 'At your recent pace you’d leave about **' + m(p.projectedLeft) + '** unused on ' + p.deadlineLabel + '. Spend about **' + m(Math.max(0, p.needPerDay - p.pacePerDay)) + ' more per day** to use it all.';
      var md = 'You have **' + m(p.balance) + '** Dining Dollars on your ' + p.planName + '.\n\n' +
        '- **Spending now: ' + m(p.pacePerDay) + ' per day (Est.)**, the average over the last ' + p.recentDays + ' days (' + m(p.recentSum) + ' in ' + p.recent.length + ' purchase' + (p.recent.length === 1 ? '' : 's') + ').\n' +
        '- **To use it all by ' + p.deadlineLabel + ': ' + m(p.needPerDay) + ' per day** (' + p.daysLeft + ' days, counting today).\n' +
        (p.needByClassesEnd ? '- Regular dining hall hours and classes end ' + fmtDay(p.classesEnd) + '; to finish by then it’s ' + m(p.needByClassesEnd) + ' per day.\n' : '') +
        '\n' + status +
        '\n\n**Why that deadline:** Dining Dollars on Flex120, the Trojan Plan and blocks don’t roll over and aren’t refunded; they’re forfeited at the end of the semester. USC doesn’t list a separate cutoff date, so I used the last day of Fall 2026 (finals end Dec 16, USC academic calendar).' +
        '\n\n_Your balance is from the demo account. The recent purchases are simulated (sample menu prices), so the pace is an estimate._';
      return [bot(md, [go('Open Wallet', 'wallet', 'dd'), say('Do they roll over?', 'do dining dollars roll over'), say('Where can I use them?', 'where can i use dining dollars')])];
    }
  };
})();
