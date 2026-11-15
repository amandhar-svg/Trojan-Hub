#!/usr/bin/env python3
"""Ask Tommy's routing: use the AI ONLY when Tommy's own scripts can't accurately recognize the message.

Edits <project>/js/ta/script.js (TS.handle). Order after the patch:
  1. Tommy Script commands (TS.compile): exact matches run on this device.
  2. Trojan Assist's own on-device answers (intents, actions, curated USC answers) via brain().
  3. Only if that answer is missing or weak (B.r4Unanswered: "couldn't find", off-topic refusal, closest-match
     guess): the AI translator turns the words into ONE script command, which then runs on this device.
     The AI never sees results. Crisis, safety, pending requests and greetings never get here (handled above),
     and personal or help/need wording never goes to the AI.
  4. If no script fits: AI.uscSearch (when the site provides it) searches USC websites only and records that a
     new script is needed; otherwise Tommy's own answer stands.
Usage: python3 patch_ai_route.py /home/user/trojan-hub-v4   (idempotent)"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/home/user/trojan-hub-v4')
p = root / 'js' / 'ta' / 'script.js'
s = p.read_text(encoding='utf-8')
if 'TS.weak = ' in s:
    print('already patched:', p); sys.exit(0)

start = s.index("    // 1) the compiler\n    var c = TS.compile(text), out;")
end_marker = "    return out2 && !missed(out2) ? out2 : out;\n  };\n"
end = s.index(end_marker, start) + len(end_marker)
old = s[start:end]
a = old.index('tr = await AI.translate(text, ') + len('tr = await AI.translate(text, ')
b = old.index('); } catch (e) { tr = null; }', a)
ctx_expr = old[a:b]

new = """    // 1) Tommy's own scripts: exact commands run on this device
    var c = TS.compile(text), out;
    if (c) return runCmd(c, text, 'script');
    // 2) Tommy's own on-device answers (intents, actions, curated USC answers)
    out = await brain(text, 'script');
    if (!TS.weak(out) || B.pending) return out;
    // 3) The scripts couldn't recognize it accurately: only now may the AI turn the words into ONE script command.
    //    Personal topics and help/need wording stay on this device (Tommy's own answer stands).
    var PERSONAL = TS.PERSONAL || (TS.PERSONAL = /\\b(pregnan\\w*|abortion|contracepti\\w*|plan b|birth control|stds?|stis?|hiv|sexual\\w*|rape|assault\\w*|abus\\w*|harass\\w*|diagnos\\w*|depress\\w*|anxi\\w*|panic attacks?|adhd|autis\\w*|bipolar|ptsd|therap\\w*|counsel\\w*|psychiatr\\w*|medicat\\w*|prescription\\w*|eating disorder|anorexi\\w*|bulimi\\w*|self.?harm|suicid\\w*|overdos\\w*|addict\\w*|drunk|high on|drugs?|disabilit\\w*|immigra\\w*|undocumented|daca|visa status|deport\\w*|lgbt\\w*|gay|lesbian|transgender|coming out|ssn|social security number)\\b/);
    var tn = (TA.NLU.normalize ? TA.NLU.normalize(String(text)) : String(text).toLowerCase()).replace(/[\\u2019']/g, '');
    var needsHelp = typeof helpCue === 'function' && helpCue(tn);
    if (!AI || !AI.translate || !AI.enabled() || (B.sensitive && B.sensitive(n)) || PERSONAL.test(String(text).toLowerCase()) || needsHelp) return out;
    var tr = null;
    try { tr = await AI.translate(text, """ + ctx_expr + """); } catch (e) { tr = null; }
    if (tr && tr.cmd !== 'none' && (TS.cmds[tr.cmd] || tr.cmd === 'do' || tr.cmd === 'ask') &&
        !(tr.cmd === 'ask' && TA.NLU.normalize && TA.NLU.normalize(String(tr.args.q || '')) === TA.NLU.normalize(text))) {
      var out2 = null;
      try { out2 = await runCmd(tr, text, 'ai'); } catch (e) { console.error(e); out2 = null; }
      if (out2 && !TS.weak(out2)) return out2;
    }
    // 4) No script fits: search USC websites only (when this site provides it) and record that a script is needed.
    if (AI.uscSearch) {
      var q = tr && tr.cmd === 'ask' && tr.args && tr.args.q ? String(tr.args.q) : String(text);
      var found = null;
      try { found = await AI.uscSearch(q, text); } catch (e) { found = null; }
      if (found && found.length) return found;
    }
    return out;
  };
  // an answer that didn't really answer: nothing, "couldn't find", an off-topic refusal or a closest-match guess
  TS.weak = function (out) { return missed(out) || !!(B.r4Unanswered && B.r4Unanswered(out) && !(out || []).some(function (m) { return m && m.card; })); };
"""
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')
print('patched:', p)
