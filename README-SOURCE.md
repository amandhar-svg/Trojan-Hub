# Trojan Hub — source (branch `source`)

This branch holds the **source** of the Trojan Hub app. The live site (trojanhub.netlify.app) deploys from `main`, which holds the built single-file app (`site/index.html`) plus Tommy's Netlify Function. Nothing on this branch deploys.

- `template.html`: the page. Every inline `<script>`/`<style>` body is `@@FILE:<path>@@`, and the load order is the order in this file. Later files often wrap earlier `TH.screens.*` / `TH.open*` / `TA.Script.handle`.
- `python3 scripts/build.py [out.html]`: builds the single self-contained file (default `dist/trojan-hub.html`, about 19.6 MB).
- `node scripts/build-netlify.cjs --project . --out ./netlify-site`: builds the deployable Netlify folder (app, function, generated translator prompt).
- `js/ta/*`: **Ask Tommy** (Trojan Assist engine). `js/ta/script.js` holds Tommy Script commands (`TA.Script.cmds`). `js/ta/course-info.js` (`course.who`) is an example of a command added from its own file. `js/ta/ai-api.js` is the AI translator on this site's Netlify Function.
- `data/kb.json.gz`: Tommy's USC knowledge base (31,282 docs from USC sites, built 2026-11-09; `docs[]` items with `t` type, `id`, `ti` title, `q` question paraphrases, text and source URL fields). `data/soc.json.gz`: USC Schedule of Classes, Fall 2026 and Spring 2027.
- `data/research/facts`: sourced USC facts (places, hours, transport, safety). `data/research/tacode`: notes on the Trojan Assist code.
- `P6-CONTRACT.md`: the project's rules (truthfulness, simulated labels, safety). `SAFETY-PHRASES.json`: crisis and emergency regression phrases that must keep passing.

Demo: date pinned to Mon Nov 9, 2026 (campus time); demo student Jordan Rivera (CS sophomore). All account state is in `TH.H()` (`TA.State.d.hub`, friend's extras in `TH.H().x`).
