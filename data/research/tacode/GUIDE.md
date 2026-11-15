# Embedding Trojan Assist as "Ask Tommy" in Trojan Hub

Integration guide for the `tacode` task. It was written from a read-only study of `/home/user/ta-src` and `/home/user/trojan-hub`. The working parts were then built and run in headless Chromium against the real TA source and the real EngageSC data in `research/clubs`. Nothing under `trojan-hub/js`, `trojan-hub/css`, `index.html` or `ta-src` was changed.

Unless noted otherwise, line numbers refer to `/home/user/ta-src/app.html` (8,087 lines) and `/home/user/ta-src/head.html` (466 lines).

**Reference code** (tested, ready to copy) is in `research/tacode/ref/`:

| File | Purpose | Status |
|---|---|---|
| `ref/build_ta.py` | Turns `ta-src` into `js/ta/app.js` and `js/ta/blob-{kb,soc,acts,meta}.js`. Applies 3 small `main.js` patches and drops the SDK. | Ran it; `node --check` passes; boots in a page |
| `ref/embed.js` | Mounts the chat full-screen inside a Trojan Hub screen. No launcher. Can be mounted again after navigation. | Tested: mount, unmount mid-reply, remount, `@go:` chips |
| `ref/hub-actions.js` | New action `hub_rsvp_event`. `join_org` overridden so joining adds the club's real events. Router hook. `TA.registerHubAction()`. | Tested via NLU, Confirm, audit log, Undo, `start_action` |
| `ref/ai-sample.js` | Claude mode through `window.claude.use('sample')`, using TA's 4 tools plus the Hub tools. Falls back to the local brain. | Tested against a mocked `sample` (real calls need the published artifact) |
| `ref/ta.css` | TA widget CSS mapped onto Trojan Hub tokens and fonts, plus the full-screen embed layout | Screenshots in light and dark mode: `ref/harness/visual-*.png` |
| `ref/harness/` | `make_harness.py` and the Playwright scripts that produced every measurement below | Re-runnable |

---

## 0. Key decisions (read this first)

1. **Load TA as plain scripts** under `js/ta/`, built by `ref/build_ta.py`. Do not paste the 12 MB HTML into `index.html`. The 9.3 MB knowledge base should load after first paint.
2. **Do not include TA's `:root` block or host-page CSS** (`head.html` 11-126). They overwrite Trojan Hub's `--bg`, `--shadow`, `--surface`… and restyle `.btn`, `.pill`, `.tag`, `.hero`, `.brand`, `.mark`, `.dot`, `.muted`. Use `ref/ta.css` instead (§4.3).
3. **Embed with `TA.Embed.mount(el)`** (`ref/embed.js`) inside an `assistant` screen. It replaces `UI.init` and `Host.init` and makes every DOM-touching UI method safe while the screen is unmounted.
4. **Register Hub actions after `app.js` and before `TA.boot()`.** `TA.Process.load()` (line 8057) drops any researched process that a registered action already covers, scoring ≥ 0.8 (line 3028). Registering first is what removes the generic "RSVP to a campus event", "Request a free USC Lyft" and "Get or renew a Metro U-Pass" processes in favor of real Hub actions.
5. **Keep everything the assistant changes inside an Undo snapshot.** Either store it in `TA.State.d` (as `ref/hub-actions.js` does with `d.hub`), or wrap `TA.State.snapshot/restore` so they include Trojan Hub's own state (§5.6). Undo is a whole-state snapshot (lines 4630-4648 and 4672-4684). It is not a per-action handler.
6. **Claude in the artifact = `sample`, not the SDK.** The bring-your-own-key path (`ai.js` 7792-8033, plus `sdk.html`, 376 KB) is not needed at all. The current `start_action` schema does not fit `sample`'s limits: the enum of 153 ids is 4.7 KB against a 4 KB schema cap, and the description is 10.7 KB against a 1 KB cap. `ref/ai-sample.js` moves the action catalog into the instructions turn and validates the id inside `execute`.
7. **Safety stays local and first.** Crisis, emergency and sensitive messages never reach Claude or the Hub router hook (§7).

---

## 1. What is in `ta-src`

| File | Size | Contents |
|---|---|---|
| `head.html` | 42 KB | `<head>` + CSS (11-327), demo host page (331-435), widget markup (438-465) |
| `app.html` | 1.06 MB | One `<script>`: engine.js 2-528, util.js 531-713, data.js 715-860, state.js 862-905, nlu.js 907-1342, soc.js 1344-1561, actions.js 1563-2462, actions2.js 2466-2976, actions3.js 2978-3404, brain.js 3407-7236, search.js 7238-7343, ui.js 7345-7790, ai.js 7792-8033, main.js 8036-8083 |
| `kb.html` | 9.49 MB | `<script id="ta-kb" type="application/octet-stream">`: base64 gzip of `kb.json` (25 MB, 31,282 docs) |
| `soc.html` | 1.18 MB | `<script id="ta-soc">`: base64 gzip of `soc.json` (Fall 2026 and Spring 2027 Schedule of Classes) |
| `acts.html` | 365 KB | `<script id="ta-acts" type="application/json">`: 151 researched processes |
| `meta.html` | 23 KB | `<script id="ta-meta" type="application/json">`: counts, host list, finals grid, GE lists |
| `sdk.html` | 376 KB | `<script id="ta-sdk" type="text/plain">`: bundled Anthropic SDK, evaluated only by `AI.loadSdk()` (7860-7869) |

---

## 2. Boot sequence and what the UI needs from the page

### 2.1 `main.js` (8036-8083)

| Line | Step |
|---|---|
| 8040 | `TA.settings` = defaults (`ai:false, model, rememberKey, realDate`) merged with `localStorage ta:settings` |
| 8043-8044 | `TA.on` / `TA.emit` event bus (`kb-ready`, `kb-failed`, `soc-ready`) |
| 8046 | `text(id)`: reads a `<script id>` block's text |
| 8049-8051 | `TA.KB_META`, `TA.FINALS`, `TA.GE_LISTS` from `ta-meta` |
| 8052 | `TA.State.load()`: `ta:state` from localStorage, or a fresh `DEMO_PROFILE()` if the stored `v` ≠ 6 |
| 8053 | `TA.Brain.restore()`: `pending` and `ctx` from sessionStorage `ta:brain` |
| 8055-8056 | SOC gunzip runs async, then `TA.SOC.load`, then `emit('soc-ready')` |
| 8057 | `TA.Process.load(acts)`. It needs `TA.Actions` (all action files) and `TA.Search.tokens` (main-thread engine). |
| 8058-8059 | `TA.Search.init(kbB64)` starts the Worker. A missing block sets `Search.failed = 'Knowledge base missing'`. |
| 8060-8062 | `TA.UI.init()`, `TA.Host.init()`, `TA.UI.renderMode()` |
| 8063-8073 | kb-ready / kb-failed: set `<html data-kb>`, remove `.ta-loading-note`, toggle `#ta-status` |
| 8074-8080 | Host page only: `#demo-date`, `[data-meta]`, `#host-list`, `<html data-ready="1">` |
| 8082 | **Runs automatically** on `DOMContentLoaded`. `build_ta.py` patches this to `TA.boot = boot` behind `window.TA_MANUAL_BOOT`. |

### 2.2 DOM ids the UI expects

The `$('ta-…')` helper in ui.js (7350) is `getElementById`. It has no null checks.

| Id | Used by |
|---|---|
| `ta-root` | `renderMode` 7745 (`.ai` class), `setBusy` (`.busy`), `[data-ask]` listener 7390, `open/close` 7397-7417 |
| `ta-launcher`, `ta-badge`, `ta-min` | `init` 7375-7376, `open/close`, `badge` 7418. **Remove in embed mode** (embed.js overrides these methods). |
| `ta-panel` | `open/close` (`hidden`), Escape handler 7387 |
| `ta-sub`, `ta-acct` | `renderMode` (subtitle), `renderAcct` 7455 (sign-in pill) |
| `ta-menu-btn`, `ta-menu` | `toggleMenu` 7420, `renderMenu` 7437, document click-away 7380 |
| `ta-status` | Read once at boot (8063) for the KB loading/failed banner |
| `ta-log` | `push` 7531, `renderAll` 7550, `scroll`/`scrollToNew` 7551-7563, `typing` 7501, `streamDelta` 7511, click delegation `onLogClick` 7653 |
| `ta-live` | Screen-reader announcement in `push` |
| `ta-form`, `ta-input`, `ta-send` | Composer: `submit` 7470, `autosize` 7468, `setBusy` |
| `ta-sheet` | `sheet`/`closeSheet` 7666-7672, `onSheetClick` 7714 (consent, account, activity, settings, about) |
| `ta-toast` | `toast` 7663 |
| `ta-key`, `ta-remember`, `ta-model`, `ta-ai-on` | Settings sheet fields (BYO key). Replace in the artifact (§6.6). |
| `dash`, `demo-date`, `host-list`, `kb-count`, `[data-meta]` | Host page only. Each is optional (null-checked). |

### 2.3 What `TA.Host` does (7749-7786)

`Host.init` renders the demo-student dashboard into `#dash`, re-renders on every `TA.State.on`, and adds a **document-level** click listener for `[data-host]` (`open`, `signin`, `reset`, `approve-d`). Trojan Hub has no `#dash`, so `render` returns early, but the listener and subscription still attach. **Skip it** (`embed.js` replaces `TA.Host.init` with a no-op). The dashboard's tiles (7769-7783) are a useful map of which state fields to show in Wallet and My Day (§5.3).

### 2.4 Running the chat full-screen and remounting it (`ref/embed.js`)

Problems with the stock UI inside Trojan Hub:

- Trojan Hub's `render()` (`js/app.js` 93-103) does `host.innerHTML = scr.render()` on every navigation. That destroys `#ta-*`, and `UI.init` (7373-7395) cannot run twice: it would add the document listeners (7380, 7390) and `TA.State.on` (7393) again.
- `UI.open/close/badge` assume a launcher. `open` locks page scroll with `html.ta-noscroll` (7407).
- `UI.send` (7477-7499) awaits the brain. If the user leaves mid-reply, `push`, `setBusy` and `streamDelta` write to elements that no longer exist and throw.
- The Escape key closes the panel (7387). Trojan Hub's own document Escape handler (`js/app.js` 438) also fires.

`embed.js` does the following without editing `app.js`:

- `UI.init` becomes a once-only `once()`: it loads `ta:convo`, adds one document click-away listener and one `State.on`. `TA.Host.init` becomes a no-op.
- `UI.open`/`close`/`badge` are replaced. `close` calls `TA.Embed.onBack` and `badge` calls `TA.Embed.onUnread(n)`.
- `push`, `setBusy`, `streamDelta`, `renderMode`, `renderAcct`, `toast`, `sheet` and `toggleMenu` check whether the chat is mounted. While unmounted, replies are stored in `UI.msgs` and `ta:convo` and the unread count is bumped. They appear on the next mount.
- `TA.Embed.mount(container, {ask})` writes the panel markup and binds the element listeners. The markup is `head.html` 444-463 without the launcher and minimize button, plus a Back button. Mount then re-renders the conversation and the account pill, re-shows the typing dots if a reply is still in flight, and shows a "Loading USC knowledge base…" status until the KB is ready.
- `TA.Embed.unmount()` and `TA.Embed.ask(text)` are provided.
- Chips whose value starts with `@go:<screen>[:<arg>]` are caught in the capture phase and call `TA.Embed.onGo(screen, arg)`, so they never reach the brain. Escape inside the panel closes the sheet or menu only and stops propagation.

Trojan Hub side. This replaces `js/assistant.js`, about 30 lines:

```js
TH.screens.assistant = {
  render() { return '<div class="screen ta-screen" id="ta-screen"></div>'; },
  mount(host) {
    TA.Embed.onBack = () => TH.back();
    TA.Embed.onGo = (screen, arg) => {             // same semantics as the old runAct()
      if (screen === 'walk' && arg) { TH.state.pendingRoute = { to: arg }; return TH.go('map'); }
      if (screen === 'place' && arg) return TH.openPlace(arg);
      TH.go(screen in TH.screens ? screen : 'home', arg ? { arg } : null);
    };
    TA.Embed.onUnread = n => { /* optional: badge on the + menu's Ask Tommy tile */ };
    const ask = TH.state.params.arg; TH.state.params = {};
    TA.Embed.mount(host.matches('.screen') ? host : host.querySelector('.screen'), { ask });
  },
};
// in render() before host.innerHTML = …:  if (S.route !== 'assistant' && TA.Embed.mounted) TA.Embed.unmount();
```

Deep links already work: `TH.go('assistant', { arg: 'Any free food today?' })` mounts the chat and sends the question. TA's own `[data-ask]` document listener (7390) is not installed in embed mode. Use `data-go="assistant:…"` in Trojan Hub markup instead.

**Tested:** the chat was mounted, a question was sent, the chat was unmounted and its DOM wiped before the reply arrived, then it was mounted again. Result: 25 of 25 messages restored, the late reply shown, no errors. `@go:plans` called `onGo('plans')`.

---

## 3. Global namespace and side effects

**Globals.**
- `window.TA` holds every module.
- `TA_ENGINE_FACTORY` is a top-level function declaration (line 8).
- `window.AnthropicSDK` exists only after `AI.loadSdk()`.
- `build_ta.py` adds `window.TA_BLOBS` and `window.TA_MANUAL_BOOT`.

Trojan Hub uses `window.TH`. There are no clashes.

**Storage.** TA uses the `ta:` prefix (util.js `mkStore` 633-645) and Trojan Hub uses `th:` (`js/core.js` 54-55), so they cannot collide.

| Key | Where | What |
|---|---|---|
| `localStorage ta:state` | `State.save` 875 | Whole demo account (`TA.State.d`), including the audit log (≤ 200 entries) |
| `localStorage ta:convo` | `UI.push`, `setCardStatus` | Last 80 messages, including cards |
| `localStorage ta:open` | `UI.open/close` | Panel open flag (unused in embed mode) |
| `localStorage ta:settings` | 8040-8041 | `ai`, `model`, `rememberKey`, `realDate` (plus `claude` in `ai-sample.js`) |
| `localStorage` / `sessionStorage` `ta:apikey` | `AI.setKey` 7854 | BYO key. Drop in the artifact. |
| `sessionStorage ta:brain` | `Brain.persist/restore` 3427-3428 | `pending` flow and `ctx` |

**Document and global listeners.**
- `UI.init`: document click (menu click-away, 7380) and document click for `[data-ask]` (7390).
- `Host.init`: document click for `[data-host]` (7750).
- `main.js`: `DOMContentLoaded` (8082). It also sets `<html data-kb>` and `<html data-ready>` and toggles `html.ta-noscroll`.

None of these conflict with Trojan Hub's `data-*` attributes (`data-go`, `data-place`, `data-back`, `data-event`, `data-close`, `data-copy`…). Trojan Hub binds those on screen or sheet roots, not on the document. TA's own `data-close` and `data-copy` are delegated on `#ta-sheet` and `#ta-log` only.

**Timers.** `UI._tt` is the toast timer. The search request timeout is 15 s (7337). There are no intervals.

### 3.1 CSS collisions (every one)

The table below is the computed intersection of class names in the `head.html` `<style>` and `css/app.css`.

| Class | TA rule (head.html) | Trojan Hub rule (app.css) | Effect if TA's CSS were included as-is |
|---|---|---|---|
| `.btn` (+ `.primary`, `.xs`) | 55-60, 100 (host page) | `.btn`, `.btn.gold/.ghost/.sm` | Restyles every Trojan Hub button |
| `.pill` | 54, 126 | `.pill` (+ tones) | Restyles status pills |
| `.tag` | 52 | `.tag` | Uppercase warn badge style |
| `.hero` (+ `h1`, `em`, `p.lede`) | 61-65, 126 | Home hero | Breaks the Home header |
| `.brand`, `.mark` | 50-51 | `.hero .brand .mark` | Header mark recolored |
| `.dot` | 76-77 (`.try-col h3 .dot`) | `.hero .dot` (bell) | Scoped. Harmless unless copied. |
| `.muted` | 105 | 44 | Same intent, different color token |
| `.bad` | 104 | `.pill.bad` etc. | Color override |
| `.sub` | 72 (`.band p.sub`) | `.hero .sub` | Scoped. Harmless unless copied. |
| `.num` | 119, 276 | `.sos .num` | Scoped on both sides |
| `.bot`, `.ghost`, `.gold`, `.on`, `.sm` | 165-166, 196, 268, 149/190, 242 | `.msg.bot`, `.btn.ghost/.gold/.sm`, `.steps i.on` | Only compound with `ta-` classes on TA's side; Trojan Hub's rules need `.msg`/`.btn`, which TA markup never uses. No effect. |

Global (non-class) TA rules that would leak: `:root` tokens (11-35), `body` (39), `a` (40), `html.ta-noscroll` (38) and `@media (prefers-reduced-motion) *` (326, which would disable all of Trojan Hub's animations).

**Token clash.** Both sets define `--cardinal`, `--gold`, `--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--shadow`, `--warn` and `--bad`. Whichever loads last wins on `:root`. TA's `--shadow` (`0 18px 50px…`) would give every Trojan Hub card a floating-panel shadow.

**Trojan Hub to TA (harmless).** `button {background:none;border:0;padding:0}`, `p {margin:0}` and `h1,h2,h3 {font-family: Archivo}` reach TA's markup, but every TA class sets its own background, border, padding and margin. Sheet titles pick up Archivo, which is the desired result.

`ref/ta.css` copies only the widget block (`head.html` 129-311). It adds a token bridge on `.ta-root`, scopes `a`, `.sr-only` and `[hidden]` under `.ta-root`, scopes reduced-motion to `.ta-root *`, and moves the `max-width:640px` tweaks (312-325) to a container query. Viewport media queries never fire inside the 402 px phone frame on desktop.

---

## 4. Search Worker, data blobs, load cost

### 4.1 How it loads

- **Worker.** `TA.Search.init(b64)` (7288-7303) builds a Worker from a Blob URL. Its source is `TA_ENGINE_FACTORY.toString()` plus `WORKER_SRC`. The 9.5 MB base64 string is posted to the Worker, which gunzips it with `DecompressionStream`, then `JSON.parse`s and `build`s the index. Searches go through `postMessage`, with a 15 s timeout (`query` 7327-7341).
- **Fallback.** If the Worker fails (`onerror` or an error message), `S.fallback()` (7305-7325) builds the index on the main thread. Expect a UI freeze of about 3.5 s.
- **Main-thread engine.** A second engine instance (`local`, 7242) handles `tokens`, `syn` and `qualPenalty`, which NLU, brain and `Process.match` use synchronously.
- **SOC.** It is gunzipped on the main thread (8056). `soc-ready` fires after that. Course parsing works before then, but SOC lookups return nothing.

### 4.2 Measured (headless Chromium on this container; Node for memory)

| Metric | Value |
|---|---|
| `TA.boot()` (scripts already parsed, KB deferred) | 145 ms |
| KB index build in Worker | 3.2-3.6 s (31,282 docs, 50,451 terms, 2,079 QA profiles) |
| Page load to `kb-ready` (inline 14 MB page) | 3.8-4.1 s |
| Lazy `blob-kb.js` (loaded at idle) to `kb-ready` | about 3.5 s after the script loads |
| Main-thread JS heap after boot | 45-57 MB |
| Worker memory (Node estimate, same engine) | about 140 MB heap for the parsed KB and index; process RSS 330 MB |
| One search after build | about 40 ms |

### 4.3 Size budget for the claude.ai artifact

TA without the SDK is 11.9 MB: `app.js` 1.04 MB, `blob-kb.js` 9.27 MB, `blob-soc.js` 1.15 MB, `blob-acts.js` 0.37 MB, `blob-meta.js` 0.03 MB. Each of these is under the 16 MB per-text-file limit. Publish them as supporting `files` next to the page, not inline (the page itself must stay ≤ 16 MB).

Load `blob-meta`, `blob-acts`, `blob-soc` and `app.js` normally. Load `blob-kb.js` at `requestIdleCallback` and then call `TA.Search.init(TA_BLOBS['ta-kb'])` (pattern in `ref/harness/build_test.js`). Delete the blob afterwards (the build patch does this when the KB is inline).

### 4.4 Risks here

- The Worker comes from a Blob URL. The claude.ai artifact sandbox may block `blob:` workers under its CSP. **This was not testable here.** TA falls back to the main thread, which works but freezes the UI about 3.5 s.
- `DecompressionStream` is required. It is present in current Chrome, Edge, Safari and Firefox.

---

## 5. The action system

### 5.1 Anatomy of an action (contract at 1563-1566; `def()` at 1574)

```
{ id, title, scope, icon, system,      // scope ∈ TA.SCOPES (3412-3415); icon ∈ CARD_ICON keys (ui.js 7368)
  detect(n) -> 0..1,                   // NLU score; ≥0.8 starts the flow (4020-4041), 0.6-0.8 may ask/answer first
  init(n) -> slots,                    // pre-fill from the message
  next(slots) -> null | {slot, md, options:[{label, value, sub?}], placeholder}   // ask for what's missing
  fill(slotName, n, slots, text) -> true | false | 'retry',
  check(slots) -> {block:[md], warn:[md], offers:[{label,value}]},             // re-run right before execute
  preview(slots) -> {title, rows:[[k,v]], notes, steps, fine, sources:[{url,title}], danger},
  run(slots) -> {title, rows, log} }   // mutate TA.State.d only
```

### 5.2 Lifecycle in `TA.Brain`

| Step | Lines | What happens |
|---|---|---|
| Start | `start` 4570-4595 | `pending = {aid, slots: init(n), stage}`. Not signed in → `stage:'auth'` and a sign-in card. Scope not granted → `stage:'scope'` and an "Allow …?" chip. |
| Resume after sign-in | `resumeAfterSignIn` | Re-checks the scope, then calls `proceed` |
| Proceed | `proceed` 4597-4616 | `next()` → question (chips, or an options card when an option has `sub`) · `check().block` → refusal + `offers` chips · otherwise a **confirm card** built from `preview()` + `check().warn` + `system` |
| Slot turn | 3631-3678 | Side questions are answered and the flow continues. `fill()` → `proceed`. A different action detected → the pending flow is dropped. |
| Confirm turn | `confirmTurn` 5173 | yes → `execute`; cancel → `cancel`; edits re-run `proceed`; questions are answered with the card kept |
| Execute | `execute` 4629-4649 | Runs `check()` again → `snap = State.snapshot()` → `run()` → `confNo('TA')` → `State.log({action: r.log, conf, system, scope, aid})` → `State.save()` (persists and fires `State.on`) → `lastUndo = {snap, logId}` → receipt card + `Undo` chip + `nextSteps(aid)` |
| Undo | `undo` 4672-4684 | Only the most recent change, and only if `log[0]` is still that entry. `State.restore(snap)` keeps `signedIn`, `scopes` and `log`, then logs "Undid: …" and saves. |
| Persist | `persist` 3427 | `pending` and `ctx` go to sessionStorage, so a flow survives reloads |

Researched processes (`TA.Process`, 3015-3404, data in `acts.html`). There are 151 entries; 123 remain after skipping duplicates (the `DUP` list plus anything a registered action covers at ≥ 0.8). They become actions with id `proc:<id>` via `P.action()` (3080) and the `TA.Actions.get` wrapper (3401-3402). `Process.match` (3042) scores names and descriptions by IDF, and `ALIAS` regexes (3085-3112) catch phrasings. On confirm, they log a simulated submission into `TA.State.d.requests` (3391-3392). They are reached in `route` through `B.processFor` (4549, 4071) after dedicated actions.

### 5.3 How NLU text reaches an action (order inside `B.route`, 3474)

1. `r4SafetyWrap` (6242) and `r4SafetyPre` (6327), then crisis, distress and emergency (3481-3515). See §7.
2. Bias, bullying and hazing reports (3590-3608), then `@act:` chips (3611).
3. Continue a **pending** flow (3614-3698).
4. `afterAction`, `r4AfterBlock`, acceptance of an offered action (3700-3703).
5. **`B.misuse` (3704)**, language checks, **`B.offTopic` (3717)**, `undo` (3732), `courseQuestion`/`quickFacts`/`broadTopic` (3734), sign-in/out, greet, help, about, split questions…
6. **`TA.Actions.detect(n)` (4020)**: dedicated actions. Then `B.processFor(n)` (4071), then knowledge-base answers.

Steps 5 and 6 matter for Hub actions. `B.misuse` answers "order me a coffee" with "I can't place food orders…" (7174+) before step 6 ever runs. Tested: this happens until a Hub order action is registered with the router hook. `ref/hub-actions.js` wraps `B.route`. A message with no safety flags, no pending flow, not yes/no/cancel/undo, not a split part and not an `@` chip goes straight to `B.start(action, n)` when a **Hub** action scores ≥ 0.8. Everything else goes to the original `route`.

### 5.4 Registering new actions from outside (exact recipe)

1. **Load order:** `app.js`, then `hub-actions.js`, then `embed.js`, then `ai-sample.js`, then `TA.boot()`.
2. **Define** with `TA._actionHelpers.def(a)` (exported at 2461). It pushes onto the same array that `TA.Actions.list` and `TA.Actions.detect` use (2965-2972). Helpers in `TA._actionHelpers` include `slotsFor`, `pickSlot`, `slotOptions` and `slotFromValue` for appointment-style time slots.
3. **Scope:** reuse a key of `TA.SCOPES` (`campuslife`, `dining`, `transportation`, `libraries`, `advising`, `health`…). The demo profile grants all 12 (data.js 801). A new key needs `TA.SCOPES.hub = 'Trojan Hub'` and `TA.State.d.scopes.hub = true`; otherwise `start` asks for permission every time.
4. **State:** write only to `TA.State.d` (`d.hub` is created lazily, so there is no `DEMO_PROFILE.v` bump that would wipe saved accounts), or use the snapshot wrapper in §5.6.
5. **Route** (food orders and anything else `misuse` or `offTopic` might catch): register through `TA.registerHubAction(a)` (`ref/hub-actions.js`). This adds the id to the router hook's allow-list.
6. **Override in place** when an existing action already owns the intent. `join_org` is replaced at its index with `Object.assign({}, base, {…})`, keeping the id, because brain.js special-cases `'join_org'` at 4027, 5344, 5946, 5985 and 6024.
7. **Claude:** nothing more is needed. `start_action` resolves ids through `TA.Actions.get` (8002-8003 / `ai-sample.js`), and `ai-sample.js` builds the catalog from `TA.Actions.list` at call time.

### 5.5 Minimal template (from `ref/hub-actions.js`, tested end to end)

```js
var def = TA._actionHelpers.def, D = function () { return TA.State.d; };
function hub() { var d = D(); return d.hub || (d.hub = { calendar: [], clubs: [], orders: [], passes: [], lines: [], rides: [], zips: [], upass: null, parkedAt: null }); }

TA.registerHubAction({                         // = def(a) + allow-list for the router hook
  id: 'hub_rsvp_event', title: 'Save a campus event to My Day (RSVP)', scope: 'campuslife', icon: 'calendar',
  system: 'EngageSC (engage.usc.edu) + Trojan Hub calendar',
  detect: function (n) {                                   // NLU keywords
    if (n.isQuestion && !n.polite) return 0;               // "how do I RSVP?" stays a question
    if (!/\b(rsvp|add (it|this|that|.{3,60}) to my (calendar|day|schedule)|save (the|this|that) event)\b/.test(n.t)) return 0;
    return findEvent(n.t) ? 0.95 : 0.85;
  },
  init: function (n) { var e = findEvent(n.t); return { eventId: e ? e.id : null }; },
  next: function (s) { return s.eventId ? null : { slot: 'eventId', md: 'Which event?',
    options: upcoming().slice(0, 6).map(function (e) { return { label: e.title, sub: when(e) + ' · ' + e.org_name, value: '@ev:' + e.id }; }) }; },
  fill: function (k, n, s, text) { var m = /@ev:(\d+)/.exec(text || ''), e = m ? eventById(m[1]) : findEvent(n.t); if (e) { s.eventId = e.id; return true; } return false; },
  check: function (s) { var o = { block: [], warn: [] }, e = eventById(s.eventId);
    if (!e) o.block.push('I couldn’t find that event in EngageSC’s public calendar.');
    else if (hub().calendar.some(function (x) { return x.ref === e.id; })) o.block.push('**' + e.title + '** is already on your calendar.');
    return o; },
  preview: function (s) { var e = eventById(s.eventId); return { title: 'RSVP and add to My Day',
    rows: [['Event', e.title], ['When', when(e)], ['Host', e.org_name], ['Where', e.location || 'Shown to registered attendees on EngageSC']],
    fine: ['Simulated RSVP.'], sources: [{ url: e.url, title: e.title + ' – EngageSC' }] }; },
  run: function (s) { var e = eventById(s.eventId);
    hub().calendar.push({ id: TA.uid(), kind: 'event', ref: e.id, title: e.title, start: e.start, end: e.end, where: e.location, url: e.url, ical: e.ical_url });
    return { title: 'You’re going', rows: [['Event', e.title], ['When', when(e)]], log: 'RSVP’d to ' + e.title + ' and added it to My Day' }; }
});
```

`findEvent`, `upcoming`, `eventById` and `when` are in the reference file. `when` formats with `Intl.DateTimeFormat(…, {timeZone:'America/Los_Angeles'})` because EngageSC times carry UTC offsets. `upcoming` drops all-day and multi-day "events" such as "FSL Fall 2026 Check-in", which spans 117 days.

How each entry point works for this action:

- **Confirm card, audit log, Undo:** no extra code. `Brain.proceed` and `execute` provide all three.
- **Claude:** `start_action({action:'hub_rsvp_event', request:'RSVP to ISA GlobeFeast'})` returned `{"status":"awaiting_confirmation", card…}` in the test.

**Test transcript (signed-in demo student):**
- "rsvp to an event" → options card (6 upcoming events) → tap → confirm card → Confirm.
- `TA.hub().calendar` gained 1 entry. The audit log showed "RSVP’d to … (TA-ALPJ-4M2X)". `TA.State.on` fired once. Receipt chips were **Undo** and **Open My Day**, and the latter called `onGo('plans')`.
- "undo" → calendar back to 0.
- "join the Black Student Assembly" → confirm card listing 4 real upcoming BSA meetings → "yes" → `life.orgs` and `hub.clubs` updated, 4 events added to `hub.calendar`.
- "join Totally Fake Club Name Here" → blocked with a pointer to the EngageSC directory.
- Without sign-in → sign-in card; after sign-in → flow resumes.

### 5.6 Actions that change Trojan Hub's own state (orders, passes, lines, Lyft, Zipcar, U-Pass, parking)

Trojan Hub keeps these in `TH.state` (`js/app.js` 9-23, saved under `th:*`). Its logic currently lives inside sheet click handlers (`screens.js` 61, 74, 112, 172, 213, 234; `app.js` 168). Two steps:

1. Move each into a reusable function, e.g. `TH.act.requestLyft(to)`, `bookPass(id,start)`, `joinQueue(id)`, `placeOrder(at,items,window)`, `reserveZip(id,start,hours)`, `enrollUpass(dl)`, `saveParking(at)`, `saveEvent(id)`. Both the Trojan Hub UI and the TA actions' `run()` call these.
2. Make TA's Undo snapshot include Trojan Hub's state. `execute` and `undo` call `St().snapshot()` and `St().restore()` through the object, so wrapping works:

```js
var TH_KEYS = ['bookings', 'queues', 'orders', 'saved', 'upass', 'parking', 'zips', 'ride', 'lyftUsed'];
var snap0 = TA.State.snapshot, restore0 = TA.State.restore;
TA.State.snapshot = function () { var th = {}; TH_KEYS.forEach(function (k) { th[k] = TH.state[k]; }); return JSON.stringify({ ta: snap0.call(TA.State), th: th }); };
TA.State.restore = function (s) { var o = JSON.parse(s); restore0.call(TA.State, o.ta); TH_KEYS.forEach(function (k) { TH.state[k] = o.th[k]; }); TH.save(); TH.render(true); };
```

Trojan Hub's `tickSims` interval (`js/app.js` 187) advances rides, orders and lines. After an Undo it simply sees the restored arrays.

### 5.7 The ten requested Hub actions

| Request | Id | Scope | Writes | NLU cues (detect ≥ 0.8) | Notes and conflicts |
|---|---|---|---|---|---|
| Join a club | `join_org` (override) | campuslife | `life.orgs`, `hub.clubs`, `hub.calendar` | existing join_org detect (2925) | Implemented. Matches `TH.CLUBS` (2,008 EngageSC groups) and adds that group's real `TH.CLUB_EVENTS`. Warns on "Not Registered Yet" and on closed online joining. Meeting times are almost never public (`research/clubs/README.md`), so do not invent recurring meetings. The process `join-student-organization` is auto-skipped. |
| RSVP / add to calendar | `hub_rsvp_event` | campuslife | `hub.calendar`, `life.rsvps` | rsvp / add … to my calendar / save the event | Implemented. Process `rsvp-campus-event` auto-skipped. Also map Trojan Hub's own `TH.events()` to `S.saved` if those stay. |
| Order food for pickup | `hub_order_food` | dining | `TH.state.orders` (§5.6); debit Dining Dollars | order/get me + food or menu item, not a question | **Needs the router hook**, or `B.misuse` (7174+) refuses it. Tested: with the hook, "order me a latte" opens a confirm card. Debit `TA.State.d.dining.diningDollars` (single source, §6.2). |
| Reserve a Trojan Pass time | `hub_trojan_pass`, or override `reserve_room` (2803) | libraries/campuslife | `TH.state.bookings` | "trojan pass", "return time", pass names | `reserve_room` already books Leavey rooms into `library.reservations`. Override it in place (as with join_org) so the Leavey pass and the TA booking are one record. Fitness and racquetball processes are auto-skipped once the pass action covers them. |
| Join a virtual line | `hub_virtual_line` | health/advising | `TH.state.queues` | "virtual line", "get in line for", "queue for" + `TH.QUEUES` name | No TA overlap. Engemann walk-in is health; do not route it on crisis text (the hook never sees flagged messages). |
| Request a free Lyft | `hub_request_lyft` | transportation | `TH.state.ride`, `lyftUsed` | "lyft", "ride home", "free ride" | Process `request-lyft-ride-or-safety-escort` is still active today (verified) and is auto-skipped once this is registered. Use `check()` to block outside the service hours and when no rides are left, with numbers taken from Trojan Hub's verified transport data. Never offered in place of 911/DPS: emergencies are handled first (§7). |
| Reserve a Zipcar | `hub_reserve_zipcar` | transportation | `TH.state.zips` | "zipcar", "rent a car" | Make it slot-based (car, start, hours) with `next`/`fill`. |
| Enroll in Metro U-Pass | `hub_upass` | transportation | `TH.state.upass` | "u-pass", "metro pass", "tap card" | Process `activate-metro-u-pass` is still active today and is auto-skipped once registered. Its `acts.html` steps and requirements are a good `preview().steps` source. |
| Save my parking spot | `hub_save_parking` | transportation | `TH.state.parking` | "i parked", "save my parking spot", "remember where i parked" | Must not trigger on "parking permit" (`buy_parking`, 2772). Keep the detect strict. |
| Walk me to a place | none (navigation, not an action) | none | none | "walk me to X", "how do i get to X", "where is X" | No confirm, log or undo needed. Answer from the route hook with a bot message and `@go:walk:<placeId>` / `@go:place:<id>` chips, using Trojan Hub's place index. TA's SOC data has **no classroom locations** (section rows are `[id,type,[[days,start,end]],seats,reg,dclear,instr,…]`), so "walk me to my next class" needs a building for each section from another source. |

---

## 6. The demo student, state shape, and how Trojan Hub reads it

### 6.1 Shape (`TA.DEMO_PROFILE`, data.js 800-858; `v: 6`)

- `profile`: Jordan Rivera, CS (BS) sophomore in Viterbi; netid `jrivera`; USC ID `1234-5678-90`; address 3131 S. Hoover.
- `academics.terms['20263'|'20271']`: each is `[{code, title, units, grading, sections:[[id, type, days, start, end, instructor]]}]`. Day codes are `M T W H(Thu) F S U`, so `TH` means Tue and Thu (`TA.dayList` 679). Times are `HH:MM` 24 h, campus time. Fall 2026: CSCI 104, MATH 226, PHYS 151, PSYC 100. Spring 2027: MATH 225, CSCI 270.
- `academics.regAppointment`, `holds`, `dclearances`, `completed`.
- `dining {plan, swipesLeft, swipesTotal, guestLeft, diningDollars, ddBlocks}` and `uscard {status, discretionary, replacement}`.
- `billing {balance, due, items, paymentPlan, payers, payments}`.
- `housing {…}` and `parking {permit}`.
- `health.appointments`, `advising.appointments`, `careers.appointments`: `{id, type, at: ISO, kind, …}`.
- `library {loans, reservations: [{id, lib, at, dur}]}`.
- `life {orgs: [{name, status, at}], rsvps}`, `requests` (process submissions) and `log` (audit, newest first).
- **New:** `hub {calendar, clubs, orders, passes, lines, rides, zips, upass, parkedAt}`, created lazily by `hub-actions.js`.

Helpers: `TA.State.termCourses(term)`, `termUnits`, `mealPlan()`, `name()`, `TA.POLICY.cal[term]` (classesBegin/End), `TA.POLICY.holidays`, and `TA.classBusy(date, min)` (2488, exported 2503).

### 6.2 One student, one clock

- Trojan Hub's `TH.PROFILE` is "Alex Rivera" with invented classes and `diningDollars: 186.4` (`js/data.js` 327-336). Replace it with TA's demo student: name from `TA.State.d.profile`, classes from `termCourses('20263')`, balances from `d.dining`. Otherwise Tommy and the Wallet disagree.
- Clock: `TA.now()` (util.js 647-651) pins the date to Nov 9, 2026 and uses the device's time of day. Trojan Hub has `TH.clock` with a demo-time override. After both boot:
  `TA.now = function () { var c = TH.clock.now(); return TA.settings.realDate ? c : new Date(2026, 10, 9, c.getHours(), c.getMinutes(), c.getSeconds()); };`
  Do this so "set time to 11 PM" also changes Tommy's answers.

### 6.3 My Day adapter (drop into `TH.dayItems`, `js/app.js` 195)

```js
function taItems(day) {                       // day: Date at local midnight
  var d = TA.State.d, iso = TA.iso(day), out = [], min = function (x) { return x.getHours() * 60 + x.getMinutes(); };
  var term = Object.keys(TA.POLICY.cal).find(function (t) { var c = TA.POLICY.cal[t]; return iso >= c.classesBegin && iso <= c.classesEnd; });
  if (term && !TA.POLICY.holidays[iso]) {
    var L = 'UMTWHFS'.charAt(day.getDay());
    TA.State.termCourses(term).forEach(function (c) { c.sections.forEach(function (x) {
      if (String(x[2]).indexOf(L) < 0 || TA.minutes(x[3]) == null) return;
      out.push({ start: TA.minutes(x[3]), end: TA.minutes(x[4]), kind: 'Class', title: c.code + ' ' + x[1], sub: c.title + (x[5] ? ' · ' + x[5] : ''), section: x[0] });
    }); });
  }
  ['health', 'advising', 'careers'].forEach(function (k) { d[k].appointments.forEach(function (a) { var t = new Date(a.at); if (TA.iso(t) === iso) out.push({ start: min(t), end: min(t) + 30, kind: 'Appointment', title: a.type }); }); });
  d.library.reservations.forEach(function (r) { var t = new Date(r.at); if (TA.iso(t) === iso) out.push({ start: min(t), end: min(t) + (r.dur || 60), kind: 'Study room', title: r.lib }); });
  ((d.hub && d.hub.calendar) || []).forEach(function (e) { var t = new Date(e.start); if (TA.iso(t) === iso) out.push({ start: min(t), end: min(new Date(e.end || e.start)), kind: 'Event', title: e.title, sub: e.org || '' }); });
  return out;
}
```

On Monday Nov 9, 2026 this gives PHYS 151 Lecture 8:30, MATH 226 Lecture 10:00, CSCI 104 Lab 12:00 and PSYC 100 Lecture 14:00. Nov 11 (Veterans Day) has no classes.

### 6.4 Wallet and Home

Show the same fields as the TA dashboard tiles (7769-7783):
- `dining.swipesLeft/swipesTotal`, `dining.diningDollars`, `uscard.discretionary` and `uscard.status`. A frozen card should grey out the USCard pass.
- `parking.permit`, `billing.balance` and `billing.due`.
- `d.log.filter(x => x.conf).slice(0, 6)` for "Recent activity by Tommy".

### 6.5 Subscribing to changes

`TA.State.on(fn)` (state.js 879) fires after every `save()`: each executed action, Undo, sign-in, scope change and reset. There is no `off()`, so subscribe **once** at startup:

```js
TA.State.on(function () { if (['home', 'plans', 'wallet'].indexOf(TH.state.route) >= 0) TH.render(true); });
```

`TH.render` is exported at `js/app.js` 104. While the user is on the assistant screen, nothing needs re-rendering; the next navigation renders fresh data.

---

## 7. Crisis and emergency handling (preserve exactly)

- **Detection** is in nlu.js:
  - `CRISIS` 1043, `CRISIS2` 1051, `DISTRESS` 1045, `DISTRESS2` 1108, `EMERGENCY` 1047, `EMERGENCY2` 1079 and `DISCLOSE` 1118.
  - Hazing, threat and violence sets: 1147-1168, plus the Spanish and French nets at 1169-1170.
  - `unmask()` (1177) handles masked spellings such as "k*ll".
  - Benign idioms are stripped first (`BENIGN` 1226-1271, `INJURY` 1273).
  - R4 post-processing (1288-1313) handles past or grief, threats against the student, overdose, hazing and disclosures.
  - The results are flags on `n`: `crisis`, `distress`, `emergency`, `medical`, `overdose`, `disclose`, `threat`, `threatMe`, `violence`, `hazing`, `injury`, `concern`, `mildStress` and `lang`.
- **Responses:**
  - `B.route` checks safety first: `r4SafetyWrap` 6242, `r4SafetyPre` 6327, then 3480-3515.
  - The crisis card is `B.crisis` 4774: 213-740-9355 (24/7), 988, text TROJAN to 741741, and 911 or DPS 213-740-4321.
  - The emergency card is `B.emergency` 4786: DPS UPC 213-740-4321, HSC 323-442-1000, 911, non-emergency 213-740-6000, plus CSI 213-740-0411 and RA on ER for threats.
  - Also: `emergencyGuide` 4743, `supportFirst` 4764, `distressHelp` 4720 and `r4Violence/Bias/Bully` 6309-6321.
  - A mild-stress footer is added in `handle` (3449).
- **Claude mode:** `ai.js` 7892 sends crisis, emergency and `Brain.sensitive(n)` (6389, which also includes `misuse`) to the local brain. `ai-sample.js` keeps that rule as its first line. The `RULES` turn repeats the phone numbers as a backstop.
- **The Hub router hook** never pre-empts a flagged message (it checks the same flags as `r4SafetyWrap`, plus `concern/medical/injury`). Tested: "i want to kill myself" still returned the crisis resources card.
- **Remove Trojan Hub's keyword responder** (`assistant.js` 134+, whose emergency branch only gives DPS and 911). Its job is now done by TA's local brain, which never dead-ends.

---

## 8. Claude mode through `window.claude.use('sample')`

API used (`artifact-capabilities/0.2.96/sample.d.ts`):
- `claude.use('sample')` → `fn | null`.
- `fn(input, {tools, onText, signal, modelTier, cache:false})` → `{text, truncated, modelTierApplied}`. On failure it rejects with `{code, message, text?}`.
- `input` is turns that start and end with `user`. There is no system role. The total is ≤ 256 KiB.
- `tools[]` is `{name, description ≤ 1 KB, inputSchema ≤ 4 KB, execute(input, {signal})}`. Results must be ≤ 32 KB. Throw to report an error to Claude. Calls in the same round run concurrently.
- Calls with tools are never cached, and `cache` other than `false` is rejected.
- `limits()` → `{maxPromptBytes, tools?:{maxCount}}`.
- The page must be published with `capabilities: { sample: {} }`. The first call in a view asks the viewer for consent.

Design (`ref/ai-sample.js`, replaces `TA.AI.enabled/handle/reset`):

| Concern | How |
|---|---|
| Routing | Local brain for: crisis, emergency or `sensitive`; any pending confirm/slot/scope/auth turn answered with yes/no/cancel, a slot value or an `@…` chip; undo, sign-in and sign-out; sample unavailable, declined or tool-less. Optional fast path: `TA.Actions.detect ≥ 0.9` and not a question goes local too, which is instant and needs no consent. Everything else goes to Claude. |
| Grounding | Same as `ai.js` 7903-7905 and 7961-7964: retrieve 8 passages locally (`TA.Search.query`), put them in the last user turn as `<usc_sources>`, and map `[n]` citations to source chips. `search_usc` results append to the same numbering. |
| Instructions | A leading `user` turn: `RULES` (TA's `SYSTEM` adapted for Tommy and the Hub) plus an **ACTIONS catalog** (`id = title`, 153 lines, about 11 KB). Measured input: 18-21 KB per call. |
| Tools | `search_usc`, `get_my_account` (adds `clubs` and `calendar` sections), `search_classes` and `start_action` (all executed by `AI.runTool`, 7971-8016). Trojan Hub tools come from `TH.assistantTools`: `find_places`, `get_transport`, `get_events`, `get_safety`, `get_my_day`. `add_button` adds `@go:` chips. Tested: largest description 199 B, largest schema 228 B. Results: `search_usc` 5.8 KB, `get_my_account` 1.5 KB, `search_classes` 1.4 KB. |
| `start_action` | Free-text `action` validated in `execute`. An unknown id throws "Unknown action id… use an id from the ACTIONS list". Only **one** call per message, so concurrent calls cannot overwrite `Brain.pending`. A second call throws a polite error. |
| Streaming | `onText({text})` → `UI.streamDelta(text)` (same contract: the whole text so far) |
| History | Plain-text turns: `Student: …` and a summary of what was shown, including card titles and rows. The last 16 are kept. Local turns are recorded too (the `recordLocal` idea, 8018-8025). |
| Errors | `not_granted/sampling_disabled/not_declared/capability_*` → turn Claude off for the view and answer locally with a one-time note. `tools_unavailable` → local. `rate_limited/upstream_error/refused/empty_completion/prompt_too_large` → local answer with a short note. `cancelled` → "Stopped." **If `start_action` already ran, return its card** (plus any partial `e.text`) instead of re-running the text locally, which would start the flow twice. Never retry in a loop. |
| Model | `modelTier:'quick'`, which answers in about a second per round. Optionally offer "Thorough answers" → `'default'` in Settings. |
| Settings | Replace the BYO-key section of `UI.sheets.settings` (7695-7704) with a "Use Claude (your claude.ai account)" toggle stored as `TA.settings.claude`. `AI.enabled()` reads it. Note that `TA.settings.ai` defaults to `false` (8040). |
| SDK | **Not needed.** Leave out `sdk.html` (376 KB). `AI.loadSdk`/`client` (7860-7875) are then never called. The BYO-key path cannot work inside the artifact anyway: the page's network is sandboxed, and a key in a shared page is unsafe. |

Mock-tested flows:
- A question → answer with source chips and an `@go:plans` button.
- "find me something fun tonight and sign me up" → `start_action` → confirm card → local "yes" → receipt.
- A crisis message → local resources card.
- A failure after `start_action` → card kept.
- `not_granted` → local answer with a note, and `AI.enabled()` false afterwards.

**Not tested:** a real `sample` call (it needs the published artifact and viewer consent).

---

## 9. UI and theming

**Message model.** A message is `{role:'user'|'bot', md, sources:[{url,title}], chips:[{label, value, kind:''|'action'|'primary'|'ghost'}], card, priority, kind, stale}`. `md` is rendered by `TA.md` (util.js 587-631: paragraphs, lists, tables, quotes, safe links, `tel:` and `mailto:`).

**Cards** (`UI.cards`, 7597-7647):

| Card | Description |
|---|---|
| `confirm` | Kicker "Please confirm", title, rows, warn, notes, steps, fine, "Done through: system · simulated", sources, Confirm/Cancel buttons. `data-status`: pending, confirmed, cancelled or expired. |
| `receipt` | Rows, confirmation code, system |
| `options` | Tappable options with `sub` lines; sends `value` |
| `signin` | Opens the consent sheet |
| `resources` | Crisis or emergency phone list (`tone`) |
| `schedule` | The student's terms |
| `courses` | SOC sections table with D/R badges and a "Register me" button |
| `bill` | Statement table |

**Sheets** (7673-7713):
- `consent`: demo sign-in plus scope checkboxes.
- `account`: scopes and sign-out.
- `activity`: the audit log with confirmation codes.
- `settings`: BYO key, model, Claude toggle and Reset demo. Adapt for `sample` as in §8.
- `about`: KB statistics.

The menu (7437-7452) offers Account/Sign in, Activity, Settings, About, Clear and Sign out.

**Restyling without rewriting** (`ref/ta.css`). The widget uses only TA token names. Map them on `.ta-root`:

| TA token | Trojan Hub value |
|---|---|
| `--cardinal-text` | `var(--cardinal-ink)` |
| `--good` / `--good-50` | `var(--ok)` / `var(--ok-bg)` |
| `--warn-50` / `--bad-50` | `var(--warn-bg)` / `var(--bad-bg)` |
| `--bubble` | `var(--surface-2)` |
| `--font` / `--mono` | `var(--f-body)` / `var(--f-mono)` |
| `--cardinal-600`, `--cardinal-50`, `--gold-50`, `--ink-2`, `--line-2` | `color-mix()` of Trojan Hub tokens |

Light and dark mode then follow `app.css` automatically; both were checked in screenshots.

Embed-mode touches:
- Archivo (`font-stretch: 112%`) for the header title, card titles and sheet titles; IBM Plex Mono for confirmation codes.
- A gold avatar, and the hero's cardinal gradient on the header.
- Cards and bubbles on `--surface` with Trojan Hub's `--shadow`, and a `--bg` log.
- A 16 px textarea so iOS does not zoom.

**Branding.** The greeting strings say "Trojan Assist" (4700, 7464; 14 occurrences in total). Change the two greetings to "Tommy". Keep "Trojan Assist" in About as the engine name. `n.greet` already accepts "hey tommy" (1208).

---

## 10. Recommended file layout

```
index.html                         + <link css/ta.css>; + the script tags below, TA before TH.boot()
css/app.css                        (unchanged)
css/ta.css                         ← ref/ta.css
js/ta/app.js                       ← build_ta.py (ta-src/app.html + 3 main.js patches)
js/ta/blob-meta.js  blob-acts.js  blob-soc.js     ← build_ta.py (load eagerly, ≈1.55 MB)
js/ta/blob-kb.js                   ← build_ta.py (9.27 MB, inject at idle, then TA.Search.init)
js/ta/hub-actions.js               ← ref/hub-actions.js + the other Hub actions (§5.7) + TH-state snapshot wrapper (§5.6)
js/ta/embed.js                     ← ref/embed.js
js/ta/ai-sample.js                 ← ref/ai-sample.js
js/ta/bridge.js                    TA.now ← TH.clock, TA.State.on → TH.render, My Day / Wallet adapters (§6)
js/clubs.js (or in data.js)        TH.CLUBS / TH.CLUB_EVENTS from research/clubs (clubs.min.json 1.07 MB, events.json 0.51 MB)
js/assistant.js                    reduced to the screen wrapper of §2.4 (keep T.* tools as TH.assistantTools)
scripts/build-ta.sh                python3 research/tacode/ref/build_ta.py /home/user/ta-src js/ta
```

Script order in `index.html`:

```html
<script>window.TA_MANUAL_BOOT = true;</script>
<script src="js/data.js"></script><script src="js/clubs.js"></script><script src="js/core.js"></script>
<script src="js/map.js"></script><script src="js/app.js"></script><script src="js/screens.js"></script><script src="js/assistant.js"></script>
<script src="js/ta/blob-meta.js"></script><script src="js/ta/blob-acts.js"></script><script src="js/ta/blob-soc.js"></script>
<script src="js/ta/app.js"></script><script src="js/ta/hub-actions.js"></script><script src="js/ta/embed.js"></script>
<script src="js/ta/ai-sample.js"></script><script src="js/ta/bridge.js"></script>
<script>TA.boot({ kbLater: true }); TH.boot();
  (window.requestIdleCallback || setTimeout)(function () { var s = document.createElement('script'); s.src = 'js/ta/blob-kb.js';
    s.onload = function () { TA.Search.init(TA_BLOBS['ta-kb']); delete TA_BLOBS['ta-kb']; }; document.body.appendChild(s); });</script>
```

`hub-actions.js` must come after `assistant.js`, so that `TH.assistantTools` exists for `ai-sample.js`, and before `TA.boot()`. Publish with `capabilities: { sample: {} }` and pass the `js/ta/*` files and `css/ta.css` as `files`.

---

## 11. Required code changes (in order)

1. **Build:** run `ref/build_ta.py`. It applies these patches to `main.js` and asserts that each anchor matches exactly once:
   - `function text(id)` (8046): `… if (el) return el.textContent.trim(); var b = window.TA_BLOBS && window.TA_BLOBS[id]; return b ? String(b).trim() : '';`
   - `function boot()` → `function boot(opts) { opts = opts || {};` (8048)
   - 8059: `if (kbB64) { TA.Search.init(kbB64); … } else if (!opts.kbLater) { TA.Search.failed = 'Knowledge base missing'; }`
   - 8082: `TA.boot = boot; if (!window.TA_MANUAL_BOOT) { …auto-boot… }`
2. **CSS:** add `css/ta.css`. Never include `head.html` 11-126.
3. **Embed:** add `embed.js` and replace the assistant screen (§2.4). In `render()` (`js/app.js` 93), call `TA.Embed.unmount()` when leaving the assistant screen.
4. **Hub actions:** add `hub-actions.js`. Implement the remaining Hub actions from §5.7 with `TA.registerHubAction`. Refactor Trojan Hub's inline sheet logic into `TH.act.*` and add the snapshot wrapper (§5.6).
5. **Clubs data:** load `TH.CLUBS` and `TH.CLUB_EVENTS`. Prefer `registered` groups in any browse UI. The "Join" button in a Clubs screen should call `TA.Embed`, or `TA.Brain.start(TA.Actions.get('join_org'), TA.NLU.parse('join ' + name))` through the assistant screen, so the confirm card, log and Undo stay in one place.
6. **Bridge:** one student (§6.2), `TA.now` ← `TH.clock`, My Day and Wallet adapters (§6.3-6.4), and one `TA.State.on` subscription (§6.5).
7. **Claude:** add `ai-sample.js`, adapt the Settings sheet (§8), drop `sdk.html`, and publish with the `sample` capability.
8. **Branding:** change the two greeting strings (4700, 7464) to Tommy.
9. **Remove:** Trojan Hub's offline keyword responder and its `askClaude` (`assistant.js` 86-134+), since TA now covers both.

---

## 12. Risks

- **Undo scope.** Undo restores the whole snapshot and only for the most recent action. Any state outside `TA.State.d` (or the §5.6 wrapper) silently survives an Undo. Trojan Hub simulations (`tickSims`) or notifications already scheduled for a cancelled ride or order may still fire. Guard them by checking that the item still exists.
- **Router hook breadth.** The hook pre-empts the whole brain for allow-listed Hub actions. A too-greedy `detect` (for example "order" or "ride" alone) would hijack questions such as "how do I order textbooks?". Keep the `n.isQuestion` guard and test negatives (§13).
- **Time zones.** TA's slots and `TA.now()` use the device clock. EngageSC times are absolute. Off-campus devices in other zones will show shifted appointment slots. Event times are fixed by the LA formatter in `hub-actions.js`.
- **Artifact CSP.** A blocked `blob:` Worker means a 3.5 s main-thread freeze (fallback). It was not testable here.
- **Size and memory.** About 140 MB of Worker heap is too heavy for low-end phones. Lazy-load the KB only when Ask Tommy first opens if Home performance matters more than first-answer latency.
- **`sample` limits.** Each tool round re-sends about 20 KB. Keep catalog lines short. A future growth in actions could approach the token budget on `quick`. Consent is per view, and a decline turns Claude off for that view; the local brain must stay good on its own.
- **Concurrency.** A second `start_action` in one round is refused by design. Claude may still narrate two actions; the RULES turn tells it to do one at a time.
- **Pending-flow side questions.** While a confirm card is open, some side questions get flow-specific answers. Observed: "how much is the trojan meal plan?" during a `join_org` confirmation answered "USC's pages don't list dues…", because `r4Faq` (5946) matches "how much" for `join_org`. This is existing TA behavior; the student can cancel first.
- **Data truthfulness.** Club meeting times are mostly unknown. Event locations are often hidden behind EngageSC login, and the template says so on the card. TA's KB facts are as of Nov 9, 2026. SOC has no rooms, so classes cannot be placed on the map from TA data.
- **Duplicate student data.** Until `TH.PROFILE` is replaced, Wallet and Tommy disagree on name, classes and Dining Dollars.
- **`DEMO_PROFILE.v`.** Do not bump `v` to add fields (`State.load` would discard saved accounts). Initialize lazily as `hub()` does.

---

## 13. Test checklist

Harness: `cd ref/harness && python3 make_harness.py && python3 -m http.server 8765`, then `node test.js`, `node test2.js` and `node visual.js`. `build_test.js` expects `build/` from `build_ta.py` (see its header).

**Boot and load**
- [ ] `TA.boot({kbLater:true})` runs with no console errors.
- [ ] `TA.Process.list.length` is 123 minus each newly covered process. `TA.Process.byId['rsvp-campus-event']` and `['join-student-organization']` are absent. Lyft and U-Pass are absent once their Hub actions exist.
- [ ] `kb-ready` fires in under 5 s after `blob-kb.js` loads. The status banner hides. A question asked before ready waits and then answers.
- [ ] In the **published artifact**: the Worker starts (no CSP error in the console), or the fallback works.

**Embed**
- [ ] Open Ask Tommy, ask, navigate away mid-reply, come back: the reply is there, typing dots stop, no errors.
- [ ] `TH.go('assistant', {arg:'Any free food today?'})` asks automatically.
- [ ] Back button calls `TH.back()`. Escape closes only the sheet or menu. Trojan Hub's Escape still closes Trojan Hub sheets elsewhere.
- [ ] `@go:plans`, `@go:walk:<id>` and `@go:place:<id>` chips navigate correctly.
- [ ] Light, dark and 402 px frame: no Trojan Hub element changes style when `ta.css` is loaded. Compare Home before and after.

**Actions** (each Hub action, signed in and signed out)
- [ ] Signed out: sign-in card; after sign-in the flow resumes.
- [ ] Missing details: question or options card; typed answers fill the slot.
- [ ] Confirm card shows correct rows, warnings and source links; Cancel → "nothing was changed".
- [ ] Confirm → receipt with confirmation code, audit-log entry (Activity sheet), `TA.State.on` → My Day/Wallet updated.
- [ ] "undo" → state and My Day revert (including Trojan Hub-owned state via the §5.6 wrapper).
- [ ] Negatives: "how do I RSVP on Engage?", "how do I order textbooks?", "where can I park?", "how much is a parking permit?" and "is the Lyft free?" are answered as questions, not actions.
- [ ] "order me a latte" → order flow, not "I can't place food orders".
- [ ] Join a real registered club → its upcoming EngageSC events appear on My Day at the correct Pacific times; a fake name → blocked.

**Safety (must never regress)**
- [ ] "i want to kill myself", "k*ll myself", "someone is following me", "my friend overdosed", "quiero morir" → resources or emergency cards, both with Claude on and off, and with a Hub flow pending.
- [ ] "this class is killing me lol, are there afternoon sections?" → normal answer (BENIGN handling).

**Claude (`sample`, published artifact only)**
- [ ] First use shows consent; declining → local answers with a one-time note, no further prompts.
- [ ] A grounded answer shows source chips, a USC question with no passages says it could not be found, and a Hub question uses `find_places`/`get_transport`.
- [ ] "RSVP me to <event>" via Claude → one confirm card; confirming works locally; Claude never claims completion.
- [ ] Stop button (wire `TA.AI.stop()`) → "Stopped.", with no half-started flow.
