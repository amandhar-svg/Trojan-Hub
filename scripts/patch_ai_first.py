#!/usr/bin/env python3
"""Let Ask Tommy ask the AI translator FIRST for wording that isn't an exact Tommy command.

Edits <project>/js/ta/script.js (TS.handle). Before: compiler -> on-device search (brain) -> AI only if the
search found nothing. After, when AI.firstPass() is true (this site's own Claude API, see js/ta/ai-api.js):
compiler -> AI translator -> on-device search. Exact commands stay on the device; safety, pending requests,
greetings and sensitive wording are handled before this point and never reach the AI.
Usage: python3 patch_ai_first.py /home/user/trojan-hub-v4   (idempotent)"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/home/user/trojan-hub-v4')
p = root / 'js' / 'ta' / 'script.js'
s = p.read_text(encoding='utf-8')
if 'AI.firstPass' in s:
    print('already patched:', p); sys.exit(0)

start = s.index("    // 1) the compiler\n    var c = TS.compile(text), out;")
end_marker = "    return out2 && !missed(out2) ? out2 : out;\n  };\n"
end = s.index(end_marker, start) + len(end_marker)
old = s[start:end]
# keep the exact translator context the original code builds (catalogue + actions + history + time)
a = old.index('tr = await AI.translate(text, ') + len('tr = await AI.translate(text, ')
b = old.index('); } catch (e) { tr = null; }', a)
ctx_expr = old[a:b]

new = """    // 1) the compiler: exact commands run on this device
    var c = TS.compile(text), out;
    if (c) return runCmd(c, text, 'script');
    // personal/sensitive wording stays on the device: Tommy's own sensitive check plus personal topics
    // (health, sexual health, mental health, safety, immigration, identity) are never sent to the AI. Task wording such as
    // "check my grades" may be translated: the AI sees only the words and the script shows the result on the device.
    var PERSONAL = TS.PERSONAL || (TS.PERSONAL = /\\b(pregnan\\w*|abortion|contracepti\\w*|plan b|birth control|stds?|stis?|hiv|sexual\\w*|rape|assault\\w*|abus\\w*|harass\\w*|diagnos\\w*|depress\\w*|anxi\\w*|panic attacks?|adhd|autis\\w*|bipolar|ptsd|therap\\w*|counsel\\w*|psychiatr\\w*|medicat\\w*|prescription\\w*|eating disorder|anorexi\\w*|bulimi\\w*|self.?harm|suicid\\w*|overdos\\w*|addict\\w*|drunk|high on|drugs?|disabilit\\w*|immigra\\w*|undocumented|daca|visa status|deport\\w*|lgbt\\w*|gay|lesbian|transgender|coming out|ssn|social security number)\\b/);
    var aiOk = !!(AI && AI.translate && AI.enabled() && !(B.sensitive && B.sensitive(n)) && !PERSONAL.test(String(text).toLowerCase()));
    var aiCtx = function () { return """ + ctx_expr + """; };
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
"""
s = s[:start] + new + s[end:]
p.write_text(s, encoding='utf-8')
print('patched:', p)
