# Trojan Hub with Ask Tommy on the Claude API

Trojan Hub is a student-made USC campus app. This folder holds the built app plus one server function that lets **Ask Tommy** use Claude (Claude Haiku 5.5), with the API key kept secret on the server.

| Path | What it is |
|---|---|
| `site/index.html` | The whole app in one file |
| `netlify/functions/tommy.mjs` | Tommy's AI, served at `/api/tommy`, plus the "scripts needed" list at `/api/tommy-requests`. It holds the key and calls Claude |
| `netlify/functions/tommy-prompt.mjs` | Tommy's command list, which commands are public, and the translator and answer checker instructions, generated from the app. Don't edit it by hand |
| `netlify.toml` | Tells Netlify what to publish, where the function is, and which Node.js version to use |

## Put it online (GitHub + Netlify)

1. Push this folder to a GitHub repo. Private is fine.
2. On netlify.com, go to **Add new site → Import an existing project → GitHub** and pick the repo. Leave the build settings as they are; `netlify.toml` already sets them. Click **Deploy**.
3. Go to **Site configuration → Environment variables → Add a variable** and add these (keep all scopes):

   | Key | Value | Needed? |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | your Claude API key | Yes, for any AI |
   | `TOMMY_ADMIN_KEY` | a long random password you make up (for example 32 letters and digits) | Yes, to see the "scripts needed" list |
   | `GITHUB_TOKEN` | a fine-grained GitHub token with **Issues: read and write** on one repo | Optional |
   | `GITHUB_REPO` | that repo as `owner/name` | Optional, with `GITHUB_TOKEN` |

   Everything else has a safe default (see **Costs and limits** for the optional settings).
4. Go to **Deploys → Trigger deploy → Deploy site** so the function picks up the variables.
5. Check it: open `https://<your-site>.netlify.app/api/tommy`. It should show `{"ok":true,...,"features":{"translate":true,"judge":true,"search":true,"answer":true,"propose":true,"flags":true}}`.
6. In the Claude Console, set a monthly **spend limit** for the key. It is the only hard cap on cost.

Keys and tokens only ever go in step 3. Don't put them in the HTML, in this repo, or in a chat message.

## How Tommy answers

Tommy has two kinds of work, and Claude does different things in each.

**Questions about USC** (libraries, hours, gates, courses, clubs, events, campus info). Claude Haiku is the visible brain, but it only ever writes from public USC information:

1. Tommy's campus tools run **on the student's phone** (for example `course.who` or `hours.check`).
2. If a tool's answer is public, the phone sends that public output (and Tommy's built-in USC page text, with their links) to the function. Haiku writes the final answer **from that text only**: no memory, no outside sources, no tools, at most 120 words, citing the sources by number.
3. Before anything is shown, the phone **fact-checks** the answer: every time, date, number, price, course code and name must appear in the tool's text. If anything doesn't, Tommy throws the AI text away and shows the verified answer instead (and tells the team).
4. The student sees the AI answer, then a **Verified data** block (the tool's own text, with its Est./Simulated labels), then the sources, then a tag like *Claude Haiku · 1 campus tool · 2 USC sources*.
5. If the tools' text doesn't answer the question, Haiku searches **USC's own websites only** (usc.edu and its subdomains, at most 2 searches) and answers from those pages, tagged *Claude Haiku · searched USC websites*. If USC's pages don't answer either, Tommy says so honestly.
6. Every question that needed a USC search is recorded for the team ("script needed"), with an AI-drafted proposal for the script that would answer it.

**Acting for the student or reading their data** (grades, bookings, guest passes, orders, emails, dues…). Unchanged: Claude only turns the student's words into a Tommy command. The command runs on the phone and Claude never sees the result. Replies inside an action (amounts, confirmations) never go to Claude. If no command or action can do it, Tommy says *"This isn't a feature yet. We've flagged it for the Trojan Hub team so it can be added."* and sends the team a short description of the feature only, never the student's message. Actions never trigger a web search.

**Safety first.** Crisis, emergency and safety messages are handled on the phone with the real numbers (DPS 213-740-4321, 911, 988, 213-740-9355, text TROJAN to 741741) and are never sent anywhere. Personal topics (health, mental and sexual health, immigration, identity, social security numbers) and help/need wording never reach Claude either; the function also refuses them if they ever arrive, and never stores them.

### Privacy and integrity guards

- **Only public output can reach Claude.** A command counts as public only if the app marks it so (`TA.Script.isPublic`, plus the older public commands such as `hours.check`, `course.who`, `building.find`, `events.find`, `gates.status`, `breaks.next` and `faq`). Everything else is private by default: grades, homework, exams, plans, wallet and account commands, anything measured from where the student is, and every action. The phone enforces this, and the function refuses an answer request that names any private command (422). One private command has a public twin: the place finder (`place.find`, "a quiet library open late", "a beautiful old library with greenery") adds walking times from where the student is, so Tommy runs `place.find.public` instead, the same finder with no position at all (no walking times, nothing "nearest"), whenever the question isn't about distance from the student.
- **The data can't give Claude orders.** Tool text and USC page text go to Haiku inside `<data>` tags that can't be broken out of, with a rule that the data may contain instructions and that they must be ignored. Web addresses and outside e-mail addresses in the data are removed before Claude sees it, unless they are the answer's own sources.
- **The reply is checked before it leaves the server.** The function accepts only `{status, answer_md, cites}`, at most 120 words, with HTML removed. A sentence that links anywhere other than the given sources is dropped. A reply that repeats an instruction from the data or asks the student to send a password or card number is thrown away. The function never echoes the data back.
- **Logs stay clean.** Question text appears in the function log only on `SCRIPT NEEDED` lines (never personal ones). Answers, data and errors are logged without the student's words.

## Try it

Open the site, tap **Ask Tommy**, and send:

- `who teaches intro to civil engineering` should give an AI answer from USC's Schedule of Classes (CE 106, Amy Rechenmacher), with the verified course data under it
- `when does leavey close` should give an AI answer with the library hours under it
- `find me a library that's beautiful with a lot of greenery and an old library` should give an AI answer from Tommy's place finder (Doheny Memorial Library, opened 1932, next to Alumni Park), with the verified data under it
- `tell me about the greenhouse on campus` has no script: Haiku searches USC's websites, and the question shows up in the "scripts needed" list with a proposed script
- `check my grades` should answer on the phone, with nothing sent to the server
- `can u map out my sat for me` should give a plan for Saturday

Under each answer, a small tag says where it came from: **Tommy · on your phone**, **Claude Haiku · ran on your phone** (Claude turned the words into the campus tool, which ran on the phone), **Claude Haiku · N campus tools · M USC sources**, or **Claude Haiku · searched USC websites**. Next to the first two, small print says what reached the AI for that message: nothing, the words only, or the words and public USC data (an AI answer that was written but not shown, for example because the fact check rejected it).

## The "scripts needed" list

Open `https://<your-site>.netlify.app/api/tommy-requests?key=<TOMMY_ADMIN_KEY>`. It's a table of what Tommy couldn't do well, most asked first:

- **no script**: no script could answer the question, so Claude searched USC's websites. These rows also show a **proposed script**: Claude's draft of the command the team could write (name and arguments, example questions, the public USC source it would read, and why). It's a draft: check it before building. "exists" means a script with that name exists but didn't match the question.
- **inaccurate**: a script answered, but the answer checker found it missed part of the question.
- **fact check**: an AI answer was thrown away on the phone because it stated something the tool's data didn't.
- **missing feature**: a student asked Tommy to do something no action can do yet (the AI's short description, never the student's message).

The page also shows today's AI use against the daily limits. Add `&format=json` for JSON. Without the right key it answers 401, and after 10 wrong keys from one visitor it stops answering for 10 minutes.

Where the alerts go:

- **Netlify Blobs**, in the site-wide store `tommy-script-requests` (one entry per question, keyed by a hash of the question, with its proposal). Counts are approximate: one visitor asking the same thing again within 3 minutes counts once.
- **The function log**, as one `SCRIPT NEEDED {...}` line per alert: **Logs → Functions → tommy** in Netlify. This works even if Blobs isn't available.
- **A GitHub issue** the first time a question is seen, if `GITHUB_TOKEN` and `GITHUB_REPO` are set, including the proposed script. Issues get the label `tommy-script-needed`. Keep that repo private: issues contain the questions students asked (never personal ones).

Once a script answers a question well, Tommy stops sending it to the USC search, so it stops showing up.

## What the function accepts

Developers only. All requests are JSON from this site's own pages; other websites get 403. Bodies over 20 KB get 413.

| Request | Answer |
|---|---|
| `GET /api/tommy` | `{ok, model, features: {translate, judge, search, answer, propose, flags}}` |
| `POST {text, now, earlier[, hint]}` or `{mode: "translate", …}` | `{cmd, args}`; `{cmd: "none", args: {}}` when it isn't about USC; `{cmd: "unsupported", args: {feature}}` when no action exists; `{cmd: null}` when nothing usable came back. `hint` is Tommy's own guess (a public command line or `ask q="…"`), sent when its answer doesn't cover every word of the question; any other hint is ignored |
| `POST {mode: "answer", question, context, sources[, now, original, tools]}` | `{status: "ok", answer_md, cites}` (cites: 0-based positions in `sources`) or `{status: "insufficient", answer_md: "", cites: []}`; `"refused": true` if Claude declines, `"capped": true` when today's limit is reached. `context` is text or a list of texts (cut to 10,000 characters at a line end; a "Campus tool: <name>" label naming a private command is refused like `tools`); `sources` is `[{url, title}]` (10 at most); `tools` lists the commands the text came from |
| `POST {mode: "search", question[, original, now, reason, line, missing]}` | `{found: true, answer, sources: [{url, title}], searches[, cached: true]}` or `{found: false, answer: null, sources: [], searches, reason[, capped: true]}`. Also records the alert (`reason` defaults to `"no-script"`; `"inaccurate"` when the checker sent it here) |
| `POST {mode: "judge", question, answer, line, now[, uncovered]}` | `{verdict: "good" \| "better" \| "search", missing, next, q}`; `{verdict: null, refused \| capped: true}` |
| `POST {mode: "flag", question, line, missing, reason: "inaccurate" \| "no-script" \| "missing-feature" \| "factcheck"}` | `{ok: true, stored}` |
| `GET /api/tommy-requests?key=…[&format=json]` | the list above |

Errors: 400 bad request, 403 other website, 413 too big, 422 personal or crisis wording, or a private command's output (never sent to Claude), 429 too many requests from one visitor, 501 that feature is turned off, 502 Claude's reply couldn't be used (Tommy shows its verified answer), 504 Claude was slow, 503 no API key.

## Costs and limits

- **Model.** Claude Haiku 5.5 (`claude-haiku-5-5`, $0.10 per million input tokens and $0.50 per million output tokens) at low effort for everything, with prompt caching on the long instructions. An AI answer or a script proposal costs a few hundredths of a cent; a translation or an answer check about a tenth of a cent or less once its instructions are cached. A USC search costs about 1 to 3 cents, mostly Anthropic's web search fee ($10 per 1,000 searches, at most 2 per question). Messages Tommy handles on the phone cost nothing.
- **Daily limits** for the whole site, per campus day (midnight to midnight in Los Angeles), counted in the Netlify Blobs store `tommy-usage`:

  | What | Default | Setting |
  |---|---|---|
  | AI answers | 1,000 a day | `TOMMY_CAP_ANSWER` |
  | USC searches | 100 a day | `TOMMY_CAP_SEARCH` |
  | Answer checks | 300 a day | `TOMMY_CAP_JUDGE` |
  | Script proposals | 100 a day | `TOMMY_CAP_PROPOSE` |
  | Translations | no daily limit | `TOMMY_CAP_TRANSLATE` |

  Set a number to change a limit, `0` to stop that kind for the day, or `off` for no limit. Past a limit Tommy keeps working: it shows its own verified answers, and the reply says `"capped": true`. With all defaults the worst day costs roughly $4 plus translations.
- **Search cache.** USC search answers are kept for 7 days in the Blobs store `tommy-search-cache`, by the question with case, punctuation and spacing ignored (and the student's own wording when the search was rephrased). "USC's pages don't say" is kept for 1 day. Questions about now, today, tonight, tomorrow or this week are never cached. A cached answer costs nothing and doesn't count against the search limit.
- **Per visitor** (best effort, per server instance): 120 AI calls per 10 minutes (translations, answers, checks and searches together), of which at most 30 searches, and 60 alerts.
- **Turning parts off.** `TOMMY_ANSWER=off` (no AI-written answers: Tommy shows its own), `TOMMY_SEARCH=off`, `TOMMY_JUDGE=off`, `TOMMY_PROPOSE=off`. Deleting `ANTHROPIC_API_KEY` turns off all AI; Tommy keeps working on its scripts.
- **Changing the model.** Set `TOMMY_MODEL` (for example `claude-sonnet-5-5`) and redeploy. AI answers and proposals use structured outputs (a JSON schema); if the API ever refuses that, the function falls back to plain JSON by itself. `TOMMY_STRUCTURED=off` skips it from the start.
- **Netlify AI Gateway.** If you use Netlify's AI Gateway instead of your own key, translation, answers and the answer check should work, but Netlify doesn't document web search through the gateway. If searches come back as "USC search is unavailable", use your own `ANTHROPIC_API_KEY`.
- **Stores.** All three Blobs stores (`tommy-script-requests`, `tommy-usage`, `tommy-search-cache`) are site-wide: deploy previews share them with the live site. If Blobs isn't available, alerts go to the function log only, and the limits and the cache count on each server instance.
- **Node.js.** `netlify.toml` sets Node 24 because `@netlify/blobs` needs Node 22.12 or later.

## Rebuilding after the app changes

```bash
node scripts/build-netlify.cjs --project /path/to/trojan-hub-v4 --out ./netlify-site
```

Run this from the `tommy-api` repo. It rebuilds the app, opens it in a headless browser and regenerates `tommy-prompt.mjs`, so the command list, which commands are public (`TA.Script.isPublic` in the built app plus the built-in public commands), the translator and the answer checker all match the app. To test the function without a key or any cost, run `npm test` there: it checks every mode, the limits, the cache and the guards against a local mock of the Claude API. For a local run that keeps alerts, counters and the cache in memory, set `TOMMY_FLAG_STORE=memory`; `test/e2e/harness.mjs` serves a built site with the real function and the mock (`POST /__mock-mode {"answer": "hallucinate"}` and similar switch the mock's behavior for browser tests). `test/integ/build-integ.sh` + `test/integ/e2e-integ.cjs` run the whole browser test list that way.

After a deploy, `node scripts/live-check.cjs https://<your-site>.netlify.app` sends 16 must-pass messages to the live site, one every 10 seconds, and prints each answer's tag, the requests it caused (with their statuses) and its sources, marked PASS, WARN (a safe fallback, such as the fact check rejecting Haiku's text) or FAIL. A run costs a few cents.

## Club drafts and "Tommy is learning" (netlify/functions/tommy-extras.mjs)

A second, separate function, so it can never break Ask Tommy:

- `POST /api/tommy-draft` `{"kind": "announcement", "payload": {club, title, when, where, desc, rsvpUrl}}` or
  `{"kind": "members-summary", "payload": {club, requests: [{title, votes, type, preferred}]}}` or
  `{"kind": "newsletter", "payload": {club, facts}}` → `{"text", "model"}`.
  Club officers press **Draft the announcement**, **Summarize what members want** or the newsletter's **Draft with AI**. Claude Haiku writes from those
  fields only: the app never sends member names, emails or who has paid, and the function removes emails and
  phone numbers again. Every time, date, weekday, price and number in Claude's text must appear in the event facts
  or the request list; otherwise Claude gets one retry, then the app shows its own template (labeled as one).
  Limits: 12 drafts per visitor per 10 minutes and 300 a day (Netlify Blobs store `tommy-usage`).
- `GET /api/tommy-learning` → `{"items": [{name, why, examples, count, last}]}`: the tools Claude proposed when Ask
  Tommy couldn't answer a public question, read from the "scripts needed" list. Only Claude's proposal is shown
  (its name, why, and AI-written example questions), never a student's own message. Approving or dismissing a
  proposal in the app is simulated.
